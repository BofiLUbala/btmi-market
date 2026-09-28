package service_test

// Integration tests for the marketplace search against a real PostgreSQL.
//
// They need a dedicated, disposable database whose name ends in "_test"; the
// fixture TRUNCATEs catalog tables. Example:
//
//	docker exec backend-postgres-1 createdb -U btmi_user btmi_search_test
//	SEARCH_TEST_DSN="host=127.0.0.1 port=5433 user=btmi_user password=... dbname=btmi_search_test sslmode=disable" \
//	  go test ./internal/service -run Search -v
//
// Without SEARCH_TEST_DSN they are skipped.

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	redislib "github.com/btmi-ai-market/backend/internal/redis"
	"github.com/btmi-ai-market/backend/internal/repository"
	searchutil "github.com/btmi-ai-market/backend/internal/search"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

type searchFixture struct {
	db   *database.DB
	svc  *service.MarketplaceService
	repo *repository.MarketplaceRepository
	ids  map[string]uuid.UUID
}

var (
	fixtureOnce sync.Once
	fixture     *searchFixture
	fixtureErr  error
)

func searchEnv(t *testing.T) *searchFixture {
	t.Helper()
	dsn := os.Getenv("SEARCH_TEST_DSN")
	if dsn == "" {
		t.Skip("SEARCH_TEST_DSN not set; skipping PostgreSQL search integration tests")
	}
	fixtureOnce.Do(func() { fixture, fixtureErr = buildSearchFixture(dsn) })
	if fixtureErr != nil {
		t.Fatalf("search fixture: %v", fixtureErr)
	}
	return fixture
}

func buildSearchFixture(dsn string) (*searchFixture, error) {
	raw, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	if err := raw.Ping(); err != nil {
		return nil, err
	}
	db := &database.DB{DB: raw, DSN: dsn}
	var name string
	if err := db.QueryRow(`SELECT current_database()`).Scan(&name); err != nil {
		return nil, err
	}
	if !strings.HasSuffix(name, "_test") {
		return nil, errors.New("refusing to run: database name must end in _test, got " + name)
	}
	if err := db.RunMigrations("../../migrations"); err != nil {
		return nil, err
	}
	f := &searchFixture{db: db, ids: map[string]uuid.UUID{}}
	if err := f.seed(); err != nil {
		return nil, err
	}
	f.repo = repository.NewMarketplaceRepository(db, nil)
	f.svc = service.NewMarketplaceService(f.repo, nil)
	return f, nil
}

func (f *searchFixture) exec(q string, args ...interface{}) error {
	_, err := f.db.Exec(q, args...)
	if err != nil {
		return errors.New(err.Error() + " in: " + q)
	}
	return nil
}

func (f *searchFixture) id(key string) uuid.UUID {
	if id, ok := f.ids[key]; ok {
		return id
	}
	id := uuid.New()
	f.ids[key] = id
	return id
}

type variantSpec struct {
	sku   string
	attrs string
	price float64
	stock map[string]int // shop key -> quantity
}

func (f *searchFixture) product(key, biz, name, sku, desc, sub, publication, status string, variants ...variantSpec) error {
	var cat, subID interface{}
	if sub != "" {
		subID = f.id("sub:" + sub)
		cat = f.id("cat-of:" + sub)
	}
	if err := f.exec(`INSERT INTO products (id, business_id, name, sku, description, unit_price, currency,
		publication_status, status, category_id, subcategory_id) VALUES ($1,$2,$3,$4,$5,$6,'USD',$7,$8,$9,$10)`,
		f.id(key), f.id(biz), name, sku, desc, 10, publication, status, cat, subID); err != nil {
		return err
	}
	for i, v := range variants {
		vid := f.id(key + ":v" + string(rune('0'+i)))
		attrs := v.attrs
		if attrs == "" {
			attrs = "{}"
		}
		if err := f.exec(`INSERT INTO product_variants (id, product_id, sku, name, attributes, sale_price, status)
			VALUES ($1,$2,$3,$4,$5::jsonb,$6,'ACTIVE')`, vid, f.id(key), v.sku, "", attrs, v.price); err != nil {
			return err
		}
		for shop, qty := range v.stock {
			if err := f.exec(`INSERT INTO inventory (business_id, shop_id, product_id, variant_id, quantity, reserved_quantity)
				VALUES ($1,$2,$3,$4,$5,0)`, f.id(biz), f.id(shop), f.id(key), vid, qty); err != nil {
				return err
			}
		}
	}
	return nil
}

