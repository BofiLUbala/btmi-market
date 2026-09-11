package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type SenderType string

type RecipientScope string

const (
	RecipientScopeBuyer       RecipientScope = "BUYER"
	RecipientScopeSellerOwner RecipientScope = "SELLER_OWNER"
	RecipientScopeEmployee    RecipientScope = "EMPLOYEE"
	RecipientScopeAll         RecipientScope = "ALL_PARTICIPANTS"
)

const (
	SenderTypeBuyer         SenderType = "BUYER"
	SenderTypeSeller        SenderType = "SELLER"
	SenderTypeEmployee      SenderType = "EMPLOYEE"
	SenderTypeCommerceAdmin SenderType = "COMMERCE_ADMIN"
	SenderTypeSuperAdmin    SenderType = "SUPER_ADMIN"
	SenderTypeSystem        SenderType = "SYSTEM"
)

type NotificationType string

const (
	// Order Phases (Buyer & Seller)
	NotificationTypeNewOrder             NotificationType = "NEW_ORDER"
	NotificationTypeOrderAccepted        NotificationType = "ORDER_ACCEPTED"
	NotificationTypeOrderRejected        NotificationType = "ORDER_REJECTED"
	NotificationTypeOrderPreparing       NotificationType = "ORDER_PREPARING"
	NotificationTypeOrderReady           NotificationType = "ORDER_READY_FOR_PICKUP"
	NotificationTypeOrderReadyForPickup  NotificationType = "ORDER_READY_FOR_PICKUP"
	NotificationTypeOrderCancelled       NotificationType = "ORDER_CANCELLED"
	NotificationTypeOrderCompleted       NotificationType = "ORDER_COMPLETED"
	NotificationTypeBuyerReceiptRequired NotificationType = "BUYER_RECEIPT_REQUIRED"
	// NotificationTypeOrderReceived announces physical receipt only. It is deliberately
	// distinct from ORDER_COMPLETED, which additionally requires verified cash payment.
	NotificationTypeOrderReceived NotificationType = "ORDER_RECEIVED"

	// Delivery & Courier Lifecycle
	NotificationTypeCourierAssigned        NotificationType = "COURIER_ASSIGNED"
	NotificationTypeCourierPickedUp        NotificationType = "COURIER_PICKED_UP"
	NotificationTypeDeliveryInTransit      NotificationType = "DELIVERY_IN_TRANSIT"
	NotificationTypeCourierNearDestination NotificationType = "COURIER_NEAR_DESTINATION"
	NotificationTypeCourierArrived         NotificationType = "COURIER_ARRIVED"
	NotificationTypeOrderDelivered         NotificationType = "DELIVERED"
	NotificationTypeDelivered              NotificationType = "DELIVERED"
	NotificationTypeDeliveryAssigned       NotificationType = "DELIVERY_ASSIGNED"
	NotificationTypeDeliveryPending        NotificationType = "DELIVERY_PENDING_ASSIGNMENT"
	NotificationTypeDeliveryFailed         NotificationType = "DELIVERY_FAILED"
	NotificationTypeDeliveryDelayed        NotificationType = "DELIVERY_DELAYED"

	// Communication, Payment & Reviews
	NotificationTypeNewMessage               NotificationType = "NEW_MESSAGE"
	NotificationTypePaymentConfirmed         NotificationType = "PAYMENT_CONFIRMED"
	NotificationTypeCashConfirmationRequired NotificationType = "CASH_CONFIRMATION_REQUIRED"
	NotificationTypeNewReview                NotificationType = "NEW_REVIEW"
)

