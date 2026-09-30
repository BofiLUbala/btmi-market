package tracking_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/handlers/tracking"
	"github.com/btmi-ai-market/backend/internal/middleware"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// Live courier GPS against the real schema: the guarded write, the history,
// the NOTIFY, the read access per role, and tracking ending with IN_TRANSIT.

type profiles map[uuid.UUID]uuid.UUID // user id -> buyer profile id

func (p profiles) GetProfileByIDFromUser(userID uuid.UUID) (*models.BuyerProfile, error) {
	id, ok := p[userID]
	if !ok {
		return nil, fmt.Errorf("no buyer profile")
	}
	return &models.BuyerProfile{ID: id}, nil
}

type fixture struct {
	db                            *database.DB
	router                        *gin.Engine
	order                         uuid.UUID
	courier, otherCourier         uuid.UUID
	buyer, otherBuyer, sellerUser uuid.UUID
}

func connect(t *testing.T) *database.DB {
	t.Helper()
	cfg := config.Load()
	db, err := database.Connect(cfg.DBHost, cfg.DBPort, cfg.DBName, cfg.DBUser, cfg.DBPassword)
	if err != nil {
		t.Skipf("Skipping real DB test: %v", err)
	}
	if err := db.RunMigrations("../../../migrations"); err != nil {
		t.Fatalf("migrations: %v", err)
	}
	return db
}

func newUser(t *testing.T, db *database.DB, label string) uuid.UUID {
	t.Helper()
	id := uuid.New()
	_, err := db.Exec(`INSERT INTO users (id, email, first_name, last_name, password_hash, phone)
		VALUES ($1, $2, 'GPS', $3, 'x', $4)`, id, fmt.Sprintf("gps-%s-%s@test.invalid", label, id.String()[:8]), label, "+243"+id.String()[:8])
	if err != nil {
		t.Fatalf("user %s: %v", label, err)
	}
	t.Cleanup(func() { _, _ = db.Exec(`DELETE FROM users WHERE id = $1`, id) })
	return id
}

func newBuyerProfile(t *testing.T, db *database.DB, userID uuid.UUID) uuid.UUID {
	t.Helper()
	id := uuid.New()
	if _, err := db.Exec(`INSERT INTO buyer_profiles (id, user_id, first_name, last_name, phone, email)
		VALUES ($1, $2, 'GPS', 'Buyer', '+243000', 'gps-buyer@test.invalid')`, id, userID); err != nil {
		t.Fatalf("buyer profile: %v", err)
	}
	t.Cleanup(func() { _, _ = db.Exec(`DELETE FROM buyer_profiles WHERE id = $1`, id) })
	return id
}

