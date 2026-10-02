package repository

import (
	"database/sql"
	"errors"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// DeliveryLocationRepository stores the courier's live position. It never
// writes to orders: pings would otherwise raise an order event each time.
type DeliveryLocationRepository struct {
	db *database.DB
}

func NewDeliveryLocationRepository(db *database.DB) *DeliveryLocationRepository {
	return &DeliveryLocationRepository{db: db}
}

// RecordCourierLocation stores a point in one statement whose every write is
// guarded by the order itself: it is the courier's assigned mission AND its
// delivery status is one of models.LiveTrackingStatuses (from acceptance to
// arrival), read under FOR SHARE so no status change can slip in between.
//
// active is false when that guard does not hold (tracking is not active for
// this courier on this order). accepted is false when the guard holds but the
// point is dropped: it is not newer than the stored one, or it came less than
// MinLocationInterval after it. An accepted point replaces the latest row and
// is appended to the history.
func (r *DeliveryLocationRepository) RecordCourierLocation(orderID, courierUserID uuid.UUID, p *models.LocationPoint) (active, accepted bool, err error) {
	err = r.db.QueryRow(`
		WITH mission AS (
			SELECT id FROM orders
			WHERE id = $1 AND assigned_courier_id = $2 AND delivery_status IN `+models.LiveTrackingStatusesSQL+`
			FOR SHARE
		),
		latest AS (
			INSERT INTO delivery_live_locations AS cur
				(order_id, courier_user_id, latitude, longitude, accuracy_m, heading_deg, speed_mps, captured_at, received_at)
			SELECT mission.id, $2, $3, $4, $5, $6, $7, $8, NOW() FROM mission
			ON CONFLICT (order_id) DO UPDATE SET
				courier_user_id = EXCLUDED.courier_user_id,
				latitude = EXCLUDED.latitude,
				longitude = EXCLUDED.longitude,
				accuracy_m = EXCLUDED.accuracy_m,
				heading_deg = EXCLUDED.heading_deg,
				speed_mps = EXCLUDED.speed_mps,
				captured_at = EXCLUDED.captured_at,
				received_at = EXCLUDED.received_at
			WHERE cur.courier_user_id <> EXCLUDED.courier_user_id
			   OR (EXCLUDED.captured_at > cur.captured_at
			       AND EXCLUDED.received_at >= cur.received_at + make_interval(secs => $9))
			RETURNING order_id, courier_user_id, latitude, longitude, accuracy_m, heading_deg, speed_mps, captured_at, received_at
		),
		history AS (
			INSERT INTO delivery_location_points
				(order_id, courier_user_id, latitude, longitude, accuracy_m, heading_deg, speed_mps, captured_at, received_at)
			SELECT order_id, courier_user_id, latitude, longitude, accuracy_m, heading_deg, speed_mps, captured_at, received_at FROM latest
			RETURNING id
		)
		SELECT EXISTS (SELECT 1 FROM mission), EXISTS (SELECT 1 FROM history)`,
		orderID, courierUserID, p.Latitude, p.Longitude, p.AccuracyM, p.HeadingDeg, p.SpeedMps, p.CapturedAt,
		models.MinLocationInterval.Seconds(),
	).Scan(&active, &accepted)
	return active, accepted, err
}

// GetLiveLocation reads the order's delivery state, destination and latest
// point. The point is joined only while live tracking is active, so a row
// left behind by any path can never be served.
func (r *DeliveryLocationRepository) GetLiveLocation(orderID uuid.UUID) (*models.LiveLocationRow, error) {
	var (
		row                         models.LiveLocationRow
		status, address             sql.NullString
		buyerProfileID              uuid.NullUUID
		destLat, destLng            sql.NullFloat64
		lat, lng, acc, heading, spd sql.NullFloat64
		capturedAt, receivedAt      sql.NullTime
	)
	err := r.db.QueryRow(`
		SELECT o.id, o.delivery_status, o.buyer_profile_id, o.delivery_latitude, o.delivery_longitude, o.delivery_address,
		       l.latitude, l.longitude, l.accuracy_m, l.heading_deg, l.speed_mps, l.captured_at, l.received_at
		FROM orders o
		LEFT JOIN delivery_live_locations l ON l.order_id = o.id AND o.delivery_status IN `+models.LiveTrackingStatusesSQL+`
		WHERE o.id = $1`, orderID).
		Scan(&row.OrderID, &status, &buyerProfileID, &destLat, &destLng, &address,
			&lat, &lng, &acc, &heading, &spd, &capturedAt, &receivedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	row.DeliveryStatus = status.String
	row.DeliveryAddress = address.String
	if buyerProfileID.Valid {
		id := buyerProfileID.UUID
		row.BuyerProfileID = &id
	}
	row.DeliveryLatitude = nullFloat(destLat)
	row.DeliveryLongitude = nullFloat(destLng)
	if lat.Valid && lng.Valid && capturedAt.Valid {
		row.HasPoint = true
		row.Latitude, row.Longitude = lat.Float64, lng.Float64
		row.AccuracyM, row.HeadingDeg, row.SpeedMps = nullFloat(acc), nullFloat(heading), nullFloat(spd)
		row.CapturedAt, row.ReceivedAt = capturedAt.Time, receivedAt.Time
	}
	return &row, nil
}

// DeleteLocationPointsBefore drops history older than the cutoff.
func (r *DeliveryLocationRepository) DeleteLocationPointsBefore(cutoff time.Time) (int64, error) {
	res, err := r.db.Exec(`DELETE FROM delivery_location_points WHERE received_at < $1`, cutoff)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// DeleteInactiveLiveLocations is the safety sweep behind the orders trigger:
// no live position may outlive its order's live-tracking statuses.
func (r *DeliveryLocationRepository) DeleteInactiveLiveLocations() (int64, error) {
	res, err := r.db.Exec(`
		DELETE FROM delivery_live_locations l
		USING orders o
		WHERE o.id = l.order_id AND (o.delivery_status IS NULL OR o.delivery_status NOT IN ` + models.LiveTrackingStatusesSQL + `)`)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func nullFloat(v sql.NullFloat64) *float64 {
	if !v.Valid {
		return nil
	}
	f := v.Float64
	return &f
}
