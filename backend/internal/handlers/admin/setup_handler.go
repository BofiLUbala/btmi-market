package admin

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
)

// SetupHandler serves the super admin's own account setup: the owner enters
// the one-time code he was given with his name, e-mail and password, then
// activates the account from the link e-mailed to that address.
// See service.AdminSetupService.
type SetupHandler struct {
	setup        *service.AdminSetupService
	auditService *service.AuditService
}

func NewSetupHandler(setup *service.AdminSetupService, auditService *service.AuditService) *SetupHandler {
	return &SetupHandler{setup: setup, auditService: auditService}
}

type superAdminSetupRequest struct {
	SetupCode string `json:"setup_code" binding:"required"`
	Name      string `json:"name" binding:"required"`
	Email     string `json:"email" binding:"required"`
	Password  string `json:"password" binding:"required"`
}

type superAdminActivateRequest struct {
	Token string `json:"token" binding:"required"`
}

func setupError(c *gin.Context, status int, code string) {
	c.JSON(status, models.ErrorResponse{
		Error: struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}{Code: code, Message: code},
	})
}

// failSetup maps a service error onto the status and code the console shows.
func failSetup(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrSetupUnavailable), errors.Is(err, repository.ErrSetupCodeUsed):
		setupError(c, http.StatusGone, "SETUP_UNAVAILABLE")
	case errors.Is(err, service.ErrSetupCodeInvalid):
		setupError(c, http.StatusForbidden, "SETUP_CODE_INVALID")
	case errors.Is(err, service.ErrSetupLinkInvalid):
		setupError(c, http.StatusBadRequest, "INVALID_SETUP_LINK")
	case errors.Is(err, service.ErrSetupLinkExpired):
		setupError(c, http.StatusGone, "SETUP_LINK_EXPIRED")
	case errors.Is(err, service.ErrSetupAlreadyActive):
		setupError(c, http.StatusConflict, "ADMIN_ALREADY_ACTIVATED")
	case errors.Is(err, repository.ErrAdminEmailTaken):
		setupError(c, http.StatusConflict, "EMAIL_ALREADY_EXISTS")
	case strings.ToUpper(err.Error()) == err.Error() && !strings.ContainsAny(err.Error(), " :"):
		setupError(c, http.StatusBadRequest, err.Error())
	default:
		log.Printf("[admin-setup] %v", err)
		setupError(c, http.StatusInternalServerError, "INTERNAL_ERROR")
	}
}

// Status tells the sign-in screen whether to offer the setup.
func (h *SetupHandler) Status(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"available": h.setup.Available()})
}

// Setup spends the code on a pending super admin and e-mails the activation
// link. The account is not usable until that link is followed.
func (h *SetupHandler) Setup(c *gin.Context) {
	var req superAdminSetupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		setupError(c, http.StatusBadRequest, "INVALID_INPUT")
		return
	}

	email, first, err := h.setup.Start(req.SetupCode, req.Name, req.Email, req.Password)
	if err != nil {
		failSetup(c, err)
		return
	}

	c.JSON(http.StatusAccepted, models.SuccessResponse{
		Message: "Activation link sent",
		Data:    gin.H{"email": email, "first_super_admin": first},
	})
}

// VerifyActivation lets the activation page show who the link belongs to
// before the owner confirms.
func (h *SetupHandler) VerifyActivation(c *gin.Context) {
	admin, err := h.setup.Verify(c.Query("token"))
	if err != nil {
		failSetup(c, err)
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Data: gin.H{
		"first_name": admin.FirstName,
		"last_name":  admin.LastName,
		"email":      admin.Email,
		"role":       admin.Role,
	}})
}

// Activate makes the pending account the one super admin. The owner then signs
// in with the password he chose on the setup screen.
func (h *SetupHandler) Activate(c *gin.Context) {
	var req superAdminActivateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		setupError(c, http.StatusBadRequest, "INVALID_INPUT")
		return
	}

	admin, err := h.setup.Activate(req.Token)
	if err != nil {
		failSetup(c, err)
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Super admin account ready",
		Data:    gin.H{"email": admin.Email},
	})
}

// CodeStatus is what the Admin Users page shows about the current setup code:
// whether one is open and until when, never the code itself.
func (h *SetupHandler) CodeStatus(c *gin.Context) {
	c.JSON(http.StatusOK, models.SuccessResponse{Data: h.setup.Status()})
}

// IssueCode hands the super admin a fresh code to pass on, shown once.
func (h *SetupHandler) IssueCode(c *gin.Context) {
	actorID := c.MustGet("admin_id").(uuid.UUID)
	code, expiresAt, err := h.setup.IssueCode(actorID)
	if err != nil {
		log.Printf("[admin-setup] issuing a code failed: %v", err)
		setupError(c, http.StatusInternalServerError, "INTERNAL_ERROR")
		return
	}

	h.audit(c, actorID, "SUPER_ADMIN_SETUP_CODE_ISSUED", "Issued a super admin setup code")
	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Setup code issued",
		Data:    gin.H{"code": code, "expires_at": expiresAt},
	})
}

// RevokeCode closes the open code without issuing another.
func (h *SetupHandler) RevokeCode(c *gin.Context) {
	actorID := c.MustGet("admin_id").(uuid.UUID)
	if err := h.setup.RevokeCodes(); err != nil {
		log.Printf("[admin-setup] revoking the code failed: %v", err)
		setupError(c, http.StatusInternalServerError, "INTERNAL_ERROR")
		return
	}

	h.audit(c, actorID, "SUPER_ADMIN_SETUP_CODE_REVOKED", "Revoked the super admin setup code")
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Setup code revoked"})
}

// audit records who opened or closed the door to the super admin account. The
// code never appears in the trail.
func (h *SetupHandler) audit(c *gin.Context, actorID uuid.UUID, action, reason string) {
	if h.auditService == nil {
		return
	}
	role, _ := c.Get("admin_role")
	actorRole, _ := role.(models.AdminRole)
	_ = h.auditService.Record(actorID, actorRole, action, "admin_user", actorID.String(), reason,
		nil, nil, c.ClientIP(), c.GetHeader("User-Agent"))
}
