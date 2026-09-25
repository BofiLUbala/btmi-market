package repository_test

import (
	"database/sql"
	"os"
	"strings"
	"testing"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
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

	// Historical SUPER_ADMIN rows may remain for audit retention. The security
	// invariant is exactly one effective ACTIVE SUPER_ADMIN.
	count, err := adminRepo.CountActiveSuperAdmins()
	if err != nil {
		t.Fatalf("failed to count super admins: %v", err)
	}
	if count != 1 {
		t.Fatalf("INTEGRITY CHECK FAILED: expected exactly 1 ACTIVE SUPER_ADMIN, found %d", count)
	}
	t.Logf("PASS: Exactly 1 ACTIVE SUPER_ADMIN found in PostgreSQL")

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

	// 4. If SUPER_ADMIN_PASSWORD is provided in environment, verify against it
	if envPass := strings.TrimSpace(os.Getenv("SUPER_ADMIN_PASSWORD")); envPass != "" {
		if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(envPass)); err != nil {
			t.Errorf("bcrypt verification against SUPER_ADMIN_PASSWORD env failed: %v", err)
		} else {
			t.Logf("PASS: Password bcrypt hash verified successfully against env")
		}
	}

	// 5. Verify audit history in admin_audit_log
	var auditCount int
	err = db.QueryRow("SELECT COUNT(*) FROM admin_audit_log WHERE target_id = $1", admin.ID.String()).Scan(&auditCount)
	if err != nil && err != sql.ErrNoRows {
		t.Errorf("failed to query audit log: %v", err)
	}
	t.Logf("Audit log entries found for Super Admin: %d", auditCount)
	if auditCount < 1 {
		t.Errorf("expected at least 1 audit entry for super admin, found %d", auditCount)
	}
}

// This is a real-data simulation: two temporary catalog rows are committed so
// the same connection used by the admin repository can observe them, then they
// are always removed. It protects the dashboard from the old GROUP BY +
// QueryRow bug, which silently displayed zero when several products were out
// of stock.
func TestRealDatabaseCommerceOverviewTracksMultipleOutOfStockProducts(t *testing.T) {
	if os.Getenv("RUN_REAL_DB_SIMULATION") != "1" {
		t.Skip("set RUN_REAL_DB_SIMULATION=1 to run the temporary real-data dashboard simulation")
	}
	cfg := config.Load()
	db, err := database.Connect(cfg.DBHost, cfg.DBPort, cfg.DBName, cfg.DBUser, cfg.DBPassword)
	if err != nil {
		t.Skipf("Skipping real DB dashboard simulation: %v", err)
	}
	defer db.Close()

	repo := repository.NewAdminCommerceRepository(db)
	before, err := repo.GetOverview()
	if err != nil {
		t.Fatalf("read overview before simulation: %v", err)
	}

	var businessID uuid.UUID
	if err := db.QueryRow(`SELECT id FROM businesses ORDER BY created_at LIMIT 1`).Scan(&businessID); err != nil {
		t.Skipf("Skipping simulation: no business available: %v", err)
	}

	ids := []uuid.UUID{uuid.New(), uuid.New()}
	defer func() {
		_, _ = db.Exec(`DELETE FROM products WHERE id IN ($1, $2)`, ids[0], ids[1])
	}()
	for i, id := range ids {
		_, err = db.Exec(`
			INSERT INTO products (id, business_id, name, sku, unit_price, status, publication_status)
			VALUES ($1, $2, $3, $4, 1, 'ACTIVE', 'DRAFT')
		`, id, businessID, "Admin dashboard simulation", "ADMIN-SIM-"+id.String())
		if err != nil {
			t.Fatalf("insert simulated product %d: %v", i+1, err)
		}
	}

	after, err := repo.GetOverview()
	if err != nil {
		t.Fatalf("read overview after simulation: %v", err)
	}
	if after.TotalProducts != before.TotalProducts+2 {
		t.Fatalf("total products did not refresh: before=%d after=%d", before.TotalProducts, after.TotalProducts)
	}
	if after.OutOfStockProducts != before.OutOfStockProducts+2 {
		t.Fatalf("out-of-stock products did not refresh: before=%d after=%d", before.OutOfStockProducts, after.OutOfStockProducts)
	}
	t.Logf("real-time simulation passed: total %d→%d, out-of-stock %d→%d", before.TotalProducts, after.TotalProducts, before.OutOfStockProducts, after.OutOfStockProducts)
}
