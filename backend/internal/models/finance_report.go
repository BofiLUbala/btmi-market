package models

import "github.com/google/uuid"

// FinanceReportFilter narrows the finance report to a date window and/or a
// business / shop / seller. All values are empty strings when not applied.
//
// BusinessIDs is the seller-scope filter: Seller Finance passes the businesses
// the caller owns so a seller sees every sale of their businesses, whoever in
// the business created the order. It is never set from a query parameter.
type FinanceReportFilter struct {
	BusinessIDs []uuid.UUID `form:"-"`
	BusinessID  string      `form:"business_id"`
	ShopID      string      `form:"shop_id"`
	SellerID    string      `form:"seller_id"`
	DateFrom    string      `form:"date_from"`
	DateTo      string      `form:"date_to"`
}

// FinanceBreakdownGroup is the dimension a finance breakdown is aggregated by.
type FinanceBreakdownGroup string

const (
	FinanceBreakdownShop     FinanceBreakdownGroup = "shop"
	FinanceBreakdownProduct  FinanceBreakdownGroup = "product"
	FinanceBreakdownSeller   FinanceBreakdownGroup = "seller"
	FinanceBreakdownBusiness FinanceBreakdownGroup = "business"
)

// FinanceDashboardReport is the real-totals dashboard for Finance Admin and
// sellers. Every figure below is computed from sale_commissions (per-sale
// snapshots) joined to orders and buyer_payments, so none of it is a
// client-side estimate. GROSS - COMMISSION = SELLER NET always holds.
type FinanceDashboardReport struct {
	GrossSales          float64                `json:"gross_sales"`          // Σ commission_base (merchandise, after points discount)
	CommissionAmount    float64                `json:"commission_amount"`    // Σ commission_amount, excl. WAIVED
	SellerNetAmount     float64                `json:"seller_net_amount"`    // Σ seller_net_amount, excl. WAIVED
	CollectedCommission float64                `json:"collected_commission"` // commission paid by sellers
	DueCommission       float64                `json:"due_commission"`       // commission pending collection
	WaivedCommission    float64                `json:"waived_commission"`    // commission on refunded/voided sales
	CollectedCash       float64                `json:"collected_cash"`       // Σ buyer_payments.cash_due (incl. delivery fees)
	VerifiedSales       int                    `json:"verified_sales"`       // number of verified sales snapshots (excl. WAIVED)
	RefundedSales       int                    `json:"refunded_sales"`       // number of WAIVED / refunded snapshots
	PendingOrders       int                    `json:"pending_orders"`       // orders with no VERIFIED payment yet
	CommissionRate      float64                `json:"commission_rate"`      // current platform rate (informational)
	Currency            string                 `json:"currency,omitempty"`   // populated when the result has one currency
	MixedCurrency       bool                   `json:"mixed_currency"`
	TotalsByCurrency    []FinanceCurrencyTotal `json:"totals_by_currency"`
}

type FinanceCurrencyTotal struct {
	Currency            string  `json:"currency"`
	GrossSales          float64 `json:"gross_sales"`
	CommissionAmount    float64 `json:"commission_amount"`
	SellerNetAmount     float64 `json:"seller_net_amount"`
	CollectedCommission float64 `json:"collected_commission"`
	DueCommission       float64 `json:"due_commission"`
	VerifiedSales       int     `json:"verified_sales"`
}

// FinanceBreakdownItem is one aggregate row in a grouped finance report.
type FinanceBreakdownItem struct {
	ID               string  `json:"id"`
	Label            string  `json:"label"`
	GrossSales       float64 `json:"gross_sales"`
	CommissionAmount float64 `json:"commission_amount"`
	SellerNetAmount  float64 `json:"seller_net_amount"`
	Collected        float64 `json:"collected"`
	Due              float64 `json:"due"`
	SalesCount       int     `json:"sales_count"`
	Currency         string  `json:"currency"`
}
