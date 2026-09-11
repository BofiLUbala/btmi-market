package communication

import (
	"net/http"
	"strconv"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	commService *service.CommunicationService
}

func NewHandler(commService *service.CommunicationService) *Handler {
	return &Handler{commService: commService}
}

func (h *Handler) errResponse(c *gin.Context, statusCode int, errorCode, message string) {
	c.JSON(statusCode, models.ErrorResponse{
		Error: struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}{
			Code:    errorCode,
			Message: message,
		},
	})
}

func (h *Handler) extractUserID(c *gin.Context) (uuid.UUID, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		h.errResponse(c, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated")
		return uuid.Nil, false
	}
	return userID.(uuid.UUID), true
}

func (h *Handler) extractAdmin(c *gin.Context) (uuid.UUID, string, string, bool) {
	adminID, exists := c.Get("admin_id")
	if !exists {
		h.errResponse(c, http.StatusUnauthorized, "UNAUTHORIZED", "Admin not authenticated")
		return uuid.Nil, "", "", false
	}
	role, _ := c.Get("admin_role")
	email, _ := c.Get("admin_email")

	roleStr := ""
	if role != nil {
		roleStr = string(role.(models.AdminRole))
	}
	emailStr := ""
	if email != nil {
		emailStr = email.(string)
	}

	return adminID.(uuid.UUID), roleStr, emailStr, true
}

func (h *Handler) parseUUIDParam(c *gin.Context, paramName string) (uuid.UUID, bool) {
	paramStr := c.Param(paramName)
	id, err := uuid.Parse(paramStr)
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_ID", "Invalid "+paramName+" format")
		return uuid.Nil, false
	}
	return id, true
}

