package models

import (
	"time"

	"github.com/google/uuid"
)

// CategoryAttributeDefinition represents the database-backed attribute configuration for a category/subcategory.
type CategoryAttributeDefinition struct {
	ID               uuid.UUID  `json:"id" db:"id"`
	CategoryID       uuid.UUID  `json:"category_id" db:"category_id"`
	SubcategoryID    *uuid.UUID `json:"subcategory_id,omitempty" db:"subcategory_id"`
	Key              string     `json:"key" db:"key"`
	LabelEn          string     `json:"label_en" db:"label_en"`
	LabelFr          string     `json:"label_fr" db:"label_fr"`
	Required         bool       `json:"required" db:"required"`
	VariantAttribute bool       `json:"variant_attribute" db:"variant_attribute"`
	InputType        string     `json:"input_type" db:"input_type"`
	AllowedValues    []string   `json:"allowed_values" db:"allowed_values"`
	DisplayOrder     int        `json:"display_order" db:"display_order"`
	Status           string     `json:"status" db:"status"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`
}

// CategoryAttributeResponse is the API response payload for GET /categories/:id/attributes
type CategoryAttributeResponse struct {
	ID               uuid.UUID  `json:"id"`
	CategoryID       uuid.UUID  `json:"category_id"`
	SubcategoryID    *uuid.UUID `json:"subcategory_id,omitempty"`
	Key              string     `json:"key"`
	LabelEn          string     `json:"label_en"`
	LabelFr          string     `json:"label_fr"`
	Required         bool       `json:"required"`
	VariantAttribute bool       `json:"variant_attribute"`
	InputType        string     `json:"input_type"`
	AllowedValues    []string   `json:"allowed_values"`
	DisplayOrder     int        `json:"display_order"`
}

// MissingAttributesError is a structured error detailing missing required attributes for publication.
// It implements the error interface so it can be returned as an error and type-asserted in handlers.
type MissingAttributesError struct {
	CategoryID      string   `json:"category_id"`
	CategorySlug    string   `json:"category"`
	SubcategorySlug string   `json:"subcategory,omitempty"`
	MissingKeys     []string `json:"missing_keys"`
	MissingLabelsFr []string `json:"missing_labels_fr"`
}

func (e *MissingAttributesError) Error() string {
	if len(e.MissingLabelsFr) > 0 {
		labels := ""
		for i, l := range e.MissingLabelsFr {
			if i > 0 {
				labels += ", "
			}
			labels += l
		}
		return "Complétez les caractéristiques obligatoires avant de publier : " + labels + "."
	}
	if len(e.MissingKeys) > 0 {
		keys := ""
		for i, k := range e.MissingKeys {
			if i > 0 {
				keys += ", "
			}
			keys += k
		}
		return "MISSING_REQUIRED_ATTRIBUTES: " + keys
	}
	return "MISSING_REQUIRED_ATTRIBUTES"
}
