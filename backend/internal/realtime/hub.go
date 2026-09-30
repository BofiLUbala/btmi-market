// Package realtime pushes order changes to the people concerned by them.
//
// The database is the source of the events: triggers on orders, payments and
// handover rows raise NOTIFY tbk_order_events with the order id, and only on
// commit. The hub LISTENs, resolves who may see that order and pushes a small
// event to their open streams. Clients then refetch through the normal,
// authorised endpoints, so an event never carries data its receiver could not
// already read.
package realtime

import (
	"database/sql"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

const channel = "tbk_order_events"

// Event is what a stream receives. Kind "order" names one order; kinds
// "stock" and "cash" say that one business's stock or cash changed; kind
// "location" says the courier carrying one order sent a new position (never
// the position itself); kind "resync" asks the client to refetch everything
// after a listener gap.
type Event struct {
	Kind           string `json:"kind"`
	BusinessID     string `json:"business_id,omitempty"`
	OrderID        string `json:"order_id,omitempty"`
	OrderNumber    string `json:"order_number,omitempty"`
	Status         string `json:"status,omitempty"`
	DeliveryStatus string `json:"delivery_status,omitempty"`
}

// Subscriber is one open stream. A user stream matches the orders they buy,
// sell (through a business membership or an employee link) or deliver; an
// admin stream matches every order.
type Subscriber struct {
	UserID      uuid.UUID
	BusinessIDs map[uuid.UUID]bool
	Admin       bool
	C           chan Event
}

type Hub struct {
	db   *sql.DB
	dsn  string
	mu   sync.RWMutex
	subs map[*Subscriber]struct{}
}

func NewHub(db *sql.DB, dsn string) *Hub {
	return &Hub{db: db, dsn: dsn, subs: map[*Subscriber]struct{}{}}
}

func (h *Hub) Subscribe(s *Subscriber) {
	h.mu.Lock()
	h.subs[s] = struct{}{}
	h.mu.Unlock()
}

func (h *Hub) Unsubscribe(s *Subscriber) {
	h.mu.Lock()
	delete(h.subs, s)
	h.mu.Unlock()
}

// BusinessIDsForUser lists the businesses whose orders a user may follow.
func (h *Hub) BusinessIDsForUser(userID uuid.UUID) map[uuid.UUID]bool {
	ids := map[uuid.UUID]bool{}
	rows, err := h.db.Query(`
		SELECT business_id FROM business_memberships WHERE user_id = $1 AND status = 'ACTIVE'
		UNION
		SELECT business_id FROM employees WHERE linked_user_id = $1 AND status = 'ACTIVE'`, userID)
	if err != nil {
		log.Printf("realtime: business lookup for %s: %v", userID, err)
		return ids
	}
	defer rows.Close()
	for rows.Next() {
		var id uuid.UUID
		if rows.Scan(&id) == nil {
			ids[id] = true
		}
	}
	return ids
}

// Run listens until the process exits, reconnecting on its own. After any gap
// every stream is told to resync, since events may have been missed.
func (h *Hub) Run() {
	listener := pq.NewListener(h.dsn, 2*time.Second, time.Minute, func(ev pq.ListenerEventType, err error) {
		if err != nil {
			log.Printf("realtime: listener event %d: %v", ev, err)
		}
		if ev == pq.ListenerEventReconnected {
			h.broadcastResync()
		}
	})
	if err := listener.Listen(channel); err != nil {
		log.Printf("realtime: LISTEN %s failed: %v", channel, err)
	}
	ping := time.NewTicker(90 * time.Second)
	defer ping.Stop()
	for {
		select {
		case n := <-listener.Notify:
			if n == nil {
				h.broadcastResync()
				continue
			}
			h.dispatch(n.Extra)
		case <-ping.C:
			go func() { _ = listener.Ping() }()
		}
	}
}

func (h *Hub) dispatch(orderIDText string) {
	// A Finance tariff change concerns everyone and carries no private data.
	if orderIDText == "tariff" {
		h.broadcast(Event{Kind: "tariff"})
		return
	}
	// Stock and cash changes go to the members of that business only.
	if kind, id, ok := strings.Cut(orderIDText, ":"); ok && (kind == "stock" || kind == "cash") {
		businessID, err := uuid.Parse(id)
		if err != nil {
			return
		}
		h.dispatchBusiness(Event{Kind: kind, BusinessID: businessID.String()}, businessID)
		return
	}
	// A courier position goes to the order's buyer and Commerce Admin only:
	// never the seller's members or employees, never the courier's own stream.
	if kind, id, ok := strings.Cut(orderIDText, ":"); ok && kind == "location" {
		orderID, err := uuid.Parse(id)
		if err != nil {
			return
		}
		h.dispatchLocation(orderID, h.buyerUserID(orderID))
		return
	}
	orderID, err := uuid.Parse(orderIDText)
	if err != nil {
		return
	}
	var (
		ev          = Event{Kind: "order", OrderID: orderID.String()}
		businessID  uuid.NullUUID
		courierID   uuid.NullUUID
		buyerUserID uuid.NullUUID
	)
	err = h.db.QueryRow(`
		SELECT COALESCE(o.order_number, ''), o.status::text, COALESCE(o.delivery_status, ''),
		       o.business_id, o.assigned_courier_id, bp.user_id
		FROM orders o
		LEFT JOIN buyer_profiles bp ON bp.id = o.buyer_profile_id
		WHERE o.id = $1`, orderID).
		Scan(&ev.OrderNumber, &ev.Status, &ev.DeliveryStatus, &businessID, &courierID, &buyerUserID)
	if err != nil {
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()
	for s := range h.subs {
		if !s.Admin &&
			!(buyerUserID.Valid && buyerUserID.UUID == s.UserID) &&
			!(courierID.Valid && courierID.UUID == s.UserID) &&
			!(businessID.Valid && s.BusinessIDs[businessID.UUID]) {
			continue
		}
		send(s, ev)
	}
}

func (h *Hub) buyerUserID(orderID uuid.UUID) uuid.NullUUID {
	var buyer uuid.NullUUID
	if h.db == nil {
		return buyer
	}
	if err := h.db.QueryRow(`
		SELECT bp.user_id FROM orders o
		JOIN buyer_profiles bp ON bp.id = o.buyer_profile_id
		WHERE o.id = $1`, orderID).Scan(&buyer); err != nil {
		return uuid.NullUUID{}
	}
	return buyer
}

// dispatchLocation carries only the order id: receivers refetch the position
// through the endpoint that checks they may see it.
func (h *Hub) dispatchLocation(orderID uuid.UUID, buyer uuid.NullUUID) {
	ev := Event{Kind: "location", OrderID: orderID.String()}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for s := range h.subs {
		if s.Admin || (buyer.Valid && s.UserID == buyer.UUID) {
			send(s, ev)
		}
	}
}

func (h *Hub) dispatchBusiness(ev Event, businessID uuid.UUID) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for s := range h.subs {
		if !s.Admin && s.BusinessIDs[businessID] {
			send(s, ev)
		}
	}
}

func (h *Hub) broadcastResync() { h.broadcast(Event{Kind: "resync"}) }

func (h *Hub) broadcast(ev Event) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for s := range h.subs {
		send(s, ev)
	}
}

// send never blocks the hub: a stream too slow to drain its buffer only misses
// intermediate events, and the next one makes it refetch anyway.
func send(s *Subscriber, ev Event) {
	select {
	case s.C <- ev:
	default:
	}
}
