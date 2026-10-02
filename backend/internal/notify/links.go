package notify

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
)

// Links are the screens a notification opens: Web is a path of the web app,
// App a path of the Android app (expo-router). Both are internal paths only;
// the client still enforces sign-in and access rights when it opens them.
type Links struct {
	Web string
	App string
}

// Reference types a notification can point at, besides ORDER.
const (
	RefOrder    = "ORDER"
	RefProduct  = "PRODUCT"
	RefShop     = "SHOP"
	RefBusiness = "BUSINESS"
	RefReview   = "REVIEW"
	RefEmployee = "EMPLOYEE"
	RefCourier  = "COURIER"
	RefCase     = "CASE"
	RefAccount  = "ACCOUNT"
	RefCampaign = "CAMPAIGN"
	RefPoints   = "POINTS"
)

// notificationsHome is each space's notification list: the fallback screen
// and where security alerts land (the alert itself explains what to do).
func notificationsHome(audience string) Links {
	switch audience {
	case audSeller:
		return Links{Web: "/seller/notifications", App: "/seller/notifications"}
	case audCourier:
		return Links{Web: "/courier/dashboard", App: "/courier"}
	case audAdmin:
		return Links{Web: "/admin", App: "/admin"}
	}
	return Links{Web: "/notifications", App: "/notifications"}
}

// LinksFor resolves the screen a notification opens for its audience.
func LinksFor(n *models.Notification, audience string) Links {
	id := n.ReferenceID.String()
	q := url.QueryEscape(id)
	switch n.ReferenceType {
	case RefOrder:
		return orderLinks(n.Type, audience, id, q)
	case RefProduct:
		if audience == audSeller {
			return Links{Web: "/seller/products/" + id, App: "/seller/products/" + id}
		}
		return Links{Web: "/products/" + id, App: "/products/" + id}
	case RefShop:
		return Links{Web: "/seller/shops", App: "/seller/shops"}
	case RefBusiness:
		return Links{Web: "/seller/business", App: "/seller/business"}
	case RefReview:
		if audience == audSeller {
			return Links{Web: "/seller/reviews", App: "/seller/reviews"}
		}
		return Links{Web: "/reviews", App: "/reviews"}
	case RefEmployee:
		return Links{Web: "/seller/employees", App: "/seller/employees"}
	case RefCourier:
		if audience == audAdmin {
			return Links{Web: "/admin/commerce/couriers", App: "/admin/commerce"}
		}
		return Links{Web: "/courier/dashboard", App: "/courier"}
	case RefCase:
		return Links{Web: "/admin/finance/cases", App: "/admin/finance"}
	case RefPoints:
		return Links{Web: "/points/history", App: "/points/history"}
	case RefCampaign:
		if link := SafeInternalPath(stringMeta(n.Metadata, "target_path")); link != "" {
			return Links{Web: link, App: link}
		}
		return Links{Web: "/", App: "/"}
	}
	if n.Type == models.NotificationTypeWatchlistDigest {
		return Links{Web: "/favorites", App: "/favorites"}
	}
	return notificationsHome(audience)
}

func orderLinks(t models.NotificationType, audience, id, q string) Links {
	isMessage := t == models.NotificationTypeNewMessage
	switch audience {
	case audSeller:
		if isMessage {
			return Links{Web: "/seller/messages?order_id=" + q, App: "/seller/messages?order_id=" + q}
		}
		return Links{Web: "/seller/orders?orderId=" + q, App: "/seller/orders?orderId=" + q}
	case audCourier:
		return Links{Web: "/courier/missions/" + id, App: "/courier/" + id}
	case audAdmin:
		switch t {
		case models.NotificationTypeNewMessage:
			return Links{Web: "/admin/commerce/communications?order_id=" + q, App: "/admin/commerce/orders/" + id}
		case models.NotificationTypeOrderReady, models.NotificationTypeCourierMissionRejected, models.NotificationTypeDeliveryPending:
			return Links{Web: "/admin/commerce/delivery-assignments", App: "/admin/commerce/orders/" + id}
		case models.NotificationTypeRefundIssued:
			return Links{Web: "/admin/finance/payments", App: "/admin/finance"}
		}
		return Links{Web: "/admin/commerce/orders/" + id, App: "/admin/commerce/orders/" + id}
	}
	switch t {
	case models.NotificationTypeNewMessage:
		return Links{Web: "/orders/" + id + "?chat=1", App: "/orders/" + id + "?chat=1"}
	case models.NotificationTypeDeliveryInTransit, models.NotificationTypeCourierNearDestination:
		return Links{Web: "/orders/" + id + "/tracking", App: "/orders/live?id=" + q}
	case models.NotificationTypeOrderCompleted:
		return Links{Web: "/orders/" + id + "/review", App: "/orders/" + id}
	}
	return Links{Web: "/orders/" + id, App: "/orders/" + id}
}

// SafeInternalPath keeps a link only when it is an internal path of the app,
// never a URL that could send someone to another site.
func SafeInternalPath(p string) string {
	p = strings.TrimSpace(p)
	if !strings.HasPrefix(p, "/") || strings.HasPrefix(p, "//") || strings.ContainsAny(p, "\\\r\n\t") {
		return ""
	}
	if u, err := url.Parse(p); err != nil || u.Scheme != "" || u.Host != "" {
		return ""
	}
	return p
}

func stringMeta(m map[string]interface{}, key string) string {
	if m == nil {
		return ""
	}
	if v, ok := m[key]; ok && v != nil {
		return fmt.Sprint(v)
	}
	return ""
}
