package service

import (
	"context"
	"database/sql"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
)

// AuthFailureRetentionDays is how long a failed sign-in stays on record.
const AuthFailureRetentionDays = 30

type AuthFailure struct {
	ID        int64     `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	ErrorCode string    `json:"error_code"`
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`
	CreatedAt time.Time `json:"created_at"`
}

// ActiveSession is one signed-in account. A session is a refresh token that is
// neither revoked nor expired; the token is rotated on every refresh, so the
// newest one's creation time is when the account was last active.
type ActiveSession struct {
	UserID       uuid.UUID `json:"user_id"`
	Email        string    `json:"email"`
	Name         string    `json:"name"`
	Role         string    `json:"role"`
	IPAddress    string    `json:"ip_address"`
	UserAgent    string    `json:"user_agent"`
	LastActiveAt time.Time `json:"last_active_at"`
	ExpiresAt    time.Time `json:"expires_at"`
	Devices      int       `json:"devices"`
}

type MonitoringSummary struct {
	FailuresLastHour  int            `json:"failures_last_hour"`
	FailuresLast24h   int            `json:"failures_last_24h"`
	FailuresByRole24h map[string]int `json:"failures_by_role_24h"`
	ActiveAccounts    int            `json:"active_accounts"`
	OnlineNow         int            `json:"online_now"`
	ActiveByRole      map[string]int `json:"active_by_role"`
}

type MonitoringService struct {
	db *sql.DB
	// onlineWindow is how recent a token rotation must be for the account to
	// count as online right now: an open app refreshes once per access-token TTL.
	onlineWindow time.Duration
}

func NewMonitoringService(db *sql.DB, accessTokenTTLMinutes int) *MonitoringService {
	if accessTokenTTLMinutes <= 0 {
		accessTokenTTLMinutes = 15
	}
	return &MonitoringService{db: db, onlineWindow: time.Duration(accessTokenTTLMinutes*2) * time.Minute}
}

// RecordLoginFailure stores one refused sign-in. portal is "admin" for the admin
// console and "user" for every other sign-in form; for the latter the role is the
// account type of the e-mail tried, or "unknown" when no such account exists.
// It never fails the sign-in it describes: errors are only logged.
func (m *MonitoringService) RecordLoginFailure(portal, email, errorCode, ipAddress, userAgent string) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	role := "admin"
	if portal != "admin" {
		var accountType string
		err := m.db.QueryRowContext(ctx, `SELECT account_type FROM users WHERE LOWER(email)=$1`, email).Scan(&accountType)
		switch {
		case err == nil:
			role = strings.ToLower(accountType)
			if errorCode == "INVALID_CREDENTIALS" {
				errorCode = "WRONG_PASSWORD"
			}
		case err == sql.ErrNoRows:
			role = "unknown"
			if errorCode == "INVALID_CREDENTIALS" {
				errorCode = "UNKNOWN_ACCOUNT"
			}
		default:
			role = "unknown"
		}
	}
	if len(userAgent) > 500 {
		userAgent = userAgent[:500]
	}
	if _, err := m.db.ExecContext(ctx,
		`INSERT INTO auth_failures (user_email, role, error_code, ip_address, user_agent, created_at) VALUES ($1,$2,$3,$4,$5,NOW())`,
		email, role, errorCode, ipAddress, userAgent); err != nil {
		log.Printf("[monitoring] could not record login failure: %v", err)
	}
}

