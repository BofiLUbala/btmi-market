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
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

const mokoTestSecret = "0123456789abcdef" // 16 bytes: AES-128, IV = key (Moko's samples)

// fakeMoko records the actions it receives and answers like the API.
func fakeMoko(t *testing.T, got *[]map[string]string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/token") {
			_ = json.NewEncoder(w).Encode(map[string]string{"token": "jwt-test"})
			return
		}
		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		*got = append(*got, body)
		_ = json.NewEncoder(w).Encode(map[string]string{"Status": "Success", "PayDRC_Reference": "PDRC-" + body["reference"]})
	}))
}

// mokoCallback builds a callback the way Moko sends it: the fields encrypted
// with AES-CBC (IV = key), base64, wrapped in {"data": …}, signed in X-Signature.
func mokoCallback(t *testing.T, fields map[string]string) ([]byte, string) {
	t.Helper()
	plain, _ := json.Marshal(fields)
	pad := aes.BlockSize - len(plain)%aes.BlockSize
	plain = append(plain, bytes.Repeat([]byte{byte(pad)}, pad)...)
	block, _ := aes.NewCipher([]byte(mokoTestSecret))
	out := make([]byte, len(plain))
	cipher.NewCBCEncrypter(block, []byte(mokoTestSecret)).CryptBlocks(out, plain)
	body, _ := json.Marshal(map[string]string{"data": base64.StdEncoding.EncodeToString(out)})
	mac := hmac.New(sha256.New, []byte(mokoTestSecret))
	mac.Write(body)
	return body, hex.EncodeToString(mac.Sum(nil))
}

func TestMokoChargeAndPayoutDrivers(t *testing.T) {
	var got []map[string]string
	srv := fakeMoko(t, &got)
	defer srv.Close()
	client := NewMokoClient(MokoConfig{BaseURL: srv.URL, MerchantID: "m-1", MerchantSecret: "s-1", CallbackURL: "https://tbk.test/api/v1/webhooks/moko"})

	charge := NewMokoChargeDriver(client, []models.PaymentProvider{{Code: models.PaymentProviderAirtelMoney, Enabled: true}})
	paymentID := uuid.NewString()
	init, err := charge.Charge(PaymentChargeRequest{PaymentID: paymentID, Provider: models.PaymentProviderAirtelMoney, PayerPhone: "0991234567", Amount: 25.5, Currency: "usd"})
	if err != nil {
		t.Fatalf("charge: %v", err)
	}
	debit := got[0]
	if debit["action"] != "debit" || debit["method"] != "airtel" || debit["customer_number"] != "243991234567" ||
		debit["amount"] != "25.5" || debit["currency"] != "USD" || !strings.HasPrefix(debit["reference"], "PY-"+paymentID+"-") ||
		debit["merchant_id"] != "m-1" || debit["callback_url"] == "" {
		t.Fatalf("debit sent %+v", debit)
	}
	if init.Status != string(models.BuyerPaymentStatusProcessing) || init.Reference != "PDRC-"+debit["reference"] {
		t.Fatalf("charge answered %+v", init)
	}
	if charge.Supports(models.PaymentProviderMPesa) {
		t.Fatal("a provider Finance did not enable is supported")
	}

	ref, sent, err := NewMokoPayoutDriver(client).Send(PayoutTransfer{Reference: "PO-x", Provider: models.PaymentProviderAfrimoney, Phone: "0901234567", Amount: 97, Currency: "USD"})
	if err != nil || !sent || ref != "PDRC-PO-x" {
		t.Fatalf("payout send: %v %v %s", err, sent, ref)
	}
	if credit := got[1]; credit["action"] != "credit" || credit["method"] != "africell" || credit["amount"] != "97" {
		t.Fatalf("credit sent %+v", credit)
	}
}

