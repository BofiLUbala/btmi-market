package orders

import (
	"net/http"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	orderService        *service.OrderService
	pointRedemptionSvc  *service.PointRedemptionService
	buyerProfileService *service.BuyerProfileService
	paymentService      *service.PaymentService
}

func NewHandler(orderService *service.OrderService, pointRedemptionSvc *service.PointRedemptionService, buyerProfileService *service.BuyerProfileService, paymentService *service.PaymentService) *Handler {
	return &Handler{orderService: orderService, pointRedemptionSvc: pointRedemptionSvc, buyerProfileService: buyerProfileService, paymentService: paymentService}
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

func (h *Handler) extractBuyerProfileID(c *gin.Context) (uuid.UUID, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		h.errResponse(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return uuid.Nil, false
	}
	profile, err := h.buyerProfileService.GetProfileByIDFromUser(userID.(uuid.UUID))
	if err != nil || profile == nil {
		h.errResponse(c, http.StatusNotFound, "BUYER_PROFILE_NOT_FOUND", "Buyer profile not found")
		return uuid.Nil, false
	}
	return profile.ID, true
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

func (h *Handler) CreateOrder(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	var req models.CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	result, err := h.orderService.CreateOrder(userID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "SHOP_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "SHOP_NOT_FOUND"
		case "PRODUCT_NOT_FOUND", "VARIANT_NOT_FOUND", "INVENTORY_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = err.Error()
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "INSUFFICIENT_STOCK":
			statusCode = http.StatusConflict
			errorCode = "INSUFFICIENT_STOCK"
		case "INVALID_SHOP_ID", "INVALID_PRODUCT_ID", "INVALID_VARIANT_ID":
			statusCode = http.StatusBadRequest
			errorCode = err.Error()
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Order created successfully",
		Data:    result,
	})
}

func (h *Handler) GetOrder(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}

	result, err := h.orderService.GetOrderByID(userID, orderID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "ORDER_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Order retrieved successfully",
		Data:    result,
	})
}

func (h *Handler) ListShopOrders(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	shopID, ok := h.parseUUIDParam(c, "shop_id")
	if !ok {
		return
	}

	orders, err := h.orderService.ListShopOrders(userID, shopID)
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
		Message: "Orders retrieved successfully",
		Data:    orders,
	})
}

func (h *Handler) ListBusinessOrders(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	businessID, ok := h.parseUUIDParam(c, "business_id")
	if !ok {
		return
	}

	orders, err := h.orderService.ListBusinessOrders(userID, businessID)
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
		Message: "Orders retrieved successfully",
		Data:    orders,
	})
}

func (h *Handler) AcceptOrder(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}

	order, err := h.orderService.AcceptOrder(userID, orderID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "ORDER_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "INVALID_STATUS_TRANSITION":
			statusCode = http.StatusBadRequest
			errorCode = "INVALID_STATUS_TRANSITION"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Order accepted successfully",
		Data:    toOrderResponse(order),
	})
}

// POST /api/v1/seller/orders/:order_id/tracking/status
func (h *Handler) SellerTransitionOrder(c *gin.Context) {
	userID, _ := c.Get("user_id")
	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}

	// Get the order to extract shop_id (same pattern as existing seller handlers).
	order, err := h.orderService.GetOrderRaw(orderID)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "ORDER_NOT_FOUND", "Order not found")
		return
	}

	if err := h.orderService.RequireShopAccess(userID.(uuid.UUID), order.ShopID); err != nil {
		h.errResponse(c, http.StatusForbidden, "FORBIDDEN", "Not authorized for this shop")
		return
	}

	var req models.TrackingStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	newStatus := models.OrderStatus(req.Status)
	updated, err := h.orderService.TransitionOrder(orderID, userID.(uuid.UUID), newStatus, "", "SELLER")
	if err != nil {
		statusCode := http.StatusBadRequest
		errorCode := "INVALID_TRANSITION"
		switch err.Error() {
		case "ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "ORDER_NOT_FOUND"
		case "SELLER_CANNOT_CONFIRM_RECEIVED":
			statusCode = http.StatusBadRequest
			errorCode = "SELLER_CANNOT_CONFIRM_RECEIVED"
		}
		if strings.HasPrefix(err.Error(), "INVALID_TRANSITION:") {
			statusCode = http.StatusBadRequest
			errorCode = "INVALID_TRANSITION"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Order status updated",
		Data:    toOrderResponse(updated),
	})
}

