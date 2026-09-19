package service

import (
	"testing"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

// sellerReadyFixture creates one real order sitting in the exact state the seller UI
// produces before "Marquer prête": order PREPARING on a TBK courier delivery with an
// accepted courier. The order carries the production-dominant TBK_DELIVERY method so the
// regression test covers the legacy spelling that used to skip the delivery milestone.
type sellerReadyFixture struct {
	db          *database.DB
	orderSvc    *OrderService
	orderID     uuid.UUID
	businessID  uuid.UUID
	shopID      uuid.UUID
	sellerID    uuid.UUID
	courierID   *uuid.UUID
	orderNumber string
}

func newSellerReadyFixture(t *testing.T, method, deliveryStatus string, withCourier bool) *sellerReadyFixture {
	t.Helper()
	cfg := config.Load()
	db, err := database.Connect(cfg.DBHost, cfg.DBPort, cfg.DBName, cfg.DBUser, cfg.DBPassword)
	if err != nil {
		t.Skipf("skipping seller ready contract test: no database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	f := &sellerReadyFixture{db: db}
	suffix := uuid.NewString()[:8]
	f.businessID = uuid.New()
	f.shopID = uuid.New()
	f.orderID = uuid.New()
	f.sellerID = uuid.New()
	f.orderNumber = "SR-" + suffix

	must := func(query string, args ...interface{}) {
		t.Helper()
		if _, err := db.Exec(query, args...); err != nil {
			t.Fatalf("fixture %q: %v", query, err)
		}
	}

	must(`INSERT INTO businesses (id,name,business_type,category,phone,whatsapp,email,country,city,default_currency,status)
		VALUES ($1,'Seller Ready Biz','RETAIL','GENERAL','1','1',$2,'DRC','Kinshasa','USD','ACTIVE')`,
		f.businessID, "sr_biz_"+suffix+"@example.com")
	must(`INSERT INTO shops (id,business_id,name,type,city,address,phone,status,supports_shop_delivery,shop_delivery_fee)
		VALUES ($1,$2,'Seller Ready Shop','PHYSICAL','Kinshasa','Centre','1','ACTIVE',FALSE,0)`, f.shopID, f.businessID)
	must(`INSERT INTO users (id,email,password_hash,first_name,last_name,phone,status,account_type)
		VALUES ($1,$2,'hash','Seller','Ready',$3,'ACTIVE','BUYER')`,
		f.sellerID, "sr_seller_"+suffix+"@example.com", "+241"+suffix)

	var courierID interface{}
	var courierRef *uuid.UUID
	if withCourier {
		id := uuid.New()
		courierID = id
		courierRef = &id
		must(`INSERT INTO users (id,email,password_hash,first_name,last_name,phone,status,account_type)
			VALUES ($1,$2,'hash','Courier','Ready',$3,'ACTIVE','BUYER')`,
			id, "sr_courier_"+suffix+"@example.com", "+242"+suffix)
	}
	f.courierID = courierRef
	must(`INSERT INTO orders (id,business_id,shop_id,created_by,status,total_items,base_total,final_total,
		order_number,currency,delivery_method,delivery_status,assigned_courier_id)
		VALUES ($1,$2,$3,$4,'PREPARING',1,100,100,$5,'USD',$6,$7,$8)`,
		f.orderID, f.businessID, f.shopID, f.sellerID, f.orderNumber, method, deliveryStatus, courierID)

	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM order_status_history WHERE order_id=$1`, f.orderID)
		_, _ = db.Exec(`DELETE FROM orders WHERE id=$1`, f.orderID)
		_, _ = db.Exec(`DELETE FROM shops WHERE id=$1`, f.shopID)
		_, _ = db.Exec(`DELETE FROM businesses WHERE id=$1`, f.businessID)
		_, _ = db.Exec(`DELETE FROM users WHERE id=$1`, f.sellerID)
		if f.courierID != nil {
			_, _ = db.Exec(`DELETE FROM users WHERE id=$1`, *f.courierID)
		}
	})

	orderRepo := repository.NewOrderRepository(db)
	f.orderSvc = NewOrderService(orderRepo, repository.NewInventoryRepository(db),
		repository.NewStockMovementRepository(db), repository.NewShopRepository(db),
		repository.NewProductRepository(db), repository.NewVariantRepository(db),
		repository.NewAssignmentRepository(db), repository.NewMembershipRepository(db),
		repository.NewEmployeeRepository(db), repository.NewCustomerRepository(db),
		repository.NewCashRepository(db), repository.NewBuyerProfileRepository(db),
		repository.NewBuyerPaymentRepository(db), nil, db)
	return f
}

// The exact production bug: a TBK_DELIVERY order with an accepted courier is marked READY
// by the seller. Both order.status and delivery_status must move in the same transaction,
// and the write must survive a re-query.
func TestSellerReadyAdvancesCourierMilestoneForTBKDelivery(t *testing.T) {
	f := newSellerReadyFixture(t, "TBK_DELIVERY", "COURIER_ACCEPTED", true)

	updated, err := f.orderSvc.TransitionOrder(f.orderID, f.sellerID, models.OrderStatusReady, "", "SELLER")
	if err != nil {
		t.Fatalf("seller READY transition failed: %v", err)
	}
	if updated.Status != models.OrderStatusReady {
		t.Fatalf("order.status = %s, want READY", updated.Status)
	}
	if updated.DeliveryStatus != models.DeliveryStatusReadyForPickup {
		t.Fatalf("delivery_status = %s, want READY_FOR_PICKUP", updated.DeliveryStatus)
	}
	if updated.ReadyAt == nil {
		t.Fatal("ready_at is nil, want it stamped")
	}

	re, err := f.orderSvc.orderRepo.GetByID(f.orderID)
	if err != nil || re == nil {
		t.Fatalf("order lookup after transition: %v", err)
	}
	if re.Status != models.OrderStatusReady || re.DeliveryStatus != models.DeliveryStatusReadyForPickup {
		t.Fatalf("transition not persisted: status=%s delivery_status=%s", re.Status, re.DeliveryStatus)
	}

	var readyAtPresent bool
	if err := f.db.QueryRow(`SELECT ready_at IS NOT NULL FROM orders WHERE id=$1`, f.orderID).Scan(&readyAtPresent); err != nil {
		t.Fatal(err)
	}
	if !readyAtPresent {
		t.Fatal("ready_at not persisted")
	}
}

// TBK_STANDARD is the delivery_method on the live order that exposed the bug.
// Cover the complete persisted transition, not only the courier-flow predicate.
func TestSellerReadyAdvancesCourierMilestoneForTBKStandard(t *testing.T) {
	f := newSellerReadyFixture(t, "TBK_STANDARD", "COURIER_ACCEPTED", true)

	updated, err := f.orderSvc.TransitionOrder(f.orderID, f.sellerID, models.OrderStatusReady, "", "SELLER")
	if err != nil {
		t.Fatalf("seller READY transition failed: %v", err)
	}
	if updated.Status != models.OrderStatusReady || updated.DeliveryStatus != models.DeliveryStatusReadyForPickup || updated.ReadyAt == nil {
		t.Fatalf("response: status=%s delivery_status=%s ready_at=%v", updated.Status, updated.DeliveryStatus, updated.ReadyAt)
	}

	var status, deliveryStatus string
	var readyAtPresent bool
	if err := f.db.QueryRow(`SELECT status, COALESCE(delivery_status, ''), ready_at IS NOT NULL FROM orders WHERE id=$1`, f.orderID).
		Scan(&status, &deliveryStatus, &readyAtPresent); err != nil {
		t.Fatal(err)
	}
	if status != string(models.OrderStatusReady) || deliveryStatus != models.DeliveryStatusReadyForPickup || !readyAtPresent {
		t.Fatalf("persisted: status=%s delivery_status=%s ready_at_present=%v", status, deliveryStatus, readyAtPresent)
	}
}

// The legacy empty-method spelling still on old courier orders must behave the same when a
// courier is already assigned: readiness is courier business, not a method string.
func TestSellerReadyAdvancesCourierMilestoneForLegacyMethodWithCourier(t *testing.T) {
	f := newSellerReadyFixture(t, "", "COURIER_ACCEPTED", true)

	updated, err := f.orderSvc.TransitionOrder(f.orderID, f.sellerID, models.OrderStatusReady, "", "SELLER")
	if err != nil {
		t.Fatalf("seller READY transition failed: %v", err)
	}
	if updated.DeliveryStatus != models.DeliveryStatusReadyForPickup {
		t.Fatalf("delivery_status = %s, want READY_FOR_PICKUP for a courier order", updated.DeliveryStatus)
	}
}

// A non-courier delivery (SHOP_DELIVERY, no courier) must stay untouched: no fabricated
// READY_FOR_PICKUP milestone for flows the seller dispatches itself.
func TestSellerReadyLeavesNonCourierDeliveryUntouched(t *testing.T) {
	f := newSellerReadyFixture(t, "SHOP_DELIVERY", "", false)

	updated, err := f.orderSvc.TransitionOrder(f.orderID, f.sellerID, models.OrderStatusReady, "", "SELLER")
	if err != nil {
		t.Fatalf("seller READY transition failed: %v", err)
	}
	if updated.Status != models.OrderStatusReady {
		t.Fatalf("order.status = %s, want READY", updated.Status)
	}
	var storedDeliveryStatus string
	if err := f.db.QueryRow(`SELECT COALESCE(delivery_status, '') FROM orders WHERE id=$1`, f.orderID).Scan(&storedDeliveryStatus); err != nil {
		t.Fatalf("read stored delivery_status: %v", err)
	}
	if storedDeliveryStatus == models.DeliveryStatusReadyForPickup {
		t.Fatalf("delivery_status = READY_FOR_PICKUP, want it untouched for a non-courier flow")
	}
}

// Unit-level truth table for the courier-flow detector.
func TestIsCourierPickupReady(t *testing.T) {
	cases := []struct {
		name      string
		method    string
		delivery  string
		courier   bool
		wantReady bool
	}{
		{"tbk standard + accepted", "TBK_STANDARD", "COURIER_ACCEPTED", true, true},
		{"tbk standard no courier yet", "TBK_STANDARD", "", false, true},
		{"tbk delivery legacy spelling", "TBK_DELIVERY", "COURIER_ACCEPTED", true, true},
		{"tbk legacy spelling", "TBK", "COURIER_ACCEPTED", true, true},
		{"empty method accepted courier", "", "COURIER_ACCEPTED", false, true},
		{"empty method assigned courier", "", "", true, true},
		{"pending tbk assignment", "", "PENDING_TBK_ASSIGNMENT", false, true},
		{"courier assigned in flight", "", "COURIER_ASSIGNED", false, true},
		{"shop delivery no courier", "SHOP_DELIVERY", "", false, false},
		{"partner no courier", "PARTNER", "", false, false},
		{"pickup no courier", "PICKUP", "", false, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isCourierPickupReady(tc.method, tc.delivery, tc.courier); got != tc.wantReady {
				t.Fatalf("isCourierPickupReady(%q,%q,%v) = %v, want %v", tc.method, tc.delivery, tc.courier, got, tc.wantReady)
			}
		})
	}
}
