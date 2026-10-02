package notify

import (
	"log"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
)

// PushQueue receives notifications that should be pushed to the recipient's
// devices. The push package implements it.
type PushQueue interface {
	Enqueue(n *models.Notification, to Principal, spec Spec, links Links)
}

// Observer is installed on the notification repository: every notification
// written anywhere in the backend is classified here, then pushed when the
// recipient's preferences allow it.
type Observer struct {
	db    *database.DB
	prefs *Prefs
	queue PushQueue
}

func NewObserver(db *database.DB, prefs *Prefs, queue PushQueue) *Observer {
	return &Observer{db: db, prefs: prefs, queue: queue}
}

// Metadata keys written on every notification.
const (
	MetaAudience = "audience"
	MetaCategory = "category"
	MetaPriority = "priority"
	MetaLink     = "link"
	MetaAppLink  = "app_link"
)

// absorbedBy lists notifications that add nothing when another one reached
// the same person about the same thing moments earlier: DELIVERED already
// asks the buyer to confirm receipt.
var absorbedBy = map[models.NotificationType]models.NotificationType{
	models.NotificationTypeBuyerReceiptRequired: models.NotificationTypeOrderDelivered,
}

const absorbWindow = 10 * time.Minute

// Resolve fills the classification metadata of n and returns its spec.
func Resolve(n *models.Notification) (Spec, string) {
	if n.Metadata == nil {
		n.Metadata = map[string]interface{}{}
	}
	audience := stringMeta(n.Metadata, MetaAudience)
	if audience == "" {
		audience = audBuyer
	}
	spec := SpecFor(n.Type, audience)
	// A caller may raise or lower one notification's priority, e.g. "ready"
	// is urgent for a pickup order and routine for a delivery.
	if p, ok := parsePriority(stringMeta(n.Metadata, MetaPriority)); ok {
		spec.Priority = p
	}
	n.Metadata[MetaCategory] = string(spec.Category)
	n.Metadata[MetaPriority] = string(spec.Priority)
	if stringMeta(n.Metadata, MetaLink) == "" || stringMeta(n.Metadata, MetaAppLink) == "" {
		links := LinksFor(n, audience)
		if stringMeta(n.Metadata, MetaLink) == "" {
			n.Metadata[MetaLink] = links.Web
		}
		if stringMeta(n.Metadata, MetaAppLink) == "" {
			n.Metadata[MetaAppLink] = links.App
		}
	}
	return spec, audience
}

// BeforeCreate classifies n and drops it when it must not reach its recipient.
func (o *Observer) BeforeCreate(n *models.Notification) bool {
	spec, audience := Resolve(n)
	to := PrincipalFor(n.UserID, audience)

	if spec.Category.RequiresConsent() {
		pref, err := o.prefs.Get(to, spec.Category)
		if err != nil || !pref.Consented {
			return false
		}
		if o.prefs.CapReached(n.UserID, spec.Category) {
			return false
		}
	}

	if earlier, ok := absorbedBy[n.Type]; ok {
		var exists bool
		_ = o.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM notifications WHERE user_id = $1 AND type = $2
			AND reference_id = $3 AND created_at >= NOW() - make_interval(secs => $4))`,
			n.UserID, string(earlier), n.ReferenceID, absorbWindow.Seconds()).Scan(&exists)
		if exists {
			return false
		}
	}
	return true
}

// AfterCreate pushes n when its priority and the recipient's settings allow.
func (o *Observer) AfterCreate(n *models.Notification) {
	if o.queue == nil {
		return
	}
	spec, audience := Resolve(n)
	if spec.Priority == PriorityLow {
		return
	}
	to := PrincipalFor(n.UserID, audience)
	pref, err := o.prefs.Get(to, spec.Category)
	if err != nil {
		log.Printf("notify: preferences of %s/%s: %v", to.Kind, to.ID, err)
		return
	}
	if !pref.PushEnabled {
		return
	}
	o.queue.Enqueue(n, to, spec, Links{Web: stringMeta(n.Metadata, MetaLink), App: stringMeta(n.Metadata, MetaAppLink)})
}
