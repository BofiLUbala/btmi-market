package service

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

// handoverFixture is one complete, real order sitting in the database: a seller with a
// published two-variant product, a buyer, an active courier assigned to the delivery, a
// package QR and a payment snapshot. Every test below drives the real services against it.
type handoverFixture struct {
	db  *database.DB
	qr  *QRService
	pay *PaymentService

	orderID     uuid.UUID
	orderNumber string
	businessID  uuid.UUID
	shopID      uuid.UUID
	buyerUserID uuid.UUID
	buyerProfID uuid.UUID
	courierID   uuid.UUID
	paymentID   uuid.UUID

	productID     uuid.UUID
	variantID     uuid.UUID
	orderLineID   uuid.UUID
	productToken  string
	productNumber string

	// A second, unrelated product from a different seller, used to prove that scanning
	// the wrong thing is refused rather than quietly accepted.
	otherProductToken string
	// A product from the SAME seller that this order was not placed for.
	unorderedProductToken string
	// A different variant of the SAME product, which the order was not placed for.
	wrongVariantToken string
}

const handoverTestSecret = "handover-runtime-test-secret"

func connectHandoverDB(t *testing.T) *database.DB {
	t.Helper()
	cfg := config.Load()
	db, err := database.Connect(cfg.DBHost, cfg.DBPort, cfg.DBName, cfg.DBUser, cfg.DBPassword)
	if err != nil {
		t.Skipf("skipping handover runtime test: no database: %v", err)
	}
	// The package directory is the usual working directory for go test, but a
	// pre-built test binary can be launched from the module root, so try both.
	migrated := false
	for _, dir := range []string{"../../migrations", "migrations"} {
		if err := db.RunMigrations(dir); err == nil {
			migrated = true
			break
		}
	}
	if !migrated {
		t.Fatal("could not apply migrations from either ../../migrations or migrations")
	}
	return db
}

