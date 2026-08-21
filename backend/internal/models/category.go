package models

import (
	"time"

	"github.com/google/uuid"
)

type Category struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	Slug      string    `json:"slug" db:"slug"`
	Status    string    `json:"status" db:"status"`
	SortOrder int       `json:"sort_order" db:"sort_order"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type Subcategory struct {
	ID         uuid.UUID `json:"id" db:"id"`
	CategoryID uuid.UUID `json:"category_id" db:"category_id"`
	Name       string    `json:"name" db:"name"`
	Slug       string    `json:"slug" db:"slug"`
	Status     string    `json:"status" db:"status"`
	SortOrder  int       `json:"sort_order" db:"sort_order"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

type PublicationStatus string

const (
	PublicationStatusDraft     PublicationStatus = "DRAFT"
	PublicationStatusPublished PublicationStatus = "PUBLISHED"
	PublicationStatusArchived  PublicationStatus = "ARCHIVED"
)

type SubcategoryResponse struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	SortOrder int       `json:"sort_order"`
}

type CategoryResponse struct {
	ID          uuid.UUID             `json:"id"`
	Name        string                `json:"name"`
	Slug        string                `json:"slug"`
	SortOrder   int                   `json:"sort_order"`
	Subcategories []SubcategoryResponse `json:"subcategories,omitempty"`
}

type CategoryWithSubcategories struct {
	ID          uuid.UUID
	Name        string
	Slug        string
	Status      string
	SortOrder   int
	CreatedAt   time.Time
	UpdatedAt   time.Time
	Subcategories []*Subcategory
}
