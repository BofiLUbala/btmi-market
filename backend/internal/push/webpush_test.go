package push

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// decryptAsBrowser is an independent implementation of the receiving side of
// RFC 8291, used to check that what we send is what a browser can read.
func decryptAsBrowser(t *testing.T, body []byte, uaPriv *ecdh.PrivateKey, auth []byte) []byte {
	t.Helper()
	salt := body[:16]
	rs := binary.BigEndian.Uint32(body[16:20])
	if rs != recordSize {
		t.Fatalf("record size %d", rs)
	}
	idLen := int(body[20])
	asPublicRaw := body[21 : 21+idLen]
	ciphertext := body[21+idLen:]

	asPublic, err := ecdh.P256().NewPublicKey(asPublicRaw)
	if err != nil {
		t.Fatal(err)
	}
	shared, err := uaPriv.ECDH(asPublic)
	if err != nil {
		t.Fatal(err)
	}
	uaPublic := uaPriv.PublicKey().Bytes()
	prkKey, _ := hkdf.Extract(sha256.New, shared, auth)
	info := append(append([]byte("WebPush: info\x00"), uaPublic...), asPublicRaw...)
	ikm, _ := hkdf.Expand(sha256.New, prkKey, string(info), 32)
	prk, _ := hkdf.Extract(sha256.New, ikm, salt)
	cek, _ := hkdf.Expand(sha256.New, prk, "Content-Encoding: aes128gcm\x00", 16)
	nonce, _ := hkdf.Expand(sha256.New, prk, "Content-Encoding: nonce\x00", 12)
	block, _ := aes.NewCipher(cek)
	gcm, _ := cipher.NewGCM(block)
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		t.Fatalf("browser could not decrypt: %v", err)
	}
	if plain[len(plain)-1] != 0x02 {
		t.Fatalf("missing last-record delimiter")
	}
	return plain[:len(plain)-1]
}

func browserKeys(t *testing.T) (*ecdh.PrivateKey, string, []byte, string) {
	t.Helper()
	priv, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	auth := make([]byte, 16)
	_, _ = io.ReadFull(rand.Reader, auth)
	return priv, b64.EncodeToString(priv.PublicKey().Bytes()), auth, b64.EncodeToString(auth)
}

func TestEncryptRoundTrip(t *testing.T) {
	priv, p256dh, auth, authB64 := browserKeys(t)
	msg := []byte(`{"title":"Commande acceptée","body":"é ✓"}`)
	body, err := Encrypt(msg, p256dh, authB64)
	if err != nil {
		t.Fatal(err)
	}
	if got := decryptAsBrowser(t, body, priv, auth); string(got) != string(msg) {
		t.Fatalf("got %q", got)
	}
}

func TestEncryptRejectsBadKeys(t *testing.T) {
	if _, err := Encrypt([]byte("x"), "not-a-key", "AAAAAAAAAAAAAAAAAAAAAA"); err == nil {
		t.Fatal("expected an error for an invalid p256dh")
	}
	_, p256dh, _, _ := browserKeys(t)
	if _, err := Encrypt([]byte("x"), p256dh, "c2hvcnQ"); err == nil {
		t.Fatal("expected an error for a short auth secret")
	}
}

func TestVAPIDKeyAndJWT(t *testing.T) {
	privB64, err := GenerateVAPID()
	if err != nil {
		t.Fatal(err)
	}
	v, err := NewVAPID(privB64, "mailto:test@example.com")
	if err != nil {
		t.Fatal(err)
	}
	pub, _ := decodeB64(v.PublicKey)
	if len(pub) != 65 || pub[0] != 4 {
		t.Fatalf("public key must be an uncompressed P-256 point, got %d bytes", len(pub))
	}
	header, err := v.authorization("https://fcm.googleapis.com/fcm/send/abc")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(header, "vapid t=") || !strings.HasSuffix(header, ", k="+v.PublicKey) {
		t.Fatalf("bad header %q", header)
	}
	token := strings.TrimSuffix(strings.TrimPrefix(header, "vapid t="), ", k="+v.PublicKey)
	parsed, err := jwt.Parse(token, func(*jwt.Token) (interface{}, error) { return &v.priv.PublicKey, nil },
		jwt.WithValidMethods([]string{"ES256"}))
	if err != nil || !parsed.Valid {
		t.Fatalf("jwt invalid: %v", err)
	}
	claims := parsed.Claims.(jwt.MapClaims)
	if claims["aud"] != "https://fcm.googleapis.com" || claims["sub"] != "mailto:test@example.com" {
		t.Fatalf("claims %v", claims)
	}
	// Same key reloaded = same public key and key id.
	again, _ := NewVAPID(privB64, "")
	if again.PublicKey != v.PublicKey || again.KeyID != v.KeyID {
		t.Fatal("key must be stable when reloaded")
	}
}

