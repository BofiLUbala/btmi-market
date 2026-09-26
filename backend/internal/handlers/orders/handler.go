package orders

import (
	"io"
	"log"
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
	checkoutService     *service.CheckoutService
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

// sellerActionError turns a seller order-action failure into an HTTP status, a
// stable error code and a message the seller can act on, and logs the full
// context needed to chase the failure down: which order, which seller, which
// shop, what state it was actually in, and what the backend said.
//
// The seller sees why the button did not work; the log keeps the identifiers,
// which have no place in a message shown on a phone.
func (h *Handler) sellerActionError(c *gin.Context, userID, orderID uuid.UUID, action string, err error) {
	statusCode := http.StatusInternalServerError
	errorCode := "INTERNAL_ERROR"
	message := "The order could not be updated. Please try again."

	switch err.Error() {
	case "ORDER_NOT_FOUND":
		statusCode = http.StatusNotFound
		errorCode = "ORDER_NOT_FOUND"
		message = "This order no longer exists."
	case "SHOP_NOT_FOUND":
		statusCode = http.StatusNotFound
		errorCode = "SHOP_NOT_FOUND"
		message = "The shop for this order no longer exists."
	case "FORBIDDEN":
		statusCode = http.StatusForbidden
		errorCode = "FORBIDDEN"
		message = "You are not allowed to manage orders for this shop."
	case "INVALID_STATUS_TRANSITION":
		statusCode = http.StatusBadRequest
		errorCode = "INVALID_STATUS_TRANSITION"
		message = "This order is no longer pending - it has already been handled. Refresh to see its current status."
	case "DELIVERY_METHOD_REQUIRED", "PAYMENT_METHOD_REQUIRED", "PAYMENT_NOT_SETTLED", "COURIER_STEP_ONLY":
		// A step before this one is still open; the seller waits for it rather than skipping it.
		statusCode = http.StatusConflict
		errorCode = err.Error()
		message = map[string]string{
			"DELIVERY_METHOD_REQUIRED": "The buyer has not confirmed the delivery address yet.",
			"PAYMENT_METHOD_REQUIRED":  "The buyer has not chosen how to pay yet.",
			"PAYMENT_NOT_SETTLED":      "This order is paid in advance and the payment has not been received yet.",
			"COURIER_STEP_ONLY":        "Only the TBK courier can record this delivery step.",
		}[err.Error()]
	}

	// Current status is read separately: the action failed, so the service
	// returned no order to read it from.
	currentStatus := "UNKNOWN"
	shopID := "UNKNOWN"
	if order, getErr := h.orderService.GetOrderRaw(orderID); getErr == nil {
		currentStatus = string(order.Status)
		shopID = order.ShopID.String()
	}

	log.Printf(
		"seller order action failed: order_id=%s seller_id=%s shop_id=%s current_status=%s action=%s endpoint=%s %s http_status=%d error=%s",
		orderID, userID, shopID, currentStatus, action, c.Request.Method, c.Request.URL.Path, statusCode, err.Error(),
	)

	h.errResponse(c, statusCode, errorCode, message)
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
		h.sellerActionError(c, userID, orderID, "ACCEPT", err)
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
		case "DELIVERY_METHOD_REQUIRED", "PAYMENT_METHOD_REQUIRED", "PAYMENT_NOT_SETTLED", "COURIER_STEP_ONLY", "ACTOR_NOT_ALLOWED":
			statusCode = http.StatusConflict
			errorCode = err.Error()
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
		h.sellerActionError(c, userID, orderID, "REJECT", err)
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
		case "PAYMENT_ALREADY_SETTLED", "PAYMENT_IN_PROGRESS", "PAYMENT_STATE_CHANGED":
			// A paid or in-flight order goes through a refund, not a cancel.
			statusCode = http.StatusConflict
			errorCode = err.Error()
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
		Currency:               models.CurrencySnapshot(order.Currency),
		DeliveryMethod:         order.DeliveryMethod,
		DeliveryFeeBase:        order.DeliveryFeeBase,
		DeliveryPointsUsed:     order.DeliveryPointsUsed,
		DeliveryPointsDiscount: order.DeliveryPointsDiscount,
		DeliveryFeeFinal:       order.DeliveryFeeFinal,
		DeliveryContactName:    order.DeliveryContactName,
		DeliveryPhone:          order.DeliveryPhone,
		DeliveryAddress:        order.DeliveryAddress,
		DeliveryProvince:       order.DeliveryProvince,
		DeliveryCity:           order.DeliveryCity,
		DeliveryCommune:        order.DeliveryCommune,
		DeliveryStreet:         order.DeliveryStreet,
		DeliveryBuildingNumber: order.DeliveryBuildingNumber,
		DeliveryLandmark:       order.DeliveryLandmark,
		DeliveryProvinceID:     order.DeliveryProvinceID,
		DeliveryCityID:         order.DeliveryCityID,
		DeliveryCommuneID:      order.DeliveryCommuneID,
		DeliveryNotes:          order.DeliveryNotes,
		DeliveryStatus:         order.DeliveryStatus,
		AssignedCourierID:      order.AssignedCourierID,
		DeliveryLatitude:       order.DeliveryLatitude,
		DeliveryLongitude:      order.DeliveryLongitude,
		CourierAssignedAt:      order.CourierAssignedAt,
		CourierMilestones:      order.CourierMilestones,
		CourierNotes:           order.CourierNotes,
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
		// French-safe message shown directly to the buyer. The technical code
		// stays stable in error.code so clients can branch on it; the message
		// is what a human on a phone should read.
		message := "La livraison n'a pas pu être enregistrée. Veuillez réessayer."
		switch err.Error() {
		case "ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "ORDER_NOT_FOUND"
			message = "Cette commande n'existe plus."
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
			message = "Vous n'êtes pas autorisé à modifier cette commande."
		case "INVALID_STATUS_TRANSITION", "INVALID_DELIVERY_METHOD", "DELIVERY_NOT_AVAILABLE":
			statusCode = http.StatusBadRequest
			errorCode = err.Error()
			message = "La livraison n'est plus disponible pour cette commande. Rechargez la page."
		case "DELIVERY_ADDRESS_REQUIRED":
			statusCode = http.StatusBadRequest
			errorCode = err.Error()
			message = "Veuillez renseigner l'adresse complète (rue et numéro)."
		case "DELIVERY_CONTACT_NAME_REQUIRED":
			statusCode = http.StatusBadRequest
			errorCode = err.Error()
			message = "Veuillez indiquer le nom du contact qui recevra la livraison."
		case "DELIVERY_PHONE_REQUIRED":
			statusCode = http.StatusBadRequest
			errorCode = err.Error()
			message = "Veuillez indiquer le numéro de téléphone du contact."
		case "INVALID_BUILDING_NUMBER":
			statusCode = http.StatusBadRequest
			errorCode = err.Error()
			message = "Le numéro de la parcelle n'est pas valide. Saisissez par exemple « 12 » ou « 12A »."
		case "INVALID_DELIVERY_LOCATION":
			statusCode = http.StatusBadRequest
			errorCode = err.Error()
			message = "Adresse de livraison non reconnue : la commune ne correspond pas à la ville choisie. Sélectionnez la commune dans la liste."
		case "PAYMENT_ALREADY_CREATED":
			statusCode = http.StatusConflict
			errorCode = "PAYMENT_ALREADY_CREATED"
			message = "Le paiement de cette commande a déjà été initié."
		case "SHOP_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "SHOP_NOT_FOUND"
			message = "La boutique de cette commande n'existe plus."
		case "INSUFFICIENT_POINTS":
			statusCode = http.StatusBadRequest
			errorCode = "INSUFFICIENT_POINTS"
			message = "Points insuffisants pour payer la livraison."
		}
		h.errResponse(c, statusCode, errorCode, message)
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

	var req models.CreatePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_PAYMENT_METHOD", err.Error())
		return
	}
	result, err := h.paymentService.CreatePayment(buyerProfileID, orderID, &req)
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
		case "INVALID_STATUS_TRANSITION", "DELIVERY_NOT_SELECTED", "DELIVERY_DETAILS_INCOMPLETE",
			"PAYMENT_METHOD_UNAVAILABLE", "PAYMENT_PROVIDER_NOT_CONFIGURED", "PAYMENT_ALREADY_SELECTED",
			// The buyer picked a mobile method without naming an operator, named
			// one for cash, or named one we do not settle through. Each is a
			// correctable choice, so each gets its own code rather than a 500.
			"PAYMENT_PROVIDER_REQUIRED", "PROVIDER_NOT_APPLICABLE", "PAYMENT_PROVIDER_UNKNOWN",
			"PAYMENT_PROVIDER_UNAVAILABLE", "MARKUP_CURRENCY_MISMATCH":
			statusCode = http.StatusBadRequest
			errorCode = err.Error()
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Payment created successfully",
		Data:    result,
	})
}

