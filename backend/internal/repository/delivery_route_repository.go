package repository

import (
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/maps"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// DeliveryRouteRepository stores the planned road route of a delivery. Like
// the live position, it never writes to orders.
type DeliveryRouteRepository struct {
	db *database.DB
}

func NewDeliveryRouteRepository(db *database.DB) *DeliveryRouteRepository {
	return &DeliveryRouteRepository{db: db}
}

// GetRouteContext reads what route planning needs from the order and its
// assigned courier. nil when the order does not exist.
func (r *DeliveryRouteRepository) GetRouteContext(orderID uuid.UUID) (*models.RouteContext, error) {
	var (
		ctx                    models.RouteContext
		status, address, trans sql.NullString
		courierID, buyerID     uuid.NullUUID
		lat, lng               sql.NullFloat64
	)
	err := r.db.QueryRow(`
		SELECT o.id, o.delivery_status, o.assigned_courier_id, o.buyer_profile_id,
		       o.delivery_latitude, o.delivery_longitude, o.delivery_address, c.transport_type
		FROM orders o
		LEFT JOIN couriers c ON c.user_id = o.assigned_courier_id
		WHERE o.id = $1`, orderID).
		Scan(&ctx.OrderID, &status, &courierID, &buyerID, &lat, &lng, &address, &trans)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	ctx.DeliveryStatus, ctx.DeliveryAddress, ctx.TransportType = status.String, address.String, trans.String
	if courierID.Valid {
		id := courierID.UUID
		ctx.AssignedCourierID = &id
	}
	if buyerID.Valid {
		id := buyerID.UUID
		ctx.BuyerProfileID = &id
	}
	ctx.DeliveryLatitude, ctx.DeliveryLongitude = models.ValidDestination(nullFloat(lat), nullFloat(lng))
	return &ctx, nil
}

// GetRoute reads the order's route, nil when none was planned.
func (r *DeliveryRouteRepository) GetRoute(orderID uuid.UUID) (*models.StoredRoute, error) {
	var (
		rt                     models.StoredRoute
		geometry, instructions []byte
		setBy                  uuid.NullUUID
	)
	err := r.db.QueryRow(`
		SELECT order_id, start_latitude, start_longitude, start_source, start_label,
		       dest_latitude, dest_longitude, dest_source, dest_label, travel_mode,
		       geometry, length_m, duration_s, instructions, planned_length_m,
		       set_by_user_id, set_by_role, reroute_count, computed_at
		FROM delivery_routes WHERE order_id = $1`, orderID).
		Scan(&rt.OrderID, &rt.Start.Latitude, &rt.Start.Longitude, &rt.Start.Source, &rt.Start.Label,
			&rt.Destination.Latitude, &rt.Destination.Longitude, &rt.Destination.Source, &rt.Destination.Label, &rt.TravelMode,
			&geometry, &rt.LengthM, &rt.DurationS, &instructions, &rt.PlannedLengthM,
			&setBy, &rt.SetByRole, &rt.RerouteCount, &rt.ComputedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if setBy.Valid {
		id := setBy.UUID
		rt.SetByUserID = &id
	}
	if err := json.Unmarshal(geometry, &rt.Geometry); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(instructions, &rt.Instructions); err != nil {
		return nil, err
	}
	return &rt, nil
}

// SaveRoute inserts or replaces the order's route.
func (r *DeliveryRouteRepository) SaveRoute(rt *models.StoredRoute) error {
	geometry, err := json.Marshal(rt.Geometry)
	if err != nil {
		return err
	}
	instructions, err := json.Marshal(rt.Instructions)
	if err != nil {
		return err
	}
	_, err = r.db.Exec(`
		INSERT INTO delivery_routes
			(order_id, start_latitude, start_longitude, start_source, start_label,
			 dest_latitude, dest_longitude, dest_source, dest_label, travel_mode,
			 geometry, length_m, duration_s, instructions, planned_length_m,
			 set_by_user_id, set_by_role, reroute_count, computed_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW())
		ON CONFLICT (order_id) DO UPDATE SET
			start_latitude = EXCLUDED.start_latitude, start_longitude = EXCLUDED.start_longitude,
			start_source = EXCLUDED.start_source, start_label = EXCLUDED.start_label,
			dest_latitude = EXCLUDED.dest_latitude, dest_longitude = EXCLUDED.dest_longitude,
			dest_source = EXCLUDED.dest_source, dest_label = EXCLUDED.dest_label,
			travel_mode = EXCLUDED.travel_mode, geometry = EXCLUDED.geometry,
			length_m = EXCLUDED.length_m, duration_s = EXCLUDED.duration_s,
			instructions = EXCLUDED.instructions, planned_length_m = EXCLUDED.planned_length_m,
			set_by_user_id = EXCLUDED.set_by_user_id, set_by_role = EXCLUDED.set_by_role,
			reroute_count = EXCLUDED.reroute_count, computed_at = NOW()`,
		rt.OrderID, rt.Start.Latitude, rt.Start.Longitude, rt.Start.Source, rt.Start.Label,
		rt.Destination.Latitude, rt.Destination.Longitude, rt.Destination.Source, rt.Destination.Label, rt.TravelMode,
		geometry, rt.LengthM, rt.DurationS, instructions, rt.PlannedLengthM,
		rt.SetByUserID, rt.SetByRole, rt.RerouteCount)
	return err
}

// Trail returns the courier's recorded points for the order, oldest first.
func (r *DeliveryRouteRepository) Trail(orderID uuid.UUID) ([]maps.LngLat, error) {
	rows, err := r.db.Query(`
		SELECT longitude, latitude FROM delivery_location_points
		WHERE order_id = $1 ORDER BY captured_at`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []maps.LngLat
	for rows.Next() {
		var p maps.LngLat
		if err := rows.Scan(&p[0], &p[1]); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