// GetOrderConversation handles GET /api/v1/orders/:id/conversation
func (h *Handler) GetOrderConversation(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	orderID, ok := h.parseUUIDParam(c, "id")
	if !ok {
		return
	}

	detail, err := h.commService.GetOrderConversationDetail(orderID, userID, "", false)
	if err != nil {
		if err.Error() == "FORBIDDEN" {
			h.errResponse(c, http.StatusForbidden, "FORBIDDEN", "You are not authorized to view this conversation")
			return
		}
		h.errResponse(c, http.StatusInternalServerError, "CONVERSATION_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, detail)
}

// SendMessage handles POST /api/v1/orders/:id/messages
func (h *Handler) SendMessage(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	orderID, ok := h.parseUUIDParam(c, "id")
	if !ok {
		return
	}

	var req models.SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Message body is required")
		return
	}

	msg, err := h.commService.SendMessage(orderID, userID, "", "", req.Body)
	if err != nil {
		if err.Error() == "FORBIDDEN" {
			h.errResponse(c, http.StatusForbidden, "FORBIDDEN", "You are not allowed to send messages in this conversation")
			return
		}
		if err.Error() == "MESSAGE_BODY_REQUIRED" {
			h.errResponse(c, http.StatusBadRequest, "MESSAGE_BODY_REQUIRED", "Message body cannot be empty")
			return
		}
		h.errResponse(c, http.StatusInternalServerError, "SEND_MESSAGE_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusCreated, msg)
}

// ListBuyerConversations handles GET /api/v1/buyer/conversations
func (h *Handler) ListBuyerConversations(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	items, total, err := h.commService.ListBuyerConversations(userID, limit, offset)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "LIST_CONVERSATIONS_FAILED", err.Error())
		return
	}

	if items == nil {
		items = []models.ConversationListItemResponse{}
	}

	c.JSON(http.StatusOK, gin.H{
		"items":  items,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetBuyerUnreadCounts handles GET /api/v1/buyer/unread-counts
func (h *Handler) GetBuyerUnreadCounts(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	counts, err := h.commService.GetBuyerUnreadCounts(userID)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "UNREAD_COUNTS_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusOK, counts)
}

// ListSellerConversations handles GET /api/v1/seller/conversations
func (h *Handler) ListSellerConversations(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	var shopIDPtr *uuid.UUID
	if shopIDStr := c.Query("shop_id"); shopIDStr != "" {
		if sid, err := uuid.Parse(shopIDStr); err == nil {
			shopIDPtr = &sid
		}
	}

	var businessIDPtr *uuid.UUID
	if busIDStr := c.Query("business_id"); busIDStr != "" {
		if bid, err := uuid.Parse(busIDStr); err == nil {
			businessIDPtr = &bid
		}
	}

	items, total, err := h.commService.ListSellerConversations(userID, shopIDPtr, businessIDPtr, limit, offset)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "LIST_CONVERSATIONS_FAILED", err.Error())
		return
	}

	if items == nil {
		items = []models.ConversationListItemResponse{}
	}

	c.JSON(http.StatusOK, gin.H{
		"items":  items,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetSellerUnreadCounts handles GET /api/v1/seller/unread-counts
func (h *Handler) GetSellerUnreadCounts(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	var shopIDPtr *uuid.UUID
	if shopIDStr := c.Query("shop_id"); shopIDStr != "" {
		if sid, err := uuid.Parse(shopIDStr); err == nil {
			shopIDPtr = &sid
		}
	}

	var businessIDPtr *uuid.UUID
	if busIDStr := c.Query("business_id"); busIDStr != "" {
		if bid, err := uuid.Parse(busIDStr); err == nil {
			businessIDPtr = &bid
		}
	}

	counts, err := h.commService.GetSellerUnreadCounts(userID, shopIDPtr, businessIDPtr)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "UNREAD_COUNTS_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusOK, counts)
}

// ListAdminOrderCommunications handles GET /api/v1/admin/commerce/order-communications
func (h *Handler) ListAdminOrderCommunications(c *gin.Context) {
	_, _, _, ok := h.extractAdmin(c)
	if !ok {
		return
	}

	search := c.Query("search")
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	var shopIDPtr *uuid.UUID
	if shopIDStr := c.Query("shop_id"); shopIDStr != "" {
		if sid, err := uuid.Parse(shopIDStr); err == nil {
			shopIDPtr = &sid
		}
	}

	items, total, err := h.commService.ListAdminConversations(search, status, shopIDPtr, limit, offset)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "ADMIN_CONVERSATIONS_FAILED", err.Error())
		return
	}

	if items == nil {
		items = []models.ConversationListItemResponse{}
	}

	c.JSON(http.StatusOK, gin.H{
		"items":  items,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetAdminOrderConversation handles GET /api/v1/admin/commerce/orders/:id/conversation
func (h *Handler) GetAdminOrderConversation(c *gin.Context) {
	adminID, role, _, ok := h.extractAdmin(c)
	if !ok {
		return
	}

	orderID, ok := h.parseUUIDParam(c, "id")
	if !ok {
		return
	}

	detail, err := h.commService.GetOrderConversationDetail(orderID, adminID, role, true)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "CONVERSATION_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, detail)
}

// AdminIntervene handles POST /api/v1/admin/commerce/orders/:id/intervene
func (h *Handler) AdminIntervene(c *gin.Context) {
	adminID, role, _, ok := h.extractAdmin(c)
	if !ok {
		return
	}

	orderID, ok := h.parseUUIDParam(c, "id")
	if !ok {
		return
	}

	var req models.AdminInterveneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Message body is required")
		return
	}

	adminName := "TBK Commerce Operations"

	msg, err := h.commService.AdminIntervene(orderID, adminID, role, adminName, req.Body, req.RecipientScope, req.RecipientUserID)
	if err != nil {
		if err.Error() == "FORBIDDEN" || err.Error() == "INVALID_RECIPIENT" {
			h.errResponse(c, http.StatusForbidden, "FORBIDDEN", "Only authorized Commerce Admins can intervene")
			return
		}
		h.errResponse(c, http.StatusInternalServerError, "INTERVENTION_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusCreated, msg)
}

// GetUserNotifications handles GET /api/v1/notifications
func (h *Handler) GetUserNotifications(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	notifs, total, err := h.commService.GetUserNotifications(userID, limit, offset)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "NOTIFICATIONS_FAILED", err.Error())
		return
	}

	if notifs == nil {
		notifs = []models.NotificationResponse{}
	}

	c.JSON(http.StatusOK, gin.H{
		"items":  notifs,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// MarkNotificationRead handles POST /api/v1/notifications/:id/read
func (h *Handler) MarkNotificationRead(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	notifID, ok := h.parseUUIDParam(c, "id")
	if !ok {
		return
	}

	if err := h.commService.MarkNotificationAsRead(notifID, userID); err != nil {
		if err == repository.ErrNotificationNotFound {
			h.errResponse(c, http.StatusNotFound, "NOT_FOUND", "Notification not found")
			return
		}
		h.errResponse(c, http.StatusInternalServerError, "MARK_READ_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// MarkAllNotificationsRead handles POST /api/v1/notifications/read-all
func (h *Handler) MarkAllNotificationsRead(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	if err := h.commService.MarkAllNotificationsAsRead(userID); err != nil {
		h.errResponse(c, http.StatusInternalServerError, "MARK_ALL_READ_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// GetUnreadNotificationsCount handles GET /api/v1/notifications/unread-count
func (h *Handler) GetUnreadNotificationsCount(c *gin.Context) {
	userID, ok := h.extractUserID(c)
	if !ok {
		return
	}

	counts, err := h.commService.GetBuyerUnreadCounts(userID)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "UNREAD_COUNT_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"unread_count": counts.UnreadNotifications,
	})
}

// GetAdminNotifications handles GET /api/v1/admin/notifications
func (h *Handler) GetAdminNotifications(c *gin.Context) {
	adminID, _, _, ok := h.extractAdmin(c)
	if !ok {
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	notifs, total, err := h.commService.GetAdminNotifications(adminID, limit, offset)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "NOTIFICATIONS_FAILED", err.Error())
		return
	}

	if notifs == nil {
		notifs = []models.NotificationResponse{}
	}

	c.JSON(http.StatusOK, gin.H{
		"items":  notifs,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// GetAdminUnreadCount handles GET /api/v1/admin/notifications/unread-count
func (h *Handler) GetAdminUnreadCount(c *gin.Context) {
	adminID, _, _, ok := h.extractAdmin(c)
	if !ok {
		return
	}

	count, err := h.commService.GetAdminUnreadCount(adminID)
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "UNREAD_COUNT_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"unread_count": count,
	})
}

// MarkAdminNotificationRead handles POST /api/v1/admin/notifications/:id/read
func (h *Handler) MarkAdminNotificationRead(c *gin.Context) {
	adminID, _, _, ok := h.extractAdmin(c)
	if !ok {
		return
	}

	notifID, ok := h.parseUUIDParam(c, "id")
	if !ok {
		return
	}

	if err := h.commService.MarkAdminNotificationRead(notifID, adminID); err != nil {
		if err == repository.ErrNotificationNotFound {
			h.errResponse(c, http.StatusNotFound, "NOT_FOUND", "Notification not found")
			return
		}
		h.errResponse(c, http.StatusInternalServerError, "MARK_READ_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// MarkAllAdminNotificationsRead handles POST /api/v1/admin/notifications/read-all
func (h *Handler) MarkAllAdminNotificationsRead(c *gin.Context) {
	adminID, _, _, ok := h.extractAdmin(c)
	if !ok {
		return
	}

	if err := h.commService.MarkAllAdminNotificationsRead(adminID); err != nil {
		h.errResponse(c, http.StatusInternalServerError, "MARK_ALL_READ_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// ConfirmCourierArrival handles POST /api/v1/orders/:id/courier-arrived
func (h *Handler) ConfirmCourierArrival(c *gin.Context) {
	orderID, ok := h.parseUUIDParam(c, "id")
	if !ok {
		return
	}

	var callerID uuid.UUID
	if uid, exists := c.Get("user_id"); exists {
		callerID = uid.(uuid.UUID)
	} else if aid, exists := c.Get("admin_id"); exists {
		callerID = aid.(uuid.UUID)
	} else {
		h.errResponse(c, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	if err := h.commService.ConfirmCourierArrival(orderID, callerID); err != nil {
		h.errResponse(c, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":         "Courier arrival confirmed",
		"order_id":        orderID.String(),
		"delivery_status": "COURIER_ARRIVED",
	})
}

// ConfirmCourierPickedUp handles POST /api/v1/orders/:id/courier-picked-up
func (h *Handler) ConfirmCourierPickedUp(c *gin.Context) {
	orderID, ok := h.parseUUIDParam(c, "id")
	if !ok {
		return
	}

	var callerID uuid.UUID
	if uid, exists := c.Get("user_id"); exists {
		callerID = uid.(uuid.UUID)
	} else if aid, exists := c.Get("admin_id"); exists {
		callerID = aid.(uuid.UUID)
	} else {
		h.errResponse(c, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	if err := h.commService.ConfirmCourierPickedUp(orderID, callerID); err != nil {
		h.errResponse(c, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":         "Courier pickup confirmed",
		"order_id":        orderID.String(),
		"delivery_status": "IN_TRANSIT",
	})
}

// ConfirmCourierNearDestination handles POST /api/v1/orders/:id/courier-near-destination
func (h *Handler) ConfirmCourierNearDestination(c *gin.Context) {
	orderID, ok := h.parseUUIDParam(c, "id")
	if !ok {
		return
	}

	var callerID uuid.UUID
	if uid, exists := c.Get("user_id"); exists {
		callerID = uid.(uuid.UUID)
	} else if aid, exists := c.Get("admin_id"); exists {
		callerID = aid.(uuid.UUID)
	} else {
		h.errResponse(c, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
		return
	}

	if err := h.commService.ConfirmCourierNearDestination(orderID, callerID); err != nil {
		h.errResponse(c, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":         "Courier proximity confirmed",
		"order_id":        orderID.String(),
		"delivery_status": "NEAR_DESTINATION",
	})
}
