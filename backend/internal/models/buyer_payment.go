package models

import (
	"time"

	"github.com/google/uuid"
)

type BuyerPaymentStatus string

const (
	BuyerPaymentStatusPending    BuyerPaymentStatus = "PENDING"
	BuyerPaymentStatusConfirmed  BuyerPaymentStatus = "CONFIRMED"
	BuyerPaymentStatusVerified   BuyerPaymentStatus = "VERIFIED"
	BuyerPaymentStatusCancelled  BuyerPaymentStatus = "CANCELLED"
	BuyerPaymentStatusDue        BuyerPaymentStatus = "DUE"
	BuyerPaymentStatusProcessing BuyerPaymentStatus = "PROCESSING"
	BuyerPaymentStatusPaid       BuyerPaymentStatus = "PAID"
	BuyerPaymentStatusFailed     BuyerPaymentStatus = "FAILED"
	BuyerPaymentStatusRefunded   BuyerPaymentStatus = "REFUNDED"
)

// Who settled a payment. Cash is only ever COURIER; an online payment only ever
// PROVIDER. LegacyDeclaration marks rows settled under the old buyer+seller
// declaration rule, which no code path can produce any more.
const (
	PaymentConfirmationActorCourier  = "COURIER"
	PaymentConfirmationActorProvider = "PROVIDER"
	PaymentConfirmationActorAdmin    = "ADMIN"
	PaymentConfirmationActorLegacy   = "LEGACY_DECLARATION"
)

// PaymentSettled reports whether the buyer has actually paid, as opposed to having
// promised to. PAID is what every new settlement writes; VERIFIED is the same fact
// under the name older rows were stored with.
func PaymentSettled(status BuyerPaymentStatus) bool {
	return status == BuyerPaymentStatusPaid || status == BuyerPaymentStatusVerified
}

const (
	BuyerPaymentMethodCash = PaymentMethodCashOnDelivery
)

