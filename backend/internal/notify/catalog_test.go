package notify

import (
	"strings"
	"testing"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

func TestSpecPerAudience(t *testing.T) {
	cases := []struct {
		t        models.NotificationType
		audience string
		cat      Category
		prio     Priority
	}{
		{models.NotificationTypeNewOrder, "SELLER", CategoryOrders, PriorityHigh},
		{models.NotificationTypeNewOrder, "ADMIN", CategoryAdmin, PriorityLow},
		{models.NotificationTypeOrderPreparing, "BUYER", CategoryOrders, PriorityLow},
		{models.NotificationTypeOrderDelivered, "BUYER", CategoryOrders, PriorityHigh},
		{models.NotificationTypeCourierAssigned, "COURIER", CategoryOrders, PriorityHigh},
		{models.NotificationTypeCourierMissionRejected, "ADMIN", CategoryAdmin, PriorityHigh},
		{models.NotificationTypeNewLogin, "BUYER", CategorySecurity, PriorityHigh},
		{models.NotificationTypeNewLogin, "ADMIN", CategorySecurity, PriorityHigh},
		{models.NotificationTypeNewMessage, "ADMIN", CategoryMessages, PriorityHigh},
		{models.NotificationTypePriceDrop, "BUYER", CategoryWatchlist, PriorityNormal},
		{models.NotificationTypeMarketingCampaign, "BUYER", CategoryMarketing, PriorityNormal},
		{models.NotificationTypeRefundIssued, "SELLER", CategoryPayments, PriorityHigh},
	}
	for _, c := range cases {
		got := SpecFor(c.t, c.audience)
		if got.Category != c.cat || got.Priority != c.prio {
			t.Errorf("%s/%s: got %s/%s, want %s/%s", c.t, c.audience, got.Category, got.Priority, c.cat, c.prio)
		}
	}
	if !SpecFor(models.NotificationTypeNewMessage, "BUYER").Sensitive {
		t.Error("private messages must be sensitive")
	}
}

func TestCategoryRules(t *testing.T) {
	if !CategoryMarketing.RequiresConsent() || !CategoryWatchlist.RequiresConsent() || CategoryOrders.RequiresConsent() {
		t.Error("consent rules")
	}
	if CategoryMarketing.DefaultPush() || !CategoryOrders.DefaultPush() {
		t.Error("marketing must be off by default, operational on")
	}
	if !CategorySecurity.Locked() {
		t.Error("security must be locked")
	}
}

func TestLinks(t *testing.T) {
	id := uuid.MustParse("11111111-2222-3333-4444-555555555555")
	n := func(tp models.NotificationType, ref string) *models.Notification {
		return &models.Notification{Type: tp, ReferenceType: ref, ReferenceID: id}
	}
	cases := []struct {
		n             *models.Notification
		audience      string
		web, app      string
	}{
		{n(models.NotificationTypeOrderAccepted, "ORDER"), "BUYER", "/orders/" + id.String(), "/orders/" + id.String()},
		{n(models.NotificationTypeNewMessage, "ORDER"), "BUYER", "/orders/" + id.String() + "?chat=1", "/orders/" + id.String() + "?chat=1"},
		{n(models.NotificationTypeNewOrder, "ORDER"), "SELLER", "/seller/orders?orderId=" + id.String(), "/seller/orders?orderId=" + id.String()},
		{n(models.NotificationTypeNewMessage, "ORDER"), "SELLER", "/seller/messages?order_id=" + id.String(), "/seller/messages?order_id=" + id.String()},
		{n(models.NotificationTypeCourierAssigned, "ORDER"), "COURIER", "/courier/missions/" + id.String(), "/courier/" + id.String()},
		{n(models.NotificationTypeCourierMissionRejected, "ORDER"), "ADMIN", "/admin/commerce/delivery-assignments", "/admin/commerce/orders/" + id.String()},
		{n(models.NotificationTypeStockOut, "PRODUCT"), "SELLER", "/seller/products/" + id.String(), "/seller/products/" + id.String()},
		{n(models.NotificationTypePriceDrop, "PRODUCT"), "BUYER", "/products/" + id.String(), "/products/" + id.String()},
		{n(models.NotificationTypeNewLogin, "ACCOUNT"), "SELLER", "/seller/notifications", "/seller/notifications"},
	}
	for _, c := range cases {
		got := LinksFor(c.n, c.audience)
		if got.Web != c.web || got.App != c.app {
			t.Errorf("%s/%s: got %+v", c.n.Type, c.audience, got)
		}
	}
	campaign := n(models.NotificationTypeMarketingCampaign, "CAMPAIGN")
	campaign.Metadata = map[string]interface{}{"target_path": "https://evil.example/phish"}
	if got := LinksFor(campaign, "BUYER"); got.Web != "/" {
		t.Errorf("external campaign link must be refused, got %s", got.Web)
	}
}

func TestSafeInternalPath(t *testing.T) {
	for _, ok := range []string{"/", "/products/x", "/orders/1?chat=1"} {
		if SafeInternalPath(ok) != ok {
			t.Errorf("should keep %s", ok)
		}
	}
	for _, bad := range []string{"//evil.com", "https://evil.com", "javascript:alert(1)", "/\\evil", "products"} {
		if SafeInternalPath(bad) != "" {
			t.Errorf("should refuse %s", bad)
		}
	}
}

func TestResolveFillsMetadata(t *testing.T) {
	n := &models.Notification{Type: models.NotificationTypeOrderReady, ReferenceType: "ORDER", ReferenceID: uuid.New(),
		Metadata: map[string]interface{}{"audience": "BUYER", "priority": "LOW"}}
	spec, aud := Resolve(n)
	if aud != "BUYER" || spec.Priority != PriorityLow || n.Metadata[MetaCategory] != "ORDERS" ||
		!strings.HasPrefix(n.Metadata[MetaLink].(string), "/orders/") {
		t.Fatalf("resolve: %+v %v", spec, n.Metadata)
	}
}

func TestDeviceSignatureIgnoresVersions(t *testing.T) {
	a := "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
	b := strings.Replace(a, "Chrome/129", "Chrome/131", 1)
	if DeviceSignature(a) != DeviceSignature(b) || DeviceSignature(a) != "Chrome sur Windows" {
		t.Fatalf("got %q / %q", DeviceSignature(a), DeviceSignature(b))
	}
	edge := a + " Edg/129.0"
	if DeviceSignature(edge) != "Edge sur Windows" {
		t.Fatalf("edge: %q", DeviceSignature(edge))
	}
	if DeviceSignature("okhttp/4.12.0") != "application TBK sur mobile" {
		t.Fatalf("app: %q", DeviceSignature("okhttp/4.12.0"))
	}
}
