package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"

	"github.com/google/uuid"
)

type AdminTechnicalRepository interface {
	GetPostgresHealth(ctx context.Context) (*models.PostgresHealth, error)
	GetSecurityEvents(ctx context.Context, limit, offset int, severityFilter string) ([]models.SecurityEventItem, int, error)
	CreateSecurityEvent(ctx context.Context, event *models.SecurityEventItem) error
	UpdateSecurityEventStatus(ctx context.Context, id uuid.UUID, status string) error
	GetActiveAdminSessions(ctx context.Context) ([]models.AdminSessionItem, error)
	RevokeAdminSession(ctx context.Context, sessionID uuid.UUID) error
	GetAppVersions(ctx context.Context) ([]models.AppVersionItem, error)
	UpdateAppVersion(ctx context.Context, platform, currentVer, minVer, recommendedVer string, updatedBy uuid.UUID) error
	RecordHealthEvent(ctx context.Context, serviceName, status string, latencyMS int, errorMsg string) error
	GetRecentHealthEvents(ctx context.Context, limit int) ([]models.ServiceHealthItem, error)
	GetMigrationSummary(ctx context.Context) (*models.MigrationSummary, error)
}

type adminTechnicalRepository struct {
	db            *sql.DB
	migrationsDir string
}

func NewAdminTechnicalRepository(db *sql.DB, migrationsDir string) AdminTechnicalRepository {
	return &adminTechnicalRepository{db: db, migrationsDir: migrationsDir}
}

func (r *adminTechnicalRepository) GetPostgresHealth(ctx context.Context) (*models.PostgresHealth, error) {
	health := &models.PostgresHealth{
		Reachable: true,
		// No backup system is wired up yet; report that rather than inventing a status.
		LastBackupStatus: "NOT_CONFIGURED",
	}

	// Latest migration actually applied to this database.
	_ = r.db.QueryRowContext(ctx,
		`SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1`,
	).Scan(&health.MigrationVersion)

	// 1. Connection counts
	connQuery := `
		SELECT 
			count(*),
			count(*) FILTER (WHERE state = 'active') as active,
			count(*) FILTER (WHERE state = 'idle') as idle
		FROM pg_stat_activity 
		WHERE datname = current_database();
	`
	err := r.db.QueryRowContext(ctx, connQuery).Scan(
		&health.ConnectionCount,
		&health.ActiveConnections,
		&health.IdleConnections,
	)
	if err != nil {
		health.Reachable = false
		return health, nil
	}

	// 2. Database size
	sizeQuery := `SELECT pg_database_size(current_database());`
	err = r.db.QueryRowContext(ctx, sizeQuery).Scan(&health.DatabaseSizeBytes)
	if err == nil {
		health.DatabaseSizeFormatted = fmt.Sprintf("%.2f MB", float64(health.DatabaseSizeBytes)/(1024*1024))
	}

	// 3. Long-running queries (> 5 seconds)
	longQuery := `
		SELECT pid, EXTRACT(EPOCH FROM (clock_timestamp() - query_start)) as duration, query, state
		FROM pg_stat_activity
		WHERE state != 'idle' 
		  AND datname = current_database()
		  AND (clock_timestamp() - query_start) > interval '5 seconds'
		ORDER BY duration DESC
		LIMIT 10;
	`
	rows, err := r.db.QueryContext(ctx, longQuery)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var q models.LongQueryItem
			var rawQuery string
			if err := rows.Scan(&q.PID, &q.DurationSeconds, &rawQuery, &q.State); err == nil {
				// Sanitize query to avoid exposing parameters/passwords
				if len(rawQuery) > 200 {
					q.QuerySanitized = rawQuery[:200] + "..."
				} else {
					q.QuerySanitized = rawQuery
				}
				health.LongRunningQueries = append(health.LongRunningQueries, q)
			}
		}
	}
	if health.LongRunningQueries == nil {
		health.LongRunningQueries = []models.LongQueryItem{}
	}

	return health, nil
}

