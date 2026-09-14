package repository

import (
	"database/sql"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type PaymentConfigRepository struct{ db *database.DB }

func NewPaymentConfigRepository(db *database.DB) *PaymentConfigRepository {
	return &PaymentConfigRepository{db: db}
}

// markupCurrencyOrDefault keeps a blank value meaning USD rather than storing
// an empty currency that later comparisons could not interpret.
func markupCurrencyOrDefault(currency string) string {
	if currency == "" {
		return models.CurrencyUSD
	}
	return currency
}

func scanPaymentConfig(row interface{ Scan(...any) error }) (*models.PaymentMethodConfig, error) {
	item := &models.PaymentMethodConfig{}
	err := row.Scan(&item.Code, &item.Label, &item.Enabled, &item.Timing, &item.Channel, &item.MarkupType, &item.MarkupValue, &item.MarkupCurrency, &item.Provider, &item.UpdatedAt, &item.ModifiedBy)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return item, err
}

func (r *PaymentConfigRepository) List(enabledOnly bool) ([]models.PaymentMethodConfig, error) {
	query := `SELECT code,label,enabled,timing,channel,markup_type,markup_value,markup_currency,provider,updated_at,modified_by FROM payment_method_configs`
	if enabledOnly {
		query += ` WHERE enabled = TRUE`
	}
	query += ` ORDER BY code`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.PaymentMethodConfig, 0)
	for rows.Next() {
		item, err := scanPaymentConfig(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *PaymentConfigRepository) Get(code string) (*models.PaymentMethodConfig, error) {
	return scanPaymentConfig(r.db.QueryRow(`SELECT code,label,enabled,timing,channel,markup_type,markup_value,markup_currency,provider,updated_at,modified_by FROM payment_method_configs WHERE code=$1`, code))
}

func (r *PaymentConfigRepository) Update(code string, req *models.UpdatePaymentMethodConfigRequest, modifiedBy uuid.UUID) (*models.PaymentMethodConfig, error) {
	return scanPaymentConfig(r.db.QueryRow(`UPDATE payment_method_configs SET label=$2,enabled=$3,markup_type=$4,markup_value=$5,markup_currency=$6,provider=$7,modified_by=$8,updated_at=NOW() WHERE code=$1 RETURNING code,label,enabled,timing,channel,markup_type,markup_value,markup_currency,provider,updated_at,modified_by`, code, req.Label, req.Enabled, req.MarkupType, req.MarkupValue, markupCurrencyOrDefault(req.MarkupCurrency), req.Provider, modifiedBy))
}