// BuyerPayment snapshots the Order + Delivery totals so the client never
// needs to send any amount. cash_due = products_final_total + delivery_fee_final.
type BuyerPayment struct {
	ID             uuid.UUID `json:"id" db:"id"`
	OrderID        uuid.UUID `json:"order_id" db:"order_id"`
	BusinessID     uuid.UUID `json:"business_id" db:"business_id"`
	ShopID         uuid.UUID `json:"shop_id" db:"shop_id"`
	BuyerProfileID uuid.UUID `json:"buyer_profile_id" db:"buyer_profile_id"`
	PaymentMethod  string    `json:"payment_method" db:"payment_method"`
	Currency       string    `json:"currency" db:"currency"`

	ProductsBaseTotal      float64 `json:"products_base_total" db:"products_base_total"`
	ProductsPointsUsed     int     `json:"products_points_used" db:"products_points_used"`
	ProductsPointsDiscount float64 `json:"products_points_discount" db:"products_points_discount"`
	ProductsFinalTotal     float64 `json:"products_final_total" db:"products_final_total"`

	DeliveryFeeBase        float64 `json:"delivery_fee_base" db:"delivery_fee_base"`
	DeliveryPointsUsed     int     `json:"delivery_points_used" db:"delivery_points_used"`
	DeliveryPointsDiscount float64 `json:"delivery_points_discount" db:"delivery_points_discount"`
	DeliveryFeeFinal       float64 `json:"delivery_fee_final" db:"delivery_fee_final"`

	CashDue            float64 `json:"cash_due" db:"cash_due"`
	PaymentMarkup      float64 `json:"payment_markup" db:"payment_markup"`
	PaymentMarkupType  string  `json:"payment_markup_type" db:"payment_markup_type"`
	PaymentMarkupValue float64 `json:"payment_markup_value" db:"payment_markup_value"`
	FinalTotal         float64 `json:"final_total" db:"final_total"`
	Provider           string  `json:"provider" db:"provider"`
	ProviderReference  string  `json:"provider_reference" db:"provider_reference"`
	PaymentTiming      string  `json:"payment_timing" db:"payment_timing"`

	// Our own reference, allocated before the operator is ever called, so a
	// charge that is started but never answered is still traceable from our side.
	InternalReference string `json:"internal_reference" db:"internal_reference"`
	// The number the operator debits. Stored for the receipt and for support;
	// it is the buyer's own number, never a credential.
	PayerPhone       string     `json:"payer_phone" db:"payer_phone"`
	ReceiptReference string     `json:"receipt_reference" db:"receipt_reference"`
	ReceiptIssuedAt  *time.Time `json:"receipt_issued_at" db:"receipt_issued_at"`
	// Non-sensitive operator echo, kept for support and reconciliation. Secrets
	// and anything credential-shaped are filtered out before this is written.
	ProviderMetadata JSONMap    `json:"provider_metadata" db:"provider_metadata"`
	InitiatedAt      *time.Time `json:"initiated_at" db:"payment_initiated_at"`

	// Legacy declaration flags. Nothing writes these any more: cash is settled by the
	// courier at the door, not by the buyer and seller each declaring it happened.
	// They are read-only history for rows written before that rule.
	BuyerConfirmed    bool       `json:"buyer_confirmed" db:"buyer_confirmed"`
	BuyerConfirmedAt  *time.Time `json:"buyer_confirmed_at" db:"buyer_confirmed_at"`
	SellerConfirmed   bool       `json:"seller_confirmed" db:"seller_confirmed"`
	SellerConfirmedBy *uuid.UUID `json:"seller_confirmed_by" db:"seller_confirmed_by"`
	SellerConfirmedAt *time.Time `json:"seller_confirmed_at" db:"seller_confirmed_at"`

	Status     BuyerPaymentStatus `json:"status" db:"status"`
	VerifiedAt *time.Time         `json:"verified_at" db:"verified_at"`

	// Who actually settled the payment. ConfirmationActor names the authority, so a
	// courier's cash receipt is never confused with a provider's confirmation.
	PaidAt            *time.Time `json:"paid_at" db:"paid_at"`
	ConfirmedByUserID *uuid.UUID `json:"confirmed_by_user_id" db:"confirmed_by_user_id"`
	ConfirmationActor string     `json:"confirmation_actor" db:"confirmation_actor"`
	CashReceivedBy    *uuid.UUID `json:"cash_received_by" db:"cash_received_by"`
	CashReceivedAt    *time.Time `json:"cash_received_at" db:"cash_received_at"`

	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type BuyerPaymentResponse struct {
	ID                     uuid.UUID  `json:"id"`
	OrderID                uuid.UUID  `json:"order_id"`
	ShopID                 uuid.UUID  `json:"shop_id"`
	ShopName               string     `json:"shop_name,omitempty"`
	BuyerProfileID         uuid.UUID  `json:"buyer_profile_id"`
	PaymentMethod          string     `json:"payment_method"`
	Currency               string     `json:"currency"`
	ProductsBaseTotal      float64    `json:"products_base_total"`
	ProductsPointsUsed     int        `json:"products_points_used"`
	ProductsPointsDiscount float64    `json:"products_points_discount"`
	ProductsFinalTotal     float64    `json:"products_final_total"`
	DeliveryFeeBase        float64    `json:"delivery_fee_base"`
	DeliveryPointsUsed     int        `json:"delivery_points_used"`
	DeliveryPointsDiscount float64    `json:"delivery_points_discount"`
	DeliveryFeeFinal       float64    `json:"delivery_fee_final"`
	CashDue                float64    `json:"cash_due"`
	PaymentMarkup          float64    `json:"payment_markup"`
	Payable                bool       `json:"payable"`
	PayableReason          string     `json:"payable_reason,omitempty"`
	PaymentMarkupType      string     `json:"payment_markup_type"`
	PaymentMarkupValue     float64    `json:"payment_markup_value"`
	FinalTotal             float64    `json:"final_total"`
	Provider               string     `json:"provider"`
	ProviderLabel          string     `json:"provider_label,omitempty"`
	ProviderReference      string     `json:"provider_reference,omitempty"`
	InternalReference      string     `json:"internal_reference,omitempty"`
	PayerPhone             string     `json:"payer_phone,omitempty"`
	ReceiptReference       string     `json:"receipt_reference,omitempty"`
	ReceiptIssuedAt        *time.Time `json:"receipt_issued_at,omitempty"`
	InitiatedAt            *time.Time `json:"initiated_at,omitempty"`
	PaymentTiming          string     `json:"payment_timing"`
	BuyerConfirmed         bool       `json:"buyer_confirmed"`
	BuyerConfirmedAt       *time.Time `json:"buyer_confirmed_at"`
	SellerConfirmed        bool       `json:"seller_confirmed"`
	SellerConfirmedBy      *uuid.UUID `json:"seller_confirmed_by"`
	SellerConfirmedAt      *time.Time `json:"seller_confirmed_at"`
	Status                 string     `json:"status"`
	VerifiedAt             *time.Time `json:"verified_at"`
	PaidAt                 *time.Time `json:"paid_at"`
	ConfirmedByUserID      *uuid.UUID `json:"confirmed_by_user_id"`
	ConfirmationActor      string     `json:"confirmation_actor"`
	CashReceivedAt         *time.Time `json:"cash_received_at"`
	CreatedAt              time.Time  `json:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at"`
}
