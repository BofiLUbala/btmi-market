package repository

import (
	"database/sql"
	"errors"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// ErrWebhookEventAlreadySeen means the provider re-delivered an event we have
// already recorded. Retries are expected, so this is a normal outcome.
var ErrWebhookEventAlreadySeen = errors.New("WEBHOOK_EVENT_ALREADY_SEEN")

type PaymentWebhookRepository struct{ db *database.DB }

func NewPaymentWebhookRepository(db *database.DB) *PaymentWebhookRepository {
	return &PaymentWebhookRepository{db: db}
}

// Claim inserts the event and fails with ErrWebhookEventAlreadySeen when this
// provider has already delivered it. Inserting first is what makes the whole
// handler idempotent under concurrent re-deliveries.
func (r *PaymentWebhookRepository) Claim(event *models.PaymentWebhookEvent) error {
	if event.ID == uuid.Nil {
		event.ID = uuid.New()
	}
	payload := event.Payload
	if payload == "" {
		payload = "{}"
	}
	err := r.db.QueryRow(`
		INSERT INTO payment_webhook_events (id, provider, event_id, payment_id, reference, reported_status, reported_amount, signature_valid, accepted, rejection_reason, payload)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		ON CONFLICT (provider, event_id) DO NOTHING
		RETURNING created_at
	`, event.ID, event.Provider, event.EventID, event.PaymentID, event.Reference, event.ReportedStatus,
		event.ReportedAmount, event.SignatureValid, event.Accepted, event.RejectionReason, payload,
	).Scan(&event.CreatedAt)
	if err == sql.ErrNoRows {
		return ErrWebhookEventAlreadySeen
	}
	return err
}

// Settle records how the claimed event ended up being treated.
func (r *PaymentWebhookRepository) Settle(id uuid.UUID, accepted bool, rejectionReason string) error {
	_, err := r.db.Exec(`UPDATE payment_webhook_events SET accepted=$2, rejection_reason=$3 WHERE id=$1`, id, accepted, rejectionReason)
	return err
}

// Record stores an event we refused before it could be claimed (bad signature,
// unparseable body): the trace matters even though nothing was applied.
func (r *PaymentWebhookRepository) Record(event *models.PaymentWebhookEvent) error {
	if event.ID == uuid.Nil {
		event.ID = uuid.New()
	}
	payload := event.Payload
	if payload == "" {
		payload = "{}"
	}
	_, err := r.db.Exec(`
		INSERT INTO payment_webhook_events (id, provider, event_id, payment_id, reference, reported_status, reported_amount, signature_valid, accepted, rejection_reason, payload)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		ON CONFLICT (provider, event_id) DO NOTHING
	`, event.ID, event.Provider, event.EventID, event.PaymentID, event.Reference, event.ReportedStatus,
		event.ReportedAmount, event.SignatureValid, event.Accepted, event.RejectionReason, payload)
	return err
}
