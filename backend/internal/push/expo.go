package push

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
)

// DefaultExpoURL is Expo's push API; it forwards to FCM (Android) and APNs.
const DefaultExpoURL = "https://exp.host/--/api/v2/push"

// ExpoMessage is one message for the Expo push API.
type ExpoMessage struct {
	To        string                 `json:"to"`
	Title     string                 `json:"title,omitempty"`
	Body      string                 `json:"body,omitempty"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Priority  string                 `json:"priority,omitempty"` // default | normal | high
	ChannelID string                 `json:"channelId,omitempty"`
	Sound     string                 `json:"sound,omitempty"`
	TTL       int                    `json:"ttl,omitempty"`
	// CollapseID lets a newer message replace an older one on iOS.
	CollapseID string `json:"collapseId,omitempty"`
}

// ExpoSender talks to the Expo push API.
type ExpoSender struct {
	BaseURL     string
	AccessToken string
	Client      *http.Client
}

func (s *ExpoSender) base() string {
	if s.BaseURL != "" {
		return strings.TrimRight(s.BaseURL, "/")
	}
	return DefaultExpoURL
}

func (s *ExpoSender) post(ctx context.Context, path string, body interface{}, out interface{}) (int, error) {
	raw, err := json.Marshal(body)
	if err != nil {
		return 0, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.base()+path, bytes.NewReader(raw))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if s.AccessToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.AccessToken)
	}
	client := s.Client
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode >= 300 {
		return resp.StatusCode, fmt.Errorf("expo %d: %s", resp.StatusCode, truncate(string(data), 300))
	}
	if out != nil {
		if err := json.Unmarshal(data, out); err != nil {
			return resp.StatusCode, fmt.Errorf("expo response: %w", err)
		}
	}
	return resp.StatusCode, nil
}

type expoTicket struct {
	Status  string `json:"status"`
	ID      string `json:"id"`
	Message string `json:"message"`
	Details struct {
		Error string `json:"error"`
	} `json:"details"`
}

// Send delivers one message and returns Expo's ticket id on success.
func (s *ExpoSender) Send(ctx context.Context, msg ExpoMessage) Result {
	var out struct {
		Data   []expoTicket `json:"data"`
		Errors []struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"errors"`
	}
	status, err := s.post(ctx, "/send", []ExpoMessage{msg}, &out)
	if err != nil {
		if status == 0 || status == http.StatusTooManyRequests || status >= 500 {
			return Result{Err: err, Retry: true}
		}
		return Result{Err: err, Permanent: true}
	}
	if len(out.Data) == 0 {
		if len(out.Errors) > 0 {
			return Result{Err: fmt.Errorf("expo: %s %s", out.Errors[0].Code, out.Errors[0].Message), Retry: true}
		}
		return Result{Err: errors.New("expo: empty response"), Retry: true}
	}
	return ticketResult(out.Data[0])
}

func ticketResult(t expoTicket) Result {
	if t.Status == "ok" {
		return Result{Ticket: t.ID}
	}
	err := fmt.Errorf("expo: %s %s", t.Details.Error, t.Message)
	switch t.Details.Error {
	case "DeviceNotRegistered":
		return Result{Err: err, Gone: true}
	case "MessageRateExceeded":
		return Result{Err: err, Retry: true, RetryAfter: time.Minute}
	}
	return Result{Err: err, Permanent: true}
}

// Receipts asks Expo what became of earlier tickets. The map holds, per
// ticket, the provider error name ("" when delivered).
func (s *ExpoSender) Receipts(ctx context.Context, ids []string) (map[string]string, error) {
	var out struct {
		Data map[string]expoTicket `json:"data"`
	}
	if _, err := s.post(ctx, "/getReceipts", map[string][]string{"ids": ids}, &out); err != nil {
		return nil, err
	}
	res := make(map[string]string, len(out.Data))
	for id, r := range out.Data {
		if r.Status == "ok" {
			res[id] = ""
		} else {
			res[id] = r.Details.Error
			if res[id] == "" {
				res[id] = "Error"
			}
		}
	}
	return res, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
