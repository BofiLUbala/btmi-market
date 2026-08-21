package models

import (
	"time"

	"github.com/google/uuid"
)

type VerifiedTransactionStatus string

const (
	VerifiedTransactionStatusPending  VerifiedTransactionStatus = "PENDING"
	VerifiedTransactionStatusVerified VerifiedTransactionStatus = "VERIFIED"
	VerifiedTransactionStatusRefunded VerifiedTransactionStatus = "REFUNDED"
)

type VerifiedTransaction struct {
	ID                 uuid.UUID                  `json:"id" db:"id"`
	OrderID            uuid.UUID                  `json:"order_id" db:"order_id"`
	BusinessID         uuid.UUID                  `json:"business_id" db:"business_id"`
	BuyerProfileID     uuid.UUID                  `json:"buyer_profile_id" db:"buyer_profile_id"`
	ShopID             uuid.UUID                  `json:"shop_id" db:"shop_id"`
	Amount             float64                    `json:"amount" db:"amount"`
	Currency           string                     `json:"currency" db:"currency"`
	Status             VerifiedTransactionStatus  `json:"status" db:"status"`
	VerifiedAt         *time.Time                 `json:"verified_at" db:"verified_at"`
	RefundedAt         *time.Time                 `json:"refunded_at" db:"refunded_at"`
	PointsAwardedSeller bool                      `json:"points_awarded_seller" db:"points_awarded_seller"`
	PointsAwardedBuyer  bool                      `json:"points_awarded_buyer" db:"points_awarded_buyer"`
	CreatedAt          time.Time                  `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time                  `json:"updated_at" db:"updated_at"`
}

type VerifiedTransactionResponse struct {
	ID                 uuid.UUID `json:"id"`
	OrderID            uuid.UUID `json:"order_id"`
	BusinessID         uuid.UUID `json:"business_id"`
	BuyerProfileID     uuid.UUID `json:"buyer_profile_id"`
	ShopID             uuid.UUID `json:"shop_id"`
	ShopName           string    `json:"shop_name"`
	BusinessName       string    `json:"business_name"`
	Amount             float64   `json:"amount"`
	Currency           string    `json:"currency"`
	Status             string    `json:"status"`
	VerifiedAt         *time.Time `json:"verified_at"`
	RefundedAt         *time.Time `json:"refunded_at"`
	CreatedAt          time.Time `json:"created_at"`
}
