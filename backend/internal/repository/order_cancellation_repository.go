package repository

import (
	"database/sql"
	"errors"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// RecordCancellation saves who cancelled an order and why. Called in the same
// transaction as the cancellation itself; a second call for the same order
// keeps the first record.
func (r *OrderRepository) RecordCancellation(orderID uuid.UUID, role string, by *uuid.UUID, reason, stage string) error {
	_, err := r.db.Exec(`
		INSERT INTO order_cancellations (order_id, cancelled_by_role, cancelled_by, reason, stage)
		VALUES ($1, $2, $3, $4, NULLIF($5, ''))
		ON CONFLICT (order_id) DO NOTHING`, orderID, role, by, reason, stage)
	return err
}

// GetCancellation returns who cancelled the order and why, or nil when the
// order has no cancellation record.
func (r *OrderRepository) GetCancellation(orderID uuid.UUID) (*models.OrderCancellation, error) {
	c := &models.OrderCancellation{}
	var by uuid.NullUUID
	var stage sql.NullString
	err := r.db.QueryRow(`
		SELECT oc.cancelled_by_role, oc.cancelled_by, COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), ''),
		       oc.reason, oc.stage, oc.created_at
		FROM order_cancellations oc
		LEFT JOIN users u ON u.id = oc.cancelled_by
		WHERE oc.order_id = $1`, orderID).Scan(&c.CancelledByRole, &by, &c.CancelledByName, &c.Reason, &stage, &c.CancelledAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if by.Valid {
		id := by.UUID
		c.CancelledBy = &id
	}
	c.Stage = stage.String
	return c, nil
}
