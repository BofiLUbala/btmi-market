package repository

import (
	"database/sql"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type SellerTrustRepository struct {
	db *database.DB
}

func NewSellerTrustRepository(db *database.DB) *SellerTrustRepository {
	return &SellerTrustRepository{db: db}
}

func (r *SellerTrustRepository) CreateOrUpdate(trust *models.SellerTrust) error {
	query := `
		INSERT INTO seller_trust (id, business_id, trust_status, verified_sales_count, 
			order_completion_rate, cancellation_rate, purchase_confirmation_rate, stock_reliability_rate)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (business_id) DO UPDATE SET
			trust_status = EXCLUDED.trust_status,
			verified_sales_count = EXCLUDED.verified_sales_count,
			order_completion_rate = EXCLUDED.order_completion_rate,
			cancellation_rate = EXCLUDED.cancellation_rate,
			purchase_confirmation_rate = EXCLUDED.purchase_confirmation_rate,
			stock_reliability_rate = EXCLUDED.stock_reliability_rate,
			last_calculated_at = NOW(),
			updated_at = NOW()
		RETURNING created_at, updated_at
	`
	if trust.ID == uuid.Nil {
		trust.ID = uuid.New()
	}

	return r.db.QueryRow(query,
		trust.ID, trust.BusinessID, trust.TrustStatus, trust.VerifiedSalesCount,
		trust.OrderCompletionRate, trust.CancellationRate,
		trust.PurchaseConfirmationRate, trust.StockReliabilityRate,
	).Scan(&trust.CreatedAt, &trust.UpdatedAt)
}

func (r *SellerTrustRepository) GetByBusinessID(businessID uuid.UUID) (*models.SellerTrust, error) {
	query := `
		SELECT id, business_id, trust_status, verified_sales_count,
		       order_completion_rate, cancellation_rate, purchase_confirmation_rate, stock_reliability_rate,
		       last_calculated_at, created_at, updated_at
		FROM seller_trust WHERE business_id = $1
	`
	t := &models.SellerTrust{}
	err := r.db.QueryRow(query, businessID).Scan(
		&t.ID, &t.BusinessID, &t.TrustStatus, &t.VerifiedSalesCount,
		&t.OrderCompletionRate, &t.CancellationRate,
		&t.PurchaseConfirmationRate, &t.StockReliabilityRate,
		&t.LastCalculatedAt, &t.CreatedAt, &t.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *SellerTrustRepository) RecalculateTrust(businessID uuid.UUID) (*models.SellerTrust, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Count total orders
	var totalOrders int
	err = tx.QueryRow(`SELECT COUNT(*) FROM orders WHERE business_id = $1`, businessID).Scan(&totalOrders)
	if err != nil {
		return nil, err
	}

	// Count completed orders
	var completedOrders int
	err = tx.QueryRow(`SELECT COUNT(*) FROM orders WHERE business_id = $1 AND status = 'COMPLETED'`, businessID).Scan(&completedOrders)
	if err != nil {
		return nil, err
	}

	// Count cancelled orders
	var cancelledOrders int
	err = tx.QueryRow(`SELECT COUNT(*) FROM orders WHERE business_id = $1 AND status = 'CANCELLED'`, businessID).Scan(&cancelledOrders)
	if err != nil {
		return nil, err
	}

	// Count verified transactions
	var verifiedCount int
	err = tx.QueryRow(`SELECT COUNT(*) FROM verified_transactions WHERE business_id = $1 AND status = 'VERIFIED'`, businessID).Scan(&verifiedCount)
	if err != nil {
		return nil, err
	}

	// Count purchase confirmations for this business's orders
	var confirmedPurchases int
	err = tx.QueryRow(`
		SELECT COUNT(*) FROM purchase_confirmations pc
		JOIN orders o ON o.id = pc.order_id
		WHERE o.business_id = $1
	`, businessID).Scan(&confirmedPurchases)
	if err != nil {
		return nil, err
	}

	// Calculate rates
	completionRate := 0.0
	cancellationRate := 0.0
	confirmationRate := 0.0

	if totalOrders > 0 {
		completionRate = float64(completedOrders) / float64(totalOrders) * 100
		cancellationRate = float64(cancelledOrders) / float64(totalOrders) * 100
	}
	if completedOrders > 0 {
		confirmationRate = float64(confirmedPurchases) / float64(completedOrders) * 100
	}

	// Determine trust status
	trustStatus := "NORMAL"
	if completionRate >= 90 && confirmationRate >= 70 {
		trustStatus = "HIGH"
	} else if completionRate < 50 || cancellationRate > 30 {
		trustStatus = "LOW"
	}

	trust := &models.SellerTrust{
		BusinessID:               businessID,
		TrustStatus:              trustStatus,
		VerifiedSalesCount:       verifiedCount,
		OrderCompletionRate:      completionRate,
		CancellationRate:         cancellationRate,
		PurchaseConfirmationRate: confirmationRate,
		StockReliabilityRate:     100.0,
	}

	if err := r.CreateOrUpdate(trust); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return trust, nil
}
