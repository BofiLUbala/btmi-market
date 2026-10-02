// Package notifications serves push registration, notification preferences,
// followed products and marketing campaigns, for users and admins alike.
package notifications

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/notify"
	"github.com/btmi-ai-market/backend/internal/push"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	db       *database.DB
	push     *push.Dispatcher
	prefs    *notify.Prefs
	notifier *notify.Notifier
	audit    *service.AuditService
}

func NewHandler(db *database.DB, dispatcher *push.Dispatcher, prefs *notify.Prefs, notifier *notify.Notifier, audit *service.AuditService) *Handler {
	return &Handler{db: db, push: dispatcher, prefs: prefs, notifier: notifier, audit: audit}
}

func fail(c *gin.Context, status int, code, msg string) {
	c.JSON(status, models.ErrorResponse{Error: struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}{Code: code, Message: msg}})
}

// principal is the caller: an admin on admin routes, a user elsewhere.
func principal(c *gin.Context) (notify.Principal, bool) {
	if v, ok := c.Get("admin_id"); ok {
		if id, ok := v.(uuid.UUID); ok {
			return notify.Principal{Kind: notify.KindAdmin, ID: id}, true
		}
	}
	if v, ok := c.Get("user_id"); ok {
		if id, ok := v.(uuid.UUID); ok {
			return notify.Principal{Kind: notify.KindUser, ID: id}, true
		}
	}
	fail(c, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
	return notify.Principal{}, false
}

// Config handles GET /push/config (public): what a client needs to subscribe.
func (h *Handler) Config(c *gin.Context) {
	c.JSON(http.StatusOK, h.push.PublicConfig())
}

type subscribeRequest struct {
	Platform string `json:"platform"`
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
	ExpoToken   string `json:"expo_token"`
	DeviceLabel string `json:"device_label"`
}

// Subscribe handles POST /push/subscriptions: registers this device for the
// signed-in account (moving it away from any previous account).
func (h *Handler) Subscribe(c *gin.Context) {
	pr, ok := principal(c)
	if !ok {
		return
	}
	var req subscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	cfg := h.push.PublicConfig()
	var id uuid.UUID
	var err error
	switch strings.ToUpper(req.Platform) {
	case push.PlatformWeb:
		if !cfg.WebEnabled {
			fail(c, http.StatusServiceUnavailable, "WEB_PUSH_DISABLED", "Web push is not enabled on this server")
			return
		}
		id, err = h.push.Store().RegisterWeb(pr, req.Endpoint, req.Keys.P256dh, req.Keys.Auth, h.push.VAPIDKeyID(), req.DeviceLabel, c.Request.UserAgent())
	case push.PlatformExpo:
		if !cfg.ExpoEnabled {
			fail(c, http.StatusServiceUnavailable, "MOBILE_PUSH_DISABLED", "Mobile push is not enabled on this server")
			return
		}
		id, err = h.push.Store().RegisterExpo(pr, req.ExpoToken, req.DeviceLabel, c.Request.UserAgent())
	default:
		fail(c, http.StatusBadRequest, "INVALID_PLATFORM", "platform must be WEB or EXPO")
		return
	}
	switch {
	case errors.Is(err, push.ErrInvalidEndpoint), errors.Is(err, push.ErrInvalidKeys), errors.Is(err, push.ErrInvalidExpoToken):
		fail(c, http.StatusBadRequest, err.Error(), "Invalid push subscription")
		return
	case err != nil:
		log.Printf("push: subscribe: %v", err)
		fail(c, http.StatusInternalServerError, "SUBSCRIBE_FAILED", "Could not register this device")
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id})
}

type unregisterRequest struct {
	Endpoint  string `json:"endpoint"`
	ExpoToken string `json:"expo_token"`
}

// Unregister handles POST /push/unregister (public): the caller proves it
// holds the device by sending its secret endpoint or token. Used at sign-out,
// and when a signed-out app finds it still has a subscription.
func (h *Handler) Unregister(c *gin.Context) {
	var req unregisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	v := req.Endpoint
	if v == "" {
		v = req.ExpoToken
	}
	if err := h.push.Store().Unregister(v); err != nil && !errors.Is(err, push.ErrNotFound) {
		fail(c, http.StatusInternalServerError, "UNREGISTER_FAILED", "Could not unregister this device")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "unregistered"})
}

// ListDevices handles GET /push/subscriptions.
func (h *Handler) ListDevices(c *gin.Context) {
	pr, ok := principal(c)
	if !ok {
		return
	}
	subs, err := h.push.Store().List(pr)
	if err != nil {
		fail(c, http.StatusInternalServerError, "DEVICES_FAILED", "Could not list devices")
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": subs})
}

// RemoveDevice handles DELETE /push/subscriptions/:id.
func (h *Handler) RemoveDevice(c *gin.Context) {
	pr, ok := principal(c)
	if !ok {
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		fail(c, http.StatusBadRequest, "INVALID_ID", "Invalid device id")
		return
	}
	if err := h.push.Store().Revoke(pr, id); err != nil {
		if errors.Is(err, push.ErrNotFound) {
			fail(c, http.StatusNotFound, "DEVICE_NOT_FOUND", "Device not found")
			return
		}
		fail(c, http.StatusInternalServerError, "REMOVE_FAILED", "Could not remove device")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "removed"})
}

