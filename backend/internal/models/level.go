package models

import (
	"time"

	"github.com/google/uuid"
)

type SellerLevel struct {
	ID                     uuid.UUID `json:"id" db:"id"`
	Name                   string    `json:"name" db:"name"`
	MinPoints              int       `json:"min_points" db:"min_points"`
	MaxPoints              int       `json:"max_points" db:"max_points"`
	SearchBoost            float64   `json:"search_boost" db:"search_boost"`
	RecommendationEligible bool      `json:"recommendation_eligible" db:"recommendation_eligible"`
	HighValueBuyerAccess   bool      `json:"high_value_buyer_access" db:"high_value_buyer_access"`
	Description            string    `json:"description" db:"description"`
	CreatedAt              time.Time `json:"created_at" db:"created_at"`
}

type BuyerLevel struct {
	ID                     uuid.UUID `json:"id" db:"id"`
	Name                   string    `json:"name" db:"name"`
	MinPoints              int       `json:"min_points" db:"min_points"`
	MaxPoints              int       `json:"max_points" db:"max_points"`
	DiscountPercent        float64   `json:"discount_percent" db:"discount_percent"`
	DeliveryDiscountPercent float64  `json:"delivery_discount_percent" db:"delivery_discount_percent"`
	FreeDelivery           bool      `json:"free_delivery" db:"free_delivery"`
	Description            string    `json:"description" db:"description"`
	CreatedAt              time.Time `json:"created_at" db:"created_at"`
}

type LevelBenefit struct {
	ID           uuid.UUID `json:"id" db:"id"`
	LevelType    string    `json:"level_type" db:"level_type"`
	LevelName    string    `json:"level_name" db:"level_name"`
	BenefitType  string    `json:"benefit_type" db:"benefit_type"`
	BenefitValue float64   `json:"benefit_value" db:"benefit_value"`
	Status       string    `json:"status" db:"status"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}
