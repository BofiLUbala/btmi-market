package push

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// VAPID identifies this server to browser push services (RFC 8292).
type VAPID struct {
	priv      *ecdsa.PrivateKey
	PublicKey string // uncompressed P-256 point, base64url: the browser's applicationServerKey
	KeyID     string // short fingerprint stored with subscriptions made with this key
	Subject   string

	mu   sync.Mutex
	jwts map[string]cachedJWT
}

type cachedJWT struct {
	token string
	exp   time.Time
}

var b64 = base64.RawURLEncoding

// decodeB64 accepts base64url with or without padding (browsers differ).
func decodeB64(s string) ([]byte, error) {
	for len(s)%4 != 0 && len(s) > 0 && s[len(s)-1] == '=' {
		s = s[:len(s)-1]
	}
	if out, err := b64.DecodeString(s); err == nil {
		return out, nil
	}
	return base64.StdEncoding.DecodeString(s)
}

// GenerateVAPID creates a new key pair; the private key is returned as
// base64url of its 32-byte scalar.
func GenerateVAPID() (privateKey string, err error) {
	k, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return "", err
	}
	raw, err := k.Bytes()
	if err != nil {
		return "", err
	}
	return b64.EncodeToString(raw), nil
}

// NewVAPID loads a key pair from its base64url private scalar.
func NewVAPID(privateKey, subject string) (*VAPID, error) {
	raw, err := decodeB64(privateKey)
	if err != nil {
		return nil, fmt.Errorf("vapid private key: %w", err)
	}
	k, err := ecdsa.ParseRawPrivateKey(elliptic.P256(), raw)
	if err != nil {
		return nil, fmt.Errorf("vapid private key: %w", err)
	}
	pub, err := k.PublicKey.Bytes()
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256(pub)
	if subject == "" {
		subject = "mailto:support@tbkmarket.com"
	}
	return &VAPID{
		priv:      k,
		PublicKey: b64.EncodeToString(pub),
		KeyID:     hex.EncodeToString(sum[:8]),
		Subject:   subject,
		jwts:      map[string]cachedJWT{},
	}, nil
}

// authorization returns the VAPID header for a push service origin. Tokens
// are reused for an hour (they are valid for twelve).
func (v *VAPID) authorization(endpoint string) (string, error) {
	u, err := url.Parse(endpoint)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return "", errors.New("invalid endpoint")
	}
	aud := u.Scheme + "://" + u.Host
	v.mu.Lock()
	defer v.mu.Unlock()
	if c, ok := v.jwts[aud]; ok && time.Until(c.exp) > 11*time.Hour {
		return "vapid t=" + c.token + ", k=" + v.PublicKey, nil
	}
	exp := time.Now().Add(12 * time.Hour)
	tok, err := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{
		"aud": aud,
		"exp": exp.Unix(),
		"sub": v.Subject,
	}).SignedString(v.priv)
	if err != nil {
		return "", err
	}
	v.jwts[aud] = cachedJWT{token: tok, exp: exp}
	return "vapid t=" + tok + ", k=" + v.PublicKey, nil
}

// recordSize is the aes128gcm record size announced in the header. Payloads
// are far below it, so the message is always a single record.
const recordSize = 4096

// Encrypt encrypts plaintext for a browser subscription (RFC 8291 with the
// aes128gcm content coding of RFC 8188).
func Encrypt(plaintext []byte, p256dh, authSecret string) ([]byte, error) {
	uaPublic, err := decodeB64(p256dh)
	if err != nil {
		return nil, fmt.Errorf("p256dh: %w", err)
	}
	auth, err := decodeB64(authSecret)
	if err != nil {
		return nil, fmt.Errorf("auth: %w", err)
	}
	salt := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return nil, err
	}
	asPrivate, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	return encryptWith(plaintext, uaPublic, auth, salt, asPrivate)
}

