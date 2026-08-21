package cash

import (
	"net/http"
	"strconv"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	cashService *service.CashService
}

func NewHandler(cashService *service.CashService) *Handler {
	return &Handler{cashService: cashService}
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

func (h *Handler) parsePagination(c *gin.Context) (int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}
	return page, limit
}

func (h *Handler) OpenCashSession(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	shopID, ok := h.parseUUIDParam(c, "shop_id")
	if !ok {
		return
	}

	var req models.OpenCashSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	session, err := h.cashService.OpenCashSession(userID, shopID, &req)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Cash session opened successfully",
		Data:    session,
	})
}

func (h *Handler) GetOpenSession(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	shopID, ok := h.parseUUIDParam(c, "shop_id")
	if !ok {
		return
	}

	session, err := h.cashService.GetOpenSession(userID, shopID)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Cash session retrieved successfully",
		Data:    session,
	})
}

func (h *Handler) GetSession(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	sessionID, ok := h.parseUUIDParam(c, "session_id")
	if !ok {
		return
	}

	session, err := h.cashService.GetSessionByID(userID, sessionID)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Cash session retrieved successfully",
		Data:    session,
	})
}

func (h *Handler) CloseSession(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	sessionID, ok := h.parseUUIDParam(c, "session_id")
	if !ok {
		return
	}

	var req models.CloseCashSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	session, err := h.cashService.CloseCashSession(userID, sessionID, &req)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Cash session closed successfully",
		Data:    session,
	})
}

func (h *Handler) ReconcileSession(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	sessionID, ok := h.parseUUIDParam(c, "session_id")
	if !ok {
		return
	}

	session, err := h.cashService.ReconcileSession(userID, sessionID)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Cash session reconciled successfully",
		Data:    session,
	})
}

func (h *Handler) ListShopSessions(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	shopID, ok := h.parseUUIDParam(c, "shop_id")
	if !ok {
		return
	}

	page, limit := h.parsePagination(c)
	sessions, total, err := h.cashService.ListShopSessions(userID, shopID, page, limit)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Cash sessions retrieved successfully",
		Data: models.CashSessionListResponse{
			Sessions: h.toSessionResponses(sessions),
			Pagination: models.PaginationInfo{
				Page:  page,
				Limit: limit,
				Total: total,
			},
		},
	})
}

func (h *Handler) ListEmployeeSessions(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	employeeID, ok := h.parseUUIDParam(c, "employee_id")
	if !ok {
		return
	}

	page, limit := h.parsePagination(c)
	sessions, total, err := h.cashService.ListEmployeeSessions(userID, employeeID, page, limit)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Cash sessions retrieved successfully",
		Data: models.CashSessionListResponse{
			Sessions: h.toSessionResponses(sessions),
			Pagination: models.PaginationInfo{
				Page:  page,
				Limit: limit,
				Total: total,
			},
		},
	})
}

func (h *Handler) ListBusinessSessions(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	businessID, ok := h.parseUUIDParam(c, "business_id")
	if !ok {
		return
	}

	page, limit := h.parsePagination(c)
	sessions, total, err := h.cashService.ListBusinessSessions(userID, businessID, page, limit)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Cash sessions retrieved successfully",
		Data: models.CashSessionListResponse{
			Sessions: h.toSessionResponses(sessions),
			Pagination: models.PaginationInfo{
				Page:  page,
				Limit: limit,
				Total: total,
			},
		},
	})
}

func (h *Handler) GetBusinessCashSummary(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	businessID, ok := h.parseUUIDParam(c, "business_id")
	if !ok {
		return
	}

	summary, err := h.cashService.GetBusinessCashSummary(userID, businessID)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Business cash summary retrieved successfully",
		Data:    summary,
	})
}

func (h *Handler) GetShopCashSummary(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	shopID, ok := h.parseUUIDParam(c, "shop_id")
	if !ok {
		return
	}

	summary, err := h.cashService.GetShopCashSummary(userID, shopID)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Shop cash summary retrieved successfully",
		Data:    summary,
	})
}

func (h *Handler) ListShopPayments(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	shopID, ok := h.parseUUIDParam(c, "shop_id")
	if !ok {
		return
	}

	page, limit := h.parsePagination(c)
	payments, total, err := h.cashService.ListShopPayments(userID, shopID, page, limit)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	var paymentResponses []models.CashPaymentResponse
	for _, p := range payments {
		paymentResponses = append(paymentResponses, models.CashPaymentResponse{
			ID:            p.ID,
			BusinessID:    p.BusinessID,
			ShopID:        p.ShopID,
			EmployeeID:    p.EmployeeID,
			CustomerID:    p.CustomerID,
			CashSessionID: p.CashSessionID,
			ReferenceType: string(p.ReferenceType),
			ReferenceID:   p.ReferenceID,
			Amount:        p.Amount,
			Currency:      p.Currency,
			Status:        string(p.Status),
			CreatedAt:     p.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Cash payments retrieved successfully",
		Data: models.CashPaymentListResponse{
			Payments: paymentResponses,
			Pagination: models.PaginationInfo{
				Page:  page,
				Limit: limit,
				Total: total,
			},
		},
	})
}

func (h *Handler) GetPayment(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	paymentID, ok := h.parseUUIDParam(c, "payment_id")
	if !ok {
		return
	}

	payment, err := h.cashService.GetPaymentByID(userID, paymentID)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Cash payment retrieved successfully",
		Data: models.CashPaymentResponse{
			ID:            payment.ID,
			BusinessID:    payment.BusinessID,
			ShopID:        payment.ShopID,
			EmployeeID:    payment.EmployeeID,
			CustomerID:    payment.CustomerID,
			CashSessionID: payment.CashSessionID,
			ReferenceType: string(payment.ReferenceType),
			ReferenceID:   payment.ReferenceID,
			Amount:        payment.Amount,
			Currency:      payment.Currency,
			Status:        string(payment.Status),
			CreatedAt:     payment.CreatedAt,
		},
	})
}

