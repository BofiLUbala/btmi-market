package middleware

import (
	"net/http"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/gin-gonic/gin"
)

// RequireAdminRoles enforces that the authenticated admin possesses one of the allowed roles.
// SUPER_ADMIN is automatically granted bypass authorization for all operational routes.
func RequireAdminRoles(allowedRoles ...models.AdminRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("admin_role")
		if !exists {
			c.JSON(http.StatusUnauthorized, models.ErrorResponse{
				Error: struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				}{
					Code:    "UNAUTHORIZED",
					Message: "Missing admin identity context",
				},
			})
			c.Abort()
			return
		}

		currentRole, ok := roleVal.(models.AdminRole)
		if !ok {
			c.JSON(http.StatusForbidden, models.ErrorResponse{
				Error: struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				}{
					Code:    "FORBIDDEN",
					Message: "Invalid admin role context",
				},
			})
			c.Abort()
			return
		}

		// Super Admin bypass
		if currentRole == models.AdminRoleSuperAdmin {
			c.Next()
			return
		}

		// Match allowed roles
		for _, allowed := range allowedRoles {
			if currentRole == allowed {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "PERMISSION_DENIED",
				Message: "Your admin role (" + string(currentRole) + ") does not have permission for this resource",
			},
		})
		c.Abort()
	}
}
