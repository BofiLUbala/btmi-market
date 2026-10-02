package notify

import (
	"fmt"
	"log"
	"strings"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

// Message is one notification to write for one or several recipients.
type Message struct {
	Type    models.NotificationType
	Title   string
	Body    string
	RefType string
	RefID   uuid.UUID
	Meta    map[string]interface{}
}

// Notifier writes notifications for the events that live outside the order
// lifecycle (shops, catalogue, security, marketing...). Recipients are always
// resolved here from the database, never taken from a client request.
type Notifier struct {
	db   *database.DB
	repo *repository.NotificationRepository
}

func NewNotifier(db *database.DB, repo *repository.NotificationRepository) *Notifier {
	return &Notifier{db: db, repo: repo}
}

func (n *Notifier) write(uid uuid.UUID, audience string, m Message) {
	meta := make(map[string]interface{}, len(m.Meta)+1)
	for k, v := range m.Meta {
		meta[k] = v
	}
	meta[MetaAudience] = audience
	if err := n.repo.Create(&models.Notification{
		UserID:        uid,
		Type:          m.Type,
		Title:         m.Title,
		Body:          m.Body,
		ReferenceType: m.RefType,
		ReferenceID:   m.RefID,
		Metadata:      meta,
	}); err != nil {
		log.Printf("notify: %s for %s: %v", m.Type, uid, err)
	}
}

// ToUser notifies one user in one space (BUYER, SELLER or COURIER).
func (n *Notifier) ToUser(uid uuid.UUID, audience string, m Message) {
	if n == nil || uid == uuid.Nil {
		return
	}
	n.write(uid, audience, m)
}

// ToBusiness notifies a business's active members in the seller space. With
// managersOnly, only owners and admins of the business are told (shop status,
// moderation, team changes).
func (n *Notifier) ToBusiness(businessID uuid.UUID, managersOnly bool, m Message) {
	if n == nil || businessID == uuid.Nil {
		return
	}
	query := `SELECT user_id FROM business_memberships WHERE business_id = $1 AND status = 'ACTIVE'`
	if managersOnly {
		query += ` AND role IN ('OWNER', 'ADMIN')`
	}
	for _, uid := range n.ids(query, businessID) {
		n.write(uid, audSeller, m)
	}
}

// ToAdmins notifies every active admin holding one of roles (SUPER_ADMIN is
// always included).
func (n *Notifier) ToAdmins(roles []string, m Message) {
	if n == nil {
		return
	}
	set := map[string]bool{"SUPER_ADMIN": true}
	for _, r := range roles {
		set[r] = true
	}
	args := []interface{}{}
	ph := []string{}
	for r := range set {
		args = append(args, r)
		ph = append(ph, fmt.Sprintf("$%d", len(args)))
	}
	for _, aid := range n.ids(`SELECT id FROM admin_users WHERE status = 'ACTIVE' AND role IN (`+strings.Join(ph, ",")+`)`, args...) {
		n.write(aid, audAdmin, m)
	}
}

// ToAdmin notifies one admin.
func (n *Notifier) ToAdmin(adminID uuid.UUID, m Message) {
	if n == nil || adminID == uuid.Nil {
		return
	}
	n.write(adminID, audAdmin, m)
}

func (n *Notifier) ids(query string, args ...interface{}) []uuid.UUID {
	rows, err := n.db.Query(query, args...)
	if err != nil {
		log.Printf("notify: recipients: %v", err)
		return nil
	}
	defer rows.Close()
	var out []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if rows.Scan(&id) == nil {
			out = append(out, id)
		}
	}
	return out
}

// ReviewReply tells a review's author that someone answered it (the shop,
// usually). Nobody is told about their own reply.
func (n *Notifier) ReviewReply(reviewID, replierID uuid.UUID) {
	if n == nil {
		return
	}
	var authorID, businessID uuid.UUID
	var productName, shopName string
	var replierIsSeller bool
	err := n.db.QueryRow(`SELECT bp.user_id, r.business_id, COALESCE(p.name, ''), COALESCE(sh.name, ''),
			EXISTS (SELECT 1 FROM business_memberships bm WHERE bm.business_id = r.business_id AND bm.user_id = $2 AND bm.status = 'ACTIVE')
		FROM seller_reviews r
		JOIN buyer_profiles bp ON bp.id = r.buyer_profile_id
		LEFT JOIN products p ON p.id = r.product_id
		LEFT JOIN shops sh ON sh.id = r.shop_id
		WHERE r.id = $1`, reviewID, replierID).Scan(&authorID, &businessID, &productName, &shopName, &replierIsSeller)
	if err != nil || authorID == replierID {
		return
	}
	title := "Nouvelle réponse à votre avis"
	if replierIsSeller && shopName != "" {
		title = shopName + " a répondu à votre avis"
	}
	body := "Consultez la réponse dans vos avis."
	if productName != "" {
		body = "Votre avis sur « " + productName + " » a reçu une réponse."
	}
	n.ToUser(authorID, audBuyer, Message{
		Type: models.NotificationTypeReviewReply, Title: title, Body: body,
		RefType: RefReview, RefID: reviewID,
	})
}
