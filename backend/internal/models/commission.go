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
	Currency         string           `json:"currency" db:"currency"`
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

// SaleFinanceLine is the immutable order-line snapshot shown in seller and
// Finance Admin drill-downs. Values come from order_lines, never the client.
type SaleFinanceLine struct {
	ProductID      *uuid.UUID `json:"product_id,omitempty"`
	ProductName    string     `json:"product_name"`
	ProductSKU     string     `json:"product_sku"`
	VariantID      *uuid.UUID `json:"variant_id,omitempty"`
	VariantName    string     `json:"variant_name"`
	VariantSKU     string     `json:"variant_sku"`
	Quantity       int        `json:"quantity"`
	UnitPrice      float64    `json:"unit_price"`
	PointsDiscount float64    `json:"points_discount"`
	FinalUnitPrice float64    `json:"final_unit_price"`
	GrossAmount    float64    `json:"gross_amount"`
}

// SaleFinanceDetail joins one shared commission snapshot to the corresponding
// order, payment, buyer and order-line snapshots. Both seller and Finance Admin
// endpoints return this exact model.
type SaleFinanceDetail struct {
	Sale          SaleCommission `json:"sale"`
	BuyerName     string         `json:"buyer_name"`
	PaymentMethod string         `json:"payment_method"`
	// The operator behind the payment, and the reference the buyer can quote.
	Provider         string            `json:"provider,omitempty"`
	PaymentReference string            `json:"payment_reference,omitempty"`
	PaymentStatus    string            `json:"payment_status"`
	OrderStatus      string            `json:"order_status"`
	DeliveryMethod   string            `json:"delivery_method"`
	DeliveryStatus   string            `json:"delivery_status"`
	PaymentMarkup    float64           `json:"payment_markup"`
	DeliveryFee      float64           `json:"delivery_fee"`
	ProductsSubtotal float64           `json:"products_subtotal"`
	FinalTotal       float64           `json:"final_total"`
	OrderedAt        time.Time         `json:"ordered_at"`
	VerifiedAt       *time.Time        `json:"verified_at,omitempty"`
	Lines            []SaleFinanceLine `json:"lines"`
}

// SaleHistoryItem is one row of sales history. It carries the shared per-sale
// commission snapshot plus the buyer, payment, delivery and line context the
// history tables show. Seller Finance and Finance Admin read the same rows.
type SaleHistoryItem struct {
	SaleCommission
	BuyerName     string `json:"buyer_name"`
	PaymentMethod string `json:"payment_method"`
	// The operator the buyer paid with, blank for cash. A sale row that names the
	// method but not the operator cannot be reconciled against an operator's
	// statement, which is most of what this history is read for.
	Provider         string            `json:"provider,omitempty"`
	PaymentReference string            `json:"payment_reference,omitempty"`
	PaymentStatus    string            `json:"payment_status"`
	OrderStatus      string            `json:"order_status"`
	DeliveryMethod   string            `json:"delivery_method"`
	DeliveryStatus   string            `json:"delivery_status"`
	TotalQuantity    int               `json:"total_quantity"`
	Lines            []SaleFinanceLine `json:"lines"`
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
// It is a reshaping of FinanceDashboardReport, so it carries the same currency
// breakdown: totals of different currencies are never silently added together.
type CommissionSummary struct {
	GrossSales          float64                `json:"gross_sales"`
	TotalCommission     float64                `json:"total_commission"`
	CollectedCommission float64                `json:"collected_commission"`
	DueCommission       float64                `json:"due_commission"`
	SellerNetRevenue    float64                `json:"seller_net_revenue"`
	PaymentsCollected   float64                `json:"payments_collected"`
	PaymentsDue         float64                `json:"payments_due"`
	UnitsSold           int                    `json:"units_sold"`
	TotalVerifiedSales  int                    `json:"total_verified_sales"`
	Currency            string                 `json:"currency,omitempty"`
	MixedCurrency       bool                   `json:"mixed_currency"`
	TotalsByCurrency    []FinanceCurrencyTotal `json:"totals_by_currency"`
}

// SellerFinanceSummary represents aggregate financial metrics for a specific Seller.
type SellerFinanceSummary struct {
	GrossSales          float64 `json:"gross_sales"`
	TBKCommissionTotal  float64 `json:"tbk_commission_total"`
	SellerNetRevenue    float64 `json:"seller_net_revenue"`
	CommissionDue       float64 `json:"commission_due"`
	CommissionCollected float64 `json:"commission_collected"`
	// Payments are the buyer axis and stay separate from the commission axis
	// above: a buyer can have paid in full while TBK's cut is still due.
	PaymentsReceived float64 `json:"payments_received"`
	PaymentsDue      float64 `json:"payments_due"`
	UnitsSold        int     `json:"units_sold"`
	// The live platform rate, so clients label the commission card with the
	// configured percentage instead of hardcoding one.
	CommissionRate      float64 `json:"commission_rate"`
	TotalCompletedSales int     `json:"total_completed_sales"`
}

// Requests
type UpdateCommissionRateRequest struct {
	// A pointer so that 0% (no commission) is a valid rate: `required` on a
	// plain float64 rejects its zero value.
	Rate   *float64 `json:"rate" binding:"required,min=0,max=100"`
	Reason string   `json:"reason"`
}

type MarkCommissionCollectedRequest struct {
	Notes string `json:"notes"`
}

type CommissionFilter struct {
	// BusinessIDs scopes the list to the businesses a seller owns. Set by the
	// service from the caller's memberships, never from a query parameter.
	BusinessIDs []uuid.UUID `form:"-"`
	// Status is the COMMISSION status (DUE / COLLECTED / WAIVED); PaymentStatus
	// is the buyer's. They are separate axes and filter independently.
	Status        string `form:"status"`
	PaymentStatus string `form:"payment_status"`
	BusinessID    string `form:"business_id"`
	ShopID        string `form:"shop_id"`
	SellerID      string `form:"seller_id"`
	ProductID     string `form:"product_id"`
	VariantID     string `form:"variant_id"`
	DateFrom      string `form:"date_from"`
	DateTo        string `form:"date_to"`
	Search        string `form:"search"`
	Limit         int    `form:"limit"`
	Offset        int    `form:"offset"`
}
