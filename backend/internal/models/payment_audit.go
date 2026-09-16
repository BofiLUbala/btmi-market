package models

import (
	"time"

	"github.com/google/uuid"
)

// Every step that moves money, or that decides how money will move.
//
// payment_webhook_events already records what an operator sent us. This records
// what we did about it, plus the steps no operator is involved in at all: the
// buyer choosing a method, the buyer choosing an operator, the courier taking
// cash at the door, commission being computed off a settled payment.
const (
	PaymentEventMethodSelected     = "METHOD_SELECTED"
	PaymentEventProviderSelected   = "PROVIDER_SELECTED"
	PaymentEventInitiated          = "PAYMENT_INITIATED"
	PaymentEventConfirmed          = "PAYMENT_CONFIRMED"
	PaymentEventFailed             = "PAYMENT_FAILED"
	PaymentEventCashCollected      = "CASH_COLLECTED"
	PaymentEventWebhookReceived    = "WEBHOOK_RECEIVED"
	PaymentEventCommissionComputed = "COMMISSION_COMPUTED"
	PaymentEventRefunded           = "REFUNDED"
)

// Who acted. An event with no human behind it - an operator callback, a job -
// carries the system or provider actor rather than borrowing a user id.
const (
	PaymentActorBuyer    = "BUYER"
	PaymentActorCourier  = "COURIER"
	PaymentActorSeller   = "SELLER"
	PaymentActorAdmin    = "ADMIN"
	PaymentActorProvider = "PROVIDER"
	PaymentActorSystem   = "SYSTEM"
)

type PaymentAuditEvent struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	PaymentID *uuid.UUID `json:"payment_id,omitempty" db:"payment_id"`
	OrderID   *uuid.UUID `json:"order_id,omitempty" db:"order_id"`
	EventType string     `json:"event_type" db:"event_type"`
	ActorType string     `json:"actor_type" db:"actor_type"`
	ActorID   *uuid.UUID `json:"actor_id,omitempty" db:"actor_id"`
	Provider  string     `json:"provider,omitempty" db:"provider"`
	Amount    *float64   `json:"amount,omitempty" db:"amount"`
	Currency  string     `json:"currency,omitempty" db:"currency"`
	Reference string     `json:"reference,omitempty" db:"reference"`
	Detail    JSONMap    `json:"detail,omitempty" db:"detail"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
}
