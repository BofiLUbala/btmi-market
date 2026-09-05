package admin

import (
	"net/http"
	"strconv"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AdminManagementHandler struct {
	managementService *service.AdminManagementService
}

func NewAdminManagementHandler(managementService *service.AdminManagementService) *AdminManagementHandler {
	return &AdminManagementHandler{managementService: managementService}
}

func errResp(code, message string) models.ErrorResponse {
	return models.ErrorResponse{
		Error: struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}{Code: code, Message: message},
	}
}

func (h *AdminManagementHandler) ListAdmins(c *gin.Context) {
	role := c.Query("role")
	status := c.Query("status")
	search := c.Query("search")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	items, total, err := h.managementService.ListAdmins(role, status, search, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errResp("INTERNAL_ERROR", err.Error()))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Admin users retrieved successfully",
		"data": gin.H{
			"admins": items,
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

func (h *AdminManagementHandler) InviteAdmin(c *gin.Context) {
	var req models.InviteAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errResp("INVALID_INPUT", "First name, last name, professional email and role are required"))
		return
	}

	actorID := c.MustGet("admin_id").(uuid.UUID)
	actorRole := c.MustGet("admin_role").(models.AdminRole)

	admin, _, err := h.managementService.InviteAdmin(actorID, actorRole, &req, c.ClientIP(), c.GetHeader("User-Agent"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errResp("INVITE_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Invitation sent successfully",
		Data:    admin,
	})
}

func (h *AdminManagementHandler) ResendInvitation(c *gin.Context) {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errResp("INVALID_ID", "Invalid admin UUID"))
		return
	}

	actorID := c.MustGet("admin_id").(uuid.UUID)
	actorRole := c.MustGet("admin_role").(models.AdminRole)

	if err := h.managementService.ResendInvitation(actorID, actorRole, targetID, c.ClientIP(), c.GetHeader("User-Agent")); err != nil {
		c.JSON(http.StatusBadRequest, errResp("ACTION_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Invitation resent successfully"})
}

func (h *AdminManagementHandler) SuspendAdmin(c *gin.Context) {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errResp("INVALID_ID", "Invalid admin UUID"))
		return
	}
	var req models.AdminActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errResp("INVALID_INPUT", "Reason is required (minimum 5 characters)"))
		return
	}

	actorID := c.MustGet("admin_id").(uuid.UUID)
	actorRole := c.MustGet("admin_role").(models.AdminRole)

	if err := h.managementService.SuspendAdmin(actorID, actorRole, targetID, req.Reason, c.ClientIP(), c.GetHeader("User-Agent")); err != nil {
		c.JSON(http.StatusBadRequest, errResp("ACTION_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Admin suspended successfully and all sessions revoked"})
}

func (h *AdminManagementHandler) ReactivateAdmin(c *gin.Context) {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errResp("INVALID_ID", "Invalid admin UUID"))
		return
	}
	var req models.AdminActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errResp("INVALID_INPUT", "Reason is required (minimum 5 characters)"))
		return
	}

	actorID := c.MustGet("admin_id").(uuid.UUID)
	actorRole := c.MustGet("admin_role").(models.AdminRole)

	if err := h.managementService.ReactivateAdmin(actorID, actorRole, targetID, req.Reason, c.ClientIP(), c.GetHeader("User-Agent")); err != nil {
		c.JSON(http.StatusBadRequest, errResp("ACTION_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Admin reactivated successfully"})
}

func (h *AdminManagementHandler) ForceLogoutAdmin(c *gin.Context) {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errResp("INVALID_ID", "Invalid admin UUID"))
		return
	}
	var req models.AdminActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errResp("INVALID_INPUT", "Reason is required (minimum 5 characters)"))
		return
	}

	actorID := c.MustGet("admin_id").(uuid.UUID)
	actorRole := c.MustGet("admin_role").(models.AdminRole)

	if err := h.managementService.ForceLogoutAdmin(actorID, actorRole, targetID, req.Reason, c.ClientIP(), c.GetHeader("User-Agent")); err != nil {
		c.JSON(http.StatusBadRequest, errResp("ACTION_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{Message: "All sessions revoked for admin"})
}

func (h *AdminManagementHandler) ChangeAdminRole(c *gin.Context) {
	targetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errResp("INVALID_ID", "Invalid admin UUID"))
		return
	}
	var req models.ChangeAdminRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errResp("INVALID_INPUT", "A valid role and a reason (minimum 5 characters) are required"))
		return
	}

	actorID := c.MustGet("admin_id").(uuid.UUID)
	actorRole := c.MustGet("admin_role").(models.AdminRole)

	if err := h.managementService.ChangeAdminRole(actorID, actorRole, targetID, &req, c.ClientIP(), c.GetHeader("User-Agent")); err != nil {
		c.JSON(http.StatusBadRequest, errResp("ACTION_FAILED", err.Error()))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Admin role updated successfully"})
}

// VerifyInvitation is public: the activation page calls it to render the
// invited admin's name/role before asking them to set a password.
func (h *AdminManagementHandler) VerifyInvitation(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, errResp("INVALID_INPUT", "Token is required"))
		return
	}

	admin, err := h.managementService.VerifyInvitation(token)
	if err != nil {
		c.JSON(http.StatusBadRequest, errResp(err.Error(), "Invitation is invalid or has expired"))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Invitation is valid",
		Data: gin.H{
			"first_name": admin.FirstName,
			"last_name":  admin.LastName,
			"email":      admin.Email,
			"role":       admin.Role,
		},
	})
}

// ActivateAdmin is public: the invited admin sets their own password here.
func (h *AdminManagementHandler) ActivateAdmin(c *gin.Context) {
	var req models.ActivateAdminRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errResp("INVALID_INPUT", "Token, password and password confirmation are required"))
		return
	}

	admin, err := h.managementService.ActivateAdmin(&req, c.ClientIP(), c.GetHeader("User-Agent"))
	if err != nil {
		c.JSON(http.StatusBadRequest, errResp(err.Error(), "Could not activate account"))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Account activated successfully. You may now sign in at /admin/login.",
		Data:    gin.H{"email": admin.Email, "role": admin.Role},
	})
}
