package inventory

import (
	"net/http"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	inventoryService    *service.InventoryService
	productImageService *service.ProductImageService
}

func NewHandler(inventoryService *service.InventoryService, productImageService *service.ProductImageService) *Handler {
	return &Handler{inventoryService: inventoryService, productImageService: productImageService}
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

func (h *Handler) extractUserID(c *gin.Context) (uuid.UUID, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		h.errResponse(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return uuid.Nil, false
	}
	return userID.(uuid.UUID), true
}

func (h *Handler) parseUUIDParam(c *gin.Context, paramName string) (uuid.UUID, bool) {
	paramStr := c.Param(paramName)
	id, err := uuid.Parse(paramStr)
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid "+paramName)
		return uuid.Nil, false
	}
	return id, true
}

func (h *Handler) AddStock(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	shopID, ok := h.parseUUIDParam(c, "shop_id")
	if !ok {
		return
	}

	var req models.AddStockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	inventory, err := h.inventoryService.AddStock(userID, shopID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "SHOP_NOT_FOUND", "VARIANT_NOT_FOUND", "PRODUCT_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = err.Error()
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Stock added successfully",
		Data: models.InventoryResponse{
			ID:               inventory.ID,
			BusinessID:       inventory.BusinessID,
			ShopID:           inventory.ShopID,
			ProductID:        inventory.ProductID,
			VariantID:        inventory.VariantID,
			Quantity:         inventory.Quantity,
			ReservedQuantity: inventory.ReservedQuantity,
			Available:        inventory.Quantity - inventory.ReservedQuantity,
			CreatedAt:        inventory.CreatedAt,
			UpdatedAt:        inventory.UpdatedAt,
		},
	})
}

func (h *Handler) RecordSale(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	shopID, ok := h.parseUUIDParam(c, "shop_id")
	if !ok {
		return
	}

	var req models.RecordSaleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	inventory, err := h.inventoryService.RecordSale(userID, shopID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "SHOP_NOT_FOUND", "VARIANT_NOT_FOUND", "PRODUCT_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = err.Error()
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "INSUFFICIENT_STOCK":
			statusCode = http.StatusConflict
			errorCode = "INSUFFICIENT_STOCK"
		case "EMPLOYEE_NOT_ASSIGNED_TO_SHOP":
			statusCode = http.StatusForbidden
			errorCode = "EMPLOYEE_NOT_ASSIGNED_TO_SHOP"
		case "INVALID_SALE_TYPE":
			statusCode = http.StatusBadRequest
			errorCode = "INVALID_SALE_TYPE"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Sale recorded successfully",
		Data: models.InventoryResponse{
			ID:               inventory.ID,
			BusinessID:       inventory.BusinessID,
			ShopID:           inventory.ShopID,
			ProductID:        inventory.ProductID,
			VariantID:        inventory.VariantID,
			Quantity:         inventory.Quantity,
			ReservedQuantity: inventory.ReservedQuantity,
			Available:        inventory.Quantity - inventory.ReservedQuantity,
			CreatedAt:        inventory.CreatedAt,
			UpdatedAt:        inventory.UpdatedAt,
		},
	})
}

func (h *Handler) ReserveStock(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	shopID, ok := h.parseUUIDParam(c, "shop_id")
	if !ok {
		return
	}

	var req models.ReserveStockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	inventory, err := h.inventoryService.ReserveStock(userID, shopID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "SHOP_NOT_FOUND", "VARIANT_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = err.Error()
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "INSUFFICIENT_STOCK":
			statusCode = http.StatusConflict
			errorCode = "INSUFFICIENT_STOCK"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Stock reserved successfully",
		Data: models.InventoryResponse{
			ID:               inventory.ID,
			BusinessID:       inventory.BusinessID,
			ShopID:           inventory.ShopID,
			ProductID:        inventory.ProductID,
			VariantID:        inventory.VariantID,
			Quantity:         inventory.Quantity,
			ReservedQuantity: inventory.ReservedQuantity,
			Available:        inventory.Quantity - inventory.ReservedQuantity,
			CreatedAt:        inventory.CreatedAt,
			UpdatedAt:        inventory.UpdatedAt,
		},
	})
}

