package models

import (
	"errors"
	"math"
	"time"

	"github.com/google/uuid"
)

// Live courier location. GPS is auxiliary to the delivery: it exists only while
// orders.delivery_status is one of LiveTrackingStatuses and never gates a
// delivery step.

// LiveTrackingStatuses: from the moment the courier accepts the mission (on
// the way to the shop) until they arrive at the buyer. The SQL guards in
// DeliveryLocationRepository and the orders_stop_live_location trigger
// (migration 113) list the same statuses.
var LiveTrackingStatuses = map[string]bool{
	DeliveryStatusCourierAccepted: true,
	DeliveryStatusReadyForPickup:  true,
	DeliveryStatusPickedUp:        true,
	DeliveryStatusInTransit:       true,
}

// LiveTrackingStatusesSQL is LiveTrackingStatuses as an SQL list.
const LiveTrackingStatusesSQL = `('COURIER_ACCEPTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT')`

const (
	// A point less accurate than this says nothing useful about the street.
	MaxLocationAccuracyM = 150.0
	// Device clocks drift; a point dated further ahead is refused.
	MaxLocationFutureSkew = time.Minute
	// A point older than this is history, not a live position (a phone that
	// was offline sends only its latest point, and not one this old).
	MaxLocationAge = 30 * time.Minute
	// Points arriving closer together than this after an accepted one are dropped.
	MinLocationInterval = 3 * time.Second

	// Freshness thresholds the buyer and Commerce Admin see.
	LocationLiveWithin   = 30 * time.Second
	LocationRecentWithin = 2 * time.Minute
)

const (
	LocationFreshnessLive        = "LIVE"
	LocationFreshnessRecent      = "RECENT"
	LocationFreshnessStale       = "STALE"
	LocationFreshnessUnavailable = "UNAVAILABLE"
)

var (
	ErrLocationLatitude  = errors.New("latitude must be between -90 and 90")
	ErrLocationLongitude = errors.New("longitude must be between -180 and 180")
	ErrLocationAccuracy  = errors.New("location accuracy is worse than 150 m")
	ErrLocationFuture    = errors.New("captured_at is in the future")
	ErrLocationTooOld    = errors.New("captured_at is too old to be a live position")
	ErrLocationNoTime    = errors.New("captured_at is required")
)

// ReportLocationRequest is one GPS point sent by the courier's phone.
// Optional values are pointers: Android reports unknown ones as -1 or NaN.
type ReportLocationRequest struct {
	Latitude   *float64  `json:"latitude" binding:"required"`
	Longitude  *float64  `json:"longitude" binding:"required"`
	Accuracy   *float64  `json:"accuracy"`
	Heading    *float64  `json:"heading"`
	Speed      *float64  `json:"speed"`
	CapturedAt time.Time `json:"captured_at"`
}

// LocationPoint is a validated, normalised point ready to be stored.
type LocationPoint struct {
	Latitude   float64
	Longitude  float64
	AccuracyM  *float64
	HeadingDeg *float64
	SpeedMps   *float64
	CapturedAt time.Time
}

// unknownToNil drops the values Android uses for "not measured": negative
// numbers, NaN and infinities.
func unknownToNil(v *float64) *float64 {
	if v == nil || math.IsNaN(*v) || math.IsInf(*v, 0) || *v < 0 {
		return nil
	}
	out := *v
	return &out
}

// Normalize validates the point against now (the server clock) and returns it
// ready to store, or the reason it is refused.
func (r *ReportLocationRequest) Normalize(now time.Time) (*LocationPoint, error) {
	if r.Latitude == nil || math.IsNaN(*r.Latitude) || *r.Latitude < -90 || *r.Latitude > 90 {
		return nil, ErrLocationLatitude
	}
	if r.Longitude == nil || math.IsNaN(*r.Longitude) || *r.Longitude < -180 || *r.Longitude > 180 {
		return nil, ErrLocationLongitude
	}
	if r.CapturedAt.IsZero() {
		return nil, ErrLocationNoTime
	}
	if r.CapturedAt.After(now.Add(MaxLocationFutureSkew)) {
		return nil, ErrLocationFuture
	}
	if r.CapturedAt.Before(now.Add(-MaxLocationAge)) {
		return nil, ErrLocationTooOld
	}
	accuracy := unknownToNil(r.Accuracy)
	if accuracy != nil && *accuracy > MaxLocationAccuracyM {
		return nil, ErrLocationAccuracy
	}
	heading := unknownToNil(r.Heading)
	if heading != nil {
		h := math.Mod(*heading, 360)
		heading = &h
	}
	return &LocationPoint{
		Latitude:   *r.Latitude,
		Longitude:  *r.Longitude,
		AccuracyM:  accuracy,
		HeadingDeg: heading,
		SpeedMps:   unknownToNil(r.Speed),
		CapturedAt: r.CapturedAt.UTC(),
	}, nil
}

