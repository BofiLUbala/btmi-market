package models

import (
	"time"

	"github.com/google/uuid"
)

type Inventory struct {
	ID               uuid.UUID `json:"id" db:"id"`
	BusinessID       uuid.UUID `json:"business_id" db:"business_id"`
	ShopID           uuid.UUID `json:"shop_id" db:"shop_id"`
	ProductID        uuid.UUID `json:"product_id" db:"product_id"`
	VariantID        uuid.UUID `json:"variant_id" db:"variant_id"`
	Quantity         int       `json:"quantity" db:"quantity"`
	ReservedQuantity int       `json:"reserved_quantity" db:"reserved_quantity"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
}

type AddStockRequest struct {
	VariantID string `json:"variant_id" binding:"required"`
	// Zero is allowed so a newly published Product can register its Shop
	// offer (inventory row) before any units arrive.
	Quantity int    `json:"quantity" binding:"min=0"`
	Notes    string `json:"notes"`
}

type RecordSaleRequest struct {
	VariantID  string `json:"variant_id" binding:"required"`
	Quantity   int    `json:"quantity" binding:"required,gt=0"`
	SaleType   string `json:"sale_type" binding:"required"`
	EmployeeID string `json:"employee_id"`
}

type ReserveStockRequest struct {
	VariantID string `json:"variant_id" binding:"required"`
	Quantity  int    `json:"quantity" binding:"required,gt=0"`
}

type ReleaseStockRequest struct {
	VariantID string `json:"variant_id" binding:"required"`
	Quantity  int    `json:"quantity" binding:"required,gt=0"`
}

type InventoryResponse struct {
	ID               uuid.UUID `json:"id"`
	BusinessID       uuid.UUID `json:"business_id"`
	ShopID           uuid.UUID `json:"shop_id"`
	ProductID        uuid.UUID `json:"product_id"`
	VariantID        uuid.UUID `json:"variant_id"`
	Quantity         int       `json:"quantity"`
	ReservedQuantity int       `json:"reserved_quantity"`
	Available        int       `json:"available"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type InventoryWithVariantResponse struct {
	Inventory InventoryResponse `json:"inventory"`
	Variant   VariantResponse   `json:"variant"`
	Product   ProductResponse   `json:"product"`
}

type StockMovementType string

const (
	StockMovementTypeInitial      StockMovementType = "INITIAL"
	StockMovementTypeStockIn      StockMovementType = "STOCK_IN"
	StockMovementTypeSalePhysical StockMovementType = "SALE_PHYSICAL"
	StockMovementTypeSaleOnline   StockMovementType = "SALE_ONLINE"
	StockMovementTypeAdjustment   StockMovementType = "ADJUSTMENT"
	StockMovementTypeReturn       StockMovementType = "RETURN"
	StockMovementTypeTransferIn   StockMovementType = "TRANSFER_IN"
	StockMovementTypeTransferOut  StockMovementType = "TRANSFER_OUT"
)

type StockMovement struct {
	ID               uuid.UUID         `json:"id" db:"id"`
	BusinessID       uuid.UUID         `json:"business_id" db:"business_id"`
	ShopID           uuid.UUID         `json:"shop_id" db:"shop_id"`
	ProductID        uuid.UUID         `json:"product_id" db:"product_id"`
	VariantID        *uuid.UUID        `json:"variant_id" db:"variant_id"`
	MovementType     StockMovementType `json:"movement_type" db:"movement_type"`
	Quantity         int               `json:"quantity" db:"quantity"`
	PreviousQuantity int               `json:"previous_quantity" db:"previous_quantity"`
	NewQuantity      int               `json:"new_quantity" db:"new_quantity"`
	ReferenceID      *uuid.UUID        `json:"reference_id" db:"reference_id"`
	Notes            string            `json:"notes" db:"notes"`
	PerformedBy      *uuid.UUID        `json:"performed_by" db:"performed_by"`
	EmployeeID       *uuid.UUID        `json:"employee_id" db:"employee_id"`
	CreatedAt        time.Time         `json:"created_at" db:"created_at"`
}

type StockMovementResponse struct {
	ID               uuid.UUID  `json:"id"`
	BusinessID       uuid.UUID  `json:"business_id"`
	ShopID           uuid.UUID  `json:"shop_id"`
	ProductID        uuid.UUID  `json:"product_id"`
	VariantID        *uuid.UUID `json:"variant_id"`
	MovementType     string     `json:"movement_type"`
	Quantity         int        `json:"quantity"`
	PreviousQuantity int        `json:"previous_quantity"`
	NewQuantity      int        `json:"new_quantity"`
	Notes            string     `json:"notes"`
	PerformedBy      *uuid.UUID `json:"performed_by"`
	EmployeeID       *uuid.UUID `json:"employee_id"`
	CreatedAt        time.Time  `json:"created_at"`
}

type StockMovementHistoryQuery struct {
	From       string `form:"from"`
	To         string `form:"to"`
	ProductID  string `form:"product_id"`
	VariantID  string `form:"variant_id"`
	ShopID     string `form:"shop_id"`
	Type       string `form:"type"`
	EmployeeID string `form:"employee_id"`
	Page       int    `form:"page"`
	Limit      int    `form:"limit"`
	Sort       string `form:"sort"`
}

type StockMovementShopInfo struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}

type StockMovementProductInfo struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}

type StockMovementVariantInfo struct {
	ID         uuid.UUID         `json:"id"`
	SKU        string            `json:"sku"`
	Attributes map[string]string `json:"attributes"`
}

type StockMovementPerformerInfo struct {
	EmployeeID *uuid.UUID `json:"employee_id"`
	Name       string     `json:"name"`
}

type StockMovementHistoryData struct {
	ID               uuid.UUID                `json:"id"`
	BusinessID       uuid.UUID                `json:"business_id"`
	Shop             StockMovementShopInfo    `json:"shop"`
	Product          StockMovementProductInfo `json:"product"`
	Variant          *StockMovementVariantInfo `json:"variant"`
	MovementType     string                   `json:"movement_type"`
	Quantity         int                      `json:"quantity"`
	PreviousQuantity int                      `json:"previous_quantity"`
	NewQuantity      int                      `json:"new_quantity"`
	Notes            string                   `json:"notes"`
	PerformedBy      *StockMovementPerformerInfo `json:"performed_by"`
	ReferenceType    *string                  `json:"reference_type"`
	ReferenceID      *uuid.UUID               `json:"reference_id"`
	CreatedAt        time.Time                `json:"created_at"`
}

type StockMovementHistoryResponse struct {
	Data       []StockMovementHistoryData `json:"data"`
	Pagination PaginationInfo             `json:"pagination"`
}

type PaginationInfo struct {
	Page    int `json:"page"`
	Limit   int `json:"limit"`
	Total   int `json:"total"`
	HasMore bool `json:"has_more"`
}

type StockEvent struct {
	Event            string     `json:"event"`
	BusinessID       uuid.UUID  `json:"business_id"`
	ShopID           uuid.UUID  `json:"shop_id"`
	ProductID        uuid.UUID  `json:"product_id"`
	VariantID        uuid.UUID  `json:"variant_id"`
	PreviousQuantity int        `json:"previous_quantity"`
	Change           int        `json:"change"`
	NewQuantity      int        `json:"new_quantity"`
	PerformedBy      *uuid.UUID `json:"performed_by"`
	Timestamp        time.Time  `json:"timestamp"`
}
