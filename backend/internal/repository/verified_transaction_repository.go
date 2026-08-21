package repository

import (
	"database/sql"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type VerifiedTransactionRepository struct {
	db *database.DB
}

func NewVerifiedTransactionRepository(db *database.DB) *VerifiedTransactionRepository {
	return &VerifiedTransactionRepository{db: db}
}

func (r *VerifiedTransactionRepository) Create(vt *models.VerifiedTransaction) error {
	query := `
		INSERT INTO verified_transactions (id, order_id, business_id, buyer_profile_id, shop_id, amount, currency, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING created_at, updated_at
	`
	if vt.ID == uuid.Nil {
		vt.ID = uuid.New()
	}

	return r.db.QueryRow(query,
		vt.ID, vt.OrderID, vt.BusinessID, vt.BuyerProfileID,
		vt.ShopID, vt.Amount, vt.Currency, vt.Status,
	).Scan(&vt.CreatedAt, &vt.UpdatedAt)
}

func (r *VerifiedTransactionRepository) GetByOrderID(orderID uuid.UUID) (*models.VerifiedTransaction, error) {
	query := `
		SELECT id, order_id, business_id, buyer_profile_id, shop_id, amount, currency, status, 
		       verified_at, refunded_at, points_awarded_seller, points_awarded_buyer, created_at, updated_at
		FROM verified_transactions WHERE order_id = $1
	`
	vt := &models.VerifiedTransaction{}
	err := r.db.QueryRow(query, orderID).Scan(
		&vt.ID, &vt.OrderID, &vt.BusinessID, &vt.BuyerProfileID, &vt.ShopID,
		&vt.Amount, &vt.Currency, &vt.Status, &vt.VerifiedAt, &vt.RefundedAt,
		&vt.PointsAwardedSeller, &vt.PointsAwardedBuyer, &vt.CreatedAt, &vt.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return vt, nil
}

func (r *VerifiedTransactionRepository) Verify(orderID uuid.UUID, verifiedAt time.Time) error {
	query := `
		UPDATE verified_transactions 
		SET status = 'VERIFIED', verified_at = $1, updated_at = NOW()
		WHERE order_id = $2
	`
	_, err := r.db.Exec(query, verifiedAt, orderID)
	return err
}

func (r *VerifiedTransactionRepository) MarkPointsAwardedSeller(orderID uuid.UUID) error {
	query := `UPDATE verified_transactions SET points_awarded_seller = TRUE, updated_at = NOW() WHERE order_id = $1`
	_, err := r.db.Exec(query, orderID)
	return err
}

func (r *VerifiedTransactionRepository) MarkPointsAwardedBuyer(orderID uuid.UUID) error {
	query := `UPDATE verified_transactions SET points_awarded_buyer = TRUE, updated_at = NOW() WHERE order_id = $1`
	_, err := r.db.Exec(query, orderID)
	return err
}

func (r *VerifiedTransactionRepository) Refund(orderID uuid.UUID, refundedAt time.Time) error {
	query := `
		UPDATE verified_transactions 
		SET status = 'REFUNDED', refunded_at = $1, updated_at = NOW()
		WHERE order_id = $2 AND status = 'VERIFIED'
	`
	_, err := r.db.Exec(query, refundedAt, orderID)
	return err
}

func (r *VerifiedTransactionRepository) GetByBuyerProfile(buyerProfileID uuid.UUID) ([]*models.VerifiedTransaction, error) {
	query := `
		SELECT vt.id, vt.order_id, vt.business_id, vt.buyer_profile_id, vt.shop_id, vt.amount, vt.currency, vt.status,
		       vt.verified_at, vt.refunded_at, vt.points_awarded_seller, vt.points_awarded_buyer, vt.created_at, vt.updated_at
		FROM verified_transactions vt
		WHERE vt.buyer_profile_id = $1
		ORDER BY vt.created_at DESC
	`
	rows, err := r.db.Query(query, buyerProfileID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var txns []*models.VerifiedTransaction
	for rows.Next() {
		vt := &models.VerifiedTransaction{}
		if err := rows.Scan(
			&vt.ID, &vt.OrderID, &vt.BusinessID, &vt.BuyerProfileID, &vt.ShopID,
			&vt.Amount, &vt.Currency, &vt.Status, &vt.VerifiedAt, &vt.RefundedAt,
			&vt.PointsAwardedSeller, &vt.PointsAwardedBuyer, &vt.CreatedAt, &vt.UpdatedAt,
		); err != nil {
			return nil, err
		}
		txns = append(txns, vt)
	}
	return txns, rows.Err()
}

type PurchaseConfirmationRepository struct {
	db *database.DB
}

func NewPurchaseConfirmationRepository(db *database.DB) *PurchaseConfirmationRepository {
	return &PurchaseConfirmationRepository{db: db}
}

func (r *PurchaseConfirmationRepository) Create(pc *models.PurchaseConfirmation) error {
	query := `
		INSERT INTO purchase_confirmations (id, order_id, buyer_profile_id, cash_payment_id)
		VALUES ($1, $2, $3, $4)
		RETURNING confirmed_at, created_at
	`
	if pc.ID == uuid.Nil {
		pc.ID = uuid.New()
	}

	return r.db.QueryRow(query,
		pc.ID, pc.OrderID, pc.BuyerProfileID, pc.CashPaymentID,
	).Scan(&pc.ConfirmedAt, &pc.CreatedAt)
}

func (r *PurchaseConfirmationRepository) GetByOrderAndBuyer(orderID, buyerProfileID uuid.UUID) (*models.PurchaseConfirmation, error) {
	query := `
		SELECT id, order_id, buyer_profile_id, cash_payment_id, confirmed_at, created_at
		FROM purchase_confirmations WHERE order_id = $1 AND buyer_profile_id = $2
	`
	pc := &models.PurchaseConfirmation{}
	err := r.db.QueryRow(query, orderID, buyerProfileID).Scan(
		&pc.ID, &pc.OrderID, &pc.BuyerProfileID, &pc.CashPaymentID,
		&pc.ConfirmedAt, &pc.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return pc, nil
}

func (r *PurchaseConfirmationRepository) GetPendingByBuyer(buyerProfileID uuid.UUID) ([]*models.PendingPurchaseResponse, error) {
	query := `
		SELECT o.id as order_id, o.shop_id, s.name as shop_name, b.name as business_name,
		       cp.amount, cp.currency, COALESCE(e.first_name || ' ' || e.last_name, 'Unknown') as employee_name,
		       o.created_at
		FROM orders o
		JOIN cash_payments cp ON cp.reference_id = o.id AND cp.reference_type = 'ORDER'
		JOIN shops s ON s.id = o.shop_id
		JOIN businesses b ON b.id = o.business_id
		LEFT JOIN employees e ON e.id = cp.employee_id
		WHERE o.status = 'COMPLETED'
		  AND NOT EXISTS (
		      SELECT 1 FROM purchase_confirmations pc 
		      WHERE pc.order_id = o.id AND pc.buyer_profile_id = $1
		  )
		  AND NOT EXISTS (
		      SELECT 1 FROM verified_transactions vt 
		      WHERE vt.order_id = o.id AND vt.buyer_profile_id = $1 AND vt.status = 'VERIFIED'
		  )
		ORDER BY o.created_at DESC
	`
	rows, err := r.db.Query(query, buyerProfileID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var purchases []*models.PendingPurchaseResponse
	for rows.Next() {
		p := &models.PendingPurchaseResponse{}
		if err := rows.Scan(
			&p.OrderID, &p.ShopID, &p.ShopName, &p.BusinessName,
			&p.Amount, &p.Currency, &p.EmployeeName, &p.CreatedAt,
		); err != nil {
			return nil, err
		}
		purchases = append(purchases, p)
	}
	return purchases, rows.Err()
}

func (r *PurchaseConfirmationRepository) GetPendingByOrderAndBuyer(orderID, buyerProfileID uuid.UUID) (*models.PendingPurchaseResponse, error) {
	query := `
		SELECT o.id as order_id, o.shop_id, s.name as shop_name, b.name as business_name,
		       cp.amount, cp.currency, COALESCE(e.first_name || ' ' || e.last_name, '') as employee_name,
		       o.created_at
		FROM orders o
		JOIN cash_payments cp ON cp.reference_id = o.id AND cp.reference_type = 'ORDER'
		JOIN shops s ON s.id = o.shop_id
		JOIN businesses b ON b.id = o.business_id
		LEFT JOIN employees e ON e.id = cp.employee_id
		WHERE o.id = $1 AND o.status = 'COMPLETED'
	`
	p := &models.PendingPurchaseResponse{}
	err := r.db.QueryRow(query, orderID, buyerProfileID).Scan(
		&p.OrderID, &p.ShopID, &p.ShopName, &p.BusinessName,
		&p.Amount, &p.Currency, &p.EmployeeName, &p.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return p, nil
}
