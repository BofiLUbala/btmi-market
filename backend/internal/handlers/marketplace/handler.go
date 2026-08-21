package marketplace

import (
	"net/http"
	"strconv"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	marketplaceService     *service.MarketplaceService
	categoryRankingService *service.CategoryRankingService
	similarityService      *service.SimilarityService
	pointService           *service.PointService
	buyerService           *service.BuyerProfileService
	categoryService        *service.CategoryService
}

func NewHandler(
	marketplaceService *service.MarketplaceService,
	categoryRankingService *service.CategoryRankingService,
	similarityService *service.SimilarityService,
	pointService *service.PointService,
	buyerService *service.BuyerProfileService,
	categoryService *service.CategoryService,
) *Handler {
	return &Handler{
		marketplaceService:     marketplaceService,
		categoryRankingService: categoryRankingService,
		similarityService:      similarityService,
		pointService:           pointService,
		buyerService:           buyerService,
		categoryService:        categoryService,
	}
}

func (h *Handler) errResponse(c *gin.Context, statusCode int, errorCode, message string) {
	c.JSON(statusCode, models.ErrorResponse{
		Error: struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}{
			Code:    errorCode,
			Message: message,
		},
	})
}

// GET /api/v1/marketplace/shops
func (h *Handler) ListShops(c *gin.Context) {
	city := c.Query("city")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	shops, total, err := h.marketplaceService.ListShops(city, page, limit)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Shops retrieved successfully",
		Data: map[string]interface{}{
			"shops": shops,
			"pagination": models.PaginationInfo{
				Page:  page,
				Limit: limit,
				Total: total,
			},
		},
	})
}

// GET /api/v1/marketplace/shops/:shop_id
func (h *Handler) GetShop(c *gin.Context) {
	shopIDStr := c.Param("shop_id")
	shopID, err := uuid.Parse(shopIDStr)
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid shop ID")
		return
	}

	shop, err := h.marketplaceService.GetShop(shopID)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "SHOP_NOT_FOUND", "Shop not found")
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Shop retrieved successfully",
		Data:    shop,
	})
}

// GET /api/v1/marketplace/products
func (h *Handler) ListProducts(c *gin.Context) {
	shopIDStr := c.Query("shop_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	var shopID uuid.UUID
	if shopIDStr != "" {
		shopID, _ = uuid.Parse(shopIDStr)
	}

	products, total, err := h.marketplaceService.ListProducts(shopID, page, limit)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Products retrieved successfully",
		Data: map[string]interface{}{
			"products": products,
			"pagination": models.PaginationInfo{
				Page:  page,
				Limit: limit,
				Total: total,
			},
		},
	})
}

// GET /api/v1/marketplace/products/:product_id
func (h *Handler) GetProduct(c *gin.Context) {
	productIDStr := c.Param("product_id")
	productID, err := uuid.Parse(productIDStr)
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid product ID")
		return
	}

	product, err := h.marketplaceService.GetProduct(productID)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "PRODUCT_NOT_FOUND", "Product not found")
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Product retrieved successfully",
		Data:    product,
	})
}

// GET /api/v1/marketplace/products/:product_id/price
func (h *Handler) GetProductPrice(c *gin.Context) {
	productIDStr := c.Param("product_id")
	productID, err := uuid.Parse(productIDStr)
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid product ID")
		return
	}

	// Optional buyer price calculation
	var buyerProfileID *uuid.UUID
	if userIDStr, exists := c.Get("user_id"); exists {
		if userID, ok := userIDStr.(uuid.UUID); ok {
			if profile, err := h.buyerService.GetProfileByIDFromUser(userID); err == nil && profile != nil {
				buyerProfileID = &profile.ID
			}
		}
	}

	price, err := h.marketplaceService.GetProductPrice(productID, buyerProfileID)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "PRODUCT_NOT_FOUND", "Product not found")
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Product price retrieved successfully",
		Data:    price,
	})
}

