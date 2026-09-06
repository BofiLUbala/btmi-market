package service

import (
	"testing"

	"github.com/btmi-ai-market/backend/internal/models"
)

func TestDeliverySpecificOrderTransitions(t *testing.T) {
	tests := []struct {
		name     string
		method   string
		from, to models.OrderStatus
		want     bool
	}{
		{"pickup becomes ready for pickup", "PICKUP", models.OrderStatusPreparing, models.OrderStatusReadyForPickup, true},
		{"pickup cannot use generic ready", "PICKUP", models.OrderStatusPreparing, models.OrderStatusReady, false},
		{"pickup cannot dispatch", "PICKUP", models.OrderStatusReadyForPickup, models.OrderStatusOutForDelivery, false},
		{"tbk standard becomes ready", models.DeliveryMethodTBK, models.OrderStatusPreparing, models.OrderStatusReady, true},
		{"tbk standard dispatches out for delivery", models.DeliveryMethodTBK, models.OrderStatusReady, models.OrderStatusOutForDelivery, true},
		{"tbk standard delivers", models.DeliveryMethodTBK, models.OrderStatusOutForDelivery, models.OrderStatusDelivered, true},
		{"shop delivery becomes ready", "SHOP_DELIVERY", models.OrderStatusPreparing, models.OrderStatusReady, true},
		{"shop delivery dispatches", "SHOP_DELIVERY", models.OrderStatusReady, models.OrderStatusOutForDelivery, true},
		{"shop delivery cannot use pickup state", "SHOP_DELIVERY", models.OrderStatusPreparing, models.OrderStatusReadyForPickup, false},
		{"partner is handed off", "PARTNER", models.OrderStatusReady, models.OrderStatusHandedToPartner, true},
		{"partner cannot use shop dispatch", "PARTNER", models.OrderStatusReady, models.OrderStatusOutForDelivery, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := canTransition(tt.from, tt.to, tt.method); got != tt.want {
				t.Fatalf("canTransition(%s, %s, %s) = %v, want %v", tt.from, tt.to, tt.method, got, tt.want)
			}
		})
	}
}

func TestOrderTransitionActors(t *testing.T) {
	if canActorSetStatus("SELLER", models.OrderStatusReceived) || canActorSetStatus("SELLER", models.OrderStatusCompleted) {
		t.Fatal("seller must not confirm buyer receipt or complete an order")
	}
	if !canActorSetStatus("BUYER", models.OrderStatusReceived) || canActorSetStatus("BUYER", models.OrderStatusPreparing) {
		t.Fatal("buyer must only confirm receipt")
	}
	if !canActorSetStatus("SYSTEM", models.OrderStatusCompleted) || canActorSetStatus("SYSTEM", models.OrderStatusDelivered) {
		t.Fatal("system must only perform authoritative completion")
	}
}
