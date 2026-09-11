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

// GET /api/v1/seller/finances/sales
func (h *SellerFinanceHandler) ListSales(c *gin.Context) {
	userIDVal, _ := c.Get("user_id")
	userID, _ := userIDVal.(uuid.UUID)

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	filter := &models.CommissionFilter{
		Status:   c.Query("status"),
		DateFrom: c.Query("date_from"),
		DateTo:   c.Query("date_to"),
		Search:   c.Query("search"),
		Limit:    limit,
		Offset:   offset,
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
