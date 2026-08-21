package models

import (
	"time"

	"github.com/google/uuid"
)

type ReceiptStatus string

const (
	ReceiptStatusPending   ReceiptStatus = "PENDING"
	ReceiptStatusReceived  ReceiptStatus = "RECEIVED"
	ReceiptStatusCancelled ReceiptStatus = "CANCELLED"
)

type StockReceipt struct {
	ID              uuid.UUID     `json:"id" db:"id"`
	BusinessID      uuid.UUID     `json:"business_id" db:"business_id"`
	ShopID          uuid.UUID     `json:"shop_id" db:"shop_id"`
	ReceivedBy      *uuid.UUID    `json:"received_by" db:"received_by"`
	ReferenceNumber string        `json:"reference_number" db:"reference_number"`
	Notes           string        `json:"notes" db:"notes"`
	Status          ReceiptStatus `json:"status" db:"status"`
	ReceivedAt      time.Time     `json:"received_at" db:"received_at"`
	CreatedAt       time.Time     `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at" db:"updated_at"`
}

type StockReceiptLine struct {
	ID         uuid.UUID  `json:"id" db:"id"`
	ReceiptID  uuid.UUID  `json:"receipt_id" db:"receipt_id"`
	VariantID  uuid.UUID  `json:"variant_id" db:"variant_id"`
	Quantity   int        `json:"quantity" db:"quantity"`
	UnitCost   float64    `json:"unit_cost" db:"unit_cost"`
	Notes      string     `json:"notes" db:"notes"`
	CreatedAt  time.Time  `json:"created_at" db:"created_at"`
}

type CreateReceiptRequest struct {
	ShopID          string              `json:"shop_id" binding:"required"`
	ReferenceNumber string              `json:"reference_number"`
	Notes           string              `json:"notes"`
	Lines           []ReceiptLineInput  `json:"lines" binding:"required,min=1"`
}

type ReceiptLineInput struct {
	VariantID string  `json:"variant_id" binding:"required"`
	Quantity  int     `json:"quantity" binding:"required,gt=0"`
	UnitCost  float64 `json:"unit_cost"`
	Notes     string  `json:"notes"`
}

type ReceiptResponse struct {
	ID              uuid.UUID     `json:"id"`
	BusinessID      uuid.UUID     `json:"business_id"`
	ShopID          uuid.UUID     `json:"shop_id"`
	ReceivedBy      *uuid.UUID    `json:"received_by"`
	ReferenceNumber string        `json:"reference_number"`
	Notes           string        `json:"notes"`
	Status          ReceiptStatus `json:"status"`
	ReceivedAt      time.Time     `json:"received_at"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
}

type ReceiptLineResponse struct {
	ID        uuid.UUID `json:"id"`
	ReceiptID uuid.UUID `json:"receipt_id"`
	VariantID uuid.UUID `json:"variant_id"`
	Quantity  int       `json:"quantity"`
	UnitCost  float64   `json:"unit_cost"`
	Notes     string    `json:"notes"`
	CreatedAt time.Time `json:"created_at"`
}

type ReceiptWithLinesResponse struct {
	Receipt ReceiptResponse    `json:"receipt"`
	Lines   []ReceiptLineResponse `json:"lines"`
}
