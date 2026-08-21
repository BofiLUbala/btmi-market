package customers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	customerService *service.CustomerService
}

func NewHandler(customerService *service.CustomerService) *Handler {
	return &Handler{customerService: customerService}
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

func (h *Handler) CreateCustomer(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	businessID, ok := h.parseUUIDParam(c, "business_id")
	if !ok {
		return
	}

	var req models.CreateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	result, err := h.customerService.CreateCustomer(userID, businessID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"
		switch err.Error() {
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "CUSTOMER_EXISTS":
			statusCode = http.StatusConflict
			errorCode = "CUSTOMER_EXISTS"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Customer created successfully",
		Data:    result,
	})
}

func (h *Handler) GetCustomer(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	customerID, ok := h.parseUUIDParam(c, "customer_id")
	if !ok {
		return
	}

	result, err := h.customerService.GetCustomer(userID, customerID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"
		switch err.Error() {
		case "CUSTOMER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "CUSTOMER_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Customer retrieved successfully",
		Data:    result,
	})
}

func (h *Handler) UpdateCustomer(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	customerID, ok := h.parseUUIDParam(c, "customer_id")
	if !ok {
		return
	}

	var req models.UpdateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	result, err := h.customerService.UpdateCustomer(userID, customerID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"
		switch err.Error() {
		case "CUSTOMER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "CUSTOMER_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "CUSTOMER_EXISTS":
			statusCode = http.StatusConflict
			errorCode = "CUSTOMER_EXISTS"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Customer updated successfully",
		Data:    result,
	})
}

func (h *Handler) ListBusinessCustomers(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	businessID, ok := h.parseUUIDParam(c, "business_id")
	if !ok {
		return
	}

	search := c.Query("search")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	result, err := h.customerService.ListBusinessCustomers(userID, businessID, search, page, limit)
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
		Message: "Customers retrieved successfully",
		Data:    result,
	})
}

func (h *Handler) GetCustomerOrders(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	customerID, ok := h.parseUUIDParam(c, "customer_id")
	if !ok {
		return
	}

	var shopID *uuid.UUID
	if shopStr := c.Query("shop_id"); shopStr != "" {
		id, err := uuid.Parse(shopStr)
		if err != nil {
			h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid shop_id")
			return
		}
		shopID = &id
	}

	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	var from, to *time.Time
	if fromStr := c.Query("from"); fromStr != "" {
		t, err := time.Parse("2006-01-02", fromStr)
		if err != nil {
			h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid from date")
			return
		}
		from = &t
	}
	if toStr := c.Query("to"); toStr != "" {
		t, err := time.Parse("2006-01-02", toStr)
		if err != nil {
			h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid to date")
			return
		}
		t = t.Add(24*time.Hour - time.Second)
		to = &t
	}

	result, err := h.customerService.GetCustomerOrders(userID, customerID, shopID, status, from, to, page, limit)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"
		switch err.Error() {
		case "CUSTOMER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "CUSTOMER_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Customer orders retrieved successfully",
		Data:    result,
	})
}
