package service_test

// Permanent shop deletion against the real schema: permissions, the typed
// confirmation, all-or-nothing behaviour, order-history tombstones, shared
// products and image files.
//
// Needs a disposable database whose name ends in "_test":
//
//	PURGE_TEST_DSN="host=127.0.0.1 port=5433 user=btmi_user password=... dbname=btmi_search_test sslmode=disable" \
//	  go test ./internal/service -run ShopPurge -v

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/google/uuid"
)

type purgeFixture struct {
	db                         *database.DB
	svc                        *service.ShopPurgeService
	uploadDir                  string
	owner, stranger            uuid.UUID
	business                   uuid.UUID
	shopA, shopB, shopC        uuid.UUID // A, B archived; C active
	productA, productB, shared uuid.UUID
	historyOrder, openOrder    uuid.UUID
	imageURL                   string
}

func purgeEnv(t *testing.T) *purgeFixture {
	t.Helper()
	dsn := os.Getenv("PURGE_TEST_DSN")
	if dsn == "" {
		t.Skip("PURGE_TEST_DSN not set; skipping PostgreSQL shop purge tests")
	}
	raw, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	var name string
	if err := raw.QueryRow(`SELECT current_database()`).Scan(&name); err != nil || !strings.HasSuffix(name, "_test") {
		t.Fatalf("PURGE_TEST_DSN must target a database ending in _test (got %q, %v)", name, err)
	}
	db := &database.DB{DB: raw}
	t.Cleanup(func() { raw.Close() })
	if err := db.RunMigrations("../../migrations"); err != nil {
		t.Fatalf("migrations: %v", err)
	}

	f := &purgeFixture{db: db, uploadDir: t.TempDir()}
	f.svc = service.NewShopPurgeService(db, repository.NewAuditRepository(db), nil, f.uploadDir)
	exec := func(q string, args ...interface{}) {
		t.Helper()
		if _, err := db.Exec(q, args...); err != nil {
			t.Fatalf("%v\n%s", err, q)
		}
	}
	newUser := func(label string) uuid.UUID {
		id := uuid.New()
		exec(`INSERT INTO users (id, email, first_name, last_name, password_hash, phone) VALUES ($1, $2, 'Purge', $3, 'x', $4)`,
			id, fmt.Sprintf("purge-%s-%s@test.invalid", label, id.String()[:8]), label, "+243"+id.String()[:8])
		t.Cleanup(func() { _, _ = db.Exec(`DELETE FROM users WHERE id = $1`, id) })
		return id
	}
	f.owner, f.stranger = newUser("owner"), newUser("stranger")

	f.business = uuid.New()
	exec(`INSERT INTO businesses (id, name, business_type, category, phone, email, country, city, default_currency, status)
		VALUES ($1, 'Purge Biz', 'RETAIL', 'GENERAL', '0', 'purge@test.invalid', 'DRC', 'Kinshasa', 'USD', 'ACTIVE')`, f.business)
	t.Cleanup(func() { _, _ = db.Exec(`DELETE FROM businesses WHERE id = $1`, f.business) })
	exec(`INSERT INTO business_memberships (user_id, business_id, role, status) VALUES ($1, $2, 'OWNER', 'ACTIVE')`, f.owner, f.business)

	shop := func(name, status string) uuid.UUID {
		id := uuid.New()
		exec(`INSERT INTO shops (id, business_id, name, type, city, address, phone, status)
			VALUES ($1, $2, $3, 'PHYSICAL', 'Kinshasa', 'Gombe', '0999', $4)`, id, f.business, name, status)
		return id
	}
	f.shopA, f.shopB, f.shopC = shop("Archive A", "INACTIVE"), shop("Archive B", "INACTIVE"), shop("Active C", "ACTIVE")

	variants := map[uuid.UUID]uuid.UUID{}
	product := func(name string, shops ...uuid.UUID) uuid.UUID {
		id, variant := uuid.New(), uuid.New()
		exec(`INSERT INTO products (id, business_id, name, unit_price) VALUES ($1, $2, $3, 10)`, id, f.business, name)
		exec(`INSERT INTO product_variants (id, product_id, name, sale_price) VALUES ($1, $2, 'Default', 10)`, variant, id)
		for _, s := range shops {
			exec(`INSERT INTO inventory (business_id, shop_id, product_id, variant_id, quantity) VALUES ($1, $2, $3, $4, 5)`, f.business, s, id, variant)
		}
		variants[id] = variant
		return id
	}
	f.productA = product("Only in A", f.shopA)
	f.productB = product("Only in B", f.shopB)
	f.shared = product("Shared A and C", f.shopA, f.shopC)

	// One image for product A, on disk and shown by a past order line.
	f.imageURL = "/uploads/products/" + f.productA.String() + "/photo.jpg"
	file := filepath.Join(f.uploadDir, "products", f.productA.String(), "photo.jpg")
	if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(file, []byte("jpeg"), 0o644); err != nil {
		t.Fatal(err)
	}
	exec(`INSERT INTO product_images (business_id, product_id, url, is_primary) VALUES ($1, $2, $3, true)`, f.business, f.productA, f.imageURL)

	f.historyOrder, f.openOrder = uuid.New(), uuid.New()
	exec(`INSERT INTO orders (id, business_id, shop_id, status) VALUES ($1, $2, $3, 'COMPLETED')`, f.historyOrder, f.business, f.shopA)
	exec(`INSERT INTO order_lines (order_id, product_id, variant_id, quantity, unit_price, product_name, image_url)
		VALUES ($1, $2, $3, 1, 10, 'Only in A', $4)`, f.historyOrder, f.productA, variants[f.productA], f.imageURL)
	exec(`INSERT INTO orders (id, business_id, shop_id, status) VALUES ($1, $2, $3, 'PENDING')`, f.openOrder, f.business, f.shopB)
	return f
}

