package models

import (
	"time"

	"github.com/google/uuid"
)

type OrderStatus string

const (
	OrderStatusPending        OrderStatus = "PENDING"
	OrderStatusAccepted       OrderStatus = "ACCEPTED"
	OrderStatusRejected       OrderStatus = "REJECTED"
	OrderStatusPreparing      OrderStatus = "PREPARING"
	OrderStatusReady          OrderStatus = "READY"
	OrderStatusOutForDelivery OrderStatus = "OUT_FOR_DELIVERY"
	OrderStatusDelivered      OrderStatus = "DELIVERED"
	OrderStatusReceived       OrderStatus = "RECEIVED"
	OrderStatusReadyForPickup OrderStatus = "READY_FOR_PICKUP"
	OrderStatusCompleted      OrderStatus = "COMPLETED"
	OrderStatusCancelled      OrderStatus = "CANCELLED"
	OrderStatusHandedToPartner OrderStatus = "HANDED_TO_PARTNER"
)

type Order struct {
	ID                     uuid.UUID   `json:"id" db:"id"`
	BusinessID             uuid.UUID   `json:"business_id" db:"business_id"`
	ShopID                 uuid.UUID   `json:"shop_id" db:"shop_id"`
	CustomerID             *uuid.UUID  `json:"customer_id" db:"customer_id"`
	BuyerProfileID         *uuid.UUID  `json:"buyer_profile_id" db:"buyer_profile_id"`
	Status                 OrderStatus `json:"status" db:"status"`
	TotalItems             int         `json:"total_items" db:"total_items"`
	Notes                  string      `json:"notes" db:"notes"`
	CreatedBy              *uuid.UUID  `json:"created_by" db:"created_by"`
	BaseTotal              float64     `json:"base_total" db:"base_total"`
	PointsUsed             int         `json:"points_used" db:"points_used"`
	PointsDiscountAmount   float64     `json:"points_discount_amount" db:"points_discount_amount"`
	FinalTotal             float64     `json:"final_total" db:"final_total"`
	IdempotencyKey         *string     `json:"idempotency_key" db:"idempotency_key"`
	OrderNumber            string      `json:"order_number" db:"order_number"`
	DeliveryMethod         string      `json:"delivery_method" db:"delivery_method"`
	DeliveryFeeBase        float64     `json:"delivery_fee_base" db:"delivery_fee_base"`
	DeliveryPointsUsed     int         `json:"delivery_points_used" db:"delivery_points_used"`
	DeliveryPointsDiscount float64     `json:"delivery_points_discount" db:"delivery_points_discount"`
	DeliveryFeeFinal       float64     `json:"delivery_fee_final" db:"delivery_fee_final"`
	DeliveryContactName    string      `json:"delivery_contact_name" db:"delivery_contact_name"`
	DeliveryPhone          string      `json:"delivery_phone" db:"delivery_phone"`
	DeliveryAddress        string      `json:"delivery_address" db:"delivery_address"`
	DeliveryNotes          string      `json:"delivery_notes" db:"delivery_notes"`
	PointsFinalized        bool        `json:"points_finalized" db:"points_finalized"`
	AcceptedAt             *time.Time  `json:"accepted_at" db:"accepted_at"`
	PreparingAt            *time.Time  `json:"preparing_at" db:"preparing_at"`
	ReadyAt                *time.Time  `json:"ready_at" db:"ready_at"`
	OutForDeliveryAt       *time.Time  `json:"out_for_delivery_at" db:"out_for_delivery_at"`
	DeliveredAt            *time.Time  `json:"delivered_at" db:"delivered_at"`
	ReceivedAt             *time.Time  `json:"received_at" db:"received_at"`
	CompletedAt            *time.Time  `json:"completed_at" db:"completed_at"`
	CreatedAt              time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt              time.Time   `json:"updated_at" db:"updated_at"`
}

