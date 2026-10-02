package push

import (
	"database/sql"
	"errors"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/notify"
	"github.com/google/uuid"
)

// Platforms.
const (
	PlatformWeb  = "WEB"
	PlatformExpo = "EXPO"
)

var (
	ErrInvalidEndpoint  = errors.New("INVALID_PUSH_ENDPOINT")
	ErrInvalidKeys      = errors.New("INVALID_PUSH_KEYS")
	ErrInvalidExpoToken = errors.New("INVALID_EXPO_TOKEN")
	ErrNotFound         = errors.New("SUBSCRIPTION_NOT_FOUND")
)

// defaultPushHosts are the browser push services. The server POSTs to a
// subscription's endpoint, so endpoints are limited to these hosts: an
// arbitrary URL would let anyone make the server call internal addresses.
var defaultPushHosts = []string{
	"fcm.googleapis.com",                 // Chrome, Edge (Chromium), Opera, Samsung Internet
	"updates.push.services.mozilla.com",  // Firefox
	"push.services.mozilla.com",
	".push.apple.com",                    // Safari (web.push.apple.com)
	".notify.windows.com",                // legacy Edge / WNS
	"push.api.chromecast.com",
}

var expoTokenRe = regexp.MustCompile(`^Expo(nent)?PushToken\[[A-Za-z0-9_\-]{10,}\]$`)

