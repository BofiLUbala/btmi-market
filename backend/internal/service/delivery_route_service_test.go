package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/btmi-ai-market/backend/internal/maps"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type fakeRouteStore struct {
	ctx   *models.RouteContext
	route *models.StoredRoute
	trail []maps.LngLat
	saves int
}

func (f *fakeRouteStore) GetRouteContext(uuid.UUID) (*models.RouteContext, error) { return f.ctx, nil }
func (f *fakeRouteStore) GetRoute(uuid.UUID) (*models.StoredRoute, error) {
	if f.route == nil {
		return nil, nil
	}
	cp := *f.route
	return &cp, nil
}
func (f *fakeRouteStore) SaveRoute(rt *models.StoredRoute) error {
	f.saves++
	cp := *rt
	cp.ComputedAt = time.Now()
	f.route = &cp
	return nil
}
func (f *fakeRouteStore) Trail(uuid.UUID) ([]maps.LngLat, error) { return f.trail, nil }

// fakeRouter answers a straight two-point "road" between the asked points.
type fakeRouter struct {
	calls    int
	lastMode string
}

func (f *fakeRouter) Configured() bool { return true }
func (f *fakeRouter) Geocode(context.Context, string) ([]maps.Candidate, error) {
	return []maps.Candidate{{Label: "Boulevard du 30 Juin", Latitude: -4.30, Longitude: 15.30, Score: 0.88, Confident: true}}, nil
}
func (f *fakeRouter) Route(_ context.Context, from, to maps.LngLat, mode string) (*maps.Route, error) {
	f.calls++
	f.lastMode = mode
	l := maps.DistanceM(from, to)
	return &maps.Route{Geometry: []maps.LngLat{from, to}, LengthM: l, DurationS: l / 10,
		Instructions: []maps.Instruction{{Message: "Partir", OffsetM: 0}, {Message: "Vous êtes arrivé", OffsetM: l}}}, nil
}

func f64(v float64) *float64 { return &v }

func routeFixture() (*DeliveryRouteService, *fakeRouteStore, *fakeRouter, uuid.UUID) {
	courier := uuid.New()
	store := &fakeRouteStore{ctx: &models.RouteContext{OrderID: uuid.New(), DeliveryStatus: models.DeliveryStatusInTransit, AssignedCourierID: &courier, TransportType: "MOTO"}}
	router := &fakeRouter{}
	return NewDeliveryRouteService(store, router), store, router, courier
}

// 1 km east along Kinshasa's latitude.
func eastRequest() *models.SetRouteRequest {
	return &models.SetRouteRequest{
		Start:       models.RoutePointInput{Latitude: f64(-4.31), Longitude: f64(15.30), Source: "GPS"},
		Destination: models.RoutePointInput{Latitude: f64(-4.31), Longitude: f64(15.30901), Source: "MAP", Label: "Pin placé à la main"},
		Confirmed:   true,
	}
}

func TestSetRouteRules(t *testing.T) {
	svc, store, router, courier := routeFixture()

	if _, err := svc.SetRoute(uuid.New(), "COURIER", store.ctx.OrderID, eastRequest()); !errors.Is(err, ErrLocationForbidden) {
		t.Fatalf("another courier: %v", err)
	}
	unconfirmed := eastRequest()
	unconfirmed.Confirmed = false
	if _, err := svc.SetRoute(courier, "COURIER", store.ctx.OrderID, unconfirmed); !errors.Is(err, ErrRouteNotConfirmed) {
		t.Fatalf("unconfirmed: %v", err)
	}
	fake := eastRequest()
	fake.Destination.Source = "BUYER_GPS" // the buyer shared no point
	var invalid *ErrInvalidRoutePoint
	if _, err := svc.SetRoute(courier, "COURIER", store.ctx.OrderID, fake); !errors.As(err, &invalid) {
		t.Fatalf("buyer point claimed without one: %v", err)
	}
	zero := eastRequest()
	zero.Start.Latitude, zero.Start.Longitude = f64(0), f64(0)
	if _, err := svc.SetRoute(courier, "COURIER", store.ctx.OrderID, zero); !errors.As(err, &invalid) {
		t.Fatalf("0,0 start: %v", err)
	}
	store.ctx.DeliveryStatus = models.DeliveryStatusDelivered
	if _, err := svc.SetRoute(courier, "COURIER", store.ctx.OrderID, eastRequest()); !errors.Is(err, ErrRouteNotPlannable) {
		t.Fatalf("delivered order: %v", err)
	}
	store.ctx.DeliveryStatus = models.DeliveryStatusInTransit

	rt, err := svc.SetRoute(courier, "COURIER", store.ctx.OrderID, eastRequest())
	if err != nil {
		t.Fatal(err)
	}
	if router.lastMode != "motorcycle" || rt.Destination.Source != "MAP" || rt.PlannedLengthM < 990 {
		t.Fatalf("route = %+v, mode %s", rt, router.lastMode)
	}
	// Commerce Admin may correct any delivery's route.
	if _, err := svc.SetRoute(uuid.New(), "COMMERCE_ADMIN", store.ctx.OrderID, eastRequest()); err != nil {
		t.Fatalf("admin: %v", err)
	}
}

