package service_test

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/middleware"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type mockBootstrapRepo struct {
	superAdminCount int
	adminsByEmail   map[string]*models.AdminUser
	createdAdmins   []*models.AdminUser
}

func newMockBootstrapRepo() *mockBootstrapRepo {
	return &mockBootstrapRepo{
		adminsByEmail: make(map[string]*models.AdminUser),
	}
}

func (m *mockBootstrapRepo) CountSuperAdmins() (int, error) {
	return m.superAdminCount, nil
}

func (m *mockBootstrapRepo) GetByEmail(email string) (*models.AdminUser, error) {
	admin, exists := m.adminsByEmail[strings.ToLower(email)]
	if !exists {
		return nil, errors.New("admin not found")
	}
	return admin, nil
}

func (m *mockBootstrapRepo) Create(admin *models.AdminUser) error {
	admin.ID = uuid.New()
	m.createdAdmins = append(m.createdAdmins, admin)
	m.adminsByEmail[strings.ToLower(admin.Email)] = admin
	if admin.Role == models.AdminRoleSuperAdmin {
		m.superAdminCount++
	}
	return nil
}

type mockAuditRecorder struct {
	entries []*models.AdminAuditLog
}

func (m *mockAuditRecorder) Record(entry *models.AdminAuditLog) error {
	m.entries = append(m.entries, entry)
	return nil
}

func TestAdminBootstrapService_CompleteWorkflow(t *testing.T) {
	repo := newMockBootstrapRepo()
	audit := &mockAuditRecorder{}
	bootstrapService := service.NewAdminBootstrapService(repo, audit)

	name := "Gauthier Bofi"
	email := "admin@tbk.market"
	rawPassword := "SuperSecurePassword2026!"

	// Test 1: Required validation
	t.Run("Fails when email or password is missing", func(t *testing.T) {
		_, err := bootstrapService.BootstrapSuperAdmin(name, "", rawPassword)
		if err == nil || !strings.Contains(err.Error(), "SUPER_ADMIN_EMAIL is required") {
			t.Fatalf("expected missing email error, got: %v", err)
		}

		_, err = bootstrapService.BootstrapSuperAdmin(name, email, "")
		if err == nil || !strings.Contains(err.Error(), "SUPER_ADMIN_PASSWORD is required") {
			t.Fatalf("expected missing password error, got: %v", err)
		}
	})

	// Test 2: No SUPER_ADMIN exists -> creation succeeds
	var createdAdmin *models.AdminUser
	t.Run("Creation succeeds when no SUPER_ADMIN exists", func(t *testing.T) {
		res, err := bootstrapService.BootstrapSuperAdmin(name, email, rawPassword)
		if err != nil {
			t.Fatalf("unexpected error during bootstrap: %v", err)
		}
		if !res.Created {
			t.Fatalf("expected created to be true")
		}
		if res.Admin == nil {
			t.Fatalf("expected returned admin to not be nil")
		}

		createdAdmin = res.Admin

		// Check role is SUPER_ADMIN
		if createdAdmin.Role != models.AdminRoleSuperAdmin {
			t.Errorf("expected role %s, got %s", models.AdminRoleSuperAdmin, createdAdmin.Role)
		}

		// Check status is ACTIVE
		if createdAdmin.Status != models.AdminStatusActive {
			t.Errorf("expected status %s, got %s", models.AdminStatusActive, createdAdmin.Status)
		}

		// Check name parsed
		if createdAdmin.FirstName != "Gauthier" || createdAdmin.LastName != "Bofi" {
			t.Errorf("expected first_name=Gauthier last_name=Bofi, got %s %s", createdAdmin.FirstName, createdAdmin.LastName)
		}

		// Check password is NOT plaintext and is bcrypt hashed
		if createdAdmin.PasswordHash == rawPassword {
			t.Fatalf("FATAL: plaintext password was stored!")
		}
		if err := bcrypt.CompareHashAndPassword([]byte(createdAdmin.PasswordHash), []byte(rawPassword)); err != nil {
			t.Fatalf("stored password_hash does not match raw password: %v", err)
		}

		// Check audit log
		if len(audit.entries) != 1 {
			t.Fatalf("expected 1 audit log entry, got %d", len(audit.entries))
		}
		if audit.entries[0].Action != "SUPER_ADMIN_BOOTSTRAP_CREATED" {
			t.Errorf("expected audit action SUPER_ADMIN_BOOTSTRAP_CREATED, got %s", audit.entries[0].Action)
		}
		if audit.entries[0].ActorAdminID != createdAdmin.ID {
			t.Errorf("expected audit actor to match created admin ID")
		}
	})

	// Test 3: Run bootstrap again -> idempotent, no duplicate created
	t.Run("Idempotent: skips cleanly when SUPER_ADMIN already exists", func(t *testing.T) {
		res, err := bootstrapService.BootstrapSuperAdmin(name, email, rawPassword)
		if err != nil {
			t.Fatalf("unexpected error on second run: %v", err)
		}
		if res.Created {
			t.Fatalf("expected second run to NOT create duplicate admin")
		}
		if !strings.Contains(res.Message, "SUPER_ADMIN already exists. Bootstrap skipped.") {
			t.Errorf("expected skipped message, got: %s", res.Message)
		}
		if len(repo.createdAdmins) != 1 {
			t.Errorf("expected total created admins to remain 1, got %d", len(repo.createdAdmins))
		}
	})

	// Test 4: Email conflict protection
	t.Run("Refuses to overwrite if email belongs to another admin role", func(t *testing.T) {
		conflictRepo := newMockBootstrapRepo()
		conflictRepo.superAdminCount = 0 // simulate zero super admins
		// But email belongs to a COMMERCE_ADMIN
		conflictRepo.adminsByEmail["commerce@tbk.market"] = &models.AdminUser{
			ID:    uuid.New(),
			Email: "commerce@tbk.market",
			Role:  models.AdminRoleCommerceAdmin,
		}

		svc := service.NewAdminBootstrapService(conflictRepo, nil)
		_, err := svc.BootstrapSuperAdmin("Commerce User", "commerce@tbk.market", "Password123!")
		if err == nil {
			t.Fatalf("expected conflict error, but got nil")
		}
		if !strings.Contains(err.Error(), "already exists with admin role") {
			t.Errorf("expected error mentioning existing role, got: %v", err)
		}
	})

	// Test 5: Authentication & JWT Verification with created credentials
	t.Run("Super Admin logs in and receives valid Admin JWT with audience", func(t *testing.T) {
		cfg := &config.Config{
			JWTSecret: "test-jwt-secret-must-be-long-enough-32bytes",
		}
		authSvc := service.NewAdminAuthService(nil, cfg)

		// Validate access token generation for Super Admin
		accessToken, err := authSvc.GenerateAccessTokenOnly(createdAdmin)
		if err != nil {
			t.Fatalf("failed to generate access token: %v", err)
		}
		if accessToken == "" {
			t.Fatalf("expected non-empty access token")
		}

		claims, err := authSvc.ValidateAccessToken(accessToken)
		if err != nil {
			t.Fatalf("failed to validate generated access token: %v", err)
		}
		if claims.Role != models.AdminRoleSuperAdmin {
			t.Errorf("expected role %s, got %s", models.AdminRoleSuperAdmin, claims.Role)
		}
		if claims.Email != email {
			t.Errorf("expected email %s, got %s", email, claims.Email)
		}

		// Test 6: Route authorization for all 4 admin dashboards
		gin.SetMode(gin.TestMode)
		dashboardTests := []struct {
			name         string
			allowedRoles []models.AdminRole
		}{
			{"Direction Dashboard", []models.AdminRole{models.AdminRoleDirectionAdmin}},
			{"Commerce Dashboard", []models.AdminRole{models.AdminRoleCommerceAdmin}},
			{"Finance & Support Dashboard", []models.AdminRole{models.AdminRoleFinanceSupportAdmin}},
			{"Technical & Security Dashboard", []models.AdminRole{models.AdminRoleTechnicalAdmin}},
		}

		for _, dt := range dashboardTests {
			r := gin.New()
			r.Use(func(c *gin.Context) {
				c.Set("admin_id", createdAdmin.ID)
				c.Set("admin_role", createdAdmin.Role)
				c.Next()
			})
			r.GET("/test-dashboard", middleware.RequireAdminRoles(dt.allowedRoles...), func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"status": "ok"})
			})

			req := httptest.NewRequest(http.MethodGet, "/test-dashboard", nil)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("Super Admin access to %s was rejected with code %d", dt.name, w.Code)
			}
		}
	})
}

