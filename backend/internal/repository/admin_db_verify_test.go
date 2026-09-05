package repository_test

import (
	"database/sql"
	"strings"
	"testing"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

func TestRealDatabaseSuperAdminVerification(t *testing.T) {
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

	// 1. Verify SUPER_ADMIN count is exactly 1 (no duplicates)
	count, err := adminRepo.CountSuperAdmins()
	if err != nil {
		t.Fatalf("failed to count super admins: %v", err)
	}
	if count != 1 {
		t.Fatalf("DUPLICATE CHECK FAILED: expected exactly 1 SUPER_ADMIN, found %d", count)
	}
	t.Logf("PASS: Exactly 1 SUPER_ADMIN found in PostgreSQL")

	// 2. Fetch the super admin
	admin, err := adminRepo.GetFirstSuperAdmin()
	if err != nil {
		t.Fatalf("failed to fetch super admin: %v", err)
	}

	t.Logf("Super Admin ID: %s", admin.ID)
	t.Logf("Super Admin Name: %s %s", admin.FirstName, admin.LastName)
	t.Logf("Super Admin Email: %s", admin.Email)
	t.Logf("Super Admin Role: %s", admin.Role)
	t.Logf("Super Admin Status: %s", admin.Status)

	if admin.Role != models.AdminRoleSuperAdmin {
		t.Errorf("expected role SUPER_ADMIN, got %s", admin.Role)
	}
	if admin.Status != models.AdminStatusActive {
		t.Errorf("expected status ACTIVE, got %s", admin.Status)
	}

	// 3. Verify password is bcrypt hashed and starts with $2a$ or $2b$
	if !strings.HasPrefix(admin.PasswordHash, "$2a$") && !strings.HasPrefix(admin.PasswordHash, "$2b$") {
		t.Errorf("password_hash does not appear to be bcrypt hashed: %s", admin.PasswordHash)
	}

	// 4. Verify password compares successfully against the set password
	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte("MyNewAdminPassword2026!")); err != nil {
		t.Errorf("bcrypt verification failed: %v", err)
	} else {
		t.Logf("PASS: Password bcrypt hash verified successfully")
	}

	// 5. Verify audit history in admin_audit_log
	var auditCount int
	err = db.QueryRow("SELECT COUNT(*) FROM admin_audit_log WHERE target_id = $1 AND action = 'SUPER_ADMIN_CREDENTIALS_UPDATED'", admin.ID.String()).Scan(&auditCount)
	if err != nil && err != sql.ErrNoRows {
		t.Errorf("failed to query audit log: %v", err)
	}
	t.Logf("Audit log entries found for SUPER_ADMIN_CREDENTIALS_UPDATED: %d", auditCount)
	if auditCount < 1 {
		t.Errorf("expected at least 1 audit entry for credentials update, found %d", auditCount)
	}
}
