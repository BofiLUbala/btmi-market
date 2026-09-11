package middleware

import (
	"net/http"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func AuthMiddleware(authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, models.ErrorResponse{
				Error: struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				}{
					Code:    "UNAUTHORIZED",
					Message: "Authorization header is required",
				},
			})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.JSON(http.StatusUnauthorized, models.ErrorResponse{
				Error: struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				}{
					Code:    "UNAUTHORIZED",
					Message: "Authorization header must be Bearer {token}",
				},
			})
			c.Abort()
			return
		}

		tokenString := parts[1]
		token, err := authService.ValidateAccessToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, models.ErrorResponse{
				Error: struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				}{
					Code:    "UNAUTHORIZED",
					Message: "Invalid or expired access token",
				},
			})
			c.Abort()
			return
		}

		userID, err := authService.GetUserIDFromToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, models.ErrorResponse{
				Error: struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				}{
					Code:    "UNAUTHORIZED",
					Message: "Invalid token claims",
				},
			})
			c.Abort()
			return
		}

		c.Set("user_id", userID)
		c.Next()
	}
}

func OptionalAuthMiddleware(authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.Next()
			return
		}

		tokenString := parts[1]
		token, err := authService.ValidateAccessToken(tokenString)
		if err != nil {
			c.Next()
			return
		}

		userID, err := authService.GetUserIDFromToken(token)
		if err != nil {
			c.Next()
			return
		}

		c.Set("user_id", userID)
		c.Next()
	}
}

// RequireCourier is a middleware that requires the authenticated user to have an active courier profile.
func RequireCourier(courierService *service.CourierService) gin.HandlerFunc {
	return func(c *gin.Context) {
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
			c.Abort()
			return
		}

		if err := courierService.RequireActiveCourier(userID.(uuid.UUID)); err != nil {
			status := http.StatusForbidden
			code := "COURIER_ACCESS_DENIED"
			message := "Active courier profile required"

			switch err {
			case service.ErrCourierNotFound:
				status = http.StatusNotFound
				code = "COURIER_NOT_FOUND"
				message = "Courier profile not found"
			case service.ErrCourierSuspended:
				code = "COURIER_SUSPENDED"
				message = "Courier account is suspended"
			case service.ErrCourierNotActive:
				code = "COURIER_NOT_ACTIVE"
				message = "Courier account is not active"
			}

			c.JSON(status, models.ErrorResponse{
				Error: struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				}{
					Code:    code,
					Message: message,
				},
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
