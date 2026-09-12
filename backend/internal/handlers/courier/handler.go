package courier

import (
	"net/http"
	"strconv"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	courierService *service.CourierService
}

func NewHandler(courierService *service.CourierService) *Handler {
	return &Handler{courierService: courierService}
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

func (h *Handler) parseUUIDParam(c *gin.Context, paramName string) (uuid.UUID, bool) {
	paramStr := c.Param(paramName)
	id, err := uuid.Parse(paramStr)
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid "+paramName)
		return uuid.Nil, false
	}
	return id, true
}

// POST /api/v1/courier/activate - Activate courier account from invitation
func (h *Handler) Activate(c *gin.Context) {
	var req models.AcceptCourierInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	err := h.courierService.AcceptInvitation(req.Token, req.Password, req.PasswordConfirmation)
	if err != nil {
		status := http.StatusBadRequest
		code := "ACTIVATION_FAILED"
		switch err {
		case service.ErrInvitationNotFound:
			status = http.StatusNotFound
			code = "INVITATION_NOT_FOUND"
		case service.ErrInvitationExpired:
			code = "INVITATION_EXPIRED"
		case service.ErrInvitationAlreadyUsed:
			code = "INVITATION_ALREADY_USED"
		case service.ErrPasswordMismatch:
			code = "PASSWORD_MISMATCH"
		}
		h.errResponse(c, status, code, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Courier account activated successfully",
	})
}

// GET /api/v1/courier/verify/:token - Verify invitation token
func (h *Handler) VerifyInvitation(c *gin.Context) {
	token := c.Param("token")
	if token == "" {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Token required")
		return
	}

	inv, err := h.courierService.VerifyInvitation(token)
	if err != nil {
		status := http.StatusBadRequest
		code := "INVITATION_INVALID"
		switch err {
		case service.ErrInvitationNotFound:
			status = http.StatusNotFound
			code = "INVITATION_NOT_FOUND"
		case service.ErrInvitationExpired:
			code = "INVITATION_EXPIRED"
		case service.ErrInvitationAlreadyUsed:
			code = "INVITATION_ALREADY_USED"
		}
		h.errResponse(c, status, code, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Invitation verified",
		Data: gin.H{
			"email":      inv.Email,
			"first_name": inv.FirstName,
			"last_name":  inv.LastName,
			"expires_at": inv.ExpiresAt,
		},
	})
}

// GET /api/v1/courier/profile - Get courier profile
func (h *Handler) GetProfile(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	profile, err := h.courierService.GetCourierProfile(userID)
	if err != nil {
		status := http.StatusNotFound
		code := "COURIER_NOT_FOUND"
		if err == service.ErrCourierNotActive || err == service.ErrCourierSuspended {
			status = http.StatusForbidden
			code = "COURIER_ACCESS_DENIED"
		}
		h.errResponse(c, status, code, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Courier profile retrieved",
		Data:    profile,
	})
}

// PATCH /api/v1/courier/availability - Update availability
func (h *Handler) UpdateAvailability(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	var req models.UpdateCourierAvailabilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	if err := h.courierService.UpdateAvailability(userID, req.Availability); err != nil {
		status := http.StatusInternalServerError
		code := "UPDATE_FAILED"
		switch err {
		case service.ErrCourierNotFound:
			status = http.StatusNotFound
			code = "COURIER_NOT_FOUND"
		case service.ErrCourierNotActive:
			status = http.StatusForbidden
			code = "COURIER_NOT_ACTIVE"
		}
		h.errResponse(c, status, code, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Availability updated",
	})
}

// GET /api/v1/courier/dashboard - Get courier dashboard
func (h *Handler) GetDashboard(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	dashboard, err := h.courierService.GetDashboard(userID)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "COURIER_NOT_FOUND", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Dashboard retrieved",
		Data:    dashboard,
	})
}

// GET /api/v1/courier/missions - Get all missions
func (h *Handler) GetMissions(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	missions, err := h.courierService.GetMissions(userID)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "COURIER_NOT_FOUND", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Missions retrieved",
		Data:    missions,
	})
}

