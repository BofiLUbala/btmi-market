package auth

import (
	"net/http"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	authService     *service.AuthService
	employeeService *service.EmployeeService
}

func NewHandler(authService *service.AuthService, employeeService *service.EmployeeService) *Handler {
	return &Handler{authService: authService, employeeService: employeeService}
}

func (h *Handler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid request body: " + err.Error(),
			},
		})
		return
	}

	user, err := h.authService.Register(&req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "EMAIL_ALREADY_EXISTS":
			statusCode = http.StatusConflict
			errorCode = "EMAIL_ALREADY_EXISTS"
		case "PHONE_ALREADY_EXISTS":
			statusCode = http.StatusConflict
			errorCode = "PHONE_ALREADY_EXISTS"
		case "PASSWORD_CONFIRMATION_MISMATCH":
			statusCode = http.StatusBadRequest
			errorCode = "PASSWORD_CONFIRMATION_MISMATCH"
		case "PASSWORD_TOO_WEAK":
			statusCode = http.StatusBadRequest
			errorCode = "PASSWORD_TOO_WEAK"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Account created. Please activate your account.",
		Data: map[string]interface{}{
			"user_id": user.ID.String(),
		},
	})
}

func (h *Handler) RegisterSeller(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid request body: " + err.Error(),
			},
		})
		return
	}

	user, err := h.authService.RegisterSeller(&req)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "EMAIL_ALREADY_EXISTS":
			statusCode = http.StatusConflict
			errorCode = "EMAIL_ALREADY_EXISTS"
		case "PHONE_ALREADY_EXISTS":
			statusCode = http.StatusConflict
			errorCode = "PHONE_ALREADY_EXISTS"
		case "PASSWORD_CONFIRMATION_MISMATCH":
			statusCode = http.StatusBadRequest
			errorCode = "PASSWORD_CONFIRMATION_MISMATCH"
		case "PASSWORD_TOO_WEAK":
			statusCode = http.StatusBadRequest
			errorCode = "PASSWORD_TOO_WEAK"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{
		Message: "Seller account created. Please activate your account.",
		Data: map[string]interface{}{
			"user_id": user.ID.String(),
		},
	})
}

func (h *Handler) Activate(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Token is required",
			},
		})
		return
	}

	err := h.authService.ActivateAccount(token)
	if err != nil {
		statusCode := http.StatusBadRequest
		errorCode := "INVALID_REQUEST"

		switch err.Error() {
		case "ACTIVATION_LINK_INVALID":
			statusCode = http.StatusNotFound
			errorCode = "ACTIVATION_LINK_INVALID"
		case "ACTIVATION_LINK_EXPIRED":
			statusCode = http.StatusGone
			errorCode = "ACTIVATION_LINK_EXPIRED"
		case "ACTIVATION_LINK_ALREADY_USED":
			statusCode = http.StatusConflict
			errorCode = "ACTIVATION_LINK_ALREADY_USED"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Account activated successfully. You can now login.",
	})
}

func (h *Handler) ResendActivation(c *gin.Context) {
	var req models.ResendActivationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid request body: " + err.Error(),
			},
		})
		return
	}

	err := h.authService.ResendActivation(req.Email)
	if err != nil {
		statusCode := http.StatusInternalServerError
		errorCode := "INTERNAL_ERROR"

		switch err.Error() {
		case "USER_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "USER_NOT_FOUND"
		case "ACCOUNT_ALREADY_ACTIVE":
			statusCode = http.StatusConflict
			errorCode = "ACCOUNT_ALREADY_ACTIVE"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Activation email sent. Please check your inbox.",
	})
}

func (h *Handler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid request body: " + err.Error(),
			},
		})
		return
	}

	userAgent := c.GetHeader("User-Agent")
	ipAddress := c.ClientIP()

	response, err := h.authService.Login(req.Email, req.Password, userAgent, ipAddress)
	if err != nil {
		statusCode := http.StatusUnauthorized
		errorCode := "INVALID_CREDENTIALS"

		switch err.Error() {
		case "ACCOUNT_NOT_ACTIVATED":
			statusCode = http.StatusForbidden
			errorCode = "ACCOUNT_NOT_ACTIVATED"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) Refresh(c *gin.Context) {
	var req models.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid request body: " + err.Error(),
			},
		})
		return
	}

	userAgent := c.GetHeader("User-Agent")
	ipAddress := c.ClientIP()

	response, err := h.authService.RefreshToken(req.RefreshToken, userAgent, ipAddress)
	if err != nil {
		statusCode := http.StatusUnauthorized
		errorCode := "INVALID_REFRESH_TOKEN"

		switch err.Error() {
		case "REFRESH_TOKEN_REVOKED":
			errorCode = "REFRESH_TOKEN_REVOKED"
		case "REFRESH_TOKEN_EXPIRED":
			errorCode = "REFRESH_TOKEN_EXPIRED"
		case "ACCOUNT_NOT_ACTIVATED":
			statusCode = http.StatusForbidden
			errorCode = "ACCOUNT_NOT_ACTIVATED"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) Logout(c *gin.Context) {
	var req models.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid request body: " + err.Error(),
			},
		})
		return
	}

	err := h.authService.Logout(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INTERNAL_ERROR",
				Message: "Failed to logout",
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Logged out successfully",
	})
}

func (h *Handler) Me(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "UNAUTHORIZED",
				Message: "User not authenticated",
			},
		})
		return
	}

	user, err := h.authService.GetUserByID(userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "USER_NOT_FOUND",
				Message: "User not found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Current user retrieved successfully",
		Data:    user,
	})
}

func (h *Handler) AcceptEmployeeInvitation(c *gin.Context) {
	var req models.AcceptEmployeeInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "INVALID_REQUEST",
				Message: "Invalid request body: " + err.Error(),
			},
		})
		return
	}

	user, err := h.employeeService.AcceptEmployeeInvitation(&req)
	if err != nil {
		statusCode := http.StatusBadRequest
		errorCode := "INVALID_REQUEST"

		switch err.Error() {
		case "PASSWORD_CONFIRMATION_MISMATCH":
			statusCode = http.StatusBadRequest
			errorCode = "PASSWORD_CONFIRMATION_MISMATCH"
		case "PASSWORD_TOO_WEAK":
			statusCode = http.StatusBadRequest
			errorCode = "PASSWORD_TOO_WEAK"
		case "INVALID_INVITATION":
			statusCode = http.StatusNotFound
			errorCode = "INVALID_INVITATION"
		case "INVITATION_EXPIRED":
			statusCode = http.StatusGone
			errorCode = "INVITATION_EXPIRED"
		case "EMAIL_ALREADY_EXISTS":
			statusCode = http.StatusConflict
			errorCode = "EMAIL_ALREADY_EXISTS"
		case "EMPLOYEE_NOT_FOUND":
			statusCode = http.StatusNotFound
			errorCode = "EMPLOYEE_NOT_FOUND"
		}

		c.JSON(statusCode, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    errorCode,
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Employee account activated successfully. You can now login.",
		Data: map[string]interface{}{
			"user_id": user.ID.String(),
		},
	})
}
