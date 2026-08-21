package marketplace

import (
	"net/http"
	"strconv"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ReviewHandler struct {
	reviewService *service.ReviewService
}

func NewReviewHandler(reviewService *service.ReviewService) *ReviewHandler {
	return &ReviewHandler{reviewService: reviewService}
}

func (h *ReviewHandler) errResponse(c *gin.Context, statusCode int, code, message string) {
	c.JSON(statusCode, models.ErrorResponse{
		Error: struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}{
			Code:    code,
			Message: message,
		},
	})
}

// GET /api/v1/marketplace/shops/:shop_id/reviews
func (h *ReviewHandler) GetShopReviews(c *gin.Context) {
	shopID, err := uuid.Parse(c.Param("shop_id"))
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid shop_id")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	sortBy := c.DefaultQuery("sort", "newest")

	var ratingFilter *int
	if r := c.Query("rating"); r != "" {
		rating, err := strconv.Atoi(r)
		if err == nil && rating >= 1 && rating <= 5 {
			ratingFilter = &rating
		}
	}

	reviews, err := h.reviewService.GetShopReviews(shopID, sortBy, ratingFilter, page, perPage)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Shop reviews retrieved",
		Data:    reviews,
	})
}
