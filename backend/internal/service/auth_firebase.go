package service

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/golang-jwt/jwt/v5"
)

// Firebase Phone Auth sends the SMS itself, from the device: there is no
// server-side send to make. What reaches us is the ID token Firebase hands the
// client once the code checked out, and our only job is to prove that token is
// genuine and read the number out of it.
//
// That needs no Admin SDK. A Firebase ID token is a plain RS256 JWT signed by
// Google, whose public certificates are published at a well-known URL; we
// fetch them, cache them for as long as Google says, and verify the signature
// and the claims here. One fewer dependency, and the whole check is visible.
const (
	VerificationChannelSMS = "sms"

	firebaseCertsURL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
	// Google rotates these daily and sends a max-age of about a day; this is
	// only the floor used when the header is missing or unparsable.
	firebaseCertsMinTTL = time.Hour
	// Tolerance for clock skew between this server and Google's.
	firebaseClockSkew = 2 * time.Minute
)

type firebaseCerts struct {
	mu        sync.RWMutex
	keys      map[string]*rsa.PublicKey
	expiresAt time.Time
}

var googleCerts = &firebaseCerts{}

// SetFirebase wires Firebase SMS codes in. Without a project id the SMS
// channel is refused, exactly as the WhatsApp channel is without a gateway.
func (s *AuthService) SetFirebase(projectID string) {
	s.firebaseProjectID = strings.TrimSpace(projectID)
}

// FirebaseAvailable tells clients whether to offer the SMS channel.
func (s *AuthService) FirebaseAvailable() bool { return s.firebaseProjectID != "" }

// fetch returns Google's current token-signing keys, refreshing them only once
// the cached set has expired.
func (c *firebaseCerts) fetch() (map[string]*rsa.PublicKey, error) {
	c.mu.RLock()
	if time.Now().Before(c.expiresAt) && len(c.keys) > 0 {
		keys := c.keys
		c.mu.RUnlock()
		return keys, nil
	}
	c.mu.RUnlock()

	c.mu.Lock()
	defer c.mu.Unlock()
	// Another goroutine may have refreshed while we waited for the lock.
	if time.Now().Before(c.expiresAt) && len(c.keys) > 0 {
		return c.keys, nil
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(firebaseCertsURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch Google signing certificates: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google signing certificates: unexpected status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("failed to read Google signing certificates: %w", err)
	}

	// {"<kid>": "-----BEGIN CERTIFICATE-----\n...", ...}
	var raw map[string]string
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("failed to parse Google signing certificates: %w", err)
	}
	keys := make(map[string]*rsa.PublicKey, len(raw))
	for kid, certPEM := range raw {
		block, _ := pem.Decode([]byte(certPEM))
		if block == nil {
			continue
		}
		cert, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			continue
		}
		if pub, ok := cert.PublicKey.(*rsa.PublicKey); ok {
			keys[kid] = pub
		}
	}
	if len(keys) == 0 {
		return nil, errors.New("google signing certificates: none usable")
	}

	c.keys = keys
	c.expiresAt = time.Now().Add(certsTTL(resp.Header.Get("Cache-Control")))
	return keys, nil
}

// certsTTL reads max-age out of a Cache-Control header, falling back to the
// floor so a missing or odd header never means refetching on every request.
func certsTTL(cacheControl string) time.Duration {
	for _, part := range strings.Split(cacheControl, ",") {
		part = strings.TrimSpace(part)
		if !strings.HasPrefix(part, "max-age=") {
			continue
		}
		seconds, err := strconv.Atoi(strings.TrimPrefix(part, "max-age="))
		if err != nil || seconds <= 0 {
			break
		}
		if ttl := time.Duration(seconds) * time.Second; ttl > firebaseCertsMinTTL {
			return ttl
		}
		break
	}
	return firebaseCertsMinTTL
}

// firebasePhoneClaims is the part of an ID token we care about. Firebase puts
// the verified number in phone_number once a phone sign-in has succeeded; a
// token from any other provider has no such claim and is refused.
type firebasePhoneClaims struct {
	PhoneNumber string `json:"phone_number"`
	jwt.RegisteredClaims
}

