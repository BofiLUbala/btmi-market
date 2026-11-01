package service

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type fakeSetupRepo struct {
	last      repository.SuperAdminClaim
	admins    map[uuid.UUID]*models.AdminUser
	cancelled int
}

func newFakeSetupRepo() *fakeSetupRepo {
	return &fakeSetupRepo{admins: map[uuid.UUID]*models.AdminUser{}}
}

func (f *fakeSetupRepo) HasActiveSuperAdmin() (bool, error) {
	for _, a := range f.admins {
		if a.Role == models.AdminRoleSuperAdmin && a.Status == models.AdminStatusActive {
			return true, nil
		}
	}
	return false, nil
}

func (f *fakeSetupRepo) StartSuperAdminClaim(c repository.SuperAdminClaim) (uuid.UUID, error) {
	if held, _ := f.HasActiveSuperAdmin(); held {
		return uuid.Nil, repository.ErrSetupClosed
	}
	f.last = c
	id := uuid.New()
	f.admins[id] = &models.AdminUser{
		ID: id, FirstName: c.FirstName, LastName: c.LastName, Email: c.Email,
		Role: models.AdminRoleSuperAdmin, Status: models.AdminStatusPending,
	}
	return id, nil
}

func (f *fakeSetupRepo) CancelSuperAdminClaim(pendingID uuid.UUID) error {
	f.cancelled++
	delete(f.admins, pendingID)
	return nil
}

func (f *fakeSetupRepo) ActivateSuperAdminClaim(pendingID uuid.UUID) error {
	admin, ok := f.admins[pendingID]
	if !ok || admin.Status != models.AdminStatusPending {
		return repository.ErrSetupNotPending
	}
	if held, _ := f.HasActiveSuperAdmin(); held {
		return repository.ErrSetupClosed
	}
	admin.Status = models.AdminStatusActive
	return nil
}

func (f *fakeSetupRepo) GetByID(id uuid.UUID) (*models.AdminUser, error) {
	admin, ok := f.admins[id]
	if !ok {
		return nil, errors.New("ADMIN_NOT_FOUND")
	}
	return admin, nil
}

type fakeInvitations struct {
	byHash map[string]*models.AdminInvitation
	fail   error
}

func newFakeInvitations() *fakeInvitations {
	return &fakeInvitations{byHash: map[string]*models.AdminInvitation{}}
}

func (f *fakeInvitations) Create(inv *models.AdminInvitation) error {
	if f.fail != nil {
		return f.fail
	}
	inv.ID = uuid.New()
	f.byHash[inv.TokenHash] = inv
	return nil
}

func (f *fakeInvitations) GetByTokenHash(hash string) (*models.AdminInvitation, error) {
	inv, ok := f.byHash[hash]
	if !ok {
		return nil, errors.New("INVALID_INVITATION")
	}
	return inv, nil
}

func (f *fakeInvitations) UpdateStatus(id uuid.UUID, status models.AdminInvitationStatus, acceptedAt *time.Time) error {
	for _, inv := range f.byHash {
		if inv.ID == id {
			inv.Status = status
			inv.AcceptedAt = acceptedAt
		}
	}
	return nil
}

type fakeMailer struct {
	sentTo string
	url    string
	fail   error
}

func (m *fakeMailer) BuildSuperAdminSetupURL(token string) string {
	return "https://tbk.test/admin/setup/activate?token=" + token
}

func (m *fakeMailer) SendSuperAdminSetupEmail(to, firstName, setupURL string) error {
	if m.fail != nil {
		return m.fail
	}
	m.sentTo, m.url = to, setupURL
	return nil
}

// tokenOf returns the raw token the service mailed, read back from its URL.
func tokenOf(url string) string {
	return url[strings.Index(url, "token=")+len("token="):]
}

func TestAdminSetupStartRejectsBadInput(t *testing.T) {
	const strong = "Owner#2026pass"
	repo, invitations, mailer := newFakeSetupRepo(), newFakeInvitations(), &fakeMailer{}
	s := NewAdminSetupService(repo, invitations, mailer)

	if !s.Available() {
		t.Fatal("setup must be open while there is no super admin")
	}
	if _, err := s.Start("Jean Mukendi", "jean@tbk.cd", "short"); err == nil || err.Error() != "PASSWORD_TOO_WEAK" {
		t.Fatalf("weak password: got %v", err)
	}
	if _, err := s.Start("Jean Mukendi", "not-an-email", strong); err == nil || err.Error() != "INVALID_EMAIL" {
		t.Fatalf("bad e-mail: got %v", err)
	}
	if _, err := s.Start("   ", "jean@tbk.cd", strong); err == nil || err.Error() != "NAME_REQUIRED" {
		t.Fatalf("empty name: got %v", err)
	}
	if len(repo.admins) != 0 || mailer.sentTo != "" {
		t.Fatal("a refused attempt must create nothing and send nothing")
	}
}

