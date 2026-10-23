package service

import (
	"testing"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// passwordUser is an account registered through the form: it knows "s3cret".
func passwordUser(t *testing.T) *models.User {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte("s3cret"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	return &models.User{
		PasswordHash:  string(hash),
		HasPassword:   true,
		Phone:         "+243812345678",
		PhoneVerified: true,
		Status:        models.UserStatusActive,
	}
}

// phoneOnlyUser is what createPhoneOnlyUser leaves behind: a hash of random
// bytes nobody kept, and has_password false.
func phoneOnlyUser(t *testing.T) *models.User {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte("1f3c9a7b2e4d6508"), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	return &models.User{
		PasswordHash:  string(hash),
		HasPassword:   false,
		Phone:         "+243812345678",
		PhoneVerified: true,
		Status:        models.UserStatusActive,
	}
}

func TestAccountDeletionProofPasswordAccount(t *testing.T) {
	user := passwordUser(t)

	// The password is still the only proof this account accepts.
	proof, err := accountDeletionProof(user, "s3cret", "", "")
	if err != nil || proof != deletionProofPassword {
		t.Fatalf("right password: proof = %q, err = %v, want %q, nil", proof, err, deletionProofPassword)
	}

	if _, err := accountDeletionProof(user, "wrong", "", ""); err == nil || err.Error() != "INVALID_PASSWORD" {
		t.Errorf("wrong password: err = %v, want INVALID_PASSWORD", err)
	}

	// A code is not a substitute: an account that has a password is no easier
	// to delete than it was before phone-only accounts existed.
	if _, err := accountDeletionProof(user, "", uuid.New().String(), "123456"); err == nil || err.Error() != "PASSWORD_REQUIRED" {
		t.Errorf("code instead of password: err = %v, want PASSWORD_REQUIRED", err)
	}
	if _, err := accountDeletionProof(user, "wrong", uuid.New().String(), "123456"); err == nil || err.Error() != "INVALID_PASSWORD" {
		t.Errorf("code plus wrong password: err = %v, want INVALID_PASSWORD", err)
	}
}

func TestAccountDeletionProofPhoneOnlyAccount(t *testing.T) {
	user := phoneOnlyUser(t)

	// A code on the account's own number is the proof here. It is still
	// checked against the stored challenge afterwards (consumeOTP); this
	// decides only which proof the request has to carry.
	proof, err := accountDeletionProof(user, "", uuid.New().String(), "123456")
	if err != nil || proof != deletionProofCode {
		t.Fatalf("challenge + code: proof = %q, err = %v, want %q, nil", proof, err, deletionProofCode)
	}

	// The placeholder hash must never open the door, whatever is typed --
	// including the hex secret it was made from, had anyone kept it.
	for _, password := range []string{"", "1f3c9a7b2e4d6508", "s3cret"} {
		if _, err := accountDeletionProof(user, password, "", ""); err == nil || err.Error() != "DELETION_CODE_REQUIRED" {
			t.Errorf("password %q alone: err = %v, want DELETION_CODE_REQUIRED", password, err)
		}
	}

	// Half a proof is no proof.
	if _, err := accountDeletionProof(user, "", uuid.New().String(), ""); err == nil || err.Error() != "DELETION_CODE_REQUIRED" {
		t.Errorf("challenge without code: err = %v, want DELETION_CODE_REQUIRED", err)
	}
	if _, err := accountDeletionProof(user, "", "", "123456"); err == nil || err.Error() != "DELETION_CODE_REQUIRED" {
		t.Errorf("code without challenge: err = %v, want DELETION_CODE_REQUIRED", err)
	}
	if _, err := accountDeletionProof(user, "", "   ", "  "); err == nil || err.Error() != "DELETION_CODE_REQUIRED" {
		t.Errorf("blank challenge and code: err = %v, want DELETION_CODE_REQUIRED", err)
	}
}

func TestAccountDeletionProofNeedsAVerifiedPhone(t *testing.T) {
	// Without a password and without a number a code can reach, there is no
	// proof left to ask for; refusing is the only safe answer.
	user := phoneOnlyUser(t)
	user.PhoneVerified = false
	if _, err := accountDeletionProof(user, "", uuid.New().String(), "123456"); err == nil || err.Error() != "PHONE_NOT_VERIFIED" {
		t.Errorf("unverified phone: err = %v, want PHONE_NOT_VERIFIED", err)
	}
}

func TestRequestAccountDeletionCodeNeedsWhatsApp(t *testing.T) {
	// No gateway wired: refused before any row is read, so no code is
	// promised that could not be sent.
	if _, err := (&AuthService{}).RequestAccountDeletionCode(uuid.New()); err == nil || err.Error() != "WHATSAPP_UNAVAILABLE" {
		t.Errorf("err = %v, want WHATSAPP_UNAVAILABLE", err)
	}
}

func TestConsumeOTPRejectsUnusableChallenges(t *testing.T) {
	// Without an OTP repository there is nothing to check a code against.
	if err := (&AuthService{}).consumeOTP(uuid.New(), otpPurposeDeleteAccount, uuid.New().String(), "123456"); err == nil || err.Error() != "WHATSAPP_UNAVAILABLE" {
		t.Errorf("no repo: err = %v, want WHATSAPP_UNAVAILABLE", err)
	}

	// A challenge id that is not a UUID is refused before the lookup.
	s := &AuthService{otpRepo: &repository.WhatsAppOTPRepository{}}
	for _, id := range []string{"", "   ", "not-a-uuid"} {
		if err := s.consumeOTP(uuid.New(), otpPurposeDeleteAccount, id, "123456"); err == nil || err.Error() != "OTP_INVALID" {
			t.Errorf("challenge id %q: err = %v, want OTP_INVALID", id, err)
		}
	}
}

func TestDeletionOTPPurposeIsItsOwn(t *testing.T) {
	// consumeOTP refuses a challenge sent for another purpose, so a sign-in
	// code cannot be replayed to erase the account. That check compares
	// against these constants, which therefore must stay distinct.
	for _, other := range []string{otpPurposeSignup, otpPurposeLogin} {
		if otpPurposeDeleteAccount == other {
			t.Fatalf("otpPurposeDeleteAccount collides with %q", other)
		}
	}
}