func newHandoverFixture(t *testing.T, paymentMethod string) *handoverFixture {
	t.Helper()
	t.Setenv("QR_SIGNING_SECRET", handoverTestSecret)
	db := connectHandoverDB(t)

	f := &handoverFixture{db: db}
	suffix := uuid.NewString()[:8]
	mustExec := func(query string, args ...interface{}) {
		t.Helper()
		if _, err := db.Exec(query, args...); err != nil {
			t.Fatalf("fixture %q: %v", query[:min(60, len(query))], err)
		}
	}

	// --- seller side -------------------------------------------------------------
	f.businessID, f.shopID = uuid.New(), uuid.New()
	mustExec(`INSERT INTO businesses (id,name,business_type,category,phone,whatsapp,email,country,city,default_currency,status)
		VALUES ($1,'Handover Biz','RETAIL','GENERAL','1','1',$2,'DRC','Kinshasa','USD','ACTIVE')`,
		f.businessID, "biz_"+suffix+"@example.com")
	mustExec(`INSERT INTO shops (id,business_id,name,type,city,address,phone,status,supports_shop_delivery,shop_delivery_fee)
		VALUES ($1,$2,'Handover Shop','PHYSICAL','Kinshasa','Centre','1','ACTIVE',FALSE,0)`, f.shopID, f.businessID)

	f.productID = uuid.New()
	mustExec(`INSERT INTO products (id,business_id,name,sku,unit_price,status,publication_status)
		VALUES ($1,$2,'Handover Product','SKU-'||$3,100,'ACTIVE','PUBLISHED')`, f.productID, f.businessID, suffix)

	f.variantID = uuid.New()
	wrongVariantID := uuid.New()
	mustExec(`INSERT INTO product_variants (id,product_id,sku,name,attributes,sale_price,status)
		VALUES ($1,$2,'VAR-A-'||$3,'Rouge / 42','{"color":"rouge","size":"42"}',100,'ACTIVE')`,
		f.variantID, f.productID, suffix)
	mustExec(`INSERT INTO product_variants (id,product_id,sku,name,attributes,sale_price,status)
		VALUES ($1,$2,'VAR-B-'||$3,'Bleu / 44','{"color":"bleu","size":"44"}',100,'ACTIVE')`,
		wrongVariantID, f.productID, suffix)

	// Another product from the same seller that this order does not include.
	unorderedProductID, unorderedVariantID := uuid.New(), uuid.New()
	mustExec(`INSERT INTO products (id,business_id,name,sku,unit_price,status,publication_status)
		VALUES ($1,$2,'Unordered Product','USKU-'||$3,50,'ACTIVE','PUBLISHED')`, unorderedProductID, f.businessID, suffix)
	mustExec(`INSERT INTO product_variants (id,product_id,sku,name,attributes,sale_price,status)
		VALUES ($1,$2,'UVAR-'||$3,'Vert / 40','{}',50,'ACTIVE')`, unorderedVariantID, unorderedProductID, suffix)

	// A product belonging to a different business entirely.
	otherBizID, otherProductID, otherVariantID := uuid.New(), uuid.New(), uuid.New()
	mustExec(`INSERT INTO businesses (id,name,business_type,category,phone,whatsapp,email,country,city,default_currency,status)
		VALUES ($1,'Other Biz','RETAIL','GENERAL','2','2',$2,'DRC','Kinshasa','USD','ACTIVE')`,
		otherBizID, "other_"+suffix+"@example.com")
	mustExec(`INSERT INTO products (id,business_id,name,sku,unit_price,status,publication_status)
		VALUES ($1,$2,'Other Product','OSKU-'||$3,10,'ACTIVE','PUBLISHED')`, otherProductID, otherBizID, suffix)
	mustExec(`INSERT INTO product_variants (id,product_id,sku,name,attributes,sale_price,status)
		VALUES ($1,$2,'OVAR-'||$3,'Autre','{}',10,'ACTIVE')`, otherVariantID, otherProductID, suffix)

	// Variant-level QR codes. In production these are created with the variant; the
	// fixture creates them explicitly so the test controls the references it prints.
	for _, pair := range [][2]uuid.UUID{
		{f.productID, f.variantID}, {f.productID, wrongVariantID},
		{unorderedProductID, unorderedVariantID}, {otherProductID, otherVariantID},
	} {
		mustExec(`INSERT INTO product_qr_codes(product_id,variant_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, pair[0], pair[1])
	}

	// --- buyer side --------------------------------------------------------------
	f.buyerUserID, f.buyerProfID = uuid.New(), uuid.New()
	mustExec(`INSERT INTO users (id,email,password_hash,first_name,last_name,phone,status,account_type)
		VALUES ($1,$2,'hash','Buyer','Handover',$3,'ACTIVE','BUYER')`,
		f.buyerUserID, "buyer_"+suffix+"@example.com", "+243"+suffix)
	mustExec(`INSERT INTO buyer_profiles (id,user_id,first_name,last_name,email,phone,address,commune,city,country,status)
		VALUES ($1,$2,'Buyer','Handover',$3,'0990000000','Masina','Masina','Kinshasa','DRC','ACTIVE')`,
		f.buyerProfID, f.buyerUserID, "buyer_"+suffix+"@example.com")

	// --- courier -----------------------------------------------------------------
	f.courierID = uuid.New()
	mustExec(`INSERT INTO users (id,email,password_hash,first_name,last_name,phone,status,account_type)
		VALUES ($1,$2,'hash','Courier','Handover',$3,'ACTIVE','BUYER')`,
		f.courierID, "courier_"+suffix+"@example.com", "+244"+suffix)
	mustExec(`INSERT INTO couriers (id,user_id,status,availability,transport_type)
		VALUES ($1,$2,'ACTIVE','AVAILABLE','MOTO')`, uuid.New(), f.courierID)

	// --- order, priced at 100 USD, at the door with the package already scanned ---
	// This is the real state the handover steps start from: the courier arrived, scanned
	// the package QR (which is what moves the order to DELIVERED), and is now standing in
	// front of the buyer with the box unopened.
	f.orderID = uuid.New()
	f.orderNumber = "HO-" + suffix
	mustExec(`INSERT INTO orders (id,business_id,shop_id,buyer_profile_id,status,total_items,base_total,final_total,
		order_number,currency,delivery_method,delivery_status,assigned_courier_id,delivery_contact_name,delivery_phone,delivery_address)
		VALUES ($1,$2,$3,$4,'DELIVERED',1,100,100,$5,'USD','TBK_DELIVERY','DELIVERY_SCAN_SUCCESS',$6,'Buyer Handover','0990000000','Masina')`,
		f.orderID, f.businessID, f.shopID, f.buyerProfID, f.orderNumber, f.courierID)

	f.orderLineID = uuid.New()
	mustExec(`INSERT INTO order_lines (id,order_id,product_id,variant_id,quantity,unit_price,base_unit_price,final_unit_price,
		product_name,variant_name)
		VALUES ($1,$2,$3,$4,1,100,100,100,'Handover Product','Rouge / 42')`,
		f.orderLineID, f.orderID, f.productID, f.variantID)

	// The package QR, already picked up and scanned at the door: the handover steps
	// under test begin after the courier has arrived and scanned the package.
	mustExec(`INSERT INTO delivery_packages (order_id,shop_id,buyer_profile_id,operational,pickup_verified_at,delivery_scanned_at)
		VALUES ($1,$2,$3,TRUE,NOW(),NOW())`, f.orderID, f.shopID, f.buyerProfID)

	f.paymentID = uuid.New()
	status := "PENDING"
	var verifiedAt interface{}
	if paymentMethod == models.PaymentMethodMobilePayNow {
		// Pay-now is settled at checkout, before anyone leaves the shop.
		status, verifiedAt = "VERIFIED", time.Now()
	}
	mustExec(`INSERT INTO buyer_payments (id,order_id,business_id,shop_id,buyer_profile_id,payment_method,currency,
		products_final_total,cash_due,final_total,status,provider,payment_timing,verified_at)
		VALUES ($1,$2,$3,$4,$5,$6,'USD',100,100,100,$7,'TEST_PROVIDER',$8,$9)`,
		f.paymentID, f.orderID, f.businessID, f.shopID, f.buyerProfID, paymentMethod, status,
		timingFor(paymentMethod), verifiedAt)

	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM orders WHERE id=$1`, f.orderID)
		_, _ = db.Exec(`DELETE FROM products WHERE id IN ($1,$2,$3)`, f.productID, unorderedProductID, otherProductID)
		_, _ = db.Exec(`DELETE FROM buyer_profiles WHERE id=$1`, f.buyerProfID)
		_, _ = db.Exec(`DELETE FROM couriers WHERE user_id=$1`, f.courierID)
		_, _ = db.Exec(`DELETE FROM users WHERE id IN ($1,$2)`, f.buyerUserID, f.courierID)
		_, _ = db.Exec(`DELETE FROM shops WHERE id=$1`, f.shopID)
		_, _ = db.Exec(`DELETE FROM businesses WHERE id IN ($1,$2)`, f.businessID, otherBizID)
		db.Close()
	})

	f.wireServices(t)
	f.productToken = f.tokenForVariant(t, f.productID, f.variantID)
	f.productNumber = f.numberForVariant(t, f.productID, f.variantID)
	f.wrongVariantToken = f.tokenForVariant(t, f.productID, wrongVariantID)
	f.unorderedProductToken = f.tokenForVariant(t, unorderedProductID, unorderedVariantID)
	f.otherProductToken = f.tokenForVariant(t, otherProductID, otherVariantID)
	return f
}