func TestAdminSetupActivationFlow(t *testing.T) {
	const strong = "Owner#2026pass"
	repo, invitations, mailer := newFakeSetupRepo(), newFakeInvitations(), &fakeMailer{}
	s := NewAdminSetupService(repo, invitations, mailer)

	email, err := s.Start("Jean Paul Mukendi", " Jean@TBK.cd ", strong)
	if err != nil || email != "jean@tbk.cd" {
		t.Fatalf("start: email=%q err=%v", email, err)
	}
	if repo.last.FirstName != "Jean" || repo.last.LastName != "Paul Mukendi" || repo.last.PasswordHash == strong {
		t.Fatalf("claim stored wrong details: %+v", repo.last)
	}
	if mailer.sentTo != "jean@tbk.cd" {
		t.Fatalf("the link must go to the address typed, got %q", mailer.sentTo)
	}
	if !s.Available() {
		t.Fatal("a pending account must not close the setup: nobody can sign in yet")
	}

	// Until the link is followed the account is only pending.
	token := tokenOf(mailer.url)
	pending, err := s.Verify(token)
	if err != nil || pending.Status != models.AdminStatusPending {
		t.Fatalf("verify: %+v err=%v", pending, err)
	}
	if _, err := s.Verify("not-the-token"); !errors.Is(err, ErrSetupLinkInvalid) {
		t.Fatalf("unknown token: got %v", err)
	}

	admin, err := s.Activate(token)
	if err != nil || admin.Status != models.AdminStatusActive {
		t.Fatalf("activate: %+v err=%v", admin, err)
	}
	if repo.admins[admin.ID].Status != models.AdminStatusActive {
		t.Fatal("the stored account must be active")
	}
	if _, err := s.Activate(token); !errors.Is(err, ErrSetupLinkInvalid) {
		t.Fatalf("a used link must not work twice: got %v", err)
	}
}

func TestAdminSetupClosesOnceASuperAdminIsActive(t *testing.T) {
	repo, invitations, mailer := newFakeSetupRepo(), newFakeInvitations(), &fakeMailer{}
	s := NewAdminSetupService(repo, invitations, mailer)

	if _, err := s.Start("Jean Mukendi", "jean@tbk.cd", "Owner#2026pass"); err != nil {
		t.Fatalf("first start: %v", err)
	}
	if _, err := s.Activate(tokenOf(mailer.url)); err != nil {
		t.Fatalf("activate: %v", err)
	}

	if s.Available() {
		t.Fatal("the setup must close once a super admin is active")
	}
	if _, err := s.Start("Someone Else", "x@tbk.cd", "Owner#2026pass"); !errors.Is(err, ErrSetupUnavailable) {
		t.Fatalf("a second setup must be refused, got %v", err)
	}
}

func TestAdminSetupDropsThePendingAccountWhenTheMailFails(t *testing.T) {
	repo, invitations := newFakeSetupRepo(), newFakeInvitations()
	mailer := &fakeMailer{fail: errors.New("smtp down")}
	s := NewAdminSetupService(repo, invitations, mailer)

	if _, err := s.Start("Jean Mukendi", "typo@tbk.cd", "Owner#2026pass"); err == nil {
		t.Fatal("a failed e-mail must fail the setup")
	}
	if repo.cancelled != 1 {
		t.Fatalf("the claim must be rolled back, cancelled=%d", repo.cancelled)
	}
	if len(repo.admins) != 0 {
		t.Fatalf("the pending account must be gone, got %d", len(repo.admins))
	}
	if !s.Available() {
		t.Fatal("the setup must stay open after a failed e-mail")
	}
}

func TestAdminSetupExpiredLink(t *testing.T) {
	repo, invitations, mailer := newFakeSetupRepo(), newFakeInvitations(), &fakeMailer{}
	s := NewAdminSetupService(repo, invitations, mailer)
	if _, err := s.Start("Jean Mukendi", "jean@tbk.cd", "Owner#2026pass"); err != nil {
		t.Fatalf("start: %v", err)
	}

	for _, inv := range invitations.byHash {
		inv.ExpiresAt = time.Now().Add(-time.Minute)
	}
	if _, err := s.Activate(tokenOf(mailer.url)); !errors.Is(err, ErrSetupLinkExpired) {
		t.Fatalf("expired link: got %v", err)
	}
}