func (h *Handler) ReleaseStock(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	shopID, ok := h.parseUUIDParam(c, "shop_id")
	if !ok {
		return
	}

	var req models.ReleaseStockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	inventory, err := h.inventoryService.ReleaseStock(userID, shopID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "SHOP_NOT_FOUND", "VARIANT_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = err.Error()
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "INSUFFICIENT_RESERVED":
			statusCode = http.StatusConflict
			errorCode = "INSUFFICIENT_RESERVED"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Stock released successfully",
		Data: models.InventoryResponse{
			ID:               inventory.ID,
			BusinessID:       inventory.BusinessID,
			ShopID:           inventory.ShopID,
			ProductID:        inventory.ProductID,
			VariantID:        inventory.VariantID,
			Quantity:         inventory.Quantity,
			ReservedQuantity: inventory.ReservedQuantity,
			Available:        inventory.Quantity - inventory.ReservedQuantity,
			CreatedAt:        inventory.CreatedAt,
			UpdatedAt:        inventory.UpdatedAt,
		},
	})
}

func (h *Handler) GetShopInventory(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	shopID, ok := h.parseUUIDParam(c, "shop_id")
	if !ok {
		return
	}

	inventory, err := h.inventoryService.GetShopInventory(userID, shopID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "SHOP_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "SHOP_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Shop inventory retrieved successfully",
		Data:    inventory,
	})
}

func (h *Handler) GetVariantInventory(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	variantID, ok := h.parseUUIDParam(c, "variant_id")
	if !ok {
		return
	}

	inventory, err := h.inventoryService.GetVariantInventory(userID, variantID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "VARIANT_NOT_FOUND", "PRODUCT_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = err.Error()
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Variant inventory retrieved successfully",
		Data:    inventory,
	})
}

func (h *Handler) GetStockMovements(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	shopID, ok := h.parseUUIDParam(c, "shop_id")
	if !ok {
		return
	}

	movements, err := h.inventoryService.GetStockMovements(userID, shopID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "SHOP_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "SHOP_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Stock movements retrieved successfully",
		Data:    movements,
	})
}

func (h *Handler) GetStockEvents(c *gin.Context) {
	events := h.inventoryService.GetStockEvents()

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Stock events retrieved successfully",
		Data:    events,
	})
}

func (h *Handler) CreateProduct(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	businessID, ok := h.parseUUIDParam(c, "business_id")
	if !ok {
		return
	}

	var req models.CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	product, err := h.inventoryService.CreateProduct(userID, businessID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Product created successfully",
		Data: models.ProductResponse{
			ID:          product.ID,
			BusinessID:  product.BusinessID,
			Name:        product.Name,
			SKU:         product.SKU,
			Description: product.Description,
			UnitPrice:   product.UnitPrice,
			CostPrice:   product.CostPrice,
			Unit:        product.Unit,
			Status:      product.Status,
			PublicationStatus: product.PublicationStatus,
			CategoryID:  product.CategoryID,
			SubcategoryID: product.SubcategoryID,
			CreatedAt:   product.CreatedAt,
			UpdatedAt:   product.UpdatedAt,
		},
	})
}

func (h *Handler) UpdateProduct(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	businessID, ok := h.parseUUIDParam(c, "business_id")
	if !ok {
		return
	}

	productIDStr := c.Param("product_id")
	productID, err := uuid.Parse(productIDStr)
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid product ID")
		return
	}

	var req models.UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	product, err := h.inventoryService.UpdateProduct(userID, businessID, productID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "PRODUCT_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "PRODUCT_NOT_FOUND"
		case "INVALID_CATEGORY_ID", "CATEGORY_NOT_FOUND", "CATEGORY_INACTIVE",
			"INVALID_SUBCATEGORY_ID", "SUBCATEGORY_NOT_FOUND", "INVALID_SUBCATEGORY":
			statusCode = http.StatusBadRequest
			errorCode = err.Error()
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Product updated successfully",
		Data: models.ProductResponse{
			ID:          product.ID,
			BusinessID:  product.BusinessID,
			Name:        product.Name,
			SKU:         product.SKU,
			Description: product.Description,
			UnitPrice:   product.UnitPrice,
			CostPrice:   product.CostPrice,
			Unit:        product.Unit,
			Status:      product.Status,
			PublicationStatus: product.PublicationStatus,
			CategoryID:  product.CategoryID,
			SubcategoryID: product.SubcategoryID,
			CreatedAt:   product.CreatedAt,
			UpdatedAt:   product.UpdatedAt,
		},
	})
}

func (h *Handler) ListProducts(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	businessID, ok := h.parseUUIDParam(c, "business_id")
	if !ok {
		return
	}

	products, err := h.inventoryService.ListProductsByBusiness(userID, businessID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Products retrieved successfully",
		Data:    products,
	})
}

