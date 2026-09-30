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
