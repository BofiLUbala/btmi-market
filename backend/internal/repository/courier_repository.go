package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type CourierRepository struct {
	db *database.DB
}

func NewCourierRepository(db *database.DB) *CourierRepository {
	return &CourierRepository{db: db}
}

// Create creates a new courier profile
func (r *CourierRepository) Create(courier *models.Courier) error {
	_, err := r.db.Exec(`
		INSERT INTO couriers (id, user_id, status, availability, transport_type, vehicle_info, service_zone)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		courier.ID, courier.UserID, courier.Status, courier.Availability,
		courier.TransportType, courier.VehicleInfo, courier.ServiceZone)
	return err
}

// GetByID retrieves a courier by ID
func (r *CourierRepository) GetByID(id uuid.UUID) (*models.Courier, error) {
	var courier models.Courier
	err := r.db.QueryRow(`
		SELECT id, user_id, status, availability, transport_type, vehicle_info, service_zone,
		       activated_at, suspended_at, suspension_reason, created_at, updated_at
		FROM couriers WHERE id = $1`, id).Scan(
		&courier.ID, &courier.UserID, &courier.Status, &courier.Availability,
		&courier.TransportType, &courier.VehicleInfo, &courier.ServiceZone,
		&courier.ActivatedAt, &courier.SuspendedAt, &courier.SuspensionReason,
		&courier.CreatedAt, &courier.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &courier, nil
}

// GetByUserID retrieves a courier by user ID
func (r *CourierRepository) GetByUserID(userID uuid.UUID) (*models.Courier, error) {
	var courier models.Courier
	err := r.db.QueryRow(`
		SELECT id, user_id, status, availability, transport_type, vehicle_info, service_zone,
		       activated_at, suspended_at, suspension_reason, created_at, updated_at
		FROM couriers WHERE user_id = $1`, userID).Scan(
		&courier.ID, &courier.UserID, &courier.Status, &courier.Availability,
		&courier.TransportType, &courier.VehicleInfo, &courier.ServiceZone,
		&courier.ActivatedAt, &courier.SuspendedAt, &courier.SuspensionReason,
		&courier.CreatedAt, &courier.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &courier, nil
}

// UpdateStatus updates a courier's status
func (r *CourierRepository) UpdateStatus(id uuid.UUID, status models.CourierStatus) error {
	now := time.Now()
	query := `UPDATE couriers SET status = $2, updated_at = $3`
	args := []interface{}{id, status, now}

	if status == models.CourierStatusActive {
		query += `, activated_at = COALESCE(activated_at, $3)`
	} else if status == models.CourierStatusSuspended {
		query += `, suspended_at = $3`
	}

	query += ` WHERE id = $1`
	_, err := r.db.Exec(query, args...)
	return err
}

// UpdateAvailability updates a courier's availability
func (r *CourierRepository) UpdateAvailability(id uuid.UUID, availability models.CourierAvailability) error {
	_, err := r.db.Exec(`UPDATE couriers SET availability = $2, updated_at = NOW() WHERE id = $1`, id, availability)
	return err
}

// Suspend suspends a courier with a reason
func (r *CourierRepository) Suspend(id uuid.UUID, reason string) error {
	now := time.Now()
	_, err := r.db.Exec(`UPDATE couriers SET status = 'SUSPENDED', suspended_at = $2, suspension_reason = $3, updated_at = NOW() WHERE id = $1`, id, now, reason)
	return err
}

// Reactivate reactivates a suspended courier
func (r *CourierRepository) Reactivate(id uuid.UUID) error {
	_, err := r.db.Exec(`UPDATE couriers SET status = 'ACTIVE', suspended_at = NULL, suspension_reason = NULL, updated_at = NOW() WHERE id = $1`, id)
	return err
}

// ListActive returns all active couriers
func (r *CourierRepository) ListActive() ([]*models.Courier, error) {
	rows, err := r.db.Query(`
		SELECT id, user_id, status, availability, transport_type, vehicle_info, service_zone,
		       activated_at, suspended_at, suspension_reason, created_at, updated_at
		FROM couriers WHERE status = 'ACTIVE' ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var couriers []*models.Courier
	for rows.Next() {
		var c models.Courier
		if err := rows.Scan(&c.ID, &c.UserID, &c.Status, &c.Availability,
			&c.TransportType, &c.VehicleInfo, &c.ServiceZone,
			&c.ActivatedAt, &c.SuspendedAt, &c.SuspensionReason,
			&c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		couriers = append(couriers, &c)
	}
	return couriers, rows.Err()
}

// ListAll returns all couriers
func (r *CourierRepository) ListAll(limit, offset int) ([]*models.Courier, error) {
	rows, err := r.db.Query(`
		SELECT id, user_id, status, availability, transport_type, vehicle_info, service_zone,
		       activated_at, suspended_at, suspension_reason, created_at, updated_at
		FROM couriers ORDER BY created_at DESC LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var couriers []*models.Courier
	for rows.Next() {
		var c models.Courier
		if err := rows.Scan(&c.ID, &c.UserID, &c.Status, &c.Availability,
			&c.TransportType, &c.VehicleInfo, &c.ServiceZone,
			&c.ActivatedAt, &c.SuspendedAt, &c.SuspensionReason,
			&c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		couriers = append(couriers, &c)
	}
	return couriers, rows.Err()
}

// ListAvailableCouriers returns couriers that are ACTIVE and AVAILABLE
func (r *CourierRepository) ListAvailableCouriers() ([]*models.Courier, error) {
	rows, err := r.db.Query(`
		SELECT id, user_id, status, availability, transport_type, vehicle_info, service_zone,
		       activated_at, suspended_at, suspension_reason, created_at, updated_at
		FROM couriers WHERE status = 'ACTIVE' AND availability = 'AVAILABLE' ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var couriers []*models.Courier
	for rows.Next() {
		var c models.Courier
		if err := rows.Scan(&c.ID, &c.UserID, &c.Status, &c.Availability,
			&c.TransportType, &c.VehicleInfo, &c.ServiceZone,
			&c.ActivatedAt, &c.SuspendedAt, &c.SuspensionReason,
			&c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		couriers = append(couriers, &c)
	}
	return couriers, rows.Err()
}

// CountActiveMissions returns the number of active missions for a courier
func (r *CourierRepository) CountActiveMissions(courierUserID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(`
		SELECT COUNT(*) FROM orders 
		WHERE assigned_courier_id = $1 
		AND delivery_status IN ('COURIER_ASSIGNED', 'COURIER_ACCEPTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION')
		AND status NOT IN ('CANCELLED', 'RECEIVED', 'COMPLETED')`, courierUserID).Scan(&count)
	return count, err
}

// CountTodayDeliveries returns the number of deliveries today for a courier
func (r *CourierRepository) CountTodayDeliveries(courierUserID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(`
		SELECT COUNT(*) FROM orders 
		WHERE assigned_courier_id = $1 
		AND delivery_status = 'RECEIVED'
		AND DATE(created_at) = CURRENT_DATE`, courierUserID).Scan(&count)
	return count, err
}

// CountTodayFailed returns the number of failed deliveries today for a courier
func (r *CourierRepository) CountTodayFailed(courierUserID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(`
		SELECT COUNT(*) FROM orders 
		WHERE assigned_courier_id = $1 
		AND failed_delivery_reason IS NOT NULL
		AND DATE(created_at) = CURRENT_DATE`, courierUserID).Scan(&count)
	return count, err
}

// CountTotalDeliveries returns the total number of completed deliveries for a courier
func (r *CourierRepository) CountTotalDeliveries(courierUserID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(`
		SELECT COUNT(*) FROM orders 
		WHERE assigned_courier_id = $1 
		AND delivery_status = 'RECEIVED'`, courierUserID).Scan(&count)
	return count, err
}

// GetMissions returns all missions for a courier
func (r *CourierRepository) GetMissions(courierUserID uuid.UUID) ([]*models.CourierMissionResponse, error) {
	rows, err := r.db.Query(`
		SELECT o.id, o.order_number, o.status, o.delivery_status,
		       s.name AS shop_name, b.name, COALESCE(s.address,''), COALESCE(c.service_zone,''),
		       (SELECT COUNT(*) FROM delivery_packages dp WHERE dp.order_id=o.id), o.delivery_address, o.delivery_contact_name, o.delivery_phone,
		       COALESCE(o.delivery_notes,''),
		       o.final_total, o.courier_assigned_at, o.courier_accepted_at, 
		       o.ready_at, dp.pickup_verified_at, o.courier_started_at, o.courier_arrived_at, o.delivered_at
		FROM orders o
		JOIN shops s ON s.id = o.shop_id
		JOIN businesses b ON b.id = o.business_id
		JOIN couriers c ON c.user_id = o.assigned_courier_id
		LEFT JOIN LATERAL (SELECT pickup_verified_at FROM delivery_packages WHERE order_id=o.id ORDER BY package_number LIMIT 1) dp ON TRUE
		WHERE o.assigned_courier_id = $1
		AND o.status NOT IN ('CANCELLED')
		ORDER BY o.courier_assigned_at DESC`, courierUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var missions []*models.CourierMissionResponse
	for rows.Next() {
		var m models.CourierMissionResponse
		if err := rows.Scan(&m.OrderID, &m.OrderNumber, &m.Status, &m.DeliveryStatus,
			&m.ShopName, &m.BusinessName, &m.ShopAddress, &m.ServiceZone, &m.PackageCount, &m.DeliveryAddress, &m.DeliveryContact, &m.DeliveryPhone, &m.DeliveryNotes,
			&m.TotalAmount, &m.AssignedAt, &m.AcceptedAt, &m.ReadyAt, &m.PickedUpAt,
			&m.StartedAt, &m.ArrivedAt, &m.DeliveredAt); err != nil {
			return nil, err
		}
		missions = append(missions, &m)
	}
	return missions, rows.Err()
}

// GetMissionByID returns a single mission for a courier
func (r *CourierRepository) GetMissionByID(courierUserID, orderID uuid.UUID) (*models.CourierMissionResponse, error) {
	var m models.CourierMissionResponse
	err := r.db.QueryRow(`
		SELECT o.id, o.order_number, o.status, o.delivery_status,
		       s.name AS shop_name, b.name, COALESCE(s.address,''), COALESCE(c.service_zone,''),
		       (SELECT COUNT(*) FROM delivery_packages dp2 WHERE dp2.order_id=o.id), o.delivery_address, o.delivery_contact_name, o.delivery_phone,
		       COALESCE(o.delivery_notes,''),
		       o.final_total, o.courier_assigned_at, o.courier_accepted_at,
		       o.ready_at, dp.pickup_verified_at, o.courier_started_at, o.courier_arrived_at, o.delivered_at
		FROM orders o
		JOIN shops s ON s.id = o.shop_id
		JOIN businesses b ON b.id = o.business_id
		JOIN couriers c ON c.user_id = o.assigned_courier_id
		LEFT JOIN LATERAL (SELECT pickup_verified_at FROM delivery_packages WHERE order_id=o.id ORDER BY package_number LIMIT 1) dp ON TRUE
		WHERE o.assigned_courier_id = $1 AND o.id = $2`, courierUserID, orderID).Scan(
		&m.OrderID, &m.OrderNumber, &m.Status, &m.DeliveryStatus,
		&m.ShopName, &m.BusinessName, &m.ShopAddress, &m.ServiceZone, &m.PackageCount, &m.DeliveryAddress, &m.DeliveryContact, &m.DeliveryPhone, &m.DeliveryNotes,
		&m.TotalAmount, &m.AssignedAt, &m.AcceptedAt, &m.ReadyAt, &m.PickedUpAt,
		&m.StartedAt, &m.ArrivedAt, &m.DeliveredAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// GetHistory returns delivery history for a courier
func (r *CourierRepository) GetHistory(courierUserID uuid.UUID, limit, offset int) ([]*models.CourierHistoryResponse, error) {
	rows, err := r.db.Query(`
		SELECT o.id, o.order_number, s.name AS shop_name, o.delivery_address,
		       o.courier_assigned_at, o.delivered_at, o.status,
		       COALESCE(o.failed_delivery_reason, '') AS incident_status
		FROM orders o
		JOIN shops s ON s.id = o.shop_id
		WHERE o.assigned_courier_id = $1
		AND o.status IN ('RECEIVED', 'COMPLETED', 'CANCELLED')
		ORDER BY o.delivered_at DESC NULLS LAST
		LIMIT $2 OFFSET $3`, courierUserID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []*models.CourierHistoryResponse
	for rows.Next() {
		var h models.CourierHistoryResponse
		if err := rows.Scan(&h.OrderID, &h.OrderNumber, &h.ShopName, &h.DeliveryAddress,
			&h.AssignedAt, &h.DeliveredAt, &h.FinalStatus, &h.IncidentStatus); err != nil {
			return nil, err
		}
		history = append(history, &h)
	}
	return history, rows.Err()
}

// InvitationCreate creates a new courier invitation
func (r *CourierRepository) InvitationCreate(inv *models.CourierInvitation) error {
	_, err := r.db.Exec(`
		INSERT INTO courier_invitations (id, email, first_name, last_name, phone, transport_type, vehicle_info, service_zone, token_hash, status, expires_at, invited_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		inv.ID, inv.Email, inv.FirstName, inv.LastName, inv.Phone, inv.TransportType,
		inv.VehicleInfo, inv.ServiceZone, inv.TokenHash, inv.Status, inv.ExpiresAt, inv.InvitedBy)
	return err
}

// InvitationGetByTokenHash retrieves an invitation by token hash
func (r *CourierRepository) InvitationGetByTokenHash(tokenHash string) (*models.CourierInvitation, error) {
	var inv models.CourierInvitation
	err := r.db.QueryRow(`
		SELECT id, email, first_name, last_name, phone, transport_type, vehicle_info, service_zone,
		       token_hash, status, expires_at, accepted_at, invited_by, created_at
		FROM courier_invitations WHERE token_hash = $1`, tokenHash).Scan(
		&inv.ID, &inv.Email, &inv.FirstName, &inv.LastName, &inv.Phone, &inv.TransportType,
		&inv.VehicleInfo, &inv.ServiceZone, &inv.TokenHash, &inv.Status,
		&inv.ExpiresAt, &inv.AcceptedAt, &inv.InvitedBy, &inv.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

// InvitationUpdateStatus updates the status of an invitation
func (r *CourierRepository) InvitationUpdateStatus(id uuid.UUID, status string) error {
	query := `UPDATE courier_invitations SET status = $2`
	args := []interface{}{id, status}
	if status == "ACCEPTED" {
		query += `, accepted_at = NOW()`
	}
	query += ` WHERE id = $1`
	_, err := r.db.Exec(query, args...)
	return err
}

// ListPendingInvitations returns all pending invitations
func (r *CourierRepository) ListPendingInvitations() ([]*models.CourierInvitation, error) {
	rows, err := r.db.Query(`
		SELECT id, email, first_name, last_name, phone, transport_type, vehicle_info, service_zone,
		       token_hash, status, expires_at, accepted_at, invited_by, created_at
		FROM courier_invitations WHERE status = 'PENDING' AND expires_at > NOW()
		ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invs []*models.CourierInvitation
	for rows.Next() {
		var inv models.CourierInvitation
		if err := rows.Scan(&inv.ID, &inv.Email, &inv.FirstName, &inv.LastName, &inv.Phone, &inv.TransportType,
			&inv.VehicleInfo, &inv.ServiceZone, &inv.TokenHash, &inv.Status,
			&inv.ExpiresAt, &inv.AcceptedAt, &inv.InvitedBy, &inv.CreatedAt); err != nil {
			return nil, err
		}
		invs = append(invs, &inv)
	}
	return invs, rows.Err()
}

// GetOrderByIDForCourier retrieves an order for a specific courier
func (r *CourierRepository) GetOrderByIDForCourier(courierUserID, orderID uuid.UUID) (*models.Order, error) {
	var o models.Order
	err := r.db.QueryRow(`
		SELECT id, business_id, shop_id, customer_id, buyer_profile_id, status, total_items, notes,
		       created_by, base_total, points_used, points_discount_amount, final_total,
		       idempotency_key, order_number, delivery_method, delivery_fee_base,
		       delivery_points_used, delivery_points_discount, delivery_fee_final,
		       delivery_contact_name, delivery_phone, delivery_address, delivery_notes,
		       delivery_status, assigned_courier_id, delivery_latitude, delivery_longitude,
		       courier_assigned_at, courier_notes, points_finalized, inventory_claimed,
		       accepted_at, preparing_at, ready_at, out_for_delivery_at, delivered_at,
		       received_at, completed_at, created_at, updated_at
		FROM orders WHERE assigned_courier_id = $1 AND id = $2`, courierUserID, orderID).Scan(
		&o.ID, &o.BusinessID, &o.ShopID, &o.CustomerID, &o.BuyerProfileID, &o.Status, &o.TotalItems, &o.Notes,
		&o.CreatedBy, &o.BaseTotal, &o.PointsUsed, &o.PointsDiscountAmount, &o.FinalTotal,
		&o.IdempotencyKey, &o.OrderNumber, &o.DeliveryMethod, &o.DeliveryFeeBase,
		&o.DeliveryPointsUsed, &o.DeliveryPointsDiscount, &o.DeliveryFeeFinal,
		&o.DeliveryContactName, &o.DeliveryPhone, &o.DeliveryAddress, &o.DeliveryNotes,
		&o.DeliveryStatus, &o.AssignedCourierID, &o.DeliveryLatitude, &o.DeliveryLongitude,
		&o.CourierAssignedAt, &o.CourierNotes, &o.PointsFinalized, &o.InventoryClaimed,
		&o.AcceptedAt, &o.PreparingAt, &o.ReadyAt, &o.OutForDeliveryAt, &o.DeliveredAt,
		&o.ReceivedAt, &o.CompletedAt, &o.CreatedAt, &o.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &o, nil
}

// UpdateMissionStatus updates mission status fields on orders
func (r *CourierRepository) UpdateMissionStatus(orderID uuid.UUID, field string, value interface{}) error {
	validFields := map[string]bool{
		"courier_accepted_at":      true,
		"courier_rejected_at":      true,
		"courier_rejection_reason": true,
		"courier_started_at":       true,
		"courier_arrived_at":       true,
		"failed_delivery_reason":   true,
		"failed_delivery_notes":    true,
		"delivery_status":          true,
		"assigned_courier_id":      true,
	}
	if !validFields[field] {
		return fmt.Errorf("invalid field: %s", field)
	}
	_, err := r.db.Exec(fmt.Sprintf(`UPDATE orders SET %s = $2, updated_at = NOW() WHERE id = $1`, field), orderID, value)
	return err
}
