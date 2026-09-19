package orders

import (
	"testing"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

func TestToOrderResponseIncludesCourierDeliveryState(t *testing.T) {
	courierID := uuid.New()
	order := &models.Order{
		ID:                uuid.New(),
		DeliveryMethod:    string(models.DeliveryMethodTBK),
		DeliveryStatus:    models.DeliveryStatusReadyForPickup,
		AssignedCourierID: &courierID,
	}

	response := toOrderResponse(order)
	if response.DeliveryStatus != models.DeliveryStatusReadyForPickup {
		t.Fatalf("delivery_status = %q, want %q", response.DeliveryStatus, models.DeliveryStatusReadyForPickup)
	}
	if response.AssignedCourierID == nil || *response.AssignedCourierID != courierID {
		t.Fatalf("assigned_courier_id = %v, want %s", response.AssignedCourierID, courierID)
	}
}
