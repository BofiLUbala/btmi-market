package models

import (
	"time"

	"github.com/google/uuid"
)

// Provider-reported outcomes. A provider adapter maps its own vocabulary onto
// these two before the core payment logic ever sees it.
const (
	ProviderPaymentSucceeded = "SUCCEEDED"
	ProviderPaymentFailed    = "FAILED"
)

// ProviderPaymentEvent is the normalised webhook body. Amount and currency are
// echoed back by the provider and checked against the payment snapshot, so a
// call that reports the wrong amount is refused instead of applied.
type ProviderPaymentEvent struct {
	EventID   string  `json:"event_id" binding:"required"`
	PaymentID string  `json:"payment_id" binding:"required"`
	Reference string  `json:"reference"`
	Status    string  `json:"status" binding:"required"`
	Amount    float64 `json:"amount"`
	Currency  string  `json:"currency"`
	Reason    string  `json:"reason"`
}

type PaymentWebhookEvent struct {
	ID              uuid.UUID  `json:"id"`
	Provider        string     `json:"provider"`
	EventID         string     `json:"event_id"`
	PaymentID       *uuid.UUID `json:"payment_id,omitempty"`
	Reference       string     `json:"reference"`
	ReportedStatus  string     `json:"reported_status"`
	ReportedAmount  float64    `json:"reported_amount"`
	SignatureValid  bool       `json:"signature_valid"`
	Accepted        bool       `json:"accepted"`
	RejectionReason string     `json:"rejection_reason"`
	Payload         string     `json:"-"`
	CreatedAt       time.Time  `json:"created_at"`
}

// PaymentInitiation is what the buyer's client gets back when it asks to pay:
// whatever the provider needs the buyer to do next.
type PaymentInitiation struct {
	PaymentID    uuid.UUID `json:"payment_id"`
	Status       string    `json:"status"`
	Provider     string    `json:"provider"`
	Reference    string    `json:"reference"`
	Amount       float64   `json:"amount"`
	Currency     string    `json:"currency"`
	RedirectURL  string    `json:"redirect_url,omitempty"`
	Instructions string    `json:"instructions,omitempty"`
}

// PaymentPayability tells the client whether to offer a "Pay now" button, and
// why not when it should not.
type PaymentPayability struct {
	Payable bool   `json:"payable"`
	Reason  string `json:"reason,omitempty"`
}
