package service

import (
	"crypto/rand"
	"crypto/rsa"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testProjectID = "btmi-test-project"

// primeCerts puts a key we control into the cache Google's certificates would
// otherwise fill, so the whole verification runs without a network call.
func primeCerts(t *testing.T, kid string, key *rsa.PublicKey) {
	t.Helper()
	googleCerts.mu.Lock()
	previousKeys, previousExpiry := googleCerts.keys, googleCerts.expiresAt
	googleCerts.keys = map[string]*rsa.PublicKey{kid: key}
	googleCerts.expiresAt = time.Now().Add(time.Hour)
	googleCerts.mu.Unlock()

	t.Cleanup(func() {
		googleCerts.mu.Lock()
		googleCerts.keys, googleCerts.expiresAt = previousKeys, previousExpiry
		googleCerts.mu.Unlock()
	})
}

type tokenOverrides struct {
	issuer    string
	audience  string
	subject   string
	phone     string
	expiresAt time.Time
	kid       string
	method    jwt.SigningMethod
	hmacKey   []byte
}

// signToken builds a token that is valid unless an override spoils it, which
// keeps each test about the one claim it is checking.
func signToken(t *testing.T, key *rsa.PrivateKey, o tokenOverrides) string {
	t.Helper()
	claims := &firebasePhoneClaims{
		PhoneNumber: orDefault(o.phone, "+243970000000"),
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    orDefault(o.issuer, "https://securetoken.google.com/"+testProjectID),
			Audience:  jwt.ClaimStrings{orDefault(o.audience, testProjectID)},
			Subject:   orDefault(o.subject, "firebase-uid-123"),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-time.Minute)),
			ExpiresAt: jwt.NewNumericDate(o.expiresAt),
		},
	}
	if o.expiresAt.IsZero() {
		claims.ExpiresAt = jwt.NewNumericDate(time.Now().Add(time.Hour))
	}

	method := o.method
	if method == nil {
		method = jwt.SigningMethodRS256
	}
	token := jwt.NewWithClaims(method, claims)
	token.Header["kid"] = orDefault(o.kid, "test-kid")

	var signed string
	var err error
	if o.hmacKey != nil {
		signed, err = token.SignedString(o.hmacKey)
	} else {
		signed, err = token.SignedString(key)
	}
	if err != nil {
		t.Fatalf("failed to sign test token: %v", err)
	}
	return signed
}

// orDefault deliberately does not trim, unlike the package's firstNonEmpty: a
// claim holding only a space is a blank claim, and the tests rely on being
// able to send exactly that.
func orDefault(value, fallback string) string {
	if value != "" {
		return value
	}
	return fallback
}

