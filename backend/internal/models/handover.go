package models

import (
	"time"

	"github.com/google/uuid"
)

// Handover verification result codes. Every product check — courier or buyer, QR or
// manual reference — resolves to exactly one of these, so the two clients can render
// the same outcome without re-deriving it from an error string.
const (
	HandoverResultValid        = "VALID"
	HandoverResultAlreadyUsed  = "ALREADY_USED"
	HandoverResultWrongProduct = "WRONG_PRODUCT"
	HandoverResultWrongVariant = "WRONG_VARIANT"
	HandoverResultWrongOrder   = "WRONG_ORDER"
	HandoverResultWrongShop    = "WRONG_SHOP"
	HandoverResultInvalidQR    = "INVALID_QR"
)

// Handover stages, in the order the physical handover runs them. They are a view over
// the order's delivery_status, payment status and verification rows, not a fourth
// status column: nothing is stored against them.
const (
	HandoverStageInTransit       = "IN_TRANSIT"
	HandoverStageArrived         = "COURIER_ARRIVED"
	HandoverStageProductVerified = "PRODUCT_VERIFIED"
	HandoverStagePaymentPending  = "AWAITING_PAYMENT"
	HandoverStagePaymentVerified = "PAYMENT_VERIFIED"
	HandoverStageAwaitingReceipt = "AWAITING_BUYER_CONFIRMATION"
	HandoverStageDelivered       = "DELIVERED"
)

// HandoverVerificationResult is the answer to one product check. On anything but VALID
// and ALREADY_USED the product fields are left empty: a rejected scan must not leak
// what the correct product would have been.
type HandoverVerificationResult struct {
	Result             string                 `json:"result"`
	Reason             string                 `json:"reason,omitempty"`
	VerificationMethod string                 `json:"verification_method"`
	OrderID            uuid.UUID              `json:"order_id"`
	OrderNumber        string                 `json:"order_number,omitempty"`
	OrderLineID        *uuid.UUID             `json:"order_line_id,omitempty"`
	ProductID          *uuid.UUID             `json:"product_id,omitempty"`
	VariantID          *uuid.UUID             `json:"variant_id,omitempty"`
	ProductName        string                 `json:"product_name,omitempty"`
	ProductNumber      string                 `json:"product_number,omitempty"`
	VariantName        string                 `json:"variant_name,omitempty"`
	Attributes         map[string]interface{} `json:"attributes,omitempty"`
	ShopName           string                 `json:"shop_name,omitempty"`
	SellerName         string                 `json:"seller_name,omitempty"`
	Quantity           int                    `json:"quantity,omitempty"`
	UnitPrice          float64                `json:"unit_price,omitempty"`
	LineTotal          float64                `json:"line_total,omitempty"`
	Currency           string                 `json:"currency,omitempty"`
	VerifiedAt         *time.Time             `json:"verified_at,omitempty"`
}

// HandoverLine is one order line as both parties see it during the handover: what was
// ordered, whether the physical item has been verified, and whether the buyer has
// acknowledged receiving it.
type HandoverLine struct {
	OrderLineID       uuid.UUID              `json:"order_line_id"`
	ProductID         uuid.UUID              `json:"product_id"`
	VariantID         uuid.UUID              `json:"variant_id"`
	ProductName       string                 `json:"product_name"`
	VariantName       string                 `json:"variant_name"`
	ProductNumber     string                 `json:"product_number"`
	Attributes        map[string]interface{} `json:"attributes,omitempty"`
	ImageURL          string                 `json:"image_url,omitempty"`
	Quantity          int                    `json:"quantity"`
	UnitPrice         float64                `json:"unit_price"`
	LineTotal         float64                `json:"line_total"`
	ProductVerified   bool                   `json:"product_verified"`
	VerifiedAt        *time.Time             `json:"verified_at,omitempty"`
	VerifiedByRole    string                 `json:"verified_by_role,omitempty"`
	BuyerAcknowledged bool                   `json:"buyer_acknowledged"`
}

