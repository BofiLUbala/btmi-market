package models

import (
	"time"

	"github.com/google/uuid"
)

type CashPaymentStatus string

const (
	CashPaymentStatusPending   CashPaymentStatus = "PENDING"
	CashPaymentStatusConfirmed CashPaymentStatus = "CONFIRMED"
	CashPaymentStatusCancelled CashPaymentStatus = "CANCELLED"
	CashPaymentStatusRefunded  CashPaymentStatus = "REFUNDED"
)

type CashReferenceType string

const (
	CashReferenceTypeSale  CashReferenceType = "SALE"
	CashReferenceTypeOrder CashReferenceType = "ORDER"
)

type CashPayment struct {
	ID             uuid.UUID         `json:"id" db:"id"`
	BusinessID     uuid.UUID         `json:"business_id" db:"business_id"`
	ShopID         uuid.UUID         `json:"shop_id" db:"shop_id"`
	EmployeeID     *uuid.UUID        `json:"employee_id" db:"employee_id"`
	CustomerID     *uuid.UUID        `json:"customer_id" db:"customer_id"`
	CashSessionID  *uuid.UUID        `json:"cash_session_id" db:"cash_session_id"`
	ReferenceType  CashReferenceType `json:"reference_type" db:"reference_type"`
	ReferenceID    uuid.UUID         `json:"reference_id" db:"reference_id"`
	Amount         float64           `json:"amount" db:"amount"`
	Currency       string            `json:"currency" db:"currency"`
	Status         CashPaymentStatus `json:"status" db:"status"`
	CreatedAt      time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time         `json:"updated_at" db:"updated_at"`
}

type CreateCashPaymentRequest struct {
	ShopID         string  `json:"shop_id" binding:"required"`
	CustomerID     *string `json:"customer_id"`
	ReferenceType  string  `json:"reference_type" binding:"required"`
	ReferenceID    string  `json:"reference_id" binding:"required"`
	Amount         float64 `json:"amount" binding:"required,gt=0"`
	Currency       string  `json:"currency"`
}

type CashPaymentResponse struct {
	ID             uuid.UUID          `json:"id"`
	BusinessID     uuid.UUID          `json:"business_id"`
	ShopID         uuid.UUID          `json:"shop_id"`
	ShopName       string             `json:"shop_name,omitempty"`
	EmployeeID     *uuid.UUID         `json:"employee_id"`
	EmployeeName   string             `json:"employee_name,omitempty"`
	CustomerID     *uuid.UUID         `json:"customer_id"`
	CustomerName   string             `json:"customer_name,omitempty"`
	CashSessionID  *uuid.UUID         `json:"cash_session_id"`
	ReferenceType  string             `json:"reference_type"`
	ReferenceID    uuid.UUID          `json:"reference_id"`
	Amount         float64            `json:"amount"`
	Currency       string             `json:"currency"`
	Status         string             `json:"status"`
	CreatedAt      time.Time          `json:"created_at"`
}

type CashPaymentListResponse struct {
	Payments   []CashPaymentResponse `json:"payments"`
	Pagination PaginationInfo        `json:"pagination"`
}
