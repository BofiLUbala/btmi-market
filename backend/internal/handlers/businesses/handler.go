package businesses

import (
	"net/http"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	businessService *service.BusinessService
}

func NewHandler(businessService *service.BusinessService) *Handler {
	return &Handler{businessService: businessService}
}

func (h *Handler) Create(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UNAUTHORIZED",
				Message: "User not authenticated",
			},
		})
		return
	}

	var req models.CreateBusinessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid request body: " + err.Error(),
			},
		})
		return
	}

	business, err := h.businessService.CreateBusiness(userID.(uuid.UUID), &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "USER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "USER_NOT_FOUND"
		case "ACCOUNT_NOT_ACTIVATED":
			statusCode = http.StatusForbidden
			errorCode = "ACCOUNT_NOT_ACTIVATED"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Business created successfully",
		Data: models.BusinessResponse{
			ID:              business.ID,
			Name:            business.Name,
			BusinessType:    business.BusinessType,
			Category:        business.Category,
			Phone:           business.Phone,
			Whatsapp:        business.Whatsapp,
			Email:           business.Email,
			Country:         business.Country,
			City:            business.City,
			DefaultCurrency: business.DefaultCurrency,
			Status:          business.Status,
			CreatedAt:       business.CreatedAt,
			UpdatedAt:       business.UpdatedAt,
		},
	})
}

func (h *Handler) List(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UNAUTHORIZED",
				Message: "User not authenticated",
			},
		})
		return
	}

	businesses, err := h.businessService.GetUserBusinesses(userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: "Failed to fetch businesses",
			},
		})
		return
	}

	responses := make([]models.BusinessResponse, 0)
	for _, b := range businesses {
		responses = append(responses, models.BusinessResponse{
			ID:              b.ID,
			Name:            b.Name,
			BusinessType:    b.BusinessType,
			Category:        b.Category,
			Phone:           b.Phone,
			Whatsapp:        b.Whatsapp,
			Email:           b.Email,
			Country:         b.Country,
			City:            b.City,
			DefaultCurrency: b.DefaultCurrency,
			Status:          b.Status,
			CreatedAt:       b.CreatedAt,
			UpdatedAt:       b.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Businesses retrieved successfully",
		Data:    responses,
	})
}

func (h *Handler) Get(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UNAUTHORIZED",
				Message: "User not authenticated",
			},
		})
		return
	}

	businessIDStr := c.Param("business_id")
	businessID, err := uuid.Parse(businessIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid business ID",
			},
		})
		return
	}

	business, err := h.businessService.GetBusinessByID(userID.(uuid.UUID), businessID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "BUSINESS_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "BUSINESS_NOT_FOUND"
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
			errorCode = "FORBIDDEN"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Business retrieved successfully",
		Data: models.BusinessResponse{
			ID:              business.ID,
			Name:            business.Name,
			BusinessType:    business.BusinessType,
			Category:        business.Category,
			Phone:           business.Phone,
			Whatsapp:        business.Whatsapp,
			Email:           business.Email,
			Country:         business.Country,
			City:            business.City,
			DefaultCurrency: business.DefaultCurrency,
			Status:          business.Status,
			CreatedAt:       business.CreatedAt,
			UpdatedAt:       business.UpdatedAt,
		},
	})
}

func (h *Handler) Update(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{})
		return
	}
	businessID, err := uuid.Parse(c.Param("business_id"))
	if err != nil {
		businessError(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid business ID")
		return
	}
	var req models.UpdateBusinessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		businessError(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	business, err := h.businessService.UpdateBusiness(userID.(uuid.UUID), businessID, &req)
	if err != nil {
		businessServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Business updated successfully", Data: business})
}

func (h *Handler) Summary(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		businessError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}
	businessID, err := uuid.Parse(c.Param("business_id"))
	if err != nil {
		businessError(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid business ID")
		return
	}
	summary, err := h.businessService.GetLifecycleSummary(userID.(uuid.UUID), businessID)
	if err != nil {
		businessServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Business lifecycle summary retrieved", Data: summary})
}

func (h *Handler) Archive(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		businessError(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return
	}
	businessID, err := uuid.Parse(c.Param("business_id"))
	if err != nil {
		businessError(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid business ID")
		return
	}
	var req models.ArchiveBusinessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		businessError(c, http.StatusBadRequest, "INVALID_REQUEST", "Type the exact Business name to confirm")
		return
	}
	result, err := h.businessService.ArchiveBusiness(userID.(uuid.UUID), businessID, req.ConfirmName)
	if err != nil {
		businessServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Business archived safely", Data: result})
}

func businessServiceError(c *gin.Context, err error) {
	status, code := http.StatusInternalServerError, "INTERNAL_ERROR"
	switch err.Error() {
	case "BUSINESS_NOT_FOUND":
		status, code = http.StatusNotFound, "BUSINESS_NOT_FOUND"
	case "FORBIDDEN":
		status, code = http.StatusForbidden, "FORBIDDEN"
	case "BUSINESS_NOT_ACTIVE", "INVALID_BUSINESS_NAME", "BUSINESS_NAME_MISMATCH":
		status, code = http.StatusBadRequest, err.Error()
	case "ACTIVE_ORDERS_BLOCK_ARCHIVE", "UNRESOLVED_PAYMENTS_BLOCK_ARCHIVE":
		status, code = http.StatusConflict, err.Error()
	}
	businessError(c, status, code, err.Error())
}

func businessError(c *gin.Context, status int, code, message string) {
	var response models.ErrorResponse
	response.Error.Code = code
	response.Error.Message = message
	c.JSON(status, response)
}