type OrderLine struct {
	ID                uuid.UUID `json:"id" db:"id"`
	OrderID           uuid.UUID `json:"order_id" db:"order_id"`
	ProductID         uuid.UUID `json:"product_id" db:"product_id"`
	VariantID         uuid.UUID `json:"variant_id" db:"variant_id"`
	Quantity          int       `json:"quantity" db:"quantity"`
	UnitPrice         float64   `json:"unit_price" db:"unit_price"`
	BaseUnitPrice     float64   `json:"base_unit_price" db:"base_unit_price"`
	PointsDiscountPerUnit float64 `json:"points_discount_per_unit" db:"points_discount_per_unit"`
	FinalUnitPrice    float64   `json:"final_unit_price" db:"final_unit_price"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
}

type OrderStatusHistory struct {
	ID        uuid.UUID   `json:"id" db:"id"`
	OrderID   uuid.UUID   `json:"order_id" db:"order_id"`
	Status    OrderStatus `json:"status" db:"status"`
	ChangedBy *uuid.UUID  `json:"changed_by" db:"changed_by"`
	Notes     string      `json:"notes" db:"notes"`
	CreatedAt time.Time   `json:"created_at" db:"created_at"`
}

type CreateOrderRequest struct {
	ShopID       string           `json:"shop_id" binding:"required"`
	CustomerID   *string          `json:"customer_id"`
	CustomerName string           `json:"customer_name"`
	CustomerPhone string          `json:"customer_phone"`
	CustomerEmail string          `json:"customer_email"`
	Notes        string           `json:"notes"`
	Lines        []OrderLineInput `json:"lines" binding:"required,min=1"`
}

type OrderLineInput struct {
	ProductID string `json:"product_id" binding:"required"`
	VariantID string `json:"variant_id" binding:"required"`
	Quantity  int    `json:"quantity" binding:"required,gt=0"`
}

type BuyerCreateOrderRequest struct {
	ShopID         string            `json:"shop_id" binding:"required"`
	Items          []OrderLineInput  `json:"items" binding:"required,min=1"`
	UsePoints      bool              `json:"use_points"`
	IdempotencyKey *string           `json:"idempotency_key"`
}

type OrderResponse struct {
	ID                     uuid.UUID           `json:"id"`
	BusinessID             uuid.UUID           `json:"business_id"`
	ShopID                 uuid.UUID           `json:"shop_id"`
	CustomerID             *uuid.UUID          `json:"customer_id"`
	BuyerProfileID         *uuid.UUID          `json:"buyer_profile_id"`
	Status                 string              `json:"status"`
	TotalItems             int                 `json:"total_items"`
	Notes                  string              `json:"notes"`
	CreatedBy              *uuid.UUID          `json:"created_by"`
	BaseTotal              float64             `json:"base_total"`
	PointsUsed             int                 `json:"points_used"`
	PointsDiscountAmount   float64             `json:"points_discount_amount"`
	FinalTotal             float64             `json:"final_total"`
	IdempotencyKey         *string             `json:"idempotency_key"`
	OrderNumber            string              `json:"order_number"`
	DeliveryMethod         string              `json:"delivery_method"`
	DeliveryFeeBase        float64             `json:"delivery_fee_base"`
	DeliveryPointsUsed     int                 `json:"delivery_points_used"`
	DeliveryPointsDiscount float64             `json:"delivery_points_discount"`
	DeliveryFeeFinal       float64             `json:"delivery_fee_final"`
	DeliveryContactName    string              `json:"delivery_contact_name"`
	DeliveryPhone          string              `json:"delivery_phone"`
	DeliveryAddress        string              `json:"delivery_address"`
	DeliveryNotes          string              `json:"delivery_notes"`
	PointsFinalized        bool                `json:"points_finalized"`
	AcceptedAt             *time.Time          `json:"accepted_at,omitempty"`
	PreparingAt            *time.Time          `json:"preparing_at,omitempty"`
	ReadyAt                *time.Time          `json:"ready_at,omitempty"`
	OutForDeliveryAt       *time.Time          `json:"out_for_delivery_at,omitempty"`
	DeliveredAt            *time.Time          `json:"delivered_at,omitempty"`
	ReceivedAt             *time.Time          `json:"received_at,omitempty"`
	CompletedAt            *time.Time          `json:"completed_at,omitempty"`
	CreatedAt              time.Time           `json:"created_at"`
	UpdatedAt              time.Time           `json:"updated_at"`
	Lines                  []OrderLineResponse `json:"lines,omitempty"`
}

type OrderLineResponse struct {
	ID                    uuid.UUID `json:"id"`
	OrderID               uuid.UUID `json:"order_id"`
	ProductID             uuid.UUID `json:"product_id"`
	VariantID             uuid.UUID `json:"variant_id"`
	Quantity              int       `json:"quantity"`
	UnitPrice             float64   `json:"unit_price"`
	BaseUnitPrice         float64   `json:"base_unit_price"`
	PointsDiscountPerUnit float64   `json:"points_discount_per_unit"`
	FinalUnitPrice        float64   `json:"final_unit_price"`
	CreatedAt             time.Time `json:"created_at"`
}

type OrderStatusHistoryResponse struct {
	ID        uuid.UUID `json:"id"`
	OrderID   uuid.UUID `json:"order_id"`
	Status    string    `json:"status"`
	ChangedBy *uuid.UUID `json:"changed_by"`
	ActorType string    `json:"actor_type"`
	Notes     string    `json:"notes"`
	CreatedAt time.Time `json:"created_at"`
}

type OrderWithLinesResponse struct {
	Order   OrderResponse              `json:"order"`
	Lines   []OrderLineResponse        `json:"lines"`
	History []OrderStatusHistoryResponse `json:"history,omitempty"`
}

type OrderEvent struct {
	Event     string    `json:"event"`
	OrderID   uuid.UUID `json:"order_id"`
	ShopID    uuid.UUID `json:"shop_id"`
	Status    string    `json:"status"`
	Timestamp int64     `json:"timestamp"`
}

const (
	DeliveryMethodPickup        = "PICKUP"
	DeliveryMethodShopDelivery  = "SHOP_DELIVERY"
	DeliveryMethodPartner       = "PARTNER"
)

type DeliveryOption struct {
	Method    string  `json:"method"`
	Label     string  `json:"label"`
	Fee       float64 `json:"fee"`
	Provider  string  `json:"provider,omitempty"`
	Available bool    `json:"available"`
}

type DeliveryOptionsResponse struct {
	OrderID   uuid.UUID         `json:"order_id"`
	ShopID    uuid.UUID         `json:"shop_id"`
	Options   []DeliveryOption  `json:"options"`
	Current   string            `json:"current_method"`
}

type SelectDeliveryRequest struct {
	Method               string `json:"method" binding:"required"`
	UsePointsForDelivery bool   `json:"use_points_for_delivery"`
	ContactName          string `json:"contact_name"`
	Phone                string `json:"phone"`
	Address              string `json:"address"`
	Notes                string `json:"notes"`
}

type DeliverySummary struct {
	Method                 string  `json:"method"`
	FeeBase                float64 `json:"fee_base"`
	PointsUsed             int     `json:"points_used"`
	PointsDiscount         float64 `json:"points_discount"`
	FeeFinal               float64 `json:"fee_final"`
	ContactName            string  `json:"contact_name"`
	Phone                  string  `json:"phone"`
	Address                string  `json:"address"`
	Notes                  string  `json:"notes"`
}

type DeliverySelectResponse struct {
	OrderID         uuid.UUID       `json:"order_id"`
	ProductsTotal   float64         `json:"products_final_total"`
	Delivery        DeliverySummary `json:"delivery"`
	TotalDue        float64         `json:"total_due"`
}

type DeliveryPointsPreviewRequest struct {
	UsePointsForDelivery bool `json:"use_points_for_delivery"`
}

type DeliveryPointsPreviewResponse struct {
	Method                string  `json:"method"`
	FeeBase               float64 `json:"fee_base"`
	PointsUsed            int     `json:"points_used"`
	PointsDiscountAmount  float64 `json:"points_discount_amount"`
	FeeFinal              float64 `json:"fee_final"`
	Currency              string  `json:"currency"`
	AvailablePoints       int     `json:"available_points"`
	MaximumUsablePoints   int     `json:"maximum_usable_points"`
	RedeemRate            float64 `json:"redeem_rate"`
	MaxDeliveryCoverage   float64 `json:"max_delivery_point_coverage"`
}

type OrderPointsPreviewRequest struct {
	UsePoints bool `json:"use_points"`
}

// Tracking status transition request (seller).
type TrackingStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

// Tracking response for buyer order tracking view.
type TrackingResponse struct {
	OrderID         uuid.UUID                    `json:"order_id"`
	OrderNumber     string                       `json:"order_number"`
	CurrentStatus   string                       `json:"current_status"`
	DeliveryMethod  string                       `json:"delivery_method"`
	PaymentStatus   string                       `json:"payment_status"`
	LatestUpdate    string                       `json:"latest_update"`
	LatestUpdateAt  *time.Time                   `json:"latest_update_at"`
	History         []OrderStatusHistoryResponse `json:"history"`
}

// Tracking summary embedded in list/get responses.
type TrackingSummary struct {
	CurrentStatus  string `json:"current_status"`
	DeliveryMethod string `json:"delivery_method"`
	PaymentStatus  string `json:"payment_status"`
	OrderNumber    string `json:"order_number"`
}

