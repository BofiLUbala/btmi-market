package models

import (
	"time"

	"github.com/google/uuid"
)

type ProductStatus string

const (
	ProductStatusActive       ProductStatus = "ACTIVE"
	ProductStatusInactive     ProductStatus = "INACTIVE"
	ProductStatusDiscontinued ProductStatus = "DISCONTINUED"
)

type Product struct {
	ID                uuid.UUID         `json:"id" db:"id"`
	BusinessID        uuid.UUID         `json:"business_id" db:"business_id"`
	Name              string            `json:"name" db:"name"`
	SKU               string            `json:"sku" db:"sku"`
	Description       string            `json:"description" db:"description"`
	UnitPrice         float64           `json:"unit_price" db:"unit_price"`
	CostPrice         float64           `json:"cost_price" db:"cost_price"`
	Unit              string            `json:"unit" db:"unit"`
	Status            ProductStatus     `json:"status" db:"status"`
	PublicationStatus PublicationStatus `json:"publication_status" db:"publication_status"`
	CategoryID        *uuid.UUID        `json:"category_id,omitempty" db:"category_id"`
	SubcategoryID     *uuid.UUID        `json:"subcategory_id,omitempty" db:"subcategory_id"`
	DiscountActive    bool              `json:"discount_active" db:"discount_active"`
	DiscountType      string            `json:"discount_type" db:"discount_type"`
	DiscountValue     float64           `json:"discount_value" db:"discount_value"`
	DiscountStart     *time.Time        `json:"discount_start" db:"discount_start"`
	DiscountEnd       *time.Time        `json:"discount_end" db:"discount_end"`
	SelfRating        *int              `json:"self_rating" db:"self_rating"`
	CreatedAt         time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time         `json:"updated_at" db:"updated_at"`
}

type CreateProductRequest struct {
	Name              string     `json:"name" binding:"required"`
	SKU               string     `json:"sku"`
	Description       string     `json:"description"`
	UnitPrice         float64    `json:"unit_price"`
	CostPrice         float64    `json:"cost_price"`
	Unit              string     `json:"unit"`
	CategoryID        *string    `json:"category_id"`
	SubcategoryID     *string    `json:"subcategory_id"`
	PublicationStatus string     `json:"publication_status"`
	DiscountActive    bool       `json:"discount_active"`
	DiscountType      string     `json:"discount_type"`
	DiscountValue     float64    `json:"discount_value"`
	DiscountStart     *time.Time `json:"discount_start"`
	DiscountEnd       *time.Time `json:"discount_end"`
	// SelfRating is the seller's own 1-5 star claim about this Product, set
	// once at creation and required — distinct from the buyer-review average.
	SelfRating int `json:"self_rating" binding:"required,min=1,max=5"`
}

type UpdateProductRequest struct {
	Name              *string    `json:"name"`
	SKU               *string    `json:"sku"`
	Description       *string    `json:"description"`
	UnitPrice         *float64   `json:"unit_price"`
	CostPrice         *float64   `json:"cost_price"`
	Unit              *string    `json:"unit"`
	Status            *string    `json:"status"`
	PublicationStatus *string    `json:"publication_status"`
	CategoryID        *string    `json:"category_id"`
	SubcategoryID     *string    `json:"subcategory_id"`
	DiscountActive    *bool      `json:"discount_active"`
	DiscountType      *string    `json:"discount_type"`
	DiscountValue     *float64   `json:"discount_value"`
	DiscountStart     *time.Time `json:"discount_start"`
	DiscountEnd       *time.Time `json:"discount_end"`
	SelfRating        *int       `json:"self_rating"`
}

type ProductResponse struct {
	ID                uuid.UUID         `json:"id"`
	BusinessID        uuid.UUID         `json:"business_id"`
	Name              string            `json:"name"`
	SKU               string            `json:"sku"`
	Description       string            `json:"description"`
	UnitPrice         float64           `json:"unit_price"`
	CostPrice         float64           `json:"cost_price"`
	Unit              string            `json:"unit"`
	Status            ProductStatus     `json:"status"`
	PublicationStatus PublicationStatus `json:"publication_status"`
	CategoryID        *uuid.UUID        `json:"category_id,omitempty"`
	SubcategoryID     *uuid.UUID        `json:"subcategory_id,omitempty"`
	CategoryName      string            `json:"category_name,omitempty"`
	VariantCount      int               `json:"variant_count,omitempty"`
	TotalQuantity     int               `json:"total_quantity,omitempty"`
	ReservedQuantity  int               `json:"reserved_quantity,omitempty"`
	AvailableQuantity int               `json:"available_quantity,omitempty"`
	DiscountActive    bool              `json:"discount_active"`
	DiscountType      string            `json:"discount_type"`
	DiscountValue     float64           `json:"discount_value"`
	DiscountStart     *time.Time        `json:"discount_start,omitempty"`
	DiscountEnd       *time.Time        `json:"discount_end,omitempty"`
	SelfRating        *int              `json:"self_rating,omitempty"`
	CreatedAt         time.Time         `json:"created_at"`
	UpdatedAt         time.Time         `json:"updated_at"`
}
