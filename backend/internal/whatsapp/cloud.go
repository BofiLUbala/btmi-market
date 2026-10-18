package whatsapp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/config"
)

const cloudGraphURL = "https://graph.facebook.com"

// CloudClient sends template messages through the WhatsApp Business Cloud API
// (Meta). Unlike the OpenWA gateway it is the official channel: a business
// can only open a conversation with an approved template, and only to people
// who agreed to receive it (the caller checks consent).
type CloudClient struct {
	baseURL     string
	version     string
	token       string
	phoneID     string
	lang        string
	countryCode string
	http        *http.Client
}

func NewCloudClient(cfg *config.Config) *CloudClient {
	return &CloudClient{
		baseURL:     cloudGraphURL,
		version:     cfg.WhatsAppCloudAPIVersion,
		token:       cfg.WhatsAppCloudToken,
		phoneID:     cfg.WhatsAppPhoneNumberID,
		lang:        cfg.WhatsAppTemplateLanguage,
		countryCode: cfg.WhatsAppDefaultCountryCode,
		http:        &http.Client{Timeout: 20 * time.Second},
	}
}

// Available reports whether the Cloud API credentials are set.
func (c *CloudClient) Available() bool { return c.token != "" && c.phoneID != "" }

// CloudError is a refusal from the Cloud API. Permanent errors (bad number,
// unknown template, no consent window) are not worth retrying.
type CloudError struct {
	Status    int
	Code      int
	Message   string
	Permanent bool
}

func (e *CloudError) Error() string {
	return fmt.Sprintf("whatsapp cloud: status %d, code %d: %s", e.Status, e.Code, e.Message)
}

// SendTemplate sends an approved template with positional body parameters
// ({{1}}, {{2}}...). It returns the message id Meta assigned.
func (c *CloudClient) SendTemplate(ctx context.Context, phone, template string, params ...string) (string, error) {
	if !c.Available() {
		return "", ErrNotConfigured
	}
	to := (&Client{countryCode: c.countryCode}).NormalizePhone(phone)
	if len(to) < 8 {
		return "", fmt.Errorf("INVALID_PHONE")
	}
	if strings.TrimSpace(template) == "" {
		return "", errors.New("whatsapp cloud: empty template name")
	}

	tpl := map[string]interface{}{
		"name":     template,
		"language": map[string]string{"code": c.lang},
	}
	if len(params) > 0 {
		parts := make([]map[string]string, 0, len(params))
		for _, p := range params {
			parts = append(parts, map[string]string{"type": "text", "text": p})
		}
		tpl["components"] = []map[string]interface{}{{"type": "body", "parameters": parts}}
	}
	body, _ := json.Marshal(map[string]interface{}{
		"messaging_product": "whatsapp",
		"to":                to,
		"type":              "template",
		"template":          tpl,
	})

	endpoint := fmt.Sprintf("%s/%s/%s/messages", c.baseURL, c.version, c.phoneID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.token)

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("whatsapp cloud: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))

	if resp.StatusCode >= 300 {
		return "", parseCloudError(resp.StatusCode, raw)
	}
	var ok struct {
		Messages []struct {
			ID string `json:"id"`
		} `json:"messages"`
	}
	_ = json.Unmarshal(raw, &ok)
	if len(ok.Messages) == 0 {
		return "", nil
	}
	return ok.Messages[0].ID, nil
}

func parseCloudError(status int, raw []byte) error {
	var env struct {
		Error struct {
			Message string `json:"message"`
			Code    int    `json:"code"`
		} `json:"error"`
	}
	_ = json.Unmarshal(raw, &env)
	msg := env.Error.Message
	if msg == "" {
		msg = strings.TrimSpace(string(raw))
	}
	return &CloudError{
		Status:  status,
		Code:    env.Error.Code,
		Message: msg,
		// A 4xx other than throttling (429) or an expired token (401) fails the
		// same way next time. Token problems need an operator, not a retry.
		Permanent: status >= 400 && status < 500 && status != http.StatusTooManyRequests && status != http.StatusUnauthorized,
	}
}
