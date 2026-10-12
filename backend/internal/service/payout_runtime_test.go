package service

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"testing"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

// fakeLiveDriver stands in for Moko: it accepts every transfer and remembers it.
type fakeLiveDriver struct{ sent []PayoutTransfer }

func (d *fakeLiveDriver) Send(t PayoutTransfer) (string, bool, error) {
	d.sent = append(d.sent, t)
	return "MOKO-" + t.Reference, true, nil
}

func TestNormalizeCongoPhone(t *testing.T) {
	cases := map[string]string{
		"0812345678":       "243812345678",
		"+243 812 345 678": "243812345678",
		"243812345678":     "243812345678",
		"812345678":        "243812345678",
		"0012345678":       "",
		"12345":            "",
		"":                 "",
	}
	for in, want := range cases {
		if got := NormalizeCongoPhone(in); got != want {
			t.Errorf("NormalizeCongoPhone(%q) = %q, want %q", in, got, want)
		}
	}
}

// newPayoutFixture is a real mobile money order whose payment the operator
// confirms through the signed webhook, with the payout service wired in.
func newPayoutFixture(t *testing.T) (*handoverFixture, *PayoutService, *repository.PayoutRepository) {
	t.Helper()
	f := newHandoverFixture(t, models.PaymentMethodMobileDelivery)
	f.wireServices(t)
	repo := repository.NewPayoutRepository(f.db)
	ps := NewPayoutService(repo, repository.NewBuyerPaymentRepository(f.db),
		repository.NewCommissionRepository(f.db.DB), repository.NewMembershipRepository(f.db))
	f.pay.SetPayoutService(ps)
	if _, err := f.db.Exec(`INSERT INTO business_memberships (id,user_id,business_id,role,status,joined_at)
		VALUES ($1,$2,$3,'OWNER','ACTIVE',NOW())`, uuid.New(), f.buyerUserID, f.businessID); err != nil {
		t.Fatalf("membership: %v", err)
	}
	return f, ps, repo
}

func (f *handoverFixture) settleByWebhook(t *testing.T) {
	t.Helper()
	body, _ := json.Marshal(models.ProviderPaymentEvent{
		EventID: uuid.NewString(), PaymentID: f.paymentID.String(), Reference: "MM-" + uuid.NewString()[:8],
		Status: models.ProviderPaymentSucceeded, Amount: 100, Currency: "USD",
	})
	mac := hmac.New(sha256.New, []byte(handoverTestSecret))
	mac.Write(body)
	if err := f.pay.HandleProviderWebhook(models.PaymentProviderMPesa, body, "sha256="+hex.EncodeToString(mac.Sum(nil))); err != nil {
		t.Fatalf("signed webhook rejected: %v", err)
	}
}

func (f *handoverFixture) commission(t *testing.T) (net float64, status string) {
	t.Helper()
	if err := f.db.QueryRow(`SELECT seller_net_amount, status FROM sale_commissions WHERE order_id = $1`, f.orderID).Scan(&net, &status); err != nil {
		t.Fatalf("commission: %v", err)
	}
	return net, status
}

var allNetworks = map[string]string{
	models.PaymentProviderMPesa:       "0812345678",
	models.PaymentProviderAirtelMoney: "0991234567",
	models.PaymentProviderOrangeMoney: "0891234567",
	models.PaymentProviderAfrimoney:   "0901234567",
}

// The seller's share is recorded the moment the payment settles, on the
// buyer's network, and TBK's commission is marked as kept at the source.
// Without a number on that network it waits; saving the numbers releases it.
func TestSettledMobilePaymentPaysSellerShare(t *testing.T) {
	f, ps, repo := newPayoutFixture(t)
	f.settleByWebhook(t)

	payout, err := repo.GetPayoutByOrder(f.orderID, models.PayoutKindPayout)
	if err != nil || payout == nil {
		t.Fatalf("no payout after settlement: %v", err)
	}
	net, commStatus := f.commission(t)
	if payout.Amount != net || payout.GrossAmount != net {
		t.Fatalf("payout %.2f/%.2f, seller net %.2f", payout.Amount, payout.GrossAmount, net)
	}
	if payout.Provider != models.PaymentProviderMPesa {
		t.Fatalf("payout on %s, buyer paid with MPESA", payout.Provider)
	}
	if payout.Status != models.PayoutStatusBlocked {
		t.Fatalf("payout without a number is %s, want BLOCKED_NO_ACCOUNT", payout.Status)
	}
	if commStatus != string(models.CommissionStatusCollected) {
		t.Fatalf("commission is %s, want COLLECTED (kept at the source)", commStatus)
	}

	// A replayed webhook must not create a second payout.
	ps.OnPaymentSettled(f.orderID)
	var count int
	_ = f.db.QueryRow(`SELECT COUNT(*) FROM seller_payouts WHERE order_id = $1`, f.orderID).Scan(&count)
	if count != 1 {
		t.Fatalf("%d payout rows after a replay, want 1", count)
	}

	// Saving the four numbers releases the waiting payout to the live operator.
	live := &fakeLiveDriver{}
	ps.SetDriver(live)
	if _, err := ps.SaveAccounts(f.buyerUserID, f.businessID, &models.SavePayoutAccountsRequest{Accounts: allNetworks}); err != nil {
		t.Fatalf("save accounts: %v", err)
	}
	payout, _ = repo.GetPayoutByOrder(f.orderID, models.PayoutKindPayout)
	if payout.Status != models.PayoutStatusSent || payout.Phone != "243812345678" {
		t.Fatalf("after saving numbers: status %s phone %s", payout.Status, payout.Phone)
	}
	if len(live.sent) != 1 || live.sent[0].Amount != net || live.sent[0].Provider != models.PaymentProviderMPesa {
		t.Fatalf("operator received %+v", live.sent)
	}
}