func (h *Handler) GetProduct(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	_, ok = h.parseUUIDParam(c, "business_id")
	if !ok {
		return
	}

	productID, ok := h.parseUUIDParam(c, "product_id")
	if !ok {
		return
	}

	product, err := h.inventoryService.GetProductByID(userID, productID)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "PRODUCT_NOT_FOUND", "Product not found")
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Product retrieved successfully",
		Data: models.ProductResponse{
			ID:          product.ID,
			BusinessID:  product.BusinessID,
			Name:        product.Name,
			SKU:         product.SKU,
			Description: product.Description,
			UnitPrice:   product.UnitPrice,
			CostPrice:   product.CostPrice,
			Unit:        product.Unit,
			Status:      product.Status,
			PublicationStatus: product.PublicationStatus,
			CategoryID:  product.CategoryID,
			SubcategoryID: product.SubcategoryID,
			CreatedAt:   product.CreatedAt,
			UpdatedAt:   product.UpdatedAt,
		},
	})
}

func (h *Handler) CreateVariant(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	productID, ok := h.parseUUIDParam(c, "product_id")
	if !ok {
		return
	}

	var req models.CreateVariantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	variant, err := h.inventoryService.CreateVariant(userID, productID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "PRODUCT_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "PRODUCT_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Variant created successfully",
		Data:    toVariantResponse(variant),
	})
}

func (h *Handler) ListVariants(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	productID, ok := h.parseUUIDParam(c, "product_id")
	if !ok {
		return
	}

	variants, err := h.inventoryService.ListVariantsByProduct(userID, productID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "PRODUCT_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "PRODUCT_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	var responses []models.VariantResponse
	for _, v := range variants {
		responses = append(responses, toVariantResponse(v))
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Variants retrieved successfully",
		Data:    responses,
	})
}

func (h *Handler) GetVariant(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	variantID, ok := h.parseUUIDParam(c, "variant_id")
	if !ok {
		return
	}

	variant, err := h.inventoryService.GetVariantByID(userID, variantID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "VARIANT_NOT_FOUND", "PRODUCT_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = err.Error()
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Variant retrieved successfully",
		Data:    toVariantResponse(variant),
	})
}

func (h *Handler) UpdateVariant(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	variantID, ok := h.parseUUIDParam(c, "variant_id")
	if !ok {
		return
	}

	var req models.UpdateVariantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	variant, err := h.inventoryService.UpdateVariant(userID, variantID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "VARIANT_NOT_FOUND", "PRODUCT_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = err.Error()
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Variant updated successfully",
		Data:    toVariantResponse(variant),
	})
}

func (h *Handler) ReceiveStock(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	businessID, ok := h.parseUUIDParam(c, "business_id")
	if !ok {
		return
	}

	var req models.CreateReceiptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	receipt, err := h.inventoryService.ReceiveStock(userID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "SHOP_NOT_FOUND", "VARIANT_NOT_FOUND", "PRODUCT_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = err.Error()
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	_ = businessID

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Stock received successfully",
		Data:    receipt,
	})
}

func (h *Handler) GetReceipt(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	receiptID, ok := h.parseUUIDParam(c, "receipt_id")
	if !ok {
		return
	}

	receipt, err := h.inventoryService.GetReceiptByID(userID, receiptID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "RECEIPT_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "RECEIPT_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Receipt retrieved successfully",
		Data:    receipt,
	})
}

func (h *Handler) ListReceipts(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	businessID, ok := h.parseUUIDParam(c, "business_id")
	if !ok {
		return
	}

	receipts, err := h.inventoryService.ListReceiptsByBusiness(userID, businessID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Receipts retrieved successfully",
		Data:    receipts,
	})
}

func toVariantResponse(v *models.ProductVariant) models.VariantResponse {
	return models.VariantResponse{
		ID:            v.ID,
		ProductID:     v.ProductID,
		SKU:           v.SKU,
		Name:          v.Name,
		Attributes:    v.Attributes,
		SalePrice:     v.SalePrice,
		PurchasePrice: v.PurchasePrice,
		Barcode:       v.Barcode,
		Unit:          v.Unit,
		Status:        v.Status,
		CreatedAt:     v.CreatedAt,
		UpdatedAt:     v.UpdatedAt,
	}
}

func (h *Handler) GetShopStockHistory(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	shopID, ok := h.parseUUIDParam(c, "shop_id")
	if !ok {
		return
	}

	var query models.StockMovementHistoryQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid query parameters: "+err.Error())
		return
	}

	result, err := h.inventoryService.GetShopStockHistory(userID, shopID, query)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "SHOP_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "SHOP_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "INVALID_REQUEST":
			statusCode = http.StatusBadRequest
			errorCode = "INVALID_REQUEST"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Stock history retrieved successfully",
		Data:    result,
	})
}

