package shops

import (
	"net/http"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	shopService *service.ShopService
}

func NewHandler(shopService *service.ShopService) *Handler {
	return &Handler{shopService: shopService}
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

	var req models.CreateShopRequest
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

	shop, err := h.shopService.CreateShop(userID.(uuid.UUID), businessID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
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
		Message: "Shop created successfully",
		Data: models.ShopResponse{
			ID:                      shop.ID,
			BusinessID:              shop.BusinessID,
			Name:                    shop.Name,
			Type:                    shop.Type,
			City:                    shop.City,
			Address:                 shop.Address,
			Phone:                   shop.Phone,
			Status:                  shop.Status,
			SupportsShopDelivery:    shop.SupportsShopDelivery,
			ShopDeliveryFee:         shop.ShopDeliveryFee,
			SupportsPartnerDelivery: shop.SupportsPartnerDelivery,
			PartnerDeliveryFee:      shop.PartnerDeliveryFee,
			PartnerDeliveryProvider: shop.PartnerDeliveryProvider,
			DeliveryCity:            shop.DeliveryCity,
			DeliveryAddress:         shop.DeliveryAddress,
			CreatedAt:               shop.CreatedAt,
			UpdatedAt:               shop.UpdatedAt,
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

	shops, err := h.shopService.ListShopsByBusiness(userID.(uuid.UUID), businessID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
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

	responses := make([]models.ShopResponse, 0)
	for _, shop := range shops {
		responses = append(responses, models.ShopResponse{
			ID:                      shop.ID,
			BusinessID:              shop.BusinessID,
			Name:                    shop.Name,
			Type:                    shop.Type,
			City:                    shop.City,
			Address:                 shop.Address,
			Phone:                   shop.Phone,
			Status:                  shop.Status,
			SupportsShopDelivery:    shop.SupportsShopDelivery,
			ShopDeliveryFee:         shop.ShopDeliveryFee,
			SupportsPartnerDelivery: shop.SupportsPartnerDelivery,
			PartnerDeliveryFee:      shop.PartnerDeliveryFee,
			PartnerDeliveryProvider: shop.PartnerDeliveryProvider,
			DeliveryCity:            shop.DeliveryCity,
			DeliveryAddress:         shop.DeliveryAddress,
			CreatedAt:               shop.CreatedAt,
			UpdatedAt:               shop.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Shops retrieved successfully",
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

	shopIDStr := c.Param("shop_id")
	shopID, err := uuid.Parse(shopIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid shop ID",
			},
		})
		return
	}

	shop, err := h.shopService.GetShopByID(userID.(uuid.UUID), shopID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "SHOP_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "SHOP_NOT_FOUND"
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
		Message: "Shop retrieved successfully",
		Data: models.ShopResponse{
			ID:                      shop.ID,
			BusinessID:              shop.BusinessID,
			Name:                    shop.Name,
			Type:                    shop.Type,
			City:                    shop.City,
			Address:                 shop.Address,
			Phone:                   shop.Phone,
			Status:                  shop.Status,
			SupportsShopDelivery:    shop.SupportsShopDelivery,
			ShopDeliveryFee:         shop.ShopDeliveryFee,
			SupportsPartnerDelivery: shop.SupportsPartnerDelivery,
			PartnerDeliveryFee:      shop.PartnerDeliveryFee,
			PartnerDeliveryProvider: shop.PartnerDeliveryProvider,
			DeliveryCity:            shop.DeliveryCity,
			DeliveryAddress:         shop.DeliveryAddress,
			CreatedAt:               shop.CreatedAt,
			UpdatedAt:               shop.UpdatedAt,
		},
	})
}

func (h *Handler) Update(c *gin.Context) {
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

	shopIDStr := c.Param("shop_id")
	shopID, err := uuid.Parse(shopIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid shop ID",
			},
		})
		return
	}

	var req models.UpdateShopRequest
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

	shop, err := h.shopService.UpdateShop(userID.(uuid.UUID), shopID, &req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "SHOP_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "SHOP_NOT_FOUND"
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
		Message: "Shop updated successfully",
		Data: models.ShopResponse{
			ID:                      shop.ID,
			BusinessID:              shop.BusinessID,
			Name:                    shop.Name,
			Type:                    shop.Type,
			City:                    shop.City,
			Address:                 shop.Address,
			Phone:                   shop.Phone,
			Status:                  shop.Status,
			SupportsShopDelivery:    shop.SupportsShopDelivery,
			ShopDeliveryFee:         shop.ShopDeliveryFee,
			SupportsPartnerDelivery: shop.SupportsPartnerDelivery,
			PartnerDeliveryFee:      shop.PartnerDeliveryFee,
			PartnerDeliveryProvider: shop.PartnerDeliveryProvider,
			DeliveryCity:            shop.DeliveryCity,
			DeliveryAddress:         shop.DeliveryAddress,
			CreatedAt:               shop.CreatedAt,
			UpdatedAt:               shop.UpdatedAt,
		},
	})
}

// DeleteShop archives the Shop when it holds commercial history, or deletes it
// when it is empty. The response states which action was taken.
func (h *Handler) DeleteShop(c *gin.Context) {
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

	shopID, err := uuid.Parse(c.Param("shop_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid shop ID",
			},
		})
		return
	}

	action, shop, err := h.shopService.DeleteShop(userID.(uuid.UUID), shopID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		switch err.Error() {
		case "SHOP_NOT_FOUND":
			statusCode = http.StatusNotFound
		case "FORBIDDEN":
			statusCode = http.StatusForbidden
		}
		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    err.Error(),
				Message: err.Error(),
			},
		})
		return
	}

	data := gin.H{"action": action}
	if shop != nil {
		data["shop"] = models.ShopResponse{
			ID:      shop.ID,
			BusinessID: shop.BusinessID,
			Name:    shop.Name,
			Type:    shop.Type,
			City:    shop.City,
			Address: shop.Address,
			Phone:   shop.Phone,
			Status:  shop.Status,
		}
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Shop " + action + " successfully",
		Data:    data,
	})
}
