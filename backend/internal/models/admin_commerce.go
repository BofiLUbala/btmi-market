package models

import (
	"time"

	"github.com/google/uuid"
)

type CommerceOverviewStats struct {
	TotalProducts       int     `json:"total_products"`
	PublishedProducts   int     `json:"published_products"`
	DraftProducts       int     `json:"draft_products"`
	ArchivedProducts    int     `json:"archived_products"`
	OutOfStockProducts  int     `json:"out_of_stock_products"`
	TotalCategories     int     `json:"total_categories"`
	TotalSubcategories  int     `json:"total_subcategories"`
	TotalOrders         int     `json:"total_orders"`
	OrdersToday         int     `json:"orders_today"`
	CompletedOrders     int     `json:"completed_orders"`
	PendingOrders       int     `json:"pending_orders"`
	StuckOrders         int     `json:"stuck_orders"`
	StockAnomaliesCount int     `json:"stock_anomalies_count"`
	ConfirmedCash       float64 `json:"confirmed_cash"`
}

type AdminProductListItem struct {
	ID                uuid.UUID  `json:"id"`
	Name              string     `json:"name"`
	SKU               string     `json:"sku"`
	BusinessID        uuid.UUID  `json:"business_id"`
	BusinessName      string     `json:"business_name"`
	CategoryID        *uuid.UUID `json:"category_id"`
	CategoryName      string     `json:"category_name"`
	SubcategoryID     *uuid.UUID `json:"subcategory_id"`
	SubcategoryName   string     `json:"subcategory_name"`
	PublicationStatus string     `json:"publication_status"`
	Status            string     `json:"status"`
	UnitPrice         float64    `json:"unit_price"`
	EffectivePrice    float64    `json:"effective_price"`
	DiscountActive    bool       `json:"discount_active"`
	DiscountType      string     `json:"discount_type"`
	DiscountValue     float64    `json:"discount_value"`
	PrimaryImage      *string    `json:"primary_image"`
	ImageCount        int        `json:"image_count"`
	VariantCount      int        `json:"variant_count"`
	TotalAvailable    int        `json:"total_available"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type AdminProductDetail struct {
	Product          Product                      `json:"product"`
	BusinessName     string                       `json:"business_name"`
	CategoryName     string                       `json:"category_name"`
	SubcategoryName  string                       `json:"subcategory_name"`
	Variants         []*ProductVariant            `json:"variants"`
	Images           []*ProductImage              `json:"images"`
	Inventory        []*AdminShopInventorySummary `json:"inventory"`
	VisibilityReport AdminVisibilityReport        `json:"visibility_report"`
}

type AdminShopInventorySummary struct {
	ShopID           uuid.UUID `json:"shop_id"`
	ShopName         string    `json:"shop_name"`
	VariantID        uuid.UUID `json:"variant_id"`
	VariantName      string    `json:"variant_name"`
	SKU              string    `json:"sku"`
	Quantity         int       `json:"quantity"`
	ReservedQuantity int       `json:"reserved_quantity"`
	Available        int       `json:"available"`
}

type AdminVisibilityReport struct {
	IsVisible       bool     `json:"is_visible"`
	ReasonsNotShown []string `json:"reasons_not_shown"`
	BusinessStatus  string   `json:"business_status"`
	ProductStatus   string   `json:"product_status"`
	Publication     string   `json:"publication_status"`
	StockAvailable  int      `json:"stock_available"`
}

type AdminInventoryItem struct {
	InventoryID      uuid.UUID `json:"inventory_id"`
	BusinessID       uuid.UUID `json:"business_id"`
	BusinessName     string    `json:"business_name"`
	ShopID           uuid.UUID `json:"shop_id"`
	ShopName         string    `json:"shop_name"`
	ProductID        uuid.UUID `json:"product_id"`
	ProductName      string    `json:"product_name"`
	VariantID        uuid.UUID `json:"variant_id"`
	VariantName      string    `json:"variant_name"`
	SKU              string    `json:"sku"`
	Quantity         int       `json:"quantity"`
	ReservedQuantity int       `json:"reserved_quantity"`
	Available        int       `json:"available"`
	StockStatus      string    `json:"stock_status"` // IN_STOCK, LOW_STOCK, OUT_OF_STOCK
	UpdatedAt        time.Time `json:"updated_at"`
}

type StockAnomaly struct {
	Type             string    `json:"type"` // NEGATIVE_QUANTITY, NEGATIVE_RESERVED, OVER_RESERVED, NO_STOCK_ROW
	ShopID           uuid.UUID `json:"shop_id"`
	ShopName         string    `json:"shop_name"`
	ProductID        uuid.UUID `json:"product_id"`
	ProductName      string    `json:"product_name"`
	VariantID        uuid.UUID `json:"variant_id"`
	Quantity         int       `json:"quantity"`
	ReservedQuantity int       `json:"reserved_quantity"`
	Description      string    `json:"description"`
}

type AdminOrderItem struct {
	ID             uuid.UUID  `json:"id"`
	OrderNumber    string     `json:"order_number"`
	BusinessID     uuid.UUID  `json:"business_id"`
	BusinessName   string     `json:"business_name"`
	ShopID         uuid.UUID  `json:"shop_id"`
	ShopName       string     `json:"shop_name"`
	BuyerID        *uuid.UUID `json:"buyer_id"`
	BuyerName      string     `json:"buyer_name"`
	BuyerPhone     string     `json:"buyer_phone"`
	Status         string     `json:"status"`
	TotalItems     int        `json:"total_items"`
	BaseTotal      float64    `json:"base_total"`
	PointsDiscount float64    `json:"points_discount"`
	DeliveryFee    float64    `json:"delivery_fee"`
	FinalTotal     float64    `json:"final_total"`
	DeliveryMethod string     `json:"delivery_method"`
	PaymentStatus  string     `json:"payment_status"`
	IsStuck        bool       `json:"is_stuck"`
	StuckReason    string     `json:"stuck_reason,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type AdminOrderDetail struct {
	Order         AdminOrderItem        `json:"order"`
	Lines         []*OrderLine          `json:"lines"`
	StatusHistory []*OrderStatusHistory `json:"status_history"`
	Payment       *BuyerPayment         `json:"payment,omitempty"`
}

