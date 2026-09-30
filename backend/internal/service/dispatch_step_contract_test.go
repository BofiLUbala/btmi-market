package service

import (
	"testing"

	"github.com/btmi-ai-market/backend/internal/models"
)

func TestSellerCannotMarkTBKOrderReadyWithoutCourier(t *testing.T) {
	f := newSellerReadyFixture(t, "TBK_DELIVERY", models.DeliveryStatusPendingTBK, false)

	_, err := f.orderSvc.TransitionOrder(f.orderID, f.sellerID, models.OrderStatusReady, "", "SELLER")
	if err == nil || err.Error() != "COURIER_NOT_ASSIGNED" {
		t.Fatalf("err = %v, want COURIER_NOT_ASSIGNED", err)
	}
	var status string
	if err := f.db.QueryRow(`SELECT status FROM orders WHERE id=$1`, f.orderID).Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != string(models.OrderStatusPreparing) {
		t.Fatalf("status = %s, want PREPARING untouched", status)
	}
}

func TestCommerceCannotDispatchOutsideTheDispatchStep(t *testing.T) {
	cases := []struct {
		name, method, orderStatus, deliveryStatus, want string
	}{
		{"cancelled order", "TBK_DELIVERY", "CANCELLED", models.DeliveryStatusPendingTBK, "ORDER_NOT_ASSIGNABLE"},
		{"delivered order", "TBK_DELIVERY", "DELIVERED", models.DeliveryStatusDelivered, "ORDER_NOT_ASSIGNABLE"},
		{"parcel already picked up", "TBK_DELIVERY", "OUT_FOR_DELIVERY", models.DeliveryStatusPickedUp, "ORDER_NOT_ASSIGNABLE"},
		{"in transit while still READY", "TBK_DELIVERY", "READY", models.DeliveryStatusInTransit, "DELIVERY_ALREADY_STARTED"},
		{"pickup order", "PICKUP", "PREPARING", "", "NOT_TBK_DELIVERY"},
		{"checkout not finished", "TBK_DELIVERY", "PENDING", models.DeliveryStatusPendingTBK, "PAYMENT_METHOD_REQUIRED"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newSellerReadyFixture(t, tc.method, tc.deliveryStatus, true)
			if _, err := f.db.Exec(`UPDATE orders SET status=$2::order_status, assigned_courier_id=NULL WHERE id=$1`, f.orderID, tc.orderStatus); err != nil {
				t.Fatal(err)
			}
			svc := &AdminCommerceService{db: f.db}

			err := svc.assignCourierTx(f.orderID, *f.courierID, "")
			if err == nil || err.Error() != tc.want {
				t.Fatalf("err = %v, want %s", err, tc.want)
			}
			var assigned *string
			if err := f.db.QueryRow(`SELECT assigned_courier_id::text FROM orders WHERE id=$1`, f.orderID).Scan(&assigned); err != nil {
				t.Fatal(err)
			}
			if assigned != nil {
				t.Fatalf("assigned_courier_id = %s, want no courier written", *assigned)
			}
		})
	}
}
