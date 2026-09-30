package realtime

import (
	"testing"

	"github.com/google/uuid"
)

func received(s *Subscriber) []Event {
	var out []Event
	for {
		select {
		case ev := <-s.C:
			out = append(out, ev)
		default:
			return out
		}
	}
}

// Stock and cash events carry a business id and reach only that business's
// members: never another seller, never a buyer, and not the admin streams.
func TestStockAndCashEventsReachOnlyTheBusinessMembers(t *testing.T) {
	h := NewHub(nil, "")
	mine, other := uuid.New(), uuid.New()
	member := &Subscriber{UserID: uuid.New(), BusinessIDs: map[uuid.UUID]bool{mine: true}, C: make(chan Event, 4)}
	stranger := &Subscriber{UserID: uuid.New(), BusinessIDs: map[uuid.UUID]bool{other: true}, C: make(chan Event, 4)}
	buyer := &Subscriber{UserID: uuid.New(), BusinessIDs: map[uuid.UUID]bool{}, C: make(chan Event, 4)}
	admin := &Subscriber{UserID: uuid.New(), Admin: true, C: make(chan Event, 4)}
	for _, s := range []*Subscriber{member, stranger, buyer, admin} {
		h.Subscribe(s)
	}

	h.dispatch("stock:" + mine.String())
	h.dispatch("cash:" + mine.String())
	h.dispatch("stock:not-a-uuid")
	h.dispatch("unknown:" + mine.String())

	got := received(member)
	if len(got) != 2 || got[0].Kind != "stock" || got[1].Kind != "cash" || got[0].BusinessID != mine.String() {
		t.Fatalf("member got %+v, want one stock and one cash event for its business", got)
	}
	for name, s := range map[string]*Subscriber{"other seller": stranger, "buyer": buyer, "admin": admin} {
		if evs := received(s); len(evs) != 0 {
			t.Errorf("%s received %+v", name, evs)
		}
	}
}

// A courier position reaches the order's buyer and the Commerce Admin streams
// only: never the seller's members or employees, another buyer, or the courier.
// The event names the order and carries no coordinates.
func TestLocationEventsReachOnlyTheBuyerAndCommerceAdmin(t *testing.T) {
	h := NewHub(nil, "")
	business, orderID := uuid.New(), uuid.New()
	buyer := &Subscriber{UserID: uuid.New(), BusinessIDs: map[uuid.UUID]bool{}, C: make(chan Event, 4)}
	otherBuyer := &Subscriber{UserID: uuid.New(), BusinessIDs: map[uuid.UUID]bool{}, C: make(chan Event, 4)}
	seller := &Subscriber{UserID: uuid.New(), BusinessIDs: map[uuid.UUID]bool{business: true}, C: make(chan Event, 4)}
	courier := &Subscriber{UserID: uuid.New(), BusinessIDs: map[uuid.UUID]bool{}, C: make(chan Event, 4)}
	admin := &Subscriber{Admin: true, C: make(chan Event, 4)}
	for _, s := range []*Subscriber{buyer, otherBuyer, seller, courier, admin} {
		h.Subscribe(s)
	}

	h.dispatchLocation(orderID, uuid.NullUUID{UUID: buyer.UserID, Valid: true})
	h.dispatch("location:not-a-uuid")

	for name, s := range map[string]*Subscriber{"buyer": buyer, "commerce admin": admin} {
		got := received(s)
		if len(got) != 1 || got[0].Kind != "location" || got[0].OrderID != orderID.String() {
			t.Fatalf("%s got %+v, want one location event for the order", name, got)
		}
		if got[0].Status != "" || got[0].DeliveryStatus != "" || got[0].BusinessID != "" {
			t.Fatalf("%s: location event carries more than the order id: %+v", name, got[0])
		}
	}
	for name, s := range map[string]*Subscriber{"other buyer": otherBuyer, "seller": seller, "courier": courier} {
		if evs := received(s); len(evs) != 0 {
			t.Errorf("%s received %+v", name, evs)
		}
	}
}
