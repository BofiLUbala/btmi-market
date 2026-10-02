package notify

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// Sweeper raises the notifications no single request produces: reminders
// when nobody acted, stock-outs, and changes on followed products (a
// promotion can start by itself at its scheduled time).
type Sweeper struct {
	db       *database.DB
	notifier *Notifier
	prefs    *Prefs
	now      func() time.Time
}

func NewSweeper(db *database.DB, notifier *Notifier, prefs *Prefs) *Sweeper {
	return &Sweeper{db: db, notifier: notifier, prefs: prefs, now: time.Now}
}

// Reminder delays.
const (
	sellerReminderAfter = 15 * time.Minute
	adminStalledAfter   = 60 * time.Minute
	receiptReminderAfter = 24 * time.Hour
	// A price drop is only worth announcing when it is real.
	priceDropRatio = 0.95
)

// sweepLockKey keeps several API instances from sweeping at the same time.
const sweepLockKey = 7_110_2026

// Run sweeps every interval until ctx ends.
func (s *Sweeper) Run(ctx context.Context, every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			s.SweepOnce()
		}
	}
}

// SweepOnce runs every check once, if no other instance is doing it.
func (s *Sweeper) SweepOnce() {
	tx, err := s.db.Begin()
	if err != nil {
		return
	}
	defer tx.Rollback()
	var locked bool
	if err := tx.QueryRow(`SELECT pg_try_advisory_xact_lock($1)`, sweepLockKey).Scan(&locked); err != nil || !locked {
		return
	}
	s.orderReminders()
	s.receiptReminders()
	s.stockOuts()
	s.watchedProducts()
}

type pendingOrder struct {
	id         uuid.UUID
	businessID uuid.UUID
	number     string
}

func (s *Sweeper) pendingOrders(after time.Duration, reminder models.NotificationType) []pendingOrder {
	rows, err := s.db.Query(`SELECT o.id, o.business_id, COALESCE(NULLIF(o.order_number, ''), LEFT(o.id::text, 8))
		FROM orders o
		WHERE o.status = 'PENDING'
		  AND EXISTS (SELECT 1 FROM notifications n WHERE n.reference_id = o.id AND n.type = 'NEW_ORDER'
		              AND n.created_at < NOW() - make_interval(secs => $1) AND n.created_at > NOW() - INTERVAL '3 days')
		  AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.reference_id = o.id AND n.type = $2)
		LIMIT 200`, after.Seconds(), string(reminder))
	if err != nil {
		log.Printf("notify: pending orders: %v", err)
		return nil
	}
	defer rows.Close()
	var out []pendingOrder
	for rows.Next() {
		var p pendingOrder
		if rows.Scan(&p.id, &p.businessID, &p.number) == nil {
			out = append(out, p)
		}
	}
	return out
}

func (s *Sweeper) orderReminders() {
	for _, o := range s.pendingOrders(sellerReminderAfter, models.NotificationTypeOrderActionReminder) {
		s.notifier.ToBusiness(o.businessID, false, Message{
			Type:    models.NotificationTypeOrderActionReminder,
			Title:   fmt.Sprintf("Commande en attente : %s", o.number),
			Body:    "Un client attend votre réponse. Acceptez ou refusez la commande.",
			RefType: RefOrder, RefID: o.id,
			Meta: map[string]interface{}{"order_id": o.id.String(), "order_number": o.number},
		})
	}
	for _, o := range s.pendingOrders(adminStalledAfter, models.NotificationTypeOrderStalled) {
		s.notifier.ToAdmins([]string{"COMMERCE_ADMIN"}, Message{
			Type:    models.NotificationTypeOrderStalled,
			Title:   fmt.Sprintf("Commande sans réponse : %s", o.number),
			Body:    "La boutique n'a pas traité cette commande depuis plus d'une heure.",
			RefType: RefOrder, RefID: o.id,
			Meta: map[string]interface{}{"order_id": o.id.String(), "order_number": o.number},
		})
	}
}