func (h *Handler) GetVariantStockHistory(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	variantID, ok := h.parseUUIDParam(c, "variant_id")
	if !ok {
		return
	}

	var query models.StockMovementHistoryQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid query parameters: "+err.Error())
		return
	}

	result, err := h.inventoryService.GetVariantStockHistory(userID, variantID, query)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "VARIANT_NOT_FOUND", "PRODUCT_NOT_FOUND", "SHOP_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = err.Error()
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "INVALID_REQUEST":
			statusCode = http.StatusBadRequest
			errorCode = "INVALID_REQUEST"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Variant stock history retrieved successfully",
		Data:    result,
	})
}

func (h *Handler) GetBusinessStockHistory(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	businessID, ok := h.parseUUIDParam(c, "business_id")
	if !ok {
		return
	}

	var query models.StockMovementHistoryQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid query parameters: "+err.Error())
		return
	}

	result, err := h.inventoryService.GetBusinessStockHistory(userID, businessID, query)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "INVALID_REQUEST":
			statusCode = http.StatusBadRequest
			errorCode = "INVALID_REQUEST"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Business stock history retrieved successfully",
		Data:    result,
	})
}

func (h *Handler) UploadProductImage(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	businessID, ok := h.parseUUIDParam(c, "business_id")
	if !ok {
		return
	}
	productID, ok := h.parseUUIDParam(c, "product_id")
	if !ok {
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "An image file is required (field 'file').")
		return
	}

	makePrimary := c.PostForm("is_primary") == "true"

	image, err := h.productImageService.Upload(userID, businessID, productID, fileHeader, makePrimary)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"
		switch err.Error() {
		case "PRODUCT_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = err.Error()
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = err.Error()
		case "IMAGE_TOO_LARGE":
			statusCode = http.StatusBadRequest
			errorCode = err.Error()
		case "INVALID_IMAGE_TYPE":
			statusCode = http.StatusBadRequest
			errorCode = err.Error()
		case "IMAGE_LIMIT_REACHED":
			statusCode = http.StatusBadRequest
			errorCode = err.Error()
		case "IMAGE_READ_FAILED", "IMAGE_STORAGE_FAILED", "IMAGE_SAVE_FAILED":
			statusCode = http.StatusBadRequest
			errorCode = err.Error()
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Image uploaded successfully",
		Data:    image,
	})
}

func (h *Handler) ListProductImages(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	businessID, ok := h.parseUUIDParam(c, "business_id")
	if !ok {
		return
	}
	productID, ok := h.parseUUIDParam(c, "product_id")
	if !ok {
		return
	}

	images, err := h.productImageService.List(userID, businessID, productID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		switch err.Error() {
		case "PRODUCT_NOT_FOUND":
			statusCode = http.StatusNotFound
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
		}
		h.errResponse(c, statusCode, err.Error(), err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Product images",
		Data:    images,
	})
}

func (h *Handler) DeleteProductImage(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	businessID, ok := h.parseUUIDParam(c, "business_id")
	if !ok {
		return
	}
	productID, ok := h.parseUUIDParam(c, "product_id")
	if !ok {
		return
	}
	imageID, ok := h.parseUUIDParam(c, "image_id")
	if !ok {
		return
	}

	if err := h.productImageService.Delete(userID, businessID, productID, imageID); err != nil {
		statusCode := http.StatusInternalServerError
		switch err.Error() {
		case "IMAGE_NOT_FOUND":
			statusCode = http.StatusNotFound
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
		}
		h.errResponse(c, statusCode, err.Error(), err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Image deleted successfully"})
}

// RemoveProductFromShop stops selling one Product at one Shop.
func (h *Handler) RemoveProductFromShop(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	shopID, ok := h.parseUUIDParam(c, "shop_id")
	if !ok {
		return
	}
	productID, ok := h.parseUUIDParam(c, "product_id")
	if !ok {
		return
	}

	removed, err := h.inventoryService.RemoveProductFromShop(userID, shopID, productID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		switch err.Error() {
		case "SHOP_NOT_FOUND", "PRODUCT_NOT_FOUND":
			statusCode = http.StatusNotFound
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
		}
		h.errResponse(c, statusCode, err.Error(), err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Product removed from Shop",
		Data:    gin.H{"variants_removed": removed},
	})
}
