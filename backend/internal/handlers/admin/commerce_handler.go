package admin

import (
	"net/http"
	"strconv"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CommerceHandler struct {
	commerceService *service.AdminCommerceService
}

func NewCommerceHandler(commerceService *service.AdminCommerceService) *CommerceHandler {
	return &CommerceHandler{commerceService: commerceService}
}

// GET /api/v1/admin/commerce/overview
func (h *CommerceHandler) Overview(c *gin.Context) {
	stats, err := h.commerceService.GetOverview(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Commerce overview retrieved",
		Data:    stats,
	})
}

// GET /api/v1/admin/commerce/products
func (h *CommerceHandler) ListProducts(c *gin.Context) {
	search := c.Query("search")
	businessID := c.Query("business_id")
	categoryID := c.Query("category_id")
	subcategoryID := c.Query("subcategory_id")
	publicationStatus := c.Query("publication_status")
	stockStatus := c.Query("stock_status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	products, total, err := h.commerceService.ListProducts(search, businessID, categoryID, subcategoryID, publicationStatus, stockStatus, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Products retrieved successfully",
		"data": gin.H{
			"products": products,
			"total":    total,
			"limit":    limit,
			"offset":   offset,
		},
	})
}

// GET /api/v1/admin/commerce/products/:id
func (h *CommerceHandler) GetProduct(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_ID",
				Message: "Invalid product UUID",
			},
		})
		return
	}

	detail, err := h.commerceService.GetProductDetail(id)
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "PRODUCT_NOT_FOUND" {
			status = http.StatusNotFound
		}
		c.JSON(status, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "PRODUCT_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Product details retrieved",
		Data:    detail,
	})
}

// POST /api/v1/admin/commerce/products/:id/unpublish
func (h *CommerceHandler) UnpublishProduct(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_ID",
				Message: "Invalid product UUID",
			},
		})
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required,min=5"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_BODY",
				Message: "A mandatory reason of at least 5 characters is required",
			},
		})
		return
	}

	adminIDVal, _ := c.Get("admin_id")
	adminRoleVal, _ := c.Get("admin_role")
	adminID, _ := adminIDVal.(uuid.UUID)
	adminRole, _ := adminRoleVal.(models.AdminRole)

	err = h.commerceService.UnpublishProduct(adminID, adminRole, id, req.Reason, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UNPUBLISH_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Product unpublished successfully and hidden from marketplace",
	})
}

