package admin

import (
	"net/http"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AuthHandler struct {
	adminAuthService *service.AdminAuthService
	auditService     *service.AuditService
}

func NewAuthHandler(adminAuthService *service.AdminAuthService, auditService *service.AuditService) *AuthHandler {
	return &AuthHandler{
		adminAuthService: adminAuthService,
		auditService:     auditService,
	}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req models.AdminLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_INPUT",
				Message: err.Error(),
			},
		})
		return
	}

	ipAddress := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")

	resp, err := h.adminAuthService.Login(req.Email, req.Password, ipAddress, userAgent)
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UNAUTHORIZED",
				Message: err.Error(),
			},
		})
		return
	}

	// Audit successful admin login
	_ = h.auditService.Record(
		resp.Admin.ID,
		resp.Admin.Role,
		"ADMIN_LOGIN_SUCCESS",
		"ADMIN_USER",
		resp.Admin.ID.String(),
		"Admin session initiated",
		nil,
		nil,
		ipAddress,
		userAgent,
	)

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Login successful",
		Data:    resp,
	})
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req models.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_INPUT",
				Message: err.Error(),
			},
		})
		return
	}

	ipAddress := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")

	resp, err := h.adminAuthService.RefreshToken(req.RefreshToken, ipAddress, userAgent)
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UNAUTHORIZED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Token refreshed successfully",
		Data:    resp,
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	var req models.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_INPUT",
				Message: err.Error(),
			},
		})
		return
	}

	_ = h.adminAuthService.Logout(req.RefreshToken)

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Logged out successfully",
	})
}

func (h *AuthHandler) Me(c *gin.Context) {
	adminIDVal, exists := c.Get("admin_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UNAUTHORIZED",
				Message: "Unauthorized",
			},
		})
		return
	}

	adminID, ok := adminIDVal.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: "Invalid admin context",
			},
		})
		return
	}

	admin, err := h.adminAuthService.GetAdminByID(adminID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "NOT_FOUND",
				Message: "Admin not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Current admin retrieved",
		Data:    admin,
	})
}
