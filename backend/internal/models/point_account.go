package models

import (
	"time"

	"github.com/google/uuid"
)

type PointOwnerType string

const (
	PointOwnerTypeBuyer         PointOwnerType = "BUYER"
	PointOwnerTypeSellerBusiness PointOwnerType = "SELLER_BUSINESS"
)

type PointAccount struct {
	ID             uuid.UUID     `json:"id" db:"id"`
	OwnerType      PointOwnerType `json:"owner_type" db:"owner_type"`
	OwnerID        uuid.UUID     `json:"owner_id" db:"owner_id"`
	CurrentPoints  int           `json:"current_points" db:"current_points"`
	LifetimePoints int           `json:"lifetime_points" db:"lifetime_points"`
	ReservedPoints int           `json:"reserved_points" db:"reserved_points"`
	LevelID        *uuid.UUID    `json:"level_id" db:"level_id"`
	Status         string        `json:"status" db:"status"`
	CreatedAt      time.Time     `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at" db:"updated_at"`
}

type PointTransactionType string

const (
	PointTransactionTypeCredit PointTransactionType = "CREDIT"
	PointTransactionTypeDebit  PointTransactionType = "DEBIT"
)

type PointTransactionReferenceType string

const (
	PointTransactionRefVerifiedPurchase PointTransactionReferenceType = "VERIFIED_PURCHASE"
	PointTransactionRefRefund           PointTransactionReferenceType = "REFUND"
	PointTransactionRefRedemption       PointTransactionReferenceType = "REDEMPTION"
	PointTransactionRefRedemptionProduct PointTransactionReferenceType = "REDEMPTION_PRODUCT"
	PointTransactionRefRedemptionDelivery PointTransactionReferenceType = "REDEMPTION_DELIVERY"
)

type PointTransaction struct {
	ID               uuid.UUID                    `json:"id" db:"id"`
	PointAccountID   uuid.UUID                    `json:"point_account_id" db:"point_account_id"`
	ReferenceType    PointTransactionReferenceType `json:"reference_type" db:"reference_type"`
	ReferenceID      uuid.UUID                    `json:"reference_id" db:"reference_id"`
	Type             PointTransactionType         `json:"type" db:"type"`
	PointsChange     int                          `json:"points_change" db:"points_change"`
	PreviousPoints   int                          `json:"previous_points" db:"previous_points"`
	NewPoints        int                          `json:"new_points" db:"new_points"`
	CreatedAt        time.Time                    `json:"created_at" db:"created_at"`
}

type PointAccountResponse struct {
	ID             uuid.UUID `json:"id"`
	OwnerType      string    `json:"owner_type"`
	OwnerID        uuid.UUID `json:"owner_id"`
	CurrentPoints  int       `json:"current_points"`
	LifetimePoints int       `json:"lifetime_points"`
	ReservedPoints int       `json:"reserved_points"`
	LevelID        *uuid.UUID `json:"level_id"`
	Status         string    `json:"status"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type PointTransactionResponse struct {
	ID             uuid.UUID `json:"id"`
	ReferenceType  string    `json:"reference_type"`
	ReferenceID    uuid.UUID `json:"reference_id"`
	Type           string    `json:"type"`
	PointsChange   int       `json:"points_change"`
	PreviousPoints int       `json:"previous_points"`
	NewPoints      int       `json:"new_points"`
	CreatedAt      time.Time `json:"created_at"`
}

type PointHistoryResponse struct {
	Account      PointAccountResponse      `json:"account"`
	Transactions []PointTransactionResponse `json:"transactions"`
	LevelName    string                     `json:"level_name"`
	NextLevel    *SellerLevelInfo           `json:"next_level,omitempty"`
	BuyerNextLevel *BuyerLevelInfo          `json:"buyer_next_level,omitempty"`
}

type SellerGrowthResponse struct {
	Points         PointAccountResponse `json:"points"`
	Level          SellerLevelInfo      `json:"level"`
	Trust          SellerTrustInfo      `json:"trust"`
	Benefits       []LevelBenefitInfo   `json:"benefits"`
	HighValueBuyerEligible bool         `json:"high_value_buyer_eligible"`
}

type SellerLevelInfo struct {
	Name                   string  `json:"name"`
	MinPoints              int     `json:"min_points"`
	MaxPoints              int     `json:"max_points"`
	SearchBoost            float64 `json:"search_boost"`
	RecommendationEligible bool    `json:"recommendation_eligible"`
	HighValueBuyerAccess   bool    `json:"high_value_buyer_access"`
	ProgressToNext         float64 `json:"progress_to_next_level_percent"`
	Description            string  `json:"description"`
}

type BuyerLevelInfo struct {
	Name                    string  `json:"name"`
	MinPoints               int     `json:"min_points"`
	MaxPoints               int     `json:"max_points"`
	DiscountPercent         float64 `json:"discount_percent"`
	DeliveryDiscountPercent float64 `json:"delivery_discount_percent"`
	FreeDelivery            bool    `json:"free_delivery"`
	ProgressToNext          float64 `json:"progress_to_next_level_percent"`
	Description             string  `json:"description"`
}

type SellerTrustInfo struct {
	TrustStatus               string  `json:"trust_status"`
	VerifiedSalesCount        int     `json:"verified_sales_count"`
	OrderCompletionRate       float64 `json:"order_completion_rate"`
	CancellationRate          float64 `json:"cancellation_rate"`
	PurchaseConfirmationRate  float64 `json:"purchase_confirmation_rate"`
	StockReliabilityRate      float64 `json:"stock_reliability_rate"`
}

type PointRedemptionPreviewRequest struct {
	ShopID    string            `json:"shop_id" binding:"required"`
	Items     []OrderLineInput  `json:"items" binding:"required,min=1"`
	UsePoints bool              `json:"use_points"`
}

type PointRedemptionPreviewResponse struct {
	BaseTotal           float64 `json:"base_total"`
	PointsUsed          int     `json:"points_used"`
	PointsDiscountAmount float64 `json:"points_discount_amount"`
	FinalTotal          float64 `json:"final_total"`
	Currency            string  `json:"currency"`
	AvailablePoints     int     `json:"available_points"`
	MaximumUsablePoints int     `json:"maximum_usable_points"`
	RedeemRate          float64 `json:"redeem_rate"`
	MaxPointCoverage    float64 `json:"max_point_coverage"`
}
