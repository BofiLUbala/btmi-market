// Package push delivers notifications to devices: browsers through Web Push
// (VAPID) and the Android app through Expo's push service. Every notification
// is first stored in the in-app list; push is an extra channel that may fail
// or be refused without losing anything.
package push

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/notify"
	"github.com/google/uuid"
)

// Config comes from the environment (see config.Config).
type Config struct {
	Enabled         bool
	WebEnabled      bool
	ExpoEnabled     bool
	VAPIDPrivateKey string
	VAPIDSubject    string
	ExpoURL         string
	ExpoAccessToken string
	// ExtraHosts adds push service hosts allowed as browser endpoints.
	ExtraHosts []string
}

// Dispatcher queues and sends pushes.
type Dispatcher struct {
	db      *database.DB
	store   *Store
	web     *WebSender
	expo    *ExpoSender
	cfg     Config
	webOK   bool
	expoOK  bool
	nowFunc func() time.Time
}

const (
	batchSize   = 50
	maxAttempts = 6
	sendWorkers = 8
)

// backoff between attempts: 30 s, 2 min, 10 min, 30 min, 2 h.
var backoff = []time.Duration{30 * time.Second, 2 * time.Minute, 10 * time.Minute, 30 * time.Minute, 2 * time.Hour}

// New builds the dispatcher. When no VAPID key is configured one is generated
// once and kept in the database, so web push works without setup and every
// API instance signs with the same key.
func New(db *database.DB, cfg Config) (*Dispatcher, error) {
	d := &Dispatcher{
		db:      db,
		store:   NewStore(db, cfg.ExtraHosts),
		cfg:     cfg,
		expo:    &ExpoSender{BaseURL: cfg.ExpoURL, AccessToken: cfg.ExpoAccessToken},
		nowFunc: time.Now,
	}
	d.expoOK = cfg.Enabled && cfg.ExpoEnabled
	if cfg.Enabled && cfg.WebEnabled {
		vapid, err := loadVAPID(db, cfg.VAPIDPrivateKey, cfg.VAPIDSubject)
		if err != nil {
			return d, fmt.Errorf("web push disabled: %w", err)
		}
		d.web = &WebSender{VAPID: vapid}
		d.webOK = true
	}
	return d, nil
}

func loadVAPID(db *database.DB, configured, subject string) (*VAPID, error) {
	if strings.TrimSpace(configured) != "" {
		return NewVAPID(strings.TrimSpace(configured), subject)
	}
	var stored string
	err := db.QueryRow(`SELECT value FROM push_settings WHERE key = 'vapid_private_key'`).Scan(&stored)
	if err == sql.ErrNoRows {
		generated, genErr := GenerateVAPID()
		if genErr != nil {
			return nil, genErr
		}
		if _, err := db.Exec(`INSERT INTO push_settings (key, value) VALUES ('vapid_private_key', $1) ON CONFLICT (key) DO NOTHING`, generated); err != nil {
			return nil, err
		}
		err = db.QueryRow(`SELECT value FROM push_settings WHERE key = 'vapid_private_key'`).Scan(&stored)
	}
	if err != nil {
		return nil, err
	}
	return NewVAPID(stored, subject)
}

// Store exposes device registration.
func (d *Dispatcher) Store() *Store { return d.store }

// PublicConfig is what clients need to subscribe.
type PublicConfig struct {
	WebEnabled     bool   `json:"web_enabled"`
	ExpoEnabled    bool   `json:"expo_enabled"`
	VAPIDPublicKey string `json:"vapid_public_key,omitempty"`
}

func (d *Dispatcher) PublicConfig() PublicConfig {
	pc := PublicConfig{WebEnabled: d.webOK, ExpoEnabled: d.expoOK}
	if d.webOK {
		pc.VAPIDPublicKey = d.web.VAPID.PublicKey
	}
	return pc
}

// VAPIDKeyID identifies the current web key (stored with subscriptions).
func (d *Dispatcher) VAPIDKeyID() string {
	if !d.webOK {
		return ""
	}
	return d.web.VAPID.KeyID
}

// coalesceKey groups pushes that replace each other while still queued: all
// status updates of one order for one audience, all messages of one order.
func coalesceKey(n *models.Notification, audience string) string {
	key := fmt.Sprintf("%s:%s:%s", n.ReferenceType, n.ReferenceID, audience)
	if n.Type == models.NotificationTypeNewMessage {
		key += ":msg"
	}
	return key
}

