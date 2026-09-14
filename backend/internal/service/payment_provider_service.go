package service

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

// Delivery stages at which a "pay on delivery by mobile money" payment becomes
// payable: the courier is on the way or already there.
var payableAtDeliveryStages = map[string]bool{
	models.DeliveryStatusInTransit: true,
	models.DeliveryStatusDelivered: true,
	models.DeliveryStatusReceived:  true,
}

// SetWebhookDependencies wires the provider side of payments. The secret is the
// one a provider signs its callbacks with; while it is empty the webhook
// refuses every call, so an unsigned request can never mark an order paid.
func (s *PaymentService) SetWebhookDependencies(webhookRepo *repository.PaymentWebhookRepository, secret string) {
	s.webhookRepo = webhookRepo
	s.webhookSecret = secret
}

// Payability answers "should the buyer see a Pay now button for this payment?".
func (s *PaymentService) Payability(payment *models.BuyerPayment, order *models.Order) models.PaymentPayability {
	switch payment.Status {
	case models.BuyerPaymentStatusVerified, models.BuyerPaymentStatusPaid:
		return models.PaymentPayability{Payable: false, Reason: "ALREADY_PAID"}
	case models.BuyerPaymentStatusCancelled, models.BuyerPaymentStatusRefunded:
		return models.PaymentPayability{Payable: false, Reason: "PAYMENT_CLOSED"}
	}
	if payment.PaymentMethod == models.PaymentMethodCashOnDelivery {
		return models.PaymentPayability{Payable: false, Reason: "CASH_ON_DELIVERY"}
	}
	if strings.TrimSpace(payment.Provider) == "" {
		return models.PaymentPayability{Payable: false, Reason: "PAYMENT_PROVIDER_NOT_CONFIGURED"}
	}
	// Pay-now is payable from checkout; pay-at-delivery only once the courier is
	// actually bringing the order.
	if payment.PaymentTiming == "DELIVERY" && !payableAtDeliveryStages[order.DeliveryStatus] {
		return models.PaymentPayability{Payable: false, Reason: "AWAITING_DELIVERY_STAGE"}
	}
	return models.PaymentPayability{Payable: true}
}

// InitiatePayment asks the configured provider to charge the buyer. It never
// settles the payment itself: success is only ever recorded by the webhook.
func (s *PaymentService) InitiatePayment(buyerProfileID, orderID uuid.UUID) (*models.PaymentInitiation, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, mapOrderNotFoundErr(err)
	}
	if order.BuyerProfileID == nil || *order.BuyerProfileID != buyerProfileID {
		return nil, errors.New("FORBIDDEN")
	}
	payment, err := s.paymentRepo.GetByOrderID(orderID)
	if err != nil {
		return nil, err
	}
	if payment == nil {
		return nil, errors.New("PAYMENT_NOT_FOUND")
	}

	payability := s.Payability(payment, order)
	if !payability.Payable {
		return nil, errors.New(payability.Reason)
	}

	// The provider driver belongs here: it would open a charge and hand back its
	// reference plus whatever the buyer must do next, then MarkInitiated moves
	// the payment to PROCESSING. Until one is wired up we say so rather than
	// pretending a charge was started.
	return nil, errors.New("PAYMENT_PROVIDER_NOT_CONFIGURED")
}

// verifyWebhookSignature checks an HMAC-SHA256 over the exact bytes received.
func (s *PaymentService) verifyWebhookSignature(rawBody []byte, signature string) bool {
	if strings.TrimSpace(s.webhookSecret) == "" {
		return false
	}
	provided := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(signature), "sha256="))
	decoded, err := hex.DecodeString(provided)
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, []byte(s.webhookSecret))
	mac.Write(rawBody)
	return hmac.Equal(decoded, mac.Sum(nil))
}

