package service

import (
	"errors"
	"testing"

	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type fakeSetupRepo struct {
	claimed map[string]bool
	last    repository.SuperAdminClaim
	holder  bool // an active super admin exists already
}

func (f *fakeSetupRepo) IsSetupCodeClaimed(h string) (bool, error) { return f.claimed[h], nil }

func (f *fakeSetupRepo) ClaimSuperAdmin(c repository.SuperAdminClaim) (uuid.UUID, bool, error) {
	if f.claimed[c.CodeHash] {
		return uuid.Nil, false, repository.ErrSetupCodeUsed
	}
	f.claimed[c.CodeHash] = true
	f.last = c
	created := !f.holder
	f.holder = true
	return uuid.New(), created, nil
}

func TestAdminSetupClaim(t *testing.T) {
	const strong = "Owner#2026pass"
	repo := &fakeSetupRepo{claimed: map[string]bool{}}

	if NewAdminSetupService(repo, "").Available() {
		t.Fatal("setup must be hidden without a configured code")
	}
	if _, _, err := NewAdminSetupService(repo, "").Claim("x", "A B", "a@b.co", strong); !errors.Is(err, ErrSetupUnavailable) {
		t.Fatalf("no code configured: got %v", err)
	}

	s := NewAdminSetupService(repo, " TBK-OWNER-1 ")
	if !s.Available() {
		t.Fatal("an unused code must make setup available")
	}
	if _, _, err := s.Claim("wrong", "Jean Mukendi", "jean@tbk.cd", strong); !errors.Is(err, ErrSetupCodeInvalid) {
		t.Fatalf("wrong code: got %v", err)
	}
	if _, _, err := s.Claim("TBK-OWNER-1", "Jean Mukendi", "jean@tbk.cd", "short"); err == nil || err.Error() != "PASSWORD_TOO_WEAK" {
		t.Fatalf("weak password: got %v", err)
	}
	if _, _, err := s.Claim("TBK-OWNER-1", "Jean Mukendi", "not-an-email", strong); err == nil || err.Error() != "INVALID_EMAIL" {
		t.Fatalf("bad e-mail: got %v", err)
	}
	if _, _, err := s.Claim("TBK-OWNER-1", "   ", "jean@tbk.cd", strong); err == nil || err.Error() != "NAME_REQUIRED" {
		t.Fatalf("empty name: got %v", err)
	}

	email, created, err := s.Claim("TBK-OWNER-1", "Jean Paul Mukendi", " Jean@TBK.cd ", strong)
	if err != nil || !created || email != "jean@tbk.cd" {
		t.Fatalf("first claim: email=%q created=%v err=%v", email, created, err)
	}
	if repo.last.FirstName != "Jean" || repo.last.LastName != "Paul Mukendi" || repo.last.PasswordHash == strong {
		t.Fatalf("claim stored wrong details: %+v", repo.last)
	}
	if s.Available() {
		t.Fatal("a used code must close the setup")
	}
	if _, _, err := s.Claim("TBK-OWNER-1", "Someone Else", "x@tbk.cd", strong); !errors.Is(err, repository.ErrSetupCodeUsed) {
		t.Fatalf("second claim with the same code: got %v", err)
	}

	// A new code hands the same single account over instead of adding one.
	s2 := NewAdminSetupService(repo, "TBK-OWNER-2")
	if _, created, err := s2.Claim("TBK-OWNER-2", "Marie Owner", "marie@tbk.cd", strong); err != nil || created {
		t.Fatalf("new code must take over, not create: created=%v err=%v", created, err)
	}
}