func setup(t *testing.T) *fixture {
	db := connect(t)
	t.Cleanup(func() { db.Close() })
	f := &fixture{db: db}

	var shopID, businessID uuid.UUID
	if err := db.QueryRow(`SELECT id, business_id FROM shops ORDER BY created_at LIMIT 1`).Scan(&shopID, &businessID); err != nil {
		t.Skipf("no shop to attach a test order to: %v", err)
	}
	f.courier = newUser(t, db, "courier")
	f.otherCourier = newUser(t, db, "other-courier")
	f.buyer = newUser(t, db, "buyer")
	f.otherBuyer = newUser(t, db, "other-buyer")
	f.sellerUser = newUser(t, db, "seller")
	buyerProfile := newBuyerProfile(t, db, f.buyer)
	otherProfile := newBuyerProfile(t, db, f.otherBuyer)

	f.order = uuid.New()
	if _, err := db.Exec(`INSERT INTO orders (id, business_id, shop_id, buyer_profile_id, assigned_courier_id,
			delivery_status, delivery_method, delivery_address, delivery_latitude, delivery_longitude)
		VALUES ($1, $2, $3, $4, $5, 'PICKED_UP', 'TBK_STANDARD', 'Av. Test 1, Gombe, Kinshasa', -4.3050, 15.3120)`,
		f.order, businessID, shopID, buyerProfile, f.courier); err != nil {
		t.Fatalf("order: %v", err)
	}
	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM delivery_status_history WHERE order_id = $1`, f.order)
		_, _ = db.Exec(`DELETE FROM orders WHERE id = $1`, f.order)
	})

	h := tracking.NewLocationHandler(
		service.NewCourierLocationService(repository.NewDeliveryLocationRepository(db)),
		profiles{f.buyer: buyerProfile, f.otherBuyer: otherProfile},
	)
	gin.SetMode(gin.TestMode)
	r := gin.New()
	// Stand-ins for the auth middlewares: identity from headers.
	asUser := func(c *gin.Context) { c.Set("user_id", uuid.MustParse(c.GetHeader("X-User"))) }
	asAdmin := func(c *gin.Context) { c.Set("admin_role", models.AdminRole(c.GetHeader("X-Admin-Role"))) }
	r.POST("/courier/missions/:id/location", asUser, h.ReportLocation)
	r.GET("/buyer/orders/:order_id/courier-location", asUser, h.BuyerCourierLocation)
	// Same role list as the real /admin/commerce group.
	r.GET("/admin/commerce/orders/:id/courier-location", asAdmin, middleware.RequireAdminRoles(models.CommerceAdminRoles...), h.AdminCourierLocation)
	f.router = r
	return f
}

func (f *fixture) do(t *testing.T, method, path string, headers map[string]string, body any) (int, string) {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	f.router.ServeHTTP(rec, req)
	return rec.Code, rec.Body.String()
}

func (f *fixture) post(t *testing.T, courier uuid.UUID, body map[string]any) (int, string) {
	return f.do(t, http.MethodPost, "/courier/missions/"+f.order.String()+"/location", map[string]string{"X-User": courier.String()}, body)
}

func pt(lat, lng float64, at time.Time) map[string]any {
	return map[string]any{"latitude": lat, "longitude": lng, "accuracy": 12, "heading": -1, "speed": -1, "captured_at": at.UTC().Format(time.RFC3339Nano)}
}

func (f *fixture) setStatus(t *testing.T, status string) {
	t.Helper()
	if _, err := f.db.Exec(`UPDATE orders SET delivery_status = $2 WHERE id = $1`, f.order, status); err != nil {
		t.Fatalf("set %s: %v", status, err)
	}
}

func (f *fixture) count(t *testing.T, query string) int {
	t.Helper()
	var n int
	if err := f.db.QueryRow(query, f.order).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func (f *fixture) liveCount(t *testing.T) int {
	return f.count(t, `SELECT COUNT(*) FROM delivery_live_locations WHERE order_id = $1`)
}

func (f *fixture) pointCount(t *testing.T) int {
	return f.count(t, `SELECT COUNT(*) FROM delivery_location_points WHERE order_id = $1`)
}

// Lets the next point pass the 3-second spacing without sleeping.
func (f *fixture) ageLatest(t *testing.T) {
	t.Helper()
	if _, err := f.db.Exec(`UPDATE delivery_live_locations SET received_at = received_at - INTERVAL '5 seconds' WHERE order_id = $1`, f.order); err != nil {
		t.Fatal(err)
	}
}

func TestCourierLiveLocationRealDB(t *testing.T) {
	f := setup(t)
	now := time.Now()

	// Not in transit yet: nothing is taken.
	if code, body := f.post(t, f.courier, pt(-4.31, 15.30, now)); code != http.StatusConflict || !strings.Contains(body, "TRACKING_NOT_ACTIVE") {
		t.Fatalf("PICKED_UP: got %d %s, want 409 TRACKING_NOT_ACTIVE", code, body)
	}

	f.setStatus(t, "IN_TRANSIT")

	// Wrong courier: same refusal, and nothing is written.
	if code, body := f.post(t, f.otherCourier, pt(-4.31, 15.30, now)); code != http.StatusConflict || !strings.Contains(body, "TRACKING_NOT_ACTIVE") {
		t.Fatalf("wrong courier: got %d %s", code, body)
	}
	if f.liveCount(t) != 0 {
		t.Fatal("wrong courier wrote a position")
	}

	// Listen before the accepted write to catch its NOTIFY.
	cfg := config.Load()
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable", cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName)
	listener := pq.NewListener(dsn, time.Second, time.Second, nil)
	defer listener.Close()
	if err := listener.Listen("tbk_order_events"); err != nil {
		t.Fatalf("listen: %v", err)
	}

	// Assigned courier in transit: accepted, latest row and one history point.
	if code, body := f.post(t, f.courier, pt(-4.3100, 15.3000, now.Add(-2*time.Second))); code != http.StatusOK || !strings.Contains(body, `"accepted":true`) {
		t.Fatalf("valid point: got %d %s", code, body)
	}
	if f.liveCount(t) != 1 || f.pointCount(t) != 1 {
		t.Fatalf("after first point: live=%d points=%d, want 1/1", f.liveCount(t), f.pointCount(t))
	}
	var accNull, headingNull bool
	_ = f.db.QueryRow(`SELECT accuracy_m IS NULL, heading_deg IS NULL FROM delivery_live_locations WHERE order_id = $1`, f.order).Scan(&accNull, &headingNull)
	if accNull || !headingNull {
		t.Fatalf("accuracy must be kept and Android's -1 heading stored as NULL (acc null=%v heading null=%v)", accNull, headingNull)
	}

	want := "location:" + f.order.String()
	deadline := time.After(5 * time.Second)
	for got := false; !got; {
		select {
		case n := <-listener.Notify:
			got = n != nil && n.Extra == want
		case <-deadline:
			t.Fatalf("no NOTIFY %q after an accepted point", want)
		}
	}

	// Refused points.
	for name, body := range map[string]map[string]any{
		"latitude out of range":  pt(123, 15.3, now),
		"longitude out of range": pt(-4.3, 200, now),
		"accuracy 400 m":         {"latitude": -4.3, "longitude": 15.3, "accuracy": 400, "captured_at": now.UTC().Format(time.RFC3339)},
		"2 min in the future":    pt(-4.3, 15.3, now.Add(2*time.Minute)),
	} {
		if code, resp := f.post(t, f.courier, body); code != http.StatusUnprocessableEntity {
			t.Errorf("%s: got %d %s, want 422", name, code, resp)
		}
	}

	// Too soon after the accepted one: ignored, not an error.
	if code, body := f.post(t, f.courier, pt(-4.3110, 15.3010, now)); code != http.StatusOK || !strings.Contains(body, `"accepted":false`) {
		t.Fatalf("throttled point: got %d %s", code, body)
	}

	// Older than the stored point: ignored safely, latest unchanged.
	f.ageLatest(t)
	if code, body := f.post(t, f.courier, pt(-4.9, 15.9, now.Add(-time.Minute))); code != http.StatusOK || !strings.Contains(body, `"accepted":false`) {
		t.Fatalf("older point: got %d %s", code, body)
	}

	// Newer point: latest row updated and appended to the history.
	if code, body := f.post(t, f.courier, pt(-4.3200, 15.3100, now.Add(time.Second))); code != http.StatusOK || !strings.Contains(body, `"accepted":true`) {
		t.Fatalf("newer point: got %d %s", code, body)
	}
	var lat float64
	_ = f.db.QueryRow(`SELECT latitude FROM delivery_live_locations WHERE order_id = $1`, f.order).Scan(&lat)
	if lat != -4.32 || f.pointCount(t) != 2 {
		t.Fatalf("latest lat=%v points=%d, want -4.32 and 2", lat, f.pointCount(t))
	}

	orderPath := "/buyer/orders/" + f.order.String() + "/courier-location"
	adminPath := "/admin/commerce/orders/" + f.order.String() + "/courier-location"

	// The owner reads it, without the courier's identity.
	code, body := f.do(t, http.MethodGet, orderPath, map[string]string{"X-User": f.buyer.String()}, nil)
	if code != http.StatusOK || !strings.Contains(body, `"available":true`) || !strings.Contains(body, `"latitude":-4.32`) {
		t.Fatalf("owner: got %d %s", code, body)
	}
	if strings.Contains(body, f.courier.String()) || strings.Contains(body, "courier_user_id") {
		t.Fatalf("buyer response exposes the courier: %s", body)
	}
	if !strings.Contains(body, `"delivery_latitude":-4.305`) {
		t.Fatalf("destination missing: %s", body)
	}

	// Another buyer, and a seller-side user with no buyer profile, are refused.
	if code, _ := f.do(t, http.MethodGet, orderPath, map[string]string{"X-User": f.otherBuyer.String()}, nil); code != http.StatusForbidden {
		t.Fatalf("other buyer: got %d, want 403", code)
	}
	if code, _ := f.do(t, http.MethodGet, orderPath, map[string]string{"X-User": f.sellerUser.String()}, nil); code == http.StatusOK {
		t.Fatal("a seller-side user read the courier's position")
	}

	// Commerce Admin and Super Admin read; Finance, Technical and Direction do not.
	for role, wantCode := range map[models.AdminRole]int{
		models.AdminRoleCommerceAdmin:       http.StatusOK,
		models.AdminRoleSuperAdmin:          http.StatusOK,
		models.AdminRoleFinanceSupportAdmin: http.StatusForbidden,
		models.AdminRoleTechnicalAdmin:      http.StatusForbidden,
		models.AdminRoleDirectionAdmin:      http.StatusForbidden,
	} {
		code, body := f.do(t, http.MethodGet, adminPath, map[string]string{"X-Admin-Role": string(role)}, nil)
		if code != wantCode {
			t.Errorf("%s: got %d, want %d (%s)", role, code, wantCode, body)
		}
	}

	// Leaving IN_TRANSIT by any path clears the live position, and it is
	// neither served nor accepted afterwards.
	for i, next := range []string{"COURIER_ARRIVED", "FAILED", "PICKED_UP", "RETURNING_TO_SELLER", "CANCELLED"} {
		f.setStatus(t, "IN_TRANSIT")
		f.ageLatest(t) // the first round is still in the transit tested above
		if code, body := f.post(t, f.courier, pt(-4.33, 15.32, now.Add(time.Duration(i+2)*time.Second))); code != http.StatusOK || !strings.Contains(body, `"accepted":true`) {
			t.Fatalf("before %s: %d %s", next, code, body)
		}
		if f.liveCount(t) != 1 {
			t.Fatalf("before %s: no live row", next)
		}
		f.setStatus(t, next)
		if f.liveCount(t) != 0 {
			t.Fatalf("%s left a live position behind", next)
		}
		if code, body := f.post(t, f.courier, pt(-4.34, 15.33, time.Now())); code != http.StatusConflict {
			t.Fatalf("%s: server still accepts points (%d %s)", next, code, body)
		}
		code, body := f.do(t, http.MethodGet, orderPath, map[string]string{"X-User": f.buyer.String()}, nil)
		if code != http.StatusOK || !strings.Contains(body, `"live_tracking_active":false`) || !strings.Contains(body, `"location":null`) {
			t.Fatalf("%s: buyer still sees a position: %d %s", next, code, body)
		}
	}
	// History outlives the live row (it is the thin audit trail).
	if f.pointCount(t) < 7 {
		t.Fatalf("history points = %d, want at least 7", f.pointCount(t))
	}
}

func TestDeliveryLocationRetentionRealDB(t *testing.T) {
	f := setup(t)
	repo := repository.NewDeliveryLocationRepository(f.db)

	// A 31-day-old and a fresh history point.
	if _, err := f.db.Exec(`INSERT INTO delivery_location_points (order_id, courier_user_id, latitude, longitude, captured_at, received_at)
		VALUES ($1, $2, -4.3, 15.3, NOW() - INTERVAL '31 days', NOW() - INTERVAL '31 days'),
		       ($1, $2, -4.3, 15.3, NOW(), NOW())`, f.order, f.courier); err != nil {
		t.Fatal(err)
	}
	// A live row the trigger never saw (order not in transit): the sweep removes it.
	if _, err := f.db.Exec(`INSERT INTO delivery_live_locations (order_id, courier_user_id, latitude, longitude, captured_at)
		VALUES ($1, $2, -4.3, 15.3, NOW())`, f.order, f.courier); err != nil {
		t.Fatal(err)
	}

	res, err := service.NewCourierLocationService(repo).RunRetention()
	if err != nil {
		t.Fatal(err)
	}
	if res.PointsDeleted < 1 || res.LiveLocationsDeleted < 1 {
		t.Fatalf("retention %+v", res)
	}
	if f.pointCount(t) != 1 {
		t.Fatalf("points left %d, want the fresh one only", f.pointCount(t))
	}
	if f.liveCount(t) != 0 {
		t.Fatal("live position of an order not in transit survived the sweep")
	}
}