// verifyFirebasePhoneToken checks the signature and the claims Firebase
// documents, and returns the verified E.164 number.
func (s *AuthService) verifyFirebasePhoneToken(idToken string) (string, error) {
	if !s.FirebaseAvailable() {
		return "", errors.New("SMS_UNAVAILABLE")
	}
	idToken = strings.TrimSpace(idToken)
	if idToken == "" {
		return "", errors.New("FIREBASE_TOKEN_INVALID")
	}

	keys, err := googleCerts.fetch()
	if err != nil {
		log.Printf("firebase-auth: %v", err)
		return "", errors.New("SMS_UNAVAILABLE")
	}

	claims := &firebasePhoneClaims{}
	_, err = jwt.ParseWithClaims(idToken, claims, func(token *jwt.Token) (any, error) {
		// Only a key id Google published: without this check a token could
		// name a key we never saw and verify against nothing.
		kid, _ := token.Header["kid"].(string)
		key, ok := keys[kid]
		if !ok {
			return nil, fmt.Errorf("unknown key id %q", kid)
		}
		return key, nil
	},
		jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}),
		jwt.WithIssuer("https://securetoken.google.com/"+s.firebaseProjectID),
		jwt.WithAudience(s.firebaseProjectID),
		jwt.WithLeeway(firebaseClockSkew),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		log.Printf("firebase-auth: token rejected: %v", err)
		return "", errors.New("FIREBASE_TOKEN_INVALID")
	}

	// The subject is the Firebase uid; an empty one means this is not a user
	// token at all.
	if strings.TrimSpace(claims.Subject) == "" {
		return "", errors.New("FIREBASE_TOKEN_INVALID")
	}
	phone := strings.TrimSpace(claims.PhoneNumber)
	if phone == "" {
		return "", errors.New("FIREBASE_PHONE_MISSING")
	}
	if !strings.HasPrefix(phone, "+") || len(phone) < 8 {
		return "", errors.New("INVALID_PHONE")
	}
	return phone, nil
}

// SignInWithFirebasePhone opens a session for a number Firebase has just
// verified by SMS. As with the WhatsApp channel, a number nobody holds is
// registered on the spot: the client never has to know in advance whether the
// person is new, and the answer looks the same either way.
func (s *AuthService) SignInWithFirebasePhone(idToken, firstName, lastName, userAgent, ipAddress string) (*models.LoginResponse, error) {
	phone, err := s.verifyFirebasePhoneToken(idToken)
	if err != nil {
		return nil, err
	}

	user, err := s.userRepo.GetByPhone(phone)
	switch {
	case err == nil:
		if user.Status == models.UserStatusSuspended || user.Status == models.UserStatusDeactivated {
			return nil, errors.New("ACCOUNT_SUSPENDED")
		}
	case errors.Is(err, repository.ErrUserNotFound):
		user, err = s.createPhoneOnlyUser(phone, firstName, lastName)
		if err != nil {
			return nil, err
		}
	default:
		return nil, err
	}

	// The SMS code proves the number, so it carries the same weight as a
	// WhatsApp code: it verifies the phone and activates a pending account.
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
		if err := s.activationRepo.InvalidateAllForUser(user.ID); err != nil {
			log.Printf("firebase-auth: failed to invalidate activation links for %s: %v", user.ID, err)
		}
	}
	return s.generateTokenPair(user, userAgent, ipAddress)
}

// StartFirebasePasswordReset is "forgot my password" by phone. The SMS code
// has already proved the number, so instead of mailing a link we hand back a
// reset token directly; the client then uses the ordinary reset endpoint.
//
// An unknown number gets an empty token and no error, so this endpoint cannot
// be used to find out which numbers have an account here.
func (s *AuthService) StartFirebasePasswordReset(idToken string) (string, error) {
	phone, err := s.verifyFirebasePhoneToken(idToken)
	if err != nil {
		return "", err
	}

	user, err := s.userRepo.GetByPhone(phone)
	if err != nil {
		log.Printf("[forgot-password] no account for a verified number")
		return "", nil
	}
	if user.Status != models.UserStatusActive && user.Status != models.UserStatusPendingVerification {
		return "", nil
	}

	if err := s.passwordResetRepo.InvalidateAllForUser(user.ID); err != nil {
		return "", fmt.Errorf("failed to invalidate old tokens: %w", err)
	}
	rawToken, err := GenerateSecureToken(32)
	if err != nil {
		return "", err
	}
	resetToken := &models.PasswordResetToken{
		UserID:    user.ID,
		TokenHash: HashToken(rawToken),
		// Shorter than the e-mailed link: the holder is already on the screen
		// that will use it.
		ExpiresAt: time.Now().Add(15 * time.Minute),
	}
	if err := s.passwordResetRepo.Create(resetToken); err != nil {
		return "", err
	}
	return rawToken, nil
}