// timingFor mirrors what checkout stores: pay-now settles before dispatch, the other two
// are collected at the door.
func timingFor(method string) string {
	if method == models.PaymentMethodMobilePayNow {
		return "NOW"
	}
	return "DELIVERY"
}

func (f *handoverFixture) wireServices(t *testing.T) {
	t.Helper()
	db := f.db
	paymentRepo := repository.NewBuyerPaymentRepository(db)
	orderRepo := repository.NewOrderRepository(db)
	shopRepo := repository.NewShopRepository(db)
	buyerProfileRepo := repository.NewBuyerProfileRepository(db)
	businessRepo := repository.NewBusinessRepository(db)

	f.pay = NewPaymentService(paymentRepo, repository.NewPaymentConfigRepository(db), orderRepo, shopRepo,
		repository.NewPointAccountRepository(db), repository.NewPointTransactionRepository(db),
		repository.NewLevelRepository(db), buyerProfileRepo, repository.NewPointConfigRepository(db),
		nil, nil, repository.NewVerifiedTransactionRepository(db), repository.NewSellerTrustRepository(db),
		repository.NewMembershipRepository(db), repository.NewEmployeeRepository(db),
		repository.NewAssignmentRepository(db), nil, db)
	f.pay.SetCommissionService(NewCommissionService(
		repository.NewCommissionRepository(db.DB), orderRepo, paymentRepo, businessRepo))
	f.pay.SetWebhookDependencies(repository.NewPaymentWebhookRepository(db), handoverTestSecret)

	f.qr = NewQRService(db, repository.NewMembershipRepository(db), repository.NewAssignmentRepository(db),
		repository.NewEmployeeRepository(db), nil)
	f.qr.SetOrderService(NewOrderService(orderRepo, repository.NewInventoryRepository(db),
		repository.NewStockMovementRepository(db), shopRepo, repository.NewProductRepository(db),
		repository.NewVariantRepository(db), repository.NewAssignmentRepository(db),
		repository.NewMembershipRepository(db), repository.NewEmployeeRepository(db),
		repository.NewCustomerRepository(db), repository.NewCashRepository(db), buyerProfileRepo,
		paymentRepo, nil, db))
	f.qr.SetHandoverDependencies(f.pay, paymentRepo)
}

func (f *handoverFixture) tokenForVariant(t *testing.T, productID, variantID uuid.UUID) string {
	t.Helper()
	var ref uuid.UUID
	if err := f.db.QueryRow(`SELECT public_reference FROM product_qr_codes WHERE product_id=$1 AND variant_id=$2`,
		productID, variantID).Scan(&ref); err != nil {
		t.Fatalf("no QR for variant: %v", err)
	}
	return f.qr.token("p", ref.String())
}

func (f *handoverFixture) numberForVariant(t *testing.T, productID, variantID uuid.UUID) string {
	t.Helper()
	var ref uuid.UUID
	if err := f.db.QueryRow(`SELECT public_reference FROM product_qr_codes WHERE product_id=$1 AND variant_id=$2`,
		productID, variantID).Scan(&ref); err != nil {
		t.Fatalf("no QR for variant: %v", err)
	}
	return "VAR-" + fmt.Sprintf("%.8s", ref.String())
}

func (f *handoverFixture) acknowledgeAllLines(t *testing.T) {
	t.Helper()
	if _, err := f.qr.AcknowledgeHandoverLines(f.buyerUserID, f.orderID, models.AcknowledgeHandoverRequest{
		Lines: []models.HandoverLineAcknowledgement{{
			OrderLineID: f.orderLineID, ProductReceived: true, MatchesOrder: true, QuantityCorrect: true,
		}},
	}); err != nil {
		t.Fatalf("buyer line acknowledgement failed: %v", err)
	}
}