// GET /api/v1/courier/missions/:id - Get single mission
func (h *Handler) GetMission(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	orderID, ok := h.parseUUIDParam(c, "id")
	if !ok {
		return
	}

	mission, err := h.courierService.GetMissionByID(userID, orderID)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "MISSION_NOT_FOUND", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Mission retrieved",
		Data:    mission,
	})
}

// POST /api/v1/courier/missions/:id/accept - Accept mission
func (h *Handler) AcceptMission(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	orderID, ok := h.parseUUIDParam(c, "id")
	if !ok {
		return
	}

	if err := h.courierService.AcceptMission(userID, orderID); err != nil {
		status := http.StatusBadRequest
		code := "ACCEPT_FAILED"
		switch err {
		case service.ErrCourierNotFound:
			status = http.StatusNotFound
			code = "COURIER_NOT_FOUND"
		case service.ErrCourierNotActive, service.ErrCourierSuspended:
			status = http.StatusForbidden
			code = "COURIER_ACCESS_DENIED"
		case service.ErrMissionNotFound:
			status = http.StatusNotFound
			code = "MISSION_NOT_FOUND"
		case service.ErrMissionAlreadyAccepted:
			code = "MISSION_ALREADY_ACCEPTED"
		}
		h.errResponse(c, status, code, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Mission accepted",
	})
}

// POST /api/v1/courier/missions/:id/reject - Reject mission
func (h *Handler) RejectMission(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	orderID, ok := h.parseUUIDParam(c, "id")
	if !ok {
		return
	}

	var req models.RejectMissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Reason required: "+err.Error())
		return
	}

	if err := h.courierService.RejectMission(userID, orderID, req.Reason); err != nil {
		status := http.StatusBadRequest
		code := "REJECT_FAILED"
		switch err {
		case service.ErrCourierNotFound:
			status = http.StatusNotFound
			code = "COURIER_NOT_FOUND"
		case service.ErrMissionNotFound:
			status = http.StatusNotFound
			code = "MISSION_NOT_FOUND"
		case service.ErrMissionAlreadyRejected:
			code = "MISSION_ALREADY_REJECTED"
		}
		h.errResponse(c, status, code, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Mission rejected",
	})
}

// POST /api/v1/courier/missions/:id/start - Start delivery
func (h *Handler) StartDelivery(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	orderID, ok := h.parseUUIDParam(c, "id")
	if !ok {
		return
	}

	if err := h.courierService.StartDelivery(userID, orderID); err != nil {
		status := http.StatusBadRequest
		code := "START_FAILED"
		switch err {
		case service.ErrCourierNotFound:
			status = http.StatusNotFound
			code = "COURIER_NOT_FOUND"
		case service.ErrMissionNotFound:
			status = http.StatusNotFound
			code = "MISSION_NOT_FOUND"
		case service.ErrInvalidStatusTransition:
			code = "INVALID_STATUS_TRANSITION"
		}
		h.errResponse(c, status, code, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Delivery started",
	})
}

// POST /api/v1/courier/missions/:id/arrive - Arrive at destination
func (h *Handler) ArriveAtDestination(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	orderID, ok := h.parseUUIDParam(c, "id")
	if !ok {
		return
	}

	if err := h.courierService.ArriveAtDestination(userID, orderID); err != nil {
		status := http.StatusBadRequest
		code := "ARRIVE_FAILED"
		switch err {
		case service.ErrCourierNotFound:
			status = http.StatusNotFound
			code = "COURIER_NOT_FOUND"
		case service.ErrMissionNotFound:
			status = http.StatusNotFound
			code = "MISSION_NOT_FOUND"
		case service.ErrInvalidStatusTransition:
			code = "INVALID_STATUS_TRANSITION"
		}
		h.errResponse(c, status, code, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Arrival confirmed",
	})
}

// POST /api/v1/courier/missions/:id/fail - Report failed delivery
func (h *Handler) FailDelivery(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	orderID, ok := h.parseUUIDParam(c, "id")
	if !ok {
		return
	}

	var req models.FailDeliveryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Reason required: "+err.Error())
		return
	}

	if err := h.courierService.FailDelivery(userID, orderID, req.Reason, req.Notes); err != nil {
		status := http.StatusBadRequest
		code := "FAIL_FAILED"
		switch err {
		case service.ErrCourierNotFound:
			status = http.StatusNotFound
			code = "COURIER_NOT_FOUND"
		case service.ErrMissionNotFound:
			status = http.StatusNotFound
			code = "MISSION_NOT_FOUND"
		}
		h.errResponse(c, status, code, err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Delivery failure reported",
	})
}

