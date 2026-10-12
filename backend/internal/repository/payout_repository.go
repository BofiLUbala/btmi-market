package repository

import (
	"database/sql"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// PayoutRepository stores sellers' payout numbers, the payouts made to them and
// the refunds TBK sends back to buyers.
type PayoutRepository struct {
	db *database.DB
}

func NewPayoutRepository(db *database.DB) *PayoutRepository {
	return &PayoutRepository{db: db}
}

/* ── Payout numbers ───────────────────────────────────────── */

func (r *PayoutRepository) ListAccounts(businessID uuid.UUID) ([]models.SellerPayoutAccount, error) {
	rows, err := r.db.Query(`
		SELECT business_id, provider, phone, updated_by, updated_at
		FROM seller_payout_accounts WHERE business_id = $1`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.SellerPayoutAccount
	for rows.Next() {
		var a models.SellerPayoutAccount
		if err := rows.Scan(&a.BusinessID, &a.Provider, &a.Phone, &a.UpdatedBy, &a.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// GetAccount returns the business's number on one network, or nil.
func (r *PayoutRepository) GetAccount(businessID uuid.UUID, provider string) (*models.SellerPayoutAccount, error) {
	var a models.SellerPayoutAccount
	err := r.db.QueryRow(`
		SELECT business_id, provider, phone, updated_by, updated_at
		FROM seller_payout_accounts WHERE business_id = $1 AND provider = $2`, businessID, provider).
		Scan(&a.BusinessID, &a.Provider, &a.Phone, &a.UpdatedBy, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *PayoutRepository) UpsertAccount(businessID uuid.UUID, provider, phone string, by uuid.UUID) error {
	_, err := r.db.Exec(`
		INSERT INTO seller_payout_accounts (business_id, provider, phone, updated_by, updated_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (business_id, provider) DO UPDATE
		SET phone = EXCLUDED.phone, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
		businessID, provider, phone, by)
	return err
}

/* ── Payouts ──────────────────────────────────────────────── */

const payoutColumns = `p.id, p.kind, p.order_id, COALESCE(o.order_number, ''), p.business_id, p.payment_id,
	p.provider, p.phone, p.gross_amount, p.deducted_amount, p.amount, p.currency, p.status,
	p.provider_reference, p.attempts, p.last_error, p.created_at, p.updated_at, p.settled_at`

func scanPayout(row interface{ Scan(...interface{}) error }) (*models.SellerPayout, error) {
	var p models.SellerPayout
	err := row.Scan(&p.ID, &p.Kind, &p.OrderID, &p.OrderNumber, &p.BusinessID, &p.PaymentID,
		&p.Provider, &p.Phone, &p.GrossAmount, &p.DeductedAmount, &p.Amount, &p.Currency, &p.Status,
		&p.ProviderReference, &p.Attempts, &p.LastError, &p.CreatedAt, &p.UpdatedAt, &p.SettledAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// CreatePayout inserts a payout row. It returns (nil, nil) when the order
// already has a row of that kind, so a replayed webhook never pays twice.
func (r *PayoutRepository) CreatePayout(p *models.SellerPayout) (*models.SellerPayout, error) {
	var id uuid.UUID
	err := r.db.QueryRow(`
		INSERT INTO seller_payouts (kind, order_id, business_id, payment_id, provider, phone,
			gross_amount, deducted_amount, amount, currency, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (order_id, kind) DO NOTHING
		RETURNING id`,
		p.Kind, p.OrderID, p.BusinessID, p.PaymentID, p.Provider, p.Phone,
		p.GrossAmount, p.DeductedAmount, p.Amount, p.Currency, p.Status).Scan(&id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return r.GetPayout(id)
}

func (r *PayoutRepository) GetPayout(id uuid.UUID) (*models.SellerPayout, error) {
	row := r.db.QueryRow(`SELECT `+payoutColumns+` FROM seller_payouts p
		LEFT JOIN orders o ON o.id = p.order_id WHERE p.id = $1`, id)
	p, err := scanPayout(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return p, err
}

func (r *PayoutRepository) GetPayoutByOrder(orderID uuid.UUID, kind string) (*models.SellerPayout, error) {
	row := r.db.QueryRow(`SELECT `+payoutColumns+` FROM seller_payouts p
		LEFT JOIN orders o ON o.id = p.order_id WHERE p.order_id = $1 AND p.kind = $2`, orderID, kind)
	p, err := scanPayout(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return p, err
}

func (r *PayoutRepository) ListPayouts(businessID uuid.UUID, limit int) ([]models.SellerPayout, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := r.db.Query(`SELECT `+payoutColumns+` FROM seller_payouts p
		LEFT JOIN orders o ON o.id = p.order_id
		WHERE p.business_id = $1 ORDER BY p.created_at DESC LIMIT $2`, businessID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectPayouts(rows)
}

// ListBlocked returns the business's payouts waiting for a payout number.
func (r *PayoutRepository) ListBlocked(businessID uuid.UUID) ([]models.SellerPayout, error) {
	rows, err := r.db.Query(`SELECT `+payoutColumns+` FROM seller_payouts p
		LEFT JOIN orders o ON o.id = p.order_id
		WHERE p.business_id = $1 AND p.kind = 'PAYOUT' AND p.status = 'BLOCKED_NO_ACCOUNT'
		ORDER BY p.created_at`, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectPayouts(rows)
}

func collectPayouts(rows *sql.Rows) ([]models.SellerPayout, error) {
	var out []models.SellerPayout
	for rows.Next() {
		p, err := scanPayout(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *p)
	}
	return out, rows.Err()
}

// UpdatePayoutStatus records the outcome of a send attempt.
func (r *PayoutRepository) UpdatePayoutStatus(id uuid.UUID, status, phone, reference, lastError string, countAttempt bool) error {
	attempt := 0
	if countAttempt {
		attempt = 1
	}
	_, err := r.db.Exec(`
		UPDATE seller_payouts
		SET status = $2::text,
		    phone = CASE WHEN $3::text <> '' THEN $3::text ELSE phone END,
		    provider_reference = CASE WHEN $4::text <> '' THEN $4::text ELSE provider_reference END,
		    last_error = $5::text,
		    attempts = attempts + $6::int,
		    settled_at = CASE WHEN $2::text = 'PAID' THEN NOW() ELSE settled_at END,
		    updated_at = NOW()
		WHERE id = $1`, id, status, phone, reference, lastError, attempt)
	return err
}

// OpenClawbackTotal is what a business still owes back from refunded orders.
func (r *PayoutRepository) OpenClawbackTotal(businessID uuid.UUID, currency string) (float64, error) {
	var total float64
	err := r.db.QueryRow(`
		SELECT COALESCE(SUM(amount), 0) FROM seller_payouts
		WHERE business_id = $1 AND currency = $2 AND kind = 'CLAWBACK' AND status = 'PENDING'`,
		businessID, currency).Scan(&total)
	return total, err
}

// ApplyClawbacks marks the business's open clawbacks as deducted.
func (r *PayoutRepository) ApplyClawbacks(businessID uuid.UUID, currency string) error {
	_, err := r.db.Exec(`
		UPDATE seller_payouts SET status = 'APPLIED', settled_at = NOW(), updated_at = NOW()
		WHERE business_id = $1 AND currency = $2 AND kind = 'CLAWBACK' AND status = 'PENDING'`,
		businessID, currency)
	return err
}

// MarkCommissionCollectedAtSource records that TBK kept its commission when it
// split the payment, so the seller does not owe it any more.
func (r *PayoutRepository) MarkCommissionCollectedAtSource(orderID uuid.UUID) error {
	_, err := r.db.Exec(`
		UPDATE sale_commissions
		SET status = 'COLLECTED', collected_at = NOW(),
		    notes = 'Retenue à la source lors du versement mobile money', updated_at = NOW()
		WHERE order_id = $1 AND status = 'DUE'`, orderID)
	return err
}

/* ── Buyer refunds ────────────────────────────────────────── */

func (r *PayoutRepository) CreateRefund(f *models.BuyerRefund) (*models.BuyerRefund, error) {
	err := r.db.QueryRow(`
		INSERT INTO buyer_refunds (order_id, payment_id, provider, phone, amount, currency, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (order_id) DO NOTHING
		RETURNING id, created_at, updated_at`,
		f.OrderID, f.PaymentID, f.Provider, f.Phone, f.Amount, f.Currency, f.Status).
		Scan(&f.ID, &f.CreatedAt, &f.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return f, nil
}

func (r *PayoutRepository) UpdateRefundStatus(id uuid.UUID, status, reference, lastError string) error {
	_, err := r.db.Exec(`
		UPDATE buyer_refunds
		SET status = $2::text,
		    provider_reference = CASE WHEN $3::text <> '' THEN $3::text ELSE provider_reference END,
		    last_error = $4::text, attempts = attempts + 1, updated_at = NOW()
		WHERE id = $1`, id, status, reference, lastError)
	return err
}
