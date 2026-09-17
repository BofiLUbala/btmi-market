package models

import "github.com/google/uuid"

// FinanceReportFilter narrows the finance report to a date window and/or a
// business / shop / seller / product / variant, plus the payment and
// commission lifecycle states. All values are empty strings when not applied.
//
// BusinessIDs is the seller-scope filter: Seller Finance passes the businesses
// the caller owns so a seller sees every sale of their businesses, whoever in
// the business created the order. It is never set from a query parameter.
type FinanceReportFilter struct {
	BusinessIDs []uuid.UUID `form:"-"`
	BusinessID  string      `form:"business_id"`
	ShopID      string      `form:"shop_id"`
	SellerID    string      `form:"seller_id"`
	ProductID   string      `form:"product_id"`
	VariantID   string      `form:"variant_id"`
	// PaymentStatus filters on buyer_payments.status (what the BUYER settled).
	PaymentStatus string `form:"payment_status"`
	// CommissionStatus filters on sale_commissions.status (what TBK collected).
	// The two are deliberately independent: a PAID order can still owe TBK.
	CommissionStatus string `form:"commission_status"`
	DateFrom         string `form:"date_from"`
	DateTo           string `form:"date_to"`
}

// FinanceBreakdownGroup is the dimension a finance breakdown is aggregated by.
type FinanceBreakdownGroup string

const (
	FinanceBreakdownShop     FinanceBreakdownGroup = "shop"
	FinanceBreakdownProduct  FinanceBreakdownGroup = "product"
	FinanceBreakdownVariant  FinanceBreakdownGroup = "variant"
	FinanceBreakdownSeller   FinanceBreakdownGroup = "seller"
	FinanceBreakdownBusiness FinanceBreakdownGroup = "business"
)

// IsValidBreakdownGroup reports whether a caller-supplied group is one of the
// dimensions the repository can aggregate by.
func IsValidBreakdownGroup(g FinanceBreakdownGroup) bool {
	switch g {
	case FinanceBreakdownShop, FinanceBreakdownProduct, FinanceBreakdownVariant,
		FinanceBreakdownSeller, FinanceBreakdownBusiness:
		return true
	}
	return false
}

// FinanceTimeseriesInterval is the bucket width of a finance chart series.
type FinanceTimeseriesInterval string

const (
	FinanceIntervalDay   FinanceTimeseriesInterval = "day"
	FinanceIntervalWeek  FinanceTimeseriesInterval = "week"
	FinanceIntervalMonth FinanceTimeseriesInterval = "month"
)

// FinanceDashboardReport is the real-totals dashboard for Finance Admin and
// sellers. Every figure below is computed from sale_commissions (per-sale
// snapshots) joined to orders and buyer_payments, so none of it is a
// client-side estimate. GROSS - COMMISSION = SELLER NET always holds.
type FinanceDashboardReport struct {
	GrossSales          float64 `json:"gross_sales"`          // Σ commission_base (merchandise, after points discount)
	CommissionAmount    float64 `json:"commission_amount"`    // Σ commission_amount, excl. WAIVED
	SellerNetAmount     float64 `json:"seller_net_amount"`    // Σ seller_net_amount, excl. WAIVED
	CollectedCommission float64 `json:"collected_commission"` // commission paid by sellers
	DueCommission       float64 `json:"due_commission"`       // commission pending collection
	WaivedCommission    float64 `json:"waived_commission"`    // commission on refunded/voided sales
	// Settled money, split by the rail it arrived on. Cash is counted only for
	// CASH_ON_DELIVERY and mobile only for the two mobile methods, so the two
	// always sum to PaymentsCollected and neither can be read as the other.
	CollectedCash   float64 `json:"collected_cash"`   // Σ cash_due of settled CASH_ON_DELIVERY payments
	CollectedMobile float64 `json:"collected_mobile"` // Σ cash_due of settled mobile money payments
	// Settled money per operator, for reconciling against each one's statement.
	CollectedByProvider []FinanceProviderTotal `json:"collected_by_provider"`
	PaymentsCollected   float64                `json:"payments_collected"` // Σ cash_due of VERIFIED buyer payments
	PaymentsDue         float64                `json:"payments_due"`       // Σ cash_due still awaiting verification
	// A strict subset of PaymentsDue: a charge has been raised with an operator
	// and we are waiting on the answer, as opposed to money the buyer has simply
	// not been asked for yet. Never add this to PaymentsDue.
	PaymentsPending float64 `json:"payments_pending"`
	// Money returned to the buyer. Kept apart from every "collected" figure so a
	// refund can never read as revenue.
	RefundedAmount   float64                `json:"refunded_amount"`
	UnitsSold        int                    `json:"units_sold"`         // Σ order_lines.quantity on non-WAIVED sales
	VerifiedSales    int                    `json:"verified_sales"`     // number of verified sales snapshots (excl. WAIVED)
	RefundedSales    int                    `json:"refunded_sales"`     // number of WAIVED / refunded snapshots
	PendingOrders    int                    `json:"pending_orders"`     // orders with no VERIFIED payment yet
	CommissionRate   float64                `json:"commission_rate"`    // current platform rate (informational)
	Currency         string                 `json:"currency,omitempty"` // populated when the result has one currency
	MixedCurrency    bool                   `json:"mixed_currency"`
	TotalsByCurrency []FinanceCurrencyTotal `json:"totals_by_currency"`
}

