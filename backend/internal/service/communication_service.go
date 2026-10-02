package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type CommunicationService struct {
	orderConvRepo  *repository.OrderConversationRepository
	notifRepo      *repository.NotificationRepository
	orderRepo      *repository.OrderRepository
	shopRepo       *repository.ShopRepository
	businessRepo   *repository.BusinessRepository
	buyerRepo      *repository.BuyerProfileRepository
	userRepo       *repository.UserRepository
	membershipRepo *repository.MembershipRepository
	db             *database.DB
}

func NewCommunicationService(
	orderConvRepo *repository.OrderConversationRepository,
	notifRepo *repository.NotificationRepository,
	orderRepo *repository.OrderRepository,
	shopRepo *repository.ShopRepository,
	businessRepo *repository.BusinessRepository,
	buyerRepo *repository.BuyerProfileRepository,
	userRepo *repository.UserRepository,
	membershipRepo *repository.MembershipRepository,
	db *database.DB,
) *CommunicationService {
	return &CommunicationService{
		orderConvRepo:  orderConvRepo,
		notifRepo:      notifRepo,
		orderRepo:      orderRepo,
		shopRepo:       shopRepo,
		businessRepo:   businessRepo,
		buyerRepo:      buyerRepo,
		userRepo:       userRepo,
		membershipRepo: membershipRepo,
		db:             db,
	}
}

// resolveBuyerUserID returns the user_id corresponding to an order's buyer.
func (s *CommunicationService) resolveBuyerUserID(order *models.Order) (uuid.UUID, error) {
	if order.BuyerProfileID != nil && *order.BuyerProfileID != uuid.Nil {
		buyerProfile, err := s.buyerRepo.GetByID(*order.BuyerProfileID)
		if err == nil && buyerProfile != nil {
			return buyerProfile.UserID, nil
		}
	}
	if order.CustomerID != nil && *order.CustomerID != uuid.Nil {
		return *order.CustomerID, nil
	}
	if order.CreatedBy != nil && *order.CreatedBy != uuid.Nil {
		return *order.CreatedBy, nil
	}
	return uuid.Nil, errors.New("cannot resolve buyer user ID for order")
}

// getBusinessUserIDs returns all active user IDs in the given business.
func (s *CommunicationService) getBusinessUserIDs(businessID uuid.UUID) ([]uuid.UUID, error) {
	query := `SELECT user_id FROM business_memberships WHERE business_id = $1 AND status = 'ACTIVE'`
	rows, err := s.db.Query(query, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var userIDs []uuid.UUID
	for rows.Next() {
		var uid uuid.UUID
		if err := rows.Scan(&uid); err == nil {
			userIDs = append(userIDs, uid)
		}
	}
	return userIDs, nil
}

// getOrderParticipants is the authorization source for targeted admin messages.
// It deliberately derives participants from the order's buyer/business/shop and
// never accepts arbitrary frontend-provided people.
func (s *CommunicationService) getOrderParticipants(conv *models.OrderConversation) ([]models.OrderConversationParticipant, error) {
	rows, err := s.db.Query(`
		WITH participants AS (
			SELECT u.id AS user_id, TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS name, 'BUYER' AS type
			FROM users u WHERE u.id = $1
			UNION
			SELECT u.id, TRIM(CONCAT(u.first_name, ' ', u.last_name)), 'SELLER_OWNER'
			FROM business_memberships bm JOIN users u ON u.id = bm.user_id
			WHERE bm.business_id = $2 AND bm.role = 'OWNER' AND bm.status = 'ACTIVE' AND u.status = 'ACTIVE'
			UNION
			SELECT u.id, TRIM(CONCAT(e.first_name, ' ', e.last_name)), 'EMPLOYEE'
			FROM employees e
			JOIN users u ON u.id = e.linked_user_id
			JOIN employee_shop_assignments esa ON esa.employee_id = e.id
			WHERE e.business_id = $2 AND e.status = 'ACTIVE' AND u.status = 'ACTIVE'
			  AND esa.shop_id = $3 AND esa.status = 'ACTIVE'
		)
		SELECT p.user_id, COALESCE(NULLIF(p.name, ''), u.email), p.type, r.last_read_at
		FROM participants p JOIN users u ON u.id = p.user_id
		LEFT JOIN order_conversation_reads r ON r.conversation_id = $4 AND r.user_id = p.user_id
		ORDER BY CASE p.type WHEN 'BUYER' THEN 1 WHEN 'SELLER_OWNER' THEN 2 ELSE 3 END, p.name
	`, conv.BuyerID, conv.BusinessID, conv.ShopID, conv.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	participants := []models.OrderConversationParticipant{}
	for rows.Next() {
		var p models.OrderConversationParticipant
		if err := rows.Scan(&p.UserID, &p.Name, &p.Type, &p.LastReadAt); err != nil {
			return nil, err
		}
		participants = append(participants, p)
	}
	return participants, rows.Err()
}

func (s *CommunicationService) markConversationRead(conversationID, userID uuid.UUID) {
	_, _ = s.db.Exec(`INSERT INTO order_conversation_reads (conversation_id, user_id, last_read_at)
		VALUES ($1,$2,NOW()) ON CONFLICT (conversation_id,user_id) DO UPDATE SET last_read_at=NOW()`, conversationID, userID)
}

// EnsureOrderConversation idempotently creates or retrieves the conversation for an order.
func (s *CommunicationService) EnsureOrderConversation(orderID uuid.UUID) (*models.OrderConversation, error) {
	// First check if conversation already exists
	conv, err := s.orderConvRepo.GetConversationByOrderID(orderID)
	if err == nil && conv != nil {
		return conv, nil
	}

	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, fmt.Errorf("order not found: %w", err)
	}

	buyerUserID, err := s.resolveBuyerUserID(order)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve buyer user ID: %w", err)
	}

	return s.orderConvRepo.CreateOrGetConversation(order.ID, buyerUserID, order.ShopID, order.BusinessID)
}