func TestWebSenderClassifiesResponses(t *testing.T) {
	privB64, _ := GenerateVAPID()
	v, _ := NewVAPID(privB64, "")
	priv, p256dh, auth, authB64 := browserKeys(t)

	cases := []struct {
		status            int
		retry, gone, perm bool
	}{
		{201, false, false, false},
		{410, false, true, false},
		{404, false, true, false},
		{403, false, true, false},
		{429, true, false, false},
		{503, true, false, false},
		{413, false, false, true},
	}
	for _, tc := range cases {
		var gotBody []byte
		var hdr http.Header
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			gotBody, _ = io.ReadAll(r.Body)
			hdr = r.Header.Clone()
			w.WriteHeader(tc.status)
		}))
		s := &WebSender{VAPID: v, Client: srv.Client()}
		res := s.Send(t.Context(), WebSubscription{Endpoint: srv.URL + "/push/1", P256dh: p256dh, Auth: authB64},
			[]byte(`{"id":"1"}`), WebOptions{TTL: time.Hour, Urgency: "high", Topic: topicFor("ORDER:1:BUYER")})
		srv.Close()
		if res.Retry != tc.retry || res.Gone != tc.gone || res.Permanent != tc.perm || (tc.status == 201) != (res.Err == nil) {
			t.Fatalf("status %d: got %+v", tc.status, res)
		}
		if tc.status == 201 {
			if hdr.Get("Content-Encoding") != "aes128gcm" || hdr.Get("TTL") != "3600" || hdr.Get("Urgency") != "high" || len(hdr.Get("Topic")) != 32 {
				t.Fatalf("headers %v", hdr)
			}
			if string(decryptAsBrowser(t, gotBody, priv, auth)) != `{"id":"1"}` {
				t.Fatal("payload mismatch")
			}
		}
	}
}

func TestExpoTicketClassification(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.Contains(string(raw), "Gone"):
			_, _ = w.Write([]byte(`{"data":[{"status":"error","message":"not registered","details":{"error":"DeviceNotRegistered"}}]}`))
		case strings.Contains(string(raw), "Busy"):
			w.WriteHeader(503)
		default:
			_, _ = w.Write([]byte(`{"data":[{"status":"ok","id":"ticket-1"}]}`))
		}
	}))
	defer srv.Close()
	s := &ExpoSender{BaseURL: srv.URL, Client: srv.Client()}
	if r := s.Send(t.Context(), ExpoMessage{To: "ExponentPushToken[ok]"}); r.Err != nil || r.Ticket != "ticket-1" {
		t.Fatalf("ok: %+v", r)
	}
	if r := s.Send(t.Context(), ExpoMessage{To: "ExponentPushToken[Gone]"}); !r.Gone {
		t.Fatalf("gone: %+v", r)
	}
	if r := s.Send(t.Context(), ExpoMessage{To: "ExponentPushToken[Busy]"}); !r.Retry {
		t.Fatalf("busy: %+v", r)
	}
}

func TestEndpointAllowlist(t *testing.T) {
	s := NewStore(nil, []string{"http://127.0.0.1:9999"})
	ok := []string{
		"https://fcm.googleapis.com/fcm/send/abc",
		"https://updates.push.services.mozilla.com/wpush/v2/x",
		"https://web.push.apple.com/QH",
		"https://wns2-par02p.notify.windows.com/w/?token=1",
		"http://127.0.0.1:9999/push",
	}
	bad := []string{
		"http://fcm.googleapis.com/fcm/send/abc",   // not https
		"https://169.254.169.254/latest/meta-data", // internal address
		"https://evil.com/fcm.googleapis.com",
		"https://fcm.googleapis.com.evil.com/x",
		"https://user:pw@fcm.googleapis.com/x",
		"http://127.0.0.1:8080/api",
		"",
	}
	for _, e := range ok {
		if !s.ValidEndpoint(e) {
			t.Errorf("should accept %s", e)
		}
	}
	for _, e := range bad {
		if s.ValidEndpoint(e) {
			t.Errorf("should refuse %s", e)
		}
	}
	if !expoTokenRe.MatchString("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]") || expoTokenRe.MatchString("https://x") {
		t.Error("expo token validation")
	}
}