func (f *searchFixture) seed() error {
	if err := f.exec(`TRUNCATE businesses, categories, search_query_log, point_accounts, seller_trust CASCADE`); err != nil {
		return err
	}
	for _, c := range []struct{ cat, catName, sub, subName string }{
		{"electronics", "Electronics", "phones", "Phones"},
		{"electronics", "Electronics", "computers", "Computers"},
		{"electronics", "Electronics", "tvs", "TVs"},
		{"fashion", "Fashion", "shoes", "Shoes"},
		{"fashion", "Fashion", "accessories", "Accessories"},
		{"home", "Home", "kitchen", "Kitchen"},
	} {
		if err := f.exec(`INSERT INTO categories (id, name, slug) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`,
			f.id("cat:"+c.cat), c.catName, c.cat); err != nil {
			return err
		}
		f.ids["cat-of:"+c.sub] = f.id("cat:" + c.cat)
		if err := f.exec(`INSERT INTO subcategories (id, category_id, name, slug) VALUES ($1,$2,$3,$4)`,
			f.id("sub:"+c.sub), f.id("cat:"+c.cat), c.subName, c.sub); err != nil {
			return err
		}
	}
	for _, b := range []struct{ key, name, status string }{
		{"rich", "Kin Tech SARL", "ACTIVE"}, {"mama", "Mama Commerce", "ACTIVE"}, {"ghost", "Ghost Holding", "SUSPENDED"},
	} {
		if err := f.exec(`INSERT INTO businesses (id, name, category, phone, email, country, city, status)
			VALUES ($1,$2,'retail','+243000','x@example.test','CD','Kinshasa',$3)`, f.id(b.key), b.name, b.status); err != nil {
			return err
		}
	}
	// The "rich" seller has every commercial advantage: top level, trusted,
	// perfect reviews, images. It must still lose to better text matches.
	if err := f.exec(`INSERT INTO point_accounts (owner_type, owner_id, current_points, level_id)
		SELECT 'SELLER_BUSINESS', $1, 999999, id FROM seller_levels WHERE name = 'PREMIUM'`, f.id("rich")); err != nil {
		return err
	}
	if err := f.exec(`INSERT INTO seller_trust (business_id, trust_status) VALUES ($1, 'TRUSTED')`, f.id("rich")); err != nil {
		return err
	}
	for _, s := range []struct{ key, biz, name, city, status string }{
		{"richKin", "rich", "Kin Tech Gombe", "Kinshasa", "ACTIVE"},
		{"richLshi", "rich", "Kin Tech Lubumbashi", "Lubumbashi", "ACTIVE"},
		{"mama", "mama", "Chez Mama Chaussures", "Lubumbashi", "ACTIVE"},
		{"mamaClosed", "mama", "Mama Fermé", "Kinshasa", "INACTIVE"},
		{"ghost", "ghost", "Ghost Store", "Kinshasa", "ACTIVE"},
	} {
		if err := f.exec(`INSERT INTO shops (id, business_id, name, city, status) VALUES ($1,$2,$3,$4,$5)`,
			f.id(s.key), f.id(s.biz), s.name, s.city, s.status); err != nil {
			return err
		}
	}

	pub, act := "PUBLISHED", "ACTIVE"
	type p = variantSpec
	stock := func(shop string, qty int) map[string]int { return map[string]int{shop: qty} }
	steps := []error{
		f.product("a15", "mama", "Samsung Galaxy A15", "SGA15", "Smartphone Android 6.5 pouces, double SIM, grande batterie longue durée.", "phones", pub, act,
			p{sku: "SGA15-BLK-128", attrs: `{"Color":"Noir","Storage":"128GB"}`, price: 150, stock: stock("mama", 5)}),
		f.product("case", "rich", "Coque de protection pour Samsung Galaxy A15 premium", "CASE-A15", "Coque antichoc en silicone souple, bords relevés, compatible recharge sans fil.", "phones", pub, act,
			p{sku: "CASE-A15-1", price: 10, stock: stock("richKin", 50)}),
		f.product("a25", "mama", "Samsung Galaxy A25", "SGA25", "", "phones", pub, act, p{sku: "SGA25-1", price: 200, stock: stock("mama", 0)}),
		f.product("a35", "mama", "Samsung Galaxy A35", "SGA35", "", "phones", pub, act, p{sku: "SGA35-1", price: 250, stock: stock("mama", 10)}),
		f.product("tecno", "rich", "Téléphone portable Tecno Spark 20", "TECNO20", "", "phones", pub, act,
			p{sku: "TECNO20-1", price: 120, stock: map[string]int{"richKin": 3, "richLshi": 7}}),
		f.product("shoe", "mama", "Chaussure de sport", "SHOE1", "", "shoes", pub, act,
			p{sku: "SHOE1-42", attrs: `{"Color":"Rouge","Shoe Size":"42"}`, price: 30, stock: stock("mama", 4)}),
		f.product("fridge", "mama", "Réfrigérateur LG 300L", "LG300", "", "kitchen", pub, act, p{sku: "LG300-1", price: 500, stock: stock("mama", 2)}),
		f.product("laptop", "rich", "HP ProBook 450", "HP450", "Machine professionnelle 15 pouces", "computers", pub, act, p{sku: "HP450-1", price: 700, stock: stock("richKin", 2)}),
		f.product("tv", "rich", "Smart TV Samsung 43 pouces", "TV43", "", "tvs", pub, act, p{sku: "TV43-1", price: 400, stock: stock("richKin", 2)}),
		f.product("mixer", "mama", "Mixeur Moulinex", "MIX1", "Idéal pour vos smoothies du matin", "kitchen", pub, act, p{sku: "MIX1-1", price: 40, stock: stock("mama", 2)}),
		f.product("loreal", "mama", "Crème L'Oréal 50% bio", "LOR50", "", "", pub, act, p{sku: "LOR50-1", price: 12, stock: stock("mama", 2)}),
		// Must never appear:
		f.product("draft", "mama", "Samsung Galaxy Draft", "DRAFT1", "", "phones", "DRAFT", act, p{sku: "DRAFT1-1", price: 1, stock: stock("mama", 5)}),
		f.product("inactive", "mama", "Samsung Galaxy Inactive", "INACT1", "", "phones", pub, "INACTIVE", p{sku: "INACT1-1", price: 1, stock: stock("mama", 5)}),
		f.product("ghostp", "ghost", "Samsung Galaxy Ghost", "GHOST1", "", "phones", pub, act, p{sku: "GHOST1-1", price: 1, stock: stock("ghost", 5)}),
		f.product("closed", "mama", "Samsung Galaxy Closed", "CLOSED1", "", "phones", pub, act, p{sku: "CLOSED1-1", price: 1, stock: stock("mamaClosed", 5)}),
		f.product("noinv", "mama", "Samsung Galaxy Sans Inventaire", "NOINV1", "", "phones", pub, act, p{sku: "NOINV1-1", price: 1}),
	}
	for i := 0; i < 25; i++ {
		steps = append(steps, f.product("bracelet"+string(rune('a'+i)), "mama", "Bracelet perle", "BR"+string(rune('a'+i)), "", "accessories", pub, act,
			p{sku: "BR-" + string(rune('a'+i)), price: 5, stock: stock("mama", 1)}))
	}
	for _, err := range steps {
		if err != nil {
			return err
		}
	}
	// The accessory has glowing reviews and an image; the phone has neither.
	if err := f.exec(`INSERT INTO product_review_aggregates (product_id, average_rating, total_reviews) VALUES ($1, 5.0, 500)`, f.id("case")); err != nil {
		return err
	}
	return f.exec(`INSERT INTO product_images (business_id, product_id, url, is_primary) VALUES ($1,$2,'/x.jpg',TRUE)`, f.id("rich"), f.id("case"))
}

