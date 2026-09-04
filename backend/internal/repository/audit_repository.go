package repository

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
)

type AuditRepository struct {
	db *database.DB
}

func NewAuditRepository(db *database.DB) *AuditRepository {
	return &AuditRepository{db: db}
}

func (r *AuditRepository) Record(entry *models.AdminAuditLog) error {
	query := `
		INSERT INTO admin_audit_log (
			actor_admin_id, actor_role, action, target_type, target_id,
			reason, old_value, new_value, ip_address, user_agent, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at
	`
	now := time.Now()
	return r.db.QueryRow(
		query,
		entry.ActorAdminID,
		entry.ActorRole,
		entry.Action,
		entry.TargetType,
		entry.TargetID,
		entry.Reason,
		entry.OldValue,
		entry.NewValue,
		entry.IPAddress,
		entry.UserAgent,
		now,
	).Scan(&entry.ID, &entry.CreatedAt)
}

func (r *AuditRepository) List(filter *models.AuditListFilter) ([]*models.AdminAuditLog, int, error) {
	conditions := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if filter.ActorAdminID != nil {
		conditions = append(conditions, fmt.Sprintf("l.actor_admin_id = $%d", argIdx))
		args = append(args, *filter.ActorAdminID)
		argIdx++
	}
	if filter.ActorRole != nil && *filter.ActorRole != "" {
		conditions = append(conditions, fmt.Sprintf("l.actor_role = $%d", argIdx))
		args = append(args, *filter.ActorRole)
		argIdx++
	}
	if filter.Action != nil && *filter.Action != "" {
		conditions = append(conditions, fmt.Sprintf("l.action = $%d", argIdx))
		args = append(args, *filter.Action)
		argIdx++
	}
	if filter.TargetType != nil && *filter.TargetType != "" {
		conditions = append(conditions, fmt.Sprintf("l.target_type = $%d", argIdx))
		args = append(args, *filter.TargetType)
		argIdx++
	}
	if filter.TargetID != nil && *filter.TargetID != "" {
		conditions = append(conditions, fmt.Sprintf("l.target_id = $%d", argIdx))
		args = append(args, *filter.TargetID)
		argIdx++
	}

	whereClause := strings.Join(conditions, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM admin_audit_log l WHERE %s", whereClause)
	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count audit logs: %w", err)
	}

	limit := filter.Limit
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}

	dataQuery := fmt.Sprintf(`
		SELECT 
			l.id, l.actor_admin_id, u.first_name || ' ' || u.last_name AS actor_name, u.email AS actor_email,
			l.actor_role, l.action, l.target_type, l.target_id,
			l.reason, l.old_value, l.new_value, l.ip_address, l.user_agent, l.created_at
		FROM admin_audit_log l
		LEFT JOIN admin_users u ON l.actor_admin_id = u.id
		WHERE %s
		ORDER BY l.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := r.db.Query(dataQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query audit logs: %w", err)
	}
	defer rows.Close()

	var logs []*models.AdminAuditLog
	for rows.Next() {
		entry := &models.AdminAuditLog{}
		var actorName sql.NullString
		var actorEmail sql.NullString

		err := rows.Scan(
			&entry.ID,
			&entry.ActorAdminID,
			&actorName,
			&actorEmail,
			&entry.ActorRole,
			&entry.Action,
			&entry.TargetType,
			&entry.TargetID,
			&entry.Reason,
			&entry.OldValue,
			&entry.NewValue,
			&entry.IPAddress,
			&entry.UserAgent,
			&entry.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan audit log row: %w", err)
		}

		if actorName.Valid {
			entry.ActorAdminName = actorName.String
		}
		if actorEmail.Valid {
			entry.ActorAdminEmail = actorEmail.String
		}

		logs = append(logs, entry)
	}

	return logs, total, nil
}
