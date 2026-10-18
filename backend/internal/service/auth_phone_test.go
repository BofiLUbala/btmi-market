package service

import (
	"testing"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/btmi-ai-market/backend/internal/whatsapp"
)

// phoneAuthService wires just enough for the checks that run before any
// database access: an OTP repository and a client that logs instead of
// calling the gateway.
func phoneAuthService() *AuthService {
	s := &AuthService{}
	s.SetWhatsApp(&repository.WhatsAppOTPRepository{}, whatsapp.NewClient(&config.Config{
		AppEnv:                     "development",
		WhatsAppDefaultCountryCode: "243",
	}))
	return s
}

func TestStartPhoneAuthNeedsWhatsApp(t *testing.T) {
	_, err := (&AuthService{}).StartPhoneAuth("+243812345678", "", "")
	if err == nil || err.Error() != "WHATSAPP_UNAVAILABLE" {
		t.Fatalf("err = %v, want WHATSAPP_UNAVAILABLE", err)
	}
}

func TestStartPhoneAuthRejectsUnusableNumbers(t *testing.T) {
	// Each of these normalizes to fewer than eight digits, so it is refused
	// before a row is looked up or created.
	for _, phone := range []string{"", "   ", "123", "+1", "abc"} {
		if _, err := phoneAuthService().StartPhoneAuth(phone, "", ""); err == nil || err.Error() != "INVALID_PHONE" {
			t.Errorf("StartPhoneAuth(%q) err = %v, want INVALID_PHONE", phone, err)
		}
	}
}