func (f *searchFixture) search(t *testing.T, params models.MarketplaceSearchParams) *models.MarketplaceSearchResult {
	t.Helper()
	res, err := f.svc.SearchProducts(context.Background(), &params)
	if err != nil {
		t.Fatalf("search %q: %v", params.Query, err)
	}
	return res
}

func (f *searchFixture) q(t *testing.T, query string) *models.MarketplaceSearchResult {
	t.Helper()
	return f.search(t, models.MarketplaceSearchParams{Query: query, Limit: 50})
}

func (f *searchFixture) position(res *models.MarketplaceSearchResult, key string) int {
	for i, p := range res.Products {
		if p.ID == f.ids[key] {
			return i
		}
	}
	return -1
}

func names(res *models.MarketplaceSearchResult) []string {
	out := make([]string, 0, len(res.Products))
	for _, p := range res.Products {
		out = append(out, p.Name+" ["+p.SearchRank.Tier+"]")
	}
	return out
}

func (f *searchFixture) requireFirst(t *testing.T, res *models.MarketplaceSearchResult, key string) {
	t.Helper()
	if len(res.Products) == 0 || res.Products[0].ID != f.ids[key] {
		t.Fatalf("expected %s first, got %v", key, names(res))
	}
}

func (f *searchFixture) requireFound(t *testing.T, res *models.MarketplaceSearchResult, keys ...string) {
	t.Helper()
	for _, k := range keys {
		if f.position(res, k) < 0 {
			t.Fatalf("expected %s in results, got %v", k, names(res))
		}
	}
}

func (f *searchFixture) requireAbsent(t *testing.T, res *models.MarketplaceSearchResult, keys ...string) {
	t.Helper()
	for _, k := range keys {
		if f.position(res, k) >= 0 {
			t.Fatalf("%s must not be in results: %v", k, names(res))
		}
	}
}

func TestSearchExactMatch(t *testing.T) {
	f := searchEnv(t)
	res := f.q(t, "Samsung Galaxy A15")
	f.requireFirst(t, res, "a15")
	if res.Products[0].SearchRank.Tier != "exact_name" {
		t.Errorf("tier = %s", res.Products[0].SearchRank.Tier)
	}
	if f.position(res, "a15") > f.position(res, "case") {
		t.Errorf("exact product must precede the vaguely similar one: %v", names(res))
	}
}

