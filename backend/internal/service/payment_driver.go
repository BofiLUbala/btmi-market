package service

import (
	"errors"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
)

// PaymentProviderDriver is the one place the platform talks to a mobile money
// operator.
//
// Both mobile methods go through this same interface. MOBILE_PAY_NOW and
// MOBILE_AT_DELIVERY differ only in WHEN the charge is raised - at checkout, or
// once the courier is at the door - never in HOW, so there is exactly one
// integration per operator rather than one per method.
//
// Note what the interface cannot express: there is no Confirm method. A driver
// can start a charge and report that it started, and that is all. Whether the
// buyer actually paid is a fact only the operator knows, and it reaches us one
// way - a signed webhook. Keeping settlement out of this interface is what makes
// it structurally impossible for a driver to mark an order paid.
type PaymentProviderDriver interface {
	// Supports reports whether this driver can charge through a given operator.
	Supports(provider string) bool

	// Charge asks the operator to debit the payer. It returns what the buyer must
	// do next (typically: approve a prompt on their handset) and the operator's
	// own reference for the attempt. Returning without error means "the operator
	// has been asked", never "the buyer has paid".
	Charge(request PaymentChargeRequest) (*models.PaymentInitiation, error)
}

type PaymentChargeRequest struct {
	PaymentID         string
	Provider          string
	PayerPhone        string
	Amount            float64
	Currency          string
	InternalReference string
	OrderNumber       string
}

// PendingProviderDriver is the driver used until a real operator integration is
// wired up, and the reason a buyer can reach a working provider step today.
//
// It does one honest thing: it registers the attempt and hands back the
// operator's pending instruction, which moves the payment to PROCESSING. It has
// no way to settle anything - settlement arrives only through the signed
// webhook, exactly as it will from a live operator - so a payment started here
// stays unpaid until something outside this process proves otherwise.
//
// The only difference a live driver makes is that the reference below comes from
// the operator's API instead of from us, and the prompt actually reaches the
// handset.
type PendingProviderDriver struct {
	// The operators this deployment is allowed to raise a charge through.
	enabled map[string]bool
}

// NewPendingProviderDriver builds the driver over the operators Finance has
// enabled. An empty catalog yields a driver that supports nothing, so asking to
// pay reports that no provider is configured rather than silently succeeding.
func NewPendingProviderDriver(providers []models.PaymentProvider) *PendingProviderDriver {
	enabled := map[string]bool{}
	for _, provider := range providers {
		if provider.Enabled {
			enabled[provider.Code] = true
		}
	}
	return &PendingProviderDriver{enabled: enabled}
}

func (d *PendingProviderDriver) Supports(provider string) bool {
	return d.enabled[strings.ToUpper(strings.TrimSpace(provider))]
}

// providerInstruction is what the buyer is told to do, per operator. It is the
// same USSD-prompt flow for all three, named so the buyer recognises it.
func providerInstruction(provider string) string {
	switch provider {
	case models.PaymentProviderMPesa:
		return "Validez la demande de paiement M-Pesa sur votre téléphone."
	case models.PaymentProviderAirtelMoney:
		return "Validez la demande de paiement Airtel Money sur votre téléphone."
	case models.PaymentProviderOrangeMoney:
		return "Validez la demande de paiement Orange Money sur votre téléphone."
	}
	return "Validez la demande de paiement sur votre téléphone."
}

func (d *PendingProviderDriver) Charge(request PaymentChargeRequest) (*models.PaymentInitiation, error) {
	provider := strings.ToUpper(strings.TrimSpace(request.Provider))
	if !d.Supports(provider) {
		return nil, errors.New("PAYMENT_PROVIDER_NOT_CONFIGURED")
	}
	if strings.TrimSpace(request.PayerPhone) == "" {
		return nil, errors.New("PAYER_PHONE_REQUIRED")
	}
	if request.Amount <= 0 {
		return nil, errors.New("INVALID_PAYMENT_AMOUNT")
	}

	// PROCESSING, with our own reference standing in for the operator's until a
	// live driver supplies one. Deliberately not PAID.
	return &models.PaymentInitiation{
		Status:       string(models.BuyerPaymentStatusProcessing),
		Provider:     provider,
		Reference:    request.InternalReference,
		Amount:       request.Amount,
		Currency:     request.Currency,
		Instructions: providerInstruction(provider),
	}, nil
}
