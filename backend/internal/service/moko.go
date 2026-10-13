package service

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// Moko Afrika (FreshPay / PayDRC) is the operator aggregator behind TBK's mobile
// money: one API for M-Pesa, Airtel Money, Orange Money and Afrimoney. Every
// call is a POST to one endpoint whose `action` picks the operation:
//
//	debit  - ask a buyer's handset to approve a payment into TBK's account
//	credit - send money from TBK's account to a phone (seller payout, refund)
//	verify - read a transaction's state
//
// The first answer only acknowledges the request; the outcome arrives later on
// the signed, encrypted callback (see DecodeCallback).
//
// Points the public documentation leaves open, handled defensively here and to
// be confirmed with Moko before going live: the callback cipher (AES-CBC with
// the key as IV in their samples), which bytes X-Signature covers, and whether
// the final status reads "Success" or "Successful".

// MokoConfig is read from the environment. An empty MerchantID leaves Moko off.
type MokoConfig struct {
	BaseURL        string // e.g. https://paydrc.gofreshbakery.net/api/v5
	MerchantID     string
	MerchantSecret string
	CallbackURL    string // public URL of POST /api/v1/webhooks/moko
	CallbackSecret string // key for X-Signature and the callback cipher
	PayerEmail     string // Moko requires an e-mail on every request
}

func (c MokoConfig) Enabled() bool {
	return strings.TrimSpace(c.MerchantID) != "" && strings.TrimSpace(c.MerchantSecret) != ""
}

// MokoClient talks to the Moko API.
type MokoClient struct {
	cfg  MokoConfig
	http *http.Client

	mu          sync.Mutex
	token       string
	tokenExpiry time.Time
}

func NewMokoClient(cfg MokoConfig) *MokoClient {
	cfg.BaseURL = strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://paydrc.gofreshbakery.net/api/v5"
	}
	if strings.TrimSpace(cfg.PayerEmail) == "" {
		cfg.PayerEmail = "paiements@tbkmarket.com"
	}
	return &MokoClient{cfg: cfg, http: &http.Client{Timeout: 30 * time.Second}}
}

// mokoMethod maps TBK's operator codes to Moko's `method` values.
func mokoMethod(provider string) (string, bool) {
	switch strings.ToUpper(strings.TrimSpace(provider)) {
	case models.PaymentProviderMPesa:
		return "mpesa", true
	case models.PaymentProviderAirtelMoney:
		return "airtel", true
	case models.PaymentProviderOrangeMoney:
		return "orange", true
	case models.PaymentProviderAfrimoney:
		return "africell", true
	}
	return "", false
}

// mokoAmount sends amounts as the API's examples do: a string, without trailing
// zeros (100, 12.5).
func mokoAmount(v float64) string {
	return strconv.FormatFloat(models.RoundMoney(v), 'f', -1, 64)
}

// bearer fetches (and caches) the JWT the token endpoint issues. The examples
// also send the merchant credentials in every body, so a token failure is not
// fatal: the request still carries them.
func (c *MokoClient) bearer() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.token != "" && time.Now().Before(c.tokenExpiry) {
		return c.token
	}
	body, _ := json.Marshal(map[string]string{"merchant_id": c.cfg.MerchantID, "merchant_secrete": c.cfg.MerchantSecret})
	resp, err := c.http.Post(c.cfg.BaseURL+"/token", "application/json", bytes.NewReader(body))
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	var out map[string]interface{}
	if json.NewDecoder(resp.Body).Decode(&out) != nil {
		return ""
	}
	if tok, ok := out["token"].(string); ok && tok != "" {
		c.token = tok
		c.tokenExpiry = time.Now().Add(45 * time.Minute)
	}
	return c.token
}

