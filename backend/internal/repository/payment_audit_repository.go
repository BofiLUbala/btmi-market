package repository

import (
	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// PaymentAuditRepository is the append-only trail of everything that moved money
// or decided how money would move. Nothing updates or deletes a row here.
type PaymentAuditRepository struct {
	db *database.DB
}

func NewPaymentAuditRepository(db *database.DB) *PaymentAuditRepository {
	return &PaymentAuditRepository{db: db}
}

// Record appends one event. Auditing is never allowed to break the thing it is
// auditing, so callers log the error and carry on rather than failing a payment
// because its trail could not be written; the caller's own transaction remains
// the source of truth.
func (r *PaymentAuditRepository) Record(e *models.PaymentAuditEvent) error {
	if e.ID == uuid.Nil {
		e.ID = uuid.New()
	}
	if e.Detail == nil {
		e.Detail = models.JSONMap{}
	}
	return r.db.QueryRow(`
		INSERT INTO payment_audit_events
			(id, payment_id, order_id, event_type, actor_type, actor_id, provider, amount, currency, reference, detail)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		RETURNING created_at`,
		e.ID, e.PaymentID, e.OrderID, e.EventType, e.ActorType, e.ActorID,
		e.Provider, e.Amount, e.Currency, e.Reference, e.Detail,
	).Scan(&e.CreatedAt)
}

const paymentAuditSelect = `
	SELECT id, payment_id, order_id, event_type, actor_type, actor_id, provider,
	       amount, currency, reference, detail, created_at
	FROM payment_audit_events`

// ListByOrder returns an order's payment history oldest-first, which is the
// order a support agent reads it in.
func (r *PaymentAuditRepository) ListByOrder(orderID uuid.UUID) ([]models.PaymentAuditEvent, error) {
	rows, err := r.db.Query(paymentAuditSelect+` WHERE order_id=$1 ORDER BY created_at`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := []models.PaymentAuditEvent{}
	for rows.Next() {
		var e models.PaymentAuditEvent
		if err := rows.Scan(&e.ID, &e.PaymentID, &e.OrderID, &e.EventType, &e.ActorType, &e.ActorID,
			&e.Provider, &e.Amount, &e.Currency, &e.Reference, &e.Detail, &e.CreatedAt); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, rows.Err()
}
