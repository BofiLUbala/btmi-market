package models

import (
	"time"

	"github.com/google/uuid"
)

type ReviewStatus string

const (
	ReviewStatusActive    ReviewStatus = "ACTIVE"
	ReviewStatusWithdrawn ReviewStatus = "WITHDRAWN"
	ReviewStatusHidden    ReviewStatus = "HIDDEN"
)

type SellerReview struct {
	ID               uuid.UUID  `json:"id" db:"id"`
	OrderID          uuid.UUID  `json:"order_id" db:"order_id"`
	BuyerProfileID   uuid.UUID  `json:"buyer_profile_id" db:"buyer_profile_id"`
	BusinessID       uuid.UUID  `json:"business_id" db:"business_id"`
	ShopID           uuid.UUID  `json:"shop_id" db:"shop_id"`
	Rating           int        `json:"rating" db:"rating"`
	Comment          string     `json:"comment" db:"comment"`
	VerifiedPurchase bool       `json:"verified_purchase" db:"verified_purchase"`
	Status           string     `json:"status" db:"status"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`
}

type ReviewHistory struct {
	ID         uuid.UUID  `json:"id" db:"id"`
	ReviewID   uuid.UUID  `json:"review_id" db:"review_id"`
	OldRating  int        `json:"old_rating" db:"old_rating"`
	NewRating  int        `json:"new_rating" db:"new_rating"`
	OldComment string     `json:"old_comment" db:"old_comment"`
	NewComment string     `json:"new_comment" db:"new_comment"`
	ChangedBy  uuid.UUID  `json:"changed_by" db:"changed_by"`
	ChangedAt  time.Time  `json:"changed_at" db:"changed_at"`
}

type ShopReviewAggregate struct {
	ShopID        uuid.UUID  `json:"shop_id" db:"shop_id"`
	AverageRating float64    `json:"average_rating" db:"average_rating"`
	TotalReviews  int        `json:"total_reviews" db:"total_reviews"`
	Rating1Count  int        `json:"rating_1_count" db:"rating_1_count"`
	Rating2Count  int        `json:"rating_2_count" db:"rating_2_count"`
	Rating3Count  int        `json:"rating_3_count" db:"rating_3_count"`
	Rating4Count  int        `json:"rating_4_count" db:"rating_4_count"`
	Rating5Count  int        `json:"rating_5_count" db:"rating_5_count"`
	LastReviewAt  *time.Time `json:"last_review_at" db:"last_review_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
}

// Request/Response types

type CreateReviewRequest struct {
	Rating  int    `json:"rating" binding:"required"`
	Comment string `json:"comment"`
}

type UpdateReviewRequest struct {
	Rating  int    `json:"rating" binding:"required"`
	Comment string `json:"comment"`
}

type ReviewEligibilityResponse struct {
	Eligible        bool   `json:"eligible"`
	Reason          string `json:"reason"`
	ExistingReviewID *uuid.UUID `json:"existing_review_id,omitempty"`
}

type ReviewResponse struct {
	ID               uuid.UUID  `json:"id"`
	OrderID          uuid.UUID  `json:"order_id"`
	BuyerProfileID   uuid.UUID  `json:"buyer_profile_id"`
	BusinessID       uuid.UUID  `json:"business_id"`
	ShopID           uuid.UUID  `json:"shop_id"`
	Rating           int        `json:"rating"`
	Comment          string     `json:"comment"`
	VerifiedPurchase bool       `json:"verified_purchase"`
	Status           string     `json:"status"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type PublicReviewResponse struct {
	ID               uuid.UUID  `json:"id"`
	Rating           int        `json:"rating"`
	Comment          string     `json:"comment"`
	VerifiedPurchase bool       `json:"verified_purchase"`
	BuyerDisplayName string     `json:"buyer_display_name"`
	CreatedAt        time.Time  `json:"created_at"`
}

type ShopReviewsResponse struct {
	ShopID   uuid.UUID                `json:"shop_id"`
	Summary  ShopReviewAggregate      `json:"summary"`
	Reviews  []PublicReviewResponse   `json:"reviews"`
	Pagination PaginationInfo         `json:"pagination"`
}

type BuyerReviewsResponse struct {
	Reviews    []ReviewResponse `json:"reviews"`
	Pagination PaginationInfo  `json:"pagination"`
}

type ReviewEligibilityInOrder struct {
	ReviewEligible bool    `json:"review_eligible"`
	Reviewed       bool    `json:"reviewed"`
	ReviewID       *uuid.UUID `json:"review_id,omitempty"`
}
