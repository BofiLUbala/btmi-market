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

func TestAdminLoginEndpoint_SecurityAndErrors(t *testing.T) {
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

	t.Run("Fails with 401 for non-existent admin email", func(t *testing.T) {
		payload := map[string]string{
			"email":    "nonexistent.admin@tbk.market",
			"password": "AnyRandomPassword123!",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/auth/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 Unauthorized, got %d", w.Code)
		}

		var errResp models.ErrorResponse
		if err := json.Unmarshal(w.Body.Bytes(), &errResp); err != nil {
			t.Fatalf("failed to parse error JSON: %v", err)
		}
		if errResp.Error.Code != "UNAUTHORIZED" {
			t.Errorf("expected error code UNAUTHORIZED, got %s", errResp.Error.Code)
		}
	})

	t.Run("Fails with 401 for incorrect password on existing admin", func(t *testing.T) {
		superAdmin, err := adminRepo.GetFirstSuperAdmin()
		if err != nil {
			t.Skipf("no super admin found in DB: %v", err)
		}

		payload := map[string]string{
			"email":    superAdmin.Email,
			"password": "DefinitelyIncorrectPassword999!",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/auth/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 Unauthorized, got %d", w.Code)
		}
	})

	t.Run("Fails with 400 for malformed input", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/auth/login", bytes.NewBufferString("{bad json}"))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request, got %d", w.Code)
		}
	})
}