// HandleProviderWebhook is the only path that may mark an online payment paid.
// It verifies the signature over the raw body, records every delivery for
// audit, is idempotent on the provider's own event id, and refuses an event
// whose amount does not match the snapshot the order was priced with.
func (s *PaymentService) HandleProviderWebhook(provider string, rawBody []byte, signature string) error {
	if s.webhookRepo == nil {
		return errors.New("PAYMENT_WEBHOOK_NOT_CONFIGURED")
	}
	provider = strings.TrimSpace(provider)
	if provider == "" {
		return errors.New("PAYMENT_PROVIDER_REQUIRED")
	}
	if strings.TrimSpace(s.webhookSecret) == "" {
		return errors.New("PAYMENT_WEBHOOK_NOT_CONFIGURED")
	}

	signatureValid := s.verifyWebhookSignature(rawBody, signature)

	var event models.ProviderPaymentEvent
	parseErr := json.Unmarshal(rawBody, &event)

	if !signatureValid {
		// Keep a trace, but never key it on an id an unauthenticated caller
		// chose: a forged id must not be able to block a genuine retry.
		_ = s.webhookRepo.Record(&models.PaymentWebhookEvent{
			Provider: provider, EventID: "unsigned:" + uuid.NewString(), Reference: event.Reference,
			ReportedStatus: event.Status, ReportedAmount: event.Amount,
			SignatureValid: false, Accepted: false, RejectionReason: "INVALID_SIGNATURE",
		})
		return errors.New("INVALID_WEBHOOK_SIGNATURE")
	}
	if parseErr != nil || strings.TrimSpace(event.EventID) == "" || strings.TrimSpace(event.PaymentID) == "" {
		return errors.New("INVALID_WEBHOOK_PAYLOAD")
	}

	paymentID, err := uuid.Parse(strings.TrimSpace(event.PaymentID))
	if err != nil {
		return errors.New("INVALID_WEBHOOK_PAYLOAD")
	}

	record := &models.PaymentWebhookEvent{
		Provider: provider, EventID: event.EventID, PaymentID: &paymentID, Reference: event.Reference,
		ReportedStatus: event.Status, ReportedAmount: event.Amount, SignatureValid: true,
		Payload: string(rawBody),
	}
	if err := s.webhookRepo.Claim(record); err != nil {
		if err == repository.ErrWebhookEventAlreadySeen {
			// A retry of something already handled: nothing more to do.
			return nil
		}
		return err
	}

	reject := func(reason string) error {
		_ = s.webhookRepo.Settle(record.ID, false, reason)
		return errors.New(reason)
	}

	payment, err := s.paymentRepo.GetByID(paymentID)
	if err != nil {
		return err
	}
	if payment == nil {
		return reject("PAYMENT_NOT_FOUND")
	}
	if !strings.EqualFold(strings.TrimSpace(payment.Provider), provider) {
		return reject("PAYMENT_PROVIDER_MISMATCH")
	}

	switch strings.ToUpper(strings.TrimSpace(event.Status)) {
	case models.ProviderPaymentSucceeded:
		// The amount the provider captured must be the amount this order was
		// priced at, markup included - otherwise the order is not paid for.
		if event.Currency != "" && !strings.EqualFold(event.Currency, payment.Currency) {
			return reject("AMOUNT_MISMATCH")
		}
		if diff := event.Amount - payment.FinalTotal; diff > 0.01 || diff < -0.01 {
			return reject("AMOUNT_MISMATCH")
		}
		now := time.Now()
		changed, err := s.paymentRepo.MarkProviderOutcome(paymentID, models.BuyerPaymentStatusVerified, event.Reference, "", &now)
		if err != nil {
			return err
		}
		if !changed {
			// Already settled by an earlier event; treat as handled.
			_ = s.webhookRepo.Settle(record.ID, false, "PAYMENT_ALREADY_SETTLED")
			return nil
		}
		_ = s.webhookRepo.Settle(record.ID, true, "")
		// Points, commission and the verified-transaction record follow the same
		// path as any other verified payment.
		payment.Status = models.BuyerPaymentStatusVerified
		payment.VerifiedAt = &now
		s.enqueueVerified(payment)
		if s.commService != nil {
			_, _ = s.commService.CalculateAndRecordCommission(payment.OrderID)
		}
		return nil
	case models.ProviderPaymentFailed:
		reason := strings.TrimSpace(event.Reason)
		if reason == "" {
			reason = "PROVIDER_REPORTED_FAILURE"
		}
		if _, err := s.paymentRepo.MarkProviderOutcome(paymentID, models.BuyerPaymentStatusFailed, event.Reference, reason, nil); err != nil {
			return err
		}
		_ = s.webhookRepo.Settle(record.ID, true, "")
		return nil
	default:
		return reject("UNSUPPORTED_WEBHOOK_STATUS")
	}
}
