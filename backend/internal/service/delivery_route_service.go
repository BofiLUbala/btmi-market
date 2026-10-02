package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/btmi-ai-market/backend/internal/maps"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

var (
	// ErrRouteNotPlannable: the delivery is not between assignment and arrival.
	ErrRouteNotPlannable = errors.New("ROUTE_NOT_PLANNABLE")
	// ErrRouteNotConfirmed: the client did not show both points on the map first.
	ErrRouteNotConfirmed = errors.New("ROUTE_NOT_CONFIRMED")
)

// ErrInvalidRoutePoint wraps every reason a start or destination is refused.
type ErrInvalidRoutePoint struct{ Msg string }

func (e *ErrInvalidRoutePoint) Error() string { return e.Msg }

type deliveryRouteStore interface {
	GetRouteContext(orderID uuid.UUID) (*models.RouteContext, error)
	GetRoute(orderID uuid.UUID) (*models.StoredRoute, error)
	SaveRoute(rt *models.StoredRoute) error
	Trail(orderID uuid.UUID) ([]maps.LngLat, error)
}

type routeProvider interface {
	Configured() bool
	Geocode(ctx context.Context, query string) ([]maps.Candidate, error)
	Route(ctx context.Context, from, to maps.LngLat, travelMode string) (*maps.Route, error)
}

// Route tuning.
const (
	// OffRouteMinM: a courier further than this from the route has left it
	// (or twice the GPS accuracy, when that is worse).
	OffRouteMinM = 60.0
	// RerouteCooldown keeps a wandering courier from hammering TomTom.
	RerouteCooldown = 20 * time.Second
	arrowSpacingM   = 200.0
	maxArrows       = 30
	maxTrailPoints  = 400
	trailNoiseM     = 8.0
	trailMaxHopM    = 3000.0
	maxRouteSpanM   = 200_000.0
	minRouteSpanM   = 20.0
)

// DeliveryRouteService plans the road route of a delivery and measures the
// courier's progress along it.
type DeliveryRouteService struct {
	store    deliveryRouteStore
	provider routeProvider
	now      func() time.Time
	inFlight sync.Map // order id -> struct{}: one reroute at a time per order
}

func NewDeliveryRouteService(store deliveryRouteStore, provider routeProvider) *DeliveryRouteService {
	return &DeliveryRouteService{store: store, provider: provider, now: time.Now}
}