func TestMokoCallbackIsVerifiedAndDecrypted(t *testing.T) {
	client := NewMokoClient(MokoConfig{MerchantID: "m", MerchantSecret: "s", CallbackSecret: mokoTestSecret})
	body, sig := mokoCallback(t, map[string]string{
		"Reference": "PO-abc", "PayDRC_Reference": "PDRC-9", "Trans_Status": "Success", "Amount": "97", "Currency": "USD",
	})
	result, err := client.DecodeCallback(body, sig)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !result.Succeeded || result.Reference != "PO-abc" || result.OperatorRef != "PDRC-9" || result.Amount != 97 {
		t.Fatalf("decoded %+v", result)
	}
	if _, err := client.DecodeCallback(body, "deadbeef"); !errors.Is(err, ErrMokoSignature) {
		t.Fatalf("a forged signature gave %v", err)
	}
	tampered := bytes.Replace(body, []byte(`"data":"`), []byte(`"data":"AAAA`), 1)
	mac := hmac.New(sha256.New, []byte(mokoTestSecret))
	mac.Write(tampered)
	if _, err := client.DecodeCallback(tampered, hex.EncodeToString(mac.Sum(nil))); !errors.Is(err, ErrMokoPayload) {
		t.Fatalf("an undecryptable payload gave %v", err)
	}
}

// A Moko callback settles the buyer's payment through the normal path, the
// seller's share goes out by credit, and the credit's own callback marks the
// payout paid.
func TestMokoCallbackSettlesPaymentAndPayout(t *testing.T) {
	f, ps, repo := newPayoutFixture(t)
	var got []map[string]string
	srv := fakeMoko(t, &got)
	defer srv.Close()
	client := NewMokoClient(MokoConfig{BaseURL: srv.URL, MerchantID: "m", MerchantSecret: "s", CallbackSecret: mokoTestSecret})
	f.pay.SetMokoClient(client)
	ps.SetDriver(NewMokoPayoutDriver(client))
	if _, err := ps.SaveAccounts(f.buyerUserID, f.businessID, &models.SavePayoutAccountsRequest{Accounts: allNetworks}); err != nil {
		t.Fatal(err)
	}

	body, sig := mokoCallback(t, map[string]string{
		"Reference": "PY-" + f.paymentID.String() + "-abc123", "PayDRC_Reference": "PDRC-1",
		"Trans_Status": "Success", "Amount": "100", "Currency": "USD", "Action": "debit",
	})
	if err := f.pay.HandleMokoCallback(body, sig); err != nil {
		t.Fatalf("moko callback: %v", err)
	}
	if f.paymentStatus(t) != "PAID" {
		t.Fatalf("payment is %s after Moko's success", f.paymentStatus(t))
	}
	// The same callback again is a no-op.
	if err := f.pay.HandleMokoCallback(body, sig); err != nil {
		t.Fatalf("replayed callback: %v", err)
	}

	payout, _ := repo.GetPayoutByOrder(f.orderID, models.PayoutKindPayout)
	if payout == nil || payout.Status != models.PayoutStatusSent {
		t.Fatalf("payout after settlement: %+v", payout)
	}
	if len(got) != 1 || got[0]["action"] != "credit" || got[0]["method"] != "mpesa" {
		t.Fatalf("Moko received %+v, want one M-Pesa credit", got)
	}

	body, sig = mokoCallback(t, map[string]string{
		"Reference": "PO-" + payout.ID.String(), "PayDRC_Reference": "PDRC-2", "Trans_Status": "Success",
	})
	if err := f.pay.HandleMokoCallback(body, sig); err != nil {
		t.Fatalf("payout callback: %v", err)
	}
	payout, _ = repo.GetPayoutByOrder(f.orderID, models.PayoutKindPayout)
	if payout.Status != models.PayoutStatusPaid || payout.ProviderReference != "PDRC-2" || payout.SettledAt == nil {
		t.Fatalf("payout after Moko's confirmation: %+v", payout)
	}
}