type AdminEmployeeItem struct {
	ID           uuid.UUID  `json:"id"`
	BusinessID   uuid.UUID  `json:"business_id"`
	BusinessName string     `json:"business_name"`
	LinkedUserID *uuid.UUID `json:"linked_user_id"`
	FirstName    string     `json:"first_name"`
	LastName     string     `json:"last_name"`
	Email        string     `json:"email"`
	JobTitle     string     `json:"job_title"`
	Status       string     `json:"status"`
	Shops        []string   `json:"shops"`
	CreatedAt    time.Time  `json:"created_at"`
}

type CreateCategoryRequest struct {
	Name      string `json:"name" binding:"required,min=2,max=100"`
	Slug      string `json:"slug" binding:"required,min=2,max=100"`
	SortOrder int    `json:"sort_order"`
}

type UpdateCategoryRequest struct {
	Name      *string `json:"name"`
	Slug      *string `json:"slug"`
	Status    *string `json:"status"`
	SortOrder *int    `json:"sort_order"`
}

type CreateSubcategoryRequest struct {
	CategoryID uuid.UUID `json:"category_id" binding:"required"`
	Name       string    `json:"name" binding:"required,min=2,max=100"`
	Slug       string    `json:"slug" binding:"required,min=2,max=100"`
	SortOrder  int       `json:"sort_order"`
}

type UpdateSubcategoryRequest struct {
	CategoryID *uuid.UUID `json:"category_id"`
	Name       *string    `json:"name"`
	Slug       *string    `json:"slug"`
	Status     *string    `json:"status"`
	SortOrder  *int       `json:"sort_order"`
}

type AdjustStockRequest struct {
	ShopID      uuid.UUID `json:"shop_id" binding:"required"`
	VariantID   uuid.UUID `json:"variant_id" binding:"required"`
	NewQuantity int       `json:"new_quantity" binding:"min=0"`
	Reason      string    `json:"reason" binding:"required,min=5"`
}