// Geocode proposes places for an address. The caller must still confirm one
// on the map, or place the point by hand when none is right.
func (s *DeliveryRouteService) Geocode(query string) ([]maps.Candidate, error) {
	q := strings.TrimSpace(query)
	if len([]rune(q)) < 3 {
		return nil, &ErrInvalidRoutePoint{Msg: "Saisissez au moins 3 caractères"}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	return s.provider.Geocode(ctx, q)
}

func offRouteThreshold(accuracy *float64) float64 {
	if accuracy != nil && 2**accuracy > OffRouteMinM {
		return 2 * *accuracy
	}
	return OffRouteMinM
}

func validatePoint(p models.RoutePointInput, allowed map[string]bool, what string) (*models.RoutePoint, error) {
	if p.Latitude == nil || p.Longitude == nil || !maps.ValidPoint(*p.Latitude, *p.Longitude) {
		return nil, &ErrInvalidRoutePoint{Msg: what + " : coordonnées invalides"}
	}
	src := strings.ToUpper(strings.TrimSpace(p.Source))
	if !allowed[src] {
		return nil, &ErrInvalidRoutePoint{Msg: what + " : origine du point inconnue"}
	}
	label := strings.TrimSpace(p.Label)
	if len([]rune(label)) > 300 {
		label = string([]rune(label)[:300])
	}
	return &models.RoutePoint{Latitude: *p.Latitude, Longitude: *p.Longitude, Source: src, Label: label}, nil
}

var (
	startSources = map[string]bool{models.RoutePointGPS: true, models.RoutePointCoordinates: true, models.RoutePointAddress: true, models.RoutePointMap: true}
	destSources  = map[string]bool{models.RoutePointBuyerGPS: true, models.RoutePointCoordinates: true, models.RoutePointAddress: true, models.RoutePointMap: true}
)

// SetRoute computes and stores the road route between two confirmed points.
// role is models.RoleCourier-like "COURIER" (must be the assigned courier) or
// "COMMERCE_ADMIN" (the route enforces the role).
func (s *DeliveryRouteService) SetRoute(actorID uuid.UUID, role string, orderID uuid.UUID, req *models.SetRouteRequest) (*models.StoredRoute, error) {
	rc, err := s.store.GetRouteContext(orderID)
	if err != nil {
		return nil, err
	}
	if rc == nil {
		return nil, ErrLocationOrderNotFound
	}
	if role == "COURIER" && (rc.AssignedCourierID == nil || *rc.AssignedCourierID != actorID) {
		return nil, ErrLocationForbidden
	}
	if !models.RoutePlanningStatuses[rc.DeliveryStatus] {
		return nil, ErrRouteNotPlannable
	}
	if !req.Confirmed {
		return nil, ErrRouteNotConfirmed
	}
	start, err := validatePoint(req.Start, startSources, "Départ")
	if err != nil {
		return nil, err
	}
	dest, err := validatePoint(req.Destination, destSources, "Destination")
	if err != nil {
		return nil, err
	}
	if dest.Source == models.RoutePointBuyerGPS {
		// Only the buyer's own checkout point may be called that.
		if rc.DeliveryLatitude == nil || maps.DistanceM(maps.LngLat{*rc.DeliveryLongitude, *rc.DeliveryLatitude}, maps.LngLat{dest.Longitude, dest.Latitude}) > 5 {
			return nil, &ErrInvalidRoutePoint{Msg: "Destination : ce n'est pas le point partagé par l'acheteur"}
		}
	}
	from, to := maps.LngLat{start.Longitude, start.Latitude}, maps.LngLat{dest.Longitude, dest.Latitude}
	span := maps.DistanceM(from, to)
	if span < minRouteSpanM {
		return nil, &ErrInvalidRoutePoint{Msg: "Le départ et la destination sont au même endroit"}
	}
	if span > maxRouteSpanM {
		return nil, &ErrInvalidRoutePoint{Msg: "Le départ et la destination sont trop éloignés (plus de 200 km) : vérifiez les points"}
	}
	mode := maps.TravelModeFor(rc.TransportType)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	route, err := s.provider.Route(ctx, from, to, mode)
	if err != nil {
		return nil, err
	}
	actor := actorID
	stored := &models.StoredRoute{
		OrderID: orderID, Start: *start, Destination: *dest, TravelMode: mode,
		Geometry: route.Geometry, LengthM: route.LengthM, DurationS: route.DurationS, Instructions: route.Instructions,
		PlannedLengthM: route.LengthM, SetByUserID: &actor, SetByRole: role, ComputedAt: s.now(),
	}
	if err := s.store.SaveRoute(stored); err != nil {
		return nil, err
	}
	return stored, nil
}

// MaybeReroute recomputes the route from the courier's position when they
// have left it. Called after an accepted point; never blocks the ping.
func (s *DeliveryRouteService) MaybeReroute(orderID uuid.UUID, p maps.LngLat, accuracy *float64) {
	if _, busy := s.inFlight.LoadOrStore(orderID, struct{}{}); busy {
		return
	}
	defer s.inFlight.Delete(orderID)
	rt, err := s.store.GetRoute(orderID)
	if err != nil || rt == nil {
		return
	}
	proj := maps.Project(rt.Geometry, p)
	if proj.AwayM <= offRouteThreshold(accuracy) || s.now().Sub(rt.ComputedAt) < RerouteCooldown {
		return
	}
	// Before pickup the courier is tracked on the way to the shop, off the
	// planned shop-to-buyer route by design: only a courier carrying the parcel
	// is rerouted.
	if rc, err := s.store.GetRouteContext(orderID); err != nil || rc == nil || rc.DeliveryStatus != models.DeliveryStatusInTransit {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	route, err := s.provider.Route(ctx, p, maps.LngLat{rt.Destination.Longitude, rt.Destination.Latitude}, rt.TravelMode)
	if err != nil {
		log.Printf("delivery route: reroute %s failed: %v", orderID, err)
		return
	}
	rt.Start = models.RoutePoint{Latitude: p[1], Longitude: p[0], Source: models.RoutePointReroute,
		Label: fmt.Sprintf("Recalculé à %.0f m de l'itinéraire", proj.AwayM)}
	rt.Geometry, rt.LengthM, rt.DurationS, rt.Instructions = route.Geometry, route.LengthM, route.DurationS, route.Instructions
	rt.SetByUserID, rt.SetByRole = nil, "SYSTEM"
	rt.RerouteCount++
	if err := s.store.SaveRoute(rt); err != nil {
		log.Printf("delivery route: saving reroute %s failed: %v", orderID, err)
	}
}

// AttachRoute adds the route and the courier's progress to a position
// response. withInstructions is for the courier and Commerce Admin; the buyer
// gets the trace, the direction and the distances.
func (s *DeliveryRouteService) AttachRoute(resp *models.CourierLocationResponse, withInstructions bool) error {
	rt, err := s.store.GetRoute(resp.OrderID)
	if err != nil || rt == nil {
		return err
	}
	// An address the buyer did not pin is placed by whoever planned the route.
	if resp.DeliveryLatitude == nil {
		la, lo := rt.Destination.Latitude, rt.Destination.Longitude
		resp.DeliveryLatitude, resp.DeliveryLongitude = &la, &lo
	}
	trail, err := s.store.Trail(resp.OrderID)
	if err != nil {
		return err
	}
	view := &models.DeliveryRouteView{
		Start: rt.Start, Destination: rt.Destination, TravelMode: rt.TravelMode,
		Geometry: rt.Geometry, Arrows: maps.Arrows(rt.Geometry, arrowSpacingM, maxArrows),
		Trail: maps.Simplify(trail, maxTrailPoints), RouteLengthM: rt.LengthM, PlannedLengthM: rt.PlannedLengthM,
		TravelledM:   math.Round(maps.TravelledM(trail, trailNoiseM, trailMaxHopM)),
		RerouteCount: rt.RerouteCount, ComputedAt: rt.ComputedAt,
	}
	progress := 0.0
	remaining := rt.LengthM
	if resp.Location != nil {
		proj := maps.Project(rt.Geometry, maps.LngLat{resp.Location.Longitude, resp.Location.Latitude})
		progress = proj.OffsetM
		remaining = proj.LineLenM - proj.OffsetM + proj.AwayM
		view.OffRouteM = math.Round(proj.AwayM)
		view.OffRoute = proj.AwayM > offRouteThreshold(resp.Location.Accuracy)
	}
	view.RemainingM = math.Round(math.Max(0, remaining))
	view.TotalM = view.TravelledM + view.RemainingM
	if rt.LengthM > 0 && rt.DurationS > 0 {
		view.RemainingS = math.Round(view.RemainingM / (rt.LengthM / rt.DurationS))
		eta := s.now().Add(time.Duration(view.RemainingS) * time.Second)
		view.ETA = &eta
	}
	for _, in := range rt.Instructions {
		if in.OffsetM > progress+5 {
			view.NextInstruction = &models.NextInstruction{Message: in.Message, Maneuver: in.Maneuver, InM: math.Round(in.OffsetM - progress)}
			break
		}
	}
	if withInstructions {
		view.Instructions = rt.Instructions
	}
	// JSON clients read these as arrays: never send null.
	if view.Trail == nil {
		view.Trail = []maps.LngLat{}
	}
	if view.Arrows == nil {
		view.Arrows = []maps.Arrow{}
	}
	resp.Route = view
	return nil
}

// RouteContext exposes the order's planning context (courier check).
func (s *DeliveryRouteService) RouteContext(orderID uuid.UUID) (*models.RouteContext, error) {
	return s.store.GetRouteContext(orderID)
}
