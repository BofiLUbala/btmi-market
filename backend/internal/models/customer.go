package models

import (
	"time"

	"github.com/google/uuid"
)

type CustomerStatus string

const (
	CustomerStatusActive   CustomerStatus = "ACTIVE"
	CustomerStatusInactive CustomerStatus = "INACTIVE"
	CustomerStatusBlocked  CustomerStatus = "BLOCKED"
)

type Customer struct {
	ID         uuid.UUID      `json:"id" db:"id"`
	BusinessID uuid.UUID      `json:"business_id" db:"business_id"`
	FirstName  string         `json:"first_name" db:"first_name"`
	LastName   string         `json:"last_name" db:"last_name"`
	Phone      *string        `json:"phone" db:"phone"`
	Email      *string        `json:"email" db:"email"`
	Status     CustomerStatus `json:"status" db:"status"`
	CreatedAt  time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at" db:"updated_at"`
}

type CreateCustomerRequest struct {
	FirstName string  `json:"first_name" binding:"required"`
	LastName  string  `json:"last_name" binding:"required"`
	Phone     *string `json:"phone"`
	Email     *string `json:"email"`
}

type UpdateCustomerRequest struct {
	FirstName *string `json:"first_name"`
	LastName  *string `json:"last_name"`
	Phone     *string `json:"phone"`
	Email     *string `json:"email"`
	Status    *string `json:"status"`
}

type CustomerResponse struct {
	ID         uuid.UUID `json:"id"`
	BusinessID uuid.UUID `json:"business_id"`
	FirstName  string    `json:"first_name"`
	LastName   string    `json:"last_name"`
	Phone      *string   `json:"phone"`
	Email      *string   `json:"email"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type CustomerSummaryResponse struct {
	Customer       CustomerResponse `json:"customer"`
	TotalOrders    int              `json:"total_orders"`
	TotalPurchased float64          `json:"total_purchased"`
	FirstPurchase  *time.Time       `json:"first_purchase"`
	LastPurchase   *time.Time       `json:"last_purchase"`
	ShopsUsed      []ShopInfo       `json:"shops_used"`
}

type ShopInfo struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}

type CustomerOrderResponse struct {
	ID         uuid.UUID `json:"id"`
	ShopID     uuid.UUID `json:"shop_id"`
	ShopName   string    `json:"shop_name"`
	Status     string    `json:"status"`
	TotalItems int       `json:"total_items"`
	TotalCost  float64   `json:"total_cost"`
	Notes      string    `json:"notes"`
	CreatedAt  time.Time `json:"created_at"`
}

type CustomerListResponse struct {
	Data       []CustomerSummaryResponse `json:"data"`
	Pagination PaginationInfo            `json:"pagination"`
}

type PaginatedCustomerOrders struct {
	Data       []*CustomerOrderResponse `json:"data"`
	Pagination PaginationInfo           `json:"pagination"`
}