// callerParties lists the sides userID holds on this order. Someone can be,
// for instance, both the courier and a buyer of the same order in tests.
func (s *CommunicationService) callerParties(conv *models.OrderConversation, order *models.Order, userID uuid.UUID) (parties []models.Party, isEmployee bool) {
	if conv.BuyerID == userID {
		parties = append(parties, models.PartyBuyer)
	}
	if membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, conv.BusinessID); err == nil && membership != nil {
		parties = append(parties, models.PartySeller)
		isEmployee = membership.Role == models.MembershipRoleEmployee
	}
	if order.AssignedCourierID != nil && *order.AssignedCourierID == userID {
		parties = append(parties, models.PartyCourier)
	}
	return parties, isEmployee
}

// resolveParty picks the caller's side: the requested one when they hold it,
// otherwise their first. FORBIDDEN when they have no side on this order.
func (s *CommunicationService) resolveParty(conv *models.OrderConversation, order *models.Order, userID uuid.UUID, requested string) (models.Party, bool, error) {
	parties, isEmployee := s.callerParties(conv, order, userID)
	if len(parties) == 0 {
		return "", false, errors.New("FORBIDDEN")
	}
	if requested == "" {
		return parties[0], isEmployee, nil
	}
	want, ok := models.ParseParty(requested)
	if !ok {
		return "", false, errors.New("FORBIDDEN")
	}
	for _, p := range parties {
		if p == want {
			return p, isEmployee, nil
		}
	}
	return "", false, errors.New("FORBIDDEN")
}

func (s *CommunicationService) displayName(userID uuid.UUID) string {
	user, _ := s.userRepo.GetByID(userID)
	if user == nil {
		return ""
	}
	if name := strings.TrimSpace(user.FirstName + " " + user.LastName); name != "" {
		return name
	}
	return user.Email
}

// contactsFor lists the channels party may open on this order, with who is
// behind each one and how many unread messages it holds.
func (s *CommunicationService) contactsFor(conv *models.OrderConversation, order *models.Order, party models.Party, shopName, buyerName string) []models.ChannelContact {
	unread, _ := s.orderConvRepo.UnreadByContact(conv.ID, party)
	contacts := []models.ChannelContact{}
	for _, p := range models.AllowedRecipients(party) {
		c := models.ChannelContact{Party: p, Available: true, Unread: unread[p]}
		switch p {
		case models.PartyBuyer:
			c.Name = buyerName
		case models.PartySeller:
			c.Name = shopName
		case models.PartyCourier:
			courierID := s.resolveCourierUserID(order)
			c.Available = courierID != uuid.Nil
			if c.Available {
				c.Name = s.displayName(courierID)
			}
		case models.PartyAdmin:
			c.Name = "Support TBK"
		}
		contacts = append(contacts, c)
	}
	return contacts
}

// GetOrderConversationDetail returns the caller's private channels on an order.
// Admins act as the ADMIN party; everyone else as their side of the order
// (requestedParty picks one when they hold several).
//
// markRead keeps the legacy behaviour (every message to the caller's side is
// marked read on each fetch) for installed apps that rely on it. Current
// clients pass false and call MarkChannelRead for the thread actually shown,
// so a background refresh or another tab never clears unread messages.
func (s *CommunicationService) GetOrderConversationDetail(orderID uuid.UUID, callerUserID uuid.UUID, requestedParty string, isCommerceAdmin bool, markRead bool) (*models.OrderConversationDetailResponse, error) {
	conv, err := s.EnsureOrderConversation(orderID)
	if err != nil {
		return nil, err
	}

	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, err
	}

	party := models.PartyAdmin
	if !isCommerceAdmin {
		party, _, err = s.resolveParty(conv, order, callerUserID, requestedParty)
		if err != nil {
			return nil, err
		}
	}
	if markRead {
		if !isCommerceAdmin {
			s.markConversationRead(conv.ID, callerUserID)
		}
		_ = s.orderConvRepo.MarkReadForParty(conv.ID, party)
	}

	messages, err := s.orderConvRepo.GetMessagesForParty(conv.ID, party)
	if err != nil {
		return nil, err
	}
	if messages == nil {
		messages = []models.OrderMessage{}
	}

	var shopName, businessName string
	shop, _ := s.shopRepo.GetByID(conv.ShopID)
	if shop != nil {
		shopName = shop.Name
	}
	business, _ := s.businessRepo.GetByID(conv.BusinessID)
	if business != nil {
		businessName = business.Name
	}
	buyerName := s.displayName(conv.BuyerID)

	// Only admins get the list of the seller team's members.
	participants := []models.OrderConversationParticipant{}
	if isCommerceAdmin {
		participants, err = s.getOrderParticipants(conv)
		if err != nil {
			return nil, err
		}
	}

	return &models.OrderConversationDetailResponse{
		Conversation:   *conv,
		OrderNumber:    order.OrderNumber,
		OrderStatus:    string(order.Status),
		DeliveryMethod: order.DeliveryMethod,
		FinalTotal:     order.FinalTotal,
		ShopName:       shopName,
		BusinessName:   businessName,
		BuyerName:      buyerName,
		Participants:   participants,
		MyParty:        party,
		Contacts:       s.contactsFor(conv, order, party, shopName, buyerName),
		Messages:       messages,
	}, nil
}

