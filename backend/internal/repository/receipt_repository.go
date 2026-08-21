package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type ReceiptRepository struct {
	db *database.DB
}

func NewReceiptRepository(db *database.DB) *ReceiptRepository {
	return &ReceiptRepository{db: db}
}

func (r *ReceiptRepository) CreateReceipt(receipt *models.StockReceipt) error {
	query := `
		INSERT INTO stock_receipts (id, business_id, shop_id, received_by, reference_number, notes, status, received_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING created_at, updated_at
	`

	receipt.ID = uuid.New()
	receipt.CreatedAt = time.Now()
	receipt.UpdatedAt = time.Now()
	receipt.ReceivedAt = time.Now()

	return r.db.QueryRow(query,
		receipt.ID, receipt.BusinessID, receipt.ShopID, receipt.ReceivedBy,
		receipt.ReferenceNumber, receipt.Notes, receipt.Status, receipt.ReceivedAt,
	).Scan(&receipt.CreatedAt, &receipt.UpdatedAt)
}

func (r *ReceiptRepository) CreateReceiptLine(line *models.StockReceiptLine) error {
	query := `
		INSERT INTO stock_receipt_lines (id, receipt_id, variant_id, quantity, unit_cost, notes)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING created_at
	`

	line.ID = uuid.New()
	line.CreatedAt = time.Now()

	return r.db.QueryRow(query,
		line.ID, line.ReceiptID, line.VariantID, line.Quantity, line.UnitCost, line.Notes,
	).Scan(&line.CreatedAt)
}

func (r *ReceiptRepository) GetByID(id uuid.UUID) (*models.StockReceipt, error) {
	query := `
		SELECT id, business_id, shop_id, received_by, reference_number, notes, status, received_at, created_at, updated_at
		FROM stock_receipts WHERE id = $1
	`

	receipt := &models.StockReceipt{}
	err := r.db.QueryRow(query, id).Scan(
		&receipt.ID, &receipt.BusinessID, &receipt.ShopID, &receipt.ReceivedBy,
		&receipt.ReferenceNumber, &receipt.Notes, &receipt.Status,
		&receipt.ReceivedAt, &receipt.CreatedAt, &receipt.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("receipt not found")
	}
	if err != nil {
		return nil, err
	}

	return receipt, nil
}

func (r *ReceiptRepository) GetLinesByReceiptID(receiptID uuid.UUID) ([]*models.StockReceiptLine, error) {
	query := `
		SELECT id, receipt_id, variant_id, quantity, unit_cost, notes, created_at
		FROM stock_receipt_lines WHERE receipt_id = $1
		ORDER BY created_at ASC
	`

	rows, err := r.db.Query(query, receiptID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lines []*models.StockReceiptLine
	for rows.Next() {
		line := &models.StockReceiptLine{}
		err := rows.Scan(
			&line.ID, &line.ReceiptID, &line.VariantID, &line.Quantity,
			&line.UnitCost, &line.Notes, &line.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		lines = append(lines, line)
	}

	return lines, rows.Err()
}

func (r *ReceiptRepository) GetByBusinessID(businessID uuid.UUID) ([]*models.StockReceipt, error) {
	query := `
		SELECT id, business_id, shop_id, received_by, reference_number, notes, status, received_at, created_at, updated_at
		FROM stock_receipts WHERE business_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var receipts []*models.StockReceipt
	for rows.Next() {
		receipt := &models.StockReceipt{}
		err := rows.Scan(
			&receipt.ID, &receipt.BusinessID, &receipt.ShopID, &receipt.ReceivedBy,
			&receipt.ReferenceNumber, &receipt.Notes, &receipt.Status,
			&receipt.ReceivedAt, &receipt.CreatedAt, &receipt.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		receipts = append(receipts, receipt)
	}

	return receipts, rows.Err()
}

func (r *ReceiptRepository) GetByShopID(shopID uuid.UUID) ([]*models.StockReceipt, error) {
	query := `
		SELECT id, business_id, shop_id, received_by, reference_number, notes, status, received_at, created_at, updated_at
		FROM stock_receipts WHERE shop_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, shopID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var receipts []*models.StockReceipt
	for rows.Next() {
		receipt := &models.StockReceipt{}
		err := rows.Scan(
			&receipt.ID, &receipt.BusinessID, &receipt.ShopID, &receipt.ReceivedBy,
			&receipt.ReferenceNumber, &receipt.Notes, &receipt.Status,
			&receipt.ReceivedAt, &receipt.CreatedAt, &receipt.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		receipts = append(receipts, receipt)
	}

	return receipts, rows.Err()
}

func (r *ReceiptRepository) UpdateStatus(id uuid.UUID, status models.ReceiptStatus) error {
	query := `UPDATE stock_receipts SET status = $2, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(query, id, status)
	return err
}
