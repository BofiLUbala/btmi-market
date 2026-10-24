package service

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

// StartPhoneAuth is the whole of signing in with a phone number: one field,
// then a code. A number nobody holds is registered on the spot, so the client
// does not have to know in advance whether the person is new, and the answer
// looks the same either way — which keeps the endpoint from telling a stranger
// which numbers have an account here.
//
// The account it creates has no other way in: no e-mail address, and a
// password hashed from random bytes that are discarded immediately. Only a
// WhatsApp code opens it, until the holder sets a password from their profile.
// It stays PENDING_VERIFICATION until the code comes back; VerifyWhatsAppCode
// is what activates it and marks the phone verified, exactly as for a sign-up
// through the registration form.
func (s *AuthService) StartPhoneAuth(phone, firstName, lastName string) (*models.WhatsAppChallenge, error) {
	if !s.whatsappReady() {
		return nil, errors.New("WHATSAPP_UNAVAILABLE")
	}
	normalized := s.whatsapp.NormalizePhone(phone)
	if len(normalized) < 8 {
		return nil, errors.New("INVALID_PHONE")
	}

	// GetByPhone also matches on the last nine digits, so "0970000000" finds
	// the account registered as "+243970000000" instead of registering a
	// second one for the same person.
	user, err := s.userRepo.GetByPhone(strings.TrimSpace(phone))
	switch {
	case err == nil:
		if user.Status == models.UserStatusSuspended || user.Status == models.UserStatusDeactivated {
			return nil, errors.New("ACCOUNT_SUSPENDED")
		}
		// An account that never finished verifying is still signing up; the
		// purpose decides which open challenges get replaced.
		purpose := otpPurposeLogin
		if user.Status == models.UserStatusPendingVerification {
			purpose = otpPurposeSignup
		}
		return s.sendWhatsAppCode(user, purpose)
	case errors.Is(err, repository.ErrUserNotFound):
		user, err = s.createPhoneOnlyUser("+"+normalized, firstName, lastName)
		if err != nil {
			return nil, err
		}
		return s.sendWhatsAppCode(user, otpPurposeSignup)
	default:
		return nil, err
	}
}

// createPhoneOnlyUser registers a buyer known by their number alone. The
// e-mail column is left empty, which Create stores as NULL so the unique
// index tolerates any number of such accounts (migration 118).
func (s *AuthService) createPhoneOnlyUser(phone, firstName, lastName string) (*models.User, error) {
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		return nil, fmt.Errorf("failed to generate placeholder secret: %w", err)
	}
	// Hex, not the raw bytes: bcrypt keys are C strings, so a random NUL byte
	// would silently cut the secret short.
	hash, err := bcrypt.GenerateFromPassword([]byte(hex.EncodeToString(secret)), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash placeholder password: %w", err)
	}

	user := &models.User{
		FirstName:    strings.TrimSpace(firstName),
		LastName:     strings.TrimSpace(lastName),
		Phone:        phone,
		Email:        "",
		PasswordHash: string(hash),
		// No password the holder could type: deletion asks for a code on
		// this number instead (migration 121).
		HasPassword:  false,
		Status:       models.UserStatusPendingVerification,
		AccountType:  models.AccountTypeBuyer,
	}
	if err := s.userRepo.Create(user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Orders hang off the buyer profile, so the account is unusable without
	// one. The name and address stay empty until the app asks for them.
	if s.buyerProfileRepo != nil {
		profile := &models.BuyerProfile{
			UserID:    user.ID,
			FirstName: user.FirstName,
			LastName:  user.LastName,
			Phone:     phone,
			Email:     "",
			Country:   "DRC",
			Status:    models.BuyerProfileStatusActive,
		}
		if err := s.buyerProfileRepo.Create(profile); err != nil {
			log.Printf("Warning: failed to create buyer profile for phone-only user %s: %v", user.ID, err)
		}
	}
	return user, nil
}
