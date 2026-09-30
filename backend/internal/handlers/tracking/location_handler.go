// Package tracking serves the courier's live position during a delivery.
//
// Write: the assigned courier, only while the order is IN_TRANSIT.
// Read:  the buyer who owns the order, and Commerce Admin (read-only).
// Sellers, their employees and Finance have no route here.
package tracking

import (
	"errors"
	"net/http"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type buyerProfileLookup interface {
	GetProfileByIDFromUser(userID uuid.UUID) (*models.BuyerProfile, error)
}

type LocationHandler struct {
	locations     *service.CourierLocationService
	buyerProfiles buyerProfileLookup
}

func NewLocationHandler(locations *service.CourierLocationService, buyerProfiles buyerProfileLookup) *LocationHandler {
	return &LocationHandler{locations: locations, buyerProfiles: buyerProfiles}
}

func errResponse(c *gin.Context, status int, code, message string) {
	c.AbortWithStatusJSON(status, models.ErrorResponse{
		Error: struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}{Code: code, Message: message},
	})
}

func userID(c *gin.Context) (uuid.UUID, bool) {
	raw, _ := c.Get("user_id")
	id, ok := raw.(uuid.UUID)
	if !ok {
		errResponse(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
	}
	return id, ok
}

func orderParam(c *gin.Context, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param(name))
	if err != nil {
		errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid "+name)
		return uuid.Nil, false
	}
	return id, true
}

// POST /api/v1/courier/missions/:id/location
func (h *LocationHandler) ReportLocation(c *gin.Context) {
	courierUserID, ok := userID(c)
	if !ok {
		return
	}
	orderID, ok := orderParam(c, "id")
	if !ok {
		return
	}
	var req models.ReportLocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errResponse(c, http.StatusBadRequest, "INVALID_LOCATION", "Invalid location: "+err.Error())
		return
	}
	result, err := h.locations.ReportLocation(courierUserID, orderID, &req)
	var invalid *service.ErrInvalidLocation
	switch {
	case errors.As(err, &invalid):
		errResponse(c, http.StatusUnprocessableEntity, "INVALID_LOCATION", invalid.Error())
	case errors.Is(err, service.ErrTrackingNotActive):
		errResponse(c, http.StatusConflict, "TRACKING_NOT_ACTIVE", "Location sharing is only active while this delivery is in transit")
	case err != nil:
		errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Could not record location")
	default:
		c.JSON(http.StatusOK, models.SuccessResponse{Message: "Location received", Data: result})
	}
}

// GET /api/v1/buyer/orders/:order_id/courier-location
func (h *LocationHandler) BuyerCourierLocation(c *gin.Context) {
	uid, ok := userID(c)
	if !ok {
		return
	}
	orderID, ok := orderParam(c, "order_id")
	if !ok {
		return
	}
	profile, err := h.buyerProfiles.GetProfileByIDFromUser(uid)
	if err != nil || profile == nil {
		errResponse(c, http.StatusNotFound, "BUYER_PROFILE_NOT_FOUND", "Buyer profile not found")
		return
	}
	resp, err := h.locations.GetForBuyer(profile.ID, orderID)
	h.respond(c, resp, err)
}

// GET /api/v1/admin/commerce/orders/:id/courier-location
func (h *LocationHandler) AdminCourierLocation(c *gin.Context) {
	orderID, ok := orderParam(c, "id")
	if !ok {
		return
	}
	resp, err := h.locations.GetForAdmin(orderID)
	h.respond(c, resp, err)
}

func (h *LocationHandler) respond(c *gin.Context, resp *models.CourierLocationResponse, err error) {
	switch {
	case errors.Is(err, service.ErrLocationOrderNotFound):
		errResponse(c, http.StatusNotFound, "ORDER_NOT_FOUND", "Order not found")
	case errors.Is(err, service.ErrLocationForbidden):
		errResponse(c, http.StatusForbidden, "FORBIDDEN", "Not your order")
	case err != nil:
		errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Could not load courier location")
	default:
		// A position is live data: never cache it.
		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusOK, models.SuccessResponse{Message: "Courier location", Data: resp})
	}
}
