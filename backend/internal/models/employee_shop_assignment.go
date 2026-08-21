package models

import (
	"time"

	"github.com/google/uuid"
)

type AssignmentStatus string

const (
	AssignmentStatusActive   AssignmentStatus = "ACTIVE"
	AssignmentStatusInactive AssignmentStatus = "INACTIVE"
)

type EmployeeShopAssignment struct {
	ID          uuid.UUID        `json:"id" db:"id"`
	EmployeeID  uuid.UUID        `json:"employee_id" db:"employee_id"`
	ShopID      uuid.UUID        `json:"shop_id" db:"shop_id"`
	AssignedBy  uuid.UUID        `json:"assigned_by" db:"assigned_by"`
	Status      AssignmentStatus `json:"status" db:"status"`
	AssignedAt  time.Time        `json:"assigned_at" db:"assigned_at"`
	CreatedAt   time.Time        `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at" db:"updated_at"`
}

type AssignEmployeeRequest struct {
	ShopID string `json:"shop_id" binding:"required"`
}

type AssignmentResponse struct {
	ID          uuid.UUID        `json:"id"`
	EmployeeID  uuid.UUID        `json:"employee_id"`
	ShopID      uuid.UUID        `json:"shop_id"`
	AssignedBy  uuid.UUID        `json:"assigned_by"`
	Status      AssignmentStatus `json:"status"`
	AssignedAt  time.Time        `json:"assigned_at"`
}

type ShopWithEmployeesResponse struct {
	Shop      ShopResponse       `json:"shop"`
	Employees []EmployeeResponse `json:"employees"`
}

type EmployeeWithShopsResponse struct {
	Employee EmployeeResponse `json:"employee"`
	Shops    []ShopResponse   `json:"shops"`
}
