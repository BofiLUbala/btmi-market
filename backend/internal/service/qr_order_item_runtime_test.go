package service

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

// orderItemQRFixture is one real order in the database whose line snapshot differs
// from the current catalogue (the product now lists at 120 but the buyer ordered at
// 100, with a 5-points-per-unit discount, quantity 2, 10 delivery fee), so the
// resolution tests can prove the QR reads the immutable snapshot and never the live
// price.
type orderItemQRFixture struct {
	db      *database.DB
	qr      *QRService
	token   string
	orderID uuid.UUID
	lineID  uuid.UUID

	orderNumber string

	businessID  uuid.UUID
	shopID      uuid.UUID
	productID   uuid.UUID
	variantID   uuid.UUID
	buyerUserID uuid.UUID
	buyerProfID uuid.UUID
	sellerID    uuid.UUID
	courierID   uuid.UUID
	outsiderID  uuid.UUID
}

func newOrderItemQRFixture(t *testing.T, prepaid bool) *orderItemQRFixture {
	t.Helper()
	t.Setenv("QR_SIGNING_SECRET", handoverTestSecret)
	db := connectHandoverDB(t)

	// Fully-wire the QR service the way production does, with the membership repo
	// the seller role check uses; the test only reads, so handover/payment wiring
	// is not required (resp. would double the fixture's surface). The service must
	// exist before EnsureOrderItemQR below can run.
	f := &orderItemQRFixture{
		db: db,
		qr: NewQRService(db, repository.NewMembershipRepository(db),
			repository.NewAssignmentRepository(db), repository.NewEmployeeRepository(db), nil),
	}
	q := uuid.NewString()
	suffix := strings.ReplaceAll(q[:8], "-", "")
	mustExec := func(query string, args ...interface{}) {
		t.Helper()
		if _, err := db.Exec(query, args...); err != nil {
			t.Fatalf("fixture %q: %v", query[:min(60, len(query))], err)
		}
	}

	f.businessID, f.shopID = uuid.New(), uuid.New()
	mustExec(`INSERT INTO businesses (id,name,business_type,category,phone,whatsapp,email,country,city,default_currency,status)
		VALUES ($1,'ZENAS','RETAIL','GENERAL','1','1',$2,'DRC','Kinshasa','USD','ACTIVE')`,
		f.businessID, "oibiz_"+suffix+"@example.com")
	mustExec(`INSERT INTO shops (id,business_id,name,type,city,address,phone,status,supports_shop_delivery,shop_delivery_fee)
		VALUES ($1,$2,'ZENAS Shop','PHYSICAL','Kinshasa','Centre','1','ACTIVE',FALSE,0)`, f.shopID, f.businessID)

	// Catalogue price is now 120; the snapshot on the order line below is 100.
	f.productID = uuid.New()
	mustExec(`INSERT INTO products (id,business_id,name,sku,unit_price,status,publication_status)
		VALUES ($1,$2,'Adidas Superstar','SKU-'||$3,120,'ACTIVE','PUBLISHED')`, f.productID, f.businessID, suffix)
	f.variantID = uuid.New()
	mustExec(`INSERT INTO product_variants (id,product_id,sku,name,attributes,sale_price,status)
		VALUES ($1,$2,'VAR-'||$3,'White / Size 42','{"size":"42","color":"White"}',120,'ACTIVE')`,
		f.variantID, f.productID, suffix)

	// Seller with an active membership in the business.
	f.sellerID = uuid.New()
	mustExec(`INSERT INTO users (id,email,password_hash,first_name,last_name,phone,status,account_type)
		VALUES ($1,$2,'hash','Zenas','Seller',$3,'ACTIVE','BUYER')`,
		f.sellerID, "seller_"+suffix+"@example.com", "+243"+suffix)
	mustExec(`INSERT INTO business_memberships (user_id,business_id,role,status)
		VALUES ($1,$2,'OWNER','ACTIVE')`, f.sellerID, f.businessID)

	// Buyer: John Doe.
	f.buyerUserID, f.buyerProfID = uuid.New(), uuid.New()
	mustExec(`INSERT INTO users (id,email,password_hash,first_name,last_name,phone,status,account_type)
		VALUES ($1,$2,'hash','John','Doe',$3,'ACTIVE','BUYER')`,
		f.buyerUserID, "john_"+suffix+"@example.com", "+2431"+suffix)
	mustExec(`INSERT INTO buyer_profiles (id,user_id,first_name,last_name,email,phone,address,commune,city,country,status)
		VALUES ($1,$2,'John','Doe',$3,'0990000001','Masina','Masina','Kinshasa','DRC','ACTIVE')`,
		f.buyerProfID, f.buyerUserID, "john_"+suffix+"@example.com")

	// Courier assigned to the delivery.
	f.courierID = uuid.New()
	mustExec(`INSERT INTO users (id,email,password_hash,first_name,last_name,phone,status,account_type)
		VALUES ($1,$2,'hash','Courier','One',$3,'ACTIVE','BUYER')`,
		f.courierID, "courier_"+suffix+"@example.com", "+2432"+suffix)
	mustExec(`INSERT INTO couriers (id,user_id,status,availability,transport_type)
		VALUES ($1,$2,'ACTIVE','AVAILABLE','MOTO')`, uuid.New(), f.courierID)

	// An authenticated user with no connection to the order at all.
	f.outsiderID = uuid.New()
	mustExec(`INSERT INTO users (id,email,password_hash,first_name,last_name,phone,status,account_type)
		VALUES ($1,$2,'hash','Out','Sider',$3,'ACTIVE','BUYER')`,
		f.outsiderID, "out_"+suffix+"@example.com", "+2433"+suffix)

	// The order: priced at 100/unit at order time, Gombe address snapshot.
	f.orderID = uuid.New()
	f.orderNumber = "BTMI-" + suffix
	mustExec(`INSERT INTO orders (id,business_id,shop_id,buyer_profile_id,status,total_items,base_total,points_used,points_discount_amount,final_total,
		order_number,currency,delivery_method,delivery_fee_final,delivery_status,assigned_courier_id,
		delivery_contact_name,delivery_phone,delivery_notes,
		delivery_province,delivery_city,delivery_commune,delivery_street,delivery_building_number,delivery_landmark)
		VALUES ($1,$2,$3,$4,'READY',2,240,10,10,190,$5,'USD','TBK_DELIVERY',10,'READY_FOR_PICKUP',$6,
		        'John Doe','+2439000000','Appeler avant de livrer',
		        'Kinshasa','Kinshasa','Gombe','Colonel Mondjiba','25','pres de l''ecole')`,
		f.orderID, f.businessID, f.shopID, f.buyerProfID, f.orderNumber, f.courierID)

	f.lineID = uuid.New()
	mustExec(`INSERT INTO order_lines (id,order_id,product_id,variant_id,quantity,unit_price,base_unit_price,points_discount_per_unit,final_unit_price,
		product_name,product_sku,variant_name,variant_sku,variant_attributes,image_url)
		VALUES ($1,$2,$3,$4,2,100,120,5,95,
		        'Adidas Superstar','SKU-'||$5,'White / Size 42','VAR-'||$5,'{"size":"42","color":"White"}','/uploads/adidas.png')`,
		f.lineID, f.orderID, f.productID, f.variantID, suffix)

	paymentMethod := models.PaymentMethodCashOnDelivery
	timing := "DELIVERY"
	paymentStatus := "PENDING"
	var verifiedAt interface{} = nil
	if prepaid {
		paymentMethod = models.PaymentMethodMobilePayNow
		timing = "NOW"
		paymentStatus = "PAID"
		verifiedAt = time.Now()
	}
	mustExec(`INSERT INTO buyer_payments (order_id,business_id,shop_id,buyer_profile_id,payment_method,currency,
		products_base_total,products_points_used,products_points_discount,products_final_total,
		delivery_fee_final,cash_due,final_total,status,provider,payment_timing,verified_at,paid_at,confirmation_actor)
		VALUES ($1,$2,$3,$4,$5,'USD',240,10,10,190,
		        10,200,200,$6,$7,$8,$9::timestamptz,$9::timestamptz,
		        CASE WHEN $9::timestamptz IS NULL THEN '' ELSE 'PROVIDER' END)`,
		f.orderID, f.businessID, f.shopID, f.buyerProfID, paymentMethod, paymentStatus,
		providerFor(paymentMethod), timing, verifiedAt)

	// The QR identity row exists for every order line (backfill covers historical
	// rows; this one is created the same way the service does).
	if err := f.qr.EnsureOrderItemQR(f.orderID, f.lineID); err != nil {
		t.Fatalf("ensure order item qr: %v", err)
	}
	var pubRef uuid.UUID
	if err := db.QueryRow(`SELECT public_reference FROM order_item_qr_codes WHERE order_line_id=$1`, f.lineID).Scan(&pubRef); err != nil {
		t.Fatalf("read order item qr reference: %v", err)
	}

	f.token = f.qr.token("oi", pubRef.String())

	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM buyer_payments WHERE order_id=$1`, f.orderID)
		_, _ = db.Exec(`DELETE FROM orders WHERE id=$1`, f.orderID)
		_, _ = db.Exec(`DELETE FROM products WHERE id=$1`, f.productID)
		_, _ = db.Exec(`DELETE FROM buyer_profiles WHERE id=$1`, f.buyerProfID)
		_, _ = db.Exec(`DELETE FROM couriers WHERE user_id=$1`, f.courierID)
		_, _ = db.Exec(`DELETE FROM users WHERE id IN ($1,$2,$3,$4)`, f.buyerUserID, f.courierID, f.sellerID, f.outsiderID)
		_, _ = db.Exec(`DELETE FROM shops WHERE id=$1`, f.shopID)
		_, _ = db.Exec(`DELETE FROM businesses WHERE id=$1`, f.businessID)
		db.Close()
	})
	return f
}

// The same QR resolves to the immutable snapshots for every role, with role-visible
// fields only: the buyer sees their own order, the seller preparation info, the
// courier the recipient and cash to collect, the admin everything.
func TestOrderItemQRRoleResolution(t *testing.T) {
	f := newOrderItemQRFixture(t, false)

	t.Run("buyer sees snapshot price and own delivery address", func(t *testing.T) {
		res, err := f.qr.ResolveOrderItemQR(f.buyerUserID, "", f.token)
		if err != nil {
			t.Fatalf("buyer resolve: %v", err)
		}
		if res.Role != models.QRRoleBuyer {
			t.Fatalf("role = %s, want BUYER", res.Role)
		}
		// Snapshot price 100, NOT the current catalogue price 120.
		if res.Price.UnitPrice != 100 {
			t.Fatalf("unit price = %.2f, want snapshot 100 (catalogue is 120)", res.Price.UnitPrice)
		}
		if res.Price.Subtotal != 200 || res.Price.Discount != 40 || res.Price.PointsDiscount != 10 {
			t.Fatalf("pricing snapshot wrong: subtotal=%v discount=%v points=%v", res.Price.Subtotal, res.Price.Discount, res.Price.PointsDiscount)
		}
		if res.Price.ItemTotal != 190 || res.Price.DeliveryFee != 10 || res.Price.FinalAmount != 200 || res.Price.Currency != "USD" {
			t.Fatalf("totals wrong: item=%v fee=%v final=%v currency=%s", res.Price.ItemTotal, res.Price.DeliveryFee, res.Price.FinalAmount, res.Price.Currency)
		}
		if res.DeliveryAddress == nil {
			t.Fatal("buyer must see their own delivery address")
		}
		if res.DeliveryAddress.Commune != "Gombe" || res.DeliveryAddress.Street != "Colonel Mondjiba" || res.DeliveryAddress.BuildingNumber != "25" {
			t.Fatalf("delivery address must come from the order snapshot: %+v", res.DeliveryAddress)
		}
		if res.Buyer != nil {
			t.Fatal("buyer resolution must not echo an identity block")
		}
		if res.Product.ProductName != "Adidas Superstar" || res.Product.VariantName != "White / Size 42" || res.Product.Quantity != 2 {
			t.Fatalf("product snapshot wrong: %+v", res.Product)
		}
	})

	t.Run("seller sees product and buyer name, not contact details or address", func(t *testing.T) {
		res, err := f.qr.ResolveOrderItemQR(f.sellerID, "", f.token)
		if err != nil {
			t.Fatalf("seller resolve: %v", err)
		}
		if res.Role != models.QRRoleSeller {
			t.Fatalf("role = %s, want SELLER", res.Role)
		}
		if res.Buyer == nil || res.Buyer.FirstName != "John" || res.Buyer.LastName != "Doe" {
			t.Fatalf("seller must see buyer name: %+v", res.Buyer)
		}
		if res.Buyer.Phone != "" || res.Buyer.Email != "" {
			t.Fatalf("seller must not see buyer contact details: %+v", res.Buyer)
		}
		if res.DeliveryAddress != nil {
			t.Fatal("seller must not receive the buyer's delivery address")
		}
		if res.Order.PaymentMethod != "" || res.Order.PaymentStatus != "" {
			t.Fatalf("seller must not see payment details: %+v", res.Order)
		}
		if res.Price.UnitPrice != 100 {
			t.Fatalf("seller price must come from snapshot: %v", res.Price.UnitPrice)
		}
	})

	t.Run("courier sees recipient, address and cash to collect, no unit prices", func(t *testing.T) {
		res, err := f.qr.ResolveOrderItemQR(f.courierID, "", f.token)
		if err != nil {
			t.Fatalf("courier resolve: %v", err)
		}
		if res.Role != models.QRRoleCourier {
			t.Fatalf("role = %s, want COURIER", res.Role)
		}
		if res.DeliveryAddress == nil || res.DeliveryAddress.RecipientName != "John Doe" || res.DeliveryAddress.RecipientPhone != "+2439000000" {
			t.Fatalf("courier must see recipient + address: %+v", res.DeliveryAddress)
		}
		if res.Price.AmountToCollect != 200 {
			t.Fatalf("courier must collect 200 for cash on delivery, got %v", res.Price.AmountToCollect)
		}
		if res.Price.UnitPrice != 0 || res.Price.FinalAmount != 0 || res.Price.Subtotal != 0 {
			t.Fatalf("courier must not see financial detail: %+v", res.Price)
		}
		if res.Product.ProductImage != "/uploads/adidas.png" {
			t.Fatalf("courier needs the product image: %+v", res.Product)
		}
		if res.Order.OrderID != uuid.Nil {
			t.Fatal("internal ids are withheld from the courier view")
		}
	})

	t.Run("admin sees the full operational context", func(t *testing.T) {
		res, err := f.qr.ResolveOrderItemQR(uuid.Nil, models.QRRoleAdmin, f.token)
		if err != nil {
			t.Fatalf("admin resolve: %v", err)
		}
		if res.Role != models.QRRoleAdmin {
			t.Fatalf("role = %s, want ADMIN", res.Role)
		}
		if res.Buyer == nil || res.Buyer.Email == "" || res.Buyer.Phone == "" {
			t.Fatalf("admin sees buyer contact details: %+v", res.Buyer)
		}
		if res.Order.PaymentMethod == "" || res.Order.PaymentStatus == "" {
			t.Fatalf("admin sees payment state: %+v", res.Order)
		}
		if res.DeliveryAddress == nil {
			t.Fatal("admin sees the delivery snapshot")
		}
	})

	t.Run("unrelated user is refused", func(t *testing.T) {
		_, err := f.qr.ResolveOrderItemQR(f.outsiderID, "", f.token)
		if !errors.Is(err, ErrQRForbidden) {
			t.Fatalf("outsider must be forbidden, got %v", err)
		}
	})
}

// A prepaid (mobile-money, pay-now) order shows the courier nothing to collect.
func TestOrderItemQRPrepaidNothingToCollect(t *testing.T) {
	f := newOrderItemQRFixture(t, true)
	res, err := f.qr.ResolveOrderItemQR(f.courierID, "", f.token)
	if err != nil {
		t.Fatalf("courier resolve: %v", err)
	}
	if res.Role != models.QRRoleCourier {
		t.Fatalf("role = %s, want COURIER", res.Role)
	}
	if res.Price.AmountToCollect != 0 {
		t.Fatalf("prepaid order must have nothing to collect, got %v", res.Price.AmountToCollect)
	}
	if res.Price.Currency != "USD" {
		t.Fatalf("currency must still be reported: %s", res.Price.Currency)
	}
}

// An ORDER_ITEM token is opaque and signed exactly like the other kinds, and a
// product token can never be replayed as an order-item token.
func TestOrderItemQRTokenOpaqueAndKindBound(t *testing.T) {
	svc := newTestQRService(t, "test-secret")
	ref := uuid.New()
	tok := svc.token("oi", ref.String())
	parts := strings.Split(tok, ".")
	if len(parts) != 4 || parts[0] != "tbk" || parts[1] != "oi" || parts[2] != ref.String() {
		t.Fatalf("unexpected order-item token shape: %q", tok)
	}
	if got, err := svc.parse(tok, "oi"); err != nil || got != ref {
		t.Fatalf("order-item token failed to round-trip: %v", err)
	}
	// A product QR scanned on an order-item flow is rejected by kind.
	if _, err := svc.parse(svc.token("p", ref.String()), "oi"); err == nil {
		t.Fatal("product token accepted as an order-item token")
	}
}
