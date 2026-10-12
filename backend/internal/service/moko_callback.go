package service

import (
	"errors"
	"log"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// SetMokoClient enables Moko's callback (POST /webhooks/moko).
func (s *PaymentService) SetMokoClient(client *MokoClient) {
	s.mokoClient = client
}

// HandleMokoCallback authenticates and decrypts a Moko callback, then routes it
// by our own reference: PY-… settles a buyer payment through the same path as
// every operator event; PO-… and RF-… close a seller payout or a buyer refund.
// A still-pending status changes nothing.
func (s *PaymentService) HandleMokoCallback(rawBody []byte, signature string) error {
	if s.mokoClient == nil {
		return errors.New("PAYMENT_WEBHOOK_NOT_CONFIGURED")
	}
	result, err := s.mokoClient.DecodeCallback(rawBody, signature)
	if err != nil {
		return err
	}
	if !result.Succeeded && !result.Failed {
		return nil
	}
	ref := strings.TrimSpace(result.Reference)
	switch {
	case strings.HasPrefix(ref, "PY-"):
		return s.applyMokoPayment(result, rawBody)
	case strings.HasPrefix(ref, "PO-"), strings.HasPrefix(ref, "RF-"):
		if s.payoutService != nil {
			s.payoutService.OnTransferResult(ref, result.Succeeded, result.OperatorRef, result.StatusDescription)
		}
		return nil
	}
	log.Printf("moko callback: unknown reference %q", ref)
	return nil
}

// applyMokoPayment turns Moko's verdict on a debit into an operator event.
func (s *PaymentService) applyMokoPayment(result *MokoResult, rawBody []byte) error {
	// PY-<payment uuid>-<suffix>
	rest := strings.TrimPrefix(result.Reference, "PY-")
	if len(rest) < 36 {
		return ErrMokoPayload
	}
	paymentID, err := uuid.Parse(rest[:36])
	if err != nil {
		return ErrMokoPayload
	}
	payment, err := s.paymentRepo.GetByID(paymentID)
	if err != nil {
		return err
	}
	if payment == nil {
		return errors.New("PAYMENT_NOT_FOUND")
	}
	status := models.ProviderPaymentFailed
	if result.Succeeded {
		status = models.ProviderPaymentSucceeded
	}
	return s.applyProviderEvent(payment.Provider, models.ProviderPaymentEvent{
		// One event per final verdict: a repeated callback is claimed once.
		EventID:   "moko:" + result.Reference + ":" + status,
		PaymentID: paymentID.String(),
		Reference: firstNonEmpty(result.OperatorRef, result.Reference),
		Status:    status,
		Amount:    result.Amount,
		Currency:  result.Currency,
		Reason:    result.StatusDescription,
	}, rawBody)
}

// OnTransferResult records Moko's verdict on a payout (PO-<id>) or a refund
// (RF-<id>).
func (s *PayoutService) OnTransferResult(reference string, succeeded bool, operatorRef, reason string) {
	if len(reference) < 4 {
		return
	}
	kind, rest := reference[:3], reference[3:]
	id, err := uuid.Parse(strings.TrimSpace(rest))
	if err != nil {
		log.Printf("payout: bad transfer reference %q", reference)
		return
	}
	status, lastError := models.PayoutStatusPaid, ""
	if !succeeded {
		status, lastError = models.PayoutStatusFailed, firstNonEmpty(reason, "Échec signalé par l'opérateur")
	}
	if kind == "PO-" {
		s.logIf(s.repo.UpdatePayoutStatus(id, status, "", operatorRef, lastError, false))
		return
	}
	s.logIf(s.repo.UpdateRefundStatus(id, status, operatorRef, lastError))
}