func TestSearchAccentsAndCase(t *testing.T) {
	f := searchEnv(t)
	for _, q := range []string{"Téléphone", "telephone", "TELEPHONE", "téléphone portable"} {
		f.requireFirst(t, f.q(t, q), "tecno")
	}
	f.requireFirst(t, f.q(t, "refrigerateur"), "fridge")
}

func TestSearchMultipleSpacesAndPartialName(t *testing.T) {
	f := searchEnv(t)
	f.requireFirst(t, f.q(t, "SAMSUNG   A15"), "a15")
	res := f.q(t, "galax")
	f.requireFound(t, res, "a15", "a25", "a35")
}

func TestSearchRichSellerCannotBeatBetterMatch(t *testing.T) {
	f := searchEnv(t)
	res := f.q(t, "samsung a15")
	if f.position(res, "a15") < 0 || f.position(res, "a15") > f.position(res, "case") {
		t.Fatalf("premium seller's accessory outranked the phone: %v", names(res))
	}
	caseRank := res.Products[f.position(res, "case")].SearchRank
	phoneRank := res.Products[f.position(res, "a15")].SearchRank
	if caseRank.Bonus <= phoneRank.Bonus {
		t.Fatalf("fixture should give the accessory the larger bonus (case %.1f, phone %.1f)", caseRank.Bonus, phoneRank.Bonus)
	}
}

func TestSearchPluralAndTypo(t *testing.T) {
	f := searchEnv(t)
	res := f.q(t, "chaussures")
	f.requireFirst(t, res, "shoe")
	if res.MatchMode != "exact" {
		t.Errorf("plural should match in the exact pass, got %s", res.MatchMode)
	}
	typo := f.q(t, "samsnug")
	if typo.MatchMode != "approximate" {
		t.Errorf("match mode = %s", typo.MatchMode)
	}
	f.requireFound(t, typo, "a15")
	f.requireFound(t, f.q(t, "chausure"), "shoe")
}

func TestSearchSynonyms(t *testing.T) {
	f := searchEnv(t)
	f.requireFound(t, f.q(t, "ordinateur"), "laptop")
	f.requireFound(t, f.q(t, "frigo"), "fridge")
	f.requireFound(t, f.q(t, "sneakers"), "shoe")
	f.requireFound(t, f.q(t, "téléviseur"), "tv")
	res := f.q(t, "smartphone")
	f.requireFound(t, res, "tecno")
}

func TestSearchSKUCategoryAttributesShop(t *testing.T) {
	f := searchEnv(t)
	res := f.q(t, "SGA15-BLK-128")
	f.requireFirst(t, res, "a15")
	if res.Products[0].SearchRank.Tier != "sku" {
		t.Errorf("variant SKU tier = %s", res.Products[0].SearchRank.Tier)
	}
	f.requireFirst(t, f.q(t, "sga15"), "a15")

	phones := f.q(t, "phones")
	f.requireFound(t, phones, "a15", "tecno")
	f.requireAbsent(t, phones, "shoe", "fridge")
	f.requireFound(t, f.q(t, "kitchen"), "fridge", "mixer")
	f.requireFound(t, f.search(t, models.MarketplaceSearchParams{Query: "samsung", SubcategorySlug: "tvs"}), "tv")

	rouge := f.q(t, "rouge")
	f.requireFirst(t, rouge, "shoe")
	if rouge.Products[0].SearchRank.Tier != "attributes" {
		t.Errorf("attribute tier = %s", rouge.Products[0].SearchRank.Tier)
	}
	f.requireFirst(t, f.q(t, "chaussure rouge"), "shoe")
	f.requireFound(t, f.q(t, "128gb"), "a15")

	shop := f.q(t, "chez mama")
	f.requireFound(t, shop, "shoe", "a15")
	if shop.Products[f.position(shop, "fridge")].SearchRank.Tier != "seller" {
		t.Errorf("shop-name match should rank at the seller tier")
	}
	f.requireFound(t, f.q(t, "kin tech"), "tecno", "laptop")
	// The shop is called "Chez Mama Chaussures", yet its fridge is not a
	// shoe: a word of a shop name must not match the whole shop catalog.
	f.requireAbsent(t, f.q(t, "chaussures"), "fridge", "a15", "mixer")
	f.requireFirst(t, f.q(t, "smoothie"), "mixer")
}

