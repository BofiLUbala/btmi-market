package models

import (
	"time"

	"github.com/google/uuid"
)

type CashSessionStatus string

const (
	CashSessionStatusOpen       CashSessionStatus = "OPEN"
	CashSessionStatusClosed     CashSessionStatus = "CLOSED"
	CashSessionStatusReconciled CashSessionStatus = "RECONCILED"
)

type CashSession struct {
	ID                     uuid.UUID         `json:"id" db:"id"`
	BusinessID             uuid.UUID         `json:"business_id" db:"business_id"`
	ShopID                 uuid.UUID         `json:"shop_id" db:"shop_id"`
	EmployeeID             *uuid.UUID        `json:"employee_id" db:"employee_id"`
	OpenedAt               time.Time         `json:"opened_at" db:"opened_at"`
	ClosedAt               *time.Time        `json:"closed_at" db:"closed_at"`
	OpeningAmount          float64           `json:"opening_amount" db:"opening_amount"`
	Currency               string            `json:"currency" db:"currency"`
	CashSalesTotal         float64           `json:"cash_sales_total" db:"cash_sales_total"`
	ExpectedAmount         float64           `json:"expected_amount" db:"expected_amount"`
	DeclaredClosingAmount  *float64          `json:"declared_closing_amount" db:"declared_closing_amount"`
	Difference             *float64          `json:"difference" db:"difference"`
	ReconciliationResult   *string           `json:"reconciliation_result" db:"reconciliation_result"`
	Status                 CashSessionStatus `json:"status" db:"status"`
	CreatedAt              time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt              time.Time         `json:"updated_at" db:"updated_at"`
}

type OpenCashSessionRequest struct {
	OpeningAmount float64 `json:"opening_amount" binding:"required,gte=0"`
	Currency      string  `json:"currency"`
}

type CloseCashSessionRequest struct {
	DeclaredClosingAmount float64 `json:"declared_closing_amount" binding:"required"`
}

type CashSessionResponse struct {
	ID                     uuid.UUID  `json:"id"`
	BusinessID             uuid.UUID  `json:"business_id"`
	ShopID                 uuid.UUID  `json:"shop_id"`
	EmployeeID             *uuid.UUID `json:"employee_id"`
	ShopName               string     `json:"shop_name,omitempty"`
	EmployeeFirstName      string     `json:"employee_first_name,omitempty"`
	EmployeeLastName       string     `json:"employee_last_name,omitempty"`
	OpenedAt               time.Time  `json:"opened_at"`
	ClosedAt               *time.Time `json:"closed_at"`
	OpeningAmount          float64    `json:"opening_amount"`
	Currency               string     `json:"currency"`
	CashSalesTotal         float64    `json:"cash_sales_total"`
	ExpectedAmount         float64    `json:"expected_amount"`
	DeclaredClosingAmount  *float64   `json:"declared_closing_amount"`
	Difference             *float64   `json:"difference"`
	ReconciliationResult   *string    `json:"reconciliation_result"`
	Status                 string     `json:"status"`
	CreatedAt              time.Time  `json:"created_at"`
}

type CashSessionListResponse struct {
	Sessions   []CashSessionResponse `json:"sessions"`
	Pagination PaginationInfo        `json:"pagination"`
}

type CashSummaryShop struct {
	ShopID             uuid.UUID  `json:"shop_id"`
	ShopName           string     `json:"shop_name"`
	TotalCashSales     float64    `json:"total_cash_sales"`
	OpenSessions       int        `json:"open_sessions"`
	ClosedSessions     int        `json:"closed_sessions"`
	TotalShortage      float64    `json:"total_shortage"`
	TotalOverage       float64    `json:"total_overage"`
	SellerBreakdown    []CashSummarySeller `json:"seller_breakdown"`
}

type CashSummarySeller struct {
	EmployeeID        uuid.UUID `json:"employee_id"`
	FirstName         string    `json:"first_name"`
	LastName          string    `json:"last_name"`
	TotalCashSales    float64   `json:"total_cash_sales"`
	OpenSessions      int       `json:"open_sessions"`
	ClosedSessions    int       `json:"closed_sessions"`
	TotalShortage     float64   `json:"total_shortage"`
	TotalOverage      float64   `json:"total_overage"`
}

type CashSummaryResponse struct {
	BusinessID      uuid.UUID            `json:"business_id"`
	TotalCashSales  float64              `json:"total_cash_sales"`
	ShopBreakdown   []CashSummaryShop    `json:"shop_breakdown"`
	SellerBreakdown []CashSummarySeller  `json:"seller_breakdown"`
}