func (s *Sweeper) receiptReminders() {
	rows, err := s.db.Query(`SELECT o.id, bp.user_id, COALESCE(NULLIF(o.order_number, ''), LEFT(o.id::text, 8))
		FROM orders o JOIN buyer_profiles bp ON bp.id = o.buyer_profile_id
		WHERE o.status = 'DELIVERED' AND o.received_at IS NULL
		  AND o.delivered_at < NOW() - make_interval(secs => $1) AND o.delivered_at > NOW() - INTERVAL '7 days'
		  AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.reference_id = o.id AND n.type = 'BUYER_RECEIPT_REMINDER')
		LIMIT 200`, receiptReminderAfter.Seconds())
	if err != nil {
		log.Printf("notify: receipt reminders: %v", err)
		return
	}
	type row struct {
		order, user uuid.UUID
		number      string
	}
	var list []row
	for rows.Next() {
		var r row
		if rows.Scan(&r.order, &r.user, &r.number) == nil {
			list = append(list, r)
		}
	}
	rows.Close()
	for _, r := range list {
		s.notifier.ToUser(r.user, audBuyer, Message{
			Type:    models.NotificationTypeBuyerReceiptReminder,
			Title:   fmt.Sprintf("Avez-vous bien reçu votre commande %s ?", r.number),
			Body:    "Confirmez la réception pour clôturer la commande.",
			RefType: RefOrder, RefID: r.order,
			Meta: map[string]interface{}{"order_id": r.order.String(), "order_number": r.number},
		})
	}
}

// stockOuts tells sellers when a variant that had stock runs out in a shop,
// once per rupture.
func (s *Sweeper) stockOuts() {
	// Back in stock: the rupture is over, a later one will be announced again.
	_, _ = s.db.Exec(`DELETE FROM stock_out_alerts a USING inventory i
		WHERE i.shop_id = a.shop_id AND i.variant_id = a.variant_id AND i.quantity - i.reserved_quantity > 0`)

	rows, err := s.db.Query(`INSERT INTO stock_out_alerts (shop_id, variant_id)
		SELECT i.shop_id, i.variant_id
		FROM inventory i
		JOIN shops sh ON sh.id = i.shop_id AND sh.status = 'ACTIVE'
		JOIN product_variants v ON v.id = i.variant_id AND v.status = 'ACTIVE'
		JOIN products p ON p.id = i.product_id AND p.publication_status = 'PUBLISHED'
		WHERE i.quantity - i.reserved_quantity <= 0
		  AND i.updated_at > NOW() - INTERVAL '2 hours'
		  AND EXISTS (SELECT 1 FROM stock_movements m WHERE m.shop_id = i.shop_id AND m.variant_id = i.variant_id AND m.new_quantity > 0)
		ON CONFLICT DO NOTHING
		RETURNING shop_id, variant_id`)
	if err != nil {
		log.Printf("notify: stock-outs: %v", err)
		return
	}
	type key struct{ shop, variant uuid.UUID }
	var fresh []key
	for rows.Next() {
		var k key
		if rows.Scan(&k.shop, &k.variant) == nil {
			fresh = append(fresh, k)
		}
	}
	rows.Close()
	for _, k := range fresh {
		var businessID, productID uuid.UUID
		var productName, variantName, shopName string
		err := s.db.QueryRow(`SELECT p.business_id, p.id, p.name, COALESCE(v.name, ''), sh.name
			FROM product_variants v JOIN products p ON p.id = v.product_id, shops sh
			WHERE v.id = $1 AND sh.id = $2`, k.variant, k.shop).Scan(&businessID, &productID, &productName, &variantName, &shopName)
		if err != nil {
			continue
		}
		label := productName
		if variantName != "" && !strings.EqualFold(variantName, productName) {
			label += " (" + variantName + ")"
		}
		s.notifier.ToBusiness(businessID, false, Message{
			Type:    models.NotificationTypeStockOut,
			Title:   "Rupture de stock : " + label,
			Body:    fmt.Sprintf("Plus aucune unité disponible chez %s. Les acheteurs ne peuvent plus commander cet article.", shopName),
			RefType: RefProduct, RefID: productID,
			Meta: map[string]interface{}{"product_id": productID.String(), "variant_id": k.variant.String(), "shop_id": k.shop.String()},
		})
	}
}

type watchState struct {
	userID, productID uuid.UUID
	name              string
	currency          string
	lastPrice         sql.NullFloat64
	lastInStock       sql.NullBool
	price             float64
	inStock           bool
	consented         bool
}

type watchEvent struct {
	w         watchState
	kind      models.NotificationType
	fromPrice float64
}

