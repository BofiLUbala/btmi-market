package service

import (
	"errors"
	"log"
	"time"

	"github.com/btmi-ai-market/backend/internal/maps"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// ErrTrackingNotActive: the order is not this courier's mission in transit, so
// no position is taken. The phone stops sharing when it sees it.
var ErrTrackingNotActive = errors.New("TRACKING_NOT_ACTIVE")

var (
	ErrLocationOrderNotFound = errors.New("ORDER_NOT_FOUND")
	ErrLocationForbidden     = errors.New("FORBIDDEN")
)

// ErrInvalidLocation wraps every reason a point is refused.
type ErrInvalidLocation struct{ Err error }

func (e *ErrInvalidLocation) Error() string { return e.Err.Error() }
func (e *ErrInvalidLocation) Unwrap() error { return e.Err }

type deliveryLocationStore interface {
	RecordCourierLocation(orderID, courierUserID uuid.UUID, p *models.LocationPoint) (active, accepted bool, err error)
	GetLiveLocation(orderID uuid.UUID) (*models.LiveLocationRow, error)
	DeleteLocationPointsBefore(cutoff time.Time) (int64, error)
	DeleteInactiveLiveLocations() (int64, error)
}

// CourierLocationService: the courier writes, the buyer who owns the order and
// Commerce Admin read. Sellers and Finance have no path to it.
type CourierLocationService struct {
	store  deliveryLocationStore
	routes *DeliveryRouteService
	now    func() time.Time
}

// SetRouteService adds the planned route and progress to every read, and
// reroutes a courier who leaves it.
func (s *CourierLocationService) SetRouteService(routes *DeliveryRouteService) { s.routes = routes }

// attachRoute never fails a position read: the map still shows the courier.
func (s *CourierLocationService) attachRoute(resp *models.CourierLocationResponse, withInstructions bool) *models.CourierLocationResponse {
	if s.routes != nil {
		if err := s.routes.AttachRoute(resp, withInstructions); err != nil {
			log.Printf("delivery route: attach %s failed: %v", resp.OrderID, err)
		}
	}
	return resp
}

func NewCourierLocationService(store deliveryLocationStore) *CourierLocationService {
	return &CourierLocationService{store: store, now: time.Now}
}

// LocationPointRetention is how long the thin history is kept.
const LocationPointRetention = 30 * 24 * time.Hour

// ReportLocation validates a point and stores it if this courier is carrying
// this order right now.
func (s *CourierLocationService) ReportLocation(courierUserID, orderID uuid.UUID, req *models.ReportLocationRequest) (*models.ReportLocationResult, error) {
	point, err := req.Normalize(s.now())
	if err != nil {
		return nil, &ErrInvalidLocation{Err: err}
	}
	active, accepted, err := s.store.RecordCourierLocation(orderID, courierUserID, point)
	if err != nil {
		return nil, err
	}
	if !active {
		return nil, ErrTrackingNotActive
	}
	if !accepted {
		return &models.ReportLocationResult{Accepted: false, Reason: "IGNORED_NOT_NEWER"}, nil
	}
	if s.routes != nil {
		go s.routes.MaybeReroute(orderID, maps.LngLat{point.Longitude, point.Latitude}, point.AccuracyM)
	}
	return &models.ReportLocationResult{Accepted: true}, nil
}

// GetForBuyer serves the position to the buyer who owns the order.
func (s *CourierLocationService) GetForBuyer(buyerProfileID, orderID uuid.UUID) (*models.CourierLocationResponse, error) {
	row, err := s.store.GetLiveLocation(orderID)
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, ErrLocationOrderNotFound
	}
	if row.BuyerProfileID == nil || *row.BuyerProfileID != buyerProfileID {
		return nil, ErrLocationForbidden
	}
	resp := row.ToCourierLocationResponse(s.now())
	// The buyer sees the route only while the parcel is on its way.
	if !resp.LiveTrackingActive {
		return resp, nil
	}
	return s.attachRoute(resp, false), nil
}

// GetForAdmin serves the position to Commerce Admin (the route enforces the role).
func (s *CourierLocationService) GetForAdmin(orderID uuid.UUID) (*models.CourierLocationResponse, error) {
	row, err := s.store.GetLiveLocation(orderID)
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, ErrLocationOrderNotFound
	}
	return s.attachRoute(row.ToCourierLocationResponse(s.now()), true), nil
}

// GetForCourier serves the assigned courier their own position, route and
// navigation instructions.
func (s *CourierLocationService) GetForCourier(courierUserID, orderID uuid.UUID) (*models.CourierLocationResponse, error) {
	if s.routes == nil {
		return nil, ErrLocationOrderNotFound
	}
	rc, err := s.routes.RouteContext(orderID)
	if err != nil {
		return nil, err
	}
	if rc == nil {
		return nil, ErrLocationOrderNotFound
	}
	if rc.AssignedCourierID == nil || *rc.AssignedCourierID != courierUserID {
		return nil, ErrLocationForbidden
	}
	row, err := s.store.GetLiveLocation(orderID)
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, ErrLocationOrderNotFound
	}
	return s.attachRoute(row.ToCourierLocationResponse(s.now()), true), nil
}

// RetentionResult reports one retention sweep.
type RetentionResult struct {
	PointsDeleted        int64
	LiveLocationsDeleted int64
}

// RunRetention drops history older than 30 days and any live position whose
// order is no longer in transit.
func (s *CourierLocationService) RunRetention() (RetentionResult, error) {
	var out RetentionResult
	var err error
	if out.PointsDeleted, err = s.store.DeleteLocationPointsBefore(s.now().Add(-LocationPointRetention)); err != nil {
		return out, err
	}
	out.LiveLocationsDeleted, err = s.store.DeleteInactiveLiveLocations()
	return out, err
}
