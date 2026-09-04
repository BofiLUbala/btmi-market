package admin

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
)

type AdminPlatformHandler struct {
	platformService *service.AdminPlatformService
}

func NewAdminPlatformHandler(platformService *service.AdminPlatformService) *AdminPlatformHandler {
	return &AdminPlatformHandler{platformService: platformService}
}

// ─── FEATURE FLAGS ────────────────────────────────────────────────────────────

// GET /api/v1/admin/platform/feature-flags
func (h *AdminPlatformHandler) ListFeatureFlags(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	flags, err := h.platformService.ListFeatureFlags(c.Request.Context(), adminRole)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"flags": flags})
}

// GET /api/v1/admin/platform/feature-flags/:key
func (h *AdminPlatformHandler) GetFeatureFlag(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	flag, err := h.platformService.GetFeatureFlag(c.Request.Context(), adminRole, c.Param("key"))
	if err != nil {
		status := http.StatusForbidden
		if err.Error() == "feature flag not found" {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, flag)
}

// PATCH /api/v1/admin/platform/feature-flags/:key
func (h *AdminPlatformHandler) UpdateFeatureFlag(c *gin.Context) {
	adminID := c.MustGet("admin_id").(uuid.UUID)
	adminRole := c.MustGet("admin_role").(models.AdminRole)

	var req models.UpdateFeatureFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.platformService.UpdateFeatureFlag(c.Request.Context(), adminID, adminRole, c.Param("key"), &req)
	if err != nil {
		if errors.Is(err, service.ErrHighRiskConfirmRequired) {
			c.JSON(http.StatusConflict, gin.H{
				"error":            err.Error(),
				"confirm_required": true,
				"impact_warning":   "This flag is marked high-risk. Changing it may break a critical business flow. Resubmit with confirm=true to proceed.",
			})
			return
		}
		status := http.StatusForbidden
		if err.Error() == "feature flag not found" || err.Error() == "reason required for feature flag change" {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "feature flag updated"})
}

// ─── GLOBAL CONFIG ────────────────────────────────────────────────────────────

// GET /api/v1/admin/platform/config
func (h *AdminPlatformHandler) ListGlobalConfigs(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	configs, err := h.platformService.ListGlobalConfigs(c.Request.Context(), adminRole)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"configs": configs})
}

// GET /api/v1/admin/platform/config/:key
func (h *AdminPlatformHandler) GetGlobalConfig(c *gin.Context) {
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	cfg, err := h.platformService.GetGlobalConfig(c.Request.Context(), adminRole, c.Param("key"))
	if err != nil {
		status := http.StatusForbidden
		if err.Error() == "global config not found" {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

// PATCH /api/v1/admin/platform/config/:key
func (h *AdminPlatformHandler) UpdateGlobalConfig(c *gin.Context) {
	adminID := c.MustGet("admin_id").(uuid.UUID)
	adminRole := c.MustGet("admin_role").(models.AdminRole)

	var req models.UpdateGlobalConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.platformService.UpdateGlobalConfig(c.Request.Context(), adminID, adminRole, c.Param("key"), &req)
	if err != nil {
		status := http.StatusForbidden
		if err.Error() == "global config not found" ||
			err.Error() == "reason required for global config change" ||
			errors.Is(err, service.ErrInvalidConfigValue) {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "global config updated"})
}