// GET /api/v1/marketplace/search
func (h *Handler) SearchProducts(c *gin.Context) {
	params := &models.MarketplaceSearchParams{
		Query:      c.Query("q"),
		ShopID:     c.Query("shop_id"),
		BusinessID: c.Query("business_id"),
		City:       c.Query("city"),
		Sort:       c.Query("sort"),
	}
	params.Page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
	params.Limit, _ = strconv.Atoi(c.DefaultQuery("limit", "20"))

	if minStr := c.Query("min_price"); minStr != "" {
		params.MinPrice, _ = strconv.ParseFloat(minStr, 64)
	}
	if maxStr := c.Query("max_price"); maxStr != "" {
		params.MaxPrice, _ = strconv.ParseFloat(maxStr, 64)
	}

	results, err := h.marketplaceService.SearchProducts(params)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Search results retrieved successfully",
		Data:    results,
	})
}

// GET /api/v1/marketplace/categories
func (h *Handler) ListCategories(c *gin.Context) {
	categories, err := h.categoryService.ListCategories()
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Categories retrieved successfully",
		Data:    categories,
	})
}

// GET /api/v1/marketplace/categories/:category_slug/subcategories
func (h *Handler) ListSubcategories(c *gin.Context) {
	categorySlug := c.Param("category_slug")
	category, err := h.categoryService.GetCategoryDetailsBySlug(categorySlug)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "CATEGORY_NOT_FOUND", "Category not found")
		return
	}

	var subs []models.SubcategoryResponse
	for _, s := range category.Subcategories {
		subs = append(subs, models.SubcategoryResponse{
			ID:       s.ID,
			Name:     s.Name,
			Slug:     s.Slug,
			SortOrder: s.SortOrder,
		})
	}
	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Subcategories retrieved successfully",
		Data:    subs,
	})
}

// GET /api/v1/marketplace/categories/:category_slug/products
func (h *Handler) ListProductsByCategory(c *gin.Context) {
	categorySlug := c.Param("category_slug")
	subcategorySlug := c.Query("subcategory")
	city := c.Query("city")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	category, err := h.categoryService.GetCategoryDetailsBySlug(categorySlug)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "CATEGORY_NOT_FOUND", "Category not found")
		return
	}

	var subcategoryID uuid.UUID
	if subcategorySlug != "" {
		sub, err := h.categoryService.GetSubcategoryBySlug(category.ID, subcategorySlug)
		if err != nil {
			h.errResponse(c, http.StatusNotFound, "SUBCATEGORY_NOT_FOUND", "Subcategory not found in this category")
			return
		}
		subcategoryID = sub.ID
	}

	products, total, err := h.marketplaceService.ListProductsByCategory(category.ID, subcategoryID, city, page, limit)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Products retrieved successfully",
		Data: map[string]interface{}{
			"products": products,
			"pagination": models.PaginationInfo{
				Page:  page,
				Limit: limit,
				Total: total,
				HasMore: (page * limit) < total,
			},
		},
	})
}

// GET /api/v1/marketplace/categories/:category_slug/shops
func (h *Handler) ListCategoryTopShops(c *gin.Context) {
	categorySlug := c.Param("category_slug")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	shops, total, err := h.categoryRankingService.GetCategoryTopShops(c.Request.Context(), categorySlug, page, limit)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Category top shops retrieved successfully",
		Data: map[string]interface{}{
			"shops": shops,
			"pagination": models.PaginationInfo{
				Page:  page,
				Limit: limit,
				Total: total,
				HasMore: (page * limit) < total,
			},
		},
	})
}

// GET /api/v1/marketplace/shops/:shop_id/detail
func (h *Handler) GetShopDetail(c *gin.Context) {
	shopIDStr := c.Param("shop_id")
	shopID, err := uuid.Parse(shopIDStr)
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid shop ID")
		return
	}

	shop, err := h.marketplaceService.GetShopDetail(shopID)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "SHOP_NOT_FOUND", "Shop not found")
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Shop detail retrieved successfully",
		Data:    shop,
	})
}