// MarkChannelRead marks read the messages contact sent to the caller's side on
// this order: only the thread the caller has open on screen.
func (s *CommunicationService) MarkChannelRead(orderID, callerUserID uuid.UUID, requestedParty, contact string, isCommerceAdmin bool) error {
	contactParty, ok := models.ParseParty(contact)
	if !ok {
		return errors.New("INVALID_RECIPIENT")
	}
	conv, err := s.EnsureOrderConversation(orderID)
	if err != nil {
		return err
	}
	party := models.PartyAdmin
	if !isCommerceAdmin {
		order, err := s.orderRepo.GetByID(orderID)
		if err != nil {
			return err
		}
		if party, _, err = s.resolveParty(conv, order, callerUserID, requestedParty); err != nil {
			return err
		}
		s.markConversationRead(conv.ID, callerUserID)
	}
	if !models.CanMessage(party, contactParty) {
		return errors.New("CHANNEL_NOT_ALLOWED")
	}
	return s.orderConvRepo.MarkChannelReadForParty(conv.ID, party, contactParty)
}

func scopeForParty(p models.Party) models.RecipientScope {
	switch p {
	case models.PartyBuyer:
		return models.RecipientScopeBuyer
	case models.PartySeller:
		return models.RecipientScopeSellerOwner
	}
	return models.RecipientScope(p)
}

// SendMessage writes a private message from the sender's side to one
// recipient party. Admin senders (senderRole set) write as ADMIN. A missing
// recipient means the TBK support channel, the one every side has.
func (s *CommunicationService) SendMessage(
	orderID uuid.UUID,
	senderUserID uuid.UUID,
	senderRole string,
	senderName string,
	body string,
	recipient string,
	asParty string,
) (*models.OrderMessage, error) {
	body = strings.TrimSpace(body)
	if body == "" {
		return nil, errors.New("MESSAGE_BODY_REQUIRED")
	}

	conv, err := s.EnsureOrderConversation(orderID)
	if err != nil {
		return nil, err
	}

	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, err
	}

	var senderParty models.Party
	var senderType models.SenderType
	isAdmin := senderRole == "SUPER_ADMIN" || senderRole == "COMMERCE_ADMIN" || senderRole == "ADMIN"
	if isAdmin {
		senderParty = models.PartyAdmin
		senderType = models.SenderTypeCommerceAdmin
		if senderRole == "SUPER_ADMIN" {
			senderType = models.SenderTypeSuperAdmin
		}
	} else {
		var isEmployee bool
		senderParty, isEmployee, err = s.resolveParty(conv, order, senderUserID, asParty)
		if err != nil {
			return nil, err
		}
		switch senderParty {
		case models.PartyBuyer:
			senderType = models.SenderTypeBuyer
		case models.PartySeller:
			senderType = models.SenderTypeSeller
			if isEmployee {
				senderType = models.SenderTypeEmployee
			}
		case models.PartyCourier:
			senderType = models.SenderTypeCourier
		}
	}

	recipientParty := models.PartyAdmin
	if strings.TrimSpace(recipient) != "" {
		p, ok := models.ParseParty(recipient)
		if !ok {
			return nil, errors.New("INVALID_RECIPIENT")
		}
		recipientParty = p
	}
	if !models.CanMessage(senderParty, recipientParty) {
		return nil, errors.New("CHANNEL_NOT_ALLOWED")
	}
	// The courier channel is open before assignment: messages are addressed to
	// the COURIER party, so whoever is assigned later reads them.
	courierID := s.resolveCourierUserID(order)

	if strings.TrimSpace(senderName) == "" {
		senderName = s.displayName(senderUserID)
	}

	now := time.Now()
	msg := &models.OrderMessage{
		ID:                  uuid.New(),
		ConversationID:      conv.ID,
		SenderUserID:        senderUserID,
		SenderType:          senderType,
		SenderName:          senderName,
		Body:                body,
		IsAdminIntervention: isAdmin,
		RecipientScope:      scopeForParty(recipientParty),
		SenderParty:         senderParty,
		RecipientParty:      recipientParty,
		CreatedAt:           now,
	}
	switch recipientParty {
	case models.PartyBuyer:
		id := conv.BuyerID
		msg.RecipientUserID = &id
	case models.PartyCourier:
		if courierID != uuid.Nil {
			msg.RecipientUserID = &courierID
		}
	}
	switch senderParty {
	case models.PartyBuyer:
		msg.ReadByBuyerAt = &now
	case models.PartySeller:
		msg.ReadBySellerAt = &now
	}

	if err := s.orderConvRepo.CreateMessage(msg); err != nil {
		return nil, err
	}

	go s.notifyNewMessage(order, conv, msg)
	return msg, nil
}

