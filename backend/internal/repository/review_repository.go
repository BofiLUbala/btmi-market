package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type ReviewRepository struct {
	db *database.DB
}

func NewReviewRepository(db *database.DB) *ReviewRepository {
	return &ReviewRepository{db: db}
}

// GetOrderByIDForReview gets order with shop/business info for review eligibility.
func (r *ReviewRepository) GetOrderByIDForReview(orderID uuid.UUID) (*models.Order, error) {
	query := `
		SELECT id, shop_id, business_id, status, buyer_profile_id
		FROM orders WHERE id = $1
	`
	var order models.Order
	var status string
	err := r.db.QueryRow(query, orderID).Scan(
		&order.ID, &order.ShopID, &order.BusinessID, &status, &order.BuyerProfileID,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("ORDER_NOT_FOUND")
	}
	if err != nil {
		return nil, err
	}
	order.Status = models.OrderStatus(status)
	return &order, nil
}

// GetPaymentStatus gets the payment status for an order.
func (r *ReviewRepository) GetPaymentStatus(orderID uuid.UUID) (string, error) {
	query := `SELECT status FROM buyer_payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`
	var status string
	err := r.db.QueryRow(query, orderID).Scan(&status)
	if err == sql.ErrNoRows {
		return "NONE", nil
	}
	return status, err
}

