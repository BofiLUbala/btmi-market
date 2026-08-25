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

func (h *ReviewHandler) GetProductReviews(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("product_id"))
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid product_id")
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	sortBy := c.DefaultQuery("sort", "newest")
	var rating *int
	if raw := c.Query("rating"); raw != "" {
		v, e := strconv.Atoi(raw)
		if e == nil && v >= 1 && v <= 5 {
			rating = &v
		}
	}
	var viewer *uuid.UUID
	if raw, ok := c.Get("user_id"); ok {
		v := raw.(uuid.UUID)
		viewer = &v
	}
	data, err := h.reviewService.GetProductReviews(productID, viewer, sortBy, rating, page, perPage)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Product reviews retrieved", Data: data})
}

func (h *ReviewHandler) MarkHelpful(c *gin.Context)   { h.setHelpful(c, true) }
func (h *ReviewHandler) UnmarkHelpful(c *gin.Context) { h.setHelpful(c, false) }
func (h *ReviewHandler) setHelpful(c *gin.Context, helpful bool) {
	reviewID, err := uuid.Parse(c.Param("review_id"))
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid review_id")
		return
	}
	raw, _ := c.Get("user_id")
	count, err := h.reviewService.SetHelpful(reviewID, raw.(uuid.UUID), helpful)
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "REVIEW_ACTION_FAILED", err.Error())
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Helpful vote updated", Data: gin.H{"helpful_count": count, "helpful_by_me": helpful}})
}

func (h *ReviewHandler) Reply(c *gin.Context) {
	reviewID, err := uuid.Parse(c.Param("review_id"))
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid review_id")
		return
	}
	var req models.CreateReviewReplyRequest
	if err = c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Reply is required")
		return
	}
	raw, _ := c.Get("user_id")
	reply, err := h.reviewService.Reply(reviewID, raw.(uuid.UUID), req.Body)
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "REPLY_FAILED", err.Error())
		return
	}
	c.JSON(http.StatusCreated, models.SuccessResponse{Message: "Reply posted", Data: reply})
}
