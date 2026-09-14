package models

import (
	"github.com/google/uuid"
	"time"
)

const (
	PaymentMethodCashOnDelivery = "CASH_ON_DELIVERY"
	PaymentMethodMobilePayNow   = "MOBILE_PAY_NOW"
	PaymentMethodMobileDelivery = "MOBILE_AT_DELIVERY"
)

type PaymentMethodConfig struct {
	Code         string     `json:"code"`
	Label        string     `json:"label"`
	Enabled      bool       `json:"enabled"`
	Timing       string     `json:"timing"`
	Channel      string     `json:"channel"`
	MarkupType   string     `json:"markup_type"`
	MarkupValue  float64    `json:"markup_value"`
	Provider     string     `json:"provider"`
	MarkupAmount float64    `json:"markup_amount,omitempty"`
	QuotedTotal  float64    `json:"quoted_total,omitempty"`
	UpdatedAt    time.Time  `json:"updated_at"`
	ModifiedBy   *uuid.UUID `json:"modified_by,omitempty"`
}

type UpdatePaymentMethodConfigRequest struct {
	Label       string  `json:"label" binding:"required"`
	Enabled     bool    `json:"enabled"`
	MarkupType  string  `json:"markup_type" binding:"required,oneof=NONE PERCENTAGE FIXED"`
	MarkupValue float64 `json:"markup_value" binding:"gte=0"`
	Provider    string  `json:"provider"`
}

type CreatePaymentRequest struct {
	PaymentMethod string `json:"payment_method" binding:"required"`
}

type CheckoutQuote struct {
	OrderID               string                `json:"order_id"`
	Currency              string                `json:"currency"`
	Subtotal              float64               `json:"subtotal"`
	Discount              float64               `json:"discount"`
	PointsDiscount        float64               `json:"points_discount"`
	DeliveryFee           float64               `json:"delivery_fee"`
	PaymentMarkup         float64               `json:"payment_markup"`
	FinalTotal            float64               `json:"final_total"`
	SelectedPaymentMethod string                `json:"selected_payment_method"`
	PaymentMethods        []PaymentMethodConfig `json:"payment_methods"`
}