func TestSearchVisibilityRules(t *testing.T) {
	f := searchEnv(t)
	res := f.q(t, "samsung galaxy")
	f.requireAbsent(t, res, "draft", "inactive", "ghostp", "closed", "noinv")
	f.requireFound(t, res, "a15", "a25", "a35")
	for _, q := range []string{"Samsung Galaxy Draft", "Samsung Galaxy Ghost", "Samsung Galaxy Closed", "Sans Inventaire"} {
		f.requireAbsent(t, f.q(t, q), "draft", "ghostp", "closed", "noinv")
	}
	// Rule: a product whose inventory is at zero stays visible (it has a
	// valid offer and its page shows "out of stock") but ranks after an
	// equally relevant product that can be bought now.
	a25, a35 := f.position(res, "a25"), f.position(res, "a35")
	if a25 < a35 {
		t.Errorf("out-of-stock A25 ranked before in-stock A35: %v", names(res))
	}
	if res.Products[a25].Availability != "OUT_OF_STOCK" {
		t.Errorf("availability = %s", res.Products[a25].Availability)
	}
}

func TestSearchNoDuplicatesAndCityFilter(t *testing.T) {
	f := searchEnv(t)
	res := f.q(t, "tecno")
	count := 0
	for _, p := range res.Products {
		if p.ID == f.ids["tecno"] {
			count++
		}
	}
	if count != 1 || res.Pagination.Total != len(res.Products) {
		t.Fatalf("tecno sold in two shops must appear once (count=%d total=%d)", count, res.Pagination.Total)
	}
	// Best offer is the shop with the most stock.
	if res.Products[0].ShopID != f.ids["richLshi"] {
		t.Errorf("expected the Lubumbashi offer (7 units)")
	}

	kin := f.search(t, models.MarketplaceSearchParams{Query: "tecno", City: "kinshasa"})
	if len(kin.Products) != 1 || kin.Products[0].ShopID != f.ids["richKin"] {
		t.Fatalf("city filter should keep only the Kinshasa offer")
	}
	kinA15 := f.search(t, models.MarketplaceSearchParams{Query: "samsung galaxy a15", City: "Kinshasa"})
	f.requireAbsent(t, kinA15, "a15")
	f.requireFound(t, kinA15, "case")
	// near_city prefers that city's offer without filtering.
	near := f.search(t, models.MarketplaceSearchParams{Query: "tecno", NearCity: "Kinshasa"})
	if near.Products[0].ShopID != f.ids["richKin"] {
		t.Errorf("near_city should pick the Kinshasa offer")
	}
}

func TestSearchStablePagination(t *testing.T) {
	f := searchEnv(t)
	collect := func() []uuid.UUID {
		var ids []uuid.UUID
		for page := 1; page <= 3; page++ {
			res := f.search(t, models.MarketplaceSearchParams{Query: "bracelet", Page: page, Limit: 10})
			if res.Pagination.Total != 25 {
				t.Fatalf("total = %d", res.Pagination.Total)
			}
			if res.Pagination.HasMore != (page < 3) {
				t.Errorf("page %d has_more = %v", page, res.Pagination.HasMore)
			}
			for _, p := range res.Products {
				ids = append(ids, p.ID)
			}
		}
		return ids
	}
	first, second := collect(), collect()
	seen := map[uuid.UUID]bool{}
	for i := range first {
		if first[i] != second[i] {
			t.Fatalf("order changed between identical calls at %d", i)
		}
		if seen[first[i]] {
			t.Fatalf("duplicate across pages: %s", first[i])
		}
		seen[first[i]] = true
	}
	if len(seen) != 25 {
		t.Fatalf("expected 25 distinct products across pages, got %d", len(seen))
	}
}