// notifyNewMessage alerts only the recipient party of a private message.
func (s *CommunicationService) notifyNewMessage(order *models.Order, conv *models.OrderConversation, msg *models.OrderMessage) {
	orderNum := order.OrderNumber
	if orderNum == "" {
		orderNum = order.ID.String()[:8]
	}
	title := fmt.Sprintf("Nouveau message - Commande %s", orderNum)
	from := msg.SenderName
	if msg.SenderParty == models.PartyAdmin {
		title = fmt.Sprintf("Message de TBK - Commande %s", orderNum)
		from = "Support TBK"
	}
	meta := map[string]interface{}{
		"order_id":        order.ID.String(),
		"order_number":    orderNum,
		"conversation_id": conv.ID.String(),
		"sender_type":     string(msg.SenderType),
		"sender_party":    string(msg.SenderParty),
	}
	notify := func(uid uuid.UUID, audience string) {
		_ = s.notifRepo.Create(&models.Notification{
			UserID:        uid,
			Type:          models.NotificationTypeNewMessage,
			Title:         title,
			Body:          fmt.Sprintf("%s: %s", from, truncateText(msg.Body, 80)),
			ReferenceType: "ORDER",
			ReferenceID:   order.ID,
			Metadata:      withAudience(meta, audience),
		})
	}
	switch msg.RecipientParty {
	case models.PartyBuyer:
		notify(conv.BuyerID, repository.NotificationAudienceBuyer)
	case models.PartySeller:
		ids, _ := s.getBusinessUserIDs(conv.BusinessID)
		for _, uid := range ids {
			notify(uid, repository.NotificationAudienceSeller)
		}
	case models.PartyCourier:
		if id := s.resolveCourierUserID(order); id != uuid.Nil {
			notify(id, repository.NotificationAudienceCourier)
		}
	case models.PartyAdmin:
		ids, _ := s.getAdminUserIDs("SUPER_ADMIN", "COMMERCE_ADMIN")
		for _, uid := range ids {
			notify(uid, repository.NotificationAudienceAdmin)
		}
	}
}

// AdminIntervene sends a private admin message to one party of the order:
// the buyer, the seller team or the courier. Broadcasting to everyone at once
// is no longer possible.
func (s *CommunicationService) AdminIntervene(
	orderID uuid.UUID,
	adminUserID uuid.UUID,
	adminRole string,
	adminName string,
	body string,
	recipientParty string,
	recipientScope models.RecipientScope,
	recipientUserID *uuid.UUID,
) (*models.OrderMessage, error) {
	if adminRole != "COMMERCE_ADMIN" && adminRole != "SUPER_ADMIN" && adminRole != "ADMIN" {
		return nil, errors.New("FORBIDDEN")
	}

	if strings.TrimSpace(adminName) == "" {
		adminName = "TBK Commerce Operations"
	} else if !strings.Contains(adminName, "TBK") {
		adminName = fmt.Sprintf("%s (TBK Admin)", adminName)
	}

	party := strings.TrimSpace(recipientParty)
	if party == "" {
		switch recipientScope {
		case models.RecipientScopeBuyer:
			party = string(models.PartyBuyer)
		case models.RecipientScopeSellerOwner, models.RecipientScopeEmployee:
			party = string(models.PartySeller)
		case "COURIER":
			party = string(models.PartyCourier)
		default:
			return nil, errors.New("INVALID_RECIPIENT")
		}
	}

	msg, err := s.SendMessage(orderID, adminUserID, adminRole, adminName, body, party, "")
	if err != nil {
		return nil, err
	}
	// A specific seller team member may be named, but the channel stays the
	// seller's: the whole team (and nobody else) can read it.
	if msg.RecipientParty == models.PartySeller && recipientUserID != nil {
		msg.RecipientUserID = recipientUserID
		_, _ = s.db.Exec(`UPDATE order_messages SET recipient_user_id=$1 WHERE id=$2`, recipientUserID, msg.ID)
	}
	return msg, nil
}

// ListBuyerConversations returns all conversations for the buyer.
func (s *CommunicationService) ListBuyerConversations(buyerUserID uuid.UUID, withMessages bool, limit, offset int) ([]models.ConversationListItemResponse, int, error) {
	return s.orderConvRepo.ListBuyerConversations(buyerUserID, withMessages, limit, offset)
}

// ListSellerConversations returns conversations for the seller.
func (s *CommunicationService) ListSellerConversations(sellerUserID uuid.UUID, shopID *uuid.UUID, businessID *uuid.UUID, withMessages bool, limit, offset int) ([]models.ConversationListItemResponse, int, error) {
	if (shopID == nil || *shopID == uuid.Nil) && (businessID == nil || *businessID == uuid.Nil) {
		// Find businesses for user
		businesses, err := s.businessRepo.GetByUserID(sellerUserID)
		if err != nil || len(businesses) == 0 {
			return []models.ConversationListItemResponse{}, 0, nil
		}
		bid := businesses[0].ID
		businessID = &bid
	}
	return s.orderConvRepo.ListSellerConversations(shopID, businessID, withMessages, limit, offset)
}

// ListAdminConversations returns conversations for Commerce Admin supervision.
func (s *CommunicationService) ListAdminConversations(search string, status string, shopID *uuid.UUID, withMessages bool, limit, offset int) ([]models.ConversationListItemResponse, int, error) {
	return s.orderConvRepo.ListAdminConversations(search, status, shopID, withMessages, limit, offset)
}

// GetBuyerUnreadCounts returns total unread messages and notifications for a buyer.
func (s *CommunicationService) GetBuyerUnreadCounts(buyerUserID uuid.UUID) (*models.UnreadCountsResponse, error) {
	unreadMsgs, err := s.orderConvRepo.GetUnreadMessageCountForBuyer(buyerUserID)
	if err != nil {
		unreadMsgs = 0
	}
	unreadNotifs, err := s.notifRepo.GetUnreadCountForAudience(buyerUserID, repository.NotificationAudienceBuyer)
	if err != nil {
		unreadNotifs = 0
	}
	return &models.UnreadCountsResponse{
		UnreadMessages:      unreadMsgs,
		UnreadNotifications: unreadNotifs,
	}, nil
}

