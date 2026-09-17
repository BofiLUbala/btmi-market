package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type BuyerPaymentRepository struct {
	db *database.DB
}

func NewBuyerPaymentRepository(db *database.DB) *BuyerPaymentRepository {
	return &BuyerPaymentRepository{db: db}
}

const buyerPaymentSelect = `
	SELECT id, order_id, business_id, shop_id, buyer_profile_id, payment_method, currency,
	       products_base_total, products_points_used, products_points_discount, products_final_total,
	       delivery_fee_base, delivery_points_used, delivery_points_discount, delivery_fee_final,
	       cash_due, payment_markup, payment_markup_type, payment_markup_value, final_total, provider, provider_reference, payment_timing,
	       internal_reference, payer_phone, receipt_reference, receipt_issued_at, provider_metadata, payment_initiated_at,
	       buyer_confirmed, buyer_confirmed_at, seller_confirmed, seller_confirmed_by, seller_confirmed_at,
	       status, verified_at, paid_at, confirmed_by_user_id, confirmation_actor,
	       cash_received_by, cash_received_at,
	       created_at, updated_at
	FROM buyer_payments`

func scanBuyerPayment(row interface{ Scan(...any) error }) (*models.BuyerPayment, error) {
	p := &models.BuyerPayment{}
	err := row.Scan(
		&p.ID, &p.OrderID, &p.BusinessID, &p.ShopID, &p.BuyerProfileID, &p.PaymentMethod, &p.Currency,
		&p.ProductsBaseTotal, &p.ProductsPointsUsed, &p.ProductsPointsDiscount, &p.ProductsFinalTotal,
		&p.DeliveryFeeBase, &p.DeliveryPointsUsed, &p.DeliveryPointsDiscount, &p.DeliveryFeeFinal,
		&p.CashDue, &p.PaymentMarkup, &p.PaymentMarkupType, &p.PaymentMarkupValue, &p.FinalTotal, &p.Provider, &p.ProviderReference, &p.PaymentTiming,
		&p.InternalReference, &p.PayerPhone, &p.ReceiptReference, &p.ReceiptIssuedAt, &p.ProviderMetadata, &p.InitiatedAt,
		&p.BuyerConfirmed, &p.BuyerConfirmedAt, &p.SellerConfirmed, &p.SellerConfirmedBy, &p.SellerConfirmedAt,
		&p.Status, &p.VerifiedAt, &p.PaidAt, &p.ConfirmedByUserID, &p.ConfirmationActor,
		&p.CashReceivedBy, &p.CashReceivedAt,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (r *BuyerPaymentRepository) Create(p *models.BuyerPayment) error {
	query := `
		INSERT INTO buyer_payments (id, order_id, business_id, shop_id, buyer_profile_id, payment_method, currency,
		       products_base_total, products_points_used, products_points_discount, products_final_total,
		       delivery_fee_base, delivery_points_used, delivery_points_discount, delivery_fee_final,
		       cash_due, payment_markup, payment_markup_type, payment_markup_value, final_total, provider, provider_reference, payment_timing,
		       internal_reference, payer_phone,
		       buyer_confirmed, buyer_confirmed_at, seller_confirmed, seller_confirmed_by, seller_confirmed_at,
		       status, verified_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)
		RETURNING created_at, updated_at
	`
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	if p.Status == "" {
		p.Status = models.BuyerPaymentStatusPending
	}
	if p.PaymentMethod == "" {
		p.PaymentMethod = models.BuyerPaymentMethodCash
	}
	if p.Currency == "" {
		p.Currency = models.CurrencyUSD
	}
	p.CreatedAt = time.Now()
	p.UpdatedAt = time.Now()

	return r.db.QueryRow(query,
		p.ID, p.OrderID, p.BusinessID, p.ShopID, p.BuyerProfileID, p.PaymentMethod, p.Currency,
		p.ProductsBaseTotal, p.ProductsPointsUsed, p.ProductsPointsDiscount, p.ProductsFinalTotal,
		p.DeliveryFeeBase, p.DeliveryPointsUsed, p.DeliveryPointsDiscount, p.DeliveryFeeFinal,
		p.CashDue, p.PaymentMarkup, p.PaymentMarkupType, p.PaymentMarkupValue, p.FinalTotal, p.Provider, p.ProviderReference, p.PaymentTiming,
		p.InternalReference, p.PayerPhone,
		p.BuyerConfirmed, p.BuyerConfirmedAt, p.SellerConfirmed, p.SellerConfirmedBy, p.SellerConfirmedAt,
		p.Status, p.VerifiedAt,
	).Scan(&p.CreatedAt, &p.UpdatedAt)
}

func (r *BuyerPaymentRepository) GetByID(id uuid.UUID) (*models.BuyerPayment, error) {
	return scanBuyerPayment(r.db.QueryRow(buyerPaymentSelect+` WHERE id = $1`, id))
}

func (r *BuyerPaymentRepository) GetByOrderID(orderID uuid.UUID) (*models.BuyerPayment, error) {
	return scanBuyerPayment(r.db.QueryRow(buyerPaymentSelect+` WHERE order_id = $1`, orderID))
}

// GetByOrderIDForUpdate serializes cancellation with payment initiation and
// provider settlement. A cancellation must never observe DUE and then race a
// concurrent transition to PROCESSING/PAID.
func (r *BuyerPaymentRepository) GetByOrderIDForUpdate(orderID uuid.UUID) (*models.BuyerPayment, error) {
	return scanBuyerPayment(r.db.QueryRow(buyerPaymentSelect+` WHERE order_id = $1 FOR UPDATE`, orderID))
}

// CancelUnsettled closes an unpaid payment together with its order. The status
// guard is defense in depth; callers also lock and inspect the row first.
func (r *BuyerPaymentRepository) CancelUnsettled(id uuid.UUID) (bool, error) {
	result, err := r.db.Exec(`
		UPDATE buyer_payments SET status='CANCELLED', updated_at=NOW()
		WHERE id=$1 AND status IN ('DUE','PENDING','FAILED','CONFIRMED')`, id)
	if err != nil {
		return false, err
	}
	affected, err := result.RowsAffected()
	return affected > 0, err
}

// MarkProviderOutcome moves an online payment between provider-driven states.
// It is guarded on the statuses a provider may still act on, so a late or
// replayed webhook cannot resurrect a settled payment; it reports whether the
// row actually changed.
func (r *BuyerPaymentRepository) MarkProviderOutcome(id uuid.UUID, status models.BuyerPaymentStatus, reference, failureReason string, verifiedAt *time.Time) (bool, error) {
	result, err := r.db.Exec(`
		UPDATE buyer_payments
		SET status=$2::varchar, provider_reference=COALESCE(NULLIF($3,''), provider_reference),
		    payment_failure_reason=$4, verified_at=COALESCE($5, verified_at),
		    paid_at=CASE WHEN $2::varchar IN ('PAID','VERIFIED') THEN COALESCE($5, NOW()) ELSE paid_at END,
		    confirmation_actor=CASE WHEN $2::varchar IN ('PAID','VERIFIED') THEN 'PROVIDER' ELSE confirmation_actor END,
		    updated_at=NOW()
		WHERE id=$1 AND status IN ('DUE','PROCESSING','PENDING')
	`, id, status, reference, failureReason, verifiedAt)
	if err != nil {
		return false, err
	}
	affected, err := result.RowsAffected()
	return affected > 0, err
}

// ClaimInitiation records that the buyer asked the provider to charge them
// before the external request is made. This closes the cancellation race: once
// claimed, cancellation observes PROCESSING and requires the safe refund path.
func (r *BuyerPaymentRepository) ClaimInitiation(id uuid.UUID, payerPhone string) (bool, error) {
	result, err := r.db.Exec(`
		UPDATE buyer_payments
		SET status='PROCESSING', payer_phone=COALESCE(NULLIF($2,''), payer_phone),
		    payment_initiated_at=COALESCE(payment_initiated_at, NOW()), updated_at=NOW()
		WHERE id=$1 AND status IN ('DUE','PENDING','FAILED')
	`, id, payerPhone)
	if err != nil {
		return false, err
	}
	affected, err := result.RowsAffected()
	return affected > 0, err
}

// MarkInitiated attaches the provider's reference after a successful request.
//
// This is as far as starting a payment ever gets it: PROCESSING means "the
// operator has been asked", never "the buyer has paid". Only a verified webhook
// moves it on from here.
func (r *BuyerPaymentRepository) MarkInitiated(id uuid.UUID, reference, payerPhone string) error {
	_, err := r.db.Exec(`
		UPDATE buyer_payments
		SET status='PROCESSING', provider_reference=COALESCE(NULLIF($2,''), provider_reference),
		    payer_phone=COALESCE(NULLIF($3,''), payer_phone),
		    payment_initiated_at=COALESCE(payment_initiated_at, NOW()), updated_at=NOW()
		WHERE id=$1 AND status='PROCESSING'
	`, id, reference, payerPhone)
	return err
}

// SetInternalReference stamps our own reference on a payment at creation time.
func (r *BuyerPaymentRepository) SetInternalReference(id uuid.UUID, reference string) error {
	_, err := r.db.Exec(
		`UPDATE buyer_payments SET internal_reference=$2, updated_at=NOW() WHERE id=$1 AND internal_reference=''`,
		id, reference,
	)
	return err
}

// RecordReceipt attaches the proof of a settled payment: the reference the buyer
// can quote back, when it was issued, and whatever the operator echoed that is
// safe to keep. Written once, after settlement - never before, because a receipt
// for a payment that has not happened is exactly the fiction this system must
// not produce.
func (r *BuyerPaymentRepository) RecordReceipt(id uuid.UUID, reference string, metadata models.JSONMap) error {
	if metadata == nil {
		metadata = models.JSONMap{}
	}
	_, err := r.db.Exec(`
		UPDATE buyer_payments
		SET receipt_reference=COALESCE(NULLIF($2,''), receipt_reference),
		    receipt_issued_at=COALESCE(receipt_issued_at, NOW()),
		    provider_metadata=$3, updated_at=NOW()
		WHERE id=$1 AND status IN ('PAID','VERIFIED')
	`, id, reference, metadata)
	return err
}

// Update writes the payment's lifecycle columns. The buyer/seller declaration flags
// are deliberately absent: they are frozen history, and no current code path may set
// them.
func (r *BuyerPaymentRepository) Update(p *models.BuyerPayment) error {
	query := `
		UPDATE buyer_payments SET
			status = $2, verified_at = $3, paid_at = $4,
			confirmed_by_user_id = $5, confirmation_actor = $6, updated_at = NOW()
		WHERE id = $1
		RETURNING updated_at
	`
	var updatedAt time.Time
	err := r.db.QueryRow(query,
		p.ID, p.Status, p.VerifiedAt, p.PaidAt,
		p.ConfirmedByUserID, p.ConfirmationActor,
	).Scan(&updatedAt)
	if err != nil {
		return err
	}
	p.UpdatedAt = updatedAt
	return nil
}

// SettleCashByCourier records that the assigned courier physically received the cash.
//
// The status guard is what makes a retried confirmation harmless: the second call
// matches no row, so it neither re-credits points nor re-books commission. It reports
// whether this call is the one that settled the payment.
func (r *BuyerPaymentRepository) SettleCashByCourier(id, courierUserID uuid.UUID) (bool, error) {
	result, err := r.db.Exec(`
		UPDATE buyer_payments
		SET status='PAID', paid_at=NOW(), verified_at=COALESCE(verified_at, NOW()),
		    cash_received_by=$2, cash_received_at=NOW(),
		    confirmed_by_user_id=$2, confirmation_actor='COURIER', updated_at=NOW()
		WHERE id=$1 AND status NOT IN ('VERIFIED','PAID','REFUNDED','CANCELLED')`, id, courierUserID)
	if err != nil {
		return false, err
	}
	affected, err := result.RowsAffected()
	return affected > 0, err
}

func (r *BuyerPaymentRepository) GetByShopID(shopID uuid.UUID, limit, offset int) ([]*models.BuyerPayment, error) {
	query := buyerPaymentSelect + ` WHERE shop_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	rows, err := r.db.Query(query, shopID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []*models.BuyerPayment
	for rows.Next() {
		p, err := scanBuyerPayment(rows)
		if err != nil {
			return nil, err
		}
		payments = append(payments, p)
	}
	return payments, rows.Err()
}

func (r *BuyerPaymentRepository) ExistsByOrderID(orderID uuid.UUID) (bool, error) {
	var exists bool
	err := r.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM buyer_payments WHERE order_id = $1)`, orderID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("exists check: %w", err)
	}
	return exists, nil
}
