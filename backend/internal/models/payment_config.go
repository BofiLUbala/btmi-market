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

// Mobile money operators. These are the only provider values the system writes;
// the database enforces the same set, so a provider can never be spelled two
// ways between a checkout, a webhook and a Finance report.
const (
	PaymentProviderMPesa       = "MPESA"
	PaymentProviderAirtelMoney = "AIRTEL_MONEY"
	PaymentProviderOrangeMoney = "ORANGE_MONEY"
)

// PaymentChannelMobile marks the methods that are settled by an operator rather
// than by cash at the door. Both mobile methods share one integration - only the
// moment the charge is raised differs - so anything that asks "is this mobile
// money?" asks it here rather than listing the two method codes again.
const (
	PaymentChannelMobile = "MOBILE"
	PaymentChannelCash   = "CASH"
)

// IsMobileMethod reports whether a payment method is settled by an operator.
func IsMobileMethod(method string) bool {
	return method == PaymentMethodMobilePayNow || method == PaymentMethodMobileDelivery
}

// PaymentProvider is one row of the operator catalog. Finance owns `Enabled`, so
// an operator that stops settling can be withdrawn from checkout without a
// deploy and without invalidating the payments already made through it.
type PaymentProvider struct {
	Code         string     `json:"code"`
	Label        string     `json:"label"`
	Enabled      bool       `json:"enabled"`
	DisplayOrder int        `json:"display_order"`
	UpdatedAt    time.Time  `json:"updated_at"`
	ModifiedBy   *uuid.UUID `json:"modified_by,omitempty"`
}

type PaymentMethodConfig struct {
	Code        string  `json:"code"`
	Label       string  `json:"label"`
	Enabled     bool    `json:"enabled"`
	Timing      string  `json:"timing"`
	Channel     string  `json:"channel"`
	MarkupType  string  `json:"markup_type"`
	MarkupValue float64 `json:"markup_value"`
	// Only meaningful for a FIXED markup: the currency the amount is entered in.
	MarkupCurrency string     `json:"markup_currency"`
	Provider       string     `json:"provider"`
	MarkupAmount   float64    `json:"markup_amount"`
	QuotedTotal    float64    `json:"quoted_total"`
	UpdatedAt      time.Time  `json:"updated_at"`
	ModifiedBy     *uuid.UUID `json:"modified_by,omitempty"`
}

type UpdatePaymentMethodConfigRequest struct {
	Label          string  `json:"label" binding:"required"`
	Enabled        bool    `json:"enabled"`
	MarkupType     string  `json:"markup_type" binding:"required,oneof=NONE PERCENTAGE FIXED"`
	MarkupValue    float64 `json:"markup_value" binding:"gte=0"`
	MarkupCurrency string  `json:"markup_currency" binding:"omitempty,oneof=USD CDF"`
	Provider       string  `json:"provider"`
}

// CreatePaymentRequest records how the buyer intends to pay. Provider is the
// operator they picked and is required for both mobile methods - paying "by
// mobile money" without saying which operator is not a decision anyone can act
// on. It must be absent for cash.
type CreatePaymentRequest struct {
	PaymentMethod string `json:"payment_method" binding:"required"`
	Provider      string `json:"provider"`
	// The number the operator will debit. Optional at selection time for a
	// pay-at-delivery payment, which is not charged until the courier is there.
	PayerPhone string `json:"payer_phone"`
}

// InitiatePaymentRequest asks the operator to actually raise the charge. The
// phone may be supplied here instead of at selection time, which is what a
// pay-at-delivery payment does.
type InitiatePaymentRequest struct {
	PayerPhone string `json:"payer_phone"`
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
	// The operators a mobile method may be paid with, already filtered to the
	// enabled ones. The client renders the provider step from this rather than
	// from a hardcoded list, so withdrawing an operator takes it out of checkout
	// immediately.
	Providers []PaymentProvider `json:"providers"`
}