// POST /api/v1/buyer/orders/:order_id/received
func (h *Handler) ConfirmBuyerReceived(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}
	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}
	userID, _ := c.Get("user_id")

	// Verify buyer owns this order.
	order, err := h.orderService.GetOrderRaw(orderID)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "ORDER_NOT_FOUND", "Order not found")
		return
	}
	if order.BuyerProfileID == nil || *order.BuyerProfileID != buyerProfileID {
		h.errResponse(c, http.StatusForbidden, "FORBIDDEN", "Not your order")
		return
	}

	// Receipt and payment are independent. Completion only happens when both exist.
	updated, err := h.orderService.TransitionOrder(order.ID, userID.(uuid.UUID), models.OrderStatusReceived, "Buyer confirmed received", "BUYER")
	if err != nil {
		statusCode := http.StatusBadRequest
		errorCode := "INVALID_TRANSITION"
		if strings.HasPrefix(err.Error(), "INVALID_TRANSITION:") {
			statusCode = http.StatusBadRequest
			errorCode = "INVALID_TRANSITION"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	if completed, completeErr := h.orderService.CompleteIfReceivedAndPaid(order.ID); completeErr == nil {
		updated = completed
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Order received confirmed",
		Data:    toOrderResponse(updated),
	})
}

// GET /api/v1/buyer/orders/:order_id/tracking
func (h *Handler) GetOrderTracking(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}
	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}

	tracking, err := h.orderService.GetOrderTracking(orderID, buyerProfileID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"
		switch err.Error() {
		case "ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "ORDER_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Tracking information retrieved",
		Data:    tracking,
	})
}

func (h *Handler) RejectOrder(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}

	order, err := h.orderService.RejectOrder(userID, orderID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "ORDER_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "INVALID_STATUS_TRANSITION":
			statusCode = http.StatusBadRequest
			errorCode = "INVALID_STATUS_TRANSITION"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Order rejected successfully",
		Data:    toOrderResponse(order),
	})
}

func (h *Handler) PrepareOrder(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}

	order, err := h.orderService.PrepareOrder(userID, orderID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "ORDER_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "INVALID_STATUS_TRANSITION":
			statusCode = http.StatusBadRequest
			errorCode = "INVALID_STATUS_TRANSITION"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Order preparation started",
		Data:    toOrderResponse(order),
	})
}

func (h *Handler) CompleteOrder(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}

	order, err := h.orderService.CompleteOrder(userID, orderID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "ORDER_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "INVALID_STATUS_TRANSITION":
			statusCode = http.StatusBadRequest
			errorCode = "INVALID_STATUS_TRANSITION"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Order completed successfully",
		Data:    toOrderResponse(order),
	})
}

func (h *Handler) CancelOrder(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}

	order, err := h.orderService.CancelOrder(userID, orderID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "ORDER_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "INVALID_STATUS_TRANSITION":
			statusCode = http.StatusBadRequest
			errorCode = "INVALID_STATUS_TRANSITION"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Order cancelled successfully",
		Data:    toOrderResponse(order),
	})
}

func toOrderResponse(order *models.Order) models.OrderResponse {
	return models.OrderResponse{
		ID:                     order.ID,
		BusinessID:             order.BusinessID,
		ShopID:                 order.ShopID,
		CustomerID:             order.CustomerID,
		BuyerProfileID:         order.BuyerProfileID,
		Status:                 string(order.Status),
		TotalItems:             order.TotalItems,
		Notes:                  order.Notes,
		CreatedBy:              order.CreatedBy,
		BaseTotal:              order.BaseTotal,
		PointsUsed:             order.PointsUsed,
		PointsDiscountAmount:   order.PointsDiscountAmount,
		FinalTotal:             order.FinalTotal,
		IdempotencyKey:         order.IdempotencyKey,
		OrderNumber:            order.OrderNumber,
		DeliveryMethod:         order.DeliveryMethod,
		DeliveryFeeBase:        order.DeliveryFeeBase,
		DeliveryPointsUsed:     order.DeliveryPointsUsed,
		DeliveryPointsDiscount: order.DeliveryPointsDiscount,
		DeliveryFeeFinal:       order.DeliveryFeeFinal,
		DeliveryContactName:    order.DeliveryContactName,
		DeliveryPhone:          order.DeliveryPhone,
		DeliveryAddress:        order.DeliveryAddress,
		DeliveryNotes:          order.DeliveryNotes,
		PointsFinalized:        order.PointsFinalized,
		AcceptedAt:             order.AcceptedAt,
		PreparingAt:            order.PreparingAt,
		ReadyAt:                order.ReadyAt,
		OutForDeliveryAt:       order.OutForDeliveryAt,
		DeliveredAt:            order.DeliveredAt,
		ReceivedAt:             order.ReceivedAt,
		CompletedAt:            order.CompletedAt,
		CreatedAt:              order.CreatedAt,
		UpdatedAt:              order.UpdatedAt,
	}
}

