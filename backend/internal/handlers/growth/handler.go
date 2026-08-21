package growth

import (
	"fmt"
	"net/http"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	sellerGrowthService *service.SellerGrowthService
	pointService        *service.PointService
	membershipRepo      *repository.MembershipRepository
}

func NewHandler(
	sellerGrowthService *service.SellerGrowthService,
	pointService *service.PointService,
	membershipRepo *repository.MembershipRepository,
) *Handler {
	return &Handler{
		sellerGrowthService: sellerGrowthService,
		pointService:        pointService,
		membershipRepo:      membershipRepo,
	}
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

func (h *Handler) requireBusinessAccess(c *gin.Context, businessID uuid.UUID) bool {
	userID, ok := h.extractUserID(c)
	if !ok {
		return false
	}

	membership, err := h.membershipRepo.GetByUserAndBusiness(userID, businessID)
	if err != nil || membership == nil {
		h.errResponse(c, http.StatusForbidden, "FORBIDDEN", "You do not have access to this business")
		return false
	}
	return true
}

// GET /api/v1/businesses/:business_id/growth/points
func (h *Handler) GetPoints(c *gin.Context) {
	businessID, err := uuid.Parse(c.Param("business_id"))
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid business ID")
		return
	}

	if !h.requireBusinessAccess(c, businessID) {
		return
	}

	account, err := h.pointService.GetAccount(models.PointOwnerTypeSellerBusiness, businessID)
	if err != nil || account == nil {
		h.errResponse(c, http.StatusNotFound, "NO_POINT_ACCOUNT", "No point account found")
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Seller points retrieved successfully",
		Data:    account,
	})
}

// GET /api/v1/businesses/:business_id/growth/level
func (h *Handler) GetLevel(c *gin.Context) {
	businessID, err := uuid.Parse(c.Param("business_id"))
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid business ID")
		return
	}

	if !h.requireBusinessAccess(c, businessID) {
		return
	}

	growth, err := h.sellerGrowthService.GetGrowthData(businessID)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "GROWTH_DATA_NOT_FOUND", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Seller level retrieved successfully",
		Data:    growth,
	})
}

// GET /api/v1/businesses/:business_id/growth/benefits
func (h *Handler) GetBenefits(c *gin.Context) {
	businessID, err := uuid.Parse(c.Param("business_id"))
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid business ID")
		return
	}

	if !h.requireBusinessAccess(c, businessID) {
		return
	}

	growth, err := h.sellerGrowthService.GetGrowthData(businessID)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "GROWTH_DATA_NOT_FOUND", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Seller benefits retrieved successfully",
		Data: map[string]interface{}{
			"benefits":              growth.Benefits,
			"level":                 growth.Level,
			"high_value_buyer_eligible": growth.HighValueBuyerEligible,
		},
	})
}

// GET /api/v1/businesses/:business_id/growth/history
func (h *Handler) GetHistory(c *gin.Context) {
	businessID, err := uuid.Parse(c.Param("business_id"))
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid business ID")
		return
	}

	if !h.requireBusinessAccess(c, businessID) {
		return
	}

	page := 1
	limit := 50
	if p := c.Query("page"); p != "" {
		fmt.Sscanf(p, "%d", &page)
	}
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}

	history, err := h.pointService.GetHistory(models.PointOwnerTypeSellerBusiness, businessID, page, limit)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Seller growth history retrieved successfully",
		Data:    history,
	})
}