// FinanceProviderTotal is what one mobile money operator actually settled.
type FinanceProviderTotal struct {
	Provider string  `json:"provider"`
	Label    string  `json:"label,omitempty"`
	Amount   float64 `json:"amount"`
	Payments int     `json:"payments"`
	Currency string  `json:"currency,omitempty"`
}

type FinanceCurrencyTotal struct {
	Currency            string  `json:"currency"`
	GrossSales          float64 `json:"gross_sales"`
	CommissionAmount    float64 `json:"commission_amount"`
	SellerNetAmount     float64 `json:"seller_net_amount"`
	CollectedCommission float64 `json:"collected_commission"`
	DueCommission       float64 `json:"due_commission"`
	PaymentsCollected   float64 `json:"payments_collected"`
	PaymentsDue         float64 `json:"payments_due"`
	UnitsSold           int     `json:"units_sold"`
	VerifiedSales       int     `json:"verified_sales"`
}

// FinanceBreakdownItem is one aggregate row in a grouped finance report.
// SubLabel carries the parent dimension a row belongs to — the seller behind a
// shop, the shop behind a product, the product behind a variant — so a
// breakdown row is readable without a second lookup.
type FinanceBreakdownItem struct {
	ID               string  `json:"id"`
	Label            string  `json:"label"`
	SubLabel         string  `json:"sub_label"`
	GrossSales       float64 `json:"gross_sales"`
	CommissionAmount float64 `json:"commission_amount"`
	SellerNetAmount  float64 `json:"seller_net_amount"`
	// Commission collected from / still owed by the seller. These are the TBK
	// axis; the two below are the buyer axis. Keeping both on the row is what
	// lets a shop be read without a second query.
	Collected         float64 `json:"collected"`
	Due               float64 `json:"due"`
	PaymentsCollected float64 `json:"payments_collected"`
	PaymentsDue       float64 `json:"payments_due"`
	SalesCount        int     `json:"sales_count"`
	UnitsSold         int     `json:"units_sold"`
	Currency          string  `json:"currency"`
}

// FinanceTimeseriesPoint is one bucket of the finance chart series. Charts
// read these straight from SQL; there is no demo series anywhere.
type FinanceTimeseriesPoint struct {
	Period           string  `json:"period"` // YYYY-MM-DD of the bucket start
	GrossSales       float64 `json:"gross_sales"`
	CommissionAmount float64 `json:"commission_amount"`
	SellerNetAmount  float64 `json:"seller_net_amount"`
	Collected        float64 `json:"collected"`
	Due              float64 `json:"due"`
	SalesCount       int     `json:"sales_count"`
	Currency         string  `json:"currency"`
}
