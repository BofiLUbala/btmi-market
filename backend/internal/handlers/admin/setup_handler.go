package admin

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
)

// SetupHandler serves the super admin's own account setup: the owner enters
// the one-time code he was given, his name, e-mail and password, and is signed
// in straight away. See service.AdminSetupService.
type SetupHandler struct {
	setup *service.AdminSetupService
	auth  *service.AdminAuthService
}

func NewSetupHandler(setup *service.AdminSetupService, auth *service.AdminAuthService) *SetupHandler {
	return &SetupHandler{setup: setup, auth: auth}
}

type superAdminSetupRequest struct {
	SetupCode string `json:"setup_code" binding:"required"`
	Name      string `json:"name" binding:"required"`
	Email     string `json:"email" binding:"required"`
	Password  string `json:"password" binding:"required"`
}

func setupError(c *gin.Context, status int, code string) {
	c.JSON(status, models.ErrorResponse{
		Error: struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}{Code: code, Message: code},
	})
}

// Status tells the sign-in screen whether to offer the setup.
func (h *SetupHandler) Status(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"available": h.setup.Available()})
}

// Setup creates or takes over the super admin account, then signs it in.
func (h *SetupHandler) Setup(c *gin.Context) {
	var req superAdminSetupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		setupError(c, http.StatusBadRequest, "INVALID_INPUT")
		return
	}

	email, created, err := h.setup.Claim(req.SetupCode, req.Name, req.Email, req.Password)
	switch {
	case err == nil:
	case errors.Is(err, service.ErrSetupUnavailable), errors.Is(err, repository.ErrSetupCodeUsed):
		setupError(c, http.StatusGone, "SETUP_UNAVAILABLE")
		return
	case errors.Is(err, service.ErrSetupCodeInvalid):
		setupError(c, http.StatusForbidden, "SETUP_CODE_INVALID")
		return
	case errors.Is(err, repository.ErrAdminEmailTaken):
		setupError(c, http.StatusConflict, "EMAIL_ALREADY_EXISTS")
		return
	case strings.ToUpper(err.Error()) == err.Error() && !strings.ContainsAny(err.Error(), " :"):
		setupError(c, http.StatusBadRequest, err.Error())
		return
	default:
		log.Printf("[admin-setup] claim failed: %v", err)
		setupError(c, http.StatusInternalServerError, "INTERNAL_ERROR")
		return
	}

	resp, err := h.auth.Login(email, req.Password, c.ClientIP(), c.GetHeader("User-Agent"))
	if err != nil {
		// The account is set up; only the automatic sign-in failed.
		c.JSON(http.StatusCreated, models.SuccessResponse{Message: "Super admin account ready", Data: gin.H{"created": created}})
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Super admin account ready", Data: resp})
}