func TestAttachRouteProgressAndDestination(t *testing.T) {
	svc, store, _, courier := routeFixture()
	if _, err := svc.SetRoute(courier, "COURIER", store.ctx.OrderID, eastRequest()); err != nil {
		t.Fatal(err)
	}
	store.trail = []maps.LngLat{{15.30, -4.31}, {15.30181, -4.31}, {15.30361, -4.31}} // ~400 m driven
	resp := &models.CourierLocationResponse{OrderID: store.ctx.OrderID, LiveTrackingActive: true,
		Location: &models.CourierPosition{Latitude: -4.31, Longitude: 15.30361, Accuracy: f64(5)}}
	if err := svc.AttachRoute(resp, false); err != nil {
		t.Fatal(err)
	}
	r := resp.Route
	if r == nil {
		t.Fatal("no route attached")
	}
	if r.TravelledM < 390 || r.TravelledM > 410 || r.RemainingM < 590 || r.RemainingM > 610 {
		t.Errorf("travelled %.0f / remaining %.0f, want ~400 / ~600", r.TravelledM, r.RemainingM)
	}
	if r.OffRoute || r.ETA == nil || r.RemainingS < 55 || r.RemainingS > 65 {
		t.Errorf("off=%v eta=%v remainingS=%.0f", r.OffRoute, r.ETA, r.RemainingS)
	}
	if r.NextInstruction == nil || r.NextInstruction.Message != "Vous êtes arrivé" {
		t.Errorf("next instruction = %+v", r.NextInstruction)
	}
	if len(r.Arrows) == 0 || r.Arrows[0].Bearing != 90 {
		t.Errorf("arrows = %+v", r.Arrows)
	}
	if r.Instructions != nil {
		t.Error("the buyer must not get the turn-by-turn list")
	}
	// The buyer shared no point: the planned destination places it on the map.
	if resp.DeliveryLatitude == nil || *resp.DeliveryLongitude != 15.30901 {
		t.Errorf("destination not placed: %v", resp.DeliveryLongitude)
	}
}

func TestMaybeRerouteOnlyWhenOffRoute(t *testing.T) {
	svc, store, router, courier := routeFixture()
	if _, err := svc.SetRoute(courier, "COURIER", store.ctx.OrderID, eastRequest()); err != nil {
		t.Fatal(err)
	}
	store.route.ComputedAt = time.Now().Add(-time.Minute)
	calls := router.calls

	svc.MaybeReroute(store.ctx.OrderID, maps.LngLat{15.304, -4.31018}, f64(5)) // 20 m off: on route
	if router.calls != calls {
		t.Fatal("rerouted a courier still on the route")
	}
	svc.MaybeReroute(store.ctx.OrderID, maps.LngLat{15.304, -4.3120}, f64(5)) // ~220 m off
	if router.calls != calls+1 || store.route.RerouteCount != 1 || store.route.Start.Source != "REROUTE" {
		t.Fatalf("reroute: calls %d, route %+v", router.calls, store.route)
	}
	if store.route.PlannedLengthM < 990 {
		t.Error("the planned length must survive a reroute")
	}
	// Cooldown: the fresh route is not recomputed again at once.
	svc.MaybeReroute(store.ctx.OrderID, maps.LngLat{15.304, -4.3140}, f64(5))
	if router.calls != calls+1 {
		t.Error("rerouted again inside the cooldown")
	}
}
