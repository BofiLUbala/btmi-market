package repository

import (
	"database/sql"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// PaymentProviderRepository reads and maintains the mobile money operator
// catalog. Checkout offers exactly what this returns, so an operator withdrawn
// here disappears from the provider step on the buyer's next request.
type PaymentProviderRepository struct {
	db *database.DB
}

func NewPaymentProviderRepository(db *database.DB) *PaymentProviderRepository {
	return &PaymentProviderRepository{db: db}
}

const paymentProviderSelect = `
	SELECT code, label, enabled, display_order, updated_at, modified_by
	FROM payment_providers`

func scanProviders(rows *sql.Rows) ([]models.PaymentProvider, error) {
	defer rows.Close()
	providers := []models.PaymentProvider{}
	for rows.Next() {
		var p models.PaymentProvider
		if err := rows.Scan(&p.Code, &p.Label, &p.Enabled, &p.DisplayOrder, &p.UpdatedAt, &p.ModifiedBy); err != nil {
			return nil, err
		}
		providers = append(providers, p)
	}
	return providers, rows.Err()
}

// List returns the catalog, optionally narrowed to the operators a buyer may
// actually pick right now.
func (r *PaymentProviderRepository) List(enabledOnly bool) ([]models.PaymentProvider, error) {
	query := paymentProviderSelect
	if enabledOnly {
		query += ` WHERE enabled = TRUE`
	}
	query += ` ORDER BY display_order, code`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	return scanProviders(rows)
}

// Get returns one operator, or nil when the code is not in the catalog at all.
func (r *PaymentProviderRepository) Get(code string) (*models.PaymentProvider, error) {
	var p models.PaymentProvider
	err := r.db.QueryRow(paymentProviderSelect+` WHERE code = $1`, code).
		Scan(&p.Code, &p.Label, &p.Enabled, &p.DisplayOrder, &p.UpdatedAt, &p.ModifiedBy)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// SetEnabled is Finance's control over whether an operator is offered. It never
// touches payments already made through that operator: those stay exactly as
// they settled.
func (r *PaymentProviderRepository) SetEnabled(code string, enabled bool, adminID uuid.UUID) error {
	_, err := r.db.Exec(
		`UPDATE payment_providers SET enabled=$2, modified_by=$3, updated_at=NOW() WHERE code=$1`,
		code, enabled, adminID,
	)
	return err
}