// GET /api/v1/courier/history - Get delivery history
func (h *Handler) GetHistory(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	history, err := h.courierService.GetHistory(userID, limit, offset)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "COURIER_NOT_FOUND", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "History retrieved",
		Data:    history,
	})
}

// ---- Commerce Admin Courier Management ----

// GET /api/v1/admin/commerce/couriers - List all couriers
func (h *Handler) ListCouriers(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	couriers, total, err := h.courierService.ListAllCouriers(limit, offset)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"couriers": couriers,
		"total":    total,
		"limit":    limit,
		"offset":   offset,
	})
}

// GET /api/v1/admin/commerce/couriers/:id - Get courier detail
func (h *Handler) GetCourierDetail(c *gin.Context) {
	courierID, ok := h.parseUUIDParam(c, "id")
	if !ok {
		return
	}

	courier, err := h.courierService.GetCourierDetailForAdmin(courierID)
	if err != nil {
		h.errResponse(c, http.StatusNotFound, "COURIER_NOT_FOUND", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Courier detail retrieved",
		Data:    courier,
	})
}

// POST /api/v1/admin/commerce/couriers/invite - Invite a courier
func (h *Handler) InviteCourier(c *gin.Context) {
	adminIDVal, exists := c.Get("admin_id")
	if !exists {
		h.errResponse(c, http.StatusUnauthorized, "UNAUTHORIZED", "Admin not authenticated")
		return
	}
	adminID := adminIDVal.(uuid.UUID)

	var req models.InviteCourierRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	token, err := h.courierService.InviteCourier(adminID, &req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		status := http.StatusBadRequest
		code := "INVITE_FAILED"
		if err == service.ErrCourierAlreadyExists {
			code = "COURIER_ALREADY_EXISTS"
		}
		h.errResponse(c, status, code, err.Error())
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Courier invitation sent",
		Data: gin.H{
			"invitation_token": token,
			"invitation_url":   h.courierService.CourierInvitationURL(token, req.FrontendURL),
		},
	})
}

// POST /api/v1/admin/commerce/couriers/:id/suspend - Suspend courier
func (h *Handler) SuspendCourier(c *gin.Context) {
	adminIDVal, exists := c.Get("admin_id")
	if !exists {
		h.errResponse(c, http.StatusUnauthorized, "UNAUTHORIZED", "Admin not authenticated")
		return
	}
	adminID := adminIDVal.(uuid.UUID)

	courierID, ok := h.parseUUIDParam(c, "id")
	if !ok {
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required,min=5"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Reason required (min 5 chars): "+err.Error())
		return
	}

	if err := h.courierService.SuspendCourier(adminID, courierID, req.Reason, c.ClientIP(), c.Request.UserAgent()); err != nil {
		h.errResponse(c, http.StatusNotFound, "SUSPEND_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Courier suspended",
	})
}

// POST /api/v1/admin/commerce/couriers/:id/reactivate - Reactivate courier
func (h *Handler) ReactivateCourier(c *gin.Context) {
	adminIDVal, exists := c.Get("admin_id")
	if !exists {
		h.errResponse(c, http.StatusUnauthorized, "UNAUTHORIZED", "Admin not authenticated")
		return
	}
	adminID := adminIDVal.(uuid.UUID)

	courierID, ok := h.parseUUIDParam(c, "id")
	if !ok {
		return
	}

	if err := h.courierService.ReactivateCourier(adminID, courierID, c.ClientIP(), c.Request.UserAgent()); err != nil {
		h.errResponse(c, http.StatusNotFound, "REACTIVATE_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Courier reactivated",
	})
}

// GET /api/v1/admin/commerce/couriers/available - List available couriers
func (h *Handler) ListAvailableCouriers(c *gin.Context) {
	couriers, err := h.courierService.GetAvailableCouriers()
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Available couriers retrieved",
		Data:    couriers,
	})
}
