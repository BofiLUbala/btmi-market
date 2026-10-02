package service

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"errors"
	"fmt"
	"log"
	"math/big"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/btmi-ai-market/backend/internal/whatsapp"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const (
	VerificationChannelEmail    = "email"
	VerificationChannelWhatsApp = "whatsapp"

	otpPurposeSignup = "SIGNUP"
	otpPurposeLogin  = "LOGIN"

	otpTTL         = 10 * time.Minute
	otpMaxAttempts = 5
	// otpResendGap stops one challenge from being re-sent in a loop; the
	// handler also caps sends per IP and phone.
	otpResendGap = 45 * time.Second
	// otpResendWindow bounds how long a challenge id can request new codes;
	// after that the user signs in (or registers) again.
	otpResendWindow = 30 * time.Minute
)

// SetWhatsApp wires WhatsApp one-time codes in; without it the WhatsApp
// channel is refused.
func (s *AuthService) SetWhatsApp(repo *repository.WhatsAppOTPRepository, client *whatsapp.Client) {
	s.otpRepo = repo
	s.whatsapp = client
}

func (s *AuthService) whatsappReady() bool {
	return s.otpRepo != nil && s.whatsapp != nil && s.whatsapp.Available()
}

func normalizeChannel(channel string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(channel)) {
	case "", VerificationChannelEmail:
		return VerificationChannelEmail, nil
	case VerificationChannelWhatsApp:
		return VerificationChannelWhatsApp, nil
	}
	return "", errors.New("INVALID_VERIFICATION_CHANNEL")
}

// LoginWithWhatsApp checks phone + password, then sends a code to the account
// phone; the session is only issued by VerifyWhatsAppCode. A pending account
// may sign in this way: entering the code proves the phone and activates it.
func (s *AuthService) LoginWithWhatsApp(phone, password string) (*models.WhatsAppChallenge, error) {
	if !s.whatsappReady() {
		return nil, errors.New("WHATSAPP_UNAVAILABLE")
	}
	phone = strings.TrimSpace(phone)
	user, err := s.userRepo.GetByPhone(phone)
	if err != nil {
		return nil, errors.New("INVALID_CREDENTIALS")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("INVALID_CREDENTIALS")
	}
	if user.Status == models.UserStatusSuspended || user.Status == models.UserStatusDeactivated {
		return nil, errors.New("ACCOUNT_SUSPENDED")
	}
	return s.sendWhatsAppCode(user, otpPurposeLogin)
}

// ResendWhatsAppCode replaces the code of an open challenge with a new one.
func (s *AuthService) ResendWhatsAppCode(challengeID string) (*models.WhatsAppChallenge, error) {
	if !s.whatsappReady() {
		return nil, errors.New("WHATSAPP_UNAVAILABLE")
	}
	id, err := uuid.Parse(strings.TrimSpace(challengeID))
	if err != nil {
		return nil, errors.New("OTP_INVALID")
	}
	ch, err := s.otpRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("OTP_INVALID")
	}
	if time.Since(ch.CreatedAt) > otpResendWindow {
		return nil, errors.New("OTP_EXPIRED")
	}
	if time.Since(ch.CreatedAt) < otpResendGap {
		return nil, errors.New("OTP_RESEND_TOO_SOON")
	}
	user, err := s.userRepo.GetByID(ch.UserID)
	if err != nil {
		return nil, errors.New("OTP_INVALID")
	}
	if user.Status == models.UserStatusSuspended || user.Status == models.UserStatusDeactivated {
		return nil, errors.New("ACCOUNT_SUSPENDED")
	}
	if ch.Purpose == otpPurposeSignup && user.Status == models.UserStatusActive && user.IsVerified() {
		return nil, errors.New("OTP_ALREADY_USED")
	}
	return s.sendWhatsAppCode(user, ch.Purpose)
}

