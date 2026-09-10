package service

import (
	"testing"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

func TestTruncateText(t *testing.T) {
	short := "Hello world"
	if got := truncateText(short, 20); got != "Hello world" {
		t.Fatalf("truncateText(%q, 20) = %q, want %q", short, got, "Hello world")
	}

	long := "This is a very long message that definitely exceeds twenty characters"
	got := truncateText(long, 20)
	if len(got) != 20 || got[len(got)-3:] != "..." {
		t.Fatalf("truncateText(%q, 20) = %q, expected 20 chars ending in '...'", long, got)
	}
}

func TestMetadataSerialization(t *testing.T) {
	meta := map[string]interface{}{
		"order_id":     "12345",
		"order_number": "BTMI-999",
		"is_urgent":    true,
	}

	jsonStr, err := models.MetadataToJSON(meta)
	if err != nil {
		t.Fatalf("MetadataToJSON error: %v", err)
	}
	if jsonStr == "" || jsonStr == "{}" {
		t.Fatalf("Expected non-empty JSON, got %s", jsonStr)
	}

	parsed := models.JSONToMetadata([]byte(jsonStr))
	if parsed["order_number"] != "BTMI-999" {
		t.Fatalf("Expected order_number BTMI-999, got %v", parsed["order_number"])
	}
	if parsed["is_urgent"] != true {
		t.Fatalf("Expected is_urgent true, got %v", parsed["is_urgent"])
	}
}

func TestOrderConversationDetailResponseStruct(t *testing.T) {
	orderID := uuid.New()
	buyerID := uuid.New()
	shopID := uuid.New()
	businessID := uuid.New()

	conv := models.OrderConversation{
		ID:         uuid.New(),
		OrderID:    orderID,
		BuyerID:    buyerID,
		ShopID:     shopID,
		BusinessID: businessID,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	msg := models.OrderMessage{
		ID:                  uuid.New(),
		ConversationID:      conv.ID,
		SenderUserID:        buyerID,
		SenderType:          models.SenderTypeBuyer,
		SenderName:          "Jean Dupont",
		Body:                "Bonjour, quand ma commande sera-t-elle prête ?",
		IsAdminIntervention: false,
		CreatedAt:           time.Now(),
	}

	resp := models.OrderConversationDetailResponse{
		Conversation:   conv,
		OrderNumber:    "BTMI-1001",
		OrderStatus:    "PENDING",
		DeliveryMethod: "TBK",
		FinalTotal:     15000.0,
		ShopName:       "Boutique Centrale",
		BusinessName:   "Entreprise SARL",
		BuyerName:      "Jean Dupont",
		Messages:       []models.OrderMessage{msg},
	}

	if resp.OrderNumber != "BTMI-1001" {
		t.Fatalf("expected order number BTMI-1001, got %s", resp.OrderNumber)
	}
	if len(resp.Messages) != 1 {
		t.Fatalf("expected 1 message, got %d", len(resp.Messages))
	}
	if resp.Messages[0].SenderType != models.SenderTypeBuyer {
		t.Fatalf("expected BUYER sender type, got %s", resp.Messages[0].SenderType)
	}
}