// GetSellerUnreadCounts returns total unread messages and notifications for a seller.
func (s *CommunicationService) GetSellerUnreadCounts(sellerUserID uuid.UUID, shopID *uuid.UUID, businessID *uuid.UUID) (*models.UnreadCountsResponse, error) {
	if (shopID == nil || *shopID == uuid.Nil) && (businessID == nil || *businessID == uuid.Nil) {
		businesses, err := s.businessRepo.GetByUserID(sellerUserID)
		if err == nil && len(businesses) > 0 {
			bid := businesses[0].ID
			businessID = &bid
		}
	}
	unreadMsgs, err := s.orderConvRepo.GetUnreadMessageCountForSeller(shopID, businessID)
	if err != nil {
		unreadMsgs = 0
	}
	unreadNotifs, err := s.notifRepo.GetUnreadCountForAudience(sellerUserID, repository.NotificationAudienceSeller)
	if err != nil {
		unreadNotifs = 0
	}
	return &models.UnreadCountsResponse{
		UnreadMessages:      unreadMsgs,
		UnreadNotifications: unreadNotifs,
	}, nil
}

// getAdminUserIDs returns all active admin IDs for the specified roles.
func (s *CommunicationService) getAdminUserIDs(roles ...string) ([]uuid.UUID, error) {
	if len(roles) == 0 {
		roles = []string{"SUPER_ADMIN", "COMMERCE_ADMIN"}
	}
	placeholders := make([]string, len(roles))
	args := make([]interface{}, len(roles))
	for i, r := range roles {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = r
	}
	query := fmt.Sprintf("SELECT id FROM admin_users WHERE status = 'ACTIVE' AND role IN (%s)", strings.Join(placeholders, ","))
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var userIDs []uuid.UUID
	for rows.Next() {
		var uid uuid.UUID
		if err := rows.Scan(&uid); err == nil {
			userIDs = append(userIDs, uid)
		}
	}
	return userIDs, nil
}

// resolveCourierUserID resolves the user ID of the courier assigned to an order.
func (s *CommunicationService) resolveCourierUserID(order *models.Order) uuid.UUID {
	if order.AssignedCourierID != nil && *order.AssignedCourierID != uuid.Nil {
		return *order.AssignedCourierID
	}
	return uuid.Nil
}