func encryptWith(plaintext, uaPublicRaw, auth, salt []byte, asPrivate *ecdh.PrivateKey) ([]byte, error) {
	uaPublic, err := ecdh.P256().NewPublicKey(uaPublicRaw)
	if err != nil {
		return nil, fmt.Errorf("p256dh: %w", err)
	}
	if len(auth) != 16 {
		return nil, errors.New("auth secret must be 16 bytes")
	}
	shared, err := asPrivate.ECDH(uaPublic)
	if err != nil {
		return nil, err
	}
	asPublic := asPrivate.PublicKey().Bytes()

	// IKM = HKDF(auth, shared, "WebPush: info" || 0 || ua_public || as_public, 32)
	prkKey, err := hkdf.Extract(sha256.New, shared, auth)
	if err != nil {
		return nil, err
	}
	keyInfo := append(append([]byte("WebPush: info\x00"), uaPublicRaw...), asPublic...)
	ikm, err := hkdf.Expand(sha256.New, prkKey, string(keyInfo), 32)
	if err != nil {
		return nil, err
	}

	prk, err := hkdf.Extract(sha256.New, ikm, salt)
	if err != nil {
		return nil, err
	}
	cek, err := hkdf.Expand(sha256.New, prk, "Content-Encoding: aes128gcm\x00", 16)
	if err != nil {
		return nil, err
	}
	nonce, err := hkdf.Expand(sha256.New, prk, "Content-Encoding: nonce\x00", 12)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(cek)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	// 0x02 marks the last (and only) record; no padding.
	record := append(append([]byte{}, plaintext...), 0x02)
	if len(record)+16 > recordSize {
		return nil, errors.New("payload too large")
	}
	ciphertext := gcm.Seal(nil, nonce, record, nil)

	var header bytes.Buffer
	header.Write(salt)
	_ = binary.Write(&header, binary.BigEndian, uint32(recordSize))
	header.WriteByte(byte(len(asPublic)))
	header.Write(asPublic)
	return append(header.Bytes(), ciphertext...), nil
}

// WebSubscription is a browser's push subscription.
type WebSubscription struct {
	Endpoint string
	P256dh   string
	Auth     string
}

// WebOptions are the per-message delivery hints.
type WebOptions struct {
	TTL     time.Duration
	Urgency string // very-low | low | normal | high
	Topic   string // replaces an undelivered message with the same topic
}

// WebSender posts encrypted messages to browser push services.
type WebSender struct {
	VAPID  *VAPID
	Client *http.Client
}

// Send delivers one message. The result says whether to retry and whether
// the subscription no longer exists.
func (s *WebSender) Send(ctx context.Context, sub WebSubscription, payload []byte, opt WebOptions) Result {
	if s == nil || s.VAPID == nil {
		return Result{Err: errors.New("web push not configured"), Permanent: true}
	}
	body, err := Encrypt(payload, sub.P256dh, sub.Auth)
	if err != nil {
		// A subscription whose keys cannot be used will never work.
		return Result{Err: err, Gone: true}
	}
	auth, err := s.VAPID.authorization(sub.Endpoint)
	if err != nil {
		return Result{Err: err, Gone: true}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sub.Endpoint, bytes.NewReader(body))
	if err != nil {
		return Result{Err: err, Gone: true}
	}
	ttl := int(opt.TTL.Seconds())
	if ttl <= 0 {
		ttl = 86400
	}
	req.Header.Set("Authorization", auth)
	req.Header.Set("Content-Encoding", "aes128gcm")
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("TTL", strconv.Itoa(ttl))
	if opt.Urgency != "" {
		req.Header.Set("Urgency", opt.Urgency)
	}
	if opt.Topic != "" {
		req.Header.Set("Topic", opt.Topic)
	}
	client := s.Client
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		return Result{Err: err, Retry: true}
	}
	defer resp.Body.Close()
	msg, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
	switch {
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		return Result{}
	case resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone:
		return Result{Err: fmt.Errorf("subscription gone (%d)", resp.StatusCode), Gone: true}
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		// The subscription was made with another VAPID key: it cannot be used
		// any more, the browser will subscribe again with the current key.
		return Result{Err: fmt.Errorf("vapid rejected (%d): %s", resp.StatusCode, msg), Gone: true}
	case resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500:
		return Result{Err: fmt.Errorf("push service %d: %s", resp.StatusCode, msg), Retry: true, RetryAfter: retryAfter(resp)}
	}
	return Result{Err: fmt.Errorf("push service %d: %s", resp.StatusCode, msg), Permanent: true}
}

func retryAfter(resp *http.Response) time.Duration {
	if s := resp.Header.Get("Retry-After"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 {
			return time.Duration(n) * time.Second
		}
	}
	return 0
}

// Result is the outcome of one send.
type Result struct {
	Err error
	// Retry: a transient failure (network, rate limit, 5xx).
	Retry      bool
	RetryAfter time.Duration
	// Gone: the device or subscription no longer exists; stop using it.
	Gone bool
	// Permanent: this message will never go through (too large, rejected).
	Permanent bool
	// Ticket is the provider's receipt id when delivery is confirmed later.
	Ticket string
}

// topicFor turns a coalescing key into a valid Topic header (≤ 32 URL-safe chars).
func topicFor(key string) string {
	if key == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(key))
	return b64.EncodeToString(sum[:])[:32]
}
