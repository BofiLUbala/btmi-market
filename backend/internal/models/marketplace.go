package models

import (
	"time"

	"github.com/google/uuid"
)

type PublicProductResponse struct {
	ID              uuid.UUID          `json:"id"`
	ShopID          uuid.UUID          `json:"shop_id"`
	ShopName        string             `json:"shop_name"`
	BusinessID      uuid.UUID          `json:"business_id"`
	BusinessName    string             `json:"business_name"`
	Name            string             `json:"name"`
	SKU             string             `json:"sku"`
	Description     string             `json:"description"`
	Unit            string             `json:"unit"`
	BasePrice       float64            `json:"base_price"`
	CategoryID      *uuid.UUID         `json:"category_id,omitempty"`
	SubcategoryID   *uuid.UUID         `json:"subcategory_id,omitempty"`
	Variants        []PublicVariantResponse `json:"variants"`
	SellerLevel     string             `json:"seller_level"`
	SellerTrust     string             `json:"seller_trust"`
	CreatedAt       time.Time          `json:"created_at"`
}

type PublicVariantResponse struct {
	ID        uuid.UUID `json:"id"`
	SKU       string    `json:"sku"`
	UnitPrice float64   `json:"unit_price"`
	Stock     string    `json:"stock"` // "AVAILABLE", "LOW_STOCK", "OUT_OF_STOCK"
	StockQty  int       `json:"stock_quantity"`
}

type BuyerPriceResponse struct {
	BasePrice           float64 `json:"base_price"`
	BuyerLevel          string  `json:"buyer_level"`
	DiscountPercent     float64 `json:"discount_percent"`
	DiscountAmount      float64 `json:"discount_amount"`
	FinalPrice          float64 `json:"final_price"`
	FreeDelivery        bool    `json:"free_delivery"`
	DeliveryDiscount    float64 `json:"delivery_discount_percent"`
}

type MarketplaceSearchParams struct {
	Query          string  `form:"q"`
	ShopID         string  `form:"shop_id"`
	BusinessID     string  `form:"business_id"`
	City           string  `form:"city"`
	CategorySlug   string  `form:"category"`
	SubcategorySlug string `form:"subcategory"`
	MinPrice       float64 `form:"min_price"`
	MaxPrice       float64 `form:"max_price"`
	Sort           string  `form:"sort"` // "relevance", "price_asc", "price_desc", "seller_level"
	Page           int     `form:"page"`
	Limit          int     `form:"limit"`
}

type MarketplaceSearchResult struct {
	Products  []*PublicProductResponse `json:"products"`
	Pagination PaginationInfo          `json:"pagination"`
}

type PublicShopResponse struct {
	ID              uuid.UUID `json:"id"`
	BusinessID      uuid.UUID `json:"business_id"`
	BusinessName    string    `json:"business_name"`
	Name            string    `json:"name"`
	Type            string    `json:"type"`
	City            string    `json:"city"`
	Address         string    `json:"address"`
	Phone           string    `json:"phone"`
	Status          string    `json:"status"`
	SellerLevel     string    `json:"seller_level"`
	SellerTrust     string    `json:"seller_trust"`
	ProductCount    int       `json:"product_count"`
	CreatedAt       time.Time `json:"created_at"`
}

type RankedShopResponse struct {
	ShopID          uuid.UUID `json:"shop_id"`
	BusinessID      uuid.UUID `json:"business_id"`
	BusinessName    string    `json:"business_name"`
	Name            string    `json:"name"`
	City            string    `json:"city"`
	SellerLevel     string    `json:"seller_level"`
	SellerTrust     string    `json:"seller_trust"`
	RankingScore    float64   `json:"ranking_score"`
	RankingPosition int       `json:"ranking_position"`
}

type CategoryWithTopShopsResponse struct {
	Category    *CategoryResponse   `json:"category"`
	TopShops    []*RankedShopResponse `json:"top_shops"`
	ProductCount int                  `json:"product_count,omitempty"`
}

type PublicShopDetailResponse struct {
	ID              uuid.UUID              `json:"id"`
	BusinessID      uuid.UUID              `json:"business_id"`
	BusinessName    string                 `json:"business_name"`
	Name            string                 `json:"name"`
	Type            string                 `json:"type"`
	City            string                 `json:"city"`
	Address         string                 `json:"address"`
	Phone           string                 `json:"phone"`
	Status          string                 `json:"status"`
	SellerLevel     string                 `json:"seller_level"`
	SellerTrust     string                 `json:"seller_trust"`
	ProductCount    int                    `json:"product_count"`
	Categories      []*CategorySummary     `json:"categories"`
	AverageRating   *float64              `json:"average_rating,omitempty"`
	TotalReviews    *int                  `json:"total_reviews,omitempty"`
	CreatedAt       time.Time              `json:"created_at"`
}

type CategorySummary struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
	Slug string    `json:"slug"`
}

type PublicProductDetailResponse struct {
	ID              uuid.UUID              `json:"id"`
	ShopID          uuid.UUID              `json:"shop_id"`
	ShopName        string                 `json:"shop_name"`
	BusinessID      uuid.UUID              `json:"business_id"`
	BusinessName    string                 `json:"business_name"`
	Name            string                 `json:"name"`
	SKU             string                 `json:"sku"`
	Description     string                 `json:"description"`
	Unit            string                 `json:"unit"`
	BasePrice       float64                `json:"base_price"`
	CategoryID      *uuid.UUID             `json:"category_id,omitempty"`
	SubcategoryID   *uuid.UUID             `json:"subcategory_id,omitempty"`
	Category        *CategorySummary       `json:"category,omitempty"`
	Subcategory     *CategorySummary       `json:"subcategory,omitempty"`
	Variants        []PublicVariantDetailResponse `json:"variants"`
	SellerLevel     string                 `json:"seller_level"`
	SellerTrust     string                 `json:"seller_trust"`
	Availability    string                 `json:"availability"`
	CreatedAt       time.Time              `json:"created_at"`
	BuyerLevel      string                 `json:"buyer_level,omitempty"`
	DiscountPercent float64                `json:"discount_percent,omitempty"`
	DiscountAmount  float64                `json:"discount_amount,omitempty"`
	FinalPrice      float64                `json:"final_price,omitempty"`
	FreeDelivery    bool                   `json:"free_delivery,omitempty"`
	DeliveryDiscount float64               `json:"delivery_discount_percent,omitempty"`
}

type PublicVariantDetailResponse struct {
	ID            uuid.UUID         `json:"id"`
	SKU           string            `json:"sku"`
	Name          string            `json:"name"`
	Attributes    map[string]string `json:"attributes"`
	UnitPrice     float64           `json:"unit_price"`
	Stock         string            `json:"stock"` // "AVAILABLE", "LOW_STOCK", "OUT_OF_STOCK"
	StockQty      int               `json:"stock_quantity"`
}

type ShopProductsParams struct {
	CategorySlug    string  `form:"category"`
	SubcategorySlug string  `form:"subcategory"`
	Query           string  `form:"q"`
	Availability    string  `form:"availability"` // "available", "low_stock", "out_of_stock"
	MinPrice        float64 `form:"min_price"`
	MaxPrice        float64 `form:"max_price"`
	Sort            string  `form:"sort"` // "relevance", "newest", "price_asc", "price_desc", "popular"
	Page            int     `form:"page"`
	Limit           int     `form:"limit"`
}
