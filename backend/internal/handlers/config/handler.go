// Package config exposes read-only, unauthenticated endpoints that let
// buyer/seller/web/Android clients discover the current feature-flag
// state managed by the Admin Control Center (Phase 5A).
package config

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/btmi-ai-market/backend/internal/repository"
)

type Handler struct {
	platformRepo repository.AdminPlatformRepository
}

func NewHandler(platformRepo repository.AdminPlatformRepository) *Handler {
	return &Handler{platformRepo: platformRepo}
}

// GET /api/v1/config/feature-flags?scope=BUYER
// Returns a flat {key: enabled} map for every flag matching scope (GLOBAL
// flags are always included). No admin auth — this is the public client
// contract. Only the key and its enabled state are exposed: no
// updated_by, audit, admin reasons, or other internal metadata.
func (h *Handler) GetFeatureFlags(c *gin.Context) {
	scope := c.Query("scope")

	flags, err := h.platformRepo.ListFeatureFlags(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load feature flags"})
		return
	}

	result := map[string]bool{}
	for _, f := range flags {
		if scope != "" && f.Scope != "GLOBAL" && f.Scope != scope {
			continue
		}
		result[f.Key] = f.Enabled
	}
	c.JSON(http.StatusOK, result)
}
