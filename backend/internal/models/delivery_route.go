package models

import (
	"time"

	"github.com/btmi-ai-market/backend/internal/maps"
	"github.com/google/uuid"
)

// Where a route point came from. A point is always confirmed on the map by
// whoever sets it; ADDRESS means "found by address search, then confirmed".
const (
	RoutePointGPS         = "GPS"
	RoutePointCoordinates = "COORDINATES"
	RoutePointAddress     = "ADDRESS"
	RoutePointMap         = "MAP"
	RoutePointReroute     = "REROUTE"
	RoutePointBuyerGPS    = "BUYER_GPS"
)

// RoutePointInput is one confirmed point sent by the courier or Commerce Admin.
type RoutePointInput struct {
	Latitude  *float64 `json:"latitude" binding:"required"`
	Longitude *float64 `json:"longitude" binding:"required"`
	Source    string   `json:"source" binding:"required"`
	Label     string   `json:"label"`
}

// SetRouteRequest asks for the road route between two confirmed points.
// Confirmed must be true: the client showed both points on the map first.
type SetRouteRequest struct {
	Start       RoutePointInput `json:"start" binding:"required"`
	Destination RoutePointInput `json:"destination" binding:"required"`
	Confirmed   bool            `json:"confirmed"`
}

// RoutePoint is a stored start or destination.
type RoutePoint struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Source    string  `json:"source"`
	Label     string  `json:"label"`
}

// StoredRoute is one delivery_routes row.
type StoredRoute struct {
	OrderID        uuid.UUID
	Start          RoutePoint
	Destination    RoutePoint
	TravelMode     string
	Geometry       []maps.LngLat
	LengthM        float64
	DurationS      float64
	Instructions   []maps.Instruction
	PlannedLengthM float64
	SetByUserID    *uuid.UUID
	SetByRole      string
	RerouteCount   int
	ComputedAt     time.Time
}

// RouteContext is what route planning needs from the order.
type RouteContext struct {
	OrderID           uuid.UUID
	DeliveryStatus    string
	AssignedCourierID *uuid.UUID
	BuyerProfileID    *uuid.UUID
	DeliveryLatitude  *float64
	DeliveryLongitude *float64
	DeliveryAddress   string
	TransportType     string
}

// NextInstruction is the next manoeuvre ahead of the courier.
type NextInstruction struct {
	Message  string  `json:"message"`
	Maneuver string  `json:"maneuver"`
	InM      float64 `json:"in_m"`
}

// DeliveryRouteView is the route as the three roles read it.
type DeliveryRouteView struct {
	Start           RoutePoint         `json:"start"`
	Destination     RoutePoint         `json:"destination"`
	TravelMode      string             `json:"travel_mode"`
	Geometry        []maps.LngLat      `json:"geometry"`
	Arrows          []maps.Arrow       `json:"arrows"`
	Trail           []maps.LngLat      `json:"trail"`
	RouteLengthM    float64            `json:"route_length_m"`
	PlannedLengthM  float64            `json:"planned_length_m"`
	TotalM          float64            `json:"total_m"`
	TravelledM      float64            `json:"travelled_m"`
	RemainingM      float64            `json:"remaining_m"`
	RemainingS      float64            `json:"remaining_s"`
	ETA             *time.Time         `json:"eta"`
	OffRoute        bool               `json:"off_route"`
	OffRouteM       float64            `json:"off_route_m"`
	RerouteCount    int                `json:"reroute_count"`
	ComputedAt      time.Time          `json:"computed_at"`
	NextInstruction *NextInstruction   `json:"next_instruction,omitempty"`
	Instructions    []maps.Instruction `json:"instructions,omitempty"`
}

// RoutePlanningStatuses are the delivery states in which a route may be set:
// from assignment until the courier arrives.
var RoutePlanningStatuses = map[string]bool{
	DeliveryStatusCourierAssigned: true,
	DeliveryStatusCourierAccepted: true,
	DeliveryStatusReadyForPickup:  true,
	DeliveryStatusPickedUp:        true,
	DeliveryStatusInTransit:       true,
}
