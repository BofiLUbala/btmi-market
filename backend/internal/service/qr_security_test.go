package service

import (
	"strings"
	"testing"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

func newTestQRService(t *testing.T, secret string) *QRService {
	t.Helper()
	t.Setenv("QR_SIGNING_SECRET", secret)
	return NewQRService(nil, nil, nil, nil, nil)
}

// A QR token must round-trip, and must carry nothing but an opaque reference: no email,
// phone, address, buyer name or JWT ever reaches the printed code.
func TestQRTokenIsOpaqueAndRoundTrips(t *testing.T) {
	svc := newTestQRService(t, "test-secret")
	ref := uuid.New()

	tok := svc.token("d", ref.String())
	parts := strings.Split(tok, ".")
	if len(parts) != 4 || parts[0] != "tbk" || parts[1] != "d" || parts[2] != ref.String() {
		t.Fatalf("token is not the expected opaque shape: %q", tok)
	}
	if strings.Count(tok, ".") != 3 || strings.Contains(tok, "@") {
		t.Fatalf("token must not embed structured or contact data: %q", tok)
	}

	got, err := svc.parse(tok, "d")
	if err != nil {
		t.Fatalf("valid token failed to parse: %v", err)
	}
	if got != ref {
		t.Fatalf("parse returned %s, want %s", got, ref)
	}
}

func TestQRTokenRejectsTamperingAndConfusion(t *testing.T) {
	svc := newTestQRService(t, "test-secret")
	ref := uuid.New()
	other := uuid.New()

	cases := []struct {
		name  string
		token string
		kind  string
	}{
		{"forged signature", "tbk.d." + ref.String() + ".not-a-real-signature", "d"},
		{"swapped reference keeps old signature", strings.Replace(svc.token("d", ref.String()), ref.String(), other.String(), 1), "d"},
		{"product token replayed as a delivery token", svc.token("p", ref.String()), "d"},
		{"delivery token replayed as a product token", svc.token("d", ref.String()), "p"},
		{"empty token", "", "d"},
		{"truncated token", "tbk.d." + ref.String(), "d"},
		{"non-uuid reference", svc.token("d", "not-a-uuid"), "d"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := svc.parse(tc.token, tc.kind); err == nil {
				t.Fatalf("expected %s to be rejected, but it parsed", tc.name)
			}
		})
	}
}

// A token signed with a different deployment secret must never validate.
func TestQRTokenRejectsForeignSecret(t *testing.T) {
	ref := uuid.New()
	foreign := newTestQRService(t, "attacker-secret").token("d", ref.String())
	if _, err := newTestQRService(t, "real-secret").parse(foreign, "d"); err == nil {
		t.Fatal("a token signed with another secret was accepted")
	}
}

// RBAC: each actor may only drive the phases it owns. A courier moves the parcel; only the
// buyer confirms receipt; only the system completes an order.
func TestScanActorPermissions(t *testing.T) {
	cases := []struct {
		actor  string
		status models.OrderStatus
		want   bool
	}{
		{"COURIER", models.OrderStatusOutForDelivery, true},
		{"COURIER", models.OrderStatusDelivered, true},
		{"COURIER", models.OrderStatusReceived, false},
		{"COURIER", models.OrderStatusCompleted, false},
		{"COURIER", models.OrderStatusCancelled, false},
		{"BUYER", models.OrderStatusReceived, true},
		{"BUYER", models.OrderStatusOutForDelivery, false},
		{"BUYER", models.OrderStatusDelivered, false},
		{"BUYER", models.OrderStatusCompleted, false},
		{"SELLER", models.OrderStatusReceived, false},
		{"SELLER", models.OrderStatusCompleted, false},
		{"SYSTEM", models.OrderStatusCompleted, true},
		{"SYSTEM", models.OrderStatusDelivered, false},
		{"", models.OrderStatusDelivered, false},
	}
	for _, tc := range cases {
		if got := canActorSetStatus(tc.actor, tc.status); got != tc.want {
			t.Errorf("canActorSetStatus(%q, %s) = %v, want %v", tc.actor, tc.status, got, tc.want)
		}
	}
}

// The cash rule: confirming physical receipt must never, on its own, complete the order.
// RECEIVED and COMPLETED stay distinct states reached by distinct actors.
func TestReceiptDoesNotImplyCompletion(t *testing.T) {
	if canActorSetStatus("BUYER", models.OrderStatusCompleted) {
		t.Fatal("a buyer confirming receipt must not be able to complete the order")
	}
	if !canTransition(models.OrderStatusReceived, models.OrderStatusCompleted, models.DeliveryMethodTBK) {
		t.Fatal("RECEIVED must still be able to reach COMPLETED through the system gate")
	}
	if canTransition(models.OrderStatusDelivered, models.OrderStatusCompleted, models.DeliveryMethodTBK) {
		t.Fatal("a delivered order must pass through RECEIVED before it can complete")
	}
	if canTransition(models.OrderStatusOutForDelivery, models.OrderStatusReceived, models.DeliveryMethodTBK) {
		t.Fatal("receipt must not be reachable without a delivery scan")
	}
}

// The handover order is enforced by the state machine: pickup, then delivery, then receipt.
func TestHandoverSequenceIsEnforced(t *testing.T) {
	m := models.DeliveryMethodTBK
	if !canTransition(models.OrderStatusReady, models.OrderStatusOutForDelivery, m) {
		t.Fatal("pickup scan must move a READY order out for delivery")
	}
	if !canTransition(models.OrderStatusOutForDelivery, models.OrderStatusDelivered, m) {
		t.Fatal("delivery scan must move an in-transit order to DELIVERED")
	}
	if canTransition(models.OrderStatusPending, models.OrderStatusOutForDelivery, m) {
		t.Fatal("a pickup scan must not be possible on a PENDING order")
	}
	if canTransition(models.OrderStatusCancelled, models.OrderStatusOutForDelivery, m) {
		t.Fatal("a cancelled order must not accept a pickup scan")
	}
}