func (f *handoverFixture) paymentStatus(t *testing.T) string {
	t.Helper()
	var status string
	if err := f.db.QueryRow(`SELECT status FROM buyer_payments WHERE id=$1`, f.paymentID).Scan(&status); err != nil {
		t.Fatalf("read payment status: %v", err)
	}
	return status
}

func (f *handoverFixture) orderStatus(t *testing.T) (string, string) {
	t.Helper()
	var status, delivery string
	if err := f.db.QueryRow(`SELECT status::text, COALESCE(delivery_status,'') FROM orders WHERE id=$1`, f.orderID).
		Scan(&status, &delivery); err != nil {
		t.Fatalf("read order status: %v", err)
	}
	return status, delivery
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// --- 1. Product verification -----------------------------------------------------

// The courier scanning the product QR on the package is the identity check the whole
// handover rests on. A correct scan is VALID and records exactly one verification.
func TestCourierProductScanVerifiesAgainstOrder(t *testing.T) {
	f := newHandoverFixture(t, models.PaymentMethodCashOnDelivery)

	result, err := f.qr.CourierVerifyProduct(f.courierID, f.orderID,
		models.ProductVerificationRequest{Token: f.productToken})
	if err != nil {
		t.Fatalf("valid courier scan rejected: %v", err)
	}
	if result.Result != models.HandoverResultValid {
		t.Fatalf("expected VALID, got %s (%s)", result.Result, result.Reason)
	}
	if result.OrderLineID == nil || *result.OrderLineID != f.orderLineID {
		t.Fatalf("scan resolved to the wrong order line: %+v", result.OrderLineID)
	}
	if result.Quantity != 1 || result.VariantName != "Rouge / 42" {
		t.Fatalf("scan returned the wrong line detail: qty=%d variant=%q", result.Quantity, result.VariantName)
	}
	if result.VerificationMethod != "QR_SCAN" {
		t.Fatalf("expected QR_SCAN, got %s", result.VerificationMethod)
	}
}

// Every way the physical product can fail to be the ordered product must stop the
// handover with its own reason, so the courier is told what is actually wrong.
func TestCourierProductScanRejectsMismatches(t *testing.T) {
	cases := []struct {
		name string
		req  models.ProductVerificationRequest
		want string
	}{
		{"another seller's product", models.ProductVerificationRequest{}, models.HandoverResultWrongShop},
		{"a product this order does not include", models.ProductVerificationRequest{}, models.HandoverResultWrongProduct},
		{"wrong variant of the right product", models.ProductVerificationRequest{}, models.HandoverResultWrongVariant},
		{"a token that is not a TBK QR", models.ProductVerificationRequest{Token: "tbk.p.not-a-uuid.sig"}, models.HandoverResultInvalidQR},
		{"a forged signature", models.ProductVerificationRequest{Token: "tbk.p." + uuid.NewString() + ".AAAA"}, models.HandoverResultInvalidQR},
		{"a made-up product number", models.ProductVerificationRequest{ProductNumber: "VAR-DEADBEEF"}, models.HandoverResultInvalidQR},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := newHandoverFixture(t, models.PaymentMethodCashOnDelivery)
			req := tc.req
			switch tc.want {
			case models.HandoverResultWrongShop:
				req.Token = f.otherProductToken
			case models.HandoverResultWrongProduct:
				req.Token = f.unorderedProductToken
			case models.HandoverResultWrongVariant:
				req.Token = f.wrongVariantToken
			}
			result, err := f.qr.CourierVerifyProduct(f.courierID, f.orderID, req)
			if err != nil {
				t.Fatalf("expected a verdict, got error: %v", err)
			}
			if result.Result != tc.want {
				t.Fatalf("expected %s, got %s (%s)", tc.want, result.Result, result.Reason)
			}
			// A rejected scan must leave the order unverified.
			verified, total, _ := f.qr.lineVerificationCounts(f.orderID)
			if verified != 0 || total != 1 {
				t.Fatalf("a rejected scan marked the order verified: %d/%d", verified, total)
			}
		})
	}
}

// A different seller's product is refused even before the product/order comparison, so
// the shop check is not merely implied by the order lines.
func TestCourierProductScanChecksSeller(t *testing.T) {
	f := newHandoverFixture(t, models.PaymentMethodCashOnDelivery)
	ident, err := f.qr.resolveProductIdentity(models.ProductVerificationRequest{Token: f.otherProductToken})
	if err != nil {
		t.Fatalf("fixture token did not resolve: %v", err)
	}
	if code, _ := f.qr.matchIdentityToOrder(f.orderID, ident); code != models.HandoverResultWrongShop {
		t.Fatalf("expected WRONG_SHOP for a foreign seller's product, got %s", code)
	}
}

