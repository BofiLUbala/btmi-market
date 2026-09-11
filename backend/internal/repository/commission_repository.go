package repository

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type CommissionRepository struct {
	db *sql.DB
}

func NewCommissionRepository(db *sql.DB) *CommissionRepository {
	return &CommissionRepository{db: db}
}

// GetCommissionRate fetches the current global commission percentage (defaults to 3.00 if unset).
func (r *CommissionRepository) GetCommissionRate() (float64, error) {
	var valStr string
	err := r.db.QueryRow(`SELECT value FROM global_configs WHERE key='PLATFORM_COMMISSION_RATE'`).Scan(&valStr)
	if err == sql.ErrNoRows {
		return 3.00, nil
	} else if err != nil {
		return 3.00, err
	}
	rate, err := strconv.ParseFloat(valStr, 64)
	if err != nil {
		return 3.00, nil
	}
	return rate, nil
}

// UpdateCommissionRate updates global_configs and appends an audit entry to platform_commission_history.
func (r *CommissionRepository) UpdateCommissionRate(oldRate, newRate float64, changedBy uuid.UUID, reason string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	newRateStr := fmt.Sprintf("%.2f", newRate)
	_, err = tx.Exec(`
		INSERT INTO global_configs (key, description, value_type, value, category, updated_at, updated_by)
		VALUES ('PLATFORM_COMMISSION_RATE', 'Pourcentage de commission TBK prélevé sur les ventes vérifiées', 'NUMBER', $1, 'FINANCE', NOW(), $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by
	`, newRateStr, changedBy)
	if err != nil {
		return err
	}

	_, err = tx.Exec(`
		INSERT INTO platform_commission_history (id, old_rate, new_rate, changed_by, reason, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
	`, uuid.New(), oldRate, newRate, changedBy, reason)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// GetRateHistory returns the log of rate changes.
func (r *CommissionRepository) GetRateHistory() ([]models.CommissionHistory, error) {
	rows, err := r.db.Query(`
		SELECT h.id, h.old_rate, h.new_rate, h.changed_by, COALESCE(u.first_name || ' ' || u.last_name, u.email, ''), h.reason, h.created_at
		FROM platform_commission_history h
		LEFT JOIN users u ON h.changed_by = u.id
		ORDER BY h.created_at DESC
		LIMIT 50
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []models.CommissionHistory
	for rows.Next() {
		var item models.CommissionHistory
		var changedBy sql.NullString
		if err := rows.Scan(&item.ID, &item.OldRate, &item.NewRate, &changedBy, &item.AdminName, &item.Reason, &item.CreatedAt); err != nil {
			return nil, err
		}
		if changedBy.Valid {
			id, _ := uuid.Parse(changedBy.String)
			item.ChangedBy = &id
		}
		history = append(history, item)
	}
	return history, nil
}

// CreateCommission creates a per-sale commission record idempotently (ON CONFLICT (order_id) DO NOTHING).
func (r *CommissionRepository) CreateCommission(c *models.SaleCommission) error {
	query := `
		INSERT INTO sale_commissions (
			id, order_id, payment_id, business_id, shop_id, seller_user_id,
			gross_amount, commission_base, commission_rate, commission_amount, seller_net_amount,
			status, calculated_at, notes, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11,
			$12, NOW(), $13, NOW(), NOW()
		)
		ON CONFLICT (order_id) DO NOTHING
	`
	_, err := r.db.Exec(query,
		c.ID, c.OrderID, c.PaymentID, c.BusinessID, c.ShopID, c.SellerUserID,
		c.GrossAmount, c.CommissionBase, c.CommissionRate, c.CommissionAmount, c.SellerNetAmount,
		c.Status, c.Notes,
	)
	return err
}

// GetByOrderID retrieves a commission record by order ID.
func (r *CommissionRepository) GetByOrderID(orderID uuid.UUID) (*models.SaleCommission, error) {
	query := `
		SELECT c.id, c.order_id, o.order_number, c.payment_id, c.business_id, COALESCE(b.name,''),
		       c.shop_id, COALESCE(s.name,''), c.seller_user_id, COALESCE(u.first_name || ' ' || u.last_name, u.email, ''),
		       c.gross_amount, c.commission_base, c.commission_rate, c.commission_amount, c.seller_net_amount,
		       c.status, c.calculated_at, c.collected_at, c.collected_by, COALESCE(adm.first_name || ' ' || adm.last_name, adm.email, ''),
		       c.notes, c.created_at, c.updated_at
		FROM sale_commissions c
		JOIN orders o ON c.order_id = o.id
		LEFT JOIN businesses b ON c.business_id = b.id
		LEFT JOIN shops s ON c.shop_id = s.id
		LEFT JOIN users u ON c.seller_user_id = u.id
		LEFT JOIN users adm ON c.collected_by = adm.id
		WHERE c.order_id = $1
	`
	row := r.db.QueryRow(query, orderID)
	return r.scanCommission(row)
}

// ListCommissions lists per-sale commission records matching filters.
func (r *CommissionRepository) ListCommissions(filter *models.CommissionFilter) ([]models.SaleCommission, int, error) {
	var where []string
	var args []interface{}
	argIdx := 1

	if filter.Status != "" {
		where = append(where, fmt.Sprintf("c.status = $%d", argIdx))
		args = append(args, filter.Status)
		argIdx++
	}
	if filter.BusinessID != "" {
		where = append(where, fmt.Sprintf("c.business_id = $%d", argIdx))
		args = append(args, filter.BusinessID)
		argIdx++
	}
	if filter.ShopID != "" {
		where = append(where, fmt.Sprintf("c.shop_id = $%d", argIdx))
		args = append(args, filter.ShopID)
		argIdx++
	}
	if filter.SellerID != "" {
		where = append(where, fmt.Sprintf("c.seller_user_id = $%d", argIdx))
		args = append(args, filter.SellerID)
		argIdx++
	}
	if filter.DateFrom != "" {
		where = append(where, fmt.Sprintf("c.calculated_at >= $%d", argIdx))
		args = append(args, filter.DateFrom)
		argIdx++
	}
	if filter.DateTo != "" {
		where = append(where, fmt.Sprintf("c.calculated_at <= $%d", argIdx))
		args = append(args, filter.DateTo)
		argIdx++
	}
	if filter.Search != "" {
		pattern := "%" + strings.ToLower(filter.Search) + "%"
		where = append(where, fmt.Sprintf("(LOWER(o.order_number) LIKE $%d OR LOWER(b.name) LIKE $%d OR LOWER(s.name) LIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, pattern)
		argIdx++
	}

	whereClause := ""
	if len(where) > 0 {
		whereClause = "WHERE " + strings.Join(where, " AND ")
	}

	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM sale_commissions c
		JOIN orders o ON c.order_id = o.id
		LEFT JOIN businesses b ON c.business_id = b.id
		LEFT JOIN shops s ON c.shop_id = s.id
		%s
	`, whereClause)

	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	limit := filter.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(`
		SELECT c.id, c.order_id, o.order_number, c.payment_id, c.business_id, COALESCE(b.name,''),
		       c.shop_id, COALESCE(s.name,''), c.seller_user_id, COALESCE(u.first_name || ' ' || u.last_name, u.email, ''),
		       c.gross_amount, c.commission_base, c.commission_rate, c.commission_amount, c.seller_net_amount,
		       c.status, c.calculated_at, c.collected_at, c.collected_by, COALESCE(adm.first_name || ' ' || adm.last_name, adm.email, ''),
		       c.notes, c.created_at, c.updated_at
		FROM sale_commissions c
		JOIN orders o ON c.order_id = o.id
		LEFT JOIN businesses b ON c.business_id = b.id
		LEFT JOIN shops s ON c.shop_id = s.id
		LEFT JOIN users u ON c.seller_user_id = u.id
		LEFT JOIN users adm ON c.collected_by = adm.id
		%s
		ORDER BY c.calculated_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var items []models.SaleCommission
	for rows.Next() {
		item, err := r.scanCommissionRows(rows)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, *item)
	}

	return items, total, nil
}

// GetSummary computes aggregate KPI statistics for Finance Admin.
func (r *CommissionRepository) GetSummary(filter *models.CommissionFilter) (*models.CommissionSummary, error) {
	var where []string
	var args []interface{}
	argIdx := 1

	if filter.BusinessID != "" {
		where = append(where, fmt.Sprintf("c.business_id = $%d", argIdx))
		args = append(args, filter.BusinessID)
		argIdx++
	}
	if filter.ShopID != "" {
		where = append(where, fmt.Sprintf("c.shop_id = $%d", argIdx))
		args = append(args, filter.ShopID)
		argIdx++
	}
	if filter.DateFrom != "" {
		where = append(where, fmt.Sprintf("c.calculated_at >= $%d", argIdx))
		args = append(args, filter.DateFrom)
		argIdx++
	}
	if filter.DateTo != "" {
		where = append(where, fmt.Sprintf("c.calculated_at <= $%d", argIdx))
		args = append(args, filter.DateTo)
		argIdx++
	}

	whereClause := ""
	if len(where) > 0 {
		whereClause = "WHERE " + strings.Join(where, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT
			COALESCE(SUM(c.gross_amount), 0),
			COALESCE(SUM(c.commission_amount), 0),
			COALESCE(SUM(CASE WHEN c.status = 'COLLECTED' THEN c.commission_amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN c.status = 'DUE' THEN c.commission_amount ELSE 0 END), 0),
			COALESCE(SUM(c.seller_net_amount), 0),
			COUNT(c.id)
		FROM sale_commissions c
		%s
	`, whereClause)

	summary := &models.CommissionSummary{}
	err := r.db.QueryRow(query, args...).Scan(
		&summary.GrossSales,
		&summary.TotalCommission,
		&summary.CollectedCommission,
		&summary.DueCommission,
		&summary.SellerNetRevenue,
		&summary.TotalVerifiedSales,
	)
	if err != nil {
		return nil, err
	}
	return summary, nil
}

// GetSellerSummary computes aggregate financial KPI summary for a seller's business IDs.
func (r *CommissionRepository) GetSellerSummary(businessIDs []uuid.UUID) (*models.SellerFinanceSummary, error) {
	if len(businessIDs) == 0 {
		return &models.SellerFinanceSummary{}, nil
	}

	placeholders := make([]string, len(businessIDs))
	args := make([]interface{}, len(businessIDs))
	for i, id := range businessIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = id
	}

	query := fmt.Sprintf(`
		SELECT
			COALESCE(SUM(gross_amount), 0),
			COALESCE(SUM(commission_amount), 0),
			COALESCE(SUM(seller_net_amount), 0),
			COALESCE(SUM(CASE WHEN status = 'DUE' THEN commission_amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'COLLECTED' THEN commission_amount ELSE 0 END), 0),
			COUNT(id)
		FROM sale_commissions
		WHERE business_id IN (%s)
	`, strings.Join(placeholders, ","))

	summary := &models.SellerFinanceSummary{}
	err := r.db.QueryRow(query, args...).Scan(
		&summary.GrossSales,
		&summary.TBKCommissionTotal,
		&summary.SellerNetRevenue,
		&summary.CommissionDue,
		&summary.CommissionCollected,
		&summary.TotalCompletedSales,
	)
	if err != nil {
		return nil, err
	}
	return summary, nil
}

