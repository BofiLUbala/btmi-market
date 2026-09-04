package admin

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
)

type AdminFinanceHandler struct {
	financeService *service.AdminFinanceService
}

func NewAdminFinanceHandler(financeService *service.AdminFinanceService) *AdminFinanceHandler {
	return &AdminFinanceHandler{financeService: financeService}
}

// GET /api/v1/admin/finance/summary
func (h *AdminFinanceHandler) GetFinancialSummary(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	businessID := c.Query("business_id")
	shopID := c.Query("shop_id")
	sellerID := c.Query("seller_id")
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")

	summary, err := h.financeService.GetFinancialSummary(adminRole, businessID, shopID, sellerID, dateFrom, dateTo)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, summary)
}

// GET /api/v1/admin/finance/payments
func (h *AdminFinanceHandler) ListPayments(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	var filter models.AdminPaymentFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.Limit <= 0 {
		filter.Limit = 20
	}

	items, total, err := h.financeService.ListPayments(adminRole, &filter)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"total": total,
		"page":  filter.Page,
		"limit": filter.Limit,
	})
}

// GET /api/v1/admin/finance/payments/:id
func (h *AdminFinanceHandler) GetPaymentDetail(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payment id"})
		return
	}

	detail, err := h.financeService.GetPaymentDetail(adminRole, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, detail)
}

// GET /api/v1/admin/finance/points/buyers
func (h *AdminFinanceHandler) ListBuyerPoints(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	search := c.Query("search")

	items, total, err := h.financeService.ListBuyerPoints(adminRole, page, limit, search)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GET /api/v1/admin/finance/points/buyers/:buyerId/history
func (h *AdminFinanceHandler) GetBuyerPointHistory(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	buyerID, err := uuid.Parse(c.Param("buyerId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid buyer id"})
		return
	}

	txs, err := h.financeService.GetBuyerPointHistory(adminRole, buyerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"history": txs})
}

// POST /api/v1/admin/finance/points/buyers/:buyerId/adjust
func (h *AdminFinanceHandler) AdjustBuyerPoints(c *gin.Context) {
	adminID := c.MustGet("admin_id").(uuid.UUID)
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	buyerID, err := uuid.Parse(c.Param("buyerId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid buyer id"})
		return
	}

	var req models.AdminPointAdjustmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	oldBalance, newBalance, err := h.financeService.AdjustBuyerPoints(adminID, adminRole, buyerID, &req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message":          "Points adjusted successfully",
		"old_balance":      oldBalance,
		"new_balance":      newBalance,
		"adjustment_type": req.Type,
		"amount":          req.Amount,
	})
}

// GET /api/v1/admin/finance/growth/sellers
func (h *AdminFinanceHandler) ListSellerGrowth(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	search := c.Query("search")

	items, total, err := h.financeService.ListSellerGrowth(adminRole, page, limit, search)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GET /api/v1/admin/finance/reviews/products
func (h *AdminFinanceHandler) ListProductReviews(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")

	items, total, err := h.financeService.ListProductReviews(adminRole, page, limit, status)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// POST /api/v1/admin/finance/reviews/products/:id/hide
func (h *AdminFinanceHandler) HideProductReview(c *gin.Context) {
	adminID := c.MustGet("admin_id").(uuid.UUID)
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid review id"})
		return
	}

	var req models.AdminReviewModerationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.financeService.HideProductReview(adminID, adminRole, id, req.Reason, c.ClientIP(), c.Request.UserAgent()); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Product review hidden successfully"})
}

// POST /api/v1/admin/finance/reviews/products/:id/restore
func (h *AdminFinanceHandler) RestoreProductReview(c *gin.Context) {
	adminID := c.MustGet("admin_id").(uuid.UUID)
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid review id"})
		return
	}

	var req models.AdminReviewModerationRequest
	_ = c.ShouldBindJSON(&req)

	if err := h.financeService.RestoreProductReview(adminID, adminRole, id, req.Reason, c.ClientIP(), c.Request.UserAgent()); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Product review restored successfully"})
}