// Typing the reference when the camera fails must run the same checks as scanning it.
func TestManualProductReferenceIsNotABypass(t *testing.T) {
	f := newHandoverFixture(t, models.PaymentMethodCashOnDelivery)

	result, err := f.qr.CourierVerifyProduct(f.courierID, f.orderID,
		models.ProductVerificationRequest{ProductNumber: f.productNumber})
	if err != nil {
		t.Fatalf("manual reference rejected: %v", err)
	}
	if result.Result != models.HandoverResultValid {
		t.Fatalf("expected VALID from the manual reference, got %s", result.Result)
	}
	if result.VerificationMethod != "MANUAL_PRODUCT_NUMBER" {
		t.Fatalf("manual entry recorded as %s", result.VerificationMethod)
	}

	// The same fallback with someone else's reference is still refused.
	f2 := newHandoverFixture(t, models.PaymentMethodCashOnDelivery)
	other, err := f2.qr.CourierVerifyProduct(f2.courierID, f2.orderID,
		models.ProductVerificationRequest{ProductNumber: f2.numberForVariantToken(t, f2.otherProductToken)})
	if err != nil {
		t.Fatalf("expected a verdict, got error: %v", err)
	}
	if other.Result == models.HandoverResultValid {
		t.Fatal("a manually typed foreign product reference was accepted")
	}
}

// numberForVariantToken recovers the printed reference from a token, so the manual-entry
// test can type in exactly what is printed under a QR it already has.
func (f *handoverFixture) numberForVariantToken(t *testing.T, token string) string {
	t.Helper()
	ref, err := f.qr.parse(token, "p")
	if err != nil {
		t.Fatalf("token did not parse: %v", err)
	}
	return "VAR-" + fmt.Sprintf("%.8s", ref.String())
}

// Only the courier the order was assigned to may verify it.
func TestWrongCourierCannotVerifyOrConfirm(t *testing.T) {
	f := newHandoverFixture(t, models.PaymentMethodCashOnDelivery)
	stranger := uuid.New()

	if _, err := f.qr.CourierVerifyProduct(stranger, f.orderID,
		models.ProductVerificationRequest{Token: f.productToken}); err != ErrQRWrongCourier {
		t.Fatalf("an unassigned courier verified the product: %v", err)
	}
	if _, err := f.qr.CourierConfirmCash(stranger, f.orderID,
		models.ConfirmCashRequest{Confirmed: true}); err != ErrQRWrongCourier {
		t.Fatalf("an unassigned courier confirmed cash: %v", err)
	}
	if _, err := f.qr.HandoverState(f.orderID, stranger, "COURIER"); err != ErrQRWrongCourier {
		t.Fatalf("an unassigned courier read the handover state: %v", err)
	}
}

// Re-scanning the same product reports the original verification instead of writing a
// second one: a duplicate scan has no duplicate effect.
func TestDuplicateProductScanIsIdempotent(t *testing.T) {
	f := newHandoverFixture(t, models.PaymentMethodCashOnDelivery)

	first, err := f.qr.CourierVerifyProduct(f.courierID, f.orderID,
		models.ProductVerificationRequest{Token: f.productToken})
	if err != nil || first.Result != models.HandoverResultValid {
		t.Fatalf("first scan should be VALID: %v %+v", err, first)
	}
	second, err := f.qr.CourierVerifyProduct(f.courierID, f.orderID,
		models.ProductVerificationRequest{Token: f.productToken})
	if err != nil {
		t.Fatalf("re-scan errored: %v", err)
	}
	if second.Result != models.HandoverResultAlreadyUsed {
		t.Fatalf("expected ALREADY_USED on re-scan, got %s", second.Result)
	}

	var successes int
	if err := f.db.QueryRow(
		`SELECT COUNT(*) FROM product_handover_verifications WHERE order_id=$1 AND result='SUCCESS'`,
		f.orderID).Scan(&successes); err != nil {
		t.Fatal(err)
	}
	if successes != 1 {
		t.Fatalf("re-scanning created %d verification rows, want 1", successes)
	}
}

// --- 2. Cash on delivery ---------------------------------------------------------

// The full cash flow: verify the goods, take the money, buyer acknowledges and confirms,
// and only then is the order RECEIVED. The commission stays DUE throughout.
func TestCashOnDeliveryHandoverEndToEnd(t *testing.T) {
	f := newHandoverFixture(t, models.PaymentMethodCashOnDelivery)

	// Cash cannot be confirmed before the goods have been checked.
	if _, err := f.qr.CourierConfirmCash(f.courierID, f.orderID,
		models.ConfirmCashRequest{Confirmed: true}); err != ErrProductNotVerified {
		t.Fatalf("cash was accepted before the product was verified: %v", err)
	}

	if _, err := f.qr.CourierVerifyProduct(f.courierID, f.orderID,
		models.ProductVerificationRequest{Token: f.productToken}); err != nil {
		t.Fatalf("product verification: %v", err)
	}

	// Receipt is still refused: the money is not in.
	f.acknowledgeAllLines(t)
	if err := f.qr.ConfirmReceipt(f.buyerUserID, f.orderID); err != ErrPaymentNotVerified {
		t.Fatalf("receipt was allowed before payment: %v", err)
	}

	cash, err := f.qr.CourierConfirmCash(f.courierID, f.orderID, models.ConfirmCashRequest{Confirmed: true})
	if err != nil {
		t.Fatalf("cash confirmation: %v", err)
	}
	if cash.PaymentStatus != string(models.BuyerPaymentStatusVerified) {
		t.Fatalf("cash confirmation left payment at %s", cash.PaymentStatus)
	}
	if f.paymentStatus(t) != "VERIFIED" {
		t.Fatalf("payment row not settled: %s", f.paymentStatus(t))
	}

	// 100 USD in the courier's hand settles the buyer. It does not settle TBK.
	if cash.CommissionCollected {
		t.Fatal("cash received from the buyer marked TBK commission COLLECTED")
	}
	if cash.CommissionStatus != "" && cash.CommissionStatus != string(models.CommissionStatusDue) {
		t.Fatalf("commission should stay DUE after a cash handover, got %s", cash.CommissionStatus)
	}

	if err := f.qr.ConfirmReceipt(f.buyerUserID, f.orderID); err != nil {
		t.Fatalf("buyer receipt confirmation: %v", err)
	}
	status, delivery := f.orderStatus(t)
	if status != string(models.OrderStatusReceived) && status != string(models.OrderStatusCompleted) {
		t.Fatalf("order did not reach RECEIVED, got %s", status)
	}
	if delivery != "RECEIVED" {
		t.Fatalf("delivery status is %s, want RECEIVED", delivery)
	}
}