// Subscription is one device as shown to its owner.
type Subscription struct {
	ID            uuid.UUID  `json:"id"`
	Platform      string     `json:"platform"`
	DeviceLabel   string     `json:"device_label"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	LastSuccessAt *time.Time `json:"last_success_at,omitempty"`
	FailureCount  int        `json:"failure_count"`
}

// Store keeps the devices that can receive push.
type Store struct {
	db           *database.DB
	allowedHosts []string
}

func NewStore(db *database.DB, extraHosts []string) *Store {
	hosts := append([]string{}, defaultPushHosts...)
	for _, h := range extraHosts {
		if h = strings.TrimSpace(strings.ToLower(h)); h != "" {
			hosts = append(hosts, h)
		}
	}
	return &Store{db: db, allowedHosts: hosts}
}

// ValidEndpoint reports whether a browser endpoint may be stored.
func (s *Store) ValidEndpoint(endpoint string) bool {
	u, err := url.Parse(endpoint)
	if err != nil || u.Host == "" || u.User != nil || len(endpoint) > 1024 {
		return false
	}
	host := strings.ToLower(u.Hostname())
	for _, h := range s.allowedHosts {
		// Plain-http entries are only accepted when configured explicitly
		// (local tests); real push services are always https.
		if strings.HasPrefix(h, "http://") {
			if u.Scheme == "http" && u.Host == strings.TrimPrefix(h, "http://") {
				return true
			}
			continue
		}
		if u.Scheme != "https" {
			continue
		}
		if host == h || (strings.HasPrefix(h, ".") && strings.HasSuffix(host, h)) {
			return true
		}
	}
	return false
}

func label(s string, max int) string {
	s = strings.TrimSpace(s)
	if len(s) > max {
		s = s[:max]
	}
	return s
}

// RegisterWeb stores (or moves to this principal) a browser subscription.
func (s *Store) RegisterWeb(pr notify.Principal, endpoint, p256dh, auth, keyID, device, userAgent string) (uuid.UUID, error) {
	if !s.ValidEndpoint(endpoint) {
		return uuid.Nil, ErrInvalidEndpoint
	}
	pub, err1 := decodeB64(p256dh)
	sec, err2 := decodeB64(auth)
	if err1 != nil || err2 != nil || len(pub) != 65 || pub[0] != 4 || len(sec) != 16 {
		return uuid.Nil, ErrInvalidKeys
	}
	var id uuid.UUID
	err := s.db.QueryRow(`INSERT INTO push_subscriptions
			(principal_kind, principal_id, platform, endpoint, p256dh, auth_secret, vapid_key_id, device_label, user_agent)
		VALUES ($1, $2, 'WEB', $3, $4, $5, $6, $7, $8)
		ON CONFLICT (endpoint) WHERE endpoint IS NOT NULL DO UPDATE SET
			principal_kind = EXCLUDED.principal_kind, principal_id = EXCLUDED.principal_id,
			p256dh = EXCLUDED.p256dh, auth_secret = EXCLUDED.auth_secret, vapid_key_id = EXCLUDED.vapid_key_id,
			device_label = EXCLUDED.device_label, user_agent = EXCLUDED.user_agent,
			updated_at = NOW(), failure_count = 0, revoked_at = NULL, revoked_reason = NULL
		RETURNING id`,
		pr.Kind, pr.ID, endpoint, p256dh, auth, keyID, label(device, 160), label(userAgent, 400)).Scan(&id)
	if err != nil {
		return uuid.Nil, err
	}
	s.dropForeignPending(id, pr)
	return id, nil
}

// RegisterExpo stores (or moves to this principal) a mobile device token.
func (s *Store) RegisterExpo(pr notify.Principal, token, device, userAgent string) (uuid.UUID, error) {
	token = strings.TrimSpace(token)
	if !expoTokenRe.MatchString(token) {
		return uuid.Nil, ErrInvalidExpoToken
	}
	var id uuid.UUID
	err := s.db.QueryRow(`INSERT INTO push_subscriptions
			(principal_kind, principal_id, platform, expo_token, device_label, user_agent)
		VALUES ($1, $2, 'EXPO', $3, $4, $5)
		ON CONFLICT (expo_token) WHERE expo_token IS NOT NULL DO UPDATE SET
			principal_kind = EXCLUDED.principal_kind, principal_id = EXCLUDED.principal_id,
			device_label = EXCLUDED.device_label, user_agent = EXCLUDED.user_agent,
			updated_at = NOW(), failure_count = 0, revoked_at = NULL, revoked_reason = NULL
		RETURNING id`,
		pr.Kind, pr.ID, token, label(device, 160), label(userAgent, 400)).Scan(&id)
	if err != nil {
		return uuid.Nil, err
	}
	s.dropForeignPending(id, pr)
	return id, nil
}

// dropForeignPending cancels pushes still queued for a device's previous
// owner: once someone else signs in there, those must never be shown.
func (s *Store) dropForeignPending(subID uuid.UUID, pr notify.Principal) {
	_, _ = s.db.Exec(`UPDATE push_deliveries d SET status = 'SKIPPED', last_error = 'device changed owner'
		FROM notifications n
		WHERE d.subscription_id = $1 AND d.status = 'PENDING' AND n.id = d.notification_id AND n.user_id <> $2`, subID, pr.ID)
}

// Unregister removes a device by its endpoint or token. Knowing that secret
// value proves the caller holds the device, so no session is required: a
// signed-out browser can still stop receiving the previous user's alerts.
func (s *Store) Unregister(endpointOrToken string) error {
	v := strings.TrimSpace(endpointOrToken)
	if v == "" {
		return ErrNotFound
	}
	res, err := s.db.Exec(`UPDATE push_subscriptions SET revoked_at = NOW(), revoked_reason = 'UNREGISTERED', updated_at = NOW()
		WHERE (endpoint = $1 OR expo_token = $1) AND (revoked_at IS NULL OR revoked_at > NOW())`, v)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// List returns a principal's active devices.
func (s *Store) List(pr notify.Principal) ([]Subscription, error) {
	rows, err := s.db.Query(`SELECT id, platform, device_label, created_at, updated_at, last_success_at, failure_count
		FROM push_subscriptions
		WHERE principal_kind = $1 AND principal_id = $2 AND (revoked_at IS NULL OR revoked_at > NOW())
		ORDER BY updated_at DESC`, pr.Kind, pr.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Subscription{}
	for rows.Next() {
		var sub Subscription
		var last sql.NullTime
		if err := rows.Scan(&sub.ID, &sub.Platform, &sub.DeviceLabel, &sub.CreatedAt, &sub.UpdatedAt, &last, &sub.FailureCount); err != nil {
			return nil, err
		}
		if last.Valid {
			t := last.Time
			sub.LastSuccessAt = &t
		}
		out = append(out, sub)
	}
	return out, rows.Err()
}

// Revoke removes one of the principal's own devices.
func (s *Store) Revoke(pr notify.Principal, id uuid.UUID) error {
	res, err := s.db.Exec(`UPDATE push_subscriptions SET revoked_at = NOW(), revoked_reason = 'REMOVED_BY_OWNER', updated_at = NOW()
		WHERE id = $1 AND principal_kind = $2 AND principal_id = $3 AND (revoked_at IS NULL OR revoked_at > NOW())`, id, pr.Kind, pr.ID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// RevokeAll stops every device of a principal after grace (time left for an
// alert already queued, such as "your password was changed", to arrive).
func (s *Store) RevokeAll(pr notify.Principal, grace time.Duration, reason string) {
	_, _ = s.db.Exec(`UPDATE push_subscriptions
		SET revoked_at = NOW() + make_interval(secs => $3), revoked_reason = $4, updated_at = NOW()
		WHERE principal_kind = $1 AND principal_id = $2 AND revoked_at IS NULL`, pr.Kind, pr.ID, grace.Seconds(), reason)
}

func (s *Store) markGone(id uuid.UUID, reason string) {
	_, _ = s.db.Exec(`UPDATE push_subscriptions SET revoked_at = NOW(), revoked_reason = $2, updated_at = NOW()
		WHERE id = $1 AND (revoked_at IS NULL OR revoked_at > NOW())`, id, label(reason, 64))
	_, _ = s.db.Exec(`UPDATE push_deliveries SET status = 'SKIPPED', last_error = 'device gone'
		WHERE subscription_id = $1 AND status = 'PENDING'`, id)
}