// HandoverState is the single source of truth both the courier app and the buyer app
// render the handover from, so neither side can show a step the backend would refuse.
type HandoverState struct {
	OrderID        uuid.UUID `json:"order_id"`
	OrderNumber    string    `json:"order_number"`
	OrderStatus    string    `json:"order_status"`
	DeliveryStatus string    `json:"delivery_status"`
	Stage          string    `json:"stage"`

	BuyerName       string `json:"buyer_name,omitempty"`
	BuyerPhone      string `json:"buyer_phone,omitempty"`
	DeliveryAddress string `json:"delivery_address,omitempty"`
	ShopName        string `json:"shop_name,omitempty"`
	SellerName      string `json:"seller_name,omitempty"`

	PaymentMethod   string  `json:"payment_method"`
	PaymentStatus   string  `json:"payment_status"`
	PaymentTiming   string  `json:"payment_timing,omitempty"`
	AmountDue       float64 `json:"amount_due"`
	Currency        string  `json:"currency"`
	PaymentVerified bool    `json:"payment_verified"`

	Lines []HandoverLine `json:"lines"`

	CourierArrived       bool `json:"courier_arrived"`
	AllProductsVerified  bool `json:"all_products_verified"`
	AllLinesAcknowledged bool `json:"all_lines_acknowledged"`
	DeliveryScanned      bool `json:"delivery_scanned"`
	ReceiptConfirmed     bool `json:"receipt_confirmed"`

	// What each side may do right now. The clients enable buttons from these flags
	// rather than inferring permission from the stage themselves.
	CourierCanVerifyProduct bool   `json:"courier_can_verify_product"`
	CourierCanConfirmCash   bool   `json:"courier_can_confirm_cash"`
	BuyerCanAcknowledge     bool   `json:"buyer_can_acknowledge"`
	BuyerCanConfirmReceipt  bool   `json:"buyer_can_confirm_receipt"`
	BlockedReason           string `json:"blocked_reason,omitempty"`
}

// HandoverLineAcknowledgement is the buyer's confirmation for one order line.
type HandoverLineAcknowledgement struct {
	OrderLineID     uuid.UUID `json:"order_line_id" binding:"required"`
	ProductReceived bool      `json:"product_received"`
	MatchesOrder    bool      `json:"matches_order"`
	QuantityCorrect bool      `json:"quantity_correct"`
}

type AcknowledgeHandoverRequest struct {
	Lines []HandoverLineAcknowledgement `json:"lines" binding:"required,min=1"`
}

// ConfirmCashRequest carries the courier's explicit statement that the cash was handed
// over. IdempotencyKey lets a retried request be recognised instead of re-applied.
type ConfirmCashRequest struct {
	Confirmed      bool   `json:"confirmed"`
	IdempotencyKey string `json:"idempotency_key"`
	Notes          string `json:"notes"`
}

type ConfirmCashResponse struct {
	OrderID          uuid.UUID `json:"order_id"`
	PaymentID        uuid.UUID `json:"payment_id"`
	PaymentStatus    string    `json:"payment_status"`
	AmountCollected  float64   `json:"amount_collected"`
	Currency         string    `json:"currency"`
	CommissionStatus string    `json:"commission_status"`
	CommissionAmount float64   `json:"commission_amount"`
	// Cash in the courier's hand settles the buyer's side only. TBK's commission is a
	// separate ledger that stays DUE until Finance actually collects it.
	CommissionCollected bool `json:"commission_collected"`
	AlreadyConfirmed    bool `json:"already_confirmed"`
	// Who settled it. Always COURIER on this path - it is the whole point of it.
	ConfirmationActor string     `json:"confirmation_actor,omitempty"`
	ConfirmedByUserID *uuid.UUID `json:"confirmed_by_user_id,omitempty"`
	ConfirmedAt       *time.Time `json:"confirmed_at,omitempty"`
}

// HandoverEvent is one entry in an order's handover audit trail.
type HandoverEvent struct {
	ID          uuid.UUID  `json:"id"`
	OrderID     uuid.UUID  `json:"order_id"`
	ActorUserID *uuid.UUID `json:"actor_user_id,omitempty"`
	ActorRole   string     `json:"actor_role"`
	Action      string     `json:"action"`
	Result      string     `json:"result,omitempty"`
	Detail      string     `json:"detail,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}
