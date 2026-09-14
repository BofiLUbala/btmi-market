package locations

import (
	"net/http"

	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Handler exposes the RDC administrative hierarchy that checkout, buyer
// profiles and shop onboarding all select their addresses from.
type Handler struct {
	repo *repository.LocationRepository
}

func NewHandler(repo *repository.LocationRepository) *Handler {
	return &Handler{repo: repo}
}

// GET /api/v1/locations/provinces
func (h *Handler) ListProvinces(c *gin.Context) {
	items, err := h.repo.ListProvinces()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load provinces"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// GET /api/v1/locations/provinces/:province_id/cities
func (h *Handler) ListCities(c *gin.Context) {
	provinceID, err := uuid.Parse(c.Param("province_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid province id"})
		return
	}
	items, err := h.repo.ListCities(provinceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load cities"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

// GET /api/v1/locations/cities/:city_id/communes
func (h *Handler) ListCommunes(c *gin.Context) {
	cityID, err := uuid.Parse(c.Param("city_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid city id"})
		return
	}
	items, err := h.repo.ListCommunes(cityID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load communes"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}
