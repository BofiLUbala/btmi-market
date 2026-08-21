package models

import (
	"time"

	"github.com/google/uuid"
)

type BusinessStatus string

const (
	BusinessStatusActive      BusinessStatus = "ACTIVE"
	BusinessStatusSuspended   BusinessStatus = "SUSPENDED"
	BusinessStatusDeactivated BusinessStatus = "DEACTIVATED"
)

type BusinessType string

const (
	BusinessTypeRetail        BusinessType = "RETAIL"
	BusinessTypeWholesale     BusinessType = "WHOLESALE"
	BusinessTypeManufacturing BusinessType = "MANUFACTURING"
	BusinessTypeServices      BusinessType = "SERVICES"
	BusinessTypeOther         BusinessType = "OTHER"
)

type Business struct {
	ID               uuid.UUID      `json:"id" db:"id"`
	Name             string         `json:"name" db:"name"`
	BusinessType     BusinessType   `json:"business_type" db:"business_type"`
	Category         string         `json:"category" db:"category"`
	Phone            string         `json:"phone" db:"phone"`
	Whatsapp         string         `json:"whatsapp" db:"whatsapp"`
	Email            string         `json:"email" db:"email"`
	Country          string         `json:"country" db:"country"`
	City             string         `json:"city" db:"city"`
	DefaultCurrency  string         `json:"default_currency" db:"default_currency"`
	Status           BusinessStatus `json:"status" db:"status"`
	CreatedAt        time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at" db:"updated_at"`
}

type CreateBusinessRequest struct {
	Name            string `json:"name" binding:"required"`
	BusinessType    string `json:"business_type" binding:"required"`
	Category        string `json:"category" binding:"required"`
	Phone           string `json:"phone" binding:"required"`
	Whatsapp        string `json:"whatsapp"`
	Email           string `json:"email" binding:"required,email"`
	Country         string `json:"country" binding:"required"`
	City            string `json:"city" binding:"required"`
	DefaultCurrency string `json:"default_currency" binding:"required"`
}

type BusinessResponse struct {
	ID               uuid.UUID      `json:"id"`
	Name             string         `json:"name"`
	BusinessType     BusinessType   `json:"business_type"`
	Category         string         `json:"category"`
	Phone            string         `json:"phone"`
	Whatsapp         string         `json:"whatsapp"`
	Email            string         `json:"email"`
	Country          string         `json:"country"`
	City             string         `json:"city"`
	DefaultCurrency  string         `json:"default_currency"`
	Status           BusinessStatus `json:"status"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
}
