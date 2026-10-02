package notify

import (
	"database/sql"
	"errors"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/google/uuid"
)

// Principal kinds: regular users (buyers, sellers, couriers, employees share
// the users table) and admins (admin_users).
const (
	KindUser  = "USER"
	KindAdmin = "ADMIN"
)

// Principal is who a notification is written for.
type Principal struct {
	Kind string
	ID   uuid.UUID
}

// PrincipalFor maps a notification recipient to its principal: admin
// notifications are addressed to admin_users ids, every other audience to users.
func PrincipalFor(userID uuid.UUID, audience string) Principal {
	if audience == audAdmin {
		return Principal{Kind: KindAdmin, ID: userID}
	}
	return Principal{Kind: KindUser, ID: userID}
}

// Preference is the effective setting of one category for one principal.
type Preference struct {
	Category        Category   `json:"category"`
	PushEnabled     bool       `json:"push_enabled"`
	InAppEnabled    bool       `json:"in_app_enabled"`
	RequiresConsent bool       `json:"requires_consent"`
	Consented       bool       `json:"consented"`
	ConsentedAt     *time.Time `json:"consented_at,omitempty"`
	Locked          bool       `json:"locked"`
}

// Frequency caps for opt-in categories (see docs/NOTIFICATIONS_AUDIT.md).
const (
	WatchlistDailyCap  = 3
	MarketingDailyCap  = 1
	MarketingWeeklyCap = 3
)

var ErrCategoryLocked = errors.New("CATEGORY_LOCKED")

// Prefs reads and writes notification preferences.
type Prefs struct {
	db *database.DB
}

func NewPrefs(db *database.DB) *Prefs { return &Prefs{db: db} }

func defaultPreference(c Category) Preference {
	return Preference{
		Category:        c,
		PushEnabled:     c.DefaultPush(),
		InAppEnabled:    !c.RequiresConsent(),
		RequiresConsent: c.RequiresConsent(),
		Locked:          c.Locked(),
	}
}

func (p *Prefs) load(pr Principal, c Category) (Preference, error) {
	pref := defaultPreference(c)
	var push, inApp bool
	var consentedAt sql.NullTime
	err := p.db.QueryRow(`SELECT push_enabled, in_app_enabled, consented_at FROM notification_preferences
		WHERE principal_kind = $1 AND principal_id = $2 AND category = $3`, pr.Kind, pr.ID, string(c)).Scan(&push, &inApp, &consentedAt)
	if err == sql.ErrNoRows {
		return pref, nil
	}
	if err != nil {
		return pref, err
	}
	return applyRow(pref, push, inApp, consentedAt), nil
}

func applyRow(pref Preference, push, inApp bool, consentedAt sql.NullTime) Preference {
	pref.PushEnabled = push
	pref.InAppEnabled = inApp
	if consentedAt.Valid {
		t := consentedAt.Time
		pref.ConsentedAt = &t
		pref.Consented = true
	}
	if pref.RequiresConsent && !pref.Consented {
		pref.PushEnabled = false
		pref.InAppEnabled = false
	}
	if pref.Locked {
		pref.PushEnabled = true
		pref.InAppEnabled = true
	}
	return pref
}

// All returns every category's effective preference for a principal.
func (p *Prefs) All(pr Principal) ([]Preference, error) {
	stored := map[Category]Preference{}
	rows, err := p.db.Query(`SELECT category, push_enabled, in_app_enabled, consented_at FROM notification_preferences
		WHERE principal_kind = $1 AND principal_id = $2`, pr.Kind, pr.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var cat string
		var push, inApp bool
		var consentedAt sql.NullTime
		if err := rows.Scan(&cat, &push, &inApp, &consentedAt); err != nil {
			return nil, err
		}
		if c, ok := ParseCategory(cat); ok {
			stored[c] = applyRow(defaultPreference(c), push, inApp, consentedAt)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out := make([]Preference, 0, len(AllCategories))
	for _, c := range AllCategories {
		if pref, ok := stored[c]; ok {
			out = append(out, pref)
		} else {
			out = append(out, defaultPreference(c))
		}
	}
	return out, nil
}

// Get returns one category's effective preference.
func (p *Prefs) Get(pr Principal, c Category) (Preference, error) { return p.load(pr, c) }

// Update changes one category. push switches push on or off; consent grants
// or withdraws the explicit opt-in that WATCHLIST and MARKETING require.
// Granting consent turns push on; withdrawing it turns everything off, so
// opting out is a single action.
func (p *Prefs) Update(pr Principal, c Category, push *bool, consent *bool, source string) (Preference, error) {
	if c.Locked() {
		return defaultPreference(c), ErrCategoryLocked
	}
	cur, err := p.load(pr, c)
	if err != nil {
		return cur, err
	}
	pushOn := cur.PushEnabled
	consented := cur.Consented
	consentedAt := cur.ConsentedAt
	if consent != nil && c.RequiresConsent() {
		if *consent && !consented {
			now := time.Now()
			consentedAt = &now
			pushOn = true
		}
		if !*consent {
			consentedAt = nil
			pushOn = false
		}
		consented = *consent
	}
	if push != nil {
		pushOn = *push
		// Push on an opt-in category is meaningless (and refused) without consent.
		if c.RequiresConsent() && !consented {
			pushOn = false
		}
	}
	inApp := !c.RequiresConsent() || consented
	if source == "" {
		source = "settings"
	}
	_, err = p.db.Exec(`INSERT INTO notification_preferences
			(principal_kind, principal_id, category, push_enabled, in_app_enabled, consented_at, consent_source, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $6::timestamptz IS NULL THEN NULL ELSE $7 END, NOW())
		ON CONFLICT (principal_kind, principal_id, category) DO UPDATE SET
			push_enabled = EXCLUDED.push_enabled,
			in_app_enabled = EXCLUDED.in_app_enabled,
			consented_at = EXCLUDED.consented_at,
			consent_source = CASE
				WHEN EXCLUDED.consented_at IS NULL THEN NULL
				WHEN notification_preferences.consented_at IS NOT NULL THEN notification_preferences.consent_source
				ELSE EXCLUDED.consent_source END,
			updated_at = NOW()`,
		pr.Kind, pr.ID, string(c), pushOn, inApp, consentedAt, source)
	if err != nil {
		return cur, err
	}
	return p.load(pr, c)
}

// CapReached reports whether a user already received as many notifications of
// an opt-in category as the frequency caps allow.
func (p *Prefs) CapReached(userID uuid.UUID, c Category) bool {
	count := func(since time.Duration) int {
		var n int
		_ = p.db.QueryRow(`SELECT COUNT(*) FROM notifications
			WHERE user_id = $1 AND metadata->>'category' = $2 AND created_at >= NOW() - make_interval(secs => $3)`,
			userID, string(c), since.Seconds()).Scan(&n)
		return n
	}
	switch c {
	case CategoryWatchlist:
		return count(24*time.Hour) >= WatchlistDailyCap
	case CategoryMarketing:
		return count(24*time.Hour) >= MarketingDailyCap || count(7*24*time.Hour) >= MarketingWeeklyCap
	}
	return false
}
