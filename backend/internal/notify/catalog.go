// Package notify classifies notifications (category, priority, link) and
// decides where they go: the in-app list always, push when the recipient's
// preferences allow it. docs/NOTIFICATIONS_AUDIT.md is the functional
// reference for every event listed here.
package notify

import (
	"github.com/btmi-ai-market/backend/internal/models"
)

// Category groups notifications for preferences.
type Category string

const (
	CategoryOrders    Category = "ORDERS"
	CategoryPayments  Category = "PAYMENTS"
	CategoryMessages  Category = "MESSAGES"
	CategoryShop      Category = "SHOP"
	CategoryAdmin     Category = "ADMIN"
	CategorySecurity  Category = "SECURITY"
	CategoryWatchlist Category = "WATCHLIST"
	CategoryMarketing Category = "MARKETING"
)

// AllCategories in display order.
var AllCategories = []Category{
	CategoryOrders, CategoryPayments, CategoryMessages, CategoryShop,
	CategoryAdmin, CategorySecurity, CategoryWatchlist, CategoryMarketing,
}

// ParseCategory accepts a known category name.
func ParseCategory(raw string) (Category, bool) {
	for _, c := range AllCategories {
		if string(c) == raw {
			return c, true
		}
	}
	return "", false
}

// RequiresConsent reports whether nothing of this category may reach the user
// (in-app or push) before an explicit opt-in.
func (c Category) RequiresConsent() bool {
	return c == CategoryWatchlist || c == CategoryMarketing
}

// Locked categories cannot be switched off: security alerts must always reach
// the account owner.
func (c Category) Locked() bool { return c == CategorySecurity }

// DefaultPush is the push setting of a category nobody has touched yet.
func (c Category) DefaultPush() bool { return !c.RequiresConsent() }

// Priority decides whether and how urgently a notification is pushed.
type Priority string

const (
	// PriorityHigh is pushed immediately with high urgency.
	PriorityHigh Priority = "HIGH"
	// PriorityNormal is pushed with normal urgency.
	PriorityNormal Priority = "NORMAL"
	// PriorityLow stays in the in-app list only: routine follow-ups that do not
	// deserve to interrupt anyone.
	PriorityLow Priority = "LOW"
)

func parsePriority(raw string) (Priority, bool) {
	switch Priority(raw) {
	case PriorityHigh, PriorityNormal, PriorityLow:
		return Priority(raw), true
	}
	return "", false
}

// Spec is how one notification type is handled for one audience.
type Spec struct {
	Category Category
	Priority Priority
	// Sensitive hides the body on the lock screen: the push only says that
	// something arrived, the content is read in the app after sign-in.
	Sensitive bool
}

const (
	audBuyer   = "BUYER"
	audSeller  = "SELLER"
	audCourier = "COURIER"
	audAdmin   = "ADMIN"
)

type typeSpec struct {
	base       Spec
	byAudience map[string]Priority
}

func spec(c Category, p Priority) typeSpec { return typeSpec{base: Spec{Category: c, Priority: p}} }

func (t typeSpec) with(aud string, p Priority) typeSpec {
	if t.byAudience == nil {
		t.byAudience = map[string]Priority{}
	}
	t.byAudience[aud] = p
	return t
}

func (t typeSpec) sensitive() typeSpec { t.base.Sensitive = true; return t }