// GET /api/v1/admin/finance/reviews/shops
func (h *AdminFinanceHandler) ListShopReviews(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")

	items, total, err := h.financeService.ListShopReviews(adminRole, page, limit, status)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// POST /api/v1/admin/finance/reviews/shops/:id/hide
func (h *AdminFinanceHandler) HideShopReview(c *gin.Context) {
	adminID := c.MustGet("admin_id").(uuid.UUID)
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid review id"})
		return
	}

	var req models.AdminReviewModerationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.financeService.HideShopReview(adminID, adminRole, id, req.Reason, c.ClientIP(), c.Request.UserAgent()); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Shop review hidden successfully"})
}

// POST /api/v1/admin/finance/reviews/shops/:id/restore
func (h *AdminFinanceHandler) RestoreShopReview(c *gin.Context) {
	adminID := c.MustGet("admin_id").(uuid.UUID)
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid review id"})
		return
	}

	var req models.AdminReviewModerationRequest
	_ = c.ShouldBindJSON(&req)

	if err := h.financeService.RestoreShopReview(adminID, adminRole, id, req.Reason, c.ClientIP(), c.Request.UserAgent()); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Shop review restored successfully"})
}

// GET /api/v1/admin/finance/cases
func (h *AdminFinanceHandler) ListCases(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	var filter models.AdminCaseFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.Limit <= 0 {
		filter.Limit = 20
	}

	items, total, err := h.financeService.ListCases(adminRole, &filter)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"total": total,
		"page":  filter.Page,
		"limit": filter.Limit,
	})
}

// POST /api/v1/admin/finance/cases
func (h *AdminFinanceHandler) CreateCase(c *gin.Context) {
	adminID := c.MustGet("admin_id").(uuid.UUID)
	adminRole := c.MustGet("admin_role").(models.AdminRole)

	var req models.AdminCreateCaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item, err := h.financeService.CreateCase(adminID, adminRole, &req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, item)
}

// GET /api/v1/admin/finance/cases/:id
func (h *AdminFinanceHandler) GetCaseDetail(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid case id"})
		return
	}

	detail, err := h.financeService.GetCaseDetail(adminRole, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, detail)
}

// POST /api/v1/admin/finance/cases/:id/assign
func (h *AdminFinanceHandler) AssignCase(c *gin.Context) {
	adminID := c.MustGet("admin_id").(uuid.UUID)
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	caseID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid case id"})
		return
	}

	var req models.AdminCaseAssignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.financeService.AssignCase(adminID, adminRole, caseID, req.AdminID, c.ClientIP(), c.Request.UserAgent()); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Case assigned successfully"})
}

// POST /api/v1/admin/finance/cases/:id/resolve
func (h *AdminFinanceHandler) ResolveCase(c *gin.Context) {
	adminID := c.MustGet("admin_id").(uuid.UUID)
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	caseID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid case id"})
		return
	}

	var req models.AdminCaseResolveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.financeService.ResolveCase(adminID, adminRole, caseID, &req, c.ClientIP(), c.Request.UserAgent()); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Case resolved successfully"})
}

// POST /api/v1/admin/finance/cases/:id/messages
func (h *AdminFinanceHandler) AddCaseMessage(c *gin.Context) {
	adminID := c.MustGet("admin_id").(uuid.UUID)
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	caseID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid case id"})
		return
	}

	var req models.AdminCaseMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	msg, err := h.financeService.AddCaseMessage(adminID, adminRole, caseID, &req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, msg)
}

// GET /api/v1/admin/finance/risk
func (h *AdminFinanceHandler) ListRiskEvents(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.Query("status")

	events, total, err := h.financeService.ListRiskEvents(adminRole, page, limit, status)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"items": events,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// POST /api/v1/admin/finance/risk/:id/resolve
func (h *AdminFinanceHandler) ResolveRiskEvent(c *gin.Context) {
	adminID := c.MustGet("admin_id").(uuid.UUID)
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid risk event id"})
		return
	}

	var req models.AdminRiskEventResolveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.financeService.ResolveRiskEvent(adminID, adminRole, id, &req, c.ClientIP(), c.Request.UserAgent()); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Risk event resolved successfully"})
}
