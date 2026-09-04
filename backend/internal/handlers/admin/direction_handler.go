package admin

import (
	"net/http"
	"strconv"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type DirectionHandler struct {
	directionService *service.AdminDirectionService
	auditService     *service.AuditService
}

func NewDirectionHandler(directionService *service.AdminDirectionService, auditService *service.AuditService) *DirectionHandler {
	return &DirectionHandler{
		directionService: directionService,
		auditService:     auditService,
	}
}

func (h *DirectionHandler) Overview(c *gin.Context) {
	stats, err := h.directionService.GetOverviewStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Direction overview retrieved",
		Data:    stats,
	})
}

func (h *DirectionHandler) ListUsers(c *gin.Context) {
	search := c.Query("search")
	accountType := c.Query("account_type")
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	users, total, err := h.directionService.ListUsers(search, accountType, status, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Users retrieved successfully",
		"data": gin.H{
			"users":  users,
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

func (h *DirectionHandler) SuspendUser(c *gin.Context) {
	userIDStr := c.Param("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_ID",
				Message: "Invalid user UUID",
			},
		})
		return
	}

	var req models.UserStatusChangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_INPUT",
				Message: "Reason is required (minimum 5 characters)",
			},
		})
		return
	}

	adminID := c.MustGet("admin_id").(uuid.UUID)
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	ip := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")

	if err := h.directionService.SuspendUser(adminID, adminRole, userID, req.Reason, ip, userAgent); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "ACTION_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "User suspended successfully and all sessions revoked",
	})
}

func (h *DirectionHandler) ReactivateUser(c *gin.Context) {
	userIDStr := c.Param("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_ID",
				Message: "Invalid user UUID",
			},
		})
		return
	}

	var req models.UserStatusChangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_INPUT",
				Message: "Reason is required (minimum 5 characters)",
			},
		})
		return
	}

	adminID := c.MustGet("admin_id").(uuid.UUID)
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	ip := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")

	if err := h.directionService.ReactivateUser(adminID, adminRole, userID, req.Reason, ip, userAgent); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "ACTION_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "User reactivated successfully",
	})
}

func (h *DirectionHandler) ForceLogoutUser(c *gin.Context) {
	userIDStr := c.Param("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_ID",
				Message: "Invalid user UUID",
			},
		})
		return
	}

	var req models.UserStatusChangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_INPUT",
				Message: "Reason is required (minimum 5 characters)",
			},
		})
		return
	}

	adminID := c.MustGet("admin_id").(uuid.UUID)
	adminRole := c.MustGet("admin_role").(models.AdminRole)
	ip := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")

	if err := h.directionService.ForceLogoutUser(adminID, adminRole, userID, req.Reason, ip, userAgent); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "ACTION_FAILED",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "All sessions revoked for user",
	})
}

func (h *DirectionHandler) ListAuditLogs(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	role := c.Query("role")
	action := c.Query("action")
	targetType := c.Query("target_type")
	targetID := c.Query("target_id")

	filter := &models.AuditListFilter{
		Limit:  limit,
		Offset: offset,
	}
	if role != "" {
		filter.ActorRole = &role
	}
	if action != "" {
		filter.Action = &action
	}
	if targetType != "" {
		filter.TargetType = &targetType
	}
	if targetID != "" {
		filter.TargetID = &targetID
	}

	logs, total, err := h.auditService.List(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Audit logs retrieved successfully",
		"data": gin.H{
			"logs":   logs,
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}