// TriggerOrderEventNotification formats and delivers in-app notifications for order lifecycle events.
func (s *CommunicationService) TriggerOrderEventNotification(orderID uuid.UUID, eventType models.NotificationType, extraMetadata map[string]interface{}) error {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return err
	}

	buyerUserID, _ := s.resolveBuyerUserID(order)
	sellerUserIDs, _ := s.getBusinessUserIDs(order.BusinessID)
	courierUserID := s.resolveCourierUserID(order)
	var adminUserIDs []uuid.UUID

	shopName := "la boutique"
	if shop, err := s.shopRepo.GetByID(order.ShopID); err == nil && shop != nil {
		shopName = shop.Name
	}

	orderNum := order.OrderNumber
	if orderNum == "" {
		orderNum = order.ID.String()[:8]
	}

	meta := map[string]interface{}{
		"order_id":        order.ID.String(),
		"order_number":    orderNum,
		"order_status":    string(order.Status),
		"delivery_status": order.DeliveryStatus,
		"delivery_method": order.DeliveryMethod,
		"final_total":     order.FinalTotal,
		"shop_name":       shopName,
	}
	for k, v := range extraMetadata {
		meta[k] = v
	}

	var buyerTitle, buyerBody string
	var sellerTitle, sellerBody string
	var adminTitle, adminBody string
	var courierTitle, courierBody string
	var notifyBuyer, notifySeller, notifyAdmin, notifyCourier bool
	// buyerPriority overrides the catalogue priority for the buyer only;
	// adminRoles picks which admins are told (Commerce by default).
	var buyerPriority string
	adminRoles := []string{"SUPER_ADMIN", "COMMERCE_ADMIN"}

	switch eventType {
	case models.NotificationTypeNewOrder:
		notifySeller = true
		notifyAdmin = true
		sellerTitle = fmt.Sprintf("Nouvelle commande reçue: %s", orderNum)
		sellerBody = fmt.Sprintf("Vous avez reçu une nouvelle commande de %d article(s) pour un total de %s.", order.TotalItems, models.FormatMoneyFR(order.FinalTotal, order.Currency))
		adminTitle = fmt.Sprintf("Nouvelle commande client: %s", orderNum)
		adminBody = fmt.Sprintf("Commande de %s passée chez %s.", models.FormatMoneyFR(order.FinalTotal, order.Currency), shopName)

	case models.NotificationTypeOrderAccepted:
		notifyBuyer = true
		buyerTitle = fmt.Sprintf("Commande acceptée: %s", orderNum)
		buyerBody = "La boutique a accepté votre commande. La préparation va commencer."

	case models.NotificationTypeOrderRejected:
		notifyBuyer = true
		notifyAdmin = true
		buyerTitle = fmt.Sprintf("Commande refusée: %s", orderNum)
		buyerBody = "La boutique a refusé votre commande. Le montant ou vos points vous seront restitués."
		adminTitle = fmt.Sprintf("Commande refusée: %s", orderNum)
		adminBody = fmt.Sprintf("La boutique %s a refusé la commande %s.", shopName, orderNum)

	case models.NotificationTypeOrderPreparing:
		notifyBuyer = true
		buyerTitle = fmt.Sprintf("Préparation en cours: %s", orderNum)
		buyerBody = "Votre commande est en cours de préparation par la boutique."

	case models.NotificationTypeOrderReady:
		notifyBuyer = true
		if order.DeliveryMethod == models.DeliveryMethodPickup {
			buyerTitle = fmt.Sprintf("Commande prête pour retrait: %s", orderNum)
			buyerBody = "Votre commande est prête pour le retrait en boutique !"
			// The buyer has to come: worth a high-priority alert.
			buyerPriority = "HIGH"
		} else {
			buyerTitle = fmt.Sprintf("Commande prête: %s", orderNum)
			buyerBody = "Votre commande est prête et attend la prise en charge pour la livraison."
			// Nothing for the buyer to do yet: in-app only.
			buyerPriority = "LOW"
			notifyAdmin = true
			adminTitle = fmt.Sprintf("Commande prête pour expédition: %s", orderNum)
			adminBody = fmt.Sprintf("La commande %s est prête à être expédiée (%s).", orderNum, shopName)
			if courierUserID != uuid.Nil {
				notifyCourier = true
				courierTitle = fmt.Sprintf("Commande prête pour ramassage: %s", orderNum)
				courierBody = fmt.Sprintf("La commande %s est prête à être récupérée chez %s.", orderNum, shopName)
			}
		}

	case models.NotificationTypeCourierAssigned, models.NotificationTypeDeliveryAssigned:
		notifyBuyer = true
		notifySeller = true
		if courierUserID != uuid.Nil {
			notifyCourier = true
		}
		buyerTitle = fmt.Sprintf("Livreur assigné: %s", orderNum)
		buyerBody = "Un livreur TBK a été assigné pour acheminer votre commande."
		sellerTitle = fmt.Sprintf("Livreur assigné: %s", orderNum)
		sellerBody = fmt.Sprintf("Un livreur a été assigné pour récupérer la commande %s.", orderNum)
		courierTitle = "Nouvelle mission assignée"
		deliveryArea := order.DeliveryAddress
		if deliveryArea == "" {
			deliveryArea = "non renseignée"
		}
		courierBody = fmt.Sprintf("Commande %s — Boutique: %s — Zone de livraison: %s.", orderNum, shopName, deliveryArea)

	case models.NotificationTypeCourierPickedUp:
		// The seller hands the parcel over; the buyer hears about it once the
		// courier actually leaves (DELIVERY_IN_TRANSIT), not twice.
		notifySeller = true
		notifyAdmin = true
		sellerTitle = fmt.Sprintf("Commande récupérée: %s", orderNum)
		sellerBody = fmt.Sprintf("Le livreur a pris en charge la commande %s pour livraison.", orderNum)
		adminTitle = fmt.Sprintf("Colis récupéré: %s", orderNum)
		adminBody = fmt.Sprintf("Le livreur a récupéré la commande %s chez %s.", orderNum, shopName)

	case models.NotificationTypeDeliveryInTransit:
		notifyBuyer = true
		notifyAdmin = true
		buyerTitle = fmt.Sprintf("Commande en cours de livraison: %s", orderNum)
		buyerBody = "Le livreur a récupéré votre commande et est en route. Suivez-le en direct."
		adminTitle = fmt.Sprintf("Livraison en cours: %s", orderNum)
		adminBody = fmt.Sprintf("La commande %s est en cours d'acheminement.", orderNum)

	case models.NotificationTypeCourierMissionAccepted:
		notifyAdmin = true
		adminTitle = fmt.Sprintf("Mission acceptée: %s", orderNum)
		adminBody = fmt.Sprintf("Le livreur a accepté la livraison de la commande %s.", orderNum)

	case models.NotificationTypeCourierMissionRejected:
		notifyAdmin = true
		adminTitle = fmt.Sprintf("Mission refusée: %s", orderNum)
		adminBody = fmt.Sprintf("Le livreur a refusé la commande %s. Assignez un autre livreur.", orderNum)
		if reason, ok := extraMetadata["reason"].(string); ok && strings.TrimSpace(reason) != "" {
			adminBody = fmt.Sprintf("Le livreur a refusé la commande %s (%s). Assignez un autre livreur.", orderNum, truncateText(strings.TrimSpace(reason), 120))
		}

	case models.NotificationTypeCourierNearDestination:
		notifyBuyer = true
		buyerTitle = fmt.Sprintf("Livreur à proximité: %s", orderNum)
		buyerBody = "Votre livreur approche de votre adresse de livraison."

	case models.NotificationTypeCourierArrived:
		notifyBuyer = true
		notifyAdmin = true
		buyerTitle = fmt.Sprintf("Le livreur est arrivé: %s", orderNum)
		buyerBody = "Votre livreur TBK est arrivé à votre adresse de livraison !"

	case models.NotificationTypeOrderDelivered:
		notifyBuyer = true
		notifySeller = true
		notifyAdmin = true
		buyerTitle = fmt.Sprintf("Commande livrée: %s", orderNum)
		buyerBody = "Votre commande a été livrée. Veuillez confirmer la bonne réception de vos articles."
		sellerTitle = fmt.Sprintf("Commande livrée: %s", orderNum)
		sellerBody = fmt.Sprintf("Le livreur a remis la commande %s au client.", orderNum)
		adminTitle = fmt.Sprintf("Commande livrée: %s", orderNum)
		adminBody = fmt.Sprintf("La commande %s a été remise au destinataire.", orderNum)

	case models.NotificationTypeBuyerReceiptRequired:
		notifyBuyer = true
		buyerTitle = fmt.Sprintf("Confirmation de réception requise: %s", orderNum)
		buyerBody = "Merci de confirmer que vous avez bien reçu tous les articles de votre commande."

	case models.NotificationTypeOrderReceived:
		// Delivery receipt confirmed. Cash verification is a separate step and is not implied here.
		notifyBuyer = true
		notifySeller = true
		notifyAdmin = true
		buyerTitle = fmt.Sprintf("Réception confirmée: %s", orderNum)
		buyerBody = "Vous avez confirmé la réception de votre commande. Le paiement en espèces reste à confirmer séparément."
		sellerTitle = fmt.Sprintf("Commande reçue par le client: %s", orderNum)
		sellerBody = fmt.Sprintf("Le client a confirmé la réception de la commande %s. La confirmation du paiement en espèces reste requise.", orderNum)
		adminTitle = fmt.Sprintf("Réception confirmée: %s", orderNum)
		adminBody = fmt.Sprintf("La commande %s a été reçue par le client. Paiement non encore vérifié.", orderNum)

	case models.NotificationTypeOrderCompleted:
		notifyBuyer = true
		notifySeller = true
		notifyAdmin = true
		buyerTitle = fmt.Sprintf("Commande terminée: %s", orderNum)
		buyerBody = "Votre commande est maintenant terminée. Merci pour votre confiance !"
		sellerTitle = fmt.Sprintf("Commande terminée: %s", orderNum)
		sellerBody = fmt.Sprintf("La commande %s a été finalisée avec succès.", orderNum)
		adminTitle = fmt.Sprintf("Commande clôturée: %s", orderNum)
		adminBody = fmt.Sprintf("La commande %s a été clôturée avec succès.", orderNum)

	case models.NotificationTypeOrderCancelled:
		notifyBuyer = true
		notifySeller = true
		notifyAdmin = true
		buyerTitle = fmt.Sprintf("Commande annulée: %s", orderNum)
		buyerBody = "Votre commande a été annulée."
		sellerTitle = fmt.Sprintf("Commande annulée: %s", orderNum)
		sellerBody = fmt.Sprintf("La commande %s a été annulée.", orderNum)
		adminTitle = fmt.Sprintf("Commande annulée: %s", orderNum)
		adminBody = fmt.Sprintf("La commande %s a fait l'objet d'une annulation.", orderNum)

	case models.NotificationTypeDeliveryFailed:
		notifyBuyer = true
		notifySeller = true
		notifyAdmin = true
		buyerTitle = fmt.Sprintf("Échec de livraison: %s", orderNum)
		buyerBody = "La livraison n'a pas pu aboutir. Notre service client prend contact avec vous."
		sellerTitle = fmt.Sprintf("Échec de livraison: %s", orderNum)
		sellerBody = fmt.Sprintf("La tentative de livraison de la commande %s a échoué.", orderNum)
		adminTitle = fmt.Sprintf("Alerte livraison: Échec sur commande %s", orderNum)
		adminBody = fmt.Sprintf("Échec de livraison signalé pour la commande %s chez %s.", orderNum, shopName)

	case models.NotificationTypeDeliveryDelayed:
		notifyBuyer = true
		notifyAdmin = true
		buyerTitle = fmt.Sprintf("Retard de livraison: %s", orderNum)
		buyerBody = "Un léger retard est signalé sur l'acheminement de votre commande."
		adminTitle = fmt.Sprintf("Alerte: Retard sur livraison %s", orderNum)
		adminBody = fmt.Sprintf("Un retard de livraison a été enregistré pour la commande %s.", orderNum)

	case models.NotificationTypePaymentConfirmed:
		notifyBuyer = true
		notifySeller = true
		buyerTitle = fmt.Sprintf("Paiement confirmé: %s", orderNum)
		buyerBody = fmt.Sprintf("Le paiement de %s a été validé avec succès.", models.FormatMoneyFR(order.FinalTotal, order.Currency))
		sellerTitle = fmt.Sprintf("Paiement reçu: %s", orderNum)
		sellerBody = fmt.Sprintf("Le paiement de %s pour la commande %s est confirmé.", models.FormatMoneyFR(order.FinalTotal, order.Currency), orderNum)

	case models.NotificationTypePaymentFailed:
		notifyBuyer = true
		buyerTitle = fmt.Sprintf("Paiement échoué: %s", orderNum)
		buyerBody = "Votre paiement n'a pas abouti. Aucun montant n'a été validé : vous pouvez réessayer depuis la commande."

	case models.NotificationTypeRefundIssued:
		notifyBuyer = true
		notifySeller = true
		notifyAdmin = true
		adminRoles = []string{"SUPER_ADMIN", "FINANCE_SUPPORT_ADMIN"}
		buyerTitle = fmt.Sprintf("Remboursement enregistré: %s", orderNum)
		buyerBody = fmt.Sprintf("Le remboursement de %s pour la commande %s a été enregistré.", models.FormatMoneyFR(order.FinalTotal, order.Currency), orderNum)
		sellerTitle = fmt.Sprintf("Commande remboursée: %s", orderNum)
		sellerBody = fmt.Sprintf("La vente %s a été remboursée : elle ne compte plus dans votre chiffre d'affaires.", orderNum)
		adminTitle = fmt.Sprintf("Remboursement: %s", orderNum)
		adminBody = fmt.Sprintf("La commande %s (%s) a été remboursée.", orderNum, shopName)

	case models.NotificationTypeCashConfirmationRequired:
		if courierUserID != uuid.Nil {
			notifyCourier = true
			courierTitle = fmt.Sprintf("Encaissement espèces à confirmer: %s", orderNum)
			courierBody = fmt.Sprintf("Veuillez confirmer l'encaissement de %s pour la commande %s.", models.FormatMoneyFR(order.FinalTotal, order.Currency), orderNum)
		}
		notifyAdmin = true
		adminTitle = fmt.Sprintf("Encaissement espèces en attente: %s", orderNum)
		adminBody = fmt.Sprintf("Encaissement espèces de %s en attente de confirmation pour la commande %s.", models.FormatMoneyFR(order.FinalTotal, order.Currency), orderNum)

	case models.NotificationTypeNewReview:
		notifySeller = true
		sellerTitle = fmt.Sprintf("Nouvel avis client: %s", orderNum)
		sellerBody = fmt.Sprintf("Un client a déposé une évaluation sur la commande %s.", orderNum)
	}

	dedupWindow := 10 * time.Second

	if notifyBuyer && buyerUserID != uuid.Nil {
		buyerMeta := withAudience(meta, repository.NotificationAudienceBuyer)
		if buyerPriority != "" {
			buyerMeta["priority"] = buyerPriority
		}
		_, _ = s.notifRepo.CreateIfUnique(&models.Notification{
			UserID:        buyerUserID,
			Type:          eventType,
			Title:         buyerTitle,
			Body:          buyerBody,
			ReferenceType: "ORDER",
			ReferenceID:   order.ID,
			Metadata:      buyerMeta,
		}, dedupWindow)
	}

	if notifySeller && len(sellerUserIDs) > 0 {
		for _, uid := range sellerUserIDs {
			_, _ = s.notifRepo.CreateIfUnique(&models.Notification{
				UserID:        uid,
				Type:          eventType,
				Title:         sellerTitle,
				Body:          sellerBody,
				ReferenceType: "ORDER",
				ReferenceID:   order.ID,
				Metadata:      withAudience(meta, repository.NotificationAudienceSeller),
			}, dedupWindow)
		}
	}

	if notifyCourier && courierUserID != uuid.Nil {
		_, _ = s.notifRepo.CreateIfUnique(&models.Notification{
			UserID:        courierUserID,
			Type:          eventType,
			Title:         courierTitle,
			Body:          courierBody,
			ReferenceType: "ORDER",
			ReferenceID:   order.ID,
			Metadata:      withAudience(meta, repository.NotificationAudienceCourier),
		}, dedupWindow)
	}

	if notifyAdmin {
		adminUserIDs, _ = s.getAdminUserIDs(adminRoles...)
	}
	if notifyAdmin && len(adminUserIDs) > 0 {
		for _, aid := range adminUserIDs {
			_, _ = s.notifRepo.CreateIfUnique(&models.Notification{
				UserID:        aid,
				Type:          eventType,
				Title:         adminTitle,
				Body:          adminBody,
				ReferenceType: "ORDER",
				ReferenceID:   order.ID,
				Metadata:      withAudience(meta, repository.NotificationAudienceAdmin),
			}, dedupWindow)
		}
	}

	return nil
}