// CheckCredentials asks the token endpoint whether Moko accepts the merchant
// credentials. It never changes state and is meant for a startup log line.
func (c *MokoClient) CheckCredentials() error {
	body, _ := json.Marshal(map[string]string{"merchant_id": c.cfg.MerchantID, "merchant_secrete": c.cfg.MerchantSecret})
	resp, err := c.http.Post(c.cfg.BaseURL+"/token", "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("MOKO_UNREACHABLE: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	var out map[string]interface{}
	_ = json.Unmarshal(raw, &out)
	if resp.StatusCode >= 300 {
		return fmt.Errorf("MOKO_HTTP_%d: credentials refused: %s", resp.StatusCode, truncate(string(raw), 200))
	}
	if tok, _ := out["token"].(string); tok == "" {
		return fmt.Errorf("MOKO_NO_TOKEN: %s", truncate(string(raw), 200))
	}
	return nil
}

// call posts one action and returns the decoded answer.
func (c *MokoClient) call(payload map[string]string) (map[string]interface{}, error) {
	payload["merchant_id"] = c.cfg.MerchantID
	payload["merchant_secrete"] = c.cfg.MerchantSecret
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, c.cfg.BaseURL+"/", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if tok := c.bearer(); tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("MOKO_UNREACHABLE: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	var out map[string]interface{}
	_ = json.Unmarshal(raw, &out)
	if resp.StatusCode >= 300 {
		return out, fmt.Errorf("MOKO_HTTP_%d: %s", resp.StatusCode, truncate(string(raw), 200))
	}
	if out == nil {
		return nil, fmt.Errorf("MOKO_BAD_RESPONSE: %s", truncate(string(raw), 200))
	}
	// An acknowledged request carries Status "Success"; anything that says it
	// failed is refused here rather than waited on.
	if status := strings.ToLower(field(out, "Status", "status")); strings.Contains(status, "fail") || strings.Contains(status, "error") {
		return out, fmt.Errorf("MOKO_REJECTED: %s", firstNonEmpty(field(out, "Comment", "comment", "message", "Status_Description"), status))
	}
	return out, nil
}

// transfer runs a debit or credit and returns Moko's own reference.
func (c *MokoClient) transfer(action, provider, phone, reference string, amount float64, currency string) (string, error) {
	method, ok := mokoMethod(provider)
	if !ok {
		return "", errors.New("MOKO_UNSUPPORTED_PROVIDER")
	}
	msisdn := NormalizeCongoPhone(phone)
	if msisdn == "" {
		return "", errors.New("MOKO_INVALID_PHONE")
	}
	out, err := c.call(map[string]string{
		"action": action, "method": method, "customer_number": msisdn,
		"amount": mokoAmount(amount), "currency": strings.ToUpper(currency),
		"reference": reference, "callback_url": c.cfg.CallbackURL,
		"firstname": "Client", "lastname": "TBK", "e-mail": c.cfg.PayerEmail,
	})
	if err != nil {
		return "", err
	}
	return firstNonEmpty(field(out, "PayDRC_Reference", "Transaction_id", "transaction_id", "Reference"), reference), nil
}

// Verify asks Moko for a transaction's current state, by our reference.
func (c *MokoClient) Verify(reference string) (*MokoResult, error) {
	out, err := c.call(map[string]string{"action": "verify", "reference": reference})
	if err != nil {
		return nil, err
	}
	return resultFrom(out), nil
}

/* ── Drivers ──────────────────────────────────────────────── */

// MokoChargeDriver raises buyer payments through Moko's debit.
type MokoChargeDriver struct {
	client  *MokoClient
	enabled map[string]bool
}

func NewMokoChargeDriver(client *MokoClient, providers []models.PaymentProvider) *MokoChargeDriver {
	enabled := map[string]bool{}
	for _, p := range providers {
		if p.Enabled {
			enabled[p.Code] = true
		}
	}
	return &MokoChargeDriver{client: client, enabled: enabled}
}

func (d *MokoChargeDriver) Supports(provider string) bool {
	return d.enabled[strings.ToUpper(strings.TrimSpace(provider))]
}

// mokoPaymentReference carries the payment id, so the callback finds the
// payment without a lookup table. The suffix keeps a retried charge unique.
func mokoPaymentReference(paymentID string) string {
	return "PY-" + paymentID + "-" + uuid.NewString()[:6]
}

func (d *MokoChargeDriver) Charge(request PaymentChargeRequest) (*models.PaymentInitiation, error) {
	provider := strings.ToUpper(strings.TrimSpace(request.Provider))
	if !d.Supports(provider) {
		return nil, errors.New("PAYMENT_PROVIDER_NOT_CONFIGURED")
	}
	if strings.TrimSpace(request.PayerPhone) == "" {
		return nil, errors.New("PAYER_PHONE_REQUIRED")
	}
	if request.Amount <= 0 {
		return nil, errors.New("INVALID_PAYMENT_AMOUNT")
	}
	reference := mokoPaymentReference(request.PaymentID)
	operatorRef, err := d.client.transfer("debit", provider, request.PayerPhone, reference, request.Amount, request.Currency)
	if err != nil {
		return nil, err
	}
	return &models.PaymentInitiation{
		Status:       string(models.BuyerPaymentStatusProcessing),
		Provider:     provider,
		Reference:    operatorRef,
		Amount:       request.Amount,
		Currency:     request.Currency,
		Instructions: providerInstruction(provider),
	}, nil
}

// MokoPayoutDriver sends seller payouts and buyer refunds through Moko's credit.
type MokoPayoutDriver struct{ client *MokoClient }

func NewMokoPayoutDriver(client *MokoClient) *MokoPayoutDriver { return &MokoPayoutDriver{client: client} }

func (d *MokoPayoutDriver) Send(t PayoutTransfer) (string, bool, error) {
	ref, err := d.client.transfer("credit", t.Provider, t.Phone, t.Reference, t.Amount, t.Currency)
	if err != nil {
		return "", false, err
	}
	return ref, true, nil
}

/* ── Callback ─────────────────────────────────────────────── */

// MokoResult is a transaction outcome, from a callback or a verify.
type MokoResult struct {
	Action            string
	Reference         string // ours: PY-…, PO-…, RF-…
	OperatorRef       string // PayDRC_Reference
	Succeeded         bool
	Failed            bool
	Amount            float64
	Currency          string
	Method            string
	StatusText        string
	StatusDescription string
}

func resultFrom(m map[string]interface{}) *MokoResult {
	status := firstNonEmpty(field(m, "Trans_Status", "trans_status"), field(m, "Status", "status"))
	lower := strings.ToLower(status)
	amount, _ := strconv.ParseFloat(strings.TrimSpace(field(m, "Amount", "amount")), 64)
	return &MokoResult{
		Action:            field(m, "Action", "action"),
		Reference:         field(m, "Reference", "reference"),
		OperatorRef:       field(m, "PayDRC_Reference", "Transaction_id", "transaction_id"),
		Succeeded:         strings.HasPrefix(lower, "success"),
		Failed:            strings.Contains(lower, "fail") || strings.Contains(lower, "cancel") || strings.Contains(lower, "reject"),
		Amount:            amount,
		Currency:          strings.ToUpper(field(m, "Currency", "currency")),
		Method:            field(m, "Method", "method"),
		StatusText:        status,
		StatusDescription: field(m, "Trans_Status_Description", "Status_Description", "Comment"),
	}
}

// ErrMokoSignature and ErrMokoPayload let the HTTP handler answer 401 and 400,
// the codes Moko's documentation asks for.
var (
	ErrMokoSignature = errors.New("MOKO_INVALID_SIGNATURE")
	ErrMokoPayload   = errors.New("MOKO_INVALID_PAYLOAD")
)

// DecodeCallback checks X-Signature (HMAC-SHA256 with the callback secret)
// and decrypts the `data` field. The signature is accepted over the raw body
// or over the `data` string, since the documentation does not say which.
func (c *MokoClient) DecodeCallback(rawBody []byte, signature string) (*MokoResult, error) {
	secret := c.cfg.CallbackSecret
	if strings.TrimSpace(secret) == "" {
		return nil, ErrMokoSignature
	}
	var envelope map[string]interface{}
	if json.Unmarshal(rawBody, &envelope) != nil {
		return nil, ErrMokoPayload
	}
	data, _ := envelope["data"].(string)
	if !hmacMatches(secret, rawBody, signature) && !(data != "" && hmacMatches(secret, []byte(data), signature)) {
		return nil, ErrMokoSignature
	}
	if data == "" {
		// Not encrypted: the fields are in the body itself.
		return resultFrom(envelope), nil
	}
	plain, err := decryptMoko(secret, data)
	if err != nil {
		return nil, ErrMokoPayload
	}
	var fields map[string]interface{}
	if json.Unmarshal(plain, &fields) != nil {
		return nil, ErrMokoPayload
	}
	return resultFrom(fields), nil
}

func hmacMatches(secret string, message []byte, signature string) bool {
	sig := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(signature), "sha256="))
	if sig == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(message)
	sum := mac.Sum(nil)
	if decoded, err := hex.DecodeString(sig); err == nil && hmac.Equal(decoded, sum) {
		return true
	}
	if decoded, err := base64.StdEncoding.DecodeString(sig); err == nil && hmac.Equal(decoded, sum) {
		return true
	}
	return false
}

