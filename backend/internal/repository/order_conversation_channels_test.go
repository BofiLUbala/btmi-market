package repository_test

import (
	"fmt"
	"testing"
	"time"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

// Private order channels against the real schema: opening one thread marks
// only that thread read, and inbox rows say who wrote the last message of the
// caller's own channels.
func TestOrderChannelsReadAndInboxRealDB(t *testing.T) {
	cfg := config.Load()
	db, err := database.Connect(cfg.DBHost, cfg.DBPort, cfg.DBName, cfg.DBUser, cfg.DBPassword)
	if err != nil {
		t.Skipf("Skipping real DB test: %v", err)
	}
	defer db.Close()
	if err := db.RunMigrations("../../migrations"); err != nil {
		t.Fatalf("migrations: %v", err)
	}

	var shopID, businessID uuid.UUID
	if err := db.QueryRow(`SELECT id, business_id FROM shops ORDER BY created_at LIMIT 1`).Scan(&shopID, &businessID); err != nil {
		t.Skipf("no shop: %v", err)
	}
	user := func(label string) uuid.UUID {
		id := uuid.New()
		if _, err := db.Exec(`INSERT INTO users (id, email, first_name, last_name, password_hash, phone) VALUES ($1,$2,'Chat',$3,'x',$4)`,
			id, fmt.Sprintf("chat-%s-%s@test.invalid", label, id.String()[:8]), label, "+243"+id.String()[:8]); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _, _ = db.Exec(`DELETE FROM users WHERE id=$1`, id) })
		return id
	}
	buyer, courier, admin := user("buyer"), user("courier"), user("admin")

	orderID, silentOrderID := uuid.New(), uuid.New()
	for _, id := range []uuid.UUID{orderID, silentOrderID} {
		if _, err := db.Exec(`INSERT INTO orders (id, business_id, shop_id, assigned_courier_id) VALUES ($1,$2,$3,$4)`, id, businessID, shopID, courier); err != nil {
			t.Fatal(err)
		}
	}
	convID, silentConvID := uuid.New(), uuid.New()
	for _, pair := range [][2]uuid.UUID{{convID, orderID}, {silentConvID, silentOrderID}} {
		if _, err := db.Exec(`INSERT INTO order_conversations (id, order_id, buyer_id, shop_id, business_id) VALUES ($1,$2,$3,$4,$5)`, pair[0], pair[1], buyer, shopID, businessID); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM order_messages WHERE conversation_id IN ($1,$2)`, convID, silentConvID)
		_, _ = db.Exec(`DELETE FROM order_conversations WHERE id IN ($1,$2)`, convID, silentConvID)
		_, _ = db.Exec(`DELETE FROM delivery_status_history WHERE order_id IN ($1,$2)`, orderID, silentOrderID)
		_, _ = db.Exec(`DELETE FROM orders WHERE id IN ($1,$2)`, orderID, silentOrderID)
	})

	msg := func(sender uuid.UUID, from, to models.Party, body string, at time.Time) {
		if _, err := db.Exec(`INSERT INTO order_messages (conversation_id, sender_user_id, sender_type, body, sender_party, recipient_party, recipient_scope, created_at)
			VALUES ($1,$2,$3,$4,$5,$6,'ADMIN',$7)`, convID, sender, string(from), body, string(from), string(to), at); err != nil {
			t.Fatal(err)
		}
	}
	now := time.Now()
	msg(courier, models.PartyCourier, models.PartySeller, "Je suis devant la boutique", now.Add(-3*time.Minute))
	msg(admin, models.PartyAdmin, models.PartySeller, "Colis prêt ?", now.Add(-2*time.Minute))
	msg(buyer, models.PartyBuyer, models.PartyAdmin, "Heure de livraison ?", now.Add(-time.Minute))

	repo := repository.NewOrderConversationRepository(db)

	// Opening the TBK thread must not clear the courier's message.
	if err := repo.MarkChannelReadForParty(convID, models.PartySeller, models.PartyAdmin); err != nil {
		t.Fatal(err)
	}
	unread, err := repo.UnreadByContact(convID, models.PartySeller)
	if err != nil {
		t.Fatal(err)
	}
	if unread[models.PartyAdmin] != 0 || unread[models.PartyCourier] != 1 {
		t.Fatalf("after reading the TBK thread: unread %v, want admin 0 and courier 1", unread)
	}

	// The seller's inbox row: last message of the seller's own channels (not
	// the buyer's message to TBK), and who wrote it.
	items, _, err := repo.ListSellerConversations(&shopID, nil, true, 200, 0)
	if err != nil {
		t.Fatal(err)
	}
	var row *models.ConversationListItemResponse
	for i := range items {
		if items[i].ConversationID == silentConvID {
			t.Fatal("with_messages kept a conversation with no seller message")
		}
		if items[i].ConversationID == convID {
			row = &items[i]
		}
	}
	if row == nil {
		t.Fatal("conversation with seller messages missing from the inbox")
	}
	if row.LastMessage != "Colis prêt ?" || row.LastSenderParty != models.PartyAdmin || row.LastRecipientParty != models.PartySeller {
		t.Fatalf("seller row: %q from %s to %s", row.LastMessage, row.LastSenderParty, row.LastRecipientParty)
	}
	if row.UnreadCount != 1 {
		t.Fatalf("seller unread = %d, want 1 (the courier's)", row.UnreadCount)
	}

	// Without the filter every order conversation is still listed.
	all, _, err := repo.ListSellerConversations(&shopID, nil, false, 500, 0)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, it := range all {
		found = found || it.ConversationID == silentConvID
	}
	if !found {
		t.Fatal("the unfiltered inbox must still list orders without messages")
	}

	// The buyer's row shows only the buyer's own channel.
	buyerItems, _, err := repo.ListBuyerConversations(buyer, true, 10, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(buyerItems) != 1 || buyerItems[0].LastMessage != "Heure de livraison ?" || buyerItems[0].LastSenderParty != models.PartyBuyer {
		t.Fatalf("buyer inbox: %+v", buyerItems)
	}
}
