package models

import (
	"time"

	"github.com/google/uuid"
)

type BuyerProfileStatus string

const (
	BuyerProfileStatusActive   BuyerProfileStatus = "ACTIVE"
	BuyerProfileStatusInactive BuyerProfileStatus = "INACTIVE"
	BuyerProfileStatusBlocked  BuyerProfileStatus = "BLOCKED"
)

type BuyerProfile struct {
	ID        uuid.UUID          `json:"id" db:"id"`
	UserID    uuid.UUID          `json:"user_id" db:"user_id"`
	FirstName string             `json:"first_name" db:"first_name"`
	LastName  string             `json:"last_name" db:"last_name"`
	Phone     string             `json:"phone" db:"phone"`
	Email     string             `json:"email" db:"email"`
	City      string             `json:"city" db:"city"`
	Commune   string             `json:"commune" db:"commune"`
	Status    BuyerProfileStatus `json:"status" db:"status"`
	CreatedAt time.Time          `json:"created_at" db:"created_at"`
	UpdatedAt time.Time          `json:"updated_at" db:"updated_at"`
}

type CreateBuyerProfileRequest struct {
	FirstName string `json:"first_name" binding:"required"`
	LastName  string `json:"last_name" binding:"required"`
	Phone     string `json:"phone" binding:"required"`
	Email     string `json:"email" binding:"required,email"`
	City      string `json:"city"`
	Commune   string `json:"commune"`
}

type UpdateBuyerProfileRequest struct {
	FirstName *string `json:"first_name"`
	LastName  *string `json:"last_name"`
	Phone     *string `json:"phone"`
	Email     *string `json:"email"`
	City      *string `json:"city"`
	Commune   *string `json:"commune"`
}

type BuyerProfileResponse struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	Phone     string    `json:"phone"`
	Email     string    `json:"email"`
	City      string    `json:"city"`
	Commune   string    `json:"commune"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type BuyerProfileViewResponse struct {
	Profile            BuyerProfileResponse `json:"profile"`
	CurrentPoints      int                  `json:"current_points"`
	LifetimePoints     int                  `json:"lifetime_points"`
	CurrentLevel       string               `json:"current_level"`
	ProgressToNext     float64              `json:"progress_to_next_level_percent"`
	VerifiedPurchases  int                  `json:"verified_purchases"`
	PurchaseHistory    int                  `json:"purchase_history"`
	AvailableBenefits  []LevelBenefitInfo   `json:"available_benefits"`
}

type LevelBenefitInfo struct {
	BenefitType  string  `json:"benefit_type"`
	BenefitValue float64 `json:"benefit_value"`
}
