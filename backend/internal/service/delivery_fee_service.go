package service

import (
	"context"
	"database/sql"
	"errors"
	"math"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// DeliveryFeeService is the single source of TBK delivery pricing. Finance
// edits it from the Control Center; checkout reads it when a buyer picks TBK
// delivery; the fee is then frozen on the order, so accounting and the seller
// always see what the buyer was actually charged.
type DeliveryFeeService struct {
	db    *sql.DB
	audit *AuditService
}

func NewDeliveryFeeService(db *sql.DB, audit *AuditService) *DeliveryFeeService {
	return &DeliveryFeeService{db: db, audit: audit}
}

// DeliveryFeeQuote is what a delivery costs for one order, and why.
type DeliveryFeeQuote struct {
	Fee      float64 `json:"fee"`
	Currency string  `json:"currency"`
	// Rule is DEFAULT, CITY or FREE_THRESHOLD.
	Rule     string `json:"rule"`
	CityName string `json:"city_name,omitempty"`
}

type DeliveryFeeZone struct {
	CityID       uuid.UUID `json:"city_id"`
	CityName     string    `json:"city_name"`
	ProvinceName string    `json:"province_name"`
	Fee          float64   `json:"fee"`
	Active       bool      `json:"active"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type DeliveryFeeHistoryItem struct {
	ID        uuid.UUID `json:"id"`
	Scope     string    `json:"scope"`
	CityName  string    `json:"city_name,omitempty"`
	OldValue  *float64  `json:"old_value"`
	NewValue  *float64  `json:"new_value"`
	Reason    string    `json:"reason"`
	AdminName string    `json:"admin_name"`
	CreatedAt time.Time `json:"created_at"`
}

type DeliveryFeeConfig struct {
	DefaultFee            float64                  `json:"default_fee"`
	Currency              string                   `json:"currency"`
	FreeDeliveryThreshold *float64                 `json:"free_delivery_threshold"`
	UpdatedAt             time.Time                `json:"updated_at"`
	UpdatedByName         string                   `json:"updated_by_name"`
	Zones                 []DeliveryFeeZone        `json:"zones"`
	History               []DeliveryFeeHistoryItem `json:"history,omitempty"`
}

// Quote resolves the fee for a delivery to cityID (nil when the address is not
// known yet) on an order whose products total subtotal.
func (s *DeliveryFeeService) Quote(ctx context.Context, cityID *uuid.UUID, subtotal float64) (DeliveryFeeQuote, error) {
	q := DeliveryFeeQuote{Rule: "DEFAULT"}
	var threshold sql.NullFloat64
	if err := s.db.QueryRowContext(ctx, `SELECT default_fee, currency, free_delivery_threshold FROM delivery_fee_settings WHERE id`).
		Scan(&q.Fee, &q.Currency, &threshold); err != nil {
		return q, err
	}
	if cityID != nil {
		var fee float64
		var name string
		err := s.db.QueryRowContext(ctx, `SELECT z.fee, c.name FROM delivery_fee_zones z JOIN cities c ON c.id = z.city_id WHERE z.city_id = $1 AND z.active`, *cityID).Scan(&fee, &name)
		if err == nil {
			q.Fee, q.Rule, q.CityName = fee, "CITY", name
		} else if err != sql.ErrNoRows {
			return q, err
		}
	}
	if threshold.Valid && subtotal >= threshold.Float64 {
		q.Fee, q.Rule = 0, "FREE_THRESHOLD"
	}
	q.Fee = models.RoundMoney(q.Fee)
	return q, nil
}

// Config returns the tariff, every city override and (optionally) the history.
func (s *DeliveryFeeService) Config(ctx context.Context, withHistory bool) (*DeliveryFeeConfig, error) {
	cfg := &DeliveryFeeConfig{Zones: []DeliveryFeeZone{}}
	var threshold sql.NullFloat64
	if err := s.db.QueryRowContext(ctx, `
		SELECT s.default_fee, s.currency, s.free_delivery_threshold, s.updated_at,
		       COALESCE(TRIM(a.first_name || ' ' || a.last_name), '')
		FROM delivery_fee_settings s LEFT JOIN admin_users a ON a.id = s.updated_by WHERE s.id`).
		Scan(&cfg.DefaultFee, &cfg.Currency, &threshold, &cfg.UpdatedAt, &cfg.UpdatedByName); err != nil {
		return nil, err
	}
	if threshold.Valid {
		v := threshold.Float64
		cfg.FreeDeliveryThreshold = &v
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT z.city_id, c.name, p.name, z.fee, z.active, z.updated_at
		FROM delivery_fee_zones z JOIN cities c ON c.id = z.city_id JOIN provinces p ON p.id = c.province_id
		ORDER BY p.name, c.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var z DeliveryFeeZone
		if err := rows.Scan(&z.CityID, &z.CityName, &z.ProvinceName, &z.Fee, &z.Active, &z.UpdatedAt); err != nil {
			return nil, err
		}
		cfg.Zones = append(cfg.Zones, z)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if withHistory {
		cfg.History = []DeliveryFeeHistoryItem{}
		hr, err := s.db.QueryContext(ctx, `
			SELECT h.id, h.scope, COALESCE(c.name, ''), h.old_value, h.new_value, h.reason,
			       COALESCE(TRIM(a.first_name || ' ' || a.last_name), ''), h.created_at
			FROM delivery_fee_history h
			LEFT JOIN cities c ON c.id = h.city_id
			LEFT JOIN admin_users a ON a.id = h.admin_id
			ORDER BY h.created_at DESC LIMIT 50`)
		if err != nil {
			return nil, err
		}
		defer hr.Close()
		for hr.Next() {
			var h DeliveryFeeHistoryItem
			var oldV, newV sql.NullFloat64
			if err := hr.Scan(&h.ID, &h.Scope, &h.CityName, &oldV, &newV, &h.Reason, &h.AdminName, &h.CreatedAt); err != nil {
				return nil, err
			}
			if oldV.Valid {
				v := oldV.Float64
				h.OldValue = &v
			}
			if newV.Valid {
				v := newV.Float64
				h.NewValue = &v
			}
			cfg.History = append(cfg.History, h)
		}
	}
	return cfg, nil
}

var errDeliveryReason = errors.New("a reason of at least 5 characters is required")

func validFee(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) && v >= 0 && v <= 10000 }

// UpdateSettings changes the default fee and/or the free-delivery threshold.
// clearThreshold removes the threshold (free delivery never applies).
func (s *DeliveryFeeService) UpdateSettings(ctx context.Context, adminID uuid.UUID, role models.AdminRole, defaultFee, threshold *float64, clearThreshold bool, reason string) error {
	if len(strings.TrimSpace(reason)) < 5 {
		return errDeliveryReason
	}
	if defaultFee != nil && !validFee(*defaultFee) {
		return errors.New("default fee must be between 0 and 10000")
	}
	if threshold != nil && (!validFee(*threshold) || *threshold <= 0) {
		return errors.New("free-delivery threshold must be greater than 0")
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var oldFee float64
	var oldThreshold sql.NullFloat64
	if err := tx.QueryRowContext(ctx, `SELECT default_fee, free_delivery_threshold FROM delivery_fee_settings WHERE id FOR UPDATE`).Scan(&oldFee, &oldThreshold); err != nil {
		return err
	}
	if defaultFee != nil && models.RoundMoney(*defaultFee) != oldFee {
		if _, err := tx.ExecContext(ctx, `UPDATE delivery_fee_settings SET default_fee = $1, updated_by = $2, updated_at = NOW() WHERE id`, models.RoundMoney(*defaultFee), adminID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO delivery_fee_history (scope, old_value, new_value, reason, admin_id) VALUES ('DEFAULT', $1, $2, $3, $4)`, oldFee, models.RoundMoney(*defaultFee), reason, adminID); err != nil {
			return err
		}
	}
	if threshold != nil || clearThreshold {
		var next interface{}
		if threshold != nil {
			next = models.RoundMoney(*threshold)
		}
		var old interface{}
		if oldThreshold.Valid {
			old = oldThreshold.Float64
		}
		if _, err := tx.ExecContext(ctx, `UPDATE delivery_fee_settings SET free_delivery_threshold = $1, updated_by = $2, updated_at = NOW() WHERE id`, next, adminID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO delivery_fee_history (scope, old_value, new_value, reason, admin_id) VALUES ('THRESHOLD', $1, $2, $3, $4)`, old, next, reason, adminID); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	_ = s.audit.Record(adminID, role, "DELIVERY_FEE_SETTINGS_UPDATE", "delivery_fee", "settings", reason,
		map[string]interface{}{"default_fee": oldFee, "free_delivery_threshold": nullableFloat(oldThreshold)},
		map[string]interface{}{"default_fee": defaultFee, "free_delivery_threshold": threshold, "cleared_threshold": clearThreshold}, "", "")
	return nil
}

// UpsertZone sets (or re-enables/disables) the fee for one city.
func (s *DeliveryFeeService) UpsertZone(ctx context.Context, adminID uuid.UUID, role models.AdminRole, cityID uuid.UUID, fee float64, active bool, reason string) error {
	if len(strings.TrimSpace(reason)) < 5 {
		return errDeliveryReason
	}
	if !validFee(fee) {
		return errors.New("fee must be between 0 and 10000")
	}
	fee = models.RoundMoney(fee)
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var exists bool
	if err := tx.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM cities WHERE id = $1)`, cityID).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return errors.New("not found: city")
	}
	var old sql.NullFloat64
	_ = tx.QueryRowContext(ctx, `SELECT fee FROM delivery_fee_zones WHERE city_id = $1 AND active`, cityID).Scan(&old)
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO delivery_fee_zones (city_id, fee, active, updated_by, updated_at) VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (city_id) DO UPDATE SET fee = EXCLUDED.fee, active = EXCLUDED.active, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
		cityID, fee, active, adminID); err != nil {
		return err
	}
	var newVal interface{} = fee
	if !active {
		newVal = nil
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO delivery_fee_history (scope, city_id, old_value, new_value, reason, admin_id) VALUES ('CITY', $1, $2, $3, $4, $5)`,
		cityID, nullableFloat(old), newVal, reason, adminID); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	_ = s.audit.Record(adminID, role, "DELIVERY_FEE_ZONE_UPDATE", "delivery_fee", cityID.String(), reason,
		map[string]interface{}{"fee": nullableFloat(old)}, map[string]interface{}{"fee": fee, "active": active}, "", "")
	return nil
}

// DeleteZone removes a city override; that city falls back to the default fee.
func (s *DeliveryFeeService) DeleteZone(ctx context.Context, adminID uuid.UUID, role models.AdminRole, cityID uuid.UUID, reason string) error {
	if len(strings.TrimSpace(reason)) < 5 {
		return errDeliveryReason
	}
	var old float64
	err := s.db.QueryRowContext(ctx, `DELETE FROM delivery_fee_zones WHERE city_id = $1 RETURNING fee`, cityID).Scan(&old)
	if err == sql.ErrNoRows {
		return errors.New("not found: delivery zone")
	}
	if err != nil {
		return err
	}
	_, _ = s.db.ExecContext(ctx, `INSERT INTO delivery_fee_history (scope, city_id, old_value, new_value, reason, admin_id) VALUES ('CITY', $1, $2, NULL, $3, $4)`, cityID, old, reason, adminID)
	_ = s.audit.Record(adminID, role, "DELIVERY_FEE_ZONE_DELETE", "delivery_fee", cityID.String(), reason, map[string]interface{}{"fee": old}, nil, "", "")
	return nil
}

func nullableFloat(v sql.NullFloat64) interface{} {
	if v.Valid {
		return v.Float64
	}
	return nil
}

// DeliveryFeeLedger is the accounting view of delivery fees over a period,
// read from the per-order snapshots — never from the current tariff.
type DeliveryFeeLedger struct {
	Currency        string              `json:"currency"`
	Orders          int                 `json:"orders"`
	FeesCharged     float64             `json:"fees_charged"`
	PointsDiscount  float64             `json:"points_discount"`
	FeesBilled      float64             `json:"fees_billed"`
	FeesCollected   float64             `json:"fees_collected"`
	FeesOutstanding float64             `json:"fees_outstanding"`
	FreeDeliveries  int                 `json:"free_deliveries"`
	ByCity          []DeliveryLedgerRow `json:"by_city"`
}

type DeliveryLedgerRow struct {
	City          string  `json:"city"`
	Orders        int     `json:"orders"`
	FeesBilled    float64 `json:"fees_billed"`
	FeesCollected float64 `json:"fees_collected"`
}

// Ledger sums delivery fees on TBK-delivered orders created in [from, to).
// Collected = the order's buyer payment is settled (PAID/VERIFIED).
func (s *DeliveryFeeService) Ledger(ctx context.Context, from, to *time.Time) (*DeliveryFeeLedger, error) {
	const base = `
		FROM orders o
		LEFT JOIN buyer_payments bp ON bp.order_id = o.id
		WHERE o.delivery_method IN ('TBK_STANDARD','TBK_DELIVERY','TBK','SHOP_DELIVERY')
		  AND o.status NOT IN ('CANCELLED','REJECTED')
		  AND ($1::timestamptz IS NULL OR o.created_at >= $1)
		  AND ($2::timestamptz IS NULL OR o.created_at < $2)`
	l := &DeliveryFeeLedger{Currency: models.CurrencyUSD, ByCity: []DeliveryLedgerRow{}}
	if err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*),
		       COALESCE(SUM(o.delivery_fee_base), 0),
		       COALESCE(SUM(o.delivery_points_discount), 0),
		       COALESCE(SUM(o.delivery_fee_final), 0),
		       COALESCE(SUM(o.delivery_fee_final) FILTER (WHERE bp.status IN ('PAID','VERIFIED')), 0),
		       COUNT(*) FILTER (WHERE o.delivery_fee_base = 0)`+base, from, to).
		Scan(&l.Orders, &l.FeesCharged, &l.PointsDiscount, &l.FeesBilled, &l.FeesCollected, &l.FreeDeliveries); err != nil {
		return nil, err
	}
	l.FeesOutstanding = models.RoundMoney(l.FeesBilled - l.FeesCollected)
	rows, err := s.db.QueryContext(ctx, `
		SELECT COALESCE(NULLIF(o.delivery_city, ''), '—'), COUNT(*),
		       COALESCE(SUM(o.delivery_fee_final), 0),
		       COALESCE(SUM(o.delivery_fee_final) FILTER (WHERE bp.status IN ('PAID','VERIFIED')), 0)`+base+`
		GROUP BY 1 ORDER BY 3 DESC LIMIT 50`, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var r DeliveryLedgerRow
		if err := rows.Scan(&r.City, &r.Orders, &r.FeesBilled, &r.FeesCollected); err != nil {
			return nil, err
		}
		l.ByCity = append(l.ByCity, r)
	}
	return l, rows.Err()
}
