package admin

import (
	"net/http"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AdminCommissionHandler struct {
	commService *service.CommissionService
}

func NewAdminCommissionHandler(commService *service.CommissionService) *AdminCommissionHandler {
	return &AdminCommissionHandler{commService: commService}
}

// GET /api/v1/admin/finance/commission-config
func (h *AdminCommissionHandler) GetCommissionConfig(c *gin.Context) {
	config, err := h.commService.GetConfig()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{Code: "INTERNAL_ERROR", Message: err.Error()},
		})
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Commission configuration retrieved",
		Data:    config,
	})
}

// PATCH /api/v1/admin/finance/commission-config
func (h *AdminCommissionHandler) UpdateCommissionConfig(c *gin.Context) {
	adminIDVal, _ := c.Get("admin_id")
	adminRoleVal, _ := c.Get("admin_role")
	adminID, _ := adminIDVal.(uuid.UUID)
	adminRole, _ := adminRoleVal.(models.AdminRole)

	var req models.UpdateCommissionRateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{Code: "INVALID_REQUEST", Message: err.Error()},
		})
		return
	}

	config, err := h.commService.UpdateConfig(adminID, adminRole, req.Rate, req.Reason)
	if err != nil {
		status := http.StatusInternalServerError
		code := "INTERNAL_ERROR"
		if err.Error() == "FORBIDDEN" || err.Error() == "INVALID_RATE" {
			status = http.StatusBadRequest
			code = err.Error()
		}
		c.JSON(status, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{Code: code, Message: err.Error()},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Platform commission rate updated successfully",
		Data:    config,
	})
}

// GET /api/v1/admin/finance/commissions/summary
func (h *AdminCommissionHandler) GetCommissionSummary(c *gin.Context) {
	filter := &models.CommissionFilter{
		BusinessID: c.Query("business_id"),
		ShopID:     c.Query("shop_id"),
		DateFrom:   c.Query("date_from"),
		DateTo:     c.Query("date_to"),
	}

	summary, err := h.commService.GetSummary(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{Code: "INTERNAL_ERROR", Message: err.Error()},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Commission summary retrieved",
		Data:    summary,
	})
}

// GET /api/v1/admin/finance/commissions
func (h *AdminCommissionHandler) ListCommissions(c *gin.Context) {
	filter := &models.CommissionFilter{
		Status:     c.Query("status"),
		BusinessID: c.Query("business_id"),
		ShopID:     c.Query("shop_id"),
		SellerID:   c.Query("seller_id"),
		DateFrom:   c.Query("date_from"),
		DateTo:     c.Query("date_to"),
		Search:     c.Query("search"),
	}

	items, total, err := h.commService.ListCommissions(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{Code: "INTERNAL_ERROR", Message: err.Error()},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Commission records retrieved",
		Data: gin.H{
			"commissions": items,
			"total":       total,
		},
	})
}

// GET /api/v1/admin/finance/commissions/order/:order_id
func (h *AdminCommissionHandler) GetSaleDetail(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("order_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}{Code: "INVALID_ID", Message: "Invalid order UUID"}})
		return
	}
	detail, err := h.commService.GetSaleFinanceDetail(orderID)
	if err != nil {
		status := http.StatusInternalServerError
		code := "INTERNAL_ERROR"
		if err.Error() == "COMMISSION_NOT_FOUND" {
			status, code = http.StatusNotFound, "COMMISSION_NOT_FOUND"
		}
		c.JSON(status, models.ErrorResponse{Error: struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}{Code: code, Message: err.Error()}})
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Sale financial detail retrieved", Data: detail})
}

// GET /api/v1/admin/finance/dashboard
func (h *AdminCommissionHandler) GetFinanceDashboard(c *gin.Context) {
	filter := &models.FinanceReportFilter{
		BusinessID: c.Query("business_id"),
		ShopID:     c.Query("shop_id"),
		SellerID:   c.Query("seller_id"),
		DateFrom:   c.Query("date_from"),
		DateTo:     c.Query("date_to"),
	}

	report, err := h.commService.GetDashboardReport(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{Code: "INTERNAL_ERROR", Message: err.Error()},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Finance dashboard retrieved",
		Data:    report,
	})
}

// GET /api/v1/admin/finance/breakdown?group=shop|product|seller|business
func (h *AdminCommissionHandler) GetFinanceBreakdown(c *gin.Context) {
	group := models.FinanceBreakdownGroup(c.DefaultQuery("group", "shop"))
	if group != models.FinanceBreakdownShop &&
		group != models.FinanceBreakdownProduct &&
		group != models.FinanceBreakdownSeller &&
		group != models.FinanceBreakdownBusiness {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{Code: "INVALID_GROUP", Message: "group must be shop, product, seller or business"},
		})
		return
	}

	filter := &models.FinanceReportFilter{
		BusinessID: c.Query("business_id"),
		ShopID:     c.Query("shop_id"),
		SellerID:   c.Query("seller_id"),
		DateFrom:   c.Query("date_from"),
		DateTo:     c.Query("date_to"),
	}

	items, err := h.commService.GetBreakdownReport(group, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{Code: "INTERNAL_ERROR", Message: err.Error()},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Finance breakdown retrieved",
		Data: gin.H{
			"group": group,
			"items": items,
		},
	})
}

// POST /api/v1/admin/finance/commissions/:id/collect
func (h *AdminCommissionHandler) MarkCommissionCollected(c *gin.Context) {
	adminIDVal, _ := c.Get("admin_id")
	adminRoleVal, _ := c.Get("admin_role")
	adminID, _ := adminIDVal.(uuid.UUID)
	adminRole, _ := adminRoleVal.(models.AdminRole)

	commID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{Code: "INVALID_ID", Message: "Invalid commission UUID"},
		})
		return
	}

	var req models.MarkCommissionCollectedRequest
	_ = c.ShouldBindJSON(&req)

	if err := h.commService.MarkCollected(adminID, adminRole, commID, req.Notes); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{Code: "COLLECTION_FAILED", Message: err.Error()},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Commission marked as collected successfully",
		Data:    gin.H{"id": commID, "status": "COLLECTED"},
	})
}