// A retried cash confirmation must not settle the payment twice or re-book commission.
func TestCashConfirmationIsIdempotent(t *testing.T) {
	f := newHandoverFixture(t, models.PaymentMethodCashOnDelivery)
	if _, err := f.qr.CourierVerifyProduct(f.courierID, f.orderID,
		models.ProductVerificationRequest{Token: f.productToken}); err != nil {
		t.Fatal(err)
	}
	first, err := f.qr.CourierConfirmCash(f.courierID, f.orderID, models.ConfirmCashRequest{Confirmed: true})
	if err != nil || first.AlreadyConfirmed {
		t.Fatalf("first confirmation: %v %+v", err, first)
	}
	second, err := f.qr.CourierConfirmCash(f.courierID, f.orderID, models.ConfirmCashRequest{Confirmed: true})
	if err != nil {
		t.Fatalf("second confirmation errored: %v", err)
	}
	if !second.AlreadyConfirmed {
		t.Fatal("a repeated cash confirmation was applied again")
	}
	var commissions int
	if err := f.db.QueryRow(`SELECT COUNT(*) FROM sale_commissions WHERE order_id=$1`, f.orderID).Scan(&commissions); err != nil {
		t.Fatal(err)
	}
	if commissions > 1 {
		t.Fatalf("repeated confirmation booked %d commission rows", commissions)
	}
}

// --- 3. Mobile money at delivery -------------------------------------------------

// A courier must never be able to declare a mobile-money payment received; only the
// provider's signed webhook can, and the buyer cannot confirm receipt until it arrives.
func TestMobileAtDeliveryRequiresProviderConfirmation(t *testing.T) {
	f := newHandoverFixture(t, models.PaymentMethodMobileDelivery)
	if _, err := f.qr.CourierVerifyProduct(f.courierID, f.orderID,
		models.ProductVerificationRequest{Token: f.productToken}); err != nil {
		t.Fatal(err)
	}
	f.acknowledgeAllLines(t)

	if _, err := f.qr.CourierConfirmCash(f.courierID, f.orderID,
		models.ConfirmCashRequest{Confirmed: true}); err != ErrNotCashOnDelivery {
		t.Fatalf("a courier settled a mobile-money payment by hand: %v", err)
	}
	if err := f.qr.ConfirmReceipt(f.buyerUserID, f.orderID); err != ErrPaymentNotVerified {
		t.Fatalf("an unpaid mobile-money order was confirmed received: %v", err)
	}

	// The provider's signed callback is the only thing that settles it.
	body, _ := json.Marshal(models.ProviderPaymentEvent{
		EventID: uuid.NewString(), PaymentID: f.paymentID.String(), Reference: "MM-REF-1",
		Status: models.ProviderPaymentSucceeded, Amount: 100, Currency: "USD",
	})
	mac := hmac.New(sha256.New, []byte(handoverTestSecret))
	mac.Write(body)
	signature := hex.EncodeToString(mac.Sum(nil))

	if err := f.pay.HandleProviderWebhook("TEST_PROVIDER", body, "sha256="+signature); err != nil {
		t.Fatalf("signed provider webhook rejected: %v", err)
	}
	if f.paymentStatus(t) != "VERIFIED" {
		t.Fatalf("webhook did not settle the payment: %s", f.paymentStatus(t))
	}

	if err := f.qr.ConfirmReceipt(f.buyerUserID, f.orderID); err != nil {
		t.Fatalf("receipt after provider confirmation: %v", err)
	}
	if status, _ := f.orderStatus(t); status != string(models.OrderStatusReceived) && status != string(models.OrderStatusCompleted) {
		t.Fatalf("order did not reach RECEIVED, got %s", status)
	}
}

// An unsigned callback claiming success must change nothing.
func TestUnsignedPaymentCallbackCannotSettleDelivery(t *testing.T) {
	f := newHandoverFixture(t, models.PaymentMethodMobileDelivery)
	body, _ := json.Marshal(models.ProviderPaymentEvent{
		EventID: uuid.NewString(), PaymentID: f.paymentID.String(),
		Status: models.ProviderPaymentSucceeded, Amount: 100, Currency: "USD",
	})
	if err := f.pay.HandleProviderWebhook("TEST_PROVIDER", body, "sha256=deadbeef"); err == nil {
		t.Fatal("an unsigned webhook was accepted")
	}
	if f.paymentStatus(t) != "PENDING" {
		t.Fatalf("an unsigned webhook changed the payment to %s", f.paymentStatus(t))
	}
}

