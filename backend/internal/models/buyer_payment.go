package models

import (
	"time"

	"github.com/google/uuid"
)

type BuyerPaymentStatus string

const (
	BuyerPaymentStatusPending   BuyerPaymentStatus = "PENDING"
	BuyerPaymentStatusConfirmed BuyerPaymentStatus = "CONFIRMED"
	BuyerPaymentStatusVerified  BuyerPaymentStatus = "VERIFIED"
	BuyerPaymentStatusCancelled BuyerPaymentStatus = "CANCELLED"
)

const (
	BuyerPaymentMethodCash = "CASH"
)

// BuyerPayment snapshots the Order + Delivery totals so the client never
// needs to send any amount. cash_due = products_final_total + delivery_fee_final.
type BuyerPayment struct {
	ID                     uuid.UUID         `json:"id" db:"id"`
	OrderID                uuid.UUID         `json:"order_id" db:"order_id"`
	BusinessID             uuid.UUID         `json:"business_id" db:"business_id"`
	ShopID                 uuid.UUID         `json:"shop_id" db:"shop_id"`
	BuyerProfileID         uuid.UUID         `json:"buyer_profile_id" db:"buyer_profile_id"`
	PaymentMethod          string            `json:"payment_method" db:"payment_method"`
	Currency               string            `json:"currency" db:"currency"`

	ProductsBaseTotal      float64           `json:"products_base_total" db:"products_base_total"`
	ProductsPointsUsed     int               `json:"products_points_used" db:"products_points_used"`
	ProductsPointsDiscount float64           `json:"products_points_discount" db:"products_points_discount"`
	ProductsFinalTotal     float64           `json:"products_final_total" db:"products_final_total"`

	DeliveryFeeBase        float64           `json:"delivery_fee_base" db:"delivery_fee_base"`
	DeliveryPointsUsed     int               `json:"delivery_points_used" db:"delivery_points_used"`
	DeliveryPointsDiscount float64           `json:"delivery_points_discount" db:"delivery_points_discount"`
	DeliveryFeeFinal       float64           `json:"delivery_fee_final" db:"delivery_fee_final"`

	CashDue                float64           `json:"cash_due" db:"cash_due"`

	BuyerConfirmed         bool              `json:"buyer_confirmed" db:"buyer_confirmed"`
	BuyerConfirmedAt       *time.Time        `json:"buyer_confirmed_at" db:"buyer_confirmed_at"`
	SellerConfirmed        bool              `json:"seller_confirmed" db:"seller_confirmed"`
	SellerConfirmedBy      *uuid.UUID        `json:"seller_confirmed_by" db:"seller_confirmed_by"`
	SellerConfirmedAt      *time.Time        `json:"seller_confirmed_at" db:"seller_confirmed_at"`

	Status                 BuyerPaymentStatus `json:"status" db:"status"`
	VerifiedAt             *time.Time        `json:"verified_at" db:"verified_at"`

	CreatedAt              time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt              time.Time         `json:"updated_at" db:"updated_at"`
}

type BuyerPaymentResponse struct {
	ID                     uuid.UUID `json:"id"`
	OrderID                uuid.UUID `json:"order_id"`
	ShopID                 uuid.UUID `json:"shop_id"`
	ShopName               string    `json:"shop_name,omitempty"`
	BuyerProfileID         uuid.UUID `json:"buyer_profile_id"`
	PaymentMethod          string    `json:"payment_method"`
	Currency               string    `json:"currency"`
	ProductsBaseTotal      float64   `json:"products_base_total"`
	ProductsPointsUsed     int       `json:"products_points_used"`
	ProductsPointsDiscount float64   `json:"products_points_discount"`
	ProductsFinalTotal     float64   `json:"products_final_total"`
	DeliveryFeeBase        float64   `json:"delivery_fee_base"`
	DeliveryPointsUsed     int       `json:"delivery_points_used"`
	DeliveryPointsDiscount float64   `json:"delivery_points_discount"`
	DeliveryFeeFinal       float64   `json:"delivery_fee_final"`
	CashDue                float64   `json:"cash_due"`
	BuyerConfirmed         bool      `json:"buyer_confirmed"`
	BuyerConfirmedAt       *time.Time `json:"buyer_confirmed_at"`
	SellerConfirmed        bool      `json:"seller_confirmed"`
	SellerConfirmedBy      *uuid.UUID `json:"seller_confirmed_by"`
	SellerConfirmedAt      *time.Time `json:"seller_confirmed_at"`
	Status                 string    `json:"status"`
	VerifiedAt             *time.Time `json:"verified_at"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
}