// POST /api/v1/buyer/orders/preview
func (h *Handler) PreviewOrder(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}

	var req models.PointRedemptionPreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	shopID, err := uuid.Parse(req.ShopID)
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid shop ID")
		return
	}

	preview, err := h.pointRedemptionSvc.GetRedemptionPreview(buyerProfileID, shopID, req.Items, req.UsePoints)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "NO_POINT_ACCOUNT":
			statusCode = http.StatusNotFound
			errorCode = "NO_POINT_ACCOUNT"
		case "INVALID_VARIANT_ID", "VARIANT_NOT_FOUND", "PRODUCT_NOT_FOUND", "INVENTORY_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = err.Error()
		case "INSUFFICIENT_STOCK":
			statusCode = http.StatusConflict
			errorCode = "INSUFFICIENT_STOCK"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Preview calculated successfully",
		Data:    preview,
	})
}

// POST /api/v1/buyer/orders
func (h *Handler) CreateBuyerOrder(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}

	var req models.BuyerCreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	result, err := h.orderService.CreateBuyerOrder(buyerProfileID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "SHOP_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "SHOP_NOT_FOUND"
		case "SHOP_NOT_ACTIVE":
			statusCode = http.StatusBadRequest
			errorCode = "SHOP_NOT_ACTIVE"
		case "BUYER_PROFILE_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "BUYER_PROFILE_NOT_FOUND"
		case "BUYER_PROFILE_INCOMPLETE":
			statusCode = http.StatusForbidden
			errorCode = "BUYER_PROFILE_INCOMPLETE"
		case "INSUFFICIENT_STOCK":
			statusCode = http.StatusConflict
			errorCode = "INSUFFICIENT_STOCK"
		case "INSUFFICIENT_POINTS":
			statusCode = http.StatusBadRequest
			errorCode = "INSUFFICIENT_POINTS"
		case "DUPLICATE_ORDER":
			statusCode = http.StatusConflict
			errorCode = "DUPLICATE_ORDER"
		case "INVALID_SHOP_ID", "INVALID_PRODUCT_ID", "INVALID_VARIANT_ID":
			statusCode = http.StatusBadRequest
			errorCode = err.Error()
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Buyer order created successfully",
		Data:    result,
	})
}

// GET /api/v1/buyer/orders
func (h *Handler) ListBuyerOrders(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}

	orders, err := h.orderService.ListBuyerOrders(buyerProfileID)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Buyer orders retrieved successfully",
		Data:    orders,
	})
}

// GET /api/v1/buyer/orders/:order_id
func (h *Handler) GetBuyerOrder(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}

	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}

	order, err := h.orderService.GetBuyerOrderByID(buyerProfileID, orderID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "ORDER_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Buyer order retrieved successfully",
		Data:    order,
	})
}

// GET /api/v1/buyer/orders/:order_id/delivery-options
func (h *Handler) GetDeliveryOptions(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}
	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}

	result, err := h.orderService.GetDeliveryOptions(buyerProfileID, orderID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"
		switch err.Error() {
		case "ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "ORDER_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "SHOP_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "SHOP_NOT_FOUND"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Delivery options retrieved successfully",
		Data:    result,
	})
}

// POST /api/v1/buyer/orders/:order_id/delivery
func (h *Handler) SelectDelivery(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}
	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}

	var req models.SelectDeliveryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	result, err := h.orderService.SelectDelivery(buyerProfileID, orderID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"
		switch err.Error() {
		case "ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "ORDER_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "INVALID_STATUS_TRANSITION", "INVALID_DELIVERY_METHOD", "DELIVERY_NOT_AVAILABLE", "DELIVERY_ADDRESS_REQUIRED":
			statusCode = http.StatusBadRequest
			errorCode = err.Error()
		case "PAYMENT_ALREADY_CREATED":
			statusCode = http.StatusConflict
			errorCode = "PAYMENT_ALREADY_CREATED"
		case "SHOP_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "SHOP_NOT_FOUND"
		case "INSUFFICIENT_POINTS":
			statusCode = http.StatusBadRequest
			errorCode = "INSUFFICIENT_POINTS"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Delivery selected successfully",
		Data:    result,
	})
}

