package repository

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// businessScopeClause renders the seller scope. An explicit but empty scope
// means "this caller owns no business", which must match no sale rather than
// silently widening to every sale on the platform.
func businessScopeClause(ids []uuid.UUID, alias string, argIdx int) (string, interface{}, bool) {
	if ids == nil {
		return "", nil, false
	}
	if len(ids) == 0 {
		return "FALSE", nil, false
	}
	strs := make([]string, len(ids))
	for i, id := range ids {
		strs[i] = id.String()
	}
	return fmt.Sprintf("%s.business_id = ANY($%d)", alias, argIdx), pq.Array(strs), true
}

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

// GetBusinessOwnerUserID resolves the seller user that owns a business via the
// OWNER business membership. This is the authoritative "seller" for an order
// when no explicit creator (orders.created_by) is recorded.
func (r *CommissionRepository) GetBusinessOwnerUserID(businessID uuid.UUID) (uuid.UUID, error) {
	var ownerID uuid.UUID
	err := r.db.QueryRow(`
		SELECT user_id
		FROM business_memberships
		WHERE business_id = $1
		  AND role = 'OWNER'
		  AND (status = 'ACTIVE' OR status IS NULL)
		ORDER BY joined_at ASC
		LIMIT 1`, businessID).Scan(&ownerID)
	return ownerID, err
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
			gross_amount, commission_base, commission_rate, commission_amount, seller_net_amount, currency,
			status, calculated_at, notes, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11, $12,
			$13, NOW(), $14, NOW(), NOW()
		)
		ON CONFLICT (order_id) DO NOTHING
	`
	_, err := r.db.Exec(query,
		c.ID, c.OrderID, c.PaymentID, c.BusinessID, c.ShopID, c.SellerUserID,
		c.GrossAmount, c.CommissionBase, c.CommissionRate, c.CommissionAmount, c.SellerNetAmount, c.Currency,
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
		       c.currency,
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
func (r *CommissionRepository) ListCommissions(filter *models.CommissionFilter) ([]models.SaleHistoryItem, int, error) {
	var where []string
	var args []interface{}
	argIdx := 1

	if clause, arg, hasArg := businessScopeClause(filter.BusinessIDs, "c", argIdx); clause != "" {
		where = append(where, clause)
		if hasArg {
			args = append(args, arg)
			argIdx++
		}
	}
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
	if filter.ProductID != "" {
		where = append(where, fmt.Sprintf(
			"EXISTS (SELECT 1 FROM order_lines fl WHERE fl.order_id = c.order_id AND fl.product_id = $%d)", argIdx))
		args = append(args, filter.ProductID)
		argIdx++
	}
	if filter.VariantID != "" {
		where = append(where, fmt.Sprintf(
			"EXISTS (SELECT 1 FROM order_lines fl WHERE fl.order_id = c.order_id AND fl.variant_id = $%d)", argIdx))
		args = append(args, filter.VariantID)
		argIdx++
	}
	// The buyer's payment status is a different axis from the commission
	// status filtered above; both can be applied at once.
	if filter.PaymentStatus != "" {
		where = append(where, fmt.Sprintf(
			"EXISTS (SELECT 1 FROM buyer_payments fp WHERE fp.order_id = c.order_id AND fp.status = $%d)", argIdx))
		args = append(args, filter.PaymentStatus)
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
		       c.currency,
		       c.status, c.calculated_at, c.collected_at, c.collected_by, COALESCE(adm.first_name || ' ' || adm.last_name, adm.email, ''),
		       c.notes, c.created_at, c.updated_at,
		       COALESCE(bp.first_name || ' ' || bp.last_name, bp.email, ''),
		       COALESCE(pay.payment_method, ''), COALESCE(pay.status::text, ''),
		       o.status::text, COALESCE(o.delivery_method, ''), COALESCE(o.delivery_status, '')
		FROM sale_commissions c
		JOIN orders o ON c.order_id = o.id
		LEFT JOIN businesses b ON c.business_id = b.id
		LEFT JOIN shops s ON c.shop_id = s.id
		LEFT JOIN users u ON c.seller_user_id = u.id
		LEFT JOIN users adm ON c.collected_by = adm.id
		LEFT JOIN buyer_payments pay ON pay.order_id = c.order_id
		LEFT JOIN buyer_profiles bp ON bp.id = COALESCE(pay.buyer_profile_id, o.buyer_profile_id)
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

	items := []models.SaleHistoryItem{}
	orderIDs := []string{}
	for rows.Next() {
		item, err := r.scanHistoryRow(rows)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, *item)
		orderIDs = append(orderIDs, item.OrderID.String())
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	// Attach the product/variant snapshots of this page in one round trip so
	// the history table can show what was actually sold, not just totals.
	linesByOrder, err := r.linesForOrders(orderIDs)
	if err != nil {
		return nil, 0, err
	}
	for i := range items {
		lines := linesByOrder[items[i].OrderID.String()]
		if lines == nil {
			lines = []models.SaleFinanceLine{}
		}
		items[i].Lines = lines
		for _, line := range lines {
			items[i].TotalQuantity += line.Quantity
		}
	}

	return items, total, nil
}

// linesForOrders loads the order-line snapshots for a page of sales, keyed by
// order id. Same snapshot source as the per-order drill-down.
func (r *CommissionRepository) linesForOrders(orderIDs []string) (map[string][]models.SaleFinanceLine, error) {
	result := map[string][]models.SaleFinanceLine{}
	if len(orderIDs) == 0 {
		return result, nil
	}
	rows, err := r.db.Query(`
		SELECT ol.order_id, ol.product_id, COALESCE(NULLIF(ol.product_name, ''), p.name, ''), COALESCE(ol.product_sku, ''),
		       ol.variant_id, COALESCE(NULLIF(ol.variant_name, ''), v.name, ''), COALESCE(ol.variant_sku, ''),
		       ol.quantity, ol.base_unit_price, ol.points_discount_per_unit,
		       ol.final_unit_price, ROUND(ol.final_unit_price * ol.quantity, 2)
		FROM order_lines ol
		LEFT JOIN products p ON p.id = ol.product_id
		LEFT JOIN product_variants v ON v.id = ol.variant_id
		WHERE ol.order_id = ANY($1)
		ORDER BY ol.created_at, ol.id`, pq.Array(orderIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var orderID string
		var line models.SaleFinanceLine
		var productID, variantID sql.NullString
		if err := rows.Scan(&orderID, &productID, &line.ProductName, &line.ProductSKU, &variantID,
			&line.VariantName, &line.VariantSKU, &line.Quantity, &line.UnitPrice,
			&line.PointsDiscount, &line.FinalUnitPrice, &line.GrossAmount); err != nil {
			return nil, err
		}
		if productID.Valid {
			if id, parseErr := uuid.Parse(productID.String); parseErr == nil {
				line.ProductID = &id
			}
		}
		if variantID.Valid {
			if id, parseErr := uuid.Parse(variantID.String); parseErr == nil {
				line.VariantID = &id
			}
		}
		result[orderID] = append(result[orderID], line)
	}
	return result, rows.Err()
}

// scanHistoryRow scans the commission snapshot plus its buyer / payment /
// delivery context into one history row.
func (r *CommissionRepository) scanHistoryRow(rows *sql.Rows) (*models.SaleHistoryItem, error) {
	var item models.SaleHistoryItem
	c := &item.SaleCommission
	var paymentID, sellerID, collectedBy sql.NullString
	var collectedAt sql.NullTime

	err := rows.Scan(
		&c.ID, &c.OrderID, &c.OrderNumber, &paymentID, &c.BusinessID, &c.BusinessName,
		&c.ShopID, &c.ShopName, &sellerID, &c.SellerName,
		&c.GrossAmount, &c.CommissionBase, &c.CommissionRate, &c.CommissionAmount, &c.SellerNetAmount, &c.Currency,
		&c.Status, &c.CalculatedAt, &collectedAt, &collectedBy, &c.CollectorName,
		&c.Notes, &c.CreatedAt, &c.UpdatedAt,
		&item.BuyerName, &item.PaymentMethod, &item.PaymentStatus,
		&item.OrderStatus, &item.DeliveryMethod, &item.DeliveryStatus,
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

	return &item, nil
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

// VoidCommissionForRefund waives the commission attached to a refunded order so
// a cancelled transaction no longer counts as revenue anywhere.
func (r *CommissionRepository) VoidCommissionForRefund(orderID uuid.UUID, notes string) error {
	res, err := r.db.Exec(`
		UPDATE sale_commissions
		SET status = 'WAIVED',
		    notes = CASE WHEN $2 != '' THEN concat_ws(' / ', notes, $2) ELSE notes END,
		    updated_at = NOW()
		WHERE order_id = $1 AND status IN ('DUE', 'COLLECTED')
	`, orderID, notes)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return nil
	}
	return nil
}

// GetSaleFinanceDetail returns the shared order-level finance drill-down used
// by seller finance and Finance Admin.
func (r *CommissionRepository) GetSaleFinanceDetail(orderID uuid.UUID) (*models.SaleFinanceDetail, error) {
	sale, err := r.GetByOrderID(orderID)
	if err != nil || sale == nil {
		return nil, err
	}

	detail := &models.SaleFinanceDetail{Sale: *sale, Lines: []models.SaleFinanceLine{}}
	var verifiedAt sql.NullTime
	err = r.db.QueryRow(`
		SELECT COALESCE(bp.first_name || ' ' || bp.last_name, bp.email, ''),
		       COALESCE(pay.payment_method, ''), COALESCE(pay.status::text, ''),
		       o.status::text, COALESCE(o.delivery_method, ''), COALESCE(o.delivery_status, ''),
		       COALESCE(pay.payment_markup, 0), COALESCE(pay.delivery_fee_final, o.delivery_fee_final, 0),
		       COALESCE(pay.products_final_total, c.gross_amount), COALESCE(pay.final_total, o.final_total),
		       o.created_at, pay.verified_at
		FROM sale_commissions c
		JOIN orders o ON o.id = c.order_id
		LEFT JOIN buyer_payments pay ON pay.order_id = o.id
		LEFT JOIN buyer_profiles bp ON bp.id = COALESCE(pay.buyer_profile_id, o.buyer_profile_id)
		WHERE c.order_id = $1`, orderID).Scan(
		&detail.BuyerName, &detail.PaymentMethod, &detail.PaymentStatus,
		&detail.OrderStatus, &detail.DeliveryMethod, &detail.DeliveryStatus,
		&detail.PaymentMarkup, &detail.DeliveryFee, &detail.ProductsSubtotal, &detail.FinalTotal,
		&detail.OrderedAt, &verifiedAt,
	)
	if err != nil {
		return nil, err
	}
	if verifiedAt.Valid {
		detail.VerifiedAt = &verifiedAt.Time
	}

	rows, err := r.db.Query(`
		SELECT ol.product_id, COALESCE(NULLIF(ol.product_name, ''), p.name, ''), COALESCE(ol.product_sku, ''),
		       ol.variant_id, COALESCE(NULLIF(ol.variant_name, ''), v.name, ''), COALESCE(ol.variant_sku, ''),
		       ol.quantity, ol.base_unit_price, ol.points_discount_per_unit,
		       ol.final_unit_price, ROUND(ol.final_unit_price * ol.quantity, 2)
		FROM order_lines ol
		LEFT JOIN products p ON p.id = ol.product_id
		LEFT JOIN product_variants v ON v.id = ol.variant_id
		WHERE ol.order_id = $1
		ORDER BY ol.created_at, ol.id`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var line models.SaleFinanceLine
		var productID, variantID sql.NullString
		if err := rows.Scan(&productID, &line.ProductName, &line.ProductSKU, &variantID,
			&line.VariantName, &line.VariantSKU, &line.Quantity, &line.UnitPrice,
			&line.PointsDiscount, &line.FinalUnitPrice, &line.GrossAmount); err != nil {
			return nil, err
		}
		if productID.Valid {
			if id, parseErr := uuid.Parse(productID.String); parseErr == nil {
				line.ProductID = &id
			}
		}
		if variantID.Valid {
			if id, parseErr := uuid.Parse(variantID.String); parseErr == nil {
				line.VariantID = &id
			}
		}
		detail.Lines = append(detail.Lines, line)
	}
	return detail, rows.Err()
}

func (r *CommissionRepository) scanCommission(row *sql.Row) (*models.SaleCommission, error) {
	var c models.SaleCommission
	var paymentID, sellerID, collectedBy sql.NullString
	var collectedAt sql.NullTime

	err := row.Scan(
		&c.ID, &c.OrderID, &c.OrderNumber, &paymentID, &c.BusinessID, &c.BusinessName,
		&c.ShopID, &c.ShopName, &sellerID, &c.SellerName,
		&c.GrossAmount, &c.CommissionBase, &c.CommissionRate, &c.CommissionAmount, &c.SellerNetAmount, &c.Currency,
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

// commissionReportWhere builds the shared sale_commissions WHERE clause so
// every dashboard number, breakdown row and chart bucket uses exactly the same
// population. Product, variant and payment-status narrowing are expressed as
// EXISTS sub-queries so they never multiply the commission rows being summed.
func commissionReportWhere(filter *models.FinanceReportFilter) (string, []interface{}) {
	var where []string
	var args []interface{}
	argIdx := 1

	if clause, arg, hasArg := businessScopeClause(filter.BusinessIDs, "c", argIdx); clause != "" {
		where = append(where, clause)
		if hasArg {
			args = append(args, arg)
			argIdx++
		}
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
	if filter.ProductID != "" {
		where = append(where, fmt.Sprintf(
			"EXISTS (SELECT 1 FROM order_lines fl WHERE fl.order_id = c.order_id AND fl.product_id = $%d)", argIdx))
		args = append(args, filter.ProductID)
		argIdx++
	}
	if filter.VariantID != "" {
		where = append(where, fmt.Sprintf(
			"EXISTS (SELECT 1 FROM order_lines fl WHERE fl.order_id = c.order_id AND fl.variant_id = $%d)", argIdx))
		args = append(args, filter.VariantID)
		argIdx++
	}
	// Payment status and commission status are independent axes: a buyer may
	// have settled in full (payment VERIFIED) while TBK's cut is still DUE.
	if filter.PaymentStatus != "" {
		where = append(where, fmt.Sprintf(
			"EXISTS (SELECT 1 FROM buyer_payments fp WHERE fp.order_id = c.order_id AND fp.status = $%d)", argIdx))
		args = append(args, filter.PaymentStatus)
		argIdx++
	}
	if filter.CommissionStatus != "" {
		where = append(where, fmt.Sprintf("c.status = $%d", argIdx))
		args = append(args, filter.CommissionStatus)
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

	if len(where) == 0 {
		return "", args
	}
	return "WHERE " + strings.Join(where, " AND "), args
}

// orderLineUnitsJoin attaches one pre-aggregated units row per commission so
// SUM(quantity) can sit beside SUM(gross_amount) without the join fanning the
// money columns out across order lines.
const orderLineUnitsJoin = `
		LEFT JOIN LATERAL (
			SELECT COALESCE(SUM(l.quantity), 0) AS units
			FROM order_lines l WHERE l.order_id = c.order_id
		) olu ON true`

// settledPaymentStatuses are the states in which the buyer has actually paid.
// unsettledPaymentStatuses are the states in which money is still owed by the
// buyer; CANCELLED / FAILED / REFUNDED are owed by nobody and are in neither.
const settledPaymentStatuses = `('VERIFIED', 'PAID')`
const unsettledPaymentStatuses = `('PENDING', 'CONFIRMED', 'DUE', 'PROCESSING')`

// GetDashboardReport builds the real-totals finance dashboard for Finance
// Admin and sellers from per-sale commission snapshots and buyer payments.
func (r *CommissionRepository) GetDashboardReport(filter *models.FinanceReportFilter) (*models.FinanceDashboardReport, error) {
	whereClause, args := commissionReportWhere(filter)

	report := &models.FinanceDashboardReport{}

	query := fmt.Sprintf(`
		SELECT
			COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN c.gross_amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN c.commission_amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN c.seller_net_amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN c.status = 'COLLECTED' THEN c.commission_amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN c.status = 'DUE' THEN c.commission_amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN c.status = 'WAIVED' THEN c.gross_amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN c.status = 'WAIVED' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN olu.units ELSE 0 END), 0)
		FROM sale_commissions c%s
		%s
	`, orderLineUnitsJoin, whereClause)
	if err := r.db.QueryRow(query, args...).Scan(
		&report.GrossSales, &report.CommissionAmount, &report.SellerNetAmount,
		&report.CollectedCommission, &report.DueCommission, &report.WaivedCommission,
		&report.VerifiedSales, &report.RefundedSales, &report.UnitsSold,
	); err != nil {
		return nil, err
	}

	// Per-currency totals. Currencies are never added together; the caller
	// renders each on its own line.
	currencyQuery := fmt.Sprintf(`
		SELECT c.currency,
		       COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN c.gross_amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN c.commission_amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN c.seller_net_amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN c.status = 'COLLECTED' THEN c.commission_amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN c.status = 'DUE' THEN c.commission_amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN olu.units ELSE 0 END), 0),
		       COUNT(CASE WHEN c.status <> 'WAIVED' THEN 1 END)
		FROM sale_commissions c%s %s GROUP BY c.currency ORDER BY c.currency`,
		orderLineUnitsJoin, whereClause)
	currencyRows, err := r.db.Query(currencyQuery, args...)
	if err != nil {
		return nil, err
	}
	defer currencyRows.Close()
	report.TotalsByCurrency = []models.FinanceCurrencyTotal{}
	byCurrency := map[string]int{}
	for currencyRows.Next() {
		var total models.FinanceCurrencyTotal
		if err := currencyRows.Scan(&total.Currency, &total.GrossSales, &total.CommissionAmount,
			&total.SellerNetAmount, &total.CollectedCommission, &total.DueCommission,
			&total.UnitsSold, &total.VerifiedSales); err != nil {
			return nil, err
		}
		byCurrency[total.Currency] = len(report.TotalsByCurrency)
		report.TotalsByCurrency = append(report.TotalsByCurrency, total)
	}
	if err := currencyRows.Err(); err != nil {
		return nil, err
	}
	if len(report.TotalsByCurrency) == 1 {
		report.Currency = report.TotalsByCurrency[0].Currency
	}
	report.MixedCurrency = len(report.TotalsByCurrency) > 1

	// Cash actually collected from buyers for the same commission population,
	// including delivery fees the seller keeps.
	cashWhere := strings.TrimPrefix(whereClause, "WHERE")
	if cashWhere != "" {
		cashWhere = " AND " + cashWhere
	}
	cashQuery := fmt.Sprintf(`
		SELECT COALESCE(SUM(p.cash_due), 0)
		FROM sale_commissions c
		JOIN buyer_payments p ON p.order_id = c.order_id
		WHERE p.status IN ('PAID', 'VERIFIED')
		  AND c.status <> 'WAIVED'
		%s
	`, cashWhere)
	if err := r.db.QueryRow(cashQuery, args...).Scan(&report.CollectedCash); err != nil {
		return nil, err
	}

	// Buyer-side money movement, over ALL orders in scope rather than only the
	// ones that already produced a commission snapshot: what buyers have paid
	// and what they still owe. This is the payment axis, kept strictly separate
	// from commission DUE / COLLECTED, which is the TBK axis.
	if err := r.loadPaymentTotals(filter, report, byCurrency); err != nil {
		return nil, err
	}

	// Orders still awaiting a verified payment (pipeline / work-in-progress).
	pendingQuery, pendingArgs := orderScopeQuery(`
		SELECT COUNT(*)
		FROM orders o
		LEFT JOIN buyer_payments p ON p.order_id = o.id
		WHERE o.status NOT IN ('CANCELLED', 'REJECTED', 'COMPLETED')
		  AND (p.id IS NULL OR p.status NOT IN ('PAID', 'VERIFIED'))`, filter)
	if err := r.db.QueryRow(pendingQuery, pendingArgs...).Scan(&report.PendingOrders); err != nil {
		return nil, err
	}

	rate, err := r.GetCommissionRate()
	if err != nil {
		rate = 3.00
	}
	report.CommissionRate = rate

	return report, nil
}

// orderScopeQuery appends the filter's business / shop / seller / date scope to
// a query already selecting from `orders o`, so order-level figures (pipeline,
// buyer payments) cover the same population as the commission figures.
func orderScopeQuery(base string, filter *models.FinanceReportFilter) (string, []interface{}) {
	var args []interface{}
	idx := 1
	if filter.BusinessID != "" {
		base += fmt.Sprintf(" AND o.business_id = $%d", idx)
		args = append(args, filter.BusinessID)
		idx++
	}
	if filter.ShopID != "" {
		base += fmt.Sprintf(" AND o.shop_id = $%d", idx)
		args = append(args, filter.ShopID)
		idx++
	}
	if clause, arg, hasArg := businessScopeClause(filter.BusinessIDs, "o", idx); clause != "" {
		base += " AND " + clause
		if hasArg {
			args = append(args, arg)
			idx++
		}
	}
	if filter.SellerID != "" {
		base += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM business_memberships bm WHERE bm.business_id = o.business_id AND bm.user_id = $%d AND bm.role = 'OWNER' AND (bm.status = 'ACTIVE' OR bm.status IS NULL))", idx)
		args = append(args, filter.SellerID)
		idx++
	}
	if filter.ProductID != "" {
		base += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM order_lines fl WHERE fl.order_id = o.id AND fl.product_id = $%d)", idx)
		args = append(args, filter.ProductID)
		idx++
	}
	if filter.VariantID != "" {
		base += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM order_lines fl WHERE fl.order_id = o.id AND fl.variant_id = $%d)", idx)
		args = append(args, filter.VariantID)
		idx++
	}
	if filter.DateFrom != "" {
		base += fmt.Sprintf(" AND o.created_at >= $%d", idx)
		args = append(args, filter.DateFrom)
		idx++
	}
	if filter.DateTo != "" {
		base += fmt.Sprintf(" AND o.created_at <= $%d", idx)
		args = append(args, filter.DateTo)
		idx++
	}
	return base, args
}

// loadPaymentTotals fills the buyer-payment axis of the dashboard: cash already
// settled and cash still owed, globally and per currency.
func (r *CommissionRepository) loadPaymentTotals(filter *models.FinanceReportFilter, report *models.FinanceDashboardReport, byCurrency map[string]int) error {
	base := fmt.Sprintf(`
		SELECT p.currency,
		       COALESCE(SUM(CASE WHEN p.status IN %s THEN p.cash_due ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN p.status IN %s THEN p.cash_due ELSE 0 END), 0)
		FROM buyer_payments p
		JOIN orders o ON o.id = p.order_id
		WHERE o.status NOT IN ('CANCELLED', 'REJECTED')`,
		settledPaymentStatuses, unsettledPaymentStatuses)
	if filter.PaymentStatus != "" {
		base += " AND p.status = '" + sanitizeStatusLiteral(filter.PaymentStatus) + "'"
	}
	query, args := orderScopeQuery(base, filter)
	query += " GROUP BY p.currency"

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var currency string
		var collected, due float64
		if err := rows.Scan(&currency, &collected, &due); err != nil {
			return err
		}
		report.PaymentsCollected = models.RoundMoney(report.PaymentsCollected + collected)
		report.PaymentsDue = models.RoundMoney(report.PaymentsDue + due)
		if idx, ok := byCurrency[currency]; ok {
			report.TotalsByCurrency[idx].PaymentsCollected = collected
			report.TotalsByCurrency[idx].PaymentsDue = due
		}
	}
	return rows.Err()
}

// sanitizeStatusLiteral keeps only the characters a status enum can contain, so
// a caller-supplied status can be inlined in the payment totals query without
// opening an injection hole.
func sanitizeStatusLiteral(status string) string {
	var b strings.Builder
	for _, ch := range strings.ToUpper(status) {
		if (ch >= 'A' && ch <= 'Z') || ch == '_' {
			b.WriteRune(ch)
		}
	}
	return b.String()
}

// orderLevelMetrics is the money/units projection for groups whose rows map
// one-to-one onto whole orders (shop, seller, business).
const orderLevelMetrics = `
	COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN c.gross_amount ELSE 0 END), 0),
	COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN c.commission_amount ELSE 0 END), 0),
	COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN c.seller_net_amount ELSE 0 END), 0),
	COALESCE(SUM(CASE WHEN c.status = 'COLLECTED' THEN c.commission_amount ELSE 0 END), 0),
	COALESCE(SUM(CASE WHEN c.status = 'DUE' THEN c.commission_amount ELSE 0 END), 0),
	COUNT(CASE WHEN c.status <> 'WAIVED' THEN 1 END),
	COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN olu.units ELSE 0 END), 0)`

// lineShare is a line's fraction of its own order's merchandise value. Product
// and variant rows attribute their order's commission by this share, so the
// grouped rows always re-sum to the dashboard totals.
const lineShare = `(ol.final_unit_price * ol.quantity / NULLIF(og.order_gross, 0))`

const lineLevelMetrics = `
	COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN ol.final_unit_price * ol.quantity ELSE 0 END), 0),
	COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN c.commission_amount * ` + lineShare + ` ELSE 0 END), 0),
	COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN c.seller_net_amount * ` + lineShare + ` ELSE 0 END), 0),
	COALESCE(SUM(CASE WHEN c.status = 'COLLECTED' THEN c.commission_amount * ` + lineShare + ` ELSE 0 END), 0),
	COALESCE(SUM(CASE WHEN c.status = 'DUE' THEN c.commission_amount * ` + lineShare + ` ELSE 0 END), 0),
	COUNT(DISTINCT CASE WHEN c.status <> 'WAIVED' THEN c.order_id END),
	COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN ol.quantity ELSE 0 END), 0)`

// lineLevelFrom joins each commission to its order lines together with that
// order's merchandise total, the denominator of the proportional attribution.
const lineLevelFrom = `
	FROM sale_commissions c
	JOIN order_lines ol ON ol.order_id = c.order_id
	JOIN LATERAL (
		SELECT SUM(l2.final_unit_price * l2.quantity) AS order_gross
		FROM order_lines l2 WHERE l2.order_id = c.order_id
	) og ON true`

// GetBreakdownReport groups the real sales figures by shop, product, variant,
// seller or business, with the parent dimension carried in sub_label.
func (r *CommissionRepository) GetBreakdownReport(group models.FinanceBreakdownGroup, filter *models.FinanceReportFilter) ([]models.FinanceBreakdownItem, error) {
	whereClause, args := commissionReportWhere(filter)

	var query string
	switch group {
	case models.FinanceBreakdownBusiness:
		query = fmt.Sprintf(`
			SELECT c.business_id::text, COALESCE(b.name, ''),
			       COALESCE(u.first_name || ' ' || u.last_name, u.email, ''),
			       %s, c.currency
			FROM sale_commissions c%s
			LEFT JOIN businesses b ON b.id = c.business_id
			LEFT JOIN users u ON u.id = c.seller_user_id
			%s
			GROUP BY c.business_id, b.name, u.first_name, u.last_name, u.email, c.currency
			ORDER BY 4 DESC`, orderLevelMetrics, orderLineUnitsJoin, whereClause)
	case models.FinanceBreakdownShop:
		// Shop rows carry the seller who owns them, so a row reads
		// "Beauty — Marie Kabila" without a second request.
		query = fmt.Sprintf(`
			SELECT c.shop_id::text, COALESCE(s.name, ''),
			       COALESCE(u.first_name || ' ' || u.last_name, u.email, ''),
			       %s, c.currency
			FROM sale_commissions c%s
			LEFT JOIN shops s ON s.id = c.shop_id
			LEFT JOIN users u ON u.id = c.seller_user_id
			%s
			GROUP BY c.shop_id, s.name, u.first_name, u.last_name, u.email, c.currency
			ORDER BY 4 DESC`, orderLevelMetrics, orderLineUnitsJoin, whereClause)
	case models.FinanceBreakdownSeller:
		query = fmt.Sprintf(`
			SELECT COALESCE(c.seller_user_id::text, ''), COALESCE(u.first_name || ' ' || u.last_name, u.email, '-'),
			       COALESCE(b.name, ''),
			       %s, c.currency
			FROM sale_commissions c%s
			LEFT JOIN users u ON u.id = c.seller_user_id
			LEFT JOIN businesses b ON b.id = c.business_id
			%s
			GROUP BY c.seller_user_id, u.first_name, u.last_name, u.email, b.name, c.currency
			ORDER BY 4 DESC`, orderLevelMetrics, orderLineUnitsJoin, whereClause)
	case models.FinanceBreakdownProduct:
		query = fmt.Sprintf(`
			SELECT COALESCE(ol.product_id::text, ''), COALESCE(NULLIF(ol.product_name, ''), p.name, ''),
			       COALESCE(s.name, ''),
			       %s, c.currency
			%s
			LEFT JOIN products p ON p.id = ol.product_id
			LEFT JOIN shops s ON s.id = c.shop_id
			%s
			GROUP BY ol.product_id, ol.product_name, p.name, s.name, c.currency
			ORDER BY 4 DESC`, lineLevelMetrics, lineLevelFrom, whereClause)
	case models.FinanceBreakdownVariant:
		// A variant row is identified by its own id but labelled with what was
		// actually sold ("Black / 42"), snapshotted on the order line.
		query = fmt.Sprintf(`
			SELECT COALESCE(ol.variant_id::text, ''),
			       COALESCE(NULLIF(ol.variant_name, ''), v.name, NULLIF(ol.variant_sku, ''), '-'),
			       COALESCE(NULLIF(ol.product_name, ''), p.name, ''),
			       %s, c.currency
			%s
			LEFT JOIN product_variants v ON v.id = ol.variant_id
			LEFT JOIN products p ON p.id = ol.product_id
			%s
			GROUP BY ol.variant_id, ol.variant_name, ol.variant_sku, v.name, ol.product_name, p.name, c.currency
			ORDER BY 4 DESC`, lineLevelMetrics, lineLevelFrom, whereClause)
	default:
		return nil, fmt.Errorf("INVALID_GROUP")
	}

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []models.FinanceBreakdownItem{}
	for rows.Next() {
		var it models.FinanceBreakdownItem
		if err := rows.Scan(&it.ID, &it.Label, &it.SubLabel, &it.GrossSales, &it.CommissionAmount,
			&it.SellerNetAmount, &it.Collected, &it.Due, &it.SalesCount, &it.UnitsSold, &it.Currency); err != nil {
			return nil, err
		}
		// Proportional attribution divides, so round back to the minor unit
		// before the figures leave the repository.
		it.GrossSales = models.RoundMoney(it.GrossSales)
		it.CommissionAmount = models.RoundMoney(it.CommissionAmount)
		it.SellerNetAmount = models.RoundMoney(it.SellerNetAmount)
		it.Collected = models.RoundMoney(it.Collected)
		it.Due = models.RoundMoney(it.Due)
		items = append(items, it)
	}
	return items, rows.Err()
}

// GetTimeseriesReport returns the chart series - gross, commission and seller
// net bucketed over time - for the same filtered population as the dashboard.
func (r *CommissionRepository) GetTimeseriesReport(interval models.FinanceTimeseriesInterval, filter *models.FinanceReportFilter) ([]models.FinanceTimeseriesPoint, error) {
	bucket := "day"
	switch interval {
	case models.FinanceIntervalWeek:
		bucket = "week"
	case models.FinanceIntervalMonth:
		bucket = "month"
	}

	whereClause, args := commissionReportWhere(filter)
	query := fmt.Sprintf(`
		SELECT to_char(date_trunc('%s', c.calculated_at), 'YYYY-MM-DD'),
		       COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN c.gross_amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN c.commission_amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN c.status <> 'WAIVED' THEN c.seller_net_amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN c.status = 'COLLECTED' THEN c.commission_amount ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN c.status = 'DUE' THEN c.commission_amount ELSE 0 END), 0),
		       COUNT(CASE WHEN c.status <> 'WAIVED' THEN 1 END),
		       c.currency
		FROM sale_commissions c
		%s
		GROUP BY 1, c.currency
		ORDER BY 1 ASC`, bucket, whereClause)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	points := []models.FinanceTimeseriesPoint{}
	for rows.Next() {
		var p models.FinanceTimeseriesPoint
		if err := rows.Scan(&p.Period, &p.GrossSales, &p.CommissionAmount, &p.SellerNetAmount,
			&p.Collected, &p.Due, &p.SalesCount, &p.Currency); err != nil {
			return nil, err
		}
		points = append(points, p)
	}
	return points, rows.Err()
}
