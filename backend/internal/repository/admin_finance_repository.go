package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
)

type AdminFinanceRepository struct {
	db *database.DB
}

func NewAdminFinanceRepository(db *database.DB) *AdminFinanceRepository {
	return &AdminFinanceRepository{db: db}
}

// Financial Summary Aggregates
func (r *AdminFinanceRepository) GetFinancialSummary(businessID, shopID, sellerID string, dateFrom, dateTo string) (*models.AdminFinancialSummary, error) {
	summary := &models.AdminFinancialSummary{}

	query := `
		SELECT 
			COALESCE(SUM(o.final_total), 0) as total_order_value,
			COALESCE(SUM(CASE WHEN p.status = 'VERIFIED' THEN p.cash_due ELSE 0 END), 0) as verified_cash,
			COALESCE(SUM(CASE WHEN p.status IN ('PENDING', 'BUYER_CONFIRMED') THEN p.cash_due ELSE 0 END), 0) as unverified_cash,
			COALESCE(SUM(CASE WHEN p.status = 'DISPUTED' THEN p.cash_due ELSE 0 END), 0) as disputed_cash,
			COALESCE(SUM(p.products_points_discount + p.delivery_points_discount), 0) as points_discount_value,
			COUNT(DISTINCT o.id) as total_orders,
			COUNT(DISTINCT CASE WHEN p.status IN ('PENDING', 'BUYER_CONFIRMED') THEN p.id END) as pending_payments_count,
			COUNT(DISTINCT CASE WHEN p.status = 'VERIFIED' THEN p.id END) as verified_payments_count,
			COUNT(DISTINCT CASE WHEN p.status = 'DISPUTED' THEN p.id END) as disputed_payments_count
		FROM orders o
		LEFT JOIN buyer_payments p ON p.order_id = o.id
		WHERE 1=1
	`
	args := []interface{}{}
	argIdx := 1

	if businessID != "" {
		query += fmt.Sprintf(" AND o.business_id = $%d", argIdx)
		args = append(args, businessID)
		argIdx++
	}
	if shopID != "" {
		query += fmt.Sprintf(" AND o.shop_id = $%d", argIdx)
		args = append(args, shopID)
		argIdx++
	}
	if dateFrom != "" {
		query += fmt.Sprintf(" AND o.created_at >= $%d", argIdx)
		args = append(args, dateFrom)
		argIdx++
	}
	if dateTo != "" {
		query += fmt.Sprintf(" AND o.created_at <= $%d", argIdx)
		args = append(args, dateTo)
		argIdx++
	}

	err := r.db.QueryRow(query, args...).Scan(
		&summary.TotalOrderValue,
		&summary.VerifiedCash,
		&summary.UnverifiedCash,
		&summary.DisputedCash,
		&summary.PointsDiscountValue,
		&summary.TotalOrders,
		&summary.PendingPaymentsCount,
		&summary.VerifiedPaymentsCount,
		&summary.DisputedPaymentsCount,
	)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// Count open cases & flagged reviews
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM cases WHERE status IN ('OPEN', 'UNDER_REVIEW', 'WAITING_FOR_ADMIN')`).Scan(&summary.OpenCasesCount)
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM seller_reviews WHERE status IN ('FLAGGED', 'UNDER_REVIEW')`).Scan(&summary.FlaggedReviewsCount)
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM risk_events WHERE status IN ('OPEN', 'INVESTIGATING')`).Scan(&summary.RiskAlertsCount)

	return summary, nil
}

// List Payments
func (r *AdminFinanceRepository) ListPayments(filter *models.AdminPaymentFilter) ([]models.AdminPaymentListItem, int, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if filter.PaymentStatus != "" {
		where += fmt.Sprintf(" AND p.status = $%d", argIdx)
		args = append(args, filter.PaymentStatus)
		argIdx++
	}
	if filter.BuyerConfirmed != nil {
		where += fmt.Sprintf(" AND p.buyer_confirmed = $%d", argIdx)
		args = append(args, *filter.BuyerConfirmed)
		argIdx++
	}
	if filter.SellerConfirmed != nil {
		where += fmt.Sprintf(" AND p.seller_confirmed = $%d", argIdx)
		args = append(args, *filter.SellerConfirmed)
		argIdx++
	}
	if filter.BusinessID != "" {
		where += fmt.Sprintf(" AND o.business_id = $%d", argIdx)
		args = append(args, filter.BusinessID)
		argIdx++
	}
	if filter.ShopID != "" {
		where += fmt.Sprintf(" AND o.shop_id = $%d", argIdx)
		args = append(args, filter.ShopID)
		argIdx++
	}
	if filter.BuyerID != "" {
		where += fmt.Sprintf(" AND bp.user_id = $%d", argIdx)
		args = append(args, filter.BuyerID)
		argIdx++
	}
	if filter.OrderNumber != "" {
		where += fmt.Sprintf(" AND o.order_number ILIKE $%d", argIdx)
		args = append(args, "%"+filter.OrderNumber+"%")
		argIdx++
	}
	if filter.DateFrom != "" {
		where += fmt.Sprintf(" AND p.created_at >= $%d", argIdx)
		args = append(args, filter.DateFrom)
		argIdx++
	}
	if filter.DateTo != "" {
		where += fmt.Sprintf(" AND p.created_at <= $%d", argIdx)
		args = append(args, filter.DateTo)
		argIdx++
	}

	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM buyer_payments p
		JOIN orders o ON p.order_id = o.id
		LEFT JOIN buyer_profiles bp ON p.buyer_profile_id = bp.id
		%s`, where)
	var total int
	err := r.db.QueryRow(countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	offset := (filter.Page - 1) * filter.Limit
	query := fmt.Sprintf(`
		SELECT
			p.id as payment_id, p.order_id, o.order_number, bp.user_id as buyer_id,
			COALESCE(NULLIF(TRIM(bp.first_name || ' ' || bp.last_name), ''), bp.email, '') as buyer_name,
			COALESCE(bp.email, '') as buyer_email,
			o.business_id, COALESCE(b.name, '') as business_name,
			o.shop_id, COALESCE(s.name, '') as shop_name,
			p.products_base_total, 0::numeric as discount_amount,
			(p.products_points_discount + p.delivery_points_discount) as points_discount_amount,
			p.delivery_fee_final, o.final_total as total_amount,
			p.cash_due,
			p.buyer_confirmed, p.buyer_confirmed_at,
			p.seller_confirmed, p.seller_confirmed_at,
			p.status as payment_status, p.created_at, p.verified_at
		FROM buyer_payments p
		JOIN orders o ON p.order_id = o.id
		LEFT JOIN buyer_profiles bp ON p.buyer_profile_id = bp.id
		LEFT JOIN businesses b ON o.business_id = b.id
		LEFT JOIN shops s ON o.shop_id = s.id
		%s
		ORDER BY p.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, filter.Limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]models.AdminPaymentListItem, 0)
	for rows.Next() {
		var item models.AdminPaymentListItem
		err := rows.Scan(
			&item.PaymentID, &item.OrderID, &item.OrderNumber, &item.BuyerID,
			&item.BuyerName, &item.BuyerEmail,
			&item.BusinessID, &item.BusinessName,
			&item.ShopID, &item.ShopName,
			&item.SubtotalAmount, &item.DiscountAmount, &item.PointsDiscountAmount, &item.DeliveryFee, &item.TotalAmount,
			&item.CashDue,
			&item.BuyerConfirmedPaid, &item.BuyerConfirmedAt,
			&item.SellerConfirmedReceived, &item.SellerConfirmedAt,
			&item.PaymentStatus, &item.CreatedAt, &item.VerifiedAt,
		)
		if err != nil {
			return nil, 0, err
		}

		// Cash payment consistency anomaly checks
		now := time.Now()
		if item.BuyerConfirmedPaid && item.SellerConfirmedReceived && item.PaymentStatus != "VERIFIED" {
			item.AnomalyFlag = true
			item.AnomalyReason = "Buyer & Seller both confirmed cash but status is not VERIFIED"
		} else if item.PaymentStatus == "VERIFIED" && (!item.BuyerConfirmedPaid || !item.SellerConfirmedReceived) {
			item.AnomalyFlag = true
			item.AnomalyReason = "Payment marked VERIFIED but missing double confirmation"
		} else if item.BuyerConfirmedPaid && !item.SellerConfirmedReceived && item.BuyerConfirmedAt != nil && now.Sub(*item.BuyerConfirmedAt) > 24*time.Hour {
			item.AnomalyFlag = true
			item.AnomalyReason = "Buyer confirmed cash paid over 24h ago awaiting seller confirmation"
		} else if item.SellerConfirmedReceived && !item.BuyerConfirmedPaid && item.SellerConfirmedAt != nil && now.Sub(*item.SellerConfirmedAt) > 24*time.Hour {
			item.AnomalyFlag = true
			item.AnomalyReason = "Seller confirmed cash received over 24h ago awaiting buyer confirmation"
		}

		items = append(items, item)
	}

	return items, total, nil
}

// Get Payment Detail
func (r *AdminFinanceRepository) GetPaymentDetail(id uuid.UUID) (*models.AdminPaymentDetail, error) {
	where := "WHERE p.id = $1"
	query := fmt.Sprintf(`
		SELECT
			p.id as payment_id, p.order_id, o.order_number, bp.user_id as buyer_id,
			COALESCE(NULLIF(TRIM(bp.first_name || ' ' || bp.last_name), ''), bp.email, '') as buyer_name,
			COALESCE(bp.email, '') as buyer_email,
			o.business_id, COALESCE(b.name, '') as business_name,
			o.shop_id, COALESCE(s.name, '') as shop_name,
			p.products_base_total, 0::numeric as discount_amount,
			(p.products_points_discount + p.delivery_points_discount) as points_discount_amount,
			p.delivery_fee_final, o.final_total as total_amount,
			p.cash_due,
			p.buyer_confirmed, p.buyer_confirmed_at,
			p.seller_confirmed, p.seller_confirmed_at,
			p.status as payment_status, p.created_at, p.verified_at
		FROM buyer_payments p
		JOIN orders o ON p.order_id = o.id
		LEFT JOIN buyer_profiles bp ON p.buyer_profile_id = bp.id
		LEFT JOIN businesses b ON o.business_id = b.id
		LEFT JOIN shops s ON o.shop_id = s.id
		%s
	`, where)

	detail := &models.AdminPaymentDetail{}
	err := r.db.QueryRow(query, id).Scan(
		&detail.PaymentID, &detail.OrderID, &detail.OrderNumber, &detail.BuyerID,
		&detail.BuyerName, &detail.BuyerEmail,
		&detail.BusinessID, &detail.BusinessName,
		&detail.ShopID, &detail.ShopName,
		&detail.SubtotalAmount, &detail.DiscountAmount, &detail.PointsDiscountAmount, &detail.DeliveryFee, &detail.TotalAmount,
		&detail.CashDue,
		&detail.BuyerConfirmedPaid, &detail.BuyerConfirmedAt,
		&detail.SellerConfirmedReceived, &detail.SellerConfirmedAt,
		&detail.PaymentStatus, &detail.CreatedAt, &detail.VerifiedAt,
	)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	if detail.BuyerConfirmedPaid && detail.SellerConfirmedReceived && detail.PaymentStatus != "VERIFIED" {
		detail.AnomalyFlag = true
		detail.AnomalyReason = "Buyer & Seller both confirmed cash but status is not VERIFIED"
	} else if detail.PaymentStatus == "VERIFIED" && (!detail.BuyerConfirmedPaid || !detail.SellerConfirmedReceived) {
		detail.AnomalyFlag = true
		detail.AnomalyReason = "Payment marked VERIFIED but missing double confirmation"
	} else if detail.BuyerConfirmedPaid && !detail.SellerConfirmedReceived && detail.BuyerConfirmedAt != nil && now.Sub(*detail.BuyerConfirmedAt) > 24*time.Hour {
		detail.AnomalyFlag = true
		detail.AnomalyReason = "Buyer confirmed cash paid over 24h ago awaiting seller confirmation"
	} else if detail.SellerConfirmedReceived && !detail.BuyerConfirmedPaid && detail.SellerConfirmedAt != nil && now.Sub(*detail.SellerConfirmedAt) > 24*time.Hour {
		detail.AnomalyFlag = true
		detail.AnomalyReason = "Seller confirmed cash received over 24h ago awaiting buyer confirmation"
	}

	// Fetch Order Product Lines. Names and SKUs live on products/variants,
	// not on the line itself, so they are joined in.
	linesQuery := `
		SELECT ol.id, ol.product_id, COALESCE(pr.name, ''), ol.variant_id, COALESCE(v.name, ''),
		       COALESCE(NULLIF(v.sku, ''), pr.sku, '') as sku,
		       ol.quantity, ol.final_unit_price,
		       (ol.final_unit_price * ol.quantity) as total_price
		FROM order_lines ol
		LEFT JOIN products pr ON ol.product_id = pr.id
		LEFT JOIN product_variants v ON ol.variant_id = v.id
		WHERE ol.order_id = $1
		ORDER BY ol.created_at ASC
	`
	rows, err := r.db.Query(linesQuery, detail.OrderID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var line models.AdminOrderProductLine
			if err := rows.Scan(&line.ID, &line.ProductID, &line.ProductName, &line.VariantID, &line.VariantName, &line.SKU, &line.Quantity, &line.UnitPrice, &line.TotalPrice); err == nil {
				detail.ProductLines = append(detail.ProductLines, line)
			}
		}
	}

	// Fetch Order Status History
	historyRows, err := r.db.Query(`
		SELECT status, COALESCE(notes, ''), created_at
		FROM order_status_history
		WHERE order_id = $1
		ORDER BY created_at ASC
	`, detail.OrderID)
	if err == nil {
		defer historyRows.Close()
		for historyRows.Next() {
			var h models.AdminOrderHistoryLog
			if err := historyRows.Scan(&h.Status, &h.Note, &h.Timestamp); err == nil {
				detail.OrderHistory = append(detail.OrderHistory, h)
			}
		}
	}

	return detail, nil
}

// Phase 3B - Buyer Points Ledger
func (r *AdminFinanceRepository) ListBuyerPoints(page, limit int, search string) ([]models.AdminBuyerPointsItem, int, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	// point_accounts is polymorphic: a BUYER row's owner_id is a buyer_profiles.id,
	// and the buyer's identity (and users.id) hangs off that profile.
	where += " AND pa.owner_type = 'BUYER'"

	if search != "" {
		where += fmt.Sprintf(" AND (bp.email ILIKE $%d OR bp.first_name ILIKE $%d OR bp.last_name ILIKE $%d)", argIdx, argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM point_accounts pa
		JOIN buyer_profiles bp ON pa.owner_id = bp.id
		%s`, where)
	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	query := fmt.Sprintf(`
		SELECT
			bp.user_id as buyer_id,
			COALESCE(NULLIF(TRIM(bp.first_name || ' ' || bp.last_name), ''), bp.email, '') as buyer_name,
			COALESCE(bp.email, '') as buyer_email,
			pa.id as account_id,
			pa.current_points, pa.reserved_points, pa.lifetime_points,
			COALESCE(bl.name, 'BRONZE') as current_level,
			pa.updated_at
		FROM point_accounts pa
		JOIN buyer_profiles bp ON pa.owner_id = bp.id
		LEFT JOIN buyer_levels bl ON pa.level_id = bl.id
		%s
		ORDER BY pa.updated_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]models.AdminBuyerPointsItem, 0)
	for rows.Next() {
		var item models.AdminBuyerPointsItem
		if err := rows.Scan(
			&item.BuyerID, &item.BuyerName, &item.BuyerEmail, &item.AccountID,
			&item.AvailablePoints, &item.ReservedPoints, &item.LifetimePoints,
			&item.CurrentLevel, &item.LastUpdated,
		); err != nil {
			return nil, 0, err
		}

		if item.AvailablePoints < 0 || item.ReservedPoints < 0 {
			item.AnomalyFlag = true
			item.AnomalyReason = "Negative points balance detected"
		}
		items = append(items, item)
	}

	return items, total, nil
}

func (r *AdminFinanceRepository) GetBuyerPointHistory(buyerID uuid.UUID) ([]models.AdminPointTransaction, error) {
	// An order-linked transaction carries the order in reference_id; other
	// reference types (redemptions, admin adjustments) have no order to join.
	query := `
		SELECT
			pt.id, pt.point_account_id, pt.type, pt.points_change,
			pt.new_points, pt.reference_id, COALESCE(o.order_number, ''),
			COALESCE(pt.reference_type, ''), pt.created_at
		FROM point_transactions pt
		JOIN point_accounts pa ON pt.point_account_id = pa.id
		JOIN buyer_profiles bp ON pa.owner_id = bp.id AND pa.owner_type = 'BUYER'
		LEFT JOIN orders o ON pt.reference_id = o.id
		WHERE bp.user_id = $1
		ORDER BY pt.created_at DESC
	`
	rows, err := r.db.Query(query, buyerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	txs := make([]models.AdminPointTransaction, 0)
	for rows.Next() {
		var tx models.AdminPointTransaction
		if err := rows.Scan(&tx.ID, &tx.PointAccountID, &tx.Type, &tx.Amount, &tx.BalanceAfter, &tx.OrderID, &tx.OrderNumber, &tx.Reason, &tx.CreatedAt); err == nil {
			txs = append(txs, tx)
		}
	}
	return txs, nil
}

func (r *AdminFinanceRepository) AdjustBuyerPoints(buyerID uuid.UUID, adjType string, amount int, reason string) (int, int, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback()

	var accountID uuid.UUID
	var oldAvailable, oldLifetime int
	err = tx.QueryRow(`
		SELECT pa.id, pa.current_points, pa.lifetime_points
		FROM point_accounts pa
		JOIN buyer_profiles bp ON pa.owner_id = bp.id
		WHERE pa.owner_type = 'BUYER' AND bp.user_id = $1
		FOR UPDATE OF pa
	`, buyerID).Scan(&accountID, &oldAvailable, &oldLifetime)
	if err != nil {
		return 0, 0, fmt.Errorf("point account not found for buyer: %w", err)
	}

	newAvailable := oldAvailable
	newLifetime := oldLifetime

	if adjType == "ADD" {
		newAvailable += amount
		newLifetime += amount
	} else if adjType == "REMOVE" {
		if oldAvailable < amount {
			return 0, 0, fmt.Errorf("insufficient available points (%d available, %d requested)", oldAvailable, amount)
		}
		newAvailable -= amount
	} else {
		return 0, 0, fmt.Errorf("invalid adjustment type: %s", adjType)
	}

	_, err = tx.Exec(`
		UPDATE point_accounts
		SET current_points = $1, lifetime_points = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $3
	`, newAvailable, newLifetime, accountID)
	if err != nil {
		return 0, 0, err
	}

	// point_transactions has no free-text reason column; the operator's
	// justification is persisted by the caller's audit-log record.
	txType := "CREDIT"
	if adjType == "REMOVE" {
		txType = "DEBIT"
	}
	_, err = tx.Exec(`
		INSERT INTO point_transactions (id, point_account_id, reference_type, type, points_change, previous_points, new_points, created_at)
		VALUES ($1, $2, 'ADMIN_ADJUSTMENT', $3, $4, $5, $6, CURRENT_TIMESTAMP)
	`, uuid.New(), accountID, txType, amount, oldAvailable, newAvailable)
	if err != nil {
		return 0, 0, err
	}

	if err := tx.Commit(); err != nil {
		return 0, 0, err
	}

	return oldAvailable, newAvailable, nil
}

// Phase 3B - Seller Growth
func (r *AdminFinanceRepository) ListSellerGrowth(page, limit int, search string) ([]models.AdminSellerGrowthItem, int, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if search != "" {
		where += fmt.Sprintf(" AND (u.email ILIKE $%d OR b.name ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := fmt.Sprintf(`
		SELECT COUNT(DISTINCT (u.id, b.id))
		FROM users u
		JOIN business_memberships bm ON bm.user_id = u.id
		JOIN businesses b ON bm.business_id = b.id
		%s
	`, where)
	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	query := fmt.Sprintf(`
		SELECT 
			u.id as seller_id,
			COALESCE(u.first_name || ' ' || u.last_name, u.email) as seller_name,
			u.email as seller_email,
			b.id as business_id, COALESCE(b.name, '') as business_name,
			COUNT(DISTINCT s.id) as shop_count,
			COUNT(DISTINCT o.id) as total_orders,
			COUNT(DISTINCT CASE WHEN o.status = 'COMPLETED' THEN o.id END) as completed_orders,
			COUNT(DISTINCT CASE WHEN o.status = 'CANCELLED' THEN o.id END) as cancelled_orders,
			COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.final_total ELSE 0 END), 0) as total_gmv,
			COALESCE(AVG(sr.rating), 5.0) as average_rating,
			COUNT(DISTINCT sr.id) as review_count,
			COUNT(DISTINCT c.id) as dispute_count,
			CASE WHEN u.status = 'SUSPENDED' THEN 'SUSPENDED' ELSE COALESCE(st.trust_status, 'UNRATED') END as trust_status,
			COALESCE(sl.name, 'UNRANKED') as level,
			COALESCE(st.purchase_confirmation_rate, 0) as cash_confirmation_rate,
			COALESCE(pa.current_points, 0) as growth_points
		FROM users u
		JOIN business_memberships bm ON bm.user_id = u.id
		JOIN businesses b ON bm.business_id = b.id
		LEFT JOIN shops s ON s.business_id = b.id
		LEFT JOIN orders o ON o.business_id = b.id
		LEFT JOIN seller_reviews sr ON sr.business_id = b.id
		LEFT JOIN cases c ON c.seller_id = u.id AND c.case_type = 'PAYMENT_DISPUTE'
		LEFT JOIN seller_trust st ON st.business_id = b.id
		LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = b.id
		LEFT JOIN seller_levels sl ON pa.level_id = sl.id
		%s
		GROUP BY u.id, u.first_name, u.last_name, u.email, u.status, b.id, b.name,
		         st.trust_status, st.purchase_confirmation_rate, sl.name, pa.current_points
		ORDER BY total_gmv DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]models.AdminSellerGrowthItem, 0)
	for rows.Next() {
		var item models.AdminSellerGrowthItem
		if err := rows.Scan(
			&item.SellerID, &item.SellerName, &item.SellerEmail,
			&item.BusinessID, &item.BusinessName,
			&item.ShopCount, &item.TotalOrders, &item.CompletedOrders, &item.CancelledOrders,
			&item.TotalGMV, &item.AverageRating, &item.ReviewCount, &item.DisputeCount,
			&item.TrustStatus, &item.Level, &item.CashConfirmationRate, &item.GrowthPoints,
		); err == nil {
			items = append(items, item)
		}
	}
	return items, total, nil
}

