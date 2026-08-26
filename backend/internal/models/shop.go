package models

import (
	"time"

	"github.com/google/uuid"
)

type ShopType string

const (
	ShopTypePhysical ShopType = "PHYSICAL"
	ShopTypeOnline   ShopType = "ONLINE"
)

type ShopStatus string

const (
	ShopStatusActive    ShopStatus = "ACTIVE"
	ShopStatusInactive  ShopStatus = "INACTIVE"
	ShopStatusSuspended ShopStatus = "SUSPENDED"
)

type Shop struct {
	ID                      uuid.UUID  `json:"id" db:"id"`
	BusinessID              uuid.UUID  `json:"business_id" db:"business_id"`
	Name                    string     `json:"name" db:"name"`
	Type                    ShopType   `json:"type" db:"type"`
	City                    string     `json:"city" db:"city"`
	Address                 string     `json:"address" db:"address"`
	Phone                   string     `json:"phone" db:"phone"`
	Status                  ShopStatus `json:"status" db:"status"`
	SupportsShopDelivery    bool       `json:"supports_shop_delivery" db:"supports_shop_delivery"`
	ShopDeliveryFee         float64    `json:"shop_delivery_fee" db:"shop_delivery_fee"`
	SupportsPartnerDelivery bool       `json:"supports_partner_delivery" db:"supports_partner_delivery"`
	PartnerDeliveryFee      float64    `json:"partner_delivery_fee" db:"partner_delivery_fee"`
	PartnerDeliveryProvider string     `json:"partner_delivery_provider" db:"partner_delivery_provider"`
	DeliveryCity            string     `json:"delivery_city" db:"delivery_city"`
	DeliveryAddress         string     `json:"delivery_address" db:"delivery_address"`
	CreatedAt               time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt               time.Time  `json:"updated_at" db:"updated_at"`
}

type CreateShopRequest struct {
	Name                    string `json:"name" binding:"required"`
	Type                    string `json:"type" binding:"required,oneof=PHYSICAL ONLINE"`
	City                    string `json:"city"`
	Address                 string `json:"address"`
	Phone                   string `json:"phone"`
	SupportsShopDelivery    *bool   `json:"supports_shop_delivery"`
	ShopDeliveryFee         float64 `json:"shop_delivery_fee"`
	SupportsPartnerDelivery *bool   `json:"supports_partner_delivery"`
	PartnerDeliveryFee      float64 `json:"partner_delivery_fee"`
	PartnerDeliveryProvider string  `json:"partner_delivery_provider"`
	DeliveryCity            string  `json:"delivery_city"`
	DeliveryAddress         string  `json:"delivery_address"`
}

type UpdateShopRequest struct {
	Name                    *string `json:"name"`
	Type                    *string `json:"type" binding:"omitempty,oneof=PHYSICAL ONLINE"`
	City                    *string `json:"city"`
	Address                 *string `json:"address"`
	Phone                   *string `json:"phone"`
	Status                  *string `json:"status"`
	SupportsShopDelivery    *bool   `json:"supports_shop_delivery"`
	ShopDeliveryFee         *float64 `json:"shop_delivery_fee"`
	SupportsPartnerDelivery *bool   `json:"supports_partner_delivery"`
	PartnerDeliveryFee      *float64 `json:"partner_delivery_fee"`
	PartnerDeliveryProvider *string `json:"partner_delivery_provider"`
	DeliveryCity            *string `json:"delivery_city"`
	DeliveryAddress         *string `json:"delivery_address"`
}

type ShopResponse struct {
	ID                      uuid.UUID  `json:"id"`
	BusinessID              uuid.UUID  `json:"business_id"`
	Name                    string     `json:"name"`
	Type                    ShopType   `json:"type"`
	City                    string     `json:"city"`
	Address                 string     `json:"address"`
	Phone                   string     `json:"phone"`
	Status                  ShopStatus `json:"status"`
	SupportsShopDelivery    bool       `json:"supports_shop_delivery"`
	ShopDeliveryFee         float64    `json:"shop_delivery_fee"`
	SupportsPartnerDelivery bool       `json:"supports_partner_delivery"`
	PartnerDeliveryFee      float64    `json:"partner_delivery_fee"`
	PartnerDeliveryProvider string     `json:"partner_delivery_provider"`
	DeliveryCity            string     `json:"delivery_city"`
	DeliveryAddress         string     `json:"delivery_address"`
	CreatedAt               time.Time  `json:"created_at"`
	UpdatedAt               time.Time  `json:"updated_at"`
}
