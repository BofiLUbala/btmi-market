package whatsapp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/btmi-ai-market/backend/internal/config"
)

func newCloudForTest(url string) *CloudClient {
	c := NewCloudClient(&config.Config{
		WhatsAppCloudToken: "tok", WhatsAppPhoneNumberID: "123",
		WhatsAppCloudAPIVersion: "v21.0", WhatsAppTemplateLanguage: "fr",
		WhatsAppDefaultCountryCode: "243",
	})
	c.baseURL = url
	return c
}

func TestSendTemplateBuildsCloudRequest(t *testing.T) {
	var path, auth string
	var body map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path, auth = r.URL.Path, r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&body)
		_, _ = w.Write([]byte(`{"messages":[{"id":"wamid.X"}]}`))
	}))
	defer srv.Close()

	id, err := newCloudForTest(srv.URL).SendTemplate(context.Background(), "0812345678", "order_confirmed", "TBK-42", "12 000 FC")
	if err != nil {
		t.Fatal(err)
	}
	if id != "wamid.X" {
		t.Fatalf("id = %q", id)
	}
	if path != "/v21.0/123/messages" || auth != "Bearer tok" {
		t.Fatalf("path=%q auth=%q", path, auth)
	}
	if body["to"] != "243812345678" || body["type"] != "template" || body["messaging_product"] != "whatsapp" {
		t.Fatalf("body = %v", body)
	}
	tpl := body["template"].(map[string]interface{})
	if tpl["name"] != "order_confirmed" || tpl["language"].(map[string]interface{})["code"] != "fr" {
		t.Fatalf("template = %v", tpl)
	}
	params := tpl["components"].([]interface{})[0].(map[string]interface{})["parameters"].([]interface{})
	if len(params) != 2 || params[0].(map[string]interface{})["text"] != "TBK-42" {
		t.Fatalf("params = %v", params)
	}
}

func TestSendTemplateClassifiesRefusals(t *testing.T) {
	cases := []struct {
		status    int
		permanent bool
	}{
		{http.StatusBadRequest, true},
		{http.StatusTooManyRequests, false},
		{http.StatusUnauthorized, false},
		{http.StatusBadGateway, false},
	}
	for _, tc := range cases {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(tc.status)
			_, _ = w.Write([]byte(`{"error":{"message":"nope","code":132001}}`))
		}))
		_, err := newCloudForTest(srv.URL).SendTemplate(context.Background(), "+243812345678", "t")
		srv.Close()
		var ce *CloudError
		if !errors.As(err, &ce) {
			t.Fatalf("status %d: err = %v", tc.status, err)
		}
		if ce.Permanent != tc.permanent || ce.Code != 132001 {
			t.Errorf("status %d: permanent=%v code=%d", tc.status, ce.Permanent, ce.Code)
		}
	}
}

func TestCloudNotConfigured(t *testing.T) {
	c := NewCloudClient(&config.Config{})
	if c.Available() {
		t.Fatal("empty credentials must not be available")
	}
	if _, err := c.SendTemplate(context.Background(), "+243812345678", "t"); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("err = %v", err)
	}
}

func TestSendTemplateRejectsBadPhone(t *testing.T) {
	if _, err := newCloudForTest("http://unused").SendTemplate(context.Background(), "12", "t"); err == nil {
		t.Fatal("expected INVALID_PHONE")
	}
}
