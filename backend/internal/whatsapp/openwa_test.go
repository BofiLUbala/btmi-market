package whatsapp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/btmi-ai-market/backend/internal/config"
)

func TestNormalizePhone(t *testing.T) {
	c := &Client{countryCode: "243"}
	cases := map[string]string{
		"+243 81 234 5678":  "243812345678",
		"0812345678":        "243812345678",
		"812345678":         "243812345678",
		"00243812345678":    "243812345678",
		"243812345678":      "243812345678",
		"+33 6 12 34 56 78": "33612345678",
	}
	for in, want := range cases {
		if got := c.NormalizePhone(in); got != want {
			t.Errorf("NormalizePhone(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSendTextCallsOpenWA(t *testing.T) {
	var gotPath, gotKey string
	var gotBody map[string]string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath, gotKey = r.URL.Path, r.Header.Get("X-API-Key")
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.WriteHeader(http.StatusCreated)
	}))
	defer srv.Close()

	c := NewClient(&config.Config{AppEnv: "production", OpenWAURL: srv.URL + "/", OpenWAAPIKey: "k1", OpenWASessionID: "s1", WhatsAppDefaultCountryCode: "243"})
	if err := c.SendText(context.Background(), "0812345678", "hello"); err != nil {
		t.Fatal(err)
	}
	if gotPath != "/api/sessions/s1/messages/send-text" || gotKey != "k1" {
		t.Fatalf("path=%q key=%q", gotPath, gotKey)
	}
	if gotBody["chatId"] != "243812345678@c.us" || gotBody["text"] != "hello" {
		t.Fatalf("body=%v", gotBody)
	}
}

func TestSendTextReportsGatewayError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"message":"session not ready"}`, http.StatusConflict)
	}))
	defer srv.Close()
	c := NewClient(&config.Config{AppEnv: "production", OpenWAURL: srv.URL, OpenWAAPIKey: "k", OpenWASessionID: "s"})
	if err := c.SendText(context.Background(), "+243812345678", "x"); err == nil {
		t.Fatal("expected an error")
	}
}

func TestNotConfiguredOutsideDevelopment(t *testing.T) {
	c := NewClient(&config.Config{AppEnv: "production"})
	if c.Available() {
		t.Fatal("unconfigured production client must not be available")
	}
	if err := c.SendText(context.Background(), "+243812345678", "x"); err != ErrNotConfigured {
		t.Fatalf("err = %v", err)
	}
}