// withAudience copies the shared event metadata and records which role the
// notification is written for. A user can be buyer and seller at once, and
// each space must only list (and link to) its own notifications.
func withAudience(meta map[string]interface{}, audience string) map[string]interface{} {
	out := make(map[string]interface{}, len(meta)+1)
	for k, v := range meta {
		out[k] = v
	}
	out["audience"] = audience
	return out
}

// GetUserNotifications returns paginated notifications for the user.
func (s *CommunicationService) GetUserNotifications(userID uuid.UUID, audience, view string, limit, offset int) ([]models.NotificationResponse, int, error) {
	return s.notifRepo.GetByUserIDForAudience(userID, audience, view, limit, offset)
}

// ArchiveNotification archives one of the user's own notifications (buyer/seller only).
func (s *CommunicationService) ArchiveNotification(id, userID uuid.UUID) error {
	return s.notifRepo.ArchiveNotification(id, userID)
}

// UnarchiveNotification restores one of the user's own notifications back to the active view.
func (s *CommunicationService) UnarchiveNotification(id, userID uuid.UUID) error {
	return s.notifRepo.UnarchiveNotification(id, userID)
}

// DeleteNotification soft-deletes one of the user's own notifications (buyer/seller only).
func (s *CommunicationService) DeleteNotification(id, userID uuid.UUID) error {
	return s.notifRepo.DeleteNotification(id, userID)
}

