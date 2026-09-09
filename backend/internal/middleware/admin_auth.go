package middleware

import (
	"net/http"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
)

func AdminAuthMiddleware(adminAuthService *service.AdminAuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, models.ErrorResponse{
				Error: struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				}{
					Code:    "UNAUTHORIZED",
					Message: "Admin authorization header is required",
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
		claims, err := adminAuthService.ValidateAccessToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, models.ErrorResponse{
				Error: struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				}{
					Code:    "UNAUTHORIZED",
					Message: "Invalid or expired admin access token",
				},
			})
			c.Abort()
			return
		}

		// Resolve status and role from the database on every request. A signed
		// token can outlive a suspension or role change; authorization must not.
		admin, err := adminAuthService.GetAdminByID(claims.AdminID)
		if err != nil || admin.Status != models.AdminStatusActive || !adminAuthService.IsSessionVersionCurrent(claims.AdminID, claims.SessionVersion) {
			c.JSON(http.StatusUnauthorized, models.ErrorResponse{
				Error: struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				}{Code: "UNAUTHORIZED", Message: "Administrator account is unavailable or inactive"},
			})
			c.Abort()
			return
		}

		c.Set("admin_id", admin.ID)
		c.Set("admin_email", admin.Email)
		c.Set("admin_role", admin.Role)
		c.Next()
	}
}