func lifetime(c notify.Category) time.Duration {
	switch c {
	case notify.CategorySecurity:
		return 72 * time.Hour
	case notify.CategoryWatchlist, notify.CategoryMarketing:
		return 12 * time.Hour
	}
	return 24 * time.Hour
}

// Enqueue queues n for every active device of its recipient. Called from the
// notification observer, right after the in-app row is written.
func (d *Dispatcher) Enqueue(n *models.Notification, to notify.Principal, spec notify.Spec, _ notify.Links) {
	if d == nil || !d.cfg.Enabled || (!d.webOK && !d.expoOK) {
		return
	}
	if !d.principalActive(to) {
		return
	}
	audience, _ := n.Metadata[notify.MetaAudience].(string)
	// A short delay lets a burst (status change + message, two scans) collapse
	// into the latest alert before anything is sent.
	delay := 5 * time.Second
	if spec.Priority == notify.PriorityHigh {
		delay = 2 * time.Second
	}
	_, err := d.db.Exec(`INSERT INTO push_deliveries (notification_id, subscription_id, coalesce_key, priority, next_attempt_at, expires_at)
		SELECT $1, s.id, $2, $3, NOW() + make_interval(secs => $4), NOW() + make_interval(secs => $5)
		FROM push_subscriptions s
		WHERE s.principal_kind = $6 AND s.principal_id = $7
		  AND (s.revoked_at IS NULL OR s.revoked_at > NOW())
		  AND ((s.platform = 'WEB' AND $8 AND (s.vapid_key_id IS NULL OR s.vapid_key_id = $9))
		    OR (s.platform = 'EXPO' AND $10))
		ON CONFLICT (notification_id, subscription_id) DO NOTHING`,
		n.ID, coalesceKey(n, audience), string(spec.Priority), delay.Seconds(), lifetime(spec.Category).Seconds(),
		to.Kind, to.ID, d.webOK, d.VAPIDKeyID(), d.expoOK)
	if err != nil {
		log.Printf("push: enqueue %s: %v", n.ID, err)
	}
}

func (d *Dispatcher) principalActive(p notify.Principal) bool {
	table := "users"
	if p.Kind == notify.KindAdmin {
		table = "admin_users"
	}
	var active bool
	err := d.db.QueryRow(`SELECT status = 'ACTIVE' FROM `+table+` WHERE id = $1`, p.ID).Scan(&active)
	return err == nil && active
}

// Run sends due pushes until ctx ends.
func (d *Dispatcher) Run(ctx context.Context) {
	if !d.cfg.Enabled {
		return
	}
	tick := time.NewTicker(time.Second)
	defer tick.Stop()
	lastReceipts, lastCleanup := time.Now(), time.Now()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
		for d.ProcessDue(ctx) == batchSize {
		}
		if time.Since(lastReceipts) > 10*time.Minute {
			d.checkReceipts(ctx)
			lastReceipts = time.Now()
		}
		if time.Since(lastCleanup) > time.Hour {
			d.cleanup()
			lastCleanup = time.Now()
		}
	}
}

// ProcessDue claims and sends one batch of due pushes; it returns how many
// were claimed.
func (d *Dispatcher) ProcessDue(ctx context.Context) int {
	// Rows stuck in SENDING (process killed mid-send) go back to the queue.
	_, _ = d.db.Exec(`UPDATE push_deliveries SET status = 'PENDING'
		WHERE status = 'SENDING' AND next_attempt_at < NOW() - INTERVAL '5 minutes'`)

	rows, err := d.db.Query(`WITH due AS (
			SELECT id FROM push_deliveries
			WHERE status = 'PENDING' AND next_attempt_at <= NOW()
			ORDER BY next_attempt_at LIMIT $1
			FOR UPDATE SKIP LOCKED)
		UPDATE push_deliveries d SET status = 'SENDING', attempts = d.attempts + 1
		FROM due WHERE d.id = due.id RETURNING d.id`, batchSize)
	if err != nil {
		log.Printf("push: claim: %v", err)
		return 0
	}
	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	rows.Close()

	sem := make(chan struct{}, sendWorkers)
	var wg sync.WaitGroup
	for _, id := range ids {
		wg.Add(1)
		sem <- struct{}{}
		go func(id uuid.UUID) {
			defer wg.Done()
			defer func() { <-sem }()
			d.deliver(ctx, id)
		}(id)
	}
	wg.Wait()
	return len(ids)
}