// decryptMoko undoes the callback cipher: AES-CBC, PKCS#7, base64. The key is
// the secret itself when it is a valid AES key length, otherwise its SHA-256;
// the IV is the key's first 16 bytes as in Moko's samples, falling back to an
// IV prepended to the ciphertext.
func decryptMoko(secret, data string) ([]byte, error) {
	cipherText, err := base64.StdEncoding.DecodeString(strings.TrimSpace(data))
	if err != nil {
		return nil, err
	}
	key := []byte(secret)
	if n := len(key); n != 16 && n != 24 && n != 32 {
		sum := sha256.Sum256(key)
		key = sum[:]
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	try := func(iv, ct []byte) ([]byte, error) {
		if len(ct) == 0 || len(ct)%aes.BlockSize != 0 {
			return nil, errors.New("bad length")
		}
		out := make([]byte, len(ct))
		cipher.NewCBCDecrypter(block, iv).CryptBlocks(out, ct)
		return pkcs7Unpad(out)
	}
	if plain, err := try(key[:aes.BlockSize], cipherText); err == nil && json.Valid(plain) {
		return plain, nil
	}
	if len(cipherText) > aes.BlockSize {
		if plain, err := try(cipherText[:aes.BlockSize], cipherText[aes.BlockSize:]); err == nil && json.Valid(plain) {
			return plain, nil
		}
	}
	return nil, errors.New("cannot decrypt")
}

func pkcs7Unpad(b []byte) ([]byte, error) {
	if len(b) == 0 {
		return nil, errors.New("empty")
	}
	n := int(b[len(b)-1])
	if n == 0 || n > aes.BlockSize || n > len(b) {
		return nil, errors.New("bad padding")
	}
	for _, p := range b[len(b)-n:] {
		if int(p) != n {
			return nil, errors.New("bad padding")
		}
	}
	return b[:len(b)-n], nil
}

// field reads the first present key as a string, whatever its JSON type.
func field(m map[string]interface{}, keys ...string) string {
	for _, k := range keys {
		switch v := m[k].(type) {
		case string:
			if strings.TrimSpace(v) != "" {
				return strings.TrimSpace(v)
			}
		case float64:
			return strconv.FormatFloat(v, 'f', -1, 64)
		}
	}
	return ""
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func truncate(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}