var catalog = map[models.NotificationType]typeSpec{
	// Orders and delivery.
	models.NotificationTypeNewOrder:              spec(CategoryOrders, PriorityHigh).with(audAdmin, PriorityLow),
	models.NotificationTypeOrderActionReminder:   spec(CategoryOrders, PriorityHigh),
	models.NotificationTypeOrderStalled:          spec(CategoryAdmin, PriorityNormal),
	models.NotificationTypeOrderAccepted:         spec(CategoryOrders, PriorityNormal),
	models.NotificationTypeOrderRejected:         spec(CategoryOrders, PriorityHigh).with(audAdmin, PriorityNormal),
	models.NotificationTypeOrderPreparing:        spec(CategoryOrders, PriorityLow),
	models.NotificationTypeOrderReady:            spec(CategoryOrders, PriorityNormal).with(audAdmin, PriorityHigh),
	models.NotificationTypeCourierAssigned:       spec(CategoryOrders, PriorityNormal).with(audCourier, PriorityHigh),
	models.NotificationTypeDeliveryAssigned:      spec(CategoryOrders, PriorityNormal).with(audCourier, PriorityHigh),
	models.NotificationTypeCourierMissionAccepted: spec(CategoryAdmin, PriorityLow),
	models.NotificationTypeCourierMissionRejected: spec(CategoryAdmin, PriorityHigh),
	models.NotificationTypeCourierPickedUp:       spec(CategoryOrders, PriorityNormal).with(audAdmin, PriorityLow),
	models.NotificationTypeDeliveryInTransit:     spec(CategoryOrders, PriorityNormal).with(audAdmin, PriorityLow),
	models.NotificationTypeCourierNearDestination: spec(CategoryOrders, PriorityNormal),
	models.NotificationTypeCourierArrived:        spec(CategoryOrders, PriorityHigh).with(audAdmin, PriorityLow),
	models.NotificationTypeOrderDelivered:        spec(CategoryOrders, PriorityNormal).with(audBuyer, PriorityHigh).with(audAdmin, PriorityLow),
	models.NotificationTypeBuyerReceiptRequired:  spec(CategoryOrders, PriorityHigh),
	models.NotificationTypeBuyerReceiptReminder:  spec(CategoryOrders, PriorityNormal),
	models.NotificationTypeOrderReceived:         spec(CategoryOrders, PriorityNormal).with(audBuyer, PriorityLow).with(audAdmin, PriorityLow),
	models.NotificationTypeOrderCompleted:        spec(CategoryOrders, PriorityNormal).with(audAdmin, PriorityLow),
	models.NotificationTypeOrderCancelled:        spec(CategoryOrders, PriorityHigh).with(audAdmin, PriorityNormal),
	models.NotificationTypeDeliveryFailed:        spec(CategoryOrders, PriorityHigh),
	models.NotificationTypeDeliveryDelayed:       spec(CategoryOrders, PriorityNormal),
	models.NotificationTypeDeliveryPending:       spec(CategoryAdmin, PriorityHigh),

	// Payments.
	models.NotificationTypePaymentConfirmed:         spec(CategoryPayments, PriorityNormal),
	models.NotificationTypePaymentFailed:            spec(CategoryPayments, PriorityHigh),
	models.NotificationTypeCashConfirmationRequired: spec(CategoryPayments, PriorityHigh),
	models.NotificationTypeRefundIssued:             spec(CategoryPayments, PriorityNormal).with(audSeller, PriorityHigh),
	models.NotificationTypePointsAdjusted:           spec(CategoryPayments, PriorityNormal),

	// Messages: the body is a private message, never shown on a lock screen.
	models.NotificationTypeNewMessage: spec(CategoryMessages, PriorityHigh).sensitive(),

	// Shop, catalogue, team.
	models.NotificationTypeShopSuspended:       spec(CategoryShop, PriorityHigh),
	models.NotificationTypeShopReactivated:     spec(CategoryShop, PriorityNormal),
	models.NotificationTypeBusinessSuspended:   spec(CategoryShop, PriorityHigh),
	models.NotificationTypeBusinessReactivated: spec(CategoryShop, PriorityNormal),
	models.NotificationTypeProductUnpublished:  spec(CategoryShop, PriorityHigh),
	models.NotificationTypeProductArchived:     spec(CategoryShop, PriorityHigh),
	models.NotificationTypeStockOut:            spec(CategoryShop, PriorityNormal),
	models.NotificationTypeNewReview:           spec(CategoryShop, PriorityNormal),
	models.NotificationTypeReviewReply:         spec(CategoryOrders, PriorityNormal),
	models.NotificationTypeEmployeeJoined:      spec(CategoryShop, PriorityNormal),
	models.NotificationTypeCourierSuspended:    spec(CategoryOrders, PriorityHigh),
	models.NotificationTypeCourierReactivated:  spec(CategoryOrders, PriorityNormal),
	models.NotificationTypeCourierJoined:       spec(CategoryAdmin, PriorityLow),
	models.NotificationTypeCaseAssigned:        spec(CategoryAdmin, PriorityHigh),

	// Security.
	models.NotificationTypeNewLogin:         spec(CategorySecurity, PriorityHigh),
	models.NotificationTypePasswordChanged:  spec(CategorySecurity, PriorityHigh),
	models.NotificationTypeAdminRoleChanged: spec(CategorySecurity, PriorityHigh),
	models.NotificationTypePushTest:         spec(CategorySecurity, PriorityHigh),

	// Followed products and marketing.
	models.NotificationTypePriceDrop:         spec(CategoryWatchlist, PriorityNormal),
	models.NotificationTypeBackInStock:       spec(CategoryWatchlist, PriorityNormal),
	models.NotificationTypeWatchlistDigest:   spec(CategoryWatchlist, PriorityNormal),
	models.NotificationTypeMarketingCampaign: spec(CategoryMarketing, PriorityNormal),
}

// SpecFor returns how a notification type is handled for an audience. An
// unknown type is an operational order notification of normal priority.
func SpecFor(t models.NotificationType, audience string) Spec {
	ts, ok := catalog[t]
	if !ok {
		return Spec{Category: CategoryOrders, Priority: PriorityNormal}
	}
	out := ts.base
	if p, ok := ts.byAudience[audience]; ok {
		out.Priority = p
	}
	// Admins file every operational alert under ADMIN so one switch governs
	// them; security stays security.
	if audience == audAdmin && out.Category != CategorySecurity && out.Category != CategoryMessages {
		out.Category = CategoryAdmin
	}
	return out
}