func (r *adminTechnicalRepository) GetSecurityEvents(ctx context.Context, limit, offset int, severityFilter string) ([]models.SecurityEventItem, int, error) {
	whereClause := "WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if severityFilter != "" {
		whereClause += fmt.Sprintf(" AND severity = $%d", argIdx)
		args = append(args, severityFilter)
		argIdx++
	}

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM security_events %s", whereClause)
	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(`
		SELECT id, event_type, severity, actor_id, target_id, ip_address, user_agent, details, status, created_at
		FROM security_events
		%s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	events := []models.SecurityEventItem{}
	for rows.Next() {
		var item models.SecurityEventItem
		var actorID, targetID sql.NullString
		var ipAddr, uAgent sql.NullString
		var detailsJSON []byte

		err := rows.Scan(
			&item.ID,
			&item.EventType,
			&item.Severity,
			&actorID,
			&targetID,
			&ipAddr,
			&uAgent,
			&detailsJSON,
			&item.Status,
			&item.CreatedAt,
		)
		if err != nil {
			return nil, 0, err
		}

		if actorID.Valid {
			u, _ := uuid.Parse(actorID.String)
			item.ActorID = &u
		}
		if targetID.Valid {
			u, _ := uuid.Parse(targetID.String)
			item.TargetID = &u
		}
		if ipAddr.Valid {
			item.IPAddress = ipAddr.String
		}
		if uAgent.Valid {
			item.UserAgent = uAgent.String
		}
		if len(detailsJSON) > 0 {
			_ = json.Unmarshal(detailsJSON, &item.Details)
		}

		events = append(events, item)
	}

	return events, total, nil
}

func (r *adminTechnicalRepository) CreateSecurityEvent(ctx context.Context, event *models.SecurityEventItem) error {
	if event.ID == uuid.Nil {
		event.ID = uuid.New()
	}
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now()
	}

	detailsJSON, _ := json.Marshal(event.Details)

	query := `
		INSERT INTO security_events (id, event_type, severity, actor_id, target_id, ip_address, user_agent, details, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err := r.db.ExecContext(ctx, query,
		event.ID,
		event.EventType,
		event.Severity,
		event.ActorID,
		event.TargetID,
		event.IPAddress,
		event.UserAgent,
		detailsJSON,
		event.Status,
		event.CreatedAt,
	)
	return err
}

func (r *adminTechnicalRepository) UpdateSecurityEventStatus(ctx context.Context, id uuid.UUID, status string) error {
	query := `UPDATE security_events SET status = $1 WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}

func (r *adminTechnicalRepository) GetActiveAdminSessions(ctx context.Context) ([]models.AdminSessionItem, error) {
	query := `
		SELECT 
			t.id as session_id,
			t.admin_id,
			u.email,
			u.role,
			COALESCE(t.user_agent, 'Unknown Device') as device_info,
			COALESCE(t.ip_address, '0.0.0.0') as ip_address,
			t.created_at,
			t.created_at as last_seen,
			t.expires_at,
			(t.revoked_at IS NOT NULL) as revoked
		FROM admin_refresh_tokens t
		JOIN admin_users u ON u.id = t.admin_id
		WHERE t.revoked_at IS NULL AND t.expires_at > NOW()
		ORDER BY t.created_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sessions := []models.AdminSessionItem{}
	for rows.Next() {
		var s models.AdminSessionItem
		err := rows.Scan(
			&s.SessionID,
			&s.AdminID,
			&s.AdminEmail,
			&s.AdminRole,
			&s.DeviceInfo,
			&s.IPAddress,
			&s.CreatedAt,
			&s.LastSeen,
			&s.ExpiresAt,
			&s.Revoked,
		)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, s)
	}
	return sessions, nil
}

