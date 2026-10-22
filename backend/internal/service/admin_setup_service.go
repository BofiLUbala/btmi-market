package service

import (
	"crypto/subtle"
	"errors"
	"net/mail"
	"strings"

	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// Errors the setup screen translates (apiError.<code> in the app).
var (
	ErrSetupUnavailable = errors.New("SETUP_UNAVAILABLE")
	ErrSetupCodeInvalid = errors.New("SETUP_CODE_INVALID")
)

// AdminSetupRepository is what the super admin setup needs from storage.
type AdminSetupRepository interface {
	IsSetupCodeClaimed(codeHash string) (bool, error)
	ClaimSuperAdmin(claim repository.SuperAdminClaim) (uuid.UUID, bool, error)
}

// AdminSetupService lets the platform owner create his own SUPER_ADMIN
// account, or take over the existing one, with the one-time code from
// SUPER_ADMIN_SETUP_CODE. There is only ever one super admin: a claim replaces
// the holder's name, e-mail and password instead of adding an account.
type AdminSetupService struct {
	repo AdminSetupRepository
	code string
}

func NewAdminSetupService(repo AdminSetupRepository, code string) *AdminSetupService {
	return &AdminSetupService{repo: repo, code: strings.TrimSpace(code)}
}

// Available reports whether a setup code is configured and still unused.
func (s *AdminSetupService) Available() bool {
	if s.code == "" {
		return false
	}
	used, err := s.repo.IsSetupCodeClaimed(HashToken(s.code))
	return err == nil && !used
}

// Claim checks the code and the owner's details, then creates or takes over
// the super admin account. It returns the e-mail to sign in with and whether
// the account was newly created.
func (s *AdminSetupService) Claim(code, name, email, password string) (string, bool, error) {
	if s.code == "" {
		return "", false, ErrSetupUnavailable
	}
	if subtle.ConstantTimeCompare([]byte(strings.TrimSpace(code)), []byte(s.code)) != 1 {
		return "", false, ErrSetupCodeInvalid
	}

	nameParts := strings.Fields(name)
	if len(nameParts) == 0 {
		return "", false, errors.New("NAME_REQUIRED")
	}
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	if addr, err := mail.ParseAddress(cleanEmail); err != nil || addr.Address != cleanEmail {
		return "", false, errors.New("INVALID_EMAIL")
	}
	if !IsStrongPassword(password) {
		return "", false, errors.New("PASSWORD_TOO_WEAK")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", false, err
	}
	lastName := "Admin"
	if len(nameParts) > 1 {
		lastName = strings.Join(nameParts[1:], " ")
	}

	_, created, err := s.repo.ClaimSuperAdmin(repository.SuperAdminClaim{
		CodeHash:     HashToken(s.code),
		FirstName:    nameParts[0],
		LastName:     lastName,
		Email:        cleanEmail,
		PasswordHash: string(hash),
	})
	return cleanEmail, created, err
}