type job struct {
	id          uuid.UUID
	coalesceKey string
	priority    string
	attempts    int
	expiresAt   time.Time
	createdAt   time.Time

	subID       uuid.UUID
	platform    string
	kind        string
	principalID uuid.UUID
	endpoint    sql.NullString
	p256dh      sql.NullString
	auth        sql.NullString
	expoToken   sql.NullString
	revoked     bool

	notifID   uuid.NullUUID
	userID    uuid.NullUUID
	nType     sql.NullString
	title     sql.NullString
	body      sql.NullString
	refType   sql.NullString
	refID     uuid.NullUUID
	meta      []byte
	read      bool
	deleted   bool
	notifTime sql.NullTime
}

func (d *Dispatcher) load(id uuid.UUID) (*job, error) {
	j := &job{id: id}
	err := d.db.QueryRow(`SELECT d.coalesce_key, d.priority, d.attempts, d.expires_at, d.created_at,
			s.id, s.platform, s.principal_kind, s.principal_id, s.endpoint, s.p256dh, s.auth_secret, s.expo_token,
			(s.revoked_at IS NOT NULL AND s.revoked_at <= NOW()),
			n.id, n.user_id, n.type, n.title, n.body, n.reference_type, n.reference_id, n.metadata,
			COALESCE(n.read_at IS NOT NULL, FALSE), COALESCE(n.deleted_at IS NOT NULL, FALSE), n.created_at
		FROM push_deliveries d
		JOIN push_subscriptions s ON s.id = d.subscription_id
		LEFT JOIN notifications n ON n.id = d.notification_id
		WHERE d.id = $1`, id).Scan(
		&j.coalesceKey, &j.priority, &j.attempts, &j.expiresAt, &j.createdAt,
		&j.subID, &j.platform, &j.kind, &j.principalID, &j.endpoint, &j.p256dh, &j.auth, &j.expoToken, &j.revoked,
		&j.notifID, &j.userID, &j.nType, &j.title, &j.body, &j.refType, &j.refID, &j.meta,
		&j.read, &j.deleted, &j.notifTime)
	return j, err
}

func (d *Dispatcher) finish(id uuid.UUID, status, errMsg string) {
	_, _ = d.db.Exec(`UPDATE push_deliveries SET status = $2, last_error = NULLIF($3, '') WHERE id = $1`, id, status, truncate(errMsg, 500))
}