func TestSearchEmptySpecialAndLongQueries(t *testing.T) {
	f := searchEnv(t)
	for _, q := range []string{"", "   ", "!!!"} {
		res := f.q(t, q)
		if len(res.Products) == 0 || res.SearchID != nil {
			t.Errorf("%q: browse should list products and not be logged", q)
		}
		f.requireAbsent(t, res, "draft", "ghostp", "closed", "noinv")
	}
	f.requireFirst(t, f.q(t, "l'oréal 50%"), "loreal")
	for _, q := range []string{"'; DROP TABLE products; --", `%_\`, "a' OR '1'='1"} {
		f.q(t, q)
	}
	var n int
	if err := f.db.QueryRow(`SELECT COUNT(*) FROM products`).Scan(&n); err != nil || n == 0 {
		t.Fatalf("products table damaged: %v", err)
	}

	_, err := f.svc.SearchProducts(context.Background(), &models.MarketplaceSearchParams{Query: strings.Repeat("x", 2000)})
	var verr *service.SearchValidationError
	if !errors.As(err, &verr) || verr.Code != "QUERY_TOO_LONG" {
		t.Fatalf("expected QUERY_TOO_LONG, got %v", err)
	}
	res := f.q(t, "samsung "+strings.Repeat("galaxy ", 40))
	if len([]rune(res.NormalizedQuery)) > 120 {
		t.Errorf("query not truncated")
	}
	for _, bad := range []models.MarketplaceSearchParams{
		{Query: "x", Page: 1000},
		{Query: "x", ShopID: "not-a-uuid"},
		{Query: "x", CategorySlug: strings.Repeat("c", 500)},
	} {
		bad := bad
		if _, err := f.svc.SearchProducts(context.Background(), &bad); !errors.As(err, &verr) {
			t.Errorf("expected validation error for %+v, got %v", bad, err)
		}
	}
	// Unknown sorts fall back to relevance instead of reaching SQL.
	f.search(t, models.MarketplaceSearchParams{Query: "samsung", Sort: "id; DROP TABLE x"})
}

func TestSearchLoggingAndEvents(t *testing.T) {
	f := searchEnv(t)
	session := uuid.NewString()
	res := f.search(t, models.MarketplaceSearchParams{Query: "  Téléphone ", Session: session, City: "Kinshasa"})
	if res.SearchID == nil {
		t.Fatal("search id missing")
	}
	var norm string
	var zero bool
	var ids int
	var filters string
	if err := f.db.QueryRow(`SELECT normalized_query, is_zero_result, cardinality(result_ids), filters::text
		FROM search_query_log WHERE id = $1 AND client_session = $2`, *res.SearchID, session).Scan(&norm, &zero, &ids, &filters); err != nil {
		t.Fatal(err)
	}
	if norm != "telephone" || zero || ids != len(res.Products) || !strings.Contains(filters, "kinshasa") {
		t.Errorf("log row: norm=%q zero=%v ids=%d filters=%s", norm, zero, ids, filters)
	}
	none := f.q(t, "zzzqqqxxx")
	var zeroFlag bool
	_ = f.db.QueryRow(`SELECT is_zero_result FROM search_query_log WHERE id = $1`, *none.SearchID).Scan(&zeroFlag)
	if !zeroFlag || none.Pagination.Total != 0 {
		t.Errorf("zero-result search not flagged")
	}

	pos := 0
	click := &models.SearchEventRequest{SearchID: res.SearchID.String(), EventType: "click", ResultType: "product", ResultID: f.ids["tecno"].String(), Position: &pos}
	if ok, err := f.svc.RecordSearchEvent(click); err != nil || !ok {
		t.Fatalf("click not recorded: %v", err)
	}
	if ok, _ := f.svc.RecordSearchEvent(click); ok {
		t.Error("duplicate click should be ignored")
	}
	cart := *click
	cart.EventType = "ADD_TO_CART"
	if ok, err := f.svc.RecordSearchEvent(&cart); err != nil || !ok {
		t.Fatalf("add to cart not recorded: %v", err)
	}
	if ok, err := f.svc.RecordSearchEvent(&models.SearchEventRequest{Query: "sams", EventType: "CLICK", ResultType: "SHOP", ResultID: f.ids["mama"].String()}); err != nil || !ok {
		t.Fatalf("suggestion click not recorded: %v", err)
	}
	var verr *service.SearchValidationError
	if _, err := f.svc.RecordSearchEvent(&models.SearchEventRequest{SearchID: uuid.NewString(), EventType: "PURCHASE", ResultType: "PRODUCT", ResultID: uuid.NewString()}); !errors.As(err, &verr) {
		t.Errorf("unknown event type accepted")
	}
	if ok, _ := f.svc.RecordSearchEvent(&models.SearchEventRequest{SearchID: uuid.NewString(), EventType: "CLICK", ResultType: "PRODUCT", ResultID: uuid.NewString()}); ok {
		t.Errorf("event for an unknown search accepted")
	}
}

func TestShopSearchRanking(t *testing.T) {
	f := searchEnv(t)
	ctx := context.Background()
	shops, total, err := f.svc.ListShops(ctx, "Chez Mama", "", "", 1, 10)
	if err != nil {
		t.Fatal(err)
	}
	if total == 0 || shops[0].ID != f.ids["mama"] {
		t.Fatalf("expected Chez Mama first, got %+v", shops)
	}
	// A product query ranks shops by matching in-stock products; the
	// premium, trusted "Kin Tech" shops sell no shoes and must not appear.
	shoes, _, err := f.svc.ListShops(ctx, "chaussure", "", "", 1, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(shoes) == 0 || shoes[0].ID != f.ids["mama"] {
		t.Fatalf("expected the shoe seller first, got %+v", shoes)
	}
	for _, s := range shoes {
		if s.ID == f.ids["richKin"] || s.ID == f.ids["richLshi"] {
			t.Errorf("shop without matching products listed: %s", s.Name)
		}
	}
	all, _, err := f.svc.ListShops(ctx, "", "", "", 1, 50)
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range all {
		if s.ID == f.ids["mamaClosed"] || s.ID == f.ids["ghost"] {
			t.Errorf("inactive shop listed: %s", s.Name)
		}
	}
	lshi, _, _ := f.svc.ListShops(ctx, "", "lubumbashi", "", 1, 50)
	for _, s := range lshi {
		if s.City != "Lubumbashi" {
			t.Errorf("city filter leaked %s (%s)", s.Name, s.City)
		}
	}
	byCity, _, _ := f.svc.ListShops(ctx, "kinshasa", "", "", 1, 50)
	if len(byCity) == 0 || byCity[0].ID != f.ids["richKin"] {
		t.Errorf("a city query should list shops of that city")
	}
}

func TestSearchSuggestions(t *testing.T) {
	f := searchEnv(t)
	ctx := context.Background()
	s, err := f.svc.Suggest(ctx, "sams", 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(s.Products) == 0 {
		t.Fatal("no product suggestions")
	}
	seen := map[uuid.UUID]bool{}
	for _, p := range s.Products {
		if seen[p.ID] {
			t.Errorf("duplicate suggestion %s", p.Name)
		}
		seen[p.ID] = true
	}
	// Suggestions agree with the full search page.
	full := f.search(t, models.MarketplaceSearchParams{Query: "sams", Limit: len(s.Products)})
	for i := range s.Products {
		if s.Products[i].ID != full.Products[i].ID {
			t.Fatalf("suggestion order differs from search page at %d", i)
		}
	}
	phones, _ := f.svc.Suggest(ctx, "phon", 5)
	found := false
	for _, sub := range phones.Subcategories {
		found = found || sub.Slug == "phones"
	}
	if !found {
		t.Errorf("subcategory Phones not suggested: %+v", phones.Subcategories)
	}
	tel, _ := f.svc.Suggest(ctx, "téléphone", 5)
	found = false
	for _, sub := range tel.Subcategories {
		found = found || sub.Slug == "phones"
	}
	if !found {
		t.Errorf("synonym téléphone should suggest Phones")
	}
	mama, _ := f.svc.Suggest(ctx, "mama", 5)
	if len(mama.Shops) == 0 || mama.Shops[0].ID != f.ids["mama"] {
		t.Errorf("shop suggestion missing")
	}
	short, _ := f.svc.Suggest(ctx, "s", 5)
	if len(short.Products)+len(short.Shops) != 0 {
		t.Errorf("one character must not trigger suggestions")
	}
}

func TestSearchDocumentTriggers(t *testing.T) {
	f := searchEnv(t)
	// Renaming a subcategory, a business or a variant attribute must reach
	// the search document without any batch job.
	if err := f.exec(`UPDATE product_variants SET attributes = '{"Color":"Turquoise"}' WHERE product_id = $1`, f.ids["mixer"]); err != nil {
		t.Fatal(err)
	}
	f.requireFirst(t, f.q(t, "turquoise"), "mixer")
	if err := f.exec(`UPDATE businesses SET name = 'Mama Commerce Plus' WHERE id = $1`, f.ids["mama"]); err != nil {
		t.Fatal(err)
	}
	f.requireFound(t, f.q(t, "mama commerce plus"), "shoe")
	if err := f.exec(`UPDATE products SET publication_status = 'DRAFT' WHERE id = $1`, f.ids["loreal"]); err != nil {
		t.Fatal(err)
	}
	f.requireAbsent(t, f.q(t, "oreal"), "loreal")
	_ = f.exec(`UPDATE products SET publication_status = 'PUBLISHED' WHERE id = $1`, f.ids["loreal"])
	_ = f.exec(`UPDATE businesses SET name = 'Mama Commerce' WHERE id = $1`, f.ids["mama"])
}

// Search does not use Redis at all; the category shop ranking does and must
// fall back to PostgreSQL when Redis is unreachable.
func TestSearchAndRankingWithoutRedis(t *testing.T) {
	f := searchEnv(t)
	f.requireFirst(t, f.q(t, "Samsung Galaxy A15"), "a15")

	dead := redislib.NewClient(&config.Config{RedisAddr: "127.0.0.1:1"})
	defer dead.Close()
	rank := repository.NewRankingRepository(dead, f.repo)
	if _, _, err := rank.GetCategoryRanking(context.Background(), f.ids["cat:electronics"], 1, 10); err != nil {
		t.Fatalf("category ranking without Redis: %v", err)
	}
}

// TestSearchExplainPlans prints query plans against whatever catalog the test
// database holds (load a large synthetic catalog first). It does not seed or
// truncate anything. Run with SEARCH_EXPLAIN=1.
func TestSearchExplainPlans(t *testing.T) {
	dsn := os.Getenv("SEARCH_TEST_DSN")
	if dsn == "" || os.Getenv("SEARCH_EXPLAIN") != "1" {
		t.Skip("set SEARCH_TEST_DSN and SEARCH_EXPLAIN=1")
	}
	raw, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer raw.Close()
	repo := repository.NewMarketplaceRepository(&database.DB{DB: raw, DSN: dsn}, nil)
	svc := service.NewMarketplaceService(repo, nil)
	ctx := context.Background()
	entries, _ := repo.LoadSearchSynonyms()
	syn := searchutil.NewSynonymSet(entries)
	for _, c := range []struct {
		q     string
		fuzzy bool
	}{{"samsung noir", false}, {"chaussures", false}, {"ordinateur", false}, {"samsnug", true}, {"", false}} {
		start := time.Now()
		res, err := svc.SearchProducts(ctx, &models.MarketplaceSearchParams{Query: c.q, Limit: 20})
		if err != nil {
			t.Errorf("%q: %v", c.q, err)
		} else {
			t.Logf("%q -> %d results (%s) in %s", c.q, res.Pagination.Total, res.MatchMode, time.Since(start))
		}
		plan, err := repo.ExplainProductSearch(ctx, searchutil.Parse(c.q, "fr", syn), &models.MarketplaceSearchParams{Query: c.q, Page: 1, Limit: 20, Sort: "relevance"}, c.fuzzy, true)
		if err != nil {
			t.Fatal(err)
		}
		t.Logf("plan for %q (fuzzy=%v):\n%s", c.q, c.fuzzy, plan)
	}
	for _, q := range []string{"chaussures", "samsung", "mama", ""} {
		start := time.Now()
		_, total, err := svc.ListShops(ctx, q, "", "", 1, 20)
		if err != nil {
			t.Errorf("shops %q: %v", q, err)
			continue
		}
		t.Logf("shops %q -> %d in %s", q, total, time.Since(start))
		start = time.Now()
		if _, err := svc.Suggest(ctx, q, 5); err != nil {
			t.Errorf("suggest %q: %v", q, err)
		}
		t.Logf("suggest %q in %s", q, time.Since(start))
	}
}

func TestAdminSearchAnalyticsAndSynonyms(t *testing.T) {
	f := searchEnv(t)
	admin := repository.NewAdminCommerceRepository(f.db)
	session := uuid.NewString()
	// A zero-result query quickly reformulated, then a clicked search.
	f.search(t, models.MarketplaceSearchParams{Query: "qwxzv plmko", Session: session})
	res := f.search(t, models.MarketplaceSearchParams{Query: "frigo", Session: session})
	pos := 0
	if _, err := f.svc.RecordSearchEvent(&models.SearchEventRequest{SearchID: res.SearchID.String(), EventType: "CLICK", ResultType: "PRODUCT", ResultID: f.ids["fridge"].String(), Position: &pos}); err != nil {
		t.Fatal(err)
	}
	a, err := admin.GetSearchAnalytics()
	if err != nil {
		t.Fatal(err)
	}
	if a.Searches == 0 || a.ClickThroughRate == nil || !a.ClicksCollected || len(a.TopQueries) == 0 {
		t.Fatalf("analytics incomplete: %+v", a)
	}
	found := false
	for _, z := range a.ZeroResultQueries {
		found = found || z.Query == "qwxzv plmko"
	}
	if !found {
		t.Errorf("zero-result query missing: %+v", a.ZeroResultQueries)
	}
	found = false
	for _, r := range a.Reformulations {
		found = found || (r.FromQuery == "qwxzv plmko" && r.ToQuery == "frigo")
	}
	if !found {
		t.Errorf("reformulation missing: %+v", a.Reformulations)
	}
	logs, total, err := admin.ListSearchQueries(10, 0)
	if err != nil || total == 0 || logs[0].NormalizedQuery == "" {
		t.Fatalf("query log: %v %d", err, total)
	}

	// Synonyms: normalized on write, visible to search after a cache reload.
	var verr error
	adminSvc := service.NewAdminCommerceService(f.db, admin, nil, nil, nil, repository.NewAuditRepository(f.db))
	if _, verr = adminSvc.UpsertSearchSynonym(uuid.New(), models.AdminRoleSuperAdmin, &models.UpsertSearchSynonymRequest{Term: "  Mixeurs ", CanonicalTerm: "Blender"}, "127.0.0.1", "test"); verr != nil {
		t.Fatal(verr)
	}
	list, _ := admin.ListSearchSynonyms()
	ok := false
	for _, s := range list {
		ok = ok || (s.Term == "mixeurs" && s.CanonicalTerm == "blender")
	}
	if !ok {
		t.Fatalf("synonym not normalized/stored: %+v", list)
	}
	if _, err := adminSvc.UpsertSearchSynonym(uuid.New(), models.AdminRoleSuperAdmin, &models.UpsertSearchSynonymRequest{Term: "!!!", CanonicalTerm: "x"}, "", ""); !errors.Is(err, service.ErrInvalidSynonym) {
		t.Errorf("empty normalized term accepted: %v", err)
	}
	if deleted, err := adminSvc.DeleteSearchSynonym(uuid.New(), models.AdminRoleSuperAdmin, "Mixeurs", "", ""); err != nil || !deleted {
		t.Errorf("delete failed: %v", err)
	}
	rule := service.SearchRankingRule()
	if rule.MaxBonus >= rule.TierGap {
		t.Errorf("ranking rule inconsistent")
	}
}
