package admin

import (
	"errors"
	"net/http"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func adminActor(c *gin.Context) (uuid.UUID, models.AdminRole) {
	idVal, _ := c.Get("admin_id")
	roleVal, _ := c.Get("admin_role")
	id, _ := idVal.(uuid.UUID)
	role, _ := roleVal.(models.AdminRole)
	return id, role
}

func searchAdminError(c *gin.Context, status int, code, message string) {
	c.JSON(status, models.ErrorResponse{Error: struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}{Code: code, Message: message}})
}

// GET /api/v1/admin/commerce/search/synonyms
func (h *CommerceHandler) ListSearchSynonyms(c *gin.Context) {
	items, err := h.commerceService.ListSearchSynonyms()
	if err != nil {
		searchAdminError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Search synonyms", Data: items})
}

// PUT /api/v1/admin/commerce/search/synonyms
func (h *CommerceHandler) UpsertSearchSynonym(c *gin.Context) {
	var req models.UpsertSearchSynonymRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		searchAdminError(c, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}
	id, role := adminActor(c)
	syn, err := h.commerceService.UpsertSearchSynonym(id, role, &req, c.ClientIP(), c.Request.UserAgent())
	if errors.Is(err, service.ErrInvalidSynonym) {
		searchAdminError(c, http.StatusBadRequest, "INVALID_SYNONYM", "Term and group are required (letters and digits, 60 characters max).")
		return
	}
	if err != nil {
		searchAdminError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Search synonym saved", Data: syn})
}

// DELETE /api/v1/admin/commerce/search/synonyms/:term
func (h *CommerceHandler) DeleteSearchSynonym(c *gin.Context) {
	id, role := adminActor(c)
	deleted, err := h.commerceService.DeleteSearchSynonym(id, role, c.Param("term"), c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		searchAdminError(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	if !deleted {
		searchAdminError(c, http.StatusNotFound, "NOT_FOUND", "Synonym not found.")
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Search synonym deleted"})
}