// POST /api/v1/admin/commerce/products/:id/publish
func (h *CommerceHandler) PublishProduct(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}{Code: "INVALID_ID", Message: "Invalid product UUID"}})
		return
	}
	var req struct {
		Reason string `json:"reason" binding:"required,min=5"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}{Code: "INVALID_BODY", Message: "A mandatory reason of at least 5 characters is required"}})
		return
	}
	adminIDVal, _ := c.Get("admin_id")
	adminRoleVal, _ := c.Get("admin_role")
	adminID, _ := adminIDVal.(uuid.UUID)
	adminRole, _ := adminRoleVal.(models.AdminRole)
	if err := h.commerceService.PublishProduct(adminID, adminRole, id, req.Reason, c.ClientIP(), c.Request.UserAgent()); err != nil {
		c.JSON(http.StatusUnprocessableEntity, models.ErrorResponse{Error: struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}{Code: "PUBLISH_FAILED", Message: err.Error()}})
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Product published successfully"})
}

// POST /api/v1/admin/commerce/products/:id/archive
func (h *CommerceHandler) ArchiveProduct(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_ID",
				Message: "Invalid product UUID",
			},
		})
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required,min=5"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_BODY",
				Message: "A mandatory reason of at least 5 characters is required",
			},
		})
		return
	}

	adminIDVal, _ := c.Get("admin_id")
	adminRoleVal, _ := c.Get("admin_role")
	adminID, _ := adminIDVal.(uuid.UUID)
	adminRole, _ := adminRoleVal.(models.AdminRole)

	err = h.commerceService.ArchiveProduct(adminID, adminRole, id, req.Reason, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "ARCHIVE_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Product archived safely without affecting historical orders",
	})
}

// GET /api/v1/admin/commerce/categories
func (h *CommerceHandler) ListCategories(c *gin.Context) {
	cats, err := h.commerceService.ListCategories()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Categories retrieved",
		Data:    cats,
	})
}

// POST /api/v1/admin/commerce/categories
func (h *CommerceHandler) CreateCategory(c *gin.Context) {
	var req models.CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_BODY",
				Message: err.Error(),
			},
		})
		return
	}

	adminIDVal, _ := c.Get("admin_id")
	adminRoleVal, _ := c.Get("admin_role")
	adminID, _ := adminIDVal.(uuid.UUID)
	adminRole, _ := adminRoleVal.(models.AdminRole)

	cat, err := h.commerceService.CreateCategory(adminID, adminRole, &req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "CREATE_CATEGORY_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Category created successfully",
		Data:    cat,
	})
}

// PATCH /api/v1/admin/commerce/categories/:id
func (h *CommerceHandler) UpdateCategory(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_ID",
				Message: "Invalid category UUID",
			},
		})
		return
	}

	var req models.UpdateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_BODY",
				Message: err.Error(),
			},
		})
		return
	}

	adminIDVal, _ := c.Get("admin_id")
	adminRoleVal, _ := c.Get("admin_role")
	adminID, _ := adminIDVal.(uuid.UUID)
	adminRole, _ := adminRoleVal.(models.AdminRole)

	reason := c.DefaultQuery("reason", "Admin category update")
	if err := h.commerceService.UpdateCategory(adminID, adminRole, id, &req, reason, c.ClientIP(), c.Request.UserAgent()); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UPDATE_CATEGORY_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Category updated successfully",
	})
}

// POST /api/v1/admin/commerce/subcategories
func (h *CommerceHandler) CreateSubcategory(c *gin.Context) {
	var req models.CreateSubcategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_BODY",
				Message: err.Error(),
			},
		})
		return
	}

	adminIDVal, _ := c.Get("admin_id")
	adminRoleVal, _ := c.Get("admin_role")
	adminID, _ := adminIDVal.(uuid.UUID)
	adminRole, _ := adminRoleVal.(models.AdminRole)

	sub, err := h.commerceService.CreateSubcategory(adminID, adminRole, &req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "CREATE_SUBCATEGORY_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Subcategory created successfully",
		Data:    sub,
	})
}

// PATCH /api/v1/admin/commerce/subcategories/:id
func (h *CommerceHandler) UpdateSubcategory(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_ID",
				Message: "Invalid subcategory UUID",
			},
		})
		return
	}

	var req models.UpdateSubcategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_BODY",
				Message: err.Error(),
			},
		})
		return
	}

	adminIDVal, _ := c.Get("admin_id")
	adminRoleVal, _ := c.Get("admin_role")
	adminID, _ := adminIDVal.(uuid.UUID)
	adminRole, _ := adminRoleVal.(models.AdminRole)

	reason := c.DefaultQuery("reason", "Admin subcategory update")
	if err := h.commerceService.UpdateSubcategory(adminID, adminRole, id, &req, reason, c.ClientIP(), c.Request.UserAgent()); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UPDATE_SUBCATEGORY_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Subcategory updated successfully",
	})
}

// GET /api/v1/admin/commerce/attribute-suggestions
func (h *CommerceHandler) AttributeSuggestions(c *gin.Context) {
	suggestions := h.commerceService.GetAttributeSuggestions()
	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Attribute suggestions retrieved",
		Data:    suggestions,
	})
}

// GET /api/v1/admin/commerce/inventory
func (h *CommerceHandler) ListInventory(c *gin.Context) {
	businessID := c.Query("business_id")
	shopID := c.Query("shop_id")
	stockStatus := c.Query("stock_status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	items, total, err := h.commerceService.ListInventory(businessID, shopID, stockStatus, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Inventory retrieved successfully",
		"data": gin.H{
			"inventory": items,
			"total":     total,
			"limit":     limit,
			"offset":    offset,
		},
	})
}

// GET /api/v1/admin/commerce/inventory/anomalies
func (h *CommerceHandler) ListStockAnomalies(c *gin.Context) {
	anomalies, err := h.commerceService.ListStockAnomalies()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Stock anomalies retrieved",
		Data:    anomalies,
	})
}

// POST /api/v1/admin/commerce/inventory/adjust
func (h *CommerceHandler) AdjustStock(c *gin.Context) {
	var req models.AdjustStockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_BODY",
				Message: err.Error(),
			},
		})
		return
	}

	adminIDVal, _ := c.Get("admin_id")
	adminRoleVal, _ := c.Get("admin_role")
	adminID, _ := adminIDVal.(uuid.UUID)
	adminRole, _ := adminRoleVal.(models.AdminRole)

	if err := h.commerceService.AdjustStock(adminID, adminRole, &req, c.ClientIP(), c.Request.UserAgent()); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "STOCK_ADJUSTMENT_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Stock adjusted successfully, movement logged and audited",
	})
}

// GET /api/v1/admin/commerce/orders
func (h *CommerceHandler) ListOrders(c *gin.Context) {
	status := c.Query("status")
	deliveryMethod := c.Query("delivery_method")
	shopID := c.Query("shop_id")
	businessID := c.Query("business_id")
	search := c.Query("search")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	orders, total, err := h.commerceService.ListOrders(status, deliveryMethod, shopID, businessID, search, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Orders retrieved successfully",
		"data": gin.H{
			"orders": orders,
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

// GET /api/v1/admin/commerce/orders/:id
func (h *CommerceHandler) GetOrder(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_ID",
				Message: "Invalid order UUID",
			},
		})
		return
	}

	detail, err := h.commerceService.GetOrderDetail(id)
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "ORDER_NOT_FOUND" {
			status = http.StatusNotFound
		}
		c.JSON(status, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "ORDER_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Order detail retrieved",
		Data:    detail,
	})
}

// GET /api/v1/admin/commerce/employees
func (h *CommerceHandler) ListEmployees(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	emps, total, err := h.commerceService.ListEmployees(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Employees retrieved successfully",
		"data": gin.H{
			"employees": emps,
			"total":     total,
			"limit":     limit,
			"offset":    offset,
		},
	})
}

// POST /api/v1/admin/commerce/employees/:id/revoke
func (h *CommerceHandler) RevokeEmployeeAccess(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_ID",
				Message: "Invalid employee UUID",
			},
		})
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required,min=5"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_BODY",
				Message: "A mandatory reason of at least 5 characters is required",
			},
		})
		return
	}

	adminIDVal, _ := c.Get("admin_id")
	adminRoleVal, _ := c.Get("admin_role")
	adminID, _ := adminIDVal.(uuid.UUID)
	adminRole, _ := adminRoleVal.(models.AdminRole)

	err = h.commerceService.RevokeEmployeeAccess(adminID, adminRole, id, req.Reason, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "REVOCATION_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Employee operational access revoked and recorded in audit log",
	})
}

// GET /api/v1/admin/commerce/inventory/history
func (h *CommerceHandler) ListStockMovementHistory(c *gin.Context) {
	businessID := c.Query("business_id")
	shopID := c.Query("shop_id")
	productID := c.Query("product_id")
	variantID := c.Query("variant_id")
	movementType := c.Query("movement_type")
	employeeID := c.Query("employee_id")
	fromDate := c.Query("from")
	toDate := c.Query("to")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	movements, total, err := h.commerceService.ListStockMovementHistory(businessID, shopID, productID, variantID, movementType, employeeID, fromDate, toDate, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Stock movement history retrieved successfully",
		"data": gin.H{
			"movements": movements,
			"total":     total,
			"limit":     limit,
			"offset":    offset,
		},
	})
}

// GET /api/v1/admin/commerce/marketplace/visibility/:id
func (h *CommerceHandler) GetMarketplaceVisibility(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_ID",
				Message: "Invalid product UUID",
			},
		})
		return
	}

	vis, err := h.commerceService.GetMarketplaceVisibility(id)
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "PRODUCT_NOT_FOUND" {
			status = http.StatusNotFound
		}
		c.JSON(status, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "VISIBILITY_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Marketplace visibility retrieved",
		Data:    vis,
	})
}

// GET /api/v1/admin/commerce/shops/:id/page-control
func (h *CommerceHandler) GetShopPageControl(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_ID",
				Message: "Invalid shop UUID",
			},
		})
		return
	}

	shop, err := h.commerceService.GetShopPageControl(id)
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "SHOP_NOT_FOUND" {
			status = http.StatusNotFound
		}
		c.JSON(status, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "SHOP_PAGE_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Shop page control retrieved",
		Data:    shop,
	})
}

// GET /api/v1/admin/commerce/search/analytics
func (h *CommerceHandler) GetSearchAnalytics(c *gin.Context) {
	analytics, err := h.commerceService.GetSearchAnalytics()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Search analytics retrieved",
		Data:    analytics,
	})
}

// GET /api/v1/admin/commerce/search/queries
func (h *CommerceHandler) ListSearchQueries(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	logs, total, err := h.commerceService.ListSearchQueries(limit, offset)
	if err != nil {
		if err.Error() == "SEARCH_LOG_NOT_IMPLEMENTED" {
			c.JSON(http.StatusNotImplemented, models.ErrorResponse{
				Error: struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				}{
					Code:    "NOT_IMPLEMENTED",
					Message: "Search query log not implemented. Create search_query_log table to enable this feature.",
				},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Search queries retrieved",
		"data": gin.H{
			"queries": logs,
			"total":   total,
			"limit":   limit,
			"offset":  offset,
		},
	})
}

// GET /api/v1/admin/commerce/marketplace/ranking
func (h *CommerceHandler) GetMarketplaceRanking(c *gin.Context) {
	ranking, err := h.commerceService.GetMarketplaceRanking()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Marketplace ranking factors retrieved",
		Data:    ranking,
	})
}

// GET /api/v1/admin/commerce/products/:id/card-quality
func (h *CommerceHandler) GetProductCardQuality(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_ID",
				Message: "Invalid product UUID",
			},
		})
		return
	}

	quality, err := h.commerceService.GetProductCardQuality(id)
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "PRODUCT_NOT_FOUND" {
			status = http.StatusNotFound
		}
		c.JSON(status, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "QUALITY_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Product card quality retrieved",
		Data:    quality,
	})
}

// GET /api/v1/admin/commerce/promotions
func (h *CommerceHandler) ListPromotionVisibility(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	promos, total, err := h.commerceService.ListPromotionVisibility(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Promotions retrieved",
		"data": gin.H{
			"promotions": promos,
			"total":      total,
			"limit":      limit,
			"offset":     offset,
		},
	})
}

// GET /api/v1/admin/commerce/sellers/performance
func (h *CommerceHandler) GetSellerPerformance(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	perf, total, err := h.commerceService.GetSellerPerformance(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Seller performance retrieved",
		"data": gin.H{
			"performance": perf,
			"total":       total,
			"limit":       limit,
			"offset":      offset,
		},
	})
}

// GET /api/v1/admin/commerce/products/performance
func (h *CommerceHandler) GetProductPerformance(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	perf, total, err := h.commerceService.GetProductPerformance(limit, offset)
	if err != nil {
		if err.Error() == "PRODUCT_EVENTS_NOT_IMPLEMENTED" {
			c.JSON(http.StatusNotImplemented, models.ErrorResponse{
				Error: struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				}{
					Code:    "NOT_IMPLEMENTED",
					Message: "Product performance requires product_events table. Create table to enable this feature.",
				},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Product performance retrieved",
		"data": gin.H{
			"performance": perf,
			"total":       total,
			"limit":       limit,
			"offset":      offset,
		},
	})
}

// GET /api/v1/admin/commerce/categories/performance
func (h *CommerceHandler) GetCategoryPerformance(c *gin.Context) {
	perf, err := h.commerceService.GetCategoryPerformance()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Category performance retrieved",
		Data:    perf,
	})
}

// GET /api/v1/admin/commerce/shops/performance
func (h *CommerceHandler) GetShopPerformance(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	perf, total, err := h.commerceService.GetShopPerformance(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Shop performance retrieved",
		"data": gin.H{
			"performance": perf,
			"total":       total,
			"limit":       limit,
			"offset":      offset,
		},
	})
}

// GET /api/v1/admin/commerce/employees/:id/shop-auth/:shopId
func (h *CommerceHandler) CheckEmployeeShopAuth(c *gin.Context) {
	employeeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_ID",
				Message: "Invalid employee UUID",
			},
		})
		return
	}

	shopID, err := uuid.Parse(c.Param("shopId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_ID",
				Message: "Invalid shop UUID",
			},
		})
		return
	}

	auth, err := h.commerceService.CheckEmployeeShopAuth(employeeID, shopID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Employee shop authorization checked",
		Data:    auth,
	})
}
