package admin

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
)

type AdminTechnicalHandler struct {
	technicalService *service.AdminTechnicalService
}

func NewAdminTechnicalHandler(technicalService *service.AdminTechnicalService) *AdminTechnicalHandler {
	return &AdminTechnicalHandler{technicalService: technicalService}
}

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────

// GET /api/v1/admin/technical/overview
func (h *AdminTechnicalHandler) GetOverview(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	kpis, err := h.technicalService.GetTechnicalOverview(c.Request.Context(), adminRole)
	if err != nil {
		statusCode := http.StatusForbidden
		if err.Error() != "forbidden: TECHNICAL_ADMIN or SUPER_ADMIN required" {
			statusCode = http.StatusInternalServerError
		}
		c.JSON(statusCode, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, kpis)
}

// ─── SYSTEM HEALTH ────────────────────────────────────────────────────────────

// GET /api/v1/admin/technical/health
func (h *AdminTechnicalHandler) GetSystemHealth(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	health, err := h.technicalService.GetSystemHealth(c.Request.Context(), adminRole)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, health)
}

// ─── POSTGRESQL ───────────────────────────────────────────────────────────────

// GET /api/v1/admin/technical/database
func (h *AdminTechnicalHandler) GetDatabaseHealth(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	health, err := h.technicalService.GetPostgresHealth(c.Request.Context(), adminRole)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, health)
}

// ─── REDIS ────────────────────────────────────────────────────────────────────

// GET /api/v1/admin/technical/redis
func (h *AdminTechnicalHandler) GetRedisHealth(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	health, err := h.technicalService.GetRedisHealth(c.Request.Context(), adminRole)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, health)
}

// ─── WORKERS ──────────────────────────────────────────────────────────────────

// GET /api/v1/admin/technical/workers
func (h *AdminTechnicalHandler) GetWorkerMetrics(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	metrics, err := h.technicalService.GetWorkerMetrics(c.Request.Context(), adminRole)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, metrics)
}

// GET /api/v1/admin/technical/workers/failed
func (h *AdminTechnicalHandler) ListFailedJobs(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "20"), 10, 64)
	offset, _ := strconv.ParseInt(c.DefaultQuery("offset", "0"), 10, 64)
	queue := c.DefaultQuery("queue", "default")

	jobs, err := h.technicalService.ListFailedJobs(c.Request.Context(), adminRole, queue, limit, offset)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": jobs})
}

// POST /api/v1/admin/technical/workers/:id/retry
func (h *AdminTechnicalHandler) RetryFailedJob(c *gin.Context) {
	adminID := c.MustGet("admin_id").(uuid.UUID)
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	jobID := c.Param("id")

	var req models.RetryJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reason required"})
		return
	}

	if err := h.technicalService.RetryFailedJob(c.Request.Context(), adminID, adminRole, jobID, req.Reason); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "job queued for retry"})
}

// ─── VISUAL SEARCH ────────────────────────────────────────────────────────────

// GET /api/v1/admin/technical/visual-search
func (h *AdminTechnicalHandler) GetVisualSearchHealth(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	health, err := h.technicalService.GetVisualSearchHealth(c.Request.Context(), adminRole)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, health)
}

// ─── BACKUPS ──────────────────────────────────────────────────────────────────

// GET /api/v1/admin/technical/backups
func (h *AdminTechnicalHandler) GetBackupSummary(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	summary, err := h.technicalService.GetBackupSummary(c.Request.Context(), adminRole)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, summary)
}

// ─── MIGRATIONS ───────────────────────────────────────────────────────────────

// GET /api/v1/admin/technical/migrations
func (h *AdminTechnicalHandler) GetMigrationSummary(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	summary, err := h.technicalService.GetMigrationSummary(c.Request.Context(), adminRole)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, summary)
}

// ─── EMAIL / SMTP ─────────────────────────────────────────────────────────────

// GET /api/v1/admin/technical/email/health
func (h *AdminTechnicalHandler) GetEmailHealth(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	health, err := h.technicalService.GetEmailHealth(c.Request.Context(), adminRole)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, health)
}

// ─── SESSIONS ─────────────────────────────────────────────────────────────────

// GET /api/v1/admin/technical/sessions
func (h *AdminTechnicalHandler) GetAdminSessions(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	sessions, err := h.technicalService.GetActiveAdminSessions(c.Request.Context(), adminRole)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"sessions": sessions,
		"total":    len(sessions),
	})
}

// POST /api/v1/admin/technical/sessions/:id/revoke
func (h *AdminTechnicalHandler) RevokeAdminSession(c *gin.Context) {
	adminID := c.MustGet("admin_id").(uuid.UUID)
	adminRole := c.MustGet("admin_role").(models.AdminRole)

	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session id"})
		return
	}

	var req models.RevokeSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Reason == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reason required"})
		return
	}

	if err := h.technicalService.RevokeAdminSession(c.Request.Context(), adminID, adminRole, sessionID, req.Reason); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "session revoked"})
}

// ─── SECURITY EVENTS ──────────────────────────────────────────────────────────

// GET /api/v1/admin/technical/security/events
func (h *AdminTechnicalHandler) GetSecurityEvents(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	severity := c.Query("severity")

	events, total, err := h.technicalService.GetSecurityEvents(c.Request.Context(), adminRole, limit, offset, severity)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"events": events,
		"total":  total,
	})
}

// POST /api/v1/admin/technical/security/events/:id/acknowledge
func (h *AdminTechnicalHandler) AcknowledgeSecurityEvent(c *gin.Context) {
	adminID := c.MustGet("admin_id").(uuid.UUID)
	adminRole := c.MustGet("admin_role").(models.AdminRole)

	eventID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid event id"})
		return
	}

	var req models.AcknowledgeSecurityEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.technicalService.AcknowledgeSecurityEvent(c.Request.Context(), adminID, adminRole, eventID, req.Status, req.Reason); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "security event updated"})
}

// ─── APP VERSIONS ─────────────────────────────────────────────────────────────

// GET /api/v1/admin/technical/versions
func (h *AdminTechnicalHandler) GetAppVersions(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	versions, err := h.technicalService.GetAppVersions(c.Request.Context(), adminRole)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"versions": versions})
}

// PATCH /api/v1/admin/technical/versions/:platform
func (h *AdminTechnicalHandler) UpdateAppVersion(c *gin.Context) {
	adminID := c.MustGet("admin_id").(uuid.UUID)
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	platform := c.Param("platform")

	var req models.UpdateAppVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.technicalService.UpdateAppVersion(c.Request.Context(), adminID, adminRole, &req, platform); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "version updated"})
}