// GetUnreadNotificationCount counts unread notifications for one audience.
func (s *CommunicationService) GetUnreadNotificationCount(userID uuid.UUID, audience string) (int, error) {
	return s.notifRepo.GetUnreadCountForAudience(userID, audience)
}

// MarkNotificationAsRead marks a notification as read.
func (s *CommunicationService) MarkNotificationAsRead(id, userID uuid.UUID) error {
	return s.notifRepo.MarkAsRead(id, userID)
}

// MarkAllNotificationsAsRead marks all notifications as read.
func (s *CommunicationService) MarkAllNotificationsAsRead(userID uuid.UUID, audience string) error {
	return s.notifRepo.MarkAllAsReadForAudience(userID, audience)
}

// GetAdminNotifications returns paginated notifications for an admin.
func (s *CommunicationService) GetAdminNotifications(adminID uuid.UUID, limit, offset int) ([]models.NotificationResponse, int, error) {
	return s.notifRepo.GetByUserID(adminID, limit, offset)
}

// GetAdminUnreadCount returns total unread notifications count for an admin.
func (s *CommunicationService) GetAdminUnreadCount(adminID uuid.UUID) (int, error) {
	return s.notifRepo.GetUnreadCount(adminID)
}

// MarkAdminNotificationRead marks an admin notification as read.
func (s *CommunicationService) MarkAdminNotificationRead(id, adminID uuid.UUID) error {
	return s.notifRepo.MarkAsRead(id, adminID)
}

// MarkAllAdminNotificationsRead marks all admin notifications as read.
func (s *CommunicationService) MarkAllAdminNotificationsRead(adminID uuid.UUID) error {
	return s.notifRepo.MarkAllAsRead(adminID)
}

func truncateText(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