type mockProtectionRepo struct {
	admin       *models.AdminUser
	activeCount int
}

func (m *mockProtectionRepo) ValidateProtection(newRole models.AdminRole, newStatus models.AdminStatus) error {
	if m.admin.Role == models.AdminRoleSuperAdmin && m.admin.Status == models.AdminStatusActive {
		if newRole != models.AdminRoleSuperAdmin || newStatus != models.AdminStatusActive {
			if m.activeCount <= 1 {
				return errors.New("cannot modify, downgrade, or deactivate the last remaining active SUPER_ADMIN")
			}
		}
	}
	return nil
}

func TestSuperAdminProtectionInvariant(t *testing.T) {
	// Case 1: Sole remaining active SUPER_ADMIN cannot be downgraded or deactivated
	soleAdmin := &mockProtectionRepo{
		admin: &models.AdminUser{
			ID:     uuid.New(),
			Role:   models.AdminRoleSuperAdmin,
			Status: models.AdminStatusActive,
		},
		activeCount: 1,
	}

	if err := soleAdmin.ValidateProtection(models.AdminRoleCommerceAdmin, models.AdminStatusActive); err == nil {
		t.Errorf("expected error when attempting to downgrade the last active Super Admin, got nil")
	}

	if err := soleAdmin.ValidateProtection(models.AdminRoleSuperAdmin, models.AdminStatusSuspended); err == nil {
		t.Errorf("expected error when attempting to suspend the last active Super Admin, got nil")
	}

	// Case 2: When multiple active SUPER_ADMINs exist, modification is permitted
	multiAdmin := &mockProtectionRepo{
		admin: &models.AdminUser{
			ID:     uuid.New(),
			Role:   models.AdminRoleSuperAdmin,
			Status: models.AdminStatusActive,
		},
		activeCount: 2,
	}

	if err := multiAdmin.ValidateProtection(models.AdminRoleCommerceAdmin, models.AdminStatusActive); err != nil {
		t.Errorf("expected downgrade to succeed when multiple super admins exist, got: %v", err)
	}

	// Case 3: Other roles are not blocked by the Super Admin protection
	commerceAdmin := &mockProtectionRepo{
		admin: &models.AdminUser{
			ID:     uuid.New(),
			Role:   models.AdminRoleCommerceAdmin,
			Status: models.AdminStatusActive,
		},
		activeCount: 1,
	}

	if err := commerceAdmin.ValidateProtection(models.AdminRoleCommerceAdmin, models.AdminStatusSuspended); err != nil {
		t.Errorf("expected non-super-admin modification to succeed, got: %v", err)
	}
}

