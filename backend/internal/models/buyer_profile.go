package models

import (
	"time"

	"github.com/google/uuid"
)

type BuyerProfileStatus string

const (
	BuyerProfileStatusActive   BuyerProfileStatus = "ACTIVE"
	BuyerProfileStatusInactive BuyerProfileStatus = "INACTIVE"
	BuyerProfileStatusBlocked  BuyerProfileStatus = "BLOCKED"
)

type BuyerProfile struct {
	ID             uuid.UUID          `json:"id" db:"id"`
	UserID         uuid.UUID          `json:"user_id" db:"user_id"`
	FirstName      string             `json:"first_name" db:"first_name"`
	LastName       string             `json:"last_name" db:"last_name"`
	Phone          string             `json:"phone" db:"phone"`
	BackupPhone    string             `json:"backup_phone" db:"backup_phone"`
	Address        string             `json:"address" db:"address"`
	Province       string             `json:"province" db:"province"`
	Street         string             `json:"street" db:"street"`
	BuildingNumber string             `json:"building_number" db:"building_number"`
	Landmark       string             `json:"landmark" db:"landmark"`
	Email          string             `json:"email" db:"email"`
	City           string             `json:"city" db:"city"`
	Commune        string             `json:"commune" db:"commune"`
	ProvinceID     *uuid.UUID         `json:"province_id" db:"province_id"`
	CityID         *uuid.UUID         `json:"city_id" db:"city_id"`
	CommuneID      *uuid.UUID         `json:"commune_id" db:"commune_id"`
	Country        string             `json:"country" db:"country"`
	Latitude       *float64           `json:"latitude" db:"latitude"`
	Longitude      *float64           `json:"longitude" db:"longitude"`
	Status         BuyerProfileStatus `json:"status" db:"status"`
	CreatedAt      time.Time          `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time          `json:"updated_at" db:"updated_at"`
}

type CreateBuyerProfileRequest struct {
	FirstName      string   `json:"first_name" binding:"required"`
	LastName       string   `json:"last_name" binding:"required"`
	Phone          string   `json:"phone" binding:"required"`
	BackupPhone    string   `json:"backup_phone"`
	Address        string   `json:"address"`
	Province       string   `json:"province"`
	Street         string   `json:"street"`
	BuildingNumber string   `json:"building_number"`
	Landmark       string   `json:"landmark"`
	Email          string   `json:"email" binding:"required,email"`
	City           string   `json:"city"`
	Commune        string   `json:"commune"`
	ProvinceID     string   `json:"province_id"`
	CityID         string   `json:"city_id"`
	CommuneID      string   `json:"commune_id"`
	Country        string   `json:"country"`
	Latitude       *float64 `json:"latitude"`
	Longitude      *float64 `json:"longitude"`
}

type UpdateBuyerProfileRequest struct {
	FirstName      *string  `json:"first_name"`
	LastName       *string  `json:"last_name"`
	Phone          *string  `json:"phone"`
	BackupPhone    *string  `json:"backup_phone"`
	Address        *string  `json:"address"`
	Province       *string  `json:"province"`
	Street         *string  `json:"street"`
	BuildingNumber *string  `json:"building_number"`
	Landmark       *string  `json:"landmark"`
	City           *string  `json:"city"`
	Commune        *string  `json:"commune"`
	ProvinceID     *string  `json:"province_id"`
	CityID         *string  `json:"city_id"`
	CommuneID      *string  `json:"commune_id"`
	Country        *string  `json:"country"`
	Latitude       *float64 `json:"latitude"`
	Longitude      *float64 `json:"longitude"`
}

type BuyerProfileResponse struct {
	ID             uuid.UUID  `json:"id"`
	UserID         uuid.UUID  `json:"user_id"`
	FirstName      string     `json:"first_name"`
	LastName       string     `json:"last_name"`
	Phone          string     `json:"phone"`
	BackupPhone    string     `json:"backup_phone"`
	Address        string     `json:"address"`
	Province       string     `json:"province"`
	Street         string     `json:"street"`
	BuildingNumber string     `json:"building_number"`
	Landmark       string     `json:"landmark"`
	Email          string     `json:"email"`
	City           string     `json:"city"`
	Commune        string     `json:"commune"`
	ProvinceID     *uuid.UUID `json:"province_id,omitempty"`
	CityID         *uuid.UUID `json:"city_id,omitempty"`
	CommuneID      *uuid.UUID `json:"commune_id,omitempty"`
	Country        string     `json:"country"`
	Latitude       *float64   `json:"latitude,omitempty"`
	Longitude      *float64   `json:"longitude,omitempty"`
	Status         string     `json:"status"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type BuyerProfileViewResponse struct {
	Profile           BuyerProfileResponse `json:"profile"`
	CurrentPoints     int                  `json:"current_points"`
	LifetimePoints    int                  `json:"lifetime_points"`
	CurrentLevel      string               `json:"current_level"`
	ProgressToNext    float64              `json:"progress_to_next_level_percent"`
	VerifiedPurchases int                  `json:"verified_purchases"`
	PurchaseHistory   int                  `json:"purchase_history"`
	AvailableBenefits []LevelBenefitInfo   `json:"available_benefits"`
}

// SavedDeliveryAddress is the validated, canonical form of the RDC delivery
// address that checkout persists onto a buyer profile. Names come from the
// hierarchy, never from the client; the ids keep the province -> city ->
// commune chain resolvable on every later checkout.
type SavedDeliveryAddress struct {
	Province       string    `json:"province"`
	City           string    `json:"city"`
	Commune        string    `json:"commune"`
	ProvinceID     uuid.UUID `json:"province_id"`
	CityID         uuid.UUID `json:"city_id"`
	CommuneID      uuid.UUID `json:"commune_id"`
	Street         string    `json:"street"`
	BuildingNumber string    `json:"building_number"`
	Landmark       string    `json:"landmark"`
	Address        string    `json:"address"`
}

type LevelBenefitInfo struct {
	BenefitType  string  `json:"benefit_type"`
	BenefitValue float64 `json:"benefit_value"`
}