type OrderConversation struct {
	ID         uuid.UUID `json:"id" db:"id"`
	OrderID    uuid.UUID `json:"order_id" db:"order_id"`
	BuyerID    uuid.UUID `json:"buyer_id" db:"buyer_id"`
	ShopID     uuid.UUID `json:"shop_id" db:"shop_id"`
	BusinessID uuid.UUID `json:"business_id" db:"business_id"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

type OrderMessage struct {
	ID                  uuid.UUID      `json:"id" db:"id"`
	ConversationID      uuid.UUID      `json:"conversation_id" db:"conversation_id"`
	SenderUserID        uuid.UUID      `json:"sender_user_id" db:"sender_user_id"`
	SenderType          SenderType     `json:"sender_type" db:"sender_type"`
	SenderName          string         `json:"sender_name" db:"sender_name"`
	Body                string         `json:"body" db:"body"`
	IsAdminIntervention bool           `json:"is_admin_intervention" db:"is_admin_intervention"`
	RecipientScope      RecipientScope `json:"recipient_scope" db:"recipient_scope"`
	RecipientUserID     *uuid.UUID     `json:"recipient_user_id,omitempty" db:"recipient_user_id"`
	ReadByBuyerAt       *time.Time     `json:"read_by_buyer_at,omitempty" db:"read_by_buyer_at"`
	ReadBySellerAt      *time.Time     `json:"read_by_seller_at,omitempty" db:"read_by_seller_at"`
	CreatedAt           time.Time      `json:"created_at" db:"created_at"`
}

type Notification struct {
	ID            uuid.UUID              `json:"id" db:"id"`
	UserID        uuid.UUID              `json:"user_id" db:"user_id"`
	Type          NotificationType       `json:"type" db:"type"`
	Title         string                 `json:"title" db:"title"`
	Body          string                 `json:"body" db:"body"`
	ReferenceType string                 `json:"reference_type" db:"reference_type"`
	ReferenceID   uuid.UUID              `json:"reference_id" db:"reference_id"`
	Metadata      map[string]interface{} `json:"metadata" db:"metadata"`
	ReadAt        *time.Time             `json:"read_at,omitempty" db:"read_at"`
	CreatedAt     time.Time              `json:"created_at" db:"created_at"`
}

type SendMessageRequest struct {
	Body string `json:"body" binding:"required"`
}

type AdminInterveneRequest struct {
	Body            string         `json:"body" binding:"required"`
	RecipientScope  RecipientScope `json:"recipient_scope" binding:"required"`
	RecipientUserID *uuid.UUID     `json:"recipient_user_id"`
}

type OrderConversationParticipant struct {
	UserID     uuid.UUID  `json:"user_id"`
	Name       string     `json:"name"`
	Type       string     `json:"type"`
	LastReadAt *time.Time `json:"last_read_at,omitempty"`
}

type OrderConversationDetailResponse struct {
	Conversation   OrderConversation              `json:"conversation"`
	OrderNumber    string                         `json:"order_number"`
	OrderStatus    string                         `json:"order_status"`
	DeliveryMethod string                         `json:"delivery_method"`
	FinalTotal     float64                        `json:"final_total"`
	ShopName       string                         `json:"shop_name"`
	BusinessName   string                         `json:"business_name"`
	BuyerName      string                         `json:"buyer_name"`
	Participants   []OrderConversationParticipant `json:"participants"`
	Messages       []OrderMessage                 `json:"messages"`
}

type ConversationListItemResponse struct {
	ConversationID uuid.UUID  `json:"conversation_id"`
	OrderID        uuid.UUID  `json:"order_id"`
	OrderNumber    string     `json:"order_number"`
	OrderStatus    string     `json:"order_status"`
	BuyerID        uuid.UUID  `json:"buyer_id"`
	BuyerName      string     `json:"buyer_name"`
	ShopID         uuid.UUID  `json:"shop_id"`
	ShopName       string     `json:"shop_name"`
	BusinessID     uuid.UUID  `json:"business_id"`
	BusinessName   string     `json:"business_name"`
	LastMessage    string     `json:"last_message"`
	LastSenderType SenderType `json:"last_sender_type"`
	LastMessageAt  time.Time  `json:"last_message_at"`
	UnreadCount    int        `json:"unread_count"`
	CreatedAt      time.Time  `json:"created_at"`
}

type NotificationResponse struct {
	ID            uuid.UUID              `json:"id"`
	Type          string                 `json:"type"`
	Title         string                 `json:"title"`
	Body          string                 `json:"body"`
	ReferenceType string                 `json:"reference_type"`
	ReferenceID   string                 `json:"reference_id"`
	Metadata      map[string]interface{} `json:"metadata"`
	ReadAt        *time.Time             `json:"read_at,omitempty"`
	CreatedAt     time.Time              `json:"created_at"`
	IsRead        bool                   `json:"is_read"`
}

type UnreadCountsResponse struct {
	UnreadMessages      int `json:"unread_messages"`
	UnreadNotifications int `json:"unread_notifications"`
}

func MetadataToJSON(m map[string]interface{}) (string, error) {
	if m == nil {
		return "{}", nil
	}
	b, err := json.Marshal(m)
	if err != nil {
		return "{}", err
	}
	return string(b), nil
}

func JSONToMetadata(data []byte) map[string]interface{} {
	if len(data) == 0 {
		return make(map[string]interface{})
	}
	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		return make(map[string]interface{})
	}
	return m
}
