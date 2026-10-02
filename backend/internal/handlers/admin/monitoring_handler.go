package admin

import (
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
)

// MonitoringHandler serves the Direction console's sign-in monitoring: refused
// sign-ins and the accounts currently signed in. Signing an account out goes
// through the existing, audited force-logout endpoint.
type MonitoringHandler struct {
	monitoringService *service.MonitoringService
}

func NewMonitoringHandler(monitoringService *service.MonitoringService) *MonitoringHandler {
	return &MonitoringHandler{monitoringService: monitoringService}
}

var monitoringRoles = map[string]bool{"": true, "admin": true, "buyer": true, "seller": true, "employee": true, "courier": true, "unknown": true}

func monitoringQuery(c *gin.Context, defaultLimit int) (string, int, bool) {
	role := strings.ToLower(strings.TrimSpace(c.Query("role")))
	if !monitoringRoles[role] {
		monitoringError(c, http.StatusBadRequest, "INVALID_ROLE", "Unknown role filter")
		return "", 0, false
	}
	limit, err := strconv.Atoi(c.DefaultQuery("limit", strconv.Itoa(defaultLimit)))
	if err != nil {
		limit = defaultLimit
	}
	return role, limit, true
}

func monitoringError(c *gin.Context, status int, code, message string) {
	c.JSON(status, models.ErrorResponse{Error: struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}{Code: code, Message: message}})
}

// GET /admin/direction/monitoring/summary
func (h *MonitoringHandler) Summary(c *gin.Context) {
	summary, err := h.monitoringService.Summary(c.Request.Context())
	if err != nil {
		log.Printf("[monitoring] summary: %v", err)
		monitoringError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Could not load monitoring summary")
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "OK", Data: gin.H{
		"summary":               summary,
		"online_window_minutes": int(h.monitoringService.OnlineWindow().Minutes()),
		"retention_days":        service.AuthFailureRetentionDays,
	}})
}

// GET /admin/direction/monitoring/auth-failures?role=&limit=
func (h *MonitoringHandler) AuthFailures(c *gin.Context) {
	role, limit, ok := monitoringQuery(c, 100)
	if !ok {
		return
	}
	failures, err := h.monitoringService.ListAuthFailures(c.Request.Context(), role, limit)
	if err != nil {
		log.Printf("[monitoring] auth failures: %v", err)
		monitoringError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Could not load sign-in failures")
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "OK", Data: failures})
}

// GET /admin/direction/monitoring/sessions?role=&limit=
func (h *MonitoringHandler) Sessions(c *gin.Context) {
	role, limit, ok := monitoringQuery(c, 300)
	if !ok {
		return
	}
	if role == "admin" || role == "unknown" {
		// Admin sessions live in the technical console; unknown accounts cannot sign in.
		c.JSON(http.StatusOK, models.SuccessResponse{Message: "OK", Data: []service.ActiveSession{}})
		return
	}
	sessions, err := h.monitoringService.ListActiveSessions(c.Request.Context(), role, limit)
	if err != nil {
		log.Printf("[monitoring] sessions: %v", err)
		monitoringError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Could not load active sessions")
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "OK", Data: sessions})
}

// GET /admin/direction/monitoring/signed-out?role=&hours=&limit=
// Accounts the Direction signed out recently, and whether they came back.
func (h *MonitoringHandler) SignedOut(c *gin.Context) {
	role, limit, ok := monitoringQuery(c, 100)
	if !ok {
		return
	}
	hours, _ := strconv.Atoi(c.DefaultQuery("hours", "24"))
	accounts, err := h.monitoringService.ListSignedOutAccounts(c.Request.Context(), role, hours, limit)
	if err != nil {
		log.Printf("[monitoring] signed-out accounts: %v", err)
		monitoringError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Could not load signed-out accounts")
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "OK", Data: accounts})
}
