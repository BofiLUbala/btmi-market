package models

import (
	"time"

	"github.com/google/uuid"
)

// ProductVideo is the optional explainer video of a Product (at most one).
type ProductVideo struct {
	ID         uuid.UUID `json:"id" db:"id"`
	BusinessID uuid.UUID `json:"business_id" db:"business_id"`
	ProductID  uuid.UUID `json:"product_id" db:"product_id"`
	URL        string    `json:"url" db:"url"`
	FileName   string    `json:"file_name" db:"file_name"`
	MimeType   string    `json:"mime_type" db:"mime_type"`
	SizeBytes  int64     `json:"size_bytes" db:"size_bytes"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

type ProductVideoResponse struct {
	ID        uuid.UUID `json:"id"`
	ProductID uuid.UUID `json:"product_id"`
	URL       string    `json:"url"`
	FileName  string    `json:"file_name"`
	MimeType  string    `json:"mime_type"`
	SizeBytes int64     `json:"size_bytes"`
	CreatedAt time.Time `json:"created_at"`
}
