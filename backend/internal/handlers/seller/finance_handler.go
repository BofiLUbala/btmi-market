package seller

import (
	"net/http"
	"strconv"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SellerFinanceHandler struct {
	commService *service.CommissionService
}

func NewSellerFinanceHandler(commService *service.CommissionService) *SellerFinanceHandler {
	return &SellerFinanceHandler{commService: commService}
}

// sellerReportFilter reads the narrowing axes a seller may apply to their own
// finances. business_id / seller_id are deliberately NOT read from the query
// string: the service pins those to the caller's own businesses, so a seller
// cannot widen the scope by crafting a URL.
func sellerReportFilter(c *gin.Context) *models.FinanceReportFilter {
	return &models.FinanceReportFilter{
		ShopID:           c.Query("shop_id"),
		ProductID:        c.Query("product_id"),
		VariantID:        c.Query("variant_id"),
		PaymentStatus:    c.Query("payment_status"),
		CommissionStatus: c.Query("commission_status"),
		DateFrom:         c.Query("date_from"),
		DateTo:           c.Query("date_to"),
	}
}

// GET /api/v1/seller/finances/summary
func (h *SellerFinanceHandler) GetSummary(c *gin.Context) {
	userIDVal, _ := c.Get("user_id")
	userID, _ := userIDVal.(uuid.UUID)

	summary, err := h.commService.GetSellerSummary(userID)
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
		Message: "Seller finance summary retrieved",
		Data:    summary,
	})
}

// GET /api/v1/seller/finances/dashboard
func (h *SellerFinanceHandler) GetDashboard(c *gin.Context) {
	userIDVal, _ := c.Get("user_id")
	userID, _ := userIDVal.(uuid.UUID)

	report, err := h.commService.GetSellerDashboardReport(userID, sellerReportFilter(c))
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
		Message: "Seller finance dashboard retrieved",
		Data:    report,
	})
}

// GET /api/v1/seller/finances/breakdown?group=shop|product|seller|business
func (h *SellerFinanceHandler) GetBreakdown(c *gin.Context) {
	userIDVal, _ := c.Get("user_id")
	userID, _ := userIDVal.(uuid.UUID)

	group := models.FinanceBreakdownGroup(c.DefaultQuery("group", "shop"))

	items, err := h.commService.GetSellerBreakdownReport(userID, group, sellerReportFilter(c))
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
		Message: "Seller finance breakdown retrieved",
		Data: gin.H{
			"group": group,
			"items": items,
		},
	})
}

// GET /api/v1/seller/finances/timeseries?interval=day|week|month
func (h *SellerFinanceHandler) GetTimeseries(c *gin.Context) {
	userIDVal, _ := c.Get("user_id")
	userID, _ := userIDVal.(uuid.UUID)

	interval := models.FinanceTimeseriesInterval(c.DefaultQuery("interval", "day"))

	points, err := h.commService.GetSellerTimeseriesReport(userID, interval, sellerReportFilter(c))
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
		Message: "Seller finance timeseries retrieved",
		Data:    gin.H{"interval": interval, "points": points},
	})
}

// GET /api/v1/seller/finances/sales
func (h *SellerFinanceHandler) ListSales(c *gin.Context) {
	userIDVal, _ := c.Get("user_id")
	userID, _ := userIDVal.(uuid.UUID)

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	filter := &models.CommissionFilter{
		Status:        c.Query("status"),
		PaymentStatus: c.Query("payment_status"),
		ShopID:        c.Query("shop_id"),
		ProductID:     c.Query("product_id"),
		VariantID:     c.Query("variant_id"),
		DateFrom:      c.Query("date_from"),
		DateTo:        c.Query("date_to"),
		Search:        c.Query("search"),
		Limit:         limit,
		Offset:        offset,
	}

	items, total, err := h.commService.ListSellerSales(userID, filter)
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
		Message: "Seller sales retrieved",
		Data: gin.H{
			"sales": items,
			"total": total,
		},
	})
}

// GET /api/v1/seller/finances/sales/:order_id
func (h *SellerFinanceHandler) GetSaleDetail(c *gin.Context) {
	userIDVal, _ := c.Get("user_id")
	userID, _ := userIDVal.(uuid.UUID)

	orderID, err := uuid.Parse(c.Param("order_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{Code: "INVALID_ID", Message: "Invalid order UUID"},
		})
		return
	}

	detail, err := h.commService.GetSellerSaleDetail(userID, orderID)
	if err != nil {
		status := http.StatusInternalServerError
		code := "INTERNAL_ERROR"
		if err.Error() == "FORBIDDEN" {
			status = http.StatusForbidden
			code = "FORBIDDEN"
		} else if err.Error() == "COMMISSION_NOT_FOUND" {
			status = http.StatusNotFound
			code = "COMMISSION_NOT_FOUND"
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
		Message: "Sale financial detail retrieved",
		Data:    detail,
	})
}
