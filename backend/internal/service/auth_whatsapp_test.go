package service

import (
	"testing"

	"github.com/google/uuid"
)

func TestGenerateOTPIsSixDigits(t *testing.T) {
	for i := 0; i < 50; i++ {
		code, err := generateOTP()
		if err != nil || len(code) != 6 {
			t.Fatalf("code %q err %v", code, err)
		}
		for _, r := range code {
			if r < '0' || r > '9' {
				t.Fatalf("non-digit in %q", code)
			}
		}
	}
}

func TestHashOTPBindsChallenge(t *testing.T) {
	a, b := uuid.New(), uuid.New()
	if hashOTP(a, "123456") == hashOTP(b, "123456") {
		t.Fatal("same code on two challenges must hash differently")
	}
}

func TestMaskPhone(t *testing.T) {
	if got := maskPhone("243812345678"); got != "+243 •••••••78" {
		t.Fatalf("maskPhone = %q", got)
	}
}

func TestNormalizeChannel(t *testing.T) {
	for in, want := range map[string]string{"": "email", "EMAIL": "email", " whatsapp ": "whatsapp"} {
		if got, err := normalizeChannel(in); err != nil || got != want {
			t.Errorf("normalizeChannel(%q) = %q, %v", in, got, err)
		}
	}
	if _, err := normalizeChannel("sms"); err == nil {
		t.Error("sms must be rejected")
	}
}
