package service_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/middleware"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func TestAdminJWTValidationAndAudienceSegregation(t *testing.T) {
	cfg := &config.Config{
		JWTSecret: "test-super-secret-key-32-bytes-long!!",
	}
	adminAuthService := service.NewAdminAuthService(nil, cfg)

	adminID := uuid.New()

	// 1. Valid Admin Token with aud: "admin"
	validClaims := &models.AdminClaims{
		AdminID: adminID,
		Email:   "admin@tbkmarket.com",
		Role:    models.AdminRoleSuperAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   adminID.String(),
			Audience:  jwt.ClaimStrings{"admin"},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
		},
	}
	validToken := jwt.NewWithClaims(jwt.SigningMethodHS256, validClaims)
	validTokenStr, err := validToken.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		t.Fatalf("Failed to sign valid token: %v", err)
	}

	claims, err := adminAuthService.ValidateAccessToken(validTokenStr)
	if err != nil {
		t.Fatalf("Expected valid token to pass, got error: %v", err)
	}
	if claims.Role != models.AdminRoleSuperAdmin {
		t.Errorf("Expected role SUPER_ADMIN, got: %v", claims.Role)
	}

	// 2. Buyer/Seller Token (Missing "admin" audience)
	buyerClaims := jwt.MapClaims{
		"sub":  adminID.String(),
		"role": "BUYER",
		"aud":  "marketplace",
		"exp":  time.Now().Add(1 * time.Hour).Unix(),
	}
	buyerToken := jwt.NewWithClaims(jwt.SigningMethodHS256, buyerClaims)
	buyerTokenStr, err := buyerToken.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		t.Fatalf("Failed to sign buyer token: %v", err)
	}

	_, err = adminAuthService.ValidateAccessToken(buyerTokenStr)
	if err == nil {
		t.Fatalf("Expected buyer token to be REJECTED on admin endpoint, but it passed!")
	}
}

func TestAdminRBACMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name         string
		adminRole    models.AdminRole
		allowedRoles []models.AdminRole
		expectedCode int
	}{
		{
			name:         "Super Admin accessing Direction",
			adminRole:    models.AdminRoleSuperAdmin,
			allowedRoles: []models.AdminRole{models.AdminRoleDirectionAdmin},
			expectedCode: http.StatusOK,
		},
		{
			name:         "Direction Admin accessing Direction",
			adminRole:    models.AdminRoleDirectionAdmin,
			allowedRoles: []models.AdminRole{models.AdminRoleDirectionAdmin},
			expectedCode: http.StatusOK,
		},
		{
			name:         "Commerce Admin accessing Direction (Forbidden)",
			adminRole:    models.AdminRoleCommerceAdmin,
			allowedRoles: []models.AdminRole{models.AdminRoleDirectionAdmin},
			expectedCode: http.StatusForbidden,
		},
		{
			name:         "Finance Admin accessing Technical (Forbidden)",
			adminRole:    models.AdminRoleFinanceSupportAdmin,
			allowedRoles: []models.AdminRole{models.AdminRoleTechnicalAdmin},
			expectedCode: http.StatusForbidden,
		},
		{
			name:         "Technical Admin accessing Technical (Allowed)",
			adminRole:    models.AdminRoleTechnicalAdmin,
			allowedRoles: []models.AdminRole{models.AdminRoleTechnicalAdmin},
			expectedCode: http.StatusOK,
		},
		{
			name:         "Commerce Admin accessing Commerce (Allowed)",
			adminRole:    models.AdminRoleCommerceAdmin,
			allowedRoles: []models.AdminRole{models.AdminRoleCommerceAdmin, models.AdminRoleDirectionAdmin},
			expectedCode: http.StatusOK,
		},
		{
			name:         "Finance Admin accessing Commerce (Forbidden)",
			adminRole:    models.AdminRoleFinanceSupportAdmin,
			allowedRoles: []models.AdminRole{models.AdminRoleCommerceAdmin, models.AdminRoleDirectionAdmin},
			expectedCode: http.StatusForbidden,
		},
		{
			name:         "Direction Admin accessing Commerce (Allowed Read)",
			adminRole:    models.AdminRoleDirectionAdmin,
			allowedRoles: []models.AdminRole{models.AdminRoleCommerceAdmin, models.AdminRoleDirectionAdmin},
			expectedCode: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := gin.New()
			r.Use(func(c *gin.Context) {
				c.Set("admin_id", uuid.New())
				c.Set("admin_role", tt.adminRole)
				c.Next()
			})
			r.GET("/protected", middleware.RequireAdminRoles(tt.allowedRoles...), func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"status": "ok"})
			})

			req := httptest.NewRequest(http.MethodGet, "/protected", nil)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != tt.expectedCode {
				t.Errorf("Test '%s': expected HTTP %d, got %d", tt.name, tt.expectedCode, w.Code)
			}
		})
	}
}
