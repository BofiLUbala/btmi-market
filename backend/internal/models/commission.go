package models

import (
	"time"

	"github.com/google/uuid"
)

type CommissionStatus string

const (
	CommissionStatusDue       CommissionStatus = "DUE"       // À reverser
	CommissionStatusCollected CommissionStatus = "COLLECTED" // Réglée
	CommissionStatusWaived    CommissionStatus = "WAIVED"    // Exonérée
	CommissionStatusAdjusted  CommissionStatus = "ADJUSTED"  // Ajustée
)

// SaleCommission represents a per-sale financial snapshot of TBK platform commission.
type SaleCommission struct {
	ID               uuid.UUID        `json:"id" db:"id"`
	OrderID          uuid.UUID        `json:"order_id" db:"order_id"`
	OrderNumber      string           `json:"order_number,omitempty" db:"order_number"`
	PaymentID        *uuid.UUID       `json:"payment_id,omitempty" db:"payment_id"`
	BusinessID       uuid.UUID        `json:"business_id" db:"business_id"`
	BusinessName     string           `json:"business_name,omitempty" db:"business_name"`
	ShopID           uuid.UUID        `json:"shop_id" db:"shop_id"`
	ShopName         string           `json:"shop_name,omitempty" db:"shop_name"`
	SellerUserID     *uuid.UUID       `json:"seller_user_id,omitempty" db:"seller_user_id"`
	SellerName       string           `json:"seller_name,omitempty" db:"seller_name"`
	GrossAmount      float64          `json:"gross_amount" db:"gross_amount"`
	CommissionBase   float64          `json:"commission_base" db:"commission_base"`
	CommissionRate   float64          `json:"commission_rate" db:"commission_rate"`
	CommissionAmount float64          `json:"commission_amount" db:"commission_amount"`
	SellerNetAmount  float64          `json:"seller_net_amount" db:"seller_net_amount"`
	Status           CommissionStatus `json:"status" db:"status"`
	CalculatedAt     time.Time        `json:"calculated_at" db:"calculated_at"`
	CollectedAt      *time.Time       `json:"collected_at,omitempty" db:"collected_at"`
	CollectedBy      *uuid.UUID       `json:"collected_by,omitempty" db:"collected_by"`
	CollectorName    string           `json:"collector_name,omitempty" db:"collector_name"`
	Notes            string           `json:"notes" db:"notes"`
	CreatedAt        time.Time        `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time        `json:"updated_at" db:"updated_at"`
}

// CommissionConfig represents the global platform commission configuration.
type CommissionConfig struct {
	Rate      float64             `json:"rate"`
	UpdatedAt time.Time           `json:"updated_at"`
	UpdatedBy *uuid.UUID          `json:"updated_by,omitempty"`
	History   []CommissionHistory `json:"history,omitempty"`
}

// CommissionHistory records audits when Finance Admin modifies the platform rate.
type CommissionHistory struct {
	ID        uuid.UUID  `json:"id"`
	OldRate   float64    `json:"old_rate"`
	NewRate   float64    `json:"new_rate"`
	ChangedBy *uuid.UUID `json:"changed_by,omitempty"`
	AdminName string     `json:"admin_name,omitempty"`
	Reason    string     `json:"reason"`
	CreatedAt time.Time  `json:"created_at"`
}

// CommissionSummary represents aggregate financial metrics for Finance Admin.
type CommissionSummary struct {
	GrossSales           float64 `json:"gross_sales"`
	TotalCommission      float64 `json:"total_commission"`
	CollectedCommission  float64 `json:"collected_commission"`
	DueCommission        float64 `json:"due_commission"`
	SellerNetRevenue     float64 `json:"seller_net_revenue"`
	TotalVerifiedSales   int     `json:"total_verified_sales"`
}

// SellerFinanceSummary represents aggregate financial metrics for a specific Seller.
type SellerFinanceSummary struct {
	GrossSales           float64 `json:"gross_sales"`
	TBKCommissionTotal   float64 `json:"tbk_commission_total"`
	SellerNetRevenue     float64 `json:"seller_net_revenue"`
	CommissionDue        float64 `json:"commission_due"`
	CommissionCollected  float64 `json:"commission_collected"`
	TotalCompletedSales  int     `json:"total_completed_sales"`
}

// Requests
type UpdateCommissionRateRequest struct {
	Rate   float64 `json:"rate" binding:"required,min=0,max=100"`
	Reason string  `json:"reason"`
}

type MarkCommissionCollectedRequest struct {
	Notes string `json:"notes"`
}

type CommissionFilter struct {
	Status     string    `form:"status"`
	BusinessID string    `form:"business_id"`
	ShopID     string    `form:"shop_id"`
	SellerID   string    `form:"seller_id"`
	DateFrom   string    `form:"date_from"`
	DateTo     string    `form:"date_to"`
	Search     string    `form:"search"`
	Limit      int       `form:"limit"`
	Offset     int       `form:"offset"`
}