// GetReviewByOrderID checks if a review already exists for an order.
func (r *ReviewRepository) GetReviewByOrderID(orderID uuid.UUID) (*models.SellerReview, error) {
	query := `
		SELECT id, order_id, buyer_profile_id, business_id, shop_id, product_id, order_line_id, variant_id, rating, comment,
		       verified_purchase, status, created_at, updated_at
		FROM seller_reviews WHERE order_id = $1 AND order_line_id IS NULL
	`
	review := &models.SellerReview{}
	err := r.db.QueryRow(query, orderID).Scan(
		&review.ID, &review.OrderID, &review.BuyerProfileID, &review.BusinessID,
		&review.ShopID, &review.ProductID, &review.OrderLineID, &review.VariantID, &review.Rating, &review.Comment,
		&review.VerifiedPurchase, &review.Status, &review.CreatedAt, &review.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return review, nil
}

// GetReviewByID gets a review by its ID.
func (r *ReviewRepository) GetReviewByID(reviewID uuid.UUID) (*models.SellerReview, error) {
	query := `
		SELECT id, order_id, buyer_profile_id, business_id, shop_id, product_id, order_line_id, variant_id, rating, comment,
		       verified_purchase, status, created_at, updated_at
		FROM seller_reviews WHERE id = $1
	`
	review := &models.SellerReview{}
	err := r.db.QueryRow(query, reviewID).Scan(
		&review.ID, &review.OrderID, &review.BuyerProfileID, &review.BusinessID,
		&review.ShopID, &review.ProductID, &review.OrderLineID, &review.VariantID, &review.Rating, &review.Comment,
		&review.VerifiedPurchase, &review.Status, &review.CreatedAt, &review.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("REVIEW_NOT_FOUND")
	}
	if err != nil {
		return nil, err
	}
	return review, nil
}

// CreateReview creates a new verified purchase review.
func (r *ReviewRepository) CreateReview(review *models.SellerReview) error {
	query := `
		INSERT INTO seller_reviews (id, order_id, buyer_profile_id, business_id, shop_id, product_id, order_line_id, variant_id, rating, comment, verified_purchase, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING created_at, updated_at
	`
	if review.ID == uuid.Nil {
		review.ID = uuid.New()
	}
	review.VerifiedPurchase = true
	review.Status = string(models.ReviewStatusActive)

	return r.db.QueryRow(query,
		review.ID, review.OrderID, review.BuyerProfileID, review.BusinessID,
		review.ShopID, review.ProductID, review.OrderLineID, review.VariantID, review.Rating, review.Comment, review.VerifiedPurchase, review.Status,
	).Scan(&review.CreatedAt, &review.UpdatedAt)
}

func (r *ReviewRepository) CreateServiceReview(review *models.SellerReview) error {
	query := `
		INSERT INTO seller_reviews (id, order_id, buyer_profile_id, business_id, shop_id,
			rating, comment, verified_purchase, status, delivery_rating, service_rating, order_experience_rating)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		RETURNING created_at, updated_at
	`
	if review.ID == uuid.Nil {
		review.ID = uuid.New()
	}
	review.VerifiedPurchase = true
	review.Status = string(models.ReviewStatusActive)
	return r.db.QueryRow(query, review.ID, review.OrderID, review.BuyerProfileID,
		review.BusinessID, review.ShopID, review.Rating, review.Comment,
		review.VerifiedPurchase, review.Status, review.DeliveryRating,
		review.ServiceRating, review.ExperienceRating).Scan(&review.CreatedAt, &review.UpdatedAt)
}

// UpdateReview updates rating and comment, returns old values for history.
func (r *ReviewRepository) UpdateReview(reviewID uuid.UUID, rating int, comment string, userID uuid.UUID) (*models.ReviewHistory, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Get current values.
	var oldRating int
	var oldComment string
	err = tx.QueryRow("SELECT rating, comment FROM seller_reviews WHERE id = $1 FOR UPDATE", reviewID).Scan(&oldRating, &oldComment)
	if err != nil {
		return nil, fmt.Errorf("REVIEW_NOT_FOUND")
	}

	// Update review.
	_, err = tx.Exec(
		`UPDATE seller_reviews SET rating = $2, comment = $3, updated_at = NOW() WHERE id = $1`,
		reviewID, rating, comment,
	)
	if err != nil {
		return nil, err
	}

	// Insert history.
	history := &models.ReviewHistory{
		ReviewID:   reviewID,
		OldRating:  oldRating,
		NewRating:  rating,
		OldComment: oldComment,
		NewComment: comment,
		ChangedBy:  userID,
		ChangedAt:  time.Now(),
	}
	history.ID = uuid.New()

	_, err = tx.Exec(
		`INSERT INTO review_history (id, review_id, old_rating, new_rating, old_comment, new_comment, changed_by, changed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		history.ID, history.ReviewID, history.OldRating, history.NewRating,
		history.OldComment, history.NewComment, history.ChangedBy, history.ChangedAt,
	)
	if err != nil {
		return nil, err
	}

	return history, tx.Commit()
}

// WithdrawReview soft-deletes a review.
func (r *ReviewRepository) WithdrawReview(reviewID uuid.UUID) error {
	result, err := r.db.Exec(
		`UPDATE seller_reviews SET status = $2, updated_at = NOW() WHERE id = $1`,
		reviewID, models.ReviewStatusWithdrawn,
	)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("REVIEW_NOT_FOUND")
	}
	return nil
}

// GetReviewsByShopID gets public reviews for a shop.
func (r *ReviewRepository) GetReviewsByShopID(shopID uuid.UUID, reviewType, sortBy string, ratingFilter *int, offset, limit int) ([]models.PublicReviewResponse, int, error) {
	var whereClause string
	if reviewType == "product" {
		whereClause = "WHERE sr.shop_id = $1 AND sr.status = 'ACTIVE' AND sr.order_line_id IS NOT NULL"
	} else if reviewType == "all" {
		whereClause = "WHERE sr.shop_id = $1 AND sr.status = 'ACTIVE'"
	} else {
		whereClause = "WHERE sr.shop_id = $1 AND sr.status = 'ACTIVE' AND sr.order_line_id IS NULL"
	}
	args := []interface{}{shopID}
	argIdx := 2

	if ratingFilter != nil {
		whereClause += fmt.Sprintf(" AND sr.rating = $%d", argIdx)
		args = append(args, *ratingFilter)
		argIdx++
	}

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM seller_reviews sr %s", whereClause)
	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	orderClause := "ORDER BY sr.created_at DESC"
	switch sortBy {
	case "oldest":
		orderClause = "ORDER BY sr.created_at ASC"
	case "highest_rating":
		orderClause = "ORDER BY sr.rating DESC, sr.created_at DESC"
	case "lowest_rating":
		orderClause = "ORDER BY sr.rating ASC, sr.created_at DESC"
	}

	query := fmt.Sprintf(`
		SELECT sr.id, sr.rating, sr.comment, sr.verified_purchase,
		       COALESCE(bp.first_name, '') || ' ' || COALESCE(bp.last_name, '') as buyer_name,
		       sr.created_at, sr.delivery_rating, sr.service_rating, sr.order_experience_rating,
		       sr.product_id, COALESCE(p.name, ''), COALESCE(pv.name, ''), COALESCE(pi.url, '')
		FROM seller_reviews sr
		JOIN buyer_profiles bp ON sr.buyer_profile_id = bp.id
		LEFT JOIN order_lines ol ON sr.order_line_id = ol.id
		LEFT JOIN products p ON ol.product_id = p.id
		LEFT JOIN product_variants pv ON ol.variant_id = pv.id
		LEFT JOIN LATERAL (
			SELECT url FROM product_images
			WHERE product_id = ol.product_id
			ORDER BY is_primary DESC, sort_order ASC
			LIMIT 1
		) pi ON true
		%s
		%s
		LIMIT $%d OFFSET $%d
	`, whereClause, orderClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var reviews []models.PublicReviewResponse
	for rows.Next() {
		var rev models.PublicReviewResponse
		if err := rows.Scan(&rev.ID, &rev.Rating, &rev.Comment, &rev.VerifiedPurchase, &rev.BuyerDisplayName, &rev.CreatedAt,
			&rev.DeliveryRating, &rev.ServiceRating, &rev.ExperienceRating,
			&rev.ProductID, &rev.ProductName, &rev.VariantName, &rev.ImageURL); err != nil {
			return nil, 0, err
		}
		// Trim display name.
		name := rev.BuyerDisplayName
		if len(name) > 20 {
			name = name[:20]
		}
		rev.BuyerDisplayName = name
		reviews = append(reviews, rev)
	}

	return reviews, total, rows.Err()
}

// GetReviewsByBuyerProfileID gets all reviews by a buyer.
func (r *ReviewRepository) GetReviewsByBuyerProfileID(buyerProfileID uuid.UUID, offset, limit int) ([]models.ReviewResponse, int, error) {
	countQuery := `SELECT COUNT(*) FROM seller_reviews WHERE buyer_profile_id = $1`
	var total int
	if err := r.db.QueryRow(countQuery, buyerProfileID).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT sr.id, sr.order_id, sr.buyer_profile_id, sr.business_id, sr.shop_id,
		       sr.product_id, sr.order_line_id, sr.variant_id, sr.delivery_rating, sr.service_rating,
		       sr.order_experience_rating, sr.rating, sr.comment, sr.verified_purchase, sr.status, sr.created_at, sr.updated_at
		FROM seller_reviews sr
		WHERE sr.buyer_profile_id = $1
		ORDER BY sr.created_at DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := r.db.Query(query, buyerProfileID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var reviews []models.ReviewResponse
	for rows.Next() {
		var rev models.ReviewResponse
		if err := rows.Scan(
			&rev.ID, &rev.OrderID, &rev.BuyerProfileID, &rev.BusinessID, &rev.ShopID,
			&rev.ProductID, &rev.OrderLineID, &rev.VariantID, &rev.DeliveryRating, &rev.ServiceRating, &rev.ExperienceRating,
			&rev.Rating, &rev.Comment, &rev.VerifiedPurchase, &rev.Status,
			&rev.CreatedAt, &rev.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		reviews = append(reviews, rev)
	}

	return reviews, total, rows.Err()
}

// GetShopReviewAggregate gets cached aggregate for a shop.
func (r *ReviewRepository) GetShopReviewAggregate(shopID uuid.UUID) (*models.ShopReviewAggregate, error) {
	query := `
		SELECT shop_id, average_rating, total_reviews,
		       rating_1_count, rating_2_count, rating_3_count, rating_4_count, rating_5_count,
		       last_review_at, updated_at
		FROM shop_review_aggregates WHERE shop_id = $1
	`
	agg := &models.ShopReviewAggregate{}
	err := r.db.QueryRow(query, shopID).Scan(
		&agg.ShopID, &agg.AverageRating, &agg.TotalReviews,
		&agg.Rating1Count, &agg.Rating2Count, &agg.Rating3Count, &agg.Rating4Count, &agg.Rating5Count,
		&agg.LastReviewAt, &agg.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return &models.ShopReviewAggregate{ShopID: shopID}, nil
	}
	if err != nil {
		return nil, err
	}
	return agg, nil
}

// RecalculateShopAggregate recalculates aggregates from PostgreSQL source of truth.
func (r *ReviewRepository) RecalculateShopAggregate(shopID uuid.UUID) (*models.ShopReviewAggregate, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	query := `
		SELECT COALESCE(AVG(rating), 0), COUNT(*),
		       COUNT(*) FILTER (WHERE rating = 1),
		       COUNT(*) FILTER (WHERE rating = 2),
		       COUNT(*) FILTER (WHERE rating = 3),
		       COUNT(*) FILTER (WHERE rating = 4),
		       COUNT(*) FILTER (WHERE rating = 5),
		       MAX(created_at)
		FROM seller_reviews
		WHERE shop_id = $1 AND status = 'ACTIVE' AND order_line_id IS NULL
	`
	agg := &models.ShopReviewAggregate{ShopID: shopID}
	err = tx.QueryRow(query, shopID).Scan(
		&agg.AverageRating, &agg.TotalReviews,
		&agg.Rating1Count, &agg.Rating2Count, &agg.Rating3Count, &agg.Rating4Count, &agg.Rating5Count,
		&agg.LastReviewAt,
	)
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec(`
		INSERT INTO shop_review_aggregates (shop_id, average_rating, total_reviews,
			rating_1_count, rating_2_count, rating_3_count, rating_4_count, rating_5_count,
			last_review_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
		ON CONFLICT (shop_id) DO UPDATE SET
			average_rating = EXCLUDED.average_rating,
			total_reviews = EXCLUDED.total_reviews,
			rating_1_count = EXCLUDED.rating_1_count,
			rating_2_count = EXCLUDED.rating_2_count,
			rating_3_count = EXCLUDED.rating_3_count,
			rating_4_count = EXCLUDED.rating_4_count,
			rating_5_count = EXCLUDED.rating_5_count,
			last_review_at = EXCLUDED.last_review_at,
			updated_at = NOW()
	`, agg.ShopID, agg.AverageRating, agg.TotalReviews,
		agg.Rating1Count, agg.Rating2Count, agg.Rating3Count, agg.Rating4Count, agg.Rating5Count,
		agg.LastReviewAt,
	)
	if err != nil {
		return nil, err
	}

	agg.UpdatedAt = time.Now()
	return agg, tx.Commit()
}

// GetReviewHistory gets edit history for a review.
func (r *ReviewRepository) GetReviewHistory(reviewID uuid.UUID) ([]models.ReviewHistory, error) {
	query := `
		SELECT id, review_id, old_rating, new_rating, old_comment, new_comment, changed_by, changed_at
		FROM review_history WHERE review_id = $1 ORDER BY changed_at ASC
	`
	rows, err := r.db.Query(query, reviewID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []models.ReviewHistory
	for rows.Next() {
		var h models.ReviewHistory
		if err := rows.Scan(&h.ID, &h.ReviewID, &h.OldRating, &h.NewRating, &h.OldComment, &h.NewComment, &h.ChangedBy, &h.ChangedAt); err != nil {
			return nil, err
		}
		history = append(history, h)
	}
	return history, rows.Err()
}

// GetBusinessIDForShop gets the business ID for a shop.
func (r *ReviewRepository) GetBusinessIDForShop(shopID uuid.UUID) (uuid.UUID, error) {
	query := `SELECT business_id FROM shops WHERE id = $1`
	var businessID uuid.UUID
	err := r.db.QueryRow(query, shopID).Scan(&businessID)
	if err != nil {
		return uuid.Nil, err
	}
	return businessID, nil
}
