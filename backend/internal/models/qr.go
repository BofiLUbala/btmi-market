package models

import (
	"github.com/google/uuid"
	"time"
)

type QRIdentity struct {
	Reference string    `json:"reference"`
	Token     string    `json:"token,omitempty"`
	Status    string    `json:"status"`
	LabelURL  string    `json:"label_url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type DeliveryPackageQR struct {
	ID                 uuid.UUID  `json:"package_id"`
	OrderID            uuid.UUID  `json:"order_id"`
	PackageNumber      int        `json:"package_number"`
	Reference          string     `json:"reference"`
	Token              string     `json:"token,omitempty"`
	Status             string     `json:"status"`
	Operational        bool       `json:"operational"`
	PickupVerifiedAt   *time.Time `json:"pickup_verified_at,omitempty"`
	DeliveryScannedAt  *time.Time `json:"delivery_scanned_at,omitempty"`
	ReceiptConfirmedAt *time.Time `json:"receipt_confirmed_at,omitempty"`
}

type QRScanRequest struct {
	Token          string                 `json:"token" binding:"required"`
	OrderID        *uuid.UUID             `json:"order_id,omitempty"`
	IdempotencyKey string                 `json:"idempotency_key"`
	Latitude       *float64               `json:"latitude,omitempty"`
	Longitude      *float64               `json:"longitude,omitempty"`
	DeviceID       string                 `json:"device_id"`
	DeviceMetadata map[string]interface{} `json:"device_metadata"`
}

type QRScanResponse struct {
	Result                    string    `json:"result"`
	OrderID                   uuid.UUID `json:"order_id"`
	PackageID                 uuid.UUID `json:"package_id"`
	DeliveryStatus            string    `json:"delivery_status"`
	RequiresBuyerConfirmation bool      `json:"requires_buyer_confirmation"`
}

type DeliveryScanEvent struct {
	ID           uuid.UUID  `json:"id"`
	ScanType     string     `json:"scan_type"`
	ScanResult   string     `json:"scan_result"`
	Reason       string     `json:"reason"`
	CourierID    *uuid.UUID `json:"courier_id,omitempty"`
	Latitude     *float64   `json:"latitude,omitempty"`
	Longitude    *float64   `json:"longitude,omitempty"`
	DeviceID     string     `json:"device_id,omitempty"`
	StatusBefore string     `json:"status_before,omitempty"`
	StatusAfter  string     `json:"status_after,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

// AdminDeliveryOverview is the Commerce Admin view of a handover: package state, courier
// assignment and the complete scan audit trail, with the QR token deliberately omitted.
type AdminDeliveryOverview struct {
	OrderID           uuid.UUID           `json:"order_id"`
	Package           *DeliveryPackageQR  `json:"package,omitempty"`
	AssignedCourierID *uuid.UUID          `json:"assigned_courier_id,omitempty"`
	Events            []DeliveryScanEvent `json:"events"`
}