func (h *Handler) GetSessionPayments(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	sessionID, ok := h.parseUUIDParam(c, "session_id")
	if !ok {
		return
	}

	payments, err := h.cashService.GetSessionPayments(userID, sessionID)
	if err != nil {
		h.handleServiceError(c, err)
		return
	}

	var paymentResponses []models.CashPaymentResponse
	for _, p := range payments {
		paymentResponses = append(paymentResponses, models.CashPaymentResponse{
			ID:            p.ID,
			BusinessID:    p.BusinessID,
			ShopID:        p.ShopID,
			EmployeeID:    p.EmployeeID,
			CustomerID:    p.CustomerID,
			CashSessionID: p.CashSessionID,
			ReferenceType: string(p.ReferenceType),
			ReferenceID:   p.ReferenceID,
			Amount:        p.Amount,
			Currency:      p.Currency,
			Status:        string(p.Status),
			CreatedAt:     p.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Session payments retrieved successfully",
		Data:    paymentResponses,
	})
}

func (h *Handler) handleServiceError(c *gin.Context, err error) {
	switch err.Error() {
	case "FORBIDDEN":
		h.errResponse(c, http.StatusForbidden, "FORBIDDEN", "You don't have access to this resource")
	case "SHOP_NOT_FOUND":
		h.errResponse(c, http.StatusNotFound, "SHOP_NOT_FOUND", "Shop not found")
	case "CASH_SESSION_NOT_FOUND", "cash_session_not_found":
		h.errResponse(c, http.StatusNotFound, "CASH_SESSION_NOT_FOUND", "Cash session not found")
	case "CASH_SESSION_ALREADY_OPEN":
		h.errResponse(c, http.StatusConflict, "CASH_SESSION_ALREADY_OPEN", "You already have an open cash session in this shop")
	case "CASH_SESSION_NOT_OPEN":
		h.errResponse(c, http.StatusConflict, "CASH_SESSION_NOT_OPEN", "Cash session is not open")
	case "CASH_SESSION_NOT_CLOSED":
		h.errResponse(c, http.StatusConflict, "CASH_SESSION_NOT_CLOSED", "Cash session is not closed")
	case "EMPLOYEE_NOT_FOUND":
		h.errResponse(c, http.StatusNotFound, "EMPLOYEE_NOT_FOUND", "Employee profile not found")
	case "EMPLOYEE_NOT_ASSIGNED_TO_SHOP":
		h.errResponse(c, http.StatusForbidden, "EMPLOYEE_NOT_ASSIGNED_TO_SHOP", "You are not assigned to this shop")
	case "NO_OPEN_CASH_SESSION":
		h.errResponse(c, http.StatusNotFound, "NO_OPEN_CASH_SESSION", "No open cash session found")
	case "NO_DECLARED_AMOUNT":
		h.errResponse(c, http.StatusBadRequest, "NO_DECLARED_AMOUNT", "No declared closing amount")
	case "cash_payment_not_found":
		h.errResponse(c, http.StatusNotFound, "CASH_PAYMENT_NOT_FOUND", "Cash payment not found")
	default:
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred")
	}
}

func (h *Handler) toSessionResponses(sessions []models.CashSession) []models.CashSessionResponse {
	responses := make([]models.CashSessionResponse, len(sessions))
	for i, s := range sessions {
		responses[i] = models.CashSessionResponse{
			ID:                    s.ID,
			BusinessID:            s.BusinessID,
			ShopID:                s.ShopID,
			EmployeeID:            s.EmployeeID,
			OpenedAt:              s.OpenedAt,
			ClosedAt:              s.ClosedAt,
			OpeningAmount:         s.OpeningAmount,
			Currency:              s.Currency,
			CashSalesTotal:        s.CashSalesTotal,
			ExpectedAmount:        s.ExpectedAmount,
			DeclaredClosingAmount: s.DeclaredClosingAmount,
			Difference:            s.Difference,
			ReconciliationResult:  s.ReconciliationResult,
			Status:                string(s.Status),
			CreatedAt:             s.CreatedAt,
		}
	}
	return responses
}
