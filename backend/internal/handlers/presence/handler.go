// Package presence serves live presence: the public heartbeat every open site or
// app sends, and the Direction console's "who is here now" view.
package presence

import (
	"errors"
	"log"
	"net/http"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	presence *service.PresenceService
}

func NewHandler(presence *service.PresenceService) *Handler {
	return &Handler{presence: presence}
}

func fail(c *gin.Context, status int, code, message string) {
	c.JSON(status, models.ErrorResponse{Error: struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}{Code: code, Message: message}})
}

// Heartbeat: POST /presence/heartbeat, public; a valid access token, when sent,
// attaches the signed-in account.
func (h *Handler) Heartbeat(c *gin.Context) {
	var req service.PresenceHeartbeat
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "INVALID_REQUEST", "visitor_id is required")
		return
	}
	var userID *uuid.UUID
	if v, ok := c.Get("user_id"); ok {
		if id, ok := v.(uuid.UUID); ok {
			userID = &id
		}
	}
	err := h.presence.Heartbeat(c.Request.Context(), req, userID, c.ClientIP(), c.GetHeader("User-Agent"))
	switch {
	case errors.Is(err, service.ErrPresenceInvalid):
		fail(c, http.StatusBadRequest, "INVALID_VISITOR", "visitor_id must be a UUID")
	case errors.Is(err, service.ErrPresenceRateLimited):
		fail(c, http.StatusTooManyRequests, "RATE_LIMITED", "Too many presence updates")
	case err != nil:
		log.Printf("[presence] heartbeat: %v", err)
		fail(c, http.StatusServiceUnavailable, "PRESENCE_UNAVAILABLE", "Presence is unavailable")
	default:
		c.JSON(http.StatusOK, gin.H{"interval_seconds": service.PresenceHeartbeatSeconds})
	}
}

// Leave: POST /presence/leave, public.
func (h *Handler) Leave(c *gin.Context) {
	var req struct {
		VisitorID string `json:"visitor_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "INVALID_REQUEST", "visitor_id is required")
		return
	}
	if err := h.presence.Leave(c.Request.Context(), req.VisitorID); err != nil && !errors.Is(err, service.ErrPresenceInvalid) {
		log.Printf("[presence] leave: %v", err)
	}
	c.Status(http.StatusNoContent)
}

// List: GET /admin/direction/monitoring/presence (Direction and Super admins).
func (h *Handler) List(c *gin.Context) {
	visitors, summary, err := h.presence.List(c.Request.Context())
	if err != nil {
		log.Printf("[presence] list: %v", err)
		fail(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Could not load live presence")
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "OK", Data: gin.H{
		"visitors":          visitors,
		"summary":           summary,
		"heartbeat_seconds": service.PresenceHeartbeatSeconds,
	}})
}
