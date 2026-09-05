package admin_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/database"
	adminhandlers "github.com/btmi-ai-market/backend/internal/handlers/admin"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
)

func TestRealAdminLoginEndpoint(t *testing.T) {
	cfg := config.Load()
	db, err := database.Connect(
		cfg.DBHost, cfg.DBPort, cfg.DBName,
		cfg.DBUser, cfg.DBPassword,
	)
	if err != nil {
		t.Skipf("Skipping real DB test: database connection failed: %v", err)
	}
	defer db.Close()

	adminRepo := repository.NewAdminRepository(db)
	auditRepo := repository.NewAuditRepository(db)
	adminAuthService := service.NewAdminAuthService(adminRepo, cfg)
	auditService := service.NewAuditService(auditRepo)
	adminAuthHandler := adminhandlers.NewAuthHandler(adminAuthService, auditService)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/api/v1/admin/auth/login", adminAuthHandler.Login)

	// Fetch current super admin from DB
	superAdmin, err := adminRepo.GetFirstSuperAdmin()
	if err != nil {
		t.Fatalf("failed to fetch super admin: %v", err)
	}

	payload := map[string]string{
		"email":    superAdmin.Email,
		"password": "MyNewAdminPassword2026!",
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/auth/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	t.Logf("Response Code: %d", w.Code)
	t.Logf("Response Body: %s", w.Body.String())

	if w.Code != http.StatusOK {
		t.Fatalf("LOGIN TEST FAILED: expected 200 OK, got %d", w.Code)
	}

	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			AccessToken string            `json:"access_token"`
			TokenType   string            `json:"token_type"`
			Admin       *models.AdminUser `json:"admin"`
		} `json:"data"`
	}

	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse JSON response: %v", err)
	}

	if resp.Data.Admin == nil {
		t.Fatalf("expected admin user in response data, got nil")
	}

	if resp.Data.Admin.Role != models.AdminRoleSuperAdmin {
		t.Fatalf("expected role SUPER_ADMIN, got %s", resp.Data.Admin.Role)
	}

	if resp.Data.AccessToken == "" {
		t.Fatalf("expected non-empty access token")
	}

	t.Logf("LOGIN TEST PASSED: 200 OK, role = %s, token generated", resp.Data.Admin.Role)
}
