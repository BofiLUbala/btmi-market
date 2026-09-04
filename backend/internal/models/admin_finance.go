package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Phase 3A - Financial Summary & Payments
type AdminFinancialSummary struct {
	TotalOrderValue      float64 `json:"total_order_value"`
	VerifiedCash         float64 `json:"verified_cash"`
	UnverifiedCash       float64 `json:"unverified_cash"`
	DisputedCash         float64 `json:"disputed_cash"`
	PointsDiscountValue  float64 `json:"points_discount_value"`
	TotalOrders          int     `json:"total_orders"`
	PendingPaymentsCount int     `json:"pending_payments_count"`
	VerifiedPaymentsCount int    `json:"verified_payments_count"`
	DisputedPaymentsCount int    `json:"disputed_payments_count"`
	OpenCasesCount       int     `json:"open_cases_count"`
	FlaggedReviewsCount  int     `json:"flagged_reviews_count"`
	RiskAlertsCount      int     `json:"risk_alerts_count"`
}

type AdminPaymentFilter struct {
	PaymentStatus   string `form:"payment_status"`
	BuyerConfirmed  *bool  `form:"buyer_confirmed"`
	SellerConfirmed *bool  `form:"seller_confirmed"`
	BusinessID      string `form:"business_id"`
	ShopID          string `form:"shop_id"`
	SellerID        string `form:"seller_id"`
	BuyerID         string `form:"buyer_id"`
	DateFrom        string `form:"date_from"`
	DateTo          string `form:"date_to"`
	OrderNumber     string `form:"order_number"`
	Page            int    `form:"page,default=1"`
	Limit           int    `form:"limit,default=20"`
}

type AdminPaymentListItem struct {
	PaymentID               uuid.UUID  `json:"payment_id"`
	OrderID                 uuid.UUID  `json:"order_id"`
	OrderNumber             string     `json:"order_number"`
	BuyerID                 uuid.UUID  `json:"buyer_id"`
	BuyerName               string     `json:"buyer_name"`
	BuyerEmail              string     `json:"buyer_email"`
	SellerID                *uuid.UUID `json:"seller_id,omitempty"`
	SellerName              string     `json:"seller_name"`
	BusinessID              uuid.UUID  `json:"business_id"`
	BusinessName            string     `json:"business_name"`
	ShopID                  uuid.UUID  `json:"shop_id"`
	ShopName                string     `json:"shop_name"`
	SubtotalAmount          float64    `json:"subtotal_amount"`
	DiscountAmount          float64    `json:"discount_amount"`
	PointsDiscountAmount    float64    `json:"points_discount_amount"`
	DeliveryFee             float64    `json:"delivery_fee"`
	TotalAmount             float64    `json:"total_amount"`
	CashDue                 float64    `json:"cash_due"`
	BuyerConfirmedPaid      bool       `json:"buyer_confirmed_paid"`
	BuyerConfirmedAt        *time.Time `json:"buyer_confirmed_at,omitempty"`
	SellerConfirmedReceived bool       `json:"seller_confirmed_received"`
	SellerConfirmedAt       *time.Time `json:"seller_confirmed_at,omitempty"`
	PaymentStatus           string     `json:"payment_status"`
	CreatedAt               time.Time  `json:"created_at"`
	VerifiedAt              *time.Time `json:"verified_at,omitempty"`
	AnomalyFlag             bool       `json:"anomaly_flag"`
	AnomalyReason           string     `json:"anomaly_reason,omitempty"`
}

type AdminPaymentDetail struct {
	AdminPaymentListItem
	ProductLines []AdminOrderProductLine `json:"product_lines"`
	OrderHistory []AdminOrderHistoryLog  `json:"order_history"`
}

type AdminOrderProductLine struct {
	ID          uuid.UUID `json:"id"`
	ProductID   uuid.UUID `json:"product_id"`
	ProductName string    `json:"product_name"`
	VariantID   *uuid.UUID `json:"variant_id,omitempty"`
	VariantName string    `json:"variant_name,omitempty"`
	SKU         string    `json:"sku"`
	Quantity    int       `json:"quantity"`
	UnitPrice   float64   `json:"unit_price"`
	TotalPrice  float64   `json:"total_price"`
}

type AdminOrderHistoryLog struct {
	Status    string    `json:"status"`
	Note      string    `json:"note"`
	Timestamp time.Time `json:"timestamp"`
}

// Phase 3B - Buyer Points & Seller Growth
type AdminBuyerPointsItem struct {
	BuyerID         uuid.UUID  `json:"buyer_id"`
	BuyerName       string     `json:"buyer_name"`
	BuyerEmail      string     `json:"buyer_email"`
	AccountID       uuid.UUID  `json:"account_id"`
	AvailablePoints int        `json:"available_points"`
	ReservedPoints  int        `json:"reserved_points"`
	LifetimePoints  int        `json:"lifetime_points"`
	CurrentLevel    string     `json:"current_level"`
	LastUpdated     time.Time  `json:"last_updated"`
	AnomalyFlag     bool       `json:"anomaly_flag"`
	AnomalyReason   string     `json:"anomaly_reason,omitempty"`
}

