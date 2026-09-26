package service

import (
	"context"
	"database/sql"
	"encoding/csv"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// exportQueries is the column list each dataset is exported with. Every column
// is chosen explicitly so a credential (password_hash, tokens) can never leak
// into a file an admin downloads.
var exportQueries = map[string]string{
	"USERS":          `SELECT id, first_name, last_name, email, phone, account_type, status, email_verified, created_at FROM users ORDER BY created_at DESC`,
	"BUSINESSES":     `SELECT id, name, business_type, category, email, phone, city, country, default_currency, status, created_at FROM businesses ORDER BY created_at DESC`,
	"SHOPS":          `SELECT s.id, s.name, b.name AS business, s.type, s.city, s.phone, s.status, s.created_at FROM shops s JOIN businesses b ON b.id = s.business_id ORDER BY s.created_at DESC`,
	"PRODUCTS":       `SELECT p.id, p.name, p.sku, b.name AS business, p.unit_price, p.currency, p.status, p.publication_status, p.created_at FROM products p JOIN businesses b ON b.id = p.business_id ORDER BY p.created_at DESC`,
	"INVENTORY":      `SELECT i.id, s.name AS shop, p.name AS product, i.variant_id, i.quantity, i.reserved_quantity, i.quantity - i.reserved_quantity AS available, i.updated_at FROM inventory i JOIN shops s ON s.id = i.shop_id JOIN products p ON p.id = i.product_id ORDER BY s.name, p.name`,
	"ORDERS":         `SELECT o.id, o.order_number, s.name AS shop, o.status, o.delivery_method, o.total_items, o.base_total, o.final_total, o.currency, o.created_at, o.completed_at FROM orders o JOIN shops s ON s.id = o.shop_id ORDER BY o.created_at DESC`,
	"CASH_SUMMARIES": `SELECT bp.id, o.order_number, bp.payment_method, bp.provider, bp.status, bp.cash_due, bp.final_total, bp.currency, bp.confirmation_actor, bp.paid_at, bp.created_at FROM buyer_payments bp JOIN orders o ON o.id = bp.order_id ORDER BY bp.created_at DESC`,
	"POINTS_HISTORY": `SELECT id, point_account_id, user_id, type, reference_type, points_change, previous_points, new_points, reason, created_by_admin, created_at FROM point_transactions ORDER BY created_at DESC`,
	"REVIEWS":        `SELECT id, order_id, business_id, shop_id, product_id, rating, comment, status, created_at FROM seller_reviews ORDER BY created_at DESC`,
	"CASES":          `SELECT id, case_number, case_type, status, priority, title, assigned_admin_id, created_at, resolved_at FROM cases ORDER BY created_at DESC`,
	"RISK_EVENTS":    `SELECT id, event_type, severity, target_type, target_id, rule_code, status, created_at, resolved_at FROM risk_events ORDER BY created_at DESC`,
	"AUDIT_LOGS":     `SELECT id, actor_admin_id, actor_role, action, target_type, target_id, reason, created_at FROM admin_audit_log ORDER BY created_at DESC`,
}

func exportDirectory() string {
	if d := os.Getenv("EXPORT_DIR"); d != "" {
		return d
	}
	// Never under the public /uploads tree: exports hold customer data.
	return "./exports"
}

// runExport builds the CSV for a queued job and records the outcome on the row,
// so the Exports panel moves QUEUED -> RUNNING -> COMPLETED (or FAILED).
func (s *AdminPhase5Service) runExport(jobID uuid.UUID, dataset string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	_, _ = s.db.ExecContext(ctx, `UPDATE admin_export_jobs SET status='RUNNING' WHERE id=$1`, jobID)

	path, rows, err := s.writeExport(ctx, jobID, dataset)
	if err != nil {
		msg := err.Error()
		_, _ = s.db.ExecContext(ctx, `UPDATE admin_export_jobs SET status='FAILED', error_message=$2, completed_at=NOW() WHERE id=$1`, jobID, msg)
		return
	}
	_, _ = s.db.ExecContext(ctx, `UPDATE admin_export_jobs SET status='COMPLETED', file_path=$2, error_message=NULL, completed_at=NOW(),
		filters = filters || jsonb_build_object('row_count', $3::int) WHERE id=$1`, jobID, path, rows)
}

func (s *AdminPhase5Service) writeExport(ctx context.Context, jobID uuid.UUID, dataset string) (string, int, error) {
	query, ok := exportQueries[dataset]
	if !ok {
		return "", 0, fmt.Errorf("unknown dataset %s", dataset)
	}
	dir := exportDirectory()
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return "", 0, err
	}
	path := filepath.Join(dir, fmt.Sprintf("%s_%s.csv", dataset, jobID))
	f, err := os.Create(path)
	if err != nil {
		return "", 0, err
	}
	defer f.Close()

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return "", 0, err
	}
	defer rows.Close()
	cols, err := rows.Columns()
	if err != nil {
		return "", 0, err
	}
	// Excel opens a UTF-8 CSV correctly only with a BOM.
	_, _ = f.Write([]byte{0xEF, 0xBB, 0xBF})
	w := csv.NewWriter(f)
	_ = w.Write(cols)
	values := make([]sql.NullString, len(cols))
	ptrs := make([]interface{}, len(cols))
	for i := range values {
		ptrs[i] = &values[i]
	}
	count := 0
	for rows.Next() {
		if err := rows.Scan(ptrs...); err != nil {
			return "", 0, err
		}
		record := make([]string, len(cols))
		for i, v := range values {
			record[i] = v.String
		}
		if err := w.Write(record); err != nil {
			return "", 0, err
		}
		count++
	}
	if err := rows.Err(); err != nil {
		return "", 0, err
	}
	w.Flush()
	return path, count, w.Error()
}

// ExportFile returns the finished file of a job the admin is allowed to read:
// the requester, or a Super/Direction admin who can see every export.
func (s *AdminPhase5Service) ExportFile(ctx context.Context, adminID uuid.UUID, role models.AdminRole, jobID uuid.UUID) (string, string, error) {
	var dataset, status string
	var requestedBy uuid.UUID
	var path sql.NullString
	err := s.db.QueryRowContext(ctx, `SELECT dataset, status, requested_by, file_path FROM admin_export_jobs WHERE id=$1`, jobID).Scan(&dataset, &status, &requestedBy, &path)
	if err == sql.ErrNoRows {
		return "", "", errors.New("not found: export job")
	}
	if err != nil {
		return "", "", err
	}
	if requestedBy != adminID && role != models.AdminRoleSuperAdmin && role != models.AdminRoleDirectionAdmin {
		return "", "", errors.New("forbidden: export belongs to another admin")
	}
	if status != "COMPLETED" || !path.Valid {
		return "", "", fmt.Errorf("export is %s, not ready for download", status)
	}
	_ = s.audit.Record(adminID, role, "EXPORT_DOWNLOAD", "export_job", jobID.String(), "download", nil, map[string]string{"dataset": dataset}, "", "")
	return path.String, fmt.Sprintf("%s_%s.csv", dataset, time.Now().Format("20060102")), nil
}
