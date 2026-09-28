package service

import (
	"context"
	"database/sql"
	"time"
)

type AuthFailure struct {
	ID        int64     `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	ErrorCode string    `json:"error_code"`
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`
	CreatedAt time.Time `json:"created_at"`
}

type ActiveSession struct {
	ID             int64     `json:"id"`
	UserID         int64     `json:"user_id"`
	Email          string    `json:"email"`
	Role           string    `json:"role"`
	IPAddress      string    `json:"ip_address"`
	UserAgent      string    `json:"user_agent"`
	LoginAt        time.Time `json:"login_at"`
	LastActivityAt time.Time `json:"last_activity_at"`
	ActivityType   string    `json:"activity_type"`
	ActivityCount  int       `json:"activity_count"`
	OnlineDuration int64     `json:"online_duration_seconds"` // Computed client-side or here
}

type MonitoringService struct {
	db *sql.DB
}

func NewMonitoringService(db *sql.DB) *MonitoringService {
	return &MonitoringService{db: db}
}

// LogAuthFailure logs a failed login/signup attempt
func (m *MonitoringService) LogAuthFailure(ctx context.Context, email, role, errorCode, ipAddress, userAgent string) error {
	query := `
		INSERT INTO auth_failures (user_email, role, error_code, ip_address, user_agent, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
	`
	_, err := m.db.ExecContext(ctx, query, email, role, errorCode, ipAddress, userAgent)
	return err
}

// GetRecentAuthFailures returns the last N auth failures (for admin dashboard)
func (m *MonitoringService) GetRecentAuthFailures(ctx context.Context, limit int) ([]AuthFailure, error) {
	query := `
		SELECT id, user_email, role, error_code, ip_address, user_agent, created_at
		FROM auth_failures
		ORDER BY created_at DESC
		LIMIT $1
	`
	rows, err := m.db.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var failures []AuthFailure
	for rows.Next() {
		var f AuthFailure
		if err := rows.Scan(&f.ID, &f.Email, &f.Role, &f.ErrorCode, &f.IPAddress, &f.UserAgent, &f.CreatedAt); err != nil {
			return nil, err
		}
		failures = append(failures, f)
	}
	return failures, rows.Err()
}

// GetAuthFailuresByRole returns failures filtered by user role
func (m *MonitoringService) GetAuthFailuresByRole(ctx context.Context, role string, limit int) ([]AuthFailure, error) {
	query := `
		SELECT id, user_email, role, error_code, ip_address, user_agent, created_at
		FROM auth_failures
		WHERE role = $1
		ORDER BY created_at DESC
		LIMIT $2
	`
	rows, err := m.db.QueryContext(ctx, query, role, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var failures []AuthFailure
	for rows.Next() {
		var f AuthFailure
		if err := rows.Scan(&f.ID, &f.Email, &f.Role, &f.ErrorCode, &f.IPAddress, &f.UserAgent, &f.CreatedAt); err != nil {
			return nil, err
		}
		failures = append(failures, f)
	}
	return failures, rows.Err()
}

// CreateActiveSession creates a new active session record
func (m *MonitoringService) CreateActiveSession(ctx context.Context, userID int64, email, role, ipAddress, userAgent, sessionToken string) error {
	query := `
		INSERT INTO active_sessions (user_id, user_email, role, ip_address, user_agent, session_token, login_at, last_activity_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
	`
	_, err := m.db.ExecContext(ctx, query, userID, email, role, ipAddress, userAgent, sessionToken)
	return err
}

// GetActiveSessions returns all currently active sessions
func (m *MonitoringService) GetActiveSessions(ctx context.Context) ([]ActiveSession, error) {
	query := `
		SELECT id, user_id, user_email, role, ip_address, user_agent, login_at, last_activity_at, activity_type, activity_count
		FROM active_sessions
		ORDER BY login_at DESC
	`
	rows, err := m.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []ActiveSession
	for rows.Next() {
		var s ActiveSession
		if err := rows.Scan(&s.ID, &s.UserID, &s.Email, &s.Role, &s.IPAddress, &s.UserAgent, &s.LoginAt, &s.LastActivityAt, &s.ActivityType, &s.ActivityCount); err != nil {
			return nil, err
		}
		s.OnlineDuration = int64(time.Since(s.LoginAt).Seconds())
		sessions = append(sessions, s)
	}
	return sessions, rows.Err()
}

// GetActiveSessionsByRole returns active sessions filtered by role
func (m *MonitoringService) GetActiveSessionsByRole(ctx context.Context, role string) ([]ActiveSession, error) {
	query := `
		SELECT id, user_id, user_email, role, ip_address, user_agent, login_at, last_activity_at, activity_type, activity_count
		FROM active_sessions
		WHERE role = $1
		ORDER BY login_at DESC
	`
	rows, err := m.db.QueryContext(ctx, query, role)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []ActiveSession
	for rows.Next() {
		var s ActiveSession
		if err := rows.Scan(&s.ID, &s.UserID, &s.Email, &s.Role, &s.IPAddress, &s.UserAgent, &s.LoginAt, &s.LastActivityAt, &s.ActivityType, &s.ActivityCount); err != nil {
			return nil, err
		}
		s.OnlineDuration = int64(time.Since(s.LoginAt).Seconds())
		sessions = append(sessions, s)
	}
	return sessions, rows.Err()
}

// UpdateSessionActivity updates activity for an active session
func (m *MonitoringService) UpdateSessionActivity(ctx context.Context, userID int64, activityType string) error {
	query := `
		UPDATE active_sessions
		SET last_activity_at = NOW(), activity_type = $2, activity_count = activity_count + 1
		WHERE user_id = $1
	`
	_, err := m.db.ExecContext(ctx, query, userID, activityType)
	return err
}

// EndSession removes a session (on logout)
func (m *MonitoringService) EndSession(ctx context.Context, sessionToken string) error {
	query := `DELETE FROM active_sessions WHERE session_token = $1`
	_, err := m.db.ExecContext(ctx, query, sessionToken)
	return err
}

// CleanupExpiredSessions removes sessions older than timeout duration
func (m *MonitoringService) CleanupExpiredSessions(ctx context.Context, timeoutMinutes int) error {
	query := `DELETE FROM active_sessions WHERE last_activity_at < NOW() - INTERVAL '1 minute' * $1`
	_, err := m.db.ExecContext(ctx, query, timeoutMinutes)
	return err
}

// CleanupOldFailures removes auth failures older than retention days
func (m *MonitoringService) CleanupOldFailures(ctx context.Context, retentionDays int) error {
	query := `DELETE FROM auth_failures WHERE created_at < NOW() - INTERVAL '1 day' * $1`
	_, err := m.db.ExecContext(ctx, query, retentionDays)
	return err
}