type AdminPointTransaction struct {
	ID              uuid.UUID  `json:"id"`
	PointAccountID  uuid.UUID  `json:"point_account_id"`
	Type            string     `json:"type"` // EARNED, RESERVED, RELEASED, CONSUMED, ADJUSTED
	Amount          int        `json:"amount"`
	BalanceAfter    int        `json:"balance_after"`
	OrderID         *uuid.UUID `json:"order_id,omitempty"`
	OrderNumber     string     `json:"order_number,omitempty"`
	Reason          string     `json:"reason"`
	CreatedAt       time.Time  `json:"created_at"`
}

type AdminPointAdjustmentRequest struct {
	Type   string `json:"type" binding:"required"` // ADD, REMOVE
	Amount int    `json:"amount" binding:"required,gt=0"`
	Reason string `json:"reason" binding:"required,min=5"`
}

type AdminSellerGrowthItem struct {
	SellerID               uuid.UUID `json:"seller_id"`
	SellerName             string    `json:"seller_name"`
	SellerEmail            string    `json:"seller_email"`
	BusinessID             uuid.UUID `json:"business_id"`
	BusinessName           string    `json:"business_name"`
	ShopCount              int       `json:"shop_count"`
	TotalOrders            int       `json:"total_orders"`
	CompletedOrders        int       `json:"completed_orders"`
	CancelledOrders        int       `json:"cancelled_orders"`
	TotalGMV               float64   `json:"total_gmv"`
	AverageRating          float64   `json:"average_rating"`
	ReviewCount            int       `json:"review_count"`
	DisputeCount           int       `json:"dispute_count"`
	TrustStatus            string    `json:"trust_status"`
	Level                  string    `json:"level"`
	CashConfirmationRate   float64   `json:"cash_confirmation_rate"`
	GrowthPoints           int       `json:"growth_points"`
}

// Phase 3C - Product & Shop Reviews Moderation
type AdminProductReviewItem struct {
	ReviewID          uuid.UUID  `json:"review_id"`
	BuyerID           uuid.UUID  `json:"buyer_id"`
	BuyerName         string     `json:"buyer_name"`
	OrderID           uuid.UUID  `json:"order_id"`
	OrderNumber       string     `json:"order_number"`
	ProductID         uuid.UUID  `json:"product_id"`
	ProductName       string     `json:"product_name"`
	VariantID         *uuid.UUID `json:"variant_id,omitempty"`
	VariantName       string     `json:"variant_name,omitempty"`
	ShopID            uuid.UUID  `json:"shop_id"`
	ShopName          string     `json:"shop_name"`
	BusinessID        uuid.UUID  `json:"business_id"`
	BusinessName      string     `json:"business_name"`
	Rating            int        `json:"rating"`
	Comment           string     `json:"comment"`
	IsVerifiedPurchase bool      `json:"is_verified_purchase"`
	HelpfulCount      int        `json:"helpful_count"`
	ModerationStatus  string     `json:"moderation_status"` // VISIBLE, FLAGGED, UNDER_REVIEW, HIDDEN
	CreatedAt         time.Time  `json:"created_at"`
}

type AdminShopReviewItem struct {
	ReviewID         uuid.UUID `json:"review_id"`
	BuyerID          uuid.UUID `json:"buyer_id"`
	BuyerName        string    `json:"buyer_name"`
	OrderID          uuid.UUID `json:"order_id"`
	OrderNumber      string    `json:"order_number"`
	ShopID           uuid.UUID `json:"shop_id"`
	ShopName         string    `json:"shop_name"`
	SellerID         uuid.UUID `json:"seller_id"`
	SellerName       string    `json:"seller_name"`
	Rating           int       `json:"rating"`
	Comment          string    `json:"comment"`
	ModerationStatus string    `json:"moderation_status"` // VISIBLE, FLAGGED, UNDER_REVIEW, HIDDEN
	CreatedAt        time.Time `json:"created_at"`
}

type AdminReviewModerationRequest struct {
	Reason string `json:"reason" binding:"required,min=5"`
}

// Phase 3D - Cases / Disputes / Support
type AdminCaseFilter struct {
	CaseType       string `form:"case_type"`
	Status         string `form:"status"`
	Priority       string `form:"priority"`
	AssignedAdminID string `form:"assigned_admin_id"`
	BuyerID        string `form:"buyer_id"`
	SellerID       string `form:"seller_id"`
	BusinessID     string `form:"business_id"`
	ShopID         string `form:"shop_id"`
	OrderID        string `form:"order_id"`
	DateFrom       string `form:"date_from"`
	DateTo         string `form:"date_to"`
	Page           int    `form:"page,default=1"`
	Limit          int    `form:"limit,default=20"`
}

