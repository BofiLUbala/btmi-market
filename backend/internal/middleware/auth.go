package middleware

import (
	"net/http"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
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
