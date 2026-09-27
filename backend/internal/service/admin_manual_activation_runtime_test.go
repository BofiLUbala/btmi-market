package service

import (
	"strings"
	"testing"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

// recordingAudit keeps audit entries in memory so the test does not need an
// admin_users row for the acting super admin.
type recordingAudit struct{ entries []*models.AdminAuditLog }

func (r *recordingAudit) Record(e *models.AdminAuditLog) error { r.entries = append(r.entries, e); return nil }
func (r *recordingAudit) List(*models.AuditListFilter) ([]*models.AdminAuditLog, int, error) {
	return r.entries, len(r.entries), nil
}

// A super admin finishes the activation of an account whose e-mailed link failed:
// same end state as a successful link, audited, and refused to everyone else.
func TestSuperAdminManualActivationRuntime(t *testing.T) {
	db := connectHandoverDB(t)
	audit := &recordingAudit{}
	svc := NewAdminDirectionService(db, repository.NewUserRepository(db), repository.NewRefreshTokenRepository(db), NewAuditServiceWithRecorder(audit))

	userID := uuid.New()
	suffix := strings.ReplaceAll(userID.String()[:8], "-", "")
	if _, err := db.Exec(`INSERT INTO users (id, first_name, last_name, phone, email, password_hash, status, email_verified)
		VALUES ($1, 'Pending', 'Buyer', $2, $3, 'x', 'PENDING_VERIFICATION', FALSE)`,
		userID, "+2439"+suffix, "manual.activation."+suffix+"@example.com"); err != nil {
		t.Fatalf("create pending user: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(`DELETE FROM users WHERE id = $1`, userID) })
	if _, err := db.Exec(`INSERT INTO account_activation_tokens (user_id, token_hash, purpose, expires_at)
		VALUES ($1, $2, 'ACTIVATION', NOW() + interval '1 day')`, userID, "hash-"+suffix); err != nil {
		t.Fatalf("create activation link: %v", err)
	}
	admin := uuid.New()

	if err := svc.ActivateUserManually(admin, models.AdminRoleDirectionAdmin, userID, "link never arrived", "127.0.0.1", "test"); err == nil || err.Error() != "SUPER_ADMIN_REQUIRED" {
		t.Fatalf("direction admin must be refused, got %v", err)
	}
	if err := svc.ReactivateUser(admin, models.AdminRoleDirectionAdmin, userID, "try reactivate", "127.0.0.1", "test"); err == nil || err.Error() != "USER_PENDING_ACTIVATION" {
		t.Fatalf("reactivate must not bypass activation, got %v", err)
	}

	if err := svc.ActivateUserManually(admin, models.AdminRoleSuperAdmin, userID, "link never arrived", "127.0.0.1", "test"); err != nil {
		t.Fatalf("super admin activation: %v", err)
	}

	var status string
	var verified bool
	if err := db.QueryRow(`SELECT status, email_verified FROM users WHERE id = $1`, userID).Scan(&status, &verified); err != nil {
		t.Fatal(err)
	}
	if status != string(models.UserStatusActive) || !verified {
		t.Fatalf("want ACTIVE + verified, got %s verified=%v", status, verified)
	}
	var openLinks int
	if err := db.QueryRow(`SELECT COUNT(*) FROM account_activation_tokens WHERE user_id = $1 AND used_at IS NULL`, userID).Scan(&openLinks); err != nil {
		t.Fatal(err)
	}
	if openLinks != 0 {
		t.Fatalf("pending activation links must be invalidated, %d left", openLinks)
	}
	if len(audit.entries) != 1 || audit.entries[0].Action != "USER_MANUALLY_ACTIVATED" || audit.entries[0].Reason != "link never arrived" {
		t.Fatalf("activation must be audited with its reason, got %+v", audit.entries)
	}

	if err := svc.ActivateUserManually(admin, models.AdminRoleSuperAdmin, userID, "again", "127.0.0.1", "test"); err == nil || err.Error() != "USER_NOT_PENDING_ACTIVATION" {
		t.Fatalf("an active account cannot be activated again, got %v", err)
	}
}