// watchedProducts compares each followed product with what was last announced
// and alerts buyers who opted in, within the frequency caps.
func (s *Sweeper) watchedProducts() {
	rows, err := s.db.Query(`SELECT w.user_id, w.product_id, p.name, COALESCE(NULLIF(p.currency, ''), 'USD'),
			w.last_price, w.last_in_stock,
			COALESCE((SELECT MIN(v.sale_price) FROM product_variants v WHERE v.product_id = p.id AND v.status = 'ACTIVE' AND v.sale_price > 0), p.unit_price, 0),
			p.discount_active, COALESCE(p.discount_type, ''), COALESCE(p.discount_value, 0), p.discount_start, p.discount_end,
			COALESCE((SELECT SUM(i.quantity - i.reserved_quantity) FROM inventory i
			          JOIN product_variants v ON v.id = i.variant_id AND v.status = 'ACTIVE'
			          JOIN shops sh ON sh.id = i.shop_id AND sh.status = 'ACTIVE'
			          WHERE i.product_id = p.id), 0) > 0,
			EXISTS (SELECT 1 FROM notification_preferences np WHERE np.principal_kind = 'USER' AND np.principal_id = w.user_id
			        AND np.category = 'WATCHLIST' AND np.consented_at IS NOT NULL)
		FROM product_watches w JOIN products p ON p.id = w.product_id
		WHERE p.publication_status = 'PUBLISHED'`)
	if err != nil {
		log.Printf("notify: watches: %v", err)
		return
	}
	now := s.now()
	byUser := map[uuid.UUID][]watchEvent{}
	var silent []watchState
	for rows.Next() {
		var w watchState
		var base float64
		var promo models.Promotion
		var start, end sql.NullTime
		if err := rows.Scan(&w.userID, &w.productID, &w.name, &w.currency, &w.lastPrice, &w.lastInStock,
			&base, &promo.Active, &promo.Type, &promo.Value, &start, &end, &w.inStock, &w.consented); err != nil {
			continue
		}
		if start.Valid {
			promo.Start = &start.Time
		}
		if end.Valid {
			promo.End = &end.Time
		}
		w.price = promo.EffectivePrice(base, now)

		if !w.lastPrice.Valid || !w.lastInStock.Valid || !w.consented {
			// First look, or nobody to tell: just remember the current state so
			// only later changes are announced.
			silent = append(silent, w)
			continue
		}
		switch {
		case w.inStock && !w.lastInStock.Bool:
			byUser[w.userID] = append(byUser[w.userID], watchEvent{w: w, kind: models.NotificationTypeBackInStock})
		case w.inStock && w.price > 0 && w.price <= w.lastPrice.Float64*priceDropRatio:
			byUser[w.userID] = append(byUser[w.userID], watchEvent{w: w, kind: models.NotificationTypePriceDrop, fromPrice: w.lastPrice.Float64})
		case w.price > w.lastPrice.Float64 || w.inStock != w.lastInStock.Bool:
			// A rise or a rupture resets the reference silently.
			silent = append(silent, w)
		}
	}
	rows.Close()

	for _, w := range silent {
		s.snapshot(w, false)
	}
	for userID, events := range byUser {
		// Over the daily cap: keep the change pending, it is announced once
		// the cap allows (unless it reverts meanwhile).
		if s.prefs.CapReached(userID, CategoryWatchlist) {
			continue
		}
		if len(events) == 1 {
			e := events[0]
			m := Message{Type: e.kind, RefType: RefProduct, RefID: e.w.productID,
				Meta: map[string]interface{}{"product_id": e.w.productID.String()}}
			if e.kind == models.NotificationTypeBackInStock {
				m.Title = "De retour en stock : " + e.w.name
				m.Body = fmt.Sprintf("Le produit que vous suivez est de nouveau disponible à %s.", models.FormatMoneyFR(e.w.price, e.w.currency))
			} else {
				m.Title = "Baisse de prix : " + e.w.name
				m.Body = fmt.Sprintf("%s au lieu de %s.", models.FormatMoneyFR(e.w.price, e.w.currency), models.FormatMoneyFR(e.fromPrice, e.w.currency))
			}
			s.notifier.ToUser(userID, audBuyer, m)
		} else {
			names := make([]string, 0, len(events))
			for _, e := range events {
				names = append(names, e.w.name)
			}
			s.notifier.ToUser(userID, audBuyer, Message{
				Type:    models.NotificationTypeWatchlistDigest,
				Title:   fmt.Sprintf("%d produits que vous suivez ont changé", len(events)),
				Body:    "Prix en baisse ou retour en stock : " + strings.Join(names, ", ") + ".",
				RefType: "WATCHLIST", RefID: userID,
			})
		}
		for _, e := range events {
			s.snapshot(e.w, true)
		}
	}
}

func (s *Sweeper) snapshot(w watchState, alerted bool) {
	_, _ = s.db.Exec(`UPDATE product_watches SET last_price = $3, last_in_stock = $4,
			last_alert_at = CASE WHEN $5 THEN NOW() ELSE last_alert_at END
		WHERE user_id = $1 AND product_id = $2`, w.userID, w.productID, w.price, w.inStock, alerted)
}