func TestVerifyFirebasePhoneToken(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate test key: %v", err)
	}
	primeCerts(t, "test-kid", &key.PublicKey)

	service := &AuthService{firebaseProjectID: testProjectID}

	t.Run("accepts a genuine token and returns the number", func(t *testing.T) {
		phone, err := service.verifyFirebasePhoneToken(signToken(t, key, tokenOverrides{}))
		if err != nil {
			t.Fatalf("expected the token to be accepted, got %v", err)
		}
		if phone != "+243970000000" {
			t.Fatalf("expected the phone number from the claim, got %q", phone)
		}
	})

	// Every rejection answers with a code the handler maps to a status, so the
	// table checks the code and not just that something failed.
	rejections := []struct {
		name      string
		overrides tokenOverrides
		wantCode  string
	}{
		{
			name:      "another project's token",
			overrides: tokenOverrides{audience: "someone-elses-project", issuer: "https://securetoken.google.com/someone-elses-project"},
			wantCode:  "FIREBASE_TOKEN_INVALID",
		},
		{
			// Audience right, issuer wrong: a token minted elsewhere and
			// replayed at us must not pass on the audience alone.
			name:      "issuer not Google's token service",
			overrides: tokenOverrides{issuer: "https://evil.example.com/" + testProjectID},
			wantCode:  "FIREBASE_TOKEN_INVALID",
		},
		{
			name:      "expired",
			overrides: tokenOverrides{expiresAt: time.Now().Add(-time.Hour)},
			wantCode:  "FIREBASE_TOKEN_INVALID",
		},
		{
			name:      "signed with a key Google never published",
			overrides: tokenOverrides{kid: "unknown-kid"},
			wantCode:  "FIREBASE_TOKEN_INVALID",
		},
		{
			// The classic downgrade: claim HMAC so the public key would be
			// read as the shared secret.
			name:      "algorithm swapped to HMAC",
			overrides: tokenOverrides{method: jwt.SigningMethodHS256, hmacKey: []byte("not-the-real-key")},
			wantCode:  "FIREBASE_TOKEN_INVALID",
		},
		{
			name:      "no subject",
			overrides: tokenOverrides{subject: " "},
			wantCode:  "FIREBASE_TOKEN_INVALID",
		},
		{
			// A token from another provider (Google sign-in, e-mail link)
			// carries no phone_number.
			name:      "not a phone sign-in",
			overrides: tokenOverrides{phone: " "},
			wantCode:  "FIREBASE_PHONE_MISSING",
		},
		{
			name:      "phone not in E.164",
			overrides: tokenOverrides{phone: "0970000000"},
			wantCode:  "INVALID_PHONE",
		},
		{
			name:      "phone too short to be a number",
			overrides: tokenOverrides{phone: "+243"},
			wantCode:  "INVALID_PHONE",
		},
	}

	for _, tt := range rejections {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.verifyFirebasePhoneToken(signToken(t, key, tt.overrides))
			if err == nil {
				t.Fatalf("expected %s, got a valid token", tt.wantCode)
			}
			if err.Error() != tt.wantCode {
				t.Fatalf("expected %s, got %v", tt.wantCode, err)
			}
		})
	}

	t.Run("empty token", func(t *testing.T) {
		if _, err := service.verifyFirebasePhoneToken("   "); err == nil || err.Error() != "FIREBASE_TOKEN_INVALID" {
			t.Fatalf("expected FIREBASE_TOKEN_INVALID, got %v", err)
		}
	})

	t.Run("no project configured refuses before touching the token", func(t *testing.T) {
		unconfigured := &AuthService{}
		if unconfigured.FirebaseAvailable() {
			t.Fatal("an empty project id must not count as available")
		}
		if _, err := unconfigured.verifyFirebasePhoneToken(signToken(t, key, tokenOverrides{})); err == nil || err.Error() != "SMS_UNAVAILABLE" {
			t.Fatalf("expected SMS_UNAVAILABLE, got %v", err)
		}
	})
}

func TestSetFirebaseTrimsAndEnables(t *testing.T) {
	service := &AuthService{}
	service.SetFirebase("  " + testProjectID + "  ")
	if service.firebaseProjectID != testProjectID {
		t.Fatalf("expected the project id to be trimmed, got %q", service.firebaseProjectID)
	}
	if !service.FirebaseAvailable() {
		t.Fatal("expected the SMS channel to be available once a project is set")
	}

	service.SetFirebase("   ")
	if service.FirebaseAvailable() {
		t.Fatal("expected blank-only configuration to leave the channel off")
	}
}

func TestCertsTTL(t *testing.T) {
	tests := []struct {
		name, header string
		want         time.Duration
	}{
		{"max-age is honoured", "public, max-age=19853, must-revalidate, no-transform", 19853 * time.Second},
		{"no header falls back to the floor", "", firebaseCertsMinTTL},
		{"unrelated directives fall back", "no-cache, no-store", firebaseCertsMinTTL},
		{"unparsable max-age falls back", "max-age=soon", firebaseCertsMinTTL},
		{"zero max-age falls back", "max-age=0", firebaseCertsMinTTL},
		{"negative max-age falls back", "max-age=-5", firebaseCertsMinTTL},
		{"a short max-age never goes below the floor", "max-age=30", firebaseCertsMinTTL},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := certsTTL(tt.header); got != tt.want {
				t.Fatalf("certsTTL(%q) = %v, want %v", tt.header, got, tt.want)
			}
		})
	}
}