func (f *purgeFixture) count(t *testing.T, q string, args ...interface{}) int {
	t.Helper()
	var n int
	if err := f.db.QueryRow(q, args...).Scan(&n); err != nil {
		t.Fatalf("%v\n%s", err, q)
	}
	return n
}

func expectErr(t *testing.T, err error, code string) {
	t.Helper()
	if err == nil || err.Error() != code {
		t.Fatalf("expected %s, got %v", code, err)
	}
}

func TestShopPurgeRealDB(t *testing.T) {
	f := purgeEnv(t)
	owner := service.ShopPurgeActor{UserID: &f.owner}
	stranger := service.ShopPurgeActor{UserID: &f.stranger}
	adminID := uuid.New()
	admin := service.ShopPurgeActor{AdminID: &adminID, AdminRole: models.AdminRoleCommerceAdmin}
	both := []uuid.UUID{f.shopA, f.shopB}

	_, err := f.svc.Purge(&models.ShopPurgeRequest{ShopIDs: []uuid.UUID{f.shopB}, Confirmation: "supprimer"}, owner)
	expectErr(t, err, "CONFIRMATION_REQUIRED")
	_, err = f.svc.Purge(&models.ShopPurgeRequest{ShopIDs: []uuid.UUID{f.shopB}, Confirmation: "SUPPRIMER"}, stranger)
	expectErr(t, err, "FORBIDDEN")
	_, err = f.svc.Purge(&models.ShopPurgeRequest{ShopIDs: []uuid.UUID{f.shopC}, Confirmation: "SUPPRIMER"}, owner)
	expectErr(t, err, "SHOP_NOT_ARCHIVED")

	// Preview: the shared product survives in shop C, so only 2 products go.
	preview, err := f.svc.Preview(both, admin)
	if err != nil {
		t.Fatal(err)
	}
	if preview.ShopCount != 2 || preview.ProductCount != 2 || preview.ImageCount != 1 || len(preview.BlockedShops) != 1 {
		t.Fatalf("unexpected preview: %+v", preview)
	}

	// An order in progress in B blocks the whole batch; nothing is touched.
	_, err = f.svc.Purge(&models.ShopPurgeRequest{ShopIDs: both, Confirmation: "SUPPRIMER"}, admin)
	expectErr(t, err, "SHOP_HAS_OPEN_ORDERS")
	if n := f.count(t, `SELECT COUNT(*) FROM products WHERE id = ANY($1::uuid[])`, fmt.Sprintf("{%s,%s}", f.productA, f.productB)); n != 2 {
		t.Fatalf("partial deletion after refusal: %d products left", n)
	}

	if _, err := f.db.Exec(`UPDATE orders SET status = 'CANCELLED' WHERE id = $1`, f.openOrder); err != nil {
		t.Fatal(err)
	}
	result, err := f.svc.Purge(&models.ShopPurgeRequest{ShopIDs: both, Confirmation: "SUPPRIMER", Reason: "test"}, admin)
	if err != nil {
		t.Fatalf("purge: %v", err)
	}
	if result.DeletedShops != 2 || result.DeletedProducts != 2 || result.DeletedImages != 1 || result.HistoryKeptShops != 2 {
		t.Fatalf("unexpected result: %+v", result)
	}

	// Both shops had orders: tombstones, wiped of stock and contact data.
	if n := f.count(t, `SELECT COUNT(*) FROM shops WHERE id = ANY($1::uuid[]) AND status = 'DELETED' AND phone = ''`, fmt.Sprintf("{%s,%s}", f.shopA, f.shopB)); n != 2 {
		t.Fatalf("expected 2 tombstones, got %d", n)
	}
	if n := f.count(t, `SELECT COUNT(*) FROM inventory WHERE shop_id = ANY($1::uuid[])`, fmt.Sprintf("{%s,%s}", f.shopA, f.shopB)); n != 0 {
		t.Fatalf("stock left in deleted shops: %d", n)
	}
	if n := f.count(t, `SELECT COUNT(*) FROM products WHERE id = ANY($1::uuid[])`, fmt.Sprintf("{%s,%s}", f.productA, f.productB)); n != 0 {
		t.Fatalf("exclusive products survived: %d", n)
	}
	if n := f.count(t, `SELECT COUNT(*) FROM inventory WHERE product_id = $1 AND shop_id = $2`, f.shared, f.shopC); n != 1 {
		t.Fatal("shared product lost its stock in the surviving shop")
	}

	// Order history intact, image moved out of the product directory.
	var productID sql.NullString
	var image string
	if err := f.db.QueryRow(`SELECT product_id::text, image_url FROM order_lines WHERE order_id = $1`, f.historyOrder).Scan(&productID, &image); err != nil {
		t.Fatalf("order line lost: %v", err)
	}
	if productID.Valid || !strings.HasPrefix(image, "/uploads/order-history/") {
		t.Fatalf("order line not detached: product=%v image=%s", productID, image)
	}
	if _, err := os.Stat(filepath.Join(f.uploadDir, filepath.FromSlash(strings.TrimPrefix(image, "/uploads/")))); err != nil {
		t.Fatalf("order history image missing: %v", err)
	}
	if _, err := os.Stat(filepath.Join(f.uploadDir, "products", f.productA.String())); !os.IsNotExist(err) {
		t.Fatalf("product upload directory still present: %v", err)
	}

	// A tombstone can be neither listed, purged again nor reactivated.
	_, err = f.svc.Preview([]uuid.UUID{f.shopA}, admin)
	expectErr(t, err, "SHOP_NOT_FOUND")
	if n := f.count(t, `SELECT COUNT(*) FROM shops WHERE business_id = $1 AND status <> 'DELETED'`, f.business); n != 1 {
		t.Fatalf("expected only shop C listed, got %d", n)
	}
}

func TestShopPurgeHardDeletesEmptyShop(t *testing.T) {
	f := purgeEnv(t)
	owner := service.ShopPurgeActor{UserID: &f.owner}
	// Shop B's only order is removed: no history, so the row itself goes.
	if _, err := f.db.Exec(`DELETE FROM orders WHERE id = $1`, f.openOrder); err != nil {
		t.Fatal(err)
	}
	result, err := f.svc.Purge(&models.ShopPurgeRequest{ShopIDs: []uuid.UUID{f.shopB}, Confirmation: " SUPPRIMER "}, owner)
	if err != nil {
		t.Fatalf("purge: %v", err)
	}
	if result.HistoryKeptShops != 0 || result.DeletedProducts != 1 {
		t.Fatalf("unexpected result: %+v", result)
	}
	if n := f.count(t, `SELECT COUNT(*) FROM shops WHERE id = $1`, f.shopB); n != 0 {
		t.Fatal("empty shop row should be gone")
	}
}
