package models

import (
	"time"

	"github.com/google/uuid"
)

type CourierStatus string

const (
	CourierStatusPending   CourierStatus = "PENDING"
	CourierStatusActive    CourierStatus = "ACTIVE"
	CourierStatusSuspended CourierStatus = "SUSPENDED"
	CourierStatusDisabled  CourierStatus = "DISABLED"
)

type CourierAvailability string

const (
	CourierAvailabilityAvailable CourierAvailability = "AVAILABLE"
	CourierAvailabilityUnavailable CourierAvailability = "UNAVAILABLE"
	CourierAvailabilityBusy       CourierAvailability = "BUSY"
)

type Courier struct {
	ID                uuid.UUID            `json:"id" db:"id"`
	UserID            uuid.UUID            `json:"user_id" db:"user_id"`
	Status            CourierStatus        `json:"status" db:"status"`
	Availability      CourierAvailability  `json:"availability" db:"availability"`
	TransportType     string               `json:"transport_type" db:"transport_type"`
	VehicleInfo       *string              `json:"vehicle_info" db:"vehicle_info"`
	ServiceZone       *string              `json:"service_zone" db:"service_zone"`
	ActivatedAt       *time.Time           `json:"activated_at" db:"activated_at"`
	SuspendedAt       *time.Time           `json:"suspended_at" db:"suspended_at"`
	SuspensionReason  *string              `json:"suspension_reason" db:"suspension_reason"`
	CreatedAt         time.Time            `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time            `json:"updated_at" db:"updated_at"`
}

type CourierInvitation struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	Email         string     `json:"email" db:"email"`
	FirstName     string     `json:"first_name" db:"first_name"`
	LastName      string     `json:"last_name" db:"last_name"`
	Phone         *string    `json:"phone" db:"phone"`
	TransportType *string    `json:"transport_type" db:"transport_type"`
	VehicleInfo   *string    `json:"vehicle_info" db:"vehicle_info"`
	ServiceZone   *string    `json:"service_zone" db:"service_zone"`
	TokenHash     string     `json:"-" db:"token_hash"`
	Status        string     `json:"status" db:"status"`
	ExpiresAt     time.Time  `json:"expires_at" db:"expires_at"`
	AcceptedAt    *time.Time `json:"accepted_at" db:"accepted_at"`
	InvitedBy     *uuid.UUID `json:"invited_by" db:"invited_by"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
}

// CourierResponse is the safe API response for a courier
type CourierResponse struct {
	ID               uuid.UUID           `json:"id"`
	UserID           uuid.UUID           `json:"user_id"`
	FirstName        string              `json:"first_name"`
	LastName         string              `json:"last_name"`
	Email            string              `json:"email"`
	Phone            string              `json:"phone"`
	Status           CourierStatus       `json:"status"`
	Availability     CourierAvailability `json:"availability"`
	TransportType    string              `json:"transport_type"`
	VehicleInfo      *string             `json:"vehicle_info"`
	ServiceZone      *string             `json:"service_zone"`
	ActiveMissions   int                 `json:"active_missions"`
	CompletedToday   int                 `json:"completed_today"`
	TotalDeliveries  int                 `json:"total_deliveries"`
	ActivatedAt      *time.Time          `json:"activated_at"`
	SuspendedAt      *time.Time          `json:"suspended_at"`
	SuspensionReason *string             `json:"suspension_reason"`
	CreatedAt        time.Time           `json:"created_at"`
	UpdatedAt        time.Time           `json:"updated_at"`
}

// InviteCourierRequest is the request body for inviting a courier
type InviteCourierRequest struct {
	FirstName     string `json:"first_name" binding:"required"`
	LastName      string `json:"last_name" binding:"required"`
	Email         string `json:"email" binding:"required,email"`
	Phone         string `json:"phone"`
	TransportType string `json:"transport_type"`
	VehicleInfo   string `json:"vehicle_info"`
	ServiceZone   string `json:"service_zone"`
}

// AcceptCourierInvitationRequest is the request body for accepting an invitation
type AcceptCourierInvitationRequest struct {
	Token                string `json:"token" binding:"required"`
	Password             string `json:"password" binding:"required,min=8,max=64"`
	PasswordConfirmation string `json:"password_confirmation" binding:"required"`
}

// UpdateCourierAvailabilityRequest is the request body for updating availability
type UpdateCourierAvailabilityRequest struct {
	Availability CourierAvailability `json:"availability" binding:"required"`
}

// AcceptMissionRequest is the request body for accepting a mission
type AcceptMissionRequest struct {
	OrderID string `json:"order_id" binding:"required"`
}

// RejectMissionRequest is the request body for rejecting a mission
type RejectMissionRequest struct {
	OrderID string `json:"order_id" binding:"required"`
	Reason  string `json:"reason" binding:"required"`
}

// FailDeliveryRequest is the request body for failing a delivery
type FailDeliveryRequest struct {
	OrderID string `json:"order_id" binding:"required"`
	Reason  string `json:"reason" binding:"required"`
	Notes   string `json:"notes"`
}

// CourierMissionResponse is a single mission in the courier's list
type CourierMissionResponse struct {
	OrderID         uuid.UUID  `json:"order_id"`
	OrderNumber     string     `json:"order_number"`
	Status          string     `json:"status"`
	DeliveryStatus  string     `json:"delivery_status"`
	ShopName        string     `json:"shop_name"`
	ShopAddress     string     `json:"shop_address"`
	DeliveryAddress string     `json:"delivery_address"`
	DeliveryContact string     `json:"delivery_contact"`
	DeliveryPhone   string     `json:"delivery_phone"`
	TotalAmount     float64    `json:"total_amount"`
	AssignedAt      *time.Time `json:"assigned_at"`
	AcceptedAt      *time.Time `json:"accepted_at"`
	StartedAt       *time.Time `json:"started_at"`
	ArrivedAt       *time.Time `json:"arrived_at"`
	DeliveredAt     *time.Time `json:"delivered_at"`
}

// CourierDashboardResponse contains overview stats for the courier dashboard
type CourierDashboardResponse struct {
	Availability       CourierAvailability    `json:"availability"`
	PendingMissions    int                    `json:"pending_missions"`
	ActiveMissions     int                    `json:"active_missions"`
	DeliveriesToday    int                    `json:"deliveries_today"`
	CompletedToday     int                    `json:"completed_today"`
	FailedToday        int                    `json:"failed_today"`
	CurrentMission     *CourierMissionResponse `json:"current_mission"`
}

// CourierHistoryResponse is a single item in courier delivery history
type CourierHistoryResponse struct {
	OrderID         uuid.UUID  `json:"order_id"`
	OrderNumber     string     `json:"order_number"`
	ShopName        string     `json:"shop_name"`
	DeliveryAddress string     `json:"delivery_address"`
	AssignedAt      *time.Time `json:"assigned_at"`
	DeliveredAt     *time.Time `json:"delivered_at"`
	FinalStatus     string     `json:"final_status"`
	IncidentStatus  string     `json:"incident_status"`
}