type AdminCaseListItem struct {
	ID              uuid.UUID  `json:"id"`
	CaseNumber      string     `json:"case_number"`
	CaseType        string     `json:"case_type"`
	Status          string     `json:"status"`
	Priority        string     `json:"priority"`
	BuyerID         *uuid.UUID `json:"buyer_id,omitempty"`
	BuyerName       string     `json:"buyer_name,omitempty"`
	SellerID        *uuid.UUID `json:"seller_id,omitempty"`
	SellerName      string     `json:"seller_name,omitempty"`
	BusinessID      *uuid.UUID `json:"business_id,omitempty"`
	BusinessName    string     `json:"business_name,omitempty"`
	ShopID          *uuid.UUID `json:"shop_id,omitempty"`
	ShopName        string     `json:"shop_name,omitempty"`
	OrderID         *uuid.UUID `json:"order_id,omitempty"`
	OrderNumber     string     `json:"order_number,omitempty"`
	PaymentID       *uuid.UUID `json:"payment_id,omitempty"`
	ProductID       *uuid.UUID `json:"product_id,omitempty"`
	ReviewID        *uuid.UUID `json:"review_id,omitempty"`
	AssignedAdminID *uuid.UUID `json:"assigned_admin_id,omitempty"`
	AssignedAdmin   string     `json:"assigned_admin,omitempty"`
	CreatedByType   string     `json:"created_by_type"`
	CreatedByID     *uuid.UUID `json:"created_by_id,omitempty"`
	Title           string     `json:"title"`
	Description     string     `json:"description"`
	Resolution      string     `json:"resolution,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	ResolvedAt      *time.Time `json:"resolved_at,omitempty"`
}

type AdminCaseDetail struct {
	AdminCaseListItem
	Messages []AdminCaseMessage `json:"messages"`
}

type AdminCaseMessage struct {
	ID         uuid.UUID  `json:"id"`
	CaseID     uuid.UUID  `json:"case_id"`
	SenderType string     `json:"sender_type"` // ADMIN, BUYER, SELLER, SYSTEM
	SenderID   *uuid.UUID `json:"sender_id,omitempty"`
	SenderName string     `json:"sender_name,omitempty"`
	Visibility string     `json:"visibility"` // INTERNAL_ADMIN_NOTE, USER_VISIBLE
	Message    string     `json:"message"`
	CreatedAt  time.Time  `json:"created_at"`
}

type AdminCreateCaseRequest struct {
	CaseType    string     `json:"case_type" binding:"required"`
	Priority    string     `json:"priority" binding:"required"`
	BuyerID     *uuid.UUID `json:"buyer_id,omitempty"`
	SellerID    *uuid.UUID `json:"seller_id,omitempty"`
	BusinessID  *uuid.UUID `json:"business_id,omitempty"`
	ShopID      *uuid.UUID `json:"shop_id,omitempty"`
	OrderID     *uuid.UUID `json:"order_id,omitempty"`
	PaymentID   *uuid.UUID `json:"payment_id,omitempty"`
	ProductID   *uuid.UUID `json:"product_id,omitempty"`
	ReviewID    *uuid.UUID `json:"review_id,omitempty"`
	Title       string     `json:"title" binding:"required"`
	Description string     `json:"description" binding:"required"`
}

type AdminCaseAssignRequest struct {
	AdminID uuid.UUID `json:"admin_id" binding:"required"`
}

type AdminCaseResolveRequest struct {
	Status     string `json:"status" binding:"required"` // RESOLVED, REJECTED, CLOSED
	Resolution string `json:"resolution" binding:"required,min=5"`
}

type AdminCaseMessageRequest struct {
	Visibility string `json:"visibility" binding:"required"` // INTERNAL_ADMIN_NOTE, USER_VISIBLE
	Message    string `json:"message" binding:"required,min=2"`
}

// Phase 3E - Risk & Fraud Events
type AdminRiskEvent struct {
	ID         uuid.UUID       `json:"id"`
	EventType  string          `json:"event_type"`
	Severity   string          `json:"severity"` // INFO, WARNING, HIGH, CRITICAL
	TargetType string          `json:"target_type"`
	TargetID   uuid.UUID       `json:"target_id"`
	TargetName string          `json:"target_name"`
	RuleCode   string          `json:"rule_code"`
	Details    json.RawMessage `json:"details"`
	Status     string          `json:"status"` // OPEN, INVESTIGATING, RESOLVED, DISMISSED
	CreatedAt  time.Time       `json:"created_at"`
	ResolvedAt *time.Time      `json:"resolved_at,omitempty"`
	ResolvedBy *uuid.UUID      `json:"resolved_by,omitempty"`
}

type AdminRiskEventResolveRequest struct {
	Status string `json:"status" binding:"required"` // RESOLVED, DISMISSED
	Reason string `json:"reason" binding:"required,min=5"`
}