// ValidDestination keeps a delivery point only as a complete, in-range pair
// (0,0 is the "no fix" placeholder of many clients, never an address in DRC).
func ValidDestination(lat, lng *float64) (*float64, *float64) {
	if lat == nil || lng == nil || math.IsNaN(*lat) || math.IsNaN(*lng) ||
		*lat < -90 || *lat > 90 || *lng < -180 || *lng > 180 || (*lat == 0 && *lng == 0) {
		return nil, nil
	}
	la, lo := *lat, *lng
	return &la, &lo
}

// ReportLocationResult tells the courier's phone whether the point was kept.
// An ignored point (too soon after the last one, or older than it) is not an
// error: the phone just carries on.
type ReportLocationResult struct {
	Accepted bool   `json:"accepted"`
	Reason   string `json:"reason,omitempty"`
}

// LiveLocationRow is the stored latest point with what the read side needs
// from the order.
type LiveLocationRow struct {
	OrderID           uuid.UUID
	DeliveryStatus    string
	BuyerProfileID    *uuid.UUID
	DeliveryLatitude  *float64
	DeliveryLongitude *float64
	DeliveryAddress   string
	HasPoint          bool
	Latitude          float64
	Longitude         float64
	AccuracyM         *float64
	HeadingDeg        *float64
	SpeedMps          *float64
	CapturedAt        time.Time
	ReceivedAt        time.Time
}

// CourierPosition is the courier's latest point. It never names the courier.
type CourierPosition struct {
	Latitude   float64   `json:"latitude"`
	Longitude  float64   `json:"longitude"`
	Accuracy   *float64  `json:"accuracy"`
	Heading    *float64  `json:"heading"`
	Speed      *float64  `json:"speed"`
	CapturedAt time.Time `json:"captured_at"`
	ReceivedAt time.Time `json:"received_at"`
}

// CourierLocationResponse is what the buyer and Commerce Admin read.
type CourierLocationResponse struct {
	OrderID            uuid.UUID        `json:"order_id"`
	DeliveryStatus     string           `json:"delivery_status"`
	LiveTrackingActive bool             `json:"live_tracking_active"`
	Available          bool             `json:"available"`
	Freshness          string           `json:"freshness"`
	IsStale            bool             `json:"is_stale"`
	AgeSeconds         *int             `json:"age_seconds"`
	Location           *CourierPosition `json:"location"`
	DeliveryLatitude   *float64         `json:"delivery_latitude"`
	DeliveryLongitude  *float64         `json:"delivery_longitude"`
	DeliveryAddress    string           `json:"delivery_address,omitempty"`
	// BuyerSharedPoint: the destination above is the buyer's own checkout
	// point (otherwise it was placed when the route was planned).
	BuyerSharedPoint bool `json:"buyer_shared_point"`
	// Route is the planned road route and the courier's progress, when planned.
	Route *DeliveryRouteView `json:"route,omitempty"`
}

// LocationFreshness classifies how old a point is.
func LocationFreshness(age time.Duration) string {
	switch {
	case age < LocationLiveWithin:
		return LocationFreshnessLive
	case age <= LocationRecentWithin:
		return LocationFreshnessRecent
	default:
		return LocationFreshnessStale
	}
}

// ToCourierLocationResponse exposes a position only while live tracking is
// active. Age is measured from when the point was taken, bounded by when the
// server received it, so a phone clock running ahead cannot make it look live.
func (row *LiveLocationRow) ToCourierLocationResponse(now time.Time) *CourierLocationResponse {
	resp := &CourierLocationResponse{
		OrderID:            row.OrderID,
		DeliveryStatus:     row.DeliveryStatus,
		LiveTrackingActive: LiveTrackingStatuses[row.DeliveryStatus],
		Freshness:          LocationFreshnessUnavailable,
		IsStale:            true,
		DeliveryLatitude:   row.DeliveryLatitude,
		DeliveryLongitude:  row.DeliveryLongitude,
		DeliveryAddress:    row.DeliveryAddress,
		BuyerSharedPoint:   row.DeliveryLatitude != nil && row.DeliveryLongitude != nil,
	}
	if !resp.LiveTrackingActive || !row.HasPoint {
		return resp
	}
	taken := row.CapturedAt
	if row.ReceivedAt.Before(taken) {
		taken = row.ReceivedAt
	}
	age := now.Sub(taken)
	if age < 0 {
		age = 0
	}
	seconds := int(age / time.Second)
	resp.Available = true
	resp.AgeSeconds = &seconds
	resp.Freshness = LocationFreshness(age)
	resp.IsStale = resp.Freshness == LocationFreshnessStale
	resp.Location = &CourierPosition{
		Latitude:   row.Latitude,
		Longitude:  row.Longitude,
		Accuracy:   row.AccuracyM,
		Heading:    row.HeadingDeg,
		Speed:      row.SpeedMps,
		CapturedAt: row.CapturedAt,
		ReceivedAt: row.ReceivedAt,
	}
	return resp
}