// --- 4. Mobile pay now -----------------------------------------------------------

// An order paid at checkout asks for no second payment: the door steps are product,
// QR and receipt only.
func TestMobilePayNowNeedsNoSecondPayment(t *testing.T) {
	f := newHandoverFixture(t, models.PaymentMethodMobilePayNow)

	state, err := f.qr.HandoverState(f.orderID, f.courierID, "COURIER")
	if err != nil {
		t.Fatalf("handover state: %v", err)
	}
	if !state.PaymentVerified {
		t.Fatal("a pay-now order should already be paid at the door")
	}
	if state.CourierCanConfirmCash {
		t.Fatal("the courier was offered a cash confirmation on a prepaid order")
	}

	if _, err := f.qr.CourierVerifyProduct(f.courierID, f.orderID,
		models.ProductVerificationRequest{Token: f.productToken}); err != nil {
		t.Fatal(err)
	}
	f.acknowledgeAllLines(t)
	if err := f.qr.ConfirmReceipt(f.buyerUserID, f.orderID); err != nil {
		t.Fatalf("receipt on a prepaid order: %v", err)
	}
	if status, _ := f.orderStatus(t); status != string(models.OrderStatusReceived) && status != string(models.OrderStatusCompleted) {
		t.Fatalf("order did not reach RECEIVED, got %s", status)
	}
}

// --- 5. Buyer confirmation -------------------------------------------------------

// The courier cannot stand in for the buyer. Without the buyer's own confirmation the
// order stays DELIVERED, whatever the courier has done.
func TestCourierAloneCannotCompleteDelivery(t *testing.T) {
	f := newHandoverFixture(t, models.PaymentMethodCashOnDelivery)
	if _, err := f.qr.CourierVerifyProduct(f.courierID, f.orderID,
		models.ProductVerificationRequest{Token: f.productToken}); err != nil {
		t.Fatal(err)
	}
	if _, err := f.qr.CourierConfirmCash(f.courierID, f.orderID, models.ConfirmCashRequest{Confirmed: true}); err != nil {
		t.Fatal(err)
	}
	// Everything the courier can do is done; the buyer has not spoken.
	status, _ := f.orderStatus(t)
	if status == string(models.OrderStatusReceived) || status == string(models.OrderStatusCompleted) {
		t.Fatalf("the courier alone advanced the order to %s", status)
	}
	// A courier cannot call the buyer endpoint either.
	if err := f.qr.ConfirmReceipt(f.courierID, f.orderID); err != ErrQRForbidden {
		t.Fatalf("a courier confirmed receipt on the buyer's behalf: %v", err)
	}
}

// Receipt is refused until the buyer has acknowledged every line of the order.
func TestReceiptRequiresPerLineAcknowledgement(t *testing.T) {
	f := newHandoverFixture(t, models.PaymentMethodMobilePayNow)
	if _, err := f.qr.CourierVerifyProduct(f.courierID, f.orderID,
		models.ProductVerificationRequest{Token: f.productToken}); err != nil {
		t.Fatal(err)
	}
	if err := f.qr.ConfirmReceipt(f.buyerUserID, f.orderID); err != ErrLinesNotAcknowledged {
		t.Fatalf("receipt was allowed with no line acknowledgement: %v", err)
	}
	// A line the buyer says is wrong does not count as acknowledged.
	if _, err := f.qr.AcknowledgeHandoverLines(f.buyerUserID, f.orderID, models.AcknowledgeHandoverRequest{
		Lines: []models.HandoverLineAcknowledgement{{
			OrderLineID: f.orderLineID, ProductReceived: true, MatchesOrder: true, QuantityCorrect: false,
		}},
	}); err != nil {
		t.Fatal(err)
	}
	if err := f.qr.ConfirmReceipt(f.buyerUserID, f.orderID); err != ErrLinesNotAcknowledged {
		t.Fatalf("a disputed quantity still allowed receipt: %v", err)
	}
}

// Confirming receipt twice must not transition the order twice.
func TestReceiptConfirmationIsIdempotent(t *testing.T) {
	f := newHandoverFixture(t, models.PaymentMethodMobilePayNow)
	if _, err := f.qr.CourierVerifyProduct(f.courierID, f.orderID,
		models.ProductVerificationRequest{Token: f.productToken}); err != nil {
		t.Fatal(err)
	}
	f.acknowledgeAllLines(t)
	if err := f.qr.ConfirmReceipt(f.buyerUserID, f.orderID); err != nil {
		t.Fatal(err)
	}
	if err := f.qr.ConfirmReceipt(f.buyerUserID, f.orderID); err != nil {
		t.Fatalf("a repeated receipt confirmation errored: %v", err)
	}
	var transitions int
	if err := f.db.QueryRow(
		`SELECT COUNT(*) FROM order_status_history WHERE order_id=$1 AND status='RECEIVED'`,
		f.orderID).Scan(&transitions); err != nil {
		t.Fatal(err)
	}
	if transitions != 1 {
		t.Fatalf("receipt recorded %d RECEIVED transitions, want 1", transitions)
	}
}

