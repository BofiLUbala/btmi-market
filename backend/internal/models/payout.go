package models

import (
	"time"

	"github.com/google/uuid"
)

// PaymentProviderAfrimoney is Africell's mobile money, the fourth network a
// seller receives payouts on.
const PaymentProviderAfrimoney = "AFRIMONEY"

// PayoutProviders are the four networks every seller registers a number for, in
// the order the seller form shows them.
var PayoutProviders = []string{PaymentProviderMPesa, PaymentProviderAirtelMoney, PaymentProviderOrangeMoney, PaymentProviderAfrimoney}

// SellerPayoutAccount is the number a business receives its money on for one
// network.
type SellerPayoutAccount struct {
	BusinessID uuid.UUID  `json:"business_id"`
	Provider   string     `json:"provider"`
	Phone      string     `json:"phone"`
	UpdatedBy  *uuid.UUID `json:"updated_by,omitempty"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// SavePayoutAccountsRequest carries the seller's number for each network.
type SavePayoutAccountsRequest struct {
	Accounts map[string]string `json:"accounts" binding:"required"`
}

const (
	PayoutKindPayout   = "PAYOUT"
	PayoutKindClawback = "CLAWBACK"
)

const (
	// PayoutStatusPending: recorded, not yet sent (or no live operator yet).
	PayoutStatusPending = "PENDING"
	// PayoutStatusBlocked: the seller has no number on the buyer's network yet.
	PayoutStatusBlocked = "BLOCKED_NO_ACCOUNT"
	// PayoutStatusSent: the operator accepted the transfer; awaiting its result.
	PayoutStatusSent      = "SENT"
	PayoutStatusPaid      = "PAID"
	PayoutStatusFailed    = "FAILED"
	PayoutStatusCancelled = "CANCELLED"
	// PayoutStatusApplied: a clawback already deducted from a later payout.
	PayoutStatusApplied = "APPLIED"
)

// SellerPayout is one money movement to (or owed back by) a seller.
type SellerPayout struct {
	ID                uuid.UUID  `json:"id"`
	Kind              string     `json:"kind"`
	OrderID           uuid.UUID  `json:"order_id"`
	OrderNumber       string     `json:"order_number,omitempty"`
	BusinessID        uuid.UUID  `json:"business_id"`
	PaymentID         *uuid.UUID `json:"payment_id,omitempty"`
	Provider          string     `json:"provider"`
	Phone             string     `json:"phone"`
	GrossAmount       float64    `json:"gross_amount"`
	DeductedAmount    float64    `json:"deducted_amount"`
	Amount            float64    `json:"amount"`
	Currency          string     `json:"currency"`
	Status            string     `json:"status"`
	ProviderReference string     `json:"provider_reference,omitempty"`
	Attempts          int        `json:"attempts"`
	LastError         string     `json:"last_error,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	SettledAt         *time.Time `json:"settled_at,omitempty"`
}

// BuyerRefund is money returned to a buyer from TBK's merchant account.
type BuyerRefund struct {
	ID                uuid.UUID  `json:"id"`
	OrderID           uuid.UUID  `json:"order_id"`
	PaymentID         *uuid.UUID `json:"payment_id,omitempty"`
	Provider          string     `json:"provider"`
	Phone             string     `json:"phone"`
	Amount            float64    `json:"amount"`
	Currency          string     `json:"currency"`
	Status            string     `json:"status"`
	ProviderReference string     `json:"provider_reference,omitempty"`
	Attempts          int        `json:"attempts"`
	LastError         string     `json:"last_error,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}