// Phase 3C - Product Reviews Moderation
func (r *AdminFinanceRepository) ListProductReviews(page, limit int, status string) ([]models.AdminProductReviewItem, int, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	// Product reviews are the seller_reviews rows that target a specific
	// product; the shop-level reviews are the rows where product_id is null.
	where += " AND pr.product_id IS NOT NULL"

	if status != "" {
		where += fmt.Sprintf(" AND pr.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM seller_reviews pr %s`, where)
	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	query := fmt.Sprintf(`
		SELECT
			pr.id as review_id, bp.user_id as buyer_id,
			COALESCE(NULLIF(TRIM(bp.first_name || ' ' || bp.last_name), ''), bp.email, '') as buyer_name,
			pr.order_id, COALESCE(o.order_number, '') as order_number,
			pr.product_id, COALESCE(p.name, '') as product_name,
			pr.variant_id, COALESCE(pv.name, '') as variant_name,
			COALESCE(pr.shop_id, '00000000-0000-0000-0000-000000000000'::uuid) as shop_id,
			COALESCE(s.name, '') as shop_name,
			COALESCE(pr.business_id, '00000000-0000-0000-0000-000000000000'::uuid) as business_id,
			COALESCE(b.name, '') as business_name,
			pr.rating, COALESCE(pr.comment, ''), pr.verified_purchase,
			0 as helpful_count,
			COALESCE(pr.status, 'VISIBLE'),
			pr.created_at
		FROM seller_reviews pr
		LEFT JOIN buyer_profiles bp ON pr.buyer_profile_id = bp.id
		LEFT JOIN products p ON pr.product_id = p.id
		LEFT JOIN product_variants pv ON pr.variant_id = pv.id
		LEFT JOIN orders o ON pr.order_id = o.id
		LEFT JOIN shops s ON pr.shop_id = s.id
		LEFT JOIN businesses b ON pr.business_id = b.id
		%s
		ORDER BY pr.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]models.AdminProductReviewItem, 0)
	for rows.Next() {
		var item models.AdminProductReviewItem
		if err := rows.Scan(
			&item.ReviewID, &item.BuyerID, &item.BuyerName, &item.OrderID, &item.OrderNumber,
			&item.ProductID, &item.ProductName, &item.VariantID, &item.VariantName,
			&item.ShopID, &item.ShopName, &item.BusinessID, &item.BusinessName,
			&item.Rating, &item.Comment, &item.IsVerifiedPurchase, &item.HelpfulCount,
			&item.ModerationStatus, &item.CreatedAt,
		); err == nil {
			items = append(items, item)
		}
	}
	return items, total, nil
}

func (r *AdminFinanceRepository) ModerateProductReview(reviewID uuid.UUID, newStatus string) error {
	result, err := r.db.Exec(`
		UPDATE seller_reviews
		SET status = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2 AND product_id IS NOT NULL
	`, newStatus, reviewID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("product review not found: %s", reviewID)
	}
	return nil
}

// Phase 3C - Shop Reviews Moderation
func (r *AdminFinanceRepository) ListShopReviews(page, limit int, status string) ([]models.AdminShopReviewItem, int, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	// Shop-level reviews are the seller_reviews rows not tied to a product.
	where += " AND sr.product_id IS NULL"

	if status != "" {
		where += fmt.Sprintf(" AND sr.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM seller_reviews sr %s`, where)
	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	query := fmt.Sprintf(`
		SELECT
			sr.id as review_id, bp.user_id as buyer_id,
			COALESCE(NULLIF(TRIM(bp.first_name || ' ' || bp.last_name), ''), bp.email, '') as buyer_name,
			sr.order_id, COALESCE(o.order_number, '') as order_number,
			sr.shop_id, COALESCE(s.name, '') as shop_name,
			bm.user_id as seller_id,
			COALESCE(NULLIF(TRIM(su.first_name || ' ' || su.last_name), ''), su.email, '') as seller_name,
			sr.rating, COALESCE(sr.comment, ''),
			COALESCE(sr.status, 'VISIBLE'),
			sr.created_at
		FROM seller_reviews sr
		LEFT JOIN buyer_profiles bp ON sr.buyer_profile_id = bp.id
		LEFT JOIN shops s ON sr.shop_id = s.id
		LEFT JOIN LATERAL (
			SELECT user_id FROM business_memberships
			WHERE business_id = sr.business_id
			ORDER BY created_at ASC LIMIT 1
		) bm ON TRUE
		LEFT JOIN users su ON bm.user_id = su.id
		LEFT JOIN orders o ON sr.order_id = o.id
		%s
		ORDER BY sr.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]models.AdminShopReviewItem, 0)
	for rows.Next() {
		var item models.AdminShopReviewItem
		if err := rows.Scan(
			&item.ReviewID, &item.BuyerID, &item.BuyerName, &item.OrderID, &item.OrderNumber,
			&item.ShopID, &item.ShopName, &item.SellerID, &item.SellerName,
			&item.Rating, &item.Comment, &item.ModerationStatus, &item.CreatedAt,
		); err == nil {
			items = append(items, item)
		}
	}
	return items, total, nil
}

func (r *AdminFinanceRepository) ModerateShopReview(reviewID uuid.UUID, newStatus string) error {
	result, err := r.db.Exec(`
		UPDATE seller_reviews
		SET status = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2 AND product_id IS NULL
	`, newStatus, reviewID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("shop review not found: %s", reviewID)
	}
	return nil
}

// Phase 3D - Cases / Disputes
func (r *AdminFinanceRepository) CreateCase(req *models.AdminCreateCaseRequest, createdByType string, createdByID *uuid.UUID) (*models.AdminCaseListItem, error) {
	caseID := uuid.New()
	caseNumber := fmt.Sprintf("CASE-%d", time.Now().UnixNano()%10000000)

	query := `
		INSERT INTO cases (
			id, case_number, case_type, status, priority,
			buyer_id, seller_id, business_id, shop_id, order_id, payment_id, product_id, review_id,
			created_by_type, created_by_id, title, description, created_at, updated_at
		) VALUES (
			$1, $2, $3, 'OPEN', $4,
			$5, $6, $7, $8, $9, $10, $11, $12,
			$13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
		)
	`
	_, err := r.db.Exec(
		query, caseID, caseNumber, req.CaseType, req.Priority,
		req.BuyerID, req.SellerID, req.BusinessID, req.ShopID, req.OrderID, req.PaymentID, req.ProductID, req.ReviewID,
		createdByType, createdByID, req.Title, req.Description,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create case: %w", err)
	}

	return r.GetCaseByID(caseID)
}

func (r *AdminFinanceRepository) GetCaseByID(id uuid.UUID) (*models.AdminCaseListItem, error) {
	query := `
		SELECT 
			c.id, c.case_number, c.case_type, c.status, c.priority,
			c.buyer_id, COALESCE(bu.first_name || ' ' || bu.last_name, bu.email, ''),
			c.seller_id, COALESCE(su.first_name || ' ' || su.last_name, su.email, ''),
			c.business_id, COALESCE(b.name, ''),
			c.shop_id, COALESCE(s.name, ''),
			c.order_id, COALESCE(o.order_number, ''),
			c.payment_id, c.product_id, c.review_id,
			c.assigned_admin_id, COALESCE(au.first_name || ' ' || au.last_name, au.email, ''),
			c.created_by_type, c.created_by_id,
			c.title, c.description, COALESCE(c.resolution, ''),
			c.created_at, c.updated_at, c.resolved_at
		FROM cases c
		LEFT JOIN users bu ON c.buyer_id = bu.id
		LEFT JOIN users su ON c.seller_id = su.id
		LEFT JOIN businesses b ON c.business_id = b.id
		LEFT JOIN shops s ON c.shop_id = s.id
		LEFT JOIN orders o ON c.order_id = o.id
		LEFT JOIN admin_users au ON c.assigned_admin_id = au.id
		WHERE c.id = $1
	`
	item := &models.AdminCaseListItem{}
	err := r.db.QueryRow(query, id).Scan(
		&item.ID, &item.CaseNumber, &item.CaseType, &item.Status, &item.Priority,
		&item.BuyerID, &item.BuyerName,
		&item.SellerID, &item.SellerName,
		&item.BusinessID, &item.BusinessName,
		&item.ShopID, &item.ShopName,
		&item.OrderID, &item.OrderNumber,
		&item.PaymentID, &item.ProductID, &item.ReviewID,
		&item.AssignedAdminID, &item.AssignedAdmin,
		&item.CreatedByType, &item.CreatedByID,
		&item.Title, &item.Description, &item.Resolution,
		&item.CreatedAt, &item.UpdatedAt, &item.ResolvedAt,
	)
	if err != nil {
		return nil, err
	}
	return item, nil
}

func (r *AdminFinanceRepository) ListCases(filter *models.AdminCaseFilter) ([]models.AdminCaseListItem, int, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if filter.CaseType != "" {
		where += fmt.Sprintf(" AND c.case_type = $%d", argIdx)
		args = append(args, filter.CaseType)
		argIdx++
	}
	if filter.Status != "" {
		where += fmt.Sprintf(" AND c.status = $%d", argIdx)
		args = append(args, filter.Status)
		argIdx++
	}
	if filter.Priority != "" {
		where += fmt.Sprintf(" AND c.priority = $%d", argIdx)
		args = append(args, filter.Priority)
		argIdx++
	}
	if filter.AssignedAdminID != "" {
		where += fmt.Sprintf(" AND c.assigned_admin_id = $%d", argIdx)
		args = append(args, filter.AssignedAdminID)
		argIdx++
	}

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM cases c %s`, where)
	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (filter.Page - 1) * filter.Limit
	query := fmt.Sprintf(`
		SELECT 
			c.id, c.case_number, c.case_type, c.status, c.priority,
			c.buyer_id, COALESCE(bu.first_name || ' ' || bu.last_name, bu.email, ''),
			c.seller_id, COALESCE(su.first_name || ' ' || su.last_name, su.email, ''),
			c.business_id, COALESCE(b.name, ''),
			c.shop_id, COALESCE(s.name, ''),
			c.order_id, COALESCE(o.order_number, ''),
			c.payment_id, c.product_id, c.review_id,
			c.assigned_admin_id, COALESCE(au.first_name || ' ' || au.last_name, au.email, ''),
			c.created_by_type, c.created_by_id,
			c.title, c.description, COALESCE(c.resolution, ''),
			c.created_at, c.updated_at, c.resolved_at
		FROM cases c
		LEFT JOIN users bu ON c.buyer_id = bu.id
		LEFT JOIN users su ON c.seller_id = su.id
		LEFT JOIN businesses b ON c.business_id = b.id
		LEFT JOIN shops s ON c.shop_id = s.id
		LEFT JOIN orders o ON c.order_id = o.id
		LEFT JOIN admin_users au ON c.assigned_admin_id = au.id
		%s
		ORDER BY c.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, filter.Limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]models.AdminCaseListItem, 0)
	for rows.Next() {
		var item models.AdminCaseListItem
		if err := rows.Scan(
			&item.ID, &item.CaseNumber, &item.CaseType, &item.Status, &item.Priority,
			&item.BuyerID, &item.BuyerName,
			&item.SellerID, &item.SellerName,
			&item.BusinessID, &item.BusinessName,
			&item.ShopID, &item.ShopName,
			&item.OrderID, &item.OrderNumber,
			&item.PaymentID, &item.ProductID, &item.ReviewID,
			&item.AssignedAdminID, &item.AssignedAdmin,
			&item.CreatedByType, &item.CreatedByID,
			&item.Title, &item.Description, &item.Resolution,
			&item.CreatedAt, &item.UpdatedAt, &item.ResolvedAt,
		); err == nil {
			items = append(items, item)
		}
	}
	return items, total, nil
}

func (r *AdminFinanceRepository) AssignCase(caseID, adminID uuid.UUID) error {
	_, err := r.db.Exec(`
		UPDATE cases 
		SET assigned_admin_id = $1, status = 'UNDER_REVIEW', updated_at = CURRENT_TIMESTAMP 
		WHERE id = $2
	`, adminID, caseID)
	return err
}

func (r *AdminFinanceRepository) ResolveCase(caseID uuid.UUID, status, resolution string) error {
	now := time.Now()
	_, err := r.db.Exec(`
		UPDATE cases 
		SET status = $1, resolution = $2, resolved_at = $3, updated_at = $3 
		WHERE id = $4
	`, status, resolution, now, caseID)
	return err
}

func (r *AdminFinanceRepository) AddCaseMessage(caseID uuid.UUID, senderType string, senderID *uuid.UUID, visibility, message string) (*models.AdminCaseMessage, error) {
	msgID := uuid.New()
	query := `
		INSERT INTO case_messages (id, case_id, sender_type, sender_id, visibility, message, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
	`
	_, err := r.db.Exec(query, msgID, caseID, senderType, senderID, visibility, message)
	if err != nil {
		return nil, err
	}

	return &models.AdminCaseMessage{
		ID:         msgID,
		CaseID:     caseID,
		SenderType: senderType,
		SenderID:   senderID,
		Visibility: visibility,
		Message:    message,
		CreatedAt:  time.Now(),
	}, nil
}

func (r *AdminFinanceRepository) GetCaseMessages(caseID uuid.UUID, includeInternal bool) ([]models.AdminCaseMessage, error) {
	where := "WHERE case_id = $1"
	if !includeInternal {
		where += " AND visibility = 'USER_VISIBLE'"
	}
	query := fmt.Sprintf(`
		SELECT cm.id, cm.case_id, cm.sender_type, cm.sender_id,
		       COALESCE(au.first_name || ' ' || au.last_name, u.first_name || ' ' || u.last_name, 'System'),
		       cm.visibility, cm.message, cm.created_at
		FROM case_messages cm
		LEFT JOIN admin_users au ON cm.sender_id = au.id AND cm.sender_type = 'ADMIN'
		LEFT JOIN users u ON cm.sender_id = u.id AND cm.sender_type IN ('BUYER', 'SELLER')
		%s
		ORDER BY cm.created_at ASC
	`, where)

	rows, err := r.db.Query(query, caseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	msgs := make([]models.AdminCaseMessage, 0)
	for rows.Next() {
		var msg models.AdminCaseMessage
		if err := rows.Scan(&msg.ID, &msg.CaseID, &msg.SenderType, &msg.SenderID, &msg.SenderName, &msg.Visibility, &msg.Message, &msg.CreatedAt); err == nil {
			msgs = append(msgs, msg)
		}
	}
	return msgs, nil
}

// Phase 3E - Risk & Fraud Events
func (r *AdminFinanceRepository) ListRiskEvents(page, limit int, status string) ([]models.AdminRiskEvent, int, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if status != "" {
		where += fmt.Sprintf(" AND re.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM risk_events re %s`, where)
	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	query := fmt.Sprintf(`
		SELECT 
			re.id, re.event_type, re.severity, re.target_type, re.target_id,
			COALESCE(u.first_name || ' ' || u.last_name, b.name, 'Target') as target_name,
			re.rule_code, COALESCE(re.details, '{}'::jsonb), re.status,
			re.created_at, re.resolved_at, re.resolved_by
		FROM risk_events re
		LEFT JOIN users u ON re.target_id = u.id AND re.target_type IN ('USER', 'SELLER')
		LEFT JOIN businesses b ON re.target_id = b.id AND re.target_type = 'BUSINESS'
		%s
		ORDER BY re.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	events := make([]models.AdminRiskEvent, 0)
	for rows.Next() {
		var event models.AdminRiskEvent
		if err := rows.Scan(
			&event.ID, &event.EventType, &event.Severity, &event.TargetType, &event.TargetID,
			&event.TargetName, &event.RuleCode, &event.Details, &event.Status,
			&event.CreatedAt, &event.ResolvedAt, &event.ResolvedBy,
		); err == nil {
			events = append(events, event)
		}
	}
	return events, total, nil
}

func (r *AdminFinanceRepository) ResolveRiskEvent(eventID, adminID uuid.UUID, status, reason string) error {
	now := time.Now()
	_, err := r.db.Exec(`
		UPDATE risk_events 
		SET status = $1, resolved_at = $2, resolved_by = $3 
		WHERE id = $4
	`, status, now, adminID, eventID)
	return err
}