// ListAuthFailures returns the newest failures first, optionally for one role.
func (m *MonitoringService) ListAuthFailures(ctx context.Context, role string, limit int) ([]AuthFailure, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := m.db.QueryContext(ctx, `
		SELECT id, user_email, role, error_code, COALESCE(ip_address,''), COALESCE(user_agent,''), created_at
		FROM auth_failures
		WHERE ($1 = '' OR role = $1)
		ORDER BY created_at DESC, id DESC
		LIMIT $2`, role, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	failures := []AuthFailure{}
	for rows.Next() {
		var f AuthFailure
		if err := rows.Scan(&f.ID, &f.Email, &f.Role, &f.ErrorCode, &f.IPAddress, &f.UserAgent, &f.CreatedAt); err != nil {
			return nil, err
		}
		failures = append(failures, f)
	}
	return failures, rows.Err()
}

// ListActiveSessions returns one row per signed-in account (buyers, sellers,
// employees, couriers), most recently active first.
func (m *MonitoringService) ListActiveSessions(ctx context.Context, role string, limit int) ([]ActiveSession, error) {
	if limit <= 0 || limit > 1000 {
		limit = 300
	}
	rows, err := m.db.QueryContext(ctx, `
		SELECT u.id, u.email, TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')),
		       LOWER(u.account_type::text), COALESCE(t.ip_address,''), COALESCE(t.user_agent,''),
		       t.created_at, t.expires_at, t.devices
		FROM (
			SELECT DISTINCT ON (user_id) user_id, ip_address, user_agent, created_at, expires_at,
			       COUNT(*) OVER (PARTITION BY user_id) AS devices
			FROM refresh_tokens
			WHERE revoked_at IS NULL AND expires_at > NOW()
			ORDER BY user_id, created_at DESC
		) t
		JOIN users u ON u.id = t.user_id
		WHERE ($1 = '' OR LOWER(u.account_type::text) = $1)
		ORDER BY t.created_at DESC
		LIMIT $2`, role, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sessions := []ActiveSession{}
	for rows.Next() {
		var s ActiveSession
		if err := rows.Scan(&s.UserID, &s.Email, &s.Name, &s.Role, &s.IPAddress, &s.UserAgent, &s.LastActiveAt, &s.ExpiresAt, &s.Devices); err != nil {
			return nil, err
		}
		sessions = append(sessions, s)
	}
	return sessions, rows.Err()
}

// SignedOutAccount is an account the Direction signed out everywhere: when,
// why, and whether its owner signed in again since (nobody can sign someone
// else in; the account stays free to sign in).
type SignedOutAccount struct {
	UserID        uuid.UUID  `json:"user_id"`
	Email         string     `json:"email"`
	Name          string     `json:"name"`
	Role          string     `json:"role"`
	SignedOutAt   time.Time  `json:"signed_out_at"`
	Reason        string     `json:"reason"`
	ReconnectedAt *time.Time `json:"reconnected_at"`
	AccountStatus string     `json:"account_status"`
}

// ListSignedOutAccounts returns the Direction force-logouts of the last
// `hours`, newest first, one row per account (its latest sign-out).
func (m *MonitoringService) ListSignedOutAccounts(ctx context.Context, role string, hours, limit int) ([]SignedOutAccount, error) {
	if hours <= 0 || hours > 24*30 {
		hours = 24
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := m.db.QueryContext(ctx, `
		SELECT u.id, u.email, TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')),
		       LOWER(u.account_type::text), a.created_at, COALESCE(a.reason, ''),
		       (SELECT MAX(rt.created_at) FROM refresh_tokens rt
		         WHERE rt.user_id = u.id AND rt.created_at > a.created_at),
		       COALESCE(u.status::text, '')
		FROM (
			SELECT DISTINCT ON (target_id) target_id, created_at, reason
			FROM admin_audit_log
			WHERE action = 'USER_FORCE_LOGOUT' AND target_type = 'USER'
			  AND created_at > NOW() - make_interval(hours => $2)
			ORDER BY target_id, created_at DESC
		) a
		JOIN users u ON u.id::text = a.target_id
		WHERE ($1 = '' OR LOWER(u.account_type::text) = $1)
		ORDER BY a.created_at DESC
		LIMIT $3`, role, hours, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SignedOutAccount{}
	for rows.Next() {
		var a SignedOutAccount
		var back sql.NullTime
		if err := rows.Scan(&a.UserID, &a.Email, &a.Name, &a.Role, &a.SignedOutAt, &a.Reason, &back, &a.AccountStatus); err != nil {
			return nil, err
		}
		if back.Valid {
			t := back.Time
			a.ReconnectedAt = &t
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// Summary gives the counters shown above both tables.
func (m *MonitoringService) Summary(ctx context.Context) (*MonitoringSummary, error) {
	out := &MonitoringSummary{FailuresByRole24h: map[string]int{}, ActiveByRole: map[string]int{}}
	if err := m.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour'), COUNT(*)
		FROM auth_failures WHERE created_at > NOW() - INTERVAL '24 hours'`).
		Scan(&out.FailuresLastHour, &out.FailuresLast24h); err != nil {
		return nil, err
	}
	rows, err := m.db.QueryContext(ctx, `
		SELECT role, COUNT(*) FROM auth_failures WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY role`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var role string
		var n int
		if err := rows.Scan(&role, &n); err != nil {
			rows.Close()
			return nil, err
		}
		out.FailuresByRole24h[role] = n
	}
	rows.Close()

	rows, err = m.db.QueryContext(ctx, `
		SELECT LOWER(u.account_type::text), COUNT(*), COUNT(*) FILTER (WHERE t.last_active > NOW() - $1::interval)
		FROM (SELECT user_id, MAX(created_at) AS last_active FROM refresh_tokens
		      WHERE revoked_at IS NULL AND expires_at > NOW() GROUP BY user_id) t
		JOIN users u ON u.id = t.user_id
		GROUP BY 1`, m.onlineWindow.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var role string
		var active, online int
		if err := rows.Scan(&role, &active, &online); err != nil {
			return nil, err
		}
		out.ActiveByRole[role] = active
		out.ActiveAccounts += active
		out.OnlineNow += online
	}
	return out, rows.Err()
}

// OnlineWindow is exposed so the UI can say what "online" means.
func (m *MonitoringService) OnlineWindow() time.Duration { return m.onlineWindow }

// PurgeOldFailures deletes failures past the retention period.
func (m *MonitoringService) PurgeOldFailures(ctx context.Context) (int64, error) {
	res, err := m.db.ExecContext(ctx, `DELETE FROM auth_failures WHERE created_at < NOW() - INTERVAL '1 day' * $1`, AuthFailureRetentionDays)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// RunRetention purges old failures now and then every hour until ctx ends.
func (m *MonitoringService) RunRetention(ctx context.Context) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		if n, err := m.PurgeOldFailures(ctx); err != nil {
			log.Printf("[monitoring] retention purge failed: %v", err)
		} else if n > 0 {
			log.Printf("[monitoring] purged %d auth failures older than %d days", n, AuthFailureRetentionDays)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
