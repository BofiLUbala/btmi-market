package orders

import (
	"net/http"
	"strconv"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ReviewHandler struct {
	reviewService       *service.ReviewService
	buyerProfileService *service.BuyerProfileService
}

func NewReviewHandler(reviewService *service.ReviewService, buyerProfileService *service.BuyerProfileService) *ReviewHandler {
	return &ReviewHandler{reviewService: reviewService, buyerProfileService: buyerProfileService}
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

func (h *ReviewHandler) extractBuyerProfileID(c *gin.Context) (uuid.UUID, bool) {
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

// GET /api/v1/buyer/orders/:order_id/review-eligibility
func (h *ReviewHandler) GetReviewEligibility(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}
	orderID, err := uuid.Parse(c.Param("order_id"))
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid order_id")
		return
	}

	var eligibility *models.ReviewEligibilityResponse
	if raw := c.Query("order_line_id"); raw != "" {
		lineID, parseErr := uuid.Parse(raw)
		if parseErr != nil {
			h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid order_line_id")
			return
		}
		eligibility, err = h.reviewService.CanBuyerReviewLine(buyerProfileID, orderID, lineID)
	} else {
		eligibility, err = h.reviewService.CanBuyerReviewOrder(buyerProfileID, orderID)
	}
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Review eligibility checked",
		Data:    eligibility,
	})
}

// POST /api/v1/buyer/orders/:order_id/review
func (h *ReviewHandler) CreateReview(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}
	orderID, err := uuid.Parse(c.Param("order_id"))
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid order_id")
		return
	}

	var req models.CreateReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	review, err := h.reviewService.CreateReview(buyerProfileID, orderID, &req)
	if err != nil {
		statusCode := http.StatusBadRequest
		errorCode := "REVIEW_NOT_ELIGIBLE"
		errMsg := err.Error()
		switch {
		case errMsg == "REVIEW_NOT_ELIGIBLE: REVIEW_ALREADY_EXISTS":
			errorCode = "REVIEW_ALREADY_EXISTS"
		case errMsg == "REVIEW_NOT_ELIGIBLE: ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "ORDER_NOT_FOUND"
		case errMsg == "REVIEW_NOT_ELIGIBLE: FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case errMsg == "REVIEW_NOT_ELIGIBLE: ORDER_NOT_COMPLETED":
			errorCode = "ORDER_NOT_COMPLETED"
		case errMsg == "REVIEW_NOT_ELIGIBLE: PAYMENT_NOT_VERIFIED":
			errorCode = "PAYMENT_NOT_VERIFIED"
		}
		h.errResponse(c, statusCode, errorCode, errMsg)
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Review created successfully",
		Data:    review,
	})
}

// POST /api/v1/buyer/orders/:order_id/service-review
func (h *ReviewHandler) CreateServiceReview(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}
	orderID, err := uuid.Parse(c.Param("order_id"))
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid order_id")
		return
	}
	var req models.CreateServiceReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}
	review, err := h.reviewService.CreateServiceReview(buyerProfileID, orderID, &req)
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "REVIEW_NOT_ELIGIBLE", err.Error())
		return
	}
	c.JSON(http.StatusCreated, models.SuccessResponse{Message: "Service experience review created successfully", Data: review})
}

// PATCH /api/v1/buyer/reviews/:review_id
func (h *ReviewHandler) UpdateReview(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}
	userID, _ := c.Get("user_id")
	reviewID, err := uuid.Parse(c.Param("review_id"))
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid review_id")
		return
	}

	var req models.UpdateReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	review, err := h.reviewService.UpdateReview(buyerProfileID, reviewID, userID.(uuid.UUID), &req)
	if err != nil {
		statusCode := http.StatusBadRequest
		errorCode := "UPDATE_FAILED"
		switch err.Error() {
		case "REVIEW_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "REVIEW_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "REVIEW_NOT_ACTIVE":
			errorCode = "REVIEW_NOT_ACTIVE"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Review updated successfully",
		Data:    review,
	})
}

// DELETE /api/v1/buyer/reviews/:review_id
func (h *ReviewHandler) WithdrawReview(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}
	reviewID, err := uuid.Parse(c.Param("review_id"))
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid review_id")
		return
	}

	if err := h.reviewService.WithdrawReview(buyerProfileID, reviewID); err != nil {
		statusCode := http.StatusBadRequest
		errorCode := "WITHDRAW_FAILED"
		switch err.Error() {
		case "REVIEW_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "REVIEW_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		case "REVIEW_NOT_ACTIVE":
			errorCode = "REVIEW_NOT_ACTIVE"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Review withdrawn successfully",
		Data:    nil,
	})
}

// GET /api/v1/buyer/reviews
func (h *ReviewHandler) ListBuyerReviews(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	reviews, err := h.reviewService.GetBuyerReviews(buyerProfileID, page, perPage)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Reviews retrieved",
		Data:    reviews,
	})
}
