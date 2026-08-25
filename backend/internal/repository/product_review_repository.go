package repository

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

func (r *ReviewRepository) GetOrderLineForReview(orderID, lineID uuid.UUID) (*models.OrderLine, error) {
	var line models.OrderLine
	err := r.db.QueryRow(`SELECT id, order_id, product_id, variant_id, quantity, unit_price, created_at
		FROM order_lines WHERE id=$1 AND order_id=$2`, lineID, orderID).Scan(
		&line.ID, &line.OrderID, &line.ProductID, &line.VariantID, &line.Quantity, &line.UnitPrice, &line.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("ORDER_LINE_NOT_FOUND")
	}
	return &line, err
}

func (r *ReviewRepository) GetReviewByOrderLineID(lineID uuid.UUID) (*models.SellerReview, error) {
	var review models.SellerReview
	err := r.db.QueryRow(`SELECT id, order_id, buyer_profile_id, business_id, shop_id, product_id, order_line_id, variant_id,
		rating, comment, verified_purchase, status, created_at, updated_at FROM seller_reviews WHERE order_line_id=$1`, lineID).Scan(
		&review.ID, &review.OrderID, &review.BuyerProfileID, &review.BusinessID, &review.ShopID, &review.ProductID,
		&review.OrderLineID, &review.VariantID, &review.Rating, &review.Comment, &review.VerifiedPurchase,
		&review.Status, &review.CreatedAt, &review.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &review, err
}

func (r *ReviewRepository) GetProductReviews(productID uuid.UUID, viewerID *uuid.UUID, sortBy string, rating *int, offset, limit int) ([]models.PublicReviewResponse, models.ProductReviewSummary, int, error) {
	where := "sr.product_id=$1 AND sr.status='ACTIVE'"
	args := []any{productID}
	if rating != nil {
		args = append(args, *rating)
		where += fmt.Sprintf(" AND sr.rating=$%d", len(args))
	}
	var summary models.ProductReviewSummary
	err := r.db.QueryRow(`SELECT COALESCE(AVG(rating),0), COUNT(*), COUNT(*) FILTER(WHERE rating=1), COUNT(*) FILTER(WHERE rating=2), COUNT(*) FILTER(WHERE rating=3), COUNT(*) FILTER(WHERE rating=4), COUNT(*) FILTER(WHERE rating=5) FROM seller_reviews WHERE product_id=$1 AND status='ACTIVE'`, productID).Scan(
		&summary.AverageRating, &summary.TotalReviews, &summary.Rating1Count, &summary.Rating2Count, &summary.Rating3Count, &summary.Rating4Count, &summary.Rating5Count)
	if err != nil {
		return nil, summary, 0, err
	}
	var total int
	if err = r.db.QueryRow("SELECT COUNT(*) FROM seller_reviews sr WHERE "+where, args...).Scan(&total); err != nil {
		return nil, summary, 0, err
	}
	order := "sr.created_at DESC"
	if sortBy == "helpful" {
		order = "helpful_count DESC, sr.created_at DESC"
	} else if sortBy == "highest_rating" {
		order = "sr.rating DESC, sr.created_at DESC"
	} else if sortBy == "lowest_rating" {
		order = "sr.rating ASC, sr.created_at DESC"
	}
	var viewer any
	if viewerID != nil {
		viewer = *viewerID
	}
	args = append(args, viewer, limit, offset)
	n := len(args)
	q := fmt.Sprintf(`SELECT sr.id,sr.rating,sr.comment,sr.verified_purchase,trim(concat(bp.first_name,' ',bp.last_name)),sr.created_at,
		(SELECT COUNT(*) FROM review_helpful_votes hv WHERE hv.review_id=sr.id) helpful_count,
		EXISTS(SELECT 1 FROM review_helpful_votes hv WHERE hv.review_id=sr.id AND hv.user_id=$%d)
		FROM seller_reviews sr JOIN buyer_profiles bp ON bp.id=sr.buyer_profile_id WHERE %s ORDER BY %s LIMIT $%d OFFSET $%d`, n-2, where, order, n-1, n)
	rows, err := r.db.Query(q, args...)
	if err != nil {
		return nil, summary, 0, err
	}
	defer rows.Close()
	reviews := []models.PublicReviewResponse{}
	for rows.Next() {
		var v models.PublicReviewResponse
		if err = rows.Scan(&v.ID, &v.Rating, &v.Comment, &v.VerifiedPurchase, &v.BuyerDisplayName, &v.CreatedAt, &v.HelpfulCount, &v.HelpfulByMe); err != nil {
			return nil, summary, 0, err
		}
		v.Replies, _ = r.GetReviewReplies(v.ID)
		reviews = append(reviews, v)
	}
	return reviews, summary, total, rows.Err()
}

func (r *ReviewRepository) SetHelpful(reviewID, userID uuid.UUID, helpful bool) (int, error) {
	if helpful {
		_, err := r.db.Exec(`INSERT INTO review_helpful_votes(review_id,user_id) SELECT $1,$2 WHERE EXISTS(SELECT 1 FROM seller_reviews WHERE id=$1 AND status='ACTIVE') ON CONFLICT DO NOTHING`, reviewID, userID)
		if err != nil {
			return 0, err
		}
	} else {
		if _, err := r.db.Exec(`DELETE FROM review_helpful_votes WHERE review_id=$1 AND user_id=$2`, reviewID, userID); err != nil {
			return 0, err
		}
	}
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM review_helpful_votes WHERE review_id=$1`, reviewID).Scan(&count)
	return count, err
}

func (r *ReviewRepository) CreateReply(reviewID, userID uuid.UUID, body string) (*models.ReviewReplyResponse, error) {
	var out models.ReviewReplyResponse
	body = strings.TrimSpace(body)
	err := r.db.QueryRow(`INSERT INTO review_replies(review_id,user_id,body) SELECT $1,$2,$3 WHERE EXISTS(SELECT 1 FROM seller_reviews WHERE id=$1 AND status='ACTIVE') RETURNING id,review_id,body,created_at`, reviewID, userID, body).Scan(&out.ID, &out.ReviewID, &out.Body, &out.CreatedAt)
	if err != nil {
		return nil, err
	}
	_ = r.db.QueryRow(`SELECT trim(concat(first_name,' ',last_name)) FROM users WHERE id=$1`, userID).Scan(&out.AuthorDisplayName)
	return &out, nil
}

func (r *ReviewRepository) GetReviewReplies(reviewID uuid.UUID) ([]models.ReviewReplyResponse, error) {
	rows, err := r.db.Query(`SELECT rr.id,rr.review_id,trim(concat(u.first_name,' ',u.last_name)),rr.body,rr.created_at FROM review_replies rr JOIN users u ON u.id=rr.user_id WHERE rr.review_id=$1 ORDER BY rr.created_at`, reviewID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.ReviewReplyResponse{}
	for rows.Next() {
		var v models.ReviewReplyResponse
		if err = rows.Scan(&v.ID, &v.ReviewID, &v.AuthorDisplayName, &v.Body, &v.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