// All four networks are required, and each number must be a valid DRC mobile.
func TestPayoutAccountsRequireAllFourNetworks(t *testing.T) {
	f, ps, _ := newPayoutFixture(t)
	partial := map[string]string{models.PaymentProviderMPesa: "0812345678"}
	if _, err := ps.SaveAccounts(f.buyerUserID, f.businessID, &models.SavePayoutAccountsRequest{Accounts: partial}); err == nil {
		t.Fatal("saved numbers for only one network")
	}
	bad := map[string]string{}
	for k, v := range allNetworks {
		bad[k] = v
	}
	bad[models.PaymentProviderOrangeMoney] = "123"
	if _, err := ps.SaveAccounts(f.buyerUserID, f.businessID, &models.SavePayoutAccountsRequest{Accounts: bad}); err == nil {
		t.Fatal("saved an invalid number")
	}
	// Someone outside the business cannot change where its money goes.
	if _, err := ps.SaveAccounts(uuid.New(), f.businessID, &models.SavePayoutAccountsRequest{Accounts: allNetworks}); err == nil {
		t.Fatal("a stranger changed the payout numbers")
	}
}

// A refund returns the buyer's money from TBK's account. A payout already sent
// is owed back by the seller; one not yet sent is simply cancelled.
func TestRefundReturnsBuyerMoneyAndClawsBackSeller(t *testing.T) {
	f, ps, repo := newPayoutFixture(t)
	live := &fakeLiveDriver{}
	ps.SetDriver(live)
	if _, err := ps.SaveAccounts(f.buyerUserID, f.businessID, &models.SavePayoutAccountsRequest{Accounts: allNetworks}); err != nil {
		t.Fatal(err)
	}
	f.settleByWebhook(t)
	payout, _ := repo.GetPayoutByOrder(f.orderID, models.PayoutKindPayout)
	if payout == nil || payout.Status != models.PayoutStatusSent {
		t.Fatalf("payout not sent at settlement: %+v", payout)
	}

	ps.OnOrderRefunded(f.orderID)

	clawback, _ := repo.GetPayoutByOrder(f.orderID, models.PayoutKindClawback)
	if clawback == nil || clawback.Amount != payout.GrossAmount || clawback.Status != models.PayoutStatusPending {
		t.Fatalf("clawback %+v for a payout of %.2f", clawback, payout.GrossAmount)
	}
	var refundStatus, refundProvider string
	var refundAmount float64
	if err := f.db.QueryRow(`SELECT status, provider, amount FROM buyer_refunds WHERE order_id = $1`, f.orderID).
		Scan(&refundStatus, &refundProvider, &refundAmount); err != nil {
		t.Fatalf("no buyer refund: %v", err)
	}
	if refundStatus != models.PayoutStatusSent || refundProvider != models.PaymentProviderMPesa || refundAmount <= 0 {
		t.Fatalf("refund %s %s %.2f", refundStatus, refundProvider, refundAmount)
	}
	last := live.sent[len(live.sent)-1]
	if last.Purpose != "BUYER_REFUND" {
		t.Fatalf("last transfer %+v, want the buyer refund", last)
	}

	// The clawback is owed: the next payout of this business deducts it.
	owed, _ := repo.OpenClawbackTotal(f.businessID, payout.Currency)
	if owed != payout.GrossAmount {
		t.Fatalf("owed %.2f, want %.2f", owed, payout.GrossAmount)
	}
}