// MarkCollected marks a commission record as COLLECTED by Finance Admin.
func (r *CommissionRepository) MarkCollected(id uuid.UUID, adminID uuid.UUID, notes string) error {
	query := `
		UPDATE sale_commissions
		SET status = 'COLLECTED',
		    collected_at = NOW(),
		    collected_by = $2,
		    notes = CASE WHEN $3 != '' THEN $3 ELSE notes END,
		    updated_at = NOW()
		WHERE id = $1 AND status = 'DUE'
	`
	res, err := r.db.Exec(query, id, adminID, notes)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("COMMISSION_NOT_FOUND_OR_ALREADY_COLLECTED")
	}
	return nil
}

func (r *CommissionRepository) scanCommission(row *sql.Row) (*models.SaleCommission, error) {
	var c models.SaleCommission
	var paymentID, sellerID, collectedBy sql.NullString
	var collectedAt sql.NullTime

	err := row.Scan(
		&c.ID, &c.OrderID, &c.OrderNumber, &paymentID, &c.BusinessID, &c.BusinessName,
		&c.ShopID, &c.ShopName, &sellerID, &c.SellerName,
		&c.GrossAmount, &c.CommissionBase, &c.CommissionRate, &c.CommissionAmount, &c.SellerNetAmount,
		&c.Status, &c.CalculatedAt, &collectedAt, &collectedBy, &c.CollectorName,
		&c.Notes, &c.CreatedAt, &c.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, err
	}

	if paymentID.Valid {
		id, _ := uuid.Parse(paymentID.String)
		c.PaymentID = &id
	}
	if sellerID.Valid {
		id, _ := uuid.Parse(sellerID.String)
		c.SellerUserID = &id
	}
	if collectedBy.Valid {
		id, _ := uuid.Parse(collectedBy.String)
		c.CollectedBy = &id
	}
	if collectedAt.Valid {
		c.CollectedAt = &collectedAt.Time
	}

	return &c, nil
}

func (r *CommissionRepository) scanCommissionRows(rows *sql.Rows) (*models.SaleCommission, error) {
	var c models.SaleCommission
	var paymentID, sellerID, collectedBy sql.NullString
	var collectedAt sql.NullTime

	err := rows.Scan(
		&c.ID, &c.OrderID, &c.OrderNumber, &paymentID, &c.BusinessID, &c.BusinessName,
		&c.ShopID, &c.ShopName, &sellerID, &c.SellerName,
		&c.GrossAmount, &c.CommissionBase, &c.CommissionRate, &c.CommissionAmount, &c.SellerNetAmount,
		&c.Status, &c.CalculatedAt, &collectedAt, &collectedBy, &c.CollectorName,
		&c.Notes, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if paymentID.Valid {
		id, _ := uuid.Parse(paymentID.String)
		c.PaymentID = &id
	}
	if sellerID.Valid {
		id, _ := uuid.Parse(sellerID.String)
		c.SellerUserID = &id
	}
	if collectedBy.Valid {
		id, _ := uuid.Parse(collectedBy.String)
		c.CollectedBy = &id
	}
	if collectedAt.Valid {
		c.CollectedAt = &collectedAt.Time
	}

	return &c, nil
}
