package models

import (
	"time"

	"github.com/google/uuid"
)

type ProductImage struct {
	ID         uuid.UUID `json:"id" db:"id"`
	BusinessID uuid.UUID `json:"business_id" db:"business_id"`
	ProductID  uuid.UUID `json:"product_id" db:"product_id"`
	URL        string    `json:"url" db:"url"`
	FileName   string    `json:"file_name" db:"file_name"`
	SortOrder  int       `json:"sort_order" db:"sort_order"`
	IsPrimary  bool      `json:"is_primary" db:"is_primary"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

type ProductImageResponse struct {
	ID        uuid.UUID `json:"id"`
	ProductID uuid.UUID `json:"product_id"`
	URL       string    `json:"url"`
	FileName  string    `json:"file_name"`
	SortOrder int       `json:"sort_order"`
	IsPrimary bool      `json:"is_primary"`
	CreatedAt time.Time `json:"created_at"`
}