type AdminStockMovementItem struct {
	ID               uuid.UUID  `json:"id"`
	BusinessID       uuid.UUID  `json:"business_id"`
	BusinessName     string     `json:"business_name"`
	ShopID           uuid.UUID  `json:"shop_id"`
	ShopName         string     `json:"shop_name"`
	ProductID        uuid.UUID  `json:"product_id"`
	ProductName      string     `json:"product_name"`
	VariantID        *uuid.UUID `json:"variant_id"`
	VariantName      string     `json:"variant_name"`
	VariantSKU       string     `json:"variant_sku"`
	MovementType     string     `json:"movement_type"`
	Quantity         int        `json:"quantity"`
	PreviousQuantity int        `json:"previous_quantity"`
	NewQuantity      int        `json:"new_quantity"`
	Notes            string     `json:"notes"`
	PerformedBy      *uuid.UUID `json:"performed_by"`
	PerformerName    string     `json:"performer_name"`
	EmployeeID       *uuid.UUID `json:"employee_id"`
	EmployeeName     string     `json:"employee_name"`
	ReferenceType    string     `json:"reference_type"`
	ReferenceID      *uuid.UUID `json:"reference_id"`
	CreatedAt        time.Time  `json:"created_at"`
}

type AdminStockMovementHistoryParams struct {
	BusinessID   string
	ShopID       string
	ProductID    string
	VariantID    string
	MovementType string
	EmployeeID   string
	From         string
	To           string
	Limit        int
	Offset       int
}

type AdminMarketplaceVisibility struct {
	ProductID         uuid.UUID `json:"product_id"`
	IsVisible         bool      `json:"is_visible"`
	ReasonsNotShown   []string  `json:"reasons_not_shown"`
	BusinessStatus    string    `json:"business_status"`
	ShopStatus        string    `json:"shop_status"`
	ProductStatus     string    `json:"product_status"`
	PublicationStatus string    `json:"publication_status"`
	ShopOfferStatus   string    `json:"shop_offer_status"`
	StockAvailable    int       `json:"stock_available"`
	PolicyStatus      string    `json:"policy_status"`
	ModerationStatus  string    `json:"moderation_status"`
}

