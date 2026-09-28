package admin

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/btmi-ai-market/backend/internal/service"
)

type MonitoringHandler struct {
	monitoringService *service.MonitoringService
}

func NewMonitoringHandler(monitoringService *service.MonitoringService) *MonitoringHandler {
	return &MonitoringHandler{
		monitoringService: monitoringService,
	}
}

// GetAuthFailures returns recent auth failures for admin dashboard
// GET /api/admin/monitoring/auth-failures?limit=50&role=buyer
func (h *MonitoringHandler) GetAuthFailures(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	limitStr := r.URL.Query().Get("limit")
	if limitStr == "" {
		limitStr = "50"
	}
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit > 500 {
		limit = 50
	}

	role := r.URL.Query().Get("role")

	var failures interface{}
	if role != "" {
		failures, err = h.monitoringService.GetAuthFailuresByRole(ctx, role, limit)
	} else {
		failures, err = h.monitoringService.GetRecentAuthFailures(ctx, limit)
	}

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(failures)
}

// GetActiveSessions returns current active user sessions
// GET /api/admin/monitoring/sessions?role=buyer
func (h *MonitoringHandler) GetActiveSessions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	role := r.URL.Query().Get("role")

	var sessions interface{}
	var err error
	if role != "" {
		sessions, err = h.monitoringService.GetActiveSessionsByRole(ctx, role)
	} else {
		sessions, err = h.monitoringService.GetActiveSessions(ctx)
	}

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sessions)
}

// KickSession removes a user's session (admin action)
// POST /api/admin/monitoring/sessions/:user_id/kick
func (h *MonitoringHandler) KickSession(w http.ResponseWriter, r *http.Request) {
	// TODO: Extract user_id from URL params and implement session removal
	// Requires middleware to extract path param
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "kicked"})
}

// CleanupExpiredSessions runs cleanup (typically via cron job)
// POST /api/admin/monitoring/cleanup/sessions
func (h *MonitoringHandler) CleanupExpiredSessions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 30 minute timeout
	err := h.monitoringService.CleanupExpiredSessions(ctx, 30)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "cleaned"})
}

// CleanupOldFailures runs cleanup for old auth failures
// POST /api/admin/monitoring/cleanup/failures
func (h *MonitoringHandler) CleanupOldFailures(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// 30 day retention
	err := h.monitoringService.CleanupOldFailures(ctx, 30)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "cleaned"})
}
