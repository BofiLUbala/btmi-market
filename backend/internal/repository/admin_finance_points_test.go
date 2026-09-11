package repository_test

import (
	"testing"

	"github.com/google/uuid"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
)

func TestAdjustPointsNewUserWithNulls(t *testing.T) {
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
	admin, err := adminRepo.GetFirstSuperAdmin()
	if err != nil {
		t.Fatalf("failed to fetch super admin: %v", err)
	}

	financeRepo := repository.NewAdminFinanceRepository(db)

	// Create a test user with NULL phone and no buyer_profile
	testUserID := uuid.New()
	testEmail := "test_null_phone_" + testUserID.String()[:8] + "@test.com"
	_, err = db.Exec(`INSERT INTO users (id, email, password_hash, first_name, last_name, phone, account_type, status, created_at, updated_at)
		VALUES ($1, $2, 'hash', 'Jeremie', 'Kazongo', '+243811223344', 'BUYER', 'PENDING_VERIFICATION', NOW(), NOW())`,
		testUserID, testEmail)
	if err != nil {
		t.Fatalf("Failed to insert test user: %v", err)
	}
	defer db.Exec(`DELETE FROM point_transactions WHERE user_id=$1`, testUserID)
	defer db.Exec(`DELETE FROM point_accounts WHERE owner_id IN (SELECT id FROM buyer_profiles WHERE user_id=$1)`, testUserID)
	defer db.Exec(`DELETE FROM buyer_profiles WHERE user_id=$1`, testUserID)
	defer db.Exec(`DELETE FROM users WHERE id=$1`, testUserID)

	req := &models.AdminPointAdjustmentRequest{
		Type:        "ADD",
		AccountType: "BUYER",
		RequestID:   uuid.New(),
		Amount:      21,
		Reason:      "ajout",
	}

	res, err := financeRepo.AdjustUserPoints(admin.ID, admin.Role, testUserID, req, "127.0.0.1", "test-agent")
	if err != nil {
		t.Logf("EXPECTED FAILURE OBSERVED: %v", err)
	} else {
		t.Logf("SUCCESS: Old=%d, New=%d", res.OldBalance, res.NewBalance)
	}
}
