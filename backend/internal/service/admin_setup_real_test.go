package service_test

// Super admin setup and the admin screens it leads to, against the real
// schema. They pin what went wrong once:
//   - the setup page asked for a code the form no longer sent;
//   - a pending account signing in was told it was "suspended";
//   - the direction user list crashed on an account with no e-mail.
//
// Needs a disposable database whose name ends in "_test":
//
//	ADMIN_TEST_DSN="host=127.0.0.1 port=5433 user=btmi_user password=... dbname=btmi_admin_test sslmode=disable" \
//	  go test ./internal/service -run AdminReal -v

import (
	"database/sql"
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/btmi-ai-market/backend/internal/service"
)

type recordingMailer struct{ sentTo, url string }

func (m *recordingMailer) BuildSuperAdminSetupURL(token string) string {
	return "https://tbk.test/admin/setup/activate?token=" + token
}

func (m *recordingMailer) SendSuperAdminSetupEmail(to, _ string, setupURL string) error {
	m.sentTo, m.url = to, setupURL
	return nil
}

func adminRealEnv(t *testing.T) *database.DB {
	t.Helper()
	dsn := os.Getenv("ADMIN_TEST_DSN")
	if dsn == "" {
		t.Skip("ADMIN_TEST_DSN not set; skipping PostgreSQL admin tests")
	}
	raw, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	var name string
	if err := raw.QueryRow(`SELECT current_database()`).Scan(&name); err != nil || !strings.HasSuffix(name, "_test") {
		t.Fatalf("ADMIN_TEST_DSN must target a database ending in _test (got %q, %v)", name, err)
	}
	db := &database.DB{DB: raw}
	t.Cleanup(func() { raw.Close() })
	if err := db.RunMigrations("../../migrations"); err != nil {
		t.Fatalf("migrations: %v", err)
	}
	return db
}

// withoutSuperAdmin starts from a platform with no super admin, whatever an
// earlier run left in this disposable database.
func withoutSuperAdmin(t *testing.T, db *database.DB) {
	t.Helper()
	for _, q := range []string{
		`DELETE FROM admin_audit_log WHERE actor_admin_id IN (SELECT id FROM admin_users WHERE role = 'SUPER_ADMIN')`,
		`DELETE FROM admin_users WHERE role = 'SUPER_ADMIN'`,
	} {
		if _, err := db.Exec(q); err != nil {
			t.Fatalf("reset super admins: %v", err)
		}
	}
}

func TestAdminRealSuperAdminSetupFlow(t *testing.T) {
	db := adminRealEnv(t)
	withoutSuperAdmin(t, db)
	cfg := &config.Config{JWTSecret: "test-super-secret-key-32-bytes-long!!"}
	adminRepo := repository.NewAdminRepository(db)
	mailer := &recordingMailer{}
	setup := service.NewAdminSetupService(adminRepo, repository.NewAdminInvitationRepository(db), mailer)
	auth := service.NewAdminAuthService(adminRepo, cfg)

	const email, password = "owner.real@tbk.test", "Owner#2026pass"

	if !setup.Available() {
		t.Fatal("the setup must be open while no super admin is active")
	}
	if _, err := setup.Start("Jean Mukendi", email, password); err != nil {
		t.Fatalf("start: %v", err)
	}
	if mailer.sentTo != email {
		t.Fatalf("the link must go to the address typed, got %q", mailer.sentTo)
	}

	// Right password, account not activated yet: say so, do not say "suspended".
	if _, err := auth.Login(email, password, "127.0.0.1", "test"); err == nil || err.Error() != "ADMIN_ACCOUNT_PENDING" {
		t.Fatalf("a pending account must be told to activate it, got %v", err)
	}
	// A wrong password must still look like any other bad credentials.
	if _, err := auth.Login(email, "Wrong#2026pass", "127.0.0.1", "test"); err == nil || err.Error() != "INVALID_CREDENTIALS" {
		t.Fatalf("a wrong password must stay INVALID_CREDENTIALS, got %v", err)
	}

	// Asking again with the same address replaces the first attempt.
	if _, err := setup.Start("Jean Mukendi", email, password); err != nil {
		t.Fatalf("a second attempt with the same address must work: %v", err)
	}
	var pending int
	if err := db.QueryRow(`SELECT COUNT(*) FROM admin_users WHERE LOWER(email) = $1`, email).Scan(&pending); err != nil || pending != 1 {
		t.Fatalf("exactly one pending account expected, got %d (%v)", pending, err)
	}

	token := mailer.url[strings.Index(mailer.url, "token=")+len("token="):]
	admin, err := setup.Activate(token)
	if err != nil || admin.Status != models.AdminStatusActive {
		t.Fatalf("activate: %+v err=%v", admin, err)
	}
	if _, err := auth.Login(email, password, "127.0.0.1", "test"); err != nil {
		t.Fatalf("the activated super admin must be able to sign in: %v", err)
	}

	// The page closes by itself: nobody can take the seat from the outside.
	if setup.Available() {
		t.Fatal("the setup must close once a super admin is active")
	}
	if _, err := setup.Start("Someone Else", "other@tbk.test", password); !errors.Is(err, service.ErrSetupUnavailable) {
		t.Fatalf("a second setup must be refused, got %v", err)
	}
}

func TestAdminRealDirectionUserListKeepsPhoneOnlyAccounts(t *testing.T) {
	db := adminRealEnv(t)
	userRepo := repository.NewUserRepository(db)
	const phone = "+243990004242"
	if _, err := db.Exec(`DELETE FROM users WHERE phone = $1`, phone); err != nil {
		t.Fatalf("cleanup: %v", err)
	}
	user := &models.User{
		FirstName: "Phone", LastName: "Only", Phone: phone, Email: "",
		PasswordHash: "x", HasPassword: false,
		Status: models.UserStatusPendingVerification, AccountType: models.AccountTypeBuyer,
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("create phone-only user: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(`DELETE FROM users WHERE id = $1`, user.ID) })

	svc := service.NewAdminDirectionService(db, userRepo, nil, nil)
	items, total, err := svc.ListUsers(phone, "", "", 20, 0)
	if err != nil {
		t.Fatalf("listing must not fail on an account with no e-mail: %v", err)
	}
	if total != 1 || len(items) != 1 || items[0].Email != "" {
		t.Fatalf("the phone-only account must be listed with an empty e-mail, got total=%d items=%d", total, len(items))
	}
}