// VerifyWhatsAppCode checks the code of a challenge and opens a session. For
// a pending account it is the activation: status ACTIVE, phone_verified.
func (s *AuthService) VerifyWhatsAppCode(challengeID, code, userAgent, ipAddress string) (*models.LoginResponse, error) {
	if s.otpRepo == nil {
		return nil, errors.New("WHATSAPP_UNAVAILABLE")
	}
	id, err := uuid.Parse(strings.TrimSpace(challengeID))
	if err != nil {
		return nil, errors.New("OTP_INVALID")
	}
	ch, err := s.otpRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("OTP_INVALID")
	}
	if ch.UsedAt != nil {
		return nil, errors.New("OTP_ALREADY_USED")
	}
	if ch.Attempts >= otpMaxAttempts {
		return nil, errors.New("OTP_TOO_MANY_ATTEMPTS")
	}
	if time.Now().After(ch.ExpiresAt) {
		return nil, errors.New("OTP_EXPIRED")
	}

	code = strings.TrimSpace(code)
	expected := hashOTP(ch.ID, code)
	if subtle.ConstantTimeCompare([]byte(expected), []byte(ch.CodeHash)) != 1 {
		attempts, err := s.otpRepo.IncrementAttempts(ch.ID)
		if err == nil && attempts >= otpMaxAttempts {
			return nil, errors.New("OTP_TOO_MANY_ATTEMPTS")
		}
		return nil, errors.New("OTP_INCORRECT")
	}
	if ok, err := s.otpRepo.MarkUsed(ch.ID); err != nil {
		return nil, err
	} else if !ok {
		return nil, errors.New("OTP_ALREADY_USED")
	}

	user, err := s.userRepo.GetByID(ch.UserID)
	if err != nil {
		return nil, errors.New("USER_NOT_FOUND")
	}
	if user.Status == models.UserStatusSuspended || user.Status == models.UserStatusDeactivated {
		return nil, errors.New("ACCOUNT_SUSPENDED")
	}
	if !user.PhoneVerified {
		if err := s.userRepo.UpdatePhoneVerified(user.ID, true); err != nil {
			return nil, fmt.Errorf("failed to mark phone verified: %w", err)
		}
		user.PhoneVerified = true
	}
	if user.Status == models.UserStatusPendingVerification {
		if err := s.userRepo.UpdateStatus(user.ID, models.UserStatusActive); err != nil {
			return nil, fmt.Errorf("failed to activate user: %w", err)
		}
		user.Status = models.UserStatusActive
		// The e-mailed link (if any) is no longer needed.
		if err := s.activationRepo.InvalidateAllForUser(user.ID); err != nil {
			log.Printf("whatsapp-verify: failed to invalidate activation links for %s: %v", user.ID, err)
		}
	}
	return s.generateTokenPair(user, userAgent, ipAddress)
}

// sendWhatsAppCode stores a fresh code for the user and sends it. On a
// delivery failure the challenge is still returned with the error, so the
// caller can offer a resend.
func (s *AuthService) sendWhatsAppCode(user *models.User, purpose string) (*models.WhatsAppChallenge, error) {
	if err := s.otpRepo.InvalidateOpen(user.ID, purpose); err != nil {
		return nil, fmt.Errorf("failed to invalidate previous codes: %w", err)
	}
	code, err := generateOTP()
	if err != nil {
		return nil, err
	}
	ch := &repository.WhatsAppOTPChallenge{
		ID:        uuid.New(),
		UserID:    user.ID,
		Purpose:   purpose,
		Phone:     user.Phone,
		ExpiresAt: time.Now().Add(otpTTL),
	}
	ch.CodeHash = hashOTP(ch.ID, code)
	if err := s.otpRepo.Create(ch); err != nil {
		return nil, err
	}

	challenge := &models.WhatsAppChallenge{
		ChallengeID: ch.ID.String(),
		Channel:     VerificationChannelWhatsApp,
		PhoneMasked: maskPhone(s.whatsapp.NormalizePhone(user.Phone)),
		ExpiresIn:   int(otpTTL.Seconds()),
	}

	text := fmt.Sprintf("BTMI Market : votre code de vérification est %s. Il expire dans %d minutes. Ne le partagez avec personne.\n\nBTMI Market: your verification code is %s.", code, int(otpTTL.Minutes()), code)
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()
	if err := s.whatsapp.SendText(ctx, user.Phone, text); err != nil {
		log.Printf("whatsapp-otp: delivery to user %s failed: %v", user.ID, err)
		return challenge, errors.New("WHATSAPP_DELIVERY_FAILED")
	}
	return challenge, nil
}

func generateOTP() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func hashOTP(challengeID uuid.UUID, code string) string {
	return HashToken(challengeID.String() + ":" + code)
}

// maskPhone keeps the country code and last two digits: +243 ••• ••• •78.
func maskPhone(digits string) string {
	if len(digits) < 6 {
		return "••••"
	}
	return "+" + digits[:3] + " " + strings.Repeat("•", len(digits)-5) + digits[len(digits)-2:]
}

// WhatsAppAvailable tells clients whether to offer the WhatsApp channel.
func (s *AuthService) WhatsAppAvailable() bool { return s.whatsappReady() }
