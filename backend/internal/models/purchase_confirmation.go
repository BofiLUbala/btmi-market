package models

import (
	"time"

	"github.com/google/uuid"
)

type PurchaseConfirmation struct {
	ID              uuid.UUID `json:"id" db:"id"`
	OrderID         uuid.UUID `json:"order_id" db:"order_id"`
	BuyerProfileID  uuid.UUID `json:"buyer_profile_id" db:"buyer_profile_id"`
	CashPaymentID   *uuid.UUID `json:"cash_payment_id" db:"cash_payment_id"`
	ConfirmedAt     time.Time `json:"confirmed_at" db:"confirmed_at"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
}

type PendingPurchaseResponse struct {
	OrderID         uuid.UUID `json:"order_id"`
	ShopID          uuid.UUID `json:"shop_id"`
	ShopName        string    `json:"shop_name"`
	BusinessName    string    `json:"business_name"`
	Amount          float64   `json:"amount"`
	Currency        string    `json:"currency"`
	EmployeeName    string    `json:"employee_name"`
	CreatedAt       time.Time `json:"created_at"`
}

type ConfirmPurchaseRequest struct {
	OrderID string `json:"order_id" binding:"required"`
}

type SellerTrust struct {
	ID                       uuid.UUID `json:"id" db:"id"`
	BusinessID               uuid.UUID `json:"business_id" db:"business_id"`
	TrustStatus              string    `json:"trust_status" db:"trust_status"`
	VerifiedSalesCount       int       `json:"verified_sales_count" db:"verified_sales_count"`
	OrderCompletionRate      float64   `json:"order_completion_rate" db:"order_completion_rate"`
	CancellationRate         float64   `json:"cancellation_rate" db:"cancellation_rate"`
	PurchaseConfirmationRate float64   `json:"purchase_confirmation_rate" db:"purchase_confirmation_rate"`
	StockReliabilityRate     float64   `json:"stock_reliability_rate" db:"stock_reliability_rate"`
	LastCalculatedAt         *time.Time `json:"last_calculated_at" db:"last_calculated_at"`
	CreatedAt                time.Time `json:"created_at" db:"created_at"`
	UpdatedAt                time.Time `json:"updated_at" db:"updated_at"`
}