// GET /api/v1/marketplace/shops/:shop_id/products
func (h *Handler) ListShopProducts(c *gin.Context) {
	shopIDStr := c.Param("shop_id")
	shopID, err := uuid.Parse(shopIDStr)
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid shop ID")
		return
	}

	params := &models.ShopProductsParams{
		CategorySlug:    c.Query("category"),
		SubcategorySlug: c.Query("subcategory"),
		Query:           c.Query("q"),
		Availability:    c.Query("availability"),
		Sort:            c.Query("sort"),
	}
	params.Page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
	params.Limit, _ = strconv.Atoi(c.DefaultQuery("limit", "20"))

	if minStr := c.Query("min_price"); minStr != "" {
		params.MinPrice, _ = strconv.ParseFloat(minStr, 64)
	}
	if maxStr := c.Query("max_price"); maxStr != "" {
		params.MaxPrice, _ = strconv.ParseFloat(maxStr, 64)
	}

	products, total, err := h.marketplaceService.ListShopProducts(shopID, params)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Shop products retrieved successfully",
		Data: map[string]interface{}{
			"products": products,
			"pagination": models.PaginationInfo{
				Page:  params.Page,
				Limit: params.Limit,
				Total: total,
				HasMore: (params.Page * params.Limit) < total,
			},
		},
	})
}

// GET /api/v1/marketplace/products/:product_id/detail
func (h *Handler) GetProductDetail(c *gin.Context) {
	productIDStr := c.Param("product_id")
	productID, err := uuid.Parse(productIDStr)
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid product ID")
		return
	}

	// Optional buyer price calculation
	var buyerProfileID *uuid.UUID
	if userIDStr, exists := c.Get("user_id"); exists {
		if userID, ok := userIDStr.(uuid.UUID); ok {
			if profile, err := h.buyerService.GetProfileByIDFromUser(userID); err == nil && profile != nil {
				buyerProfileID = &profile.ID
			}
		}
	}

	product, err := h.marketplaceService.GetProductDetail(productID, buyerProfileID)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "PRODUCT_NOT_FOUND", "Product not found")
		return
	}

	// Calculate personalized price if buyer is authenticated
	if buyerProfileID != nil {
		price, err := h.marketplaceService.GetProductPrice(productID, buyerProfileID)
		if err == nil {
			product.BasePrice = price.BasePrice
			product.BuyerLevel = price.BuyerLevel
			product.DiscountPercent = price.DiscountPercent
			product.DiscountAmount = price.DiscountAmount
			product.FinalPrice = price.FinalPrice
			product.FreeDelivery = price.FreeDelivery
			product.DeliveryDiscount = price.DeliveryDiscount
		}
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Product detail retrieved successfully",
		Data:    product,
	})
}

// GET /api/v1/marketplace/products/:product_id/similar
func (h *Handler) GetSimilarProducts(c *gin.Context) {
	productIDStr := c.Param("product_id")
	productID, err := uuid.Parse(productIDStr)
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid product ID")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	// Optional buyer price calculation
	var buyerProfileID *uuid.UUID
	if userIDStr, exists := c.Get("user_id"); exists {
		if userID, ok := userIDStr.(uuid.UUID); ok {
			if profile, err := h.buyerService.GetProfileByIDFromUser(userID); err == nil && profile != nil {
				buyerProfileID = &profile.ID
			}
		}
	}

	products, total, err := h.marketplaceService.GetSimilarProducts(c.Request.Context(), productID, buyerProfileID, page, limit)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Similar products retrieved successfully",
		Data: map[string]interface{}{
			"products": products,
			"pagination": models.PaginationInfo{
				Page:  page,
				Limit: limit,
				Total: total,
				HasMore: (page * limit) < total,
			},
		},
	})
}