type AdminShopPageControl struct {
	ShopID                uuid.UUID `json:"shop_id"`
	ShopName              string    `json:"shop_name"`
	BusinessID            uuid.UUID `json:"business_id"`
	BusinessName          string    `json:"business_name"`
	Location              string    `json:"location"`
	Latitude              *float64  `json:"latitude"`
	Longitude             *float64  `json:"longitude"`
	Status                string    `json:"status"`
	ActiveCategories      []string  `json:"active_categories"`
	ProductCount          int       `json:"product_count"`
	PublishedProducts     int       `json:"published_products"`
	Rating                float64   `json:"rating"`
	ReviewCount           int       `json:"review_count"`
	MarketplaceVisibility bool      `json:"marketplace_visibility"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

type AdminSearchAnalytics struct {
	Available      bool   `json:"available"`
	Message        string `json:"message"`
	TotalQueries   int    `json:"total_queries,omitempty"`
	ZeroResults    int    `json:"zero_results,omitempty"`
	FailedSearches int    `json:"failed_searches,omitempty"`
}

type AdminSearchQueryLog struct {
	Query        string    `json:"query"`
	ResultsCount int       `json:"results_count"`
	SearchType   string    `json:"search_type"`
	CreatedAt    time.Time `json:"created_at"`
}

type AdminMarketplaceRanking struct {
	Available       bool               `json:"available"`
	Message         string             `json:"message"`
	RankingFactors  []string           `json:"ranking_factors,omitempty"`
	CategoryWeights map[string]float64 `json:"category_weights,omitempty"`
}

type AdminProductCardQuality struct {
	ProductID         uuid.UUID `json:"product_id"`
	ProductName       string    `json:"product_name"`
	HasPrimaryImage   bool      `json:"has_primary_image"`
	PrimaryImageURL   string    `json:"primary_image_url"`
	ImageCount        int       `json:"image_count"`
	HasEffectivePrice bool      `json:"has_effective_price"`
	EffectivePrice    float64   `json:"effective_price"`
	HasRegularPrice   bool      `json:"has_regular_price"`
	RegularPrice      float64   `json:"regular_price"`
	HasOffBadge       bool      `json:"has_off_badge"`
	DiscountType      string    `json:"discount_type"`
	DiscountValue     float64   `json:"discount_value"`
	DiscountPercent   float64   `json:"discount_percent"`
	ShopName          string    `json:"shop_name"`
	Availability      string    `json:"availability"`
	Rating            float64   `json:"rating"`
	ReviewCount       int       `json:"review_count"`
	Issues            []string  `json:"issues"`
}

type AdminPromotionVisibility struct {
	ProductID     uuid.UUID  `json:"product_id"`
	ProductName   string     `json:"product_name"`
	ShopID        uuid.UUID  `json:"shop_id"`
	ShopName      string     `json:"shop_name"`
	RegularPrice  float64    `json:"regular_price"`
	SalePrice     float64    `json:"sale_price"`
	DiscountType  string     `json:"discount_type"`
	DiscountValue float64    `json:"discount_value"`
	OffBadge      bool       `json:"off_badge"`
	StartDate     *time.Time `json:"start_date"`
	EndDate       *time.Time `json:"end_date"`
	Status        string     `json:"status"`
	IsActive      bool       `json:"is_active"`
}

type AdminSellerPerformance struct {
	SellerID             uuid.UUID `json:"seller_id"`
	SellerName           string    `json:"seller_name"`
	BusinessID           uuid.UUID `json:"business_id"`
	BusinessName         string    `json:"business_name"`
	OrdersReceived       int       `json:"orders_received"`
	OrdersAccepted       int       `json:"orders_accepted"`
	OrdersRejected       int       `json:"orders_rejected"`
	AcceptanceRate       float64   `json:"acceptance_rate"`
	RejectionRate        float64   `json:"rejection_rate"`
	AvgPreparationTime   float64   `json:"avg_preparation_time_hours"`
	CompletionRate       float64   `json:"completion_rate"`
	Cancellations        int       `json:"cancellations"`
	ReviewScore          float64   `json:"review_score"`
	DisputeRate          float64   `json:"dispute_rate"`
	StockAccuracyScore   float64   `json:"stock_accuracy_score"`
	CashConfirmationRate float64   `json:"cash_confirmation_rate"`
}

type AdminProductPerformance struct {
	ProductID      uuid.UUID `json:"product_id"`
	ProductName    string    `json:"product_name"`
	SKU            string    `json:"sku"`
	Views          *int      `json:"views"`
	Favorites      *int      `json:"favorites"`
	AddToCart      *int      `json:"add_to_cart"`
	Orders         int       `json:"orders"`
	ConversionRate *float64  `json:"conversion_rate"`
	SalesValue     float64   `json:"sales_value"`
	ReviewScore    float64   `json:"review_score"`
	StockState     string    `json:"stock_state"`
}

type AdminCategoryPerformance struct {
	CategoryID        uuid.UUID `json:"category_id"`
	CategoryName      string    `json:"category_name"`
	ProductCount      int       `json:"product_count"`
	PublishedProducts int       `json:"published_products"`
	ActiveSellers     int       `json:"active_sellers"`
	Orders            int       `json:"orders"`
	SalesValue        float64   `json:"sales_value"`
	AvailabilityScore float64   `json:"availability_score"`
	SearchVolume      *int      `json:"search_volume"`
	ConversionRate    *float64  `json:"conversion_rate"`
}

type AdminShopPerformance struct {
	ShopID               uuid.UUID `json:"shop_id"`
	ShopName             string    `json:"shop_name"`
	BusinessID           uuid.UUID `json:"business_id"`
	BusinessName         string    `json:"business_name"`
	Orders               int       `json:"orders"`
	CompletedOrders      int       `json:"completed_orders"`
	Cancellations        int       `json:"cancellations"`
	Products             int       `json:"products"`
	StockAvailability    float64   `json:"stock_availability_score"`
	ReviewScore          float64   `json:"review_score"`
	CashConfirmationRate float64   `json:"cash_confirmation_rate"`
	AvgFulfillmentTime   float64   `json:"avg_fulfillment_time_hours"`
}

type AdminEmployeeShopAuth struct {
	EmployeeID   uuid.UUID `json:"employee_id"`
	EmployeeName string    `json:"employee_name"`
	BusinessID   uuid.UUID `json:"business_id"`
	ShopID       uuid.UUID `json:"shop_id"`
	ShopName     string    `json:"shop_name"`
	CanOperate   bool      `json:"can_operate"`
	Reason       string    `json:"reason,omitempty"`
}