func (r *adminTechnicalRepository) RevokeAdminSession(ctx context.Context, sessionID uuid.UUID) error {
	query := `UPDATE admin_refresh_tokens SET revoked_at = NOW() WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, sessionID)
	return err
}

func (r *adminTechnicalRepository) GetAppVersions(ctx context.Context) ([]models.AppVersionItem, error) {
	query := `
		SELECT id, platform, current_version, min_supported_version, recommended_version, updated_by, updated_at
		FROM app_version_configs
		ORDER BY platform ASC
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	versions := []models.AppVersionItem{}
	for rows.Next() {
		var v models.AppVersionItem
		var updatedBy sql.NullString
		err := rows.Scan(
			&v.ID,
			&v.Platform,
			&v.CurrentVersion,
			&v.MinSupportedVersion,
			&v.RecommendedVersion,
			&updatedBy,
			&v.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		if updatedBy.Valid {
			u, _ := uuid.Parse(updatedBy.String)
			v.UpdatedBy = &u
		}
		versions = append(versions, v)
	}
	return versions, nil
}

func (r *adminTechnicalRepository) UpdateAppVersion(ctx context.Context, platform, currentVer, minVer, recommendedVer string, updatedBy uuid.UUID) error {
	query := `
		INSERT INTO app_version_configs (platform, current_version, min_supported_version, recommended_version, updated_by, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (platform) DO UPDATE SET
			current_version = EXCLUDED.current_version,
			min_supported_version = EXCLUDED.min_supported_version,
			recommended_version = EXCLUDED.recommended_version,
			updated_by = EXCLUDED.updated_by,
			updated_at = NOW()
	`
	_, err := r.db.ExecContext(ctx, query, platform, currentVer, minVer, recommendedVer, updatedBy)
	return err
}

func (r *adminTechnicalRepository) RecordHealthEvent(ctx context.Context, serviceName, status string, latencyMS int, errorMsg string) error {
	query := `
		INSERT INTO system_health_events (service_name, status, latency_ms, error_message, checked_at)
		VALUES ($1, $2, $3, $4, NOW())
	`
	_, err := r.db.ExecContext(ctx, query, serviceName, status, latencyMS, errorMsg)
	return err
}

func (r *adminTechnicalRepository) GetRecentHealthEvents(ctx context.Context, limit int) ([]models.ServiceHealthItem, error) {
	query := `
		SELECT DISTINCT ON (service_name)
			service_name, status, latency_ms, checked_at, error_message
		FROM system_health_events
		ORDER BY service_name, checked_at DESC
		LIMIT $1
	`
	rows, err := r.db.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []models.ServiceHealthItem{}
	for rows.Next() {
		var item models.ServiceHealthItem
		var errorMsg sql.NullString
		err := rows.Scan(&item.ServiceName, &item.Status, &item.LatencyMS, &item.LastCheck, &errorMsg)
		if err != nil {
			return nil, err
		}
		if errorMsg.Valid {
			item.ErrorMessageSummary = errorMsg.String
		}
		// Share of this service's recorded checks that came back healthy.
		_ = r.db.QueryRowContext(ctx, `
			SELECT COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'HEALTHY') / NULLIF(COUNT(*), 0), 2), 0)
			FROM system_health_events
			WHERE service_name = $1 AND checked_at >= NOW() - INTERVAL '7 days'
		`, item.ServiceName).Scan(&item.UptimePercent)
		items = append(items, item)
	}
	return items, nil
}

func (r *adminTechnicalRepository) GetMigrationSummary(ctx context.Context) (*models.MigrationSummary, error) {
	summary := &models.MigrationSummary{AppliedMigrations: []models.MigrationItem{}}

	rows, err := r.db.QueryContext(ctx, `SELECT version, applied_at FROM schema_migrations ORDER BY version ASC`)
	if err != nil {
		return nil, fmt.Errorf("failed to query schema_migrations: %w", err)
	}
	defer rows.Close()

	appliedFiles := make(map[string]bool)
	for rows.Next() {
		var version string
		var appliedAt time.Time
		if err := rows.Scan(&version, &appliedAt); err != nil {
			return nil, fmt.Errorf("failed to scan migration row: %w", err)
		}
		appliedFiles[version] = true
		summary.AppliedMigrations = append(summary.AppliedMigrations, models.MigrationItem{
			Version:   version,
			Name:      version,
			AppliedAt: appliedAt,
			Status:    "APPLIED",
		})
		summary.AppliedCount++
		if summary.LastAppliedAt == nil || appliedAt.After(*summary.LastAppliedAt) {
			t := appliedAt
			summary.LastAppliedAt = &t
		}
		summary.CurrentVersion = version
	}

	// Pending = migration files bundled with this binary that schema_migrations
	// has no record of. RunMigrations() applies every pending file at process
	// startup, so a non-zero count here means the last startup run failed partway.
	if r.migrationsDir != "" {
		entries, err := os.ReadDir(r.migrationsDir)
		if err == nil {
			for _, entry := range entries {
				if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
					continue
				}
				if !appliedFiles[entry.Name()] {
					summary.PendingCount++
				}
			}
		}
	}

	return summary, nil
}