// Test handles POST /push/test: a notification to the caller's own devices.
func (h *Handler) Test(c *gin.Context) {
	pr, ok := principal(c)
	if !ok {
		return
	}
	audience := strings.ToUpper(c.DefaultQuery("audience", "BUYER"))
	if pr.Kind == notify.KindAdmin {
		audience = "ADMIN"
	} else if audience != "BUYER" && audience != "SELLER" && audience != "COURIER" {
		audience = "BUYER"
	}
	m := notify.Message{
		Type:    models.NotificationTypePushTest,
		Title:   "Notifications activées",
		Body:    "Cet appareil recevra vos alertes TBK.",
		RefType: notify.RefAccount, RefID: pr.ID,
	}
	if pr.Kind == notify.KindAdmin {
		h.notifier.ToAdmin(pr.ID, m)
	} else {
		h.notifier.ToUser(pr.ID, audience, m)
	}
	c.JSON(http.StatusOK, gin.H{"message": "sent"})
}

// Preferences handles GET /notifications/preferences.
func (h *Handler) Preferences(c *gin.Context) {
	pr, ok := principal(c)
	if !ok {
		return
	}
	prefs, err := h.prefs.All(pr)
	if err != nil {
		fail(c, http.StatusInternalServerError, "PREFERENCES_FAILED", "Could not load preferences")
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": prefs, "push": h.push.PublicConfig()})
}

type preferenceRequest struct {
	PushEnabled *bool `json:"push_enabled"`
	Consent     *bool `json:"consent"`
}

// UpdatePreference handles PUT /notifications/preferences/:category.
func (h *Handler) UpdatePreference(c *gin.Context) {
	pr, ok := principal(c)
	if !ok {
		return
	}
	cat, ok := notify.ParseCategory(strings.ToUpper(c.Param("category")))
	if !ok {
		fail(c, http.StatusBadRequest, "INVALID_CATEGORY", "Unknown category")
		return
	}
	var req preferenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	pref, err := h.prefs.Update(pr, cat, req.PushEnabled, req.Consent, "settings")
	if errors.Is(err, notify.ErrCategoryLocked) {
		fail(c, http.StatusConflict, "CATEGORY_LOCKED", "Security alerts cannot be turned off")
		return
	}
	if err != nil {
		fail(c, http.StatusInternalServerError, "PREFERENCE_FAILED", "Could not save preference")
		return
	}
	c.JSON(http.StatusOK, pref)
}

// maxWatches bounds how many products one buyer can follow.
const maxWatches = 500

// ListWatches handles GET /watches: the product ids the caller follows.
func (h *Handler) ListWatches(c *gin.Context) {
	pr, ok := principal(c)
	if !ok {
		return
	}
	rows, err := h.db.Query(`SELECT product_id FROM product_watches WHERE user_id = $1 ORDER BY created_at DESC`, pr.ID)
	if err != nil {
		fail(c, http.StatusInternalServerError, "WATCHES_FAILED", "Could not list followed products")
		return
	}
	defer rows.Close()
	ids := []string{}
	for rows.Next() {
		var id uuid.UUID
		if rows.Scan(&id) == nil {
			ids = append(ids, id.String())
		}
	}
	c.JSON(http.StatusOK, gin.H{"product_ids": ids})
}

func (h *Handler) watch(userID uuid.UUID, productIDs []uuid.UUID) error {
	var count int
	_ = h.db.QueryRow(`SELECT COUNT(*) FROM product_watches WHERE user_id = $1`, userID).Scan(&count)
	for _, pid := range productIDs {
		if count >= maxWatches {
			return errors.New("WATCH_LIMIT_REACHED")
		}
		res, err := h.db.Exec(`INSERT INTO product_watches (user_id, product_id)
			SELECT $1, p.id FROM products p WHERE p.id = $2 AND p.publication_status = 'PUBLISHED'
			ON CONFLICT DO NOTHING`, userID, pid)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n > 0 {
			count++
		}
	}
	return nil
}

// Watch handles PUT /watches/:productId (adding a favourite).
func (h *Handler) Watch(c *gin.Context) {
	pr, ok := principal(c)
	if !ok {
		return
	}
	pid, err := uuid.Parse(c.Param("productId"))
	if err != nil {
		fail(c, http.StatusBadRequest, "INVALID_ID", "Invalid product id")
		return
	}
	if err := h.watch(pr.ID, []uuid.UUID{pid}); err != nil {
		fail(c, http.StatusBadRequest, err.Error(), "Could not follow this product")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "following"})
}