// skipReason is why a queued push must not be sent any more ("" = send it).
func (d *Dispatcher) skipReason(j *job) (status, reason string) {
	switch {
	case !j.notifID.Valid || j.deleted:
		return "SKIPPED", "notification deleted"
	case j.revoked:
		return "SKIPPED", "device revoked"
	case !j.userID.Valid || j.userID.UUID != j.principalID:
		// The device now belongs to someone else (or never matched): never
		// show another person's notification.
		return "SKIPPED", "recipient mismatch"
	case j.read:
		return "SKIPPED", "already read"
	case d.nowFunc().After(j.expiresAt):
		return "EXPIRED", "expired before delivery"
	}
	audience := audienceOf(j.meta)
	if (audience == "ADMIN") != (j.kind == notify.KindAdmin) {
		return "SKIPPED", "recipient mismatch"
	}
	if j.coalesceKey != "" {
		var newer bool
		_ = d.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM push_deliveries
			WHERE subscription_id = $1 AND coalesce_key = $2 AND id <> $3
			  AND status IN ('PENDING', 'SENDING') AND created_at > $4)`, j.subID, j.coalesceKey, j.id, j.createdAt).Scan(&newer)
		if newer {
			return "SUPERSEDED", "replaced by a newer alert"
		}
	}
	return "", ""
}

func audienceOf(meta []byte) string {
	var m map[string]interface{}
	_ = json.Unmarshal(meta, &m)
	a, _ := m[notify.MetaAudience].(string)
	return a
}

// Payload is what a device receives. It carries nothing the recipient could
// not already read in the app, and the body of sensitive notifications
// (private messages) is replaced by a neutral sentence.
type Payload struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Title    string `json:"title"`
	Body     string `json:"body"`
	Link     string `json:"link"`
	AppLink  string `json:"app_link"`
	Audience string `json:"audience"`
	Category string `json:"category"`
	Priority string `json:"priority"`
	Tag      string `json:"tag"`
	// UID is the recipient: a client signed in as someone else asks to sign
	// in again instead of opening the screen.
	UID  string `json:"uid"`
	Kind string `json:"kind"`
	TS   int64  `json:"ts"`
}

// SensitiveBody replaces the content of private notifications on lock screens.
const SensitiveBody = "Ouvrez TBK pour lire ce message."

func buildPayload(j *job) Payload {
	var meta map[string]interface{}
	_ = json.Unmarshal(j.meta, &meta)
	str := func(k string) string { s, _ := meta[k].(string); return s }
	audience := str(notify.MetaAudience)
	p := Payload{
		ID:       j.notifID.UUID.String(),
		Type:     j.nType.String,
		Title:    j.title.String,
		Body:     j.body.String,
		Link:     notify.SafeInternalPath(str(notify.MetaLink)),
		AppLink:  notify.SafeInternalPath(str(notify.MetaAppLink)),
		Audience: audience,
		Category: str(notify.MetaCategory),
		Priority: j.priority,
		Tag:      topicFor(j.coalesceKey),
		UID:      j.principalID.String(),
		Kind:     j.kind,
	}
	if j.notifTime.Valid {
		p.TS = j.notifTime.Time.UnixMilli()
	}
	if notify.SpecFor(models.NotificationType(p.Type), audience).Sensitive {
		p.Body = SensitiveBody
	}
	return p
}

func (d *Dispatcher) deliver(ctx context.Context, id uuid.UUID) {
	j, err := d.load(id)
	if err != nil {
		d.finish(id, "FAILED", "load: "+err.Error())
		return
	}
	if status, reason := d.skipReason(j); status != "" {
		d.finish(id, status, reason)
		return
	}
	payload := buildPayload(j)
	ttl := time.Until(j.expiresAt)

	var res Result
	switch j.platform {
	case PlatformWeb:
		if !d.webOK {
			d.finish(id, "SKIPPED", "web push disabled")
			return
		}
		raw, _ := json.Marshal(payload)
		urgency := "normal"
		if j.priority == string(notify.PriorityHigh) {
			urgency = "high"
		}
		res = d.web.Send(ctx, WebSubscription{Endpoint: j.endpoint.String, P256dh: j.p256dh.String, Auth: j.auth.String}, raw,
			WebOptions{TTL: ttl, Urgency: urgency, Topic: payload.Tag})
	case PlatformExpo:
		if !d.expoOK {
			d.finish(id, "SKIPPED", "mobile push disabled")
			return
		}
		data := map[string]interface{}{}
		raw, _ := json.Marshal(payload)
		_ = json.Unmarshal(raw, &data)
		priority := "default"
		if j.priority == string(notify.PriorityHigh) {
			priority = "high"
		}
		res = d.expo.Send(ctx, ExpoMessage{
			To: j.expoToken.String, Title: payload.Title, Body: payload.Body, Data: data,
			Priority: priority, ChannelID: strings.ToLower(payload.Category), Sound: "default",
			TTL: int(ttl.Seconds()), CollapseID: payload.Tag,
		})
	default:
		d.finish(id, "FAILED", "unknown platform")
		return
	}
	d.record(j, res)
}

func (d *Dispatcher) record(j *job, res Result) {
	switch {
	case res.Err == nil:
		_, _ = d.db.Exec(`UPDATE push_deliveries SET status = 'SENT', sent_at = NOW(), ticket_id = NULLIF($2, ''), last_error = NULL WHERE id = $1`, j.id, res.Ticket)
		_, _ = d.db.Exec(`UPDATE push_subscriptions SET last_success_at = NOW(), failure_count = 0 WHERE id = $1`, j.subID)
	case res.Gone:
		d.finish(j.id, "FAILED", res.Err.Error())
		d.store.markGone(j.subID, "GONE")
		log.Printf("push: device %s removed: %v", j.subID, res.Err)
	case res.Retry && j.attempts < maxAttempts:
		wait := backoff[min(j.attempts-1, len(backoff)-1)]
		if res.RetryAfter > wait {
			wait = res.RetryAfter
		}
		_, _ = d.db.Exec(`UPDATE push_deliveries SET status = 'PENDING', next_attempt_at = NOW() + make_interval(secs => $2), last_error = $3 WHERE id = $1`,
			j.id, wait.Seconds(), truncate(res.Err.Error(), 500))
		_, _ = d.db.Exec(`UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE id = $1`, j.subID)
	default:
		d.finish(j.id, "FAILED", res.Err.Error())
		_, _ = d.db.Exec(`UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE id = $1`, j.subID)
	}
}

// checkReceipts asks Expo what became of messages sent a while ago, so a
// phone that uninstalled the app stops being targeted.
func (d *Dispatcher) checkReceipts(ctx context.Context) {
	if !d.expoOK {
		return
	}
	rows, err := d.db.Query(`SELECT id, ticket_id, subscription_id FROM push_deliveries
		WHERE ticket_id IS NOT NULL AND receipt_checked_at IS NULL AND sent_at < NOW() - INTERVAL '15 minutes'
		ORDER BY sent_at LIMIT 300`)
	if err != nil {
		return
	}
	type ref struct{ id, sub uuid.UUID }
	byTicket := map[string]ref{}
	var ids []string
	for rows.Next() {
		var r ref
		var ticket string
		if rows.Scan(&r.id, &ticket, &r.sub) == nil {
			byTicket[ticket] = r
			ids = append(ids, ticket)
		}
	}
	rows.Close()
	if len(ids) == 0 {
		return
	}
	receipts, err := d.expo.Receipts(ctx, ids)
	if err != nil {
		log.Printf("push: expo receipts: %v", err)
		return
	}
	for ticket, errName := range receipts {
		r := byTicket[ticket]
		if errName == "" {
			_, _ = d.db.Exec(`UPDATE push_deliveries SET receipt_checked_at = NOW() WHERE id = $1`, r.id)
			continue
		}
		_, _ = d.db.Exec(`UPDATE push_deliveries SET receipt_checked_at = NOW(), status = 'FAILED', last_error = $2 WHERE id = $1`, r.id, "receipt: "+errName)
		if errName == "DeviceNotRegistered" {
			d.store.markGone(r.sub, "DEVICE_NOT_REGISTERED")
		}
	}
	// Receipts Expo no longer knows about are not worth asking again.
	_, _ = d.db.Exec(`UPDATE push_deliveries SET receipt_checked_at = NOW()
		WHERE ticket_id IS NOT NULL AND receipt_checked_at IS NULL AND sent_at < NOW() - INTERVAL '24 hours'`)
}

func (d *Dispatcher) cleanup() {
	_, _ = d.db.Exec(`DELETE FROM push_deliveries WHERE created_at < NOW() - INTERVAL '30 days'`)
	_, _ = d.db.Exec(`DELETE FROM push_subscriptions WHERE revoked_at < NOW() - INTERVAL '90 days'`)
}

// Stats summarises the last 24 hours of deliveries for the technical console.
type Stats struct {
	ByStatus      map[string]int `json:"by_status"`
	ActiveDevices map[string]int `json:"active_devices"`
	LastErrors    []string       `json:"last_errors"`
}

func (d *Dispatcher) Stats() (*Stats, error) {
	st := &Stats{ByStatus: map[string]int{}, ActiveDevices: map[string]int{}, LastErrors: []string{}}
	rows, err := d.db.Query(`SELECT status, COUNT(*) FROM push_deliveries WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY status`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var s string
		var n int
		if rows.Scan(&s, &n) == nil {
			st.ByStatus[s] = n
		}
	}
	rows.Close()
	rows, err = d.db.Query(`SELECT platform, COUNT(*) FROM push_subscriptions WHERE revoked_at IS NULL OR revoked_at > NOW() GROUP BY platform`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var s string
		var n int
		if rows.Scan(&s, &n) == nil {
			st.ActiveDevices[s] = n
		}
	}
	rows.Close()
	rows, err = d.db.Query(`SELECT last_error FROM push_deliveries WHERE status = 'FAILED' AND last_error IS NOT NULL
		AND created_at > NOW() - INTERVAL '24 hours' ORDER BY created_at DESC LIMIT 10`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var s string
		if rows.Scan(&s) == nil {
			st.LastErrors = append(st.LastErrors, s)
		}
	}
	return st, nil
}
