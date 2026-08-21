package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type VariantStatus string

const (
	VariantStatusActive       VariantStatus = "ACTIVE"
	VariantStatusInactive     VariantStatus = "INACTIVE"
	VariantStatusDiscontinued VariantStatus = "DISCONTINUED"
)

type JSONMap map[string]string

func (m JSONMap) Value() (driver.Value, error) {
	if m == nil {
		return "{}", nil
	}
	return json.Marshal(m)
}

func (m *JSONMap) Scan(src interface{}) error {
	if src == nil {
		*m = make(map[string]string)
		return nil
	}
	bytes, ok := src.([]byte)
	if !ok {
		*m = make(map[string]string)
		return nil
	}
	return json.Unmarshal(bytes, m)
}

type ProductVariant struct {
	ID            uuid.UUID `json:"id" db:"id"`
	ProductID     uuid.UUID `json:"product_id" db:"product_id"`
	SKU           string    `json:"sku" db:"sku"`
	Name          string    `json:"name" db:"name"`
	Attributes    JSONMap   `json:"attributes" db:"attributes"`
	SalePrice     float64   `json:"sale_price" db:"sale_price"`
	PurchasePrice float64   `json:"purchase_price" db:"purchase_price"`
	Barcode       string    `json:"barcode" db:"barcode"`
	Unit          string    `json:"unit" db:"unit"`
	Status        VariantStatus `json:"status" db:"status"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

type CreateVariantRequest struct {
	SKU           string            `json:"sku"`
	Name          string            `json:"name"`
	Attributes    map[string]string `json:"attributes"`
	SalePrice     float64           `json:"sale_price" binding:"required"`
	PurchasePrice float64           `json:"purchase_price"`
	Barcode       string            `json:"barcode"`
	Unit          string            `json:"unit"`
}

type UpdateVariantRequest struct {
	SKU           *string           `json:"sku"`
	Name          *string           `json:"name"`
	Attributes    map[string]string `json:"attributes"`
	SalePrice     *float64          `json:"sale_price"`
	PurchasePrice *float64          `json:"purchase_price"`
	Barcode       *string           `json:"barcode"`
	Unit          *string           `json:"unit"`
	Status        *string           `json:"status"`
}

type VariantResponse struct {
	ID            uuid.UUID         `json:"id"`
	ProductID     uuid.UUID         `json:"product_id"`
	SKU           string            `json:"sku"`
	Name          string            `json:"name"`
	Attributes    map[string]string `json:"attributes"`
	SalePrice     float64           `json:"sale_price"`
	PurchasePrice float64           `json:"purchase_price"`
	Barcode       string            `json:"barcode"`
	Unit          string            `json:"unit"`
	Status        VariantStatus     `json:"status"`
	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
}

type VariantWithInventoryResponse struct {
	Variant   VariantResponse   `json:"variant"`
	Product   ProductResponse   `json:"product"`
	Inventory InventoryResponse `json:"inventory"`
}

func (pv *ProductVariant) ScanAttributes(src interface{}) error {
	if src == nil {
		pv.Attributes = make(JSONMap)
		return nil
	}
	bytes, ok := src.([]byte)
	if !ok {
		return fmt.Errorf("cannot scan %T into JSONMap", src)
	}
	return json.Unmarshal(bytes, &pv.Attributes)
}