// GET /api/v1/buyer/orders/:order_id/checkout-quote
func (h *Handler) GetCheckoutQuote(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}
	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}
	result, err := h.paymentService.Quote(buyerProfileID, orderID, c.Query("payment_method"))
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "ORDER_NOT_FOUND" {
			status = http.StatusNotFound
		}
		if err.Error() == "FORBIDDEN" {
			status = http.StatusForbidden
		}
		if err.Error() == "DELIVERY_NOT_SELECTED" || err.Error() == "PAYMENT_METHOD_UNAVAILABLE" {
			status = http.StatusBadRequest
		}
		h.errResponse(c, status, err.Error(), err.Error())
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Checkout quote calculated successfully", Data: result})
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
		case "PROVIDER_CONFIRMATION_REQUIRED":
			statusCode = http.StatusConflict
			errorCode = "PROVIDER_CONFIRMATION_REQUIRED"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Payment retrieved successfully",
		Data:    result,
	})
}

// Cash at delivery is confirmed by the assigned courier at the physical handover
// (POST /courier/missions/:id/confirm-cash), and an online payment by its provider's
// signed webhook. The buyer-confirm and seller-confirm endpoints that used to stand
// here let a payment be declared settled by someone who was not at the door, so they
// are gone rather than merely hidden.

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
		case "PAYMENT_ALREADY_SETTLED", "PAYMENT_IN_PROGRESS", "PAYMENT_STATE_CHANGED", "ORDER_ALREADY_HANDED_OVER":
			// A paid or in-flight order goes through a refund, not a cancel; a
			// handed-over one is confirmed or disputed instead.
			statusCode = http.StatusConflict
			errorCode = err.Error()
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Order cancelled successfully",
		Data:    toOrderResponse(order),
	})
}