// Unwatch handles DELETE /watches/:productId.
func (h *Handler) Unwatch(c *gin.Context) {
	pr, ok := principal(c)
	if !ok {
		return
	}
	pid, err := uuid.Parse(c.Param("productId"))
	if err != nil {
		fail(c, http.StatusBadRequest, "INVALID_ID", "Invalid product id")
		return
	}
	_, _ = h.db.Exec(`DELETE FROM product_watches WHERE user_id = $1 AND product_id = $2`, pr.ID, pid)
	c.JSON(http.StatusOK, gin.H{"message": "unfollowed"})
}

type syncWatchesRequest struct {
	ProductIDs []string `json:"product_ids"`
}

// SyncWatches handles POST /watches/sync: favourites saved on a device before
// sign-in are merged into the account.
func (h *Handler) SyncWatches(c *gin.Context) {
	pr, ok := principal(c)
	if !ok {
		return
	}
	var req syncWatchesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	ids := make([]uuid.UUID, 0, len(req.ProductIDs))
	for _, raw := range req.ProductIDs {
		if id, err := uuid.Parse(raw); err == nil {
			ids = append(ids, id)
		}
		if len(ids) >= maxWatches {
			break
		}
	}
	if err := h.watch(pr.ID, ids); err != nil && err.Error() != "WATCH_LIMIT_REACHED" {
		fail(c, http.StatusInternalServerError, "SYNC_FAILED", "Could not save followed products")
		return
	}
	h.ListWatches(c)
}

// Stats handles GET /admin/push/stats (technical console).
func (h *Handler) Stats(c *gin.Context) {
	st, err := h.push.Stats()
	if err != nil {
		fail(c, http.StatusInternalServerError, "STATS_FAILED", "Could not read push statistics")
		return
	}
	c.JSON(http.StatusOK, gin.H{"stats": st, "config": h.push.PublicConfig()})
}

type campaignRequest struct {
	Title      string `json:"title" binding:"required"`
	Body       string `json:"body" binding:"required"`
	TargetPath string `json:"target_path"`
	DryRun     bool   `json:"dry_run"`
}

// consentingBuyers lists active users who opted in to marketing.
func (h *Handler) consentingBuyers() ([]uuid.UUID, error) {
	rows, err := h.db.Query(`SELECT np.principal_id FROM notification_preferences np
		JOIN users u ON u.id = np.principal_id AND u.status = 'ACTIVE'
		WHERE np.principal_kind = 'USER' AND np.category = 'MARKETING' AND np.consented_at IS NOT NULL`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	return ids, rows.Err()
}

// Campaign handles POST /admin/commerce/notifications/campaigns. Only buyers
// who opted in receive it, and the frequency caps still apply to each of them.
func (h *Handler) Campaign(c *gin.Context) {
	var req campaignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	req.Body = strings.TrimSpace(req.Body)
	if utf8.RuneCountInString(req.Title) < 3 || utf8.RuneCountInString(req.Title) > 80 ||
		utf8.RuneCountInString(req.Body) < 5 || utf8.RuneCountInString(req.Body) > 240 {
		fail(c, http.StatusBadRequest, "INVALID_CAMPAIGN", "Title 3-80 characters, message 5-240 characters")
		return
	}
	target := "/"
	if strings.TrimSpace(req.TargetPath) != "" {
		target = notify.SafeInternalPath(req.TargetPath)
		if target == "" {
			fail(c, http.StatusBadRequest, "INVALID_TARGET", "The link must be a page of TBK, such as /products/…")
			return
		}
	}
	recipients, err := h.consentingBuyers()
	if err != nil {
		fail(c, http.StatusInternalServerError, "CAMPAIGN_FAILED", "Could not resolve recipients")
		return
	}
	if req.DryRun {
		c.JSON(http.StatusOK, gin.H{"recipients": len(recipients)})
		return
	}
	campaignID := uuid.New()
	adminID, _ := c.Get("admin_id")
	role, _ := c.Get("admin_role")
	if h.audit != nil {
		aid, _ := adminID.(uuid.UUID)
		ar, _ := role.(models.AdminRole)
		_ = h.audit.Record(aid, ar, "MARKETING_CAMPAIGN_SENT", "CAMPAIGN", campaignID.String(), req.Title, nil,
			map[string]interface{}{"title": req.Title, "body": req.Body, "target_path": target, "recipients": len(recipients)},
			c.ClientIP(), c.Request.UserAgent())
	}
	go func() {
		for _, uid := range recipients {
			h.notifier.ToUser(uid, "BUYER", notify.Message{
				Type:    models.NotificationTypeMarketingCampaign,
				Title:   req.Title,
				Body:    req.Body,
				RefType: notify.RefCampaign, RefID: campaignID,
				Meta:    map[string]interface{}{"target_path": target, "campaign_id": campaignID.String()},
			})
		}
	}()
	c.JSON(http.StatusAccepted, gin.H{"campaign_id": campaignID, "recipients": len(recipients)})
}
