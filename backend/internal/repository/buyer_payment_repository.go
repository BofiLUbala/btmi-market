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
	       cash_due,
	       buyer_confirmed, buyer_confirmed_at, seller_confirmed, seller_confirmed_by, seller_confirmed_at,
	       status, verified_at,
	       created_at, updated_at
	FROM buyer_payments`

func scanBuyerPayment(row interface{ Scan(...any) error }) (*models.BuyerPayment, error) {
	p := &models.BuyerPayment{}
	err := row.Scan(
		&p.ID, &p.OrderID, &p.BusinessID, &p.ShopID, &p.BuyerProfileID, &p.PaymentMethod, &p.Currency,
		&p.ProductsBaseTotal, &p.ProductsPointsUsed, &p.ProductsPointsDiscount, &p.ProductsFinalTotal,
		&p.DeliveryFeeBase, &p.DeliveryPointsUsed, &p.DeliveryPointsDiscount, &p.DeliveryFeeFinal,
		&p.CashDue,
		&p.BuyerConfirmed, &p.BuyerConfirmedAt, &p.SellerConfirmed, &p.SellerConfirmedBy, &p.SellerConfirmedAt,
		&p.Status, &p.VerifiedAt,
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
		       cash_due, buyer_confirmed, buyer_confirmed_at, seller_confirmed, seller_confirmed_by, seller_confirmed_at,
		       status, verified_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
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
		p.Currency = "CDF"
	}
	p.CreatedAt = time.Now()
	p.UpdatedAt = time.Now()

	return r.db.QueryRow(query,
		p.ID, p.OrderID, p.BusinessID, p.ShopID, p.BuyerProfileID, p.PaymentMethod, p.Currency,
		p.ProductsBaseTotal, p.ProductsPointsUsed, p.ProductsPointsDiscount, p.ProductsFinalTotal,
		p.DeliveryFeeBase, p.DeliveryPointsUsed, p.DeliveryPointsDiscount, p.DeliveryFeeFinal,
		p.CashDue, p.BuyerConfirmed, p.BuyerConfirmedAt, p.SellerConfirmed, p.SellerConfirmedBy, p.SellerConfirmedAt,
		p.Status, p.VerifiedAt,
	).Scan(&p.CreatedAt, &p.UpdatedAt)
}

func (r *BuyerPaymentRepository) GetByID(id uuid.UUID) (*models.BuyerPayment, error) {
	return scanBuyerPayment(r.db.QueryRow(buyerPaymentSelect+` WHERE id = $1`, id))
}

func (r *BuyerPaymentRepository) GetByOrderID(orderID uuid.UUID) (*models.BuyerPayment, error) {
	return scanBuyerPayment(r.db.QueryRow(buyerPaymentSelect+` WHERE order_id = $1`, orderID))
}

func (r *BuyerPaymentRepository) Update(p *models.BuyerPayment) error {
	query := `
		UPDATE buyer_payments SET
			buyer_confirmed = $2, buyer_confirmed_at = $3,
			seller_confirmed = $4, seller_confirmed_by = $5, seller_confirmed_at = $6,
			status = $7, verified_at = $8, updated_at = NOW()
		WHERE id = $1
		RETURNING updated_at
	`
	var updatedAt time.Time
	err := r.db.QueryRow(query,
		p.ID, p.BuyerConfirmed, p.BuyerConfirmedAt,
		p.SellerConfirmed, p.SellerConfirmedBy, p.SellerConfirmedAt,
		p.Status, p.VerifiedAt,
	).Scan(&updatedAt)
	if err != nil {
		return err
	}
	p.UpdatedAt = updatedAt
	return nil
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
