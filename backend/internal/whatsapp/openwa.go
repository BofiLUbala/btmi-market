// Package whatsapp sends messages through an OpenWA gateway
// (https://github.com/rmyndharis/OpenWA), a self-hosted WhatsApp Web API.
// The gateway holds one linked WhatsApp session; this client only sends text
// on it, for one-time codes.
package whatsapp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/config"
)

// ErrNotConfigured means no gateway is set up, so no code can be delivered.
var ErrNotConfigured = errors.New("WHATSAPP_NOT_CONFIGURED")

type Client struct {
	baseURL     string
	apiKey      string
	sessionID   string
	countryCode string
	devLog      bool
	http        *http.Client
}

func NewClient(cfg *config.Config) *Client {
	return &Client{
		baseURL:     strings.TrimRight(cfg.OpenWAURL, "/"),
		apiKey:      cfg.OpenWAAPIKey,
		sessionID:   cfg.OpenWASessionID,
		countryCode: cfg.WhatsAppDefaultCountryCode,
		// Without a gateway, development and E2E runs print the message to the
		// log instead of failing, like the e-mail service does.
		devLog: cfg.IsDevelopment() || os.Getenv("E2E_TEST_MODE") == "true",
		http:   &http.Client{Timeout: 20 * time.Second},
	}
}

func (c *Client) configured() bool {
	return c.baseURL != "" && c.apiKey != "" && c.sessionID != ""
}

// Available reports whether a message can be delivered (or logged in dev).
func (c *Client) Available() bool { return c.configured() || c.devLog }

// NormalizePhone turns a stored phone ("+243 81 234 5678", "0812345678")
// into the international digits WhatsApp addresses ("243812345678").
func (c *Client) NormalizePhone(phone string) string {
	var b strings.Builder
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	digits := b.String()
	trimmed := strings.TrimSpace(phone)
	switch {
	case strings.HasPrefix(trimmed, "+"):
		return digits
	case strings.HasPrefix(digits, "00"):
		return digits[2:]
	case strings.HasPrefix(digits, "0") && c.countryCode != "":
		return c.countryCode + digits[1:]
	case c.countryCode != "" && len(digits) == 9:
		return c.countryCode + digits
	}
	return digits
}

// SendText sends a plain text message to a phone number.
func (c *Client) SendText(ctx context.Context, phone, text string) error {
	number := c.NormalizePhone(phone)
	if len(number) < 8 {
		return fmt.Errorf("INVALID_PHONE")
	}
	if !c.configured() {
		if c.devLog {
			log.Printf("[DEV MODE] WhatsApp to +%s: %s", number, text)
			return nil
		}
		return ErrNotConfigured
	}

	body, _ := json.Marshal(map[string]string{
		"chatId": number + "@c.us",
		"text":   text,
	})
	endpoint := fmt.Sprintf("%s/api/sessions/%s/messages/send-text", c.baseURL, url.PathEscape(c.sessionID))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("openwa: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("openwa: status %d: %s", resp.StatusCode, strings.TrimSpace(string(detail)))
	}
	return nil
}
