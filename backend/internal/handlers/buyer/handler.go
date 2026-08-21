package buyer

import (
	"fmt"
	"net/http"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	buyerService        *service.BuyerProfileService
	pointService        *service.PointService
	confirmationService *service.PurchaseConfirmationService
}

func NewHandler(
	buyerService *service.BuyerProfileService,
	pointService *service.PointService,
	confirmationService *service.PurchaseConfirmationService,
) *Handler {
	return &Handler{
		buyerService:        buyerService,
		pointService:        pointService,
		confirmationService: confirmationService,
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

// GET /api/v1/buyer/profile
func (h *Handler) GetProfile(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	profile, err := h.buyerService.GetProfile(userID)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "BUYER_PROFILE_NOT_FOUND", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Buyer profile retrieved successfully",
		Data:    profile,
	})
}

// POST /api/v1/buyer/profile
func (h *Handler) CreateProfile(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	var req models.CreateBuyerProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	profile, err := h.buyerService.CreateProfile(userID, &req)
	if err != nil {
		statusCode := http.StatusBadRequest
		errorCode := "INVALID_REQUEST"
		switch err.Error() {
		case "BUYER_PROFILE_EXISTS":
			statusCode = http.StatusConflict
			errorCode = "BUYER_PROFILE_EXISTS"
		case "USER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "USER_NOT_FOUND"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Buyer profile created successfully",
		Data:    profile,
	})
}

// PATCH /api/v1/buyer/profile
func (h *Handler) UpdateProfile(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	var req models.UpdateBuyerProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	profile, err := h.buyerService.UpdateProfile(userID, &req)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "BUYER_PROFILE_NOT_FOUND", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Buyer profile updated successfully",
		Data:    profile,
	})
}

// GET /api/v1/buyer/points
func (h *Handler) GetPoints(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	profile, err := h.buyerService.GetProfile(userID)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "BUYER_PROFILE_NOT_FOUND", err.Error())
		return
	}

	account, err := h.pointService.GetAccount(models.PointOwnerTypeBuyer, profile.Profile.ID)
	if err != nil || account == nil {
		h.errResponse(c, http.StatusNotFound, "NO_POINT_ACCOUNT", "No point account found")
		return
	}

	levelName := "BRONZE"
	if account.LevelID != nil {
		level, _ := h.pointService.GetLevelByID(*account.LevelID)
		if level != nil {
			levelName = level.Name
		}
	}

	response := map[string]interface{}{
		"lifetime_points": account.LifetimePoints,
		"available_points": account.CurrentPoints - account.ReservedPoints,
		"reserved_points": account.ReservedPoints,
		"level": levelName,
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Buyer points retrieved successfully",
		Data:    response,
	})
}

// GET /api/v1/buyer/points/history
func (h *Handler) GetPointsHistory(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	profile, err := h.buyerService.GetProfile(userID)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "BUYER_PROFILE_NOT_FOUND", err.Error())
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

	history, err := h.pointService.GetHistory(models.PointOwnerTypeBuyer, profile.Profile.ID, page, limit)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Buyer point history retrieved successfully",
		Data:    history,
	})
}

// GET /api/v1/buyer/purchases/pending
func (h *Handler) GetPendingPurchases(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	profile, err := h.buyerService.GetOrCreateByUserID(userID)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "BUYER_PROFILE_NOT_FOUND", "Buyer profile not found. Please create one first.")
		return
	}

	purchases, err := h.confirmationService.GetPendingPurchases(profile.ID)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Pending purchases retrieved successfully",
		Data:    purchases,
	})
}

// POST /api/v1/buyer/purchases/:purchase_id/confirm
func (h *Handler) ConfirmPurchase(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	profile, err := h.buyerService.GetOrCreateByUserID(userID)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "BUYER_PROFILE_NOT_FOUND", "Buyer profile not found. Please create one first.")
		return
	}

	orderIDStr := c.Param("purchase_id")
	orderID, err := uuid.Parse(orderIDStr)
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid purchase ID")
		return
	}

	result, err := h.confirmationService.ConfirmPurchase(profile.ID, orderID)
	if err != nil {
		statusCode := http.StatusBadRequest
		errorCode := "INVALID_REQUEST"
		switch err.Error() {
		case "ALREADY_CONFIRMED":
			statusCode = http.StatusConflict
			errorCode = "ALREADY_CONFIRMED"
		case "ORDER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "ORDER_NOT_FOUND"
		case "ORDER_NOT_COMPLETED":
			statusCode = http.StatusBadRequest
			errorCode = "ORDER_NOT_COMPLETED"
		case "NO_CASH_PAYMENT_FOUND":
			statusCode = http.StatusBadRequest
			errorCode = "NO_CASH_PAYMENT_FOUND"
		}
		h.errResponse(c, statusCode, errorCode, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Purchase confirmed successfully",
		Data:    result,
	})
}