// --- 6. State and audit ----------------------------------------------------------

// The handover state both apps render must track the real steps, so neither side shows a
// button the server would refuse.
func TestHandoverStateTracksProgress(t *testing.T) {
	f := newHandoverFixture(t, models.PaymentMethodCashOnDelivery)

	state, err := f.qr.HandoverState(f.orderID, f.buyerUserID, "BUYER")
	if err != nil {
		t.Fatalf("buyer handover state: %v", err)
	}
	if state.Stage != models.HandoverStageArrived || !state.CourierArrived {
		t.Fatalf("expected the arrived stage, got %s", state.Stage)
	}
	if state.BuyerCanConfirmReceipt || state.BlockedReason != "PRODUCT_NOT_VERIFIED" {
		t.Fatalf("receipt should be blocked on verification, got %q", state.BlockedReason)
	}
	if len(state.Lines) != 1 || state.Lines[0].ProductVerified {
		t.Fatalf("unexpected lines: %+v", state.Lines)
	}

	if _, err = f.qr.CourierVerifyProduct(f.courierID, f.orderID,
		models.ProductVerificationRequest{Token: f.productToken}); err != nil {
		t.Fatal(err)
	}
	if state, err = f.qr.HandoverState(f.orderID, f.courierID, "COURIER"); err != nil {
		t.Fatal(err)
	}
	if !state.AllProductsVerified || !state.CourierCanConfirmCash {
		t.Fatalf("after verification the courier should be able to take cash: %+v", state)
	}
	if state.Stage != models.HandoverStagePaymentPending {
		t.Fatalf("expected AWAITING_PAYMENT, got %s", state.Stage)
	}

	f.acknowledgeAllLines(t)
	if _, err = f.qr.CourierConfirmCash(f.courierID, f.orderID, models.ConfirmCashRequest{Confirmed: true}); err != nil {
		t.Fatal(err)
	}
	if state, err = f.qr.HandoverState(f.orderID, f.buyerUserID, "BUYER"); err != nil {
		t.Fatal(err)
	}
	if !state.BuyerCanConfirmReceipt || state.BlockedReason != "" {
		t.Fatalf("the buyer should now be able to confirm: %+v", state)
	}
}

// Every handover step leaves an audit row naming the actor, their role and the order.
func TestHandoverIsAudited(t *testing.T) {
	f := newHandoverFixture(t, models.PaymentMethodCashOnDelivery)

	// One rejection and one success, so both outcomes are checked.
	if _, err := f.qr.CourierVerifyProduct(f.courierID, f.orderID,
		models.ProductVerificationRequest{Token: f.otherProductToken}); err != nil {
		t.Fatal(err)
	}
	if _, err := f.qr.CourierVerifyProduct(f.courierID, f.orderID,
		models.ProductVerificationRequest{Token: f.productToken}); err != nil {
		t.Fatal(err)
	}
	f.acknowledgeAllLines(t)
	if _, err := f.qr.CourierConfirmCash(f.courierID, f.orderID, models.ConfirmCashRequest{Confirmed: true}); err != nil {
		t.Fatal(err)
	}
	if err := f.qr.ConfirmReceipt(f.buyerUserID, f.orderID); err != nil {
		t.Fatal(err)
	}

	events, err := f.qr.HandoverTimeline(f.orderID)
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]string{}
	for _, e := range events {
		if e.ActorUserID == nil {
			t.Errorf("audit row %s has no actor", e.Action)
			continue
		}
		if e.CreatedAt.IsZero() {
			t.Errorf("audit row %s has no timestamp", e.Action)
		}
		if e.OrderID != f.orderID {
			t.Errorf("audit row %s is on the wrong order", e.Action)
		}
		seen[e.Action] = e.ActorRole
	}
	for action, wantRole := range map[string]string{
		"HANDOVER_PRODUCT_VERIFY_REJECTED": "COURIER",
		"HANDOVER_PRODUCT_VERIFIED":        "COURIER",
		"HANDOVER_LINES_ACKNOWLEDGED":      "BUYER",
		"HANDOVER_CASH_RECEIVED":           "COURIER",
		"HANDOVER_RECEIPT_CONFIRMED":       "BUYER",
	} {
		role, ok := seen[action]
		if !ok {
			t.Errorf("no audit row for %s", action)
			continue
		}
		if role != wantRole {
			t.Errorf("%s audited with role %s, want %s", action, role, wantRole)
		}
	}

	// Rejected product scans are kept too: a failed check is exactly what an
	// investigation needs to see.
	var rejected int
	if err := f.db.QueryRow(
		`SELECT COUNT(*) FROM product_handover_verifications WHERE order_id=$1 AND result='REJECTED'`,
		f.orderID).Scan(&rejected); err != nil {
		t.Fatal(err)
	}
	if rejected == 0 {
		t.Fatal("the rejected scan was not retained")
	}
}