// POST /api/v1/buyer/orders/:order_id/delivery-points-preview
func (h *Handler) DeliveryPointsPreview(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}
	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}

	var req models.DeliveryPointsPreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	result, err := h.orderService.GetDeliveryPointsPreview(buyerProfileID, orderID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"
		switch err.Error() {
		case "ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "ORDER_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "DELIVERY_NOT_SELECTED":
			statusCode = http.StatusBadRequest
			errorCode = "DELIVERY_NOT_SELECTED"
		case "NO_POINT_ACCOUNT":
			statusCode = http.StatusNotFound
			errorCode = "NO_POINT_ACCOUNT"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Delivery points preview calculated successfully",
		Data:    result,
	})
}

// POST /api/v1/buyer/orders/:order_id/points-preview
func (h *Handler) OrderPointsPreview(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}
	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}

	var req models.OrderPointsPreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	result, err := h.orderService.GetOrderPointsPreview(buyerProfileID, orderID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"
		switch err.Error() {
		case "ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "ORDER_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "NO_POINT_ACCOUNT":
			statusCode = http.StatusNotFound
			errorCode = "NO_POINT_ACCOUNT"
		case "INSUFFICIENT_STOCK":
			statusCode = http.StatusConflict
			errorCode = "INSUFFICIENT_STOCK"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Order points preview calculated successfully",
		Data:    result,
	})
}

// POST /api/v1/buyer/orders/:order_id/payment
func (h *Handler) CreateBuyerPayment(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}
	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}

	result, err := h.paymentService.CreatePayment(buyerProfileID, orderID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"
		switch err.Error() {
		case "ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "ORDER_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "INVALID_STATUS_TRANSITION", "DELIVERY_NOT_SELECTED":
			statusCode = http.StatusBadRequest
			errorCode = err.Error()
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Cash payment created successfully",
		Data:    result,
	})
}

// GET /api/v1/buyer/orders/:order_id/payment
func (h *Handler) GetBuyerPayment(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}
	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}

	result, err := h.paymentService.GetPaymentByOrder(buyerProfileID, orderID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"
		switch err.Error() {
		case "ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "ORDER_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "PAYMENT_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "PAYMENT_NOT_FOUND"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Payment retrieved successfully",
		Data:    result,
	})
}

// POST /api/v1/buyer/payments/:payment_id/buyer-confirm
func (h *Handler) BuyerConfirmPayment(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}
	paymentID, ok := h.parseUUIDParam(c, "payment_id")
	if !ok {
		return
	}

	result, err := h.paymentService.BuyerConfirm(buyerProfileID, paymentID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"
		switch err.Error() {
		case "PAYMENT_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "PAYMENT_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}
	if result.Status == string(models.BuyerPaymentStatusVerified) {
		_, _ = h.orderService.CompleteIfReceivedAndPaid(result.OrderID)
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Payment confirmed by buyer",
		Data:    result,
	})
}

// POST /api/v1/payments/:payment_id/seller-confirm
func (h *Handler) SellerConfirmPayment(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}
	paymentID, ok := h.parseUUIDParam(c, "payment_id")
	if !ok {
		return
	}

	result, err := h.paymentService.SellerConfirm(userID, paymentID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"
		switch err.Error() {
		case "PAYMENT_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "PAYMENT_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "SHOP_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "SHOP_NOT_FOUND"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}
	if result.Status == string(models.BuyerPaymentStatusVerified) {
		_, _ = h.orderService.CompleteIfReceivedAndPaid(result.OrderID)
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Payment confirmed by seller",
		Data:    result,
	})
}

// GET /api/v1/orders/:order_id/payment (seller/authorized employee)
func (h *Handler) GetSellerOrderPayment(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}
	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}
	result, err := h.paymentService.GetPaymentByOrderForSeller(userID, orderID)
	if err != nil {
		status, code := http.StatusInternalServerError, "INTERNAL_ERROR"
		switch err.Error() {
		case "PAYMENT_NOT_FOUND":
			status, code = http.StatusNotFound, "PAYMENT_NOT_FOUND"
		case "FORBIDDEN":
			status, code = http.StatusForbidden, "FORBIDDEN"
		case "SHOP_NOT_FOUND":
			status, code = http.StatusNotFound, "SHOP_NOT_FOUND"
		}
		h.errResponse(c, status, code, err.Error())
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Payment retrieved successfully", Data: result})
}

// POST /api/v1/buyer/orders/:order_id/cancel
func (h *Handler) CancelBuyerOrder(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}
	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}

	order, err := h.orderService.CancelBuyerOrder(buyerProfileID, orderID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"
		switch err.Error() {
		case "ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "ORDER_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "INVALID_STATUS_TRANSITION":
			statusCode = http.StatusBadRequest
			errorCode = "INVALID_STATUS_TRANSITION"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Order cancelled successfully",
		Data:    toOrderResponse(order),
	})
}