// InitiateBuyerPayment asks the configured provider to charge the buyer for an
// online payment. It can only ever start a charge - the provider webhook is
// what settles it.
func (h *Handler) InitiateBuyerPayment(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}
	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}

	// The phone may be named here rather than at checkout, which is what a
	// pay-at-delivery payment does. An empty body is legal: the number chosen at
	// checkout then stands.
	var req models.InitiatePaymentRequest
	_ = c.ShouldBindJSON(&req)

	result, err := h.paymentService.InitiatePayment(buyerProfileID, orderID, &req)
	if err != nil {
		status := http.StatusBadRequest
		switch err.Error() {
		case "ORDER_NOT_FOUND", "PAYMENT_NOT_FOUND":
			status = http.StatusNotFound
		case "FORBIDDEN":
			status = http.StatusForbidden
		case "PAYMENT_PROVIDER_NOT_CONFIGURED":
			status = http.StatusServiceUnavailable
		case "PAYER_PHONE_REQUIRED", "INVALID_PAYMENT_AMOUNT":
			status = http.StatusBadRequest
		case "AWAITING_DELIVERY_STAGE", "AWAITING_PRODUCT_VERIFICATION", "ALREADY_PAID", "CASH_ON_DELIVERY", "PAYMENT_CLOSED", "PAYMENT_STATE_CHANGED":
			status = http.StatusConflict
		}
		h.errResponse(c, status, err.Error(), err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Payment initiated", Data: result})
}

// HandlePaymentWebhook is the provider callback. It is unauthenticated by
// design - the HMAC signature over the raw body is the credential - and is
// mounted outside every auth middleware.
func (h *Handler) HandlePaymentWebhook(c *gin.Context) {
	rawBody, err := io.ReadAll(io.LimitReader(c.Request.Body, 1<<20))
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_WEBHOOK_PAYLOAD", "Could not read request body")
		return
	}

	provider := c.Param("provider")
	signature := c.GetHeader("X-TBK-Signature")
	if err := h.paymentService.HandleProviderWebhook(provider, rawBody, signature); err != nil {
		status := http.StatusBadRequest
		switch err.Error() {
		case "INVALID_WEBHOOK_SIGNATURE":
			status = http.StatusUnauthorized
		case "PAYMENT_WEBHOOK_NOT_CONFIGURED":
			status = http.StatusServiceUnavailable
		case "PAYMENT_NOT_FOUND":
			status = http.StatusNotFound
		}
		h.errResponse(c, status, err.Error(), err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"received": true})
}

// POST /api/v1/orders/:order_id/confirm-return - the seller has the returned parcel back
func (h *Handler) ConfirmReturnToSeller(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}
	orderID, ok := h.parseUUIDParam(c, "order_id")
	if !ok {
		return
	}
	if err := h.orderService.ConfirmReturnToSeller(&userID, orderID); err != nil {
		statusCode, errorCode := http.StatusBadRequest, err.Error()
		switch err.Error() {
		case "ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
		case "FORBIDDEN", "ACCESS_DENIED":
			statusCode = http.StatusForbidden
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"order_id": orderID, "delivery_status": "RETURNED_TO_SELLER"}})
}

// POST /api/v1/admin/commerce/orders/:id/confirm-return - commerce admin closes a return on the seller's behalf
func (h *Handler) AdminConfirmReturnToSeller(c *gin.Context) {
	orderID, ok := h.parseUUIDParam(c, "id")
	if !ok {
		return
	}
	if err := h.orderService.ConfirmReturnToSeller(nil, orderID); err != nil {
		statusCode := http.StatusBadRequest
		if err.Error() == "ORDER_NOT_FOUND" {
			statusCode = http.StatusNotFound
		}
		h.errResponse(c, statusCode, err.Error(), err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"order_id": orderID, "delivery_status": "RETURNED_TO_SELLER"}})
}
