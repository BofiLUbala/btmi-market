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

// GetOrderConversationDetail retrieves conversation details, messages, and order meta.
func (s *CommunicationService) GetOrderConversationDetail(orderID uuid.UUID, callerUserID uuid.UUID, callerRole string, isCommerceAdmin bool) (*models.OrderConversationDetailResponse, error) {
	conv, err := s.EnsureOrderConversation(orderID)
	if err != nil {
		return nil, err
	}

	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, err
	}

	// Permission verification
	isBuyer := conv.BuyerID == callerUserID
	var isSeller bool
	if !isBuyer && !isCommerceAdmin {
		// Check business membership
		membership, err := s.membershipRepo.GetActiveByUserAndBusiness(callerUserID, conv.BusinessID)
		if err == nil && membership != nil {
			isSeller = true
		}
	}

	if !isBuyer && !isSeller && !isCommerceAdmin {
		return nil, errors.New("FORBIDDEN")
	}

	// Mark as read according to caller role
	if isBuyer {
		_ = s.orderConvRepo.MarkMessagesAsReadByBuyer(conv.ID)
	} else if isSeller {
		_ = s.orderConvRepo.MarkMessagesAsReadBySeller(conv.ID)
	}

	messages, err := s.orderConvRepo.GetMessagesByConversationID(conv.ID)
	if err != nil {
		return nil, err
	}
	if messages == nil {
		messages = []models.OrderMessage{}
	}

	// Get shop, business, buyer names
	var shopName, businessName, buyerName string
	shop, _ := s.shopRepo.GetByID(conv.ShopID)
	if shop != nil {
		shopName = shop.Name
	}
	business, _ := s.businessRepo.GetByID(conv.BusinessID)
	if business != nil {
		businessName = business.Name
	}
	buyerUser, _ := s.userRepo.GetByID(conv.BuyerID)
	if buyerUser != nil {
		buyerName = strings.TrimSpace(buyerUser.FirstName + " " + buyerUser.LastName)
		if buyerName == "" {
			buyerName = buyerUser.Email
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
		Messages:       messages,
	}, nil
}

// SendMessage sends a message in the order conversation.
func (s *CommunicationService) SendMessage(
	orderID uuid.UUID,
	senderUserID uuid.UUID,
	senderRole string,
	senderName string,
	body string,
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

	var senderType models.SenderType
	var isAdminIntervention bool

	isBuyer := conv.BuyerID == senderUserID
	var isSeller bool
	var isEmployee bool

	if !isBuyer {
		membership, err := s.membershipRepo.GetActiveByUserAndBusiness(senderUserID, conv.BusinessID)
		if err == nil && membership != nil {
			if membership.Role == models.MembershipRoleEmployee {
				isEmployee = true
			} else {
				isSeller = true
			}
		}
	}

	if isBuyer {
		senderType = models.SenderTypeBuyer
	} else if isSeller {
		senderType = models.SenderTypeSeller
	} else if isEmployee {
		senderType = models.SenderTypeEmployee
	} else if senderRole == "SUPER_ADMIN" {
		senderType = models.SenderTypeSuperAdmin
		isAdminIntervention = true
	} else if senderRole == "COMMERCE_ADMIN" || senderRole == "ADMIN" {
		senderType = models.SenderTypeCommerceAdmin
		isAdminIntervention = true
	} else {
		return nil, errors.New("FORBIDDEN")
	}

	// Resolve sender name if empty
	if strings.TrimSpace(senderName) == "" {
		user, _ := s.userRepo.GetByID(senderUserID)
		if user != nil {
			senderName = strings.TrimSpace(user.FirstName + " " + user.LastName)
			if senderName == "" {
				senderName = user.Email
			}
		}
	}

	now := time.Now()
	msg := &models.OrderMessage{
		ID:                  uuid.New(),
		ConversationID:      conv.ID,
		SenderUserID:        senderUserID,
		SenderType:          senderType,
		SenderName:          senderName,
		Body:                body,
		IsAdminIntervention: isAdminIntervention,
		CreatedAt:           now,
	}

	if isBuyer {
		msg.ReadByBuyerAt = &now
	} else if isSeller || isEmployee {
		msg.ReadBySellerAt = &now
	}

	if err := s.orderConvRepo.CreateMessage(msg); err != nil {
		return nil, err
	}

	// Trigger notifications
	go func() {
		orderNum := order.OrderNumber
		if orderNum == "" {
			orderNum = order.ID.String()[:8]
		}

		if senderType == models.SenderTypeBuyer {
			// Notify seller
			sellerUserIDs, _ := s.getBusinessUserIDs(conv.BusinessID)
			for _, uid := range sellerUserIDs {
				_ = s.notifRepo.Create(&models.Notification{
					UserID:        uid,
					Type:          models.NotificationTypeNewMessage,
					Title:         fmt.Sprintf("Nouveau message - Commande %s", orderNum),
					Body:          fmt.Sprintf("%s: %s", senderName, truncateText(body, 80)),
					ReferenceType: "ORDER",
					ReferenceID:   order.ID,
					Metadata: map[string]interface{}{
						"order_id":        order.ID.String(),
						"order_number":    orderNum,
						"conversation_id": conv.ID.String(),
						"sender_type":     string(senderType),
					},
				})
			}
		} else if senderType == models.SenderTypeSeller || senderType == models.SenderTypeEmployee {
			// Notify buyer
			_ = s.notifRepo.Create(&models.Notification{
				UserID:        conv.BuyerID,
				Type:          models.NotificationTypeNewMessage,
				Title:         fmt.Sprintf("Nouveau message - Commande %s", orderNum),
				Body:          fmt.Sprintf("%s: %s", senderName, truncateText(body, 80)),
				ReferenceType: "ORDER",
				ReferenceID:   order.ID,
				Metadata: map[string]interface{}{
					"order_id":        order.ID.String(),
					"order_number":    orderNum,
					"conversation_id": conv.ID.String(),
					"sender_type":     string(senderType),
				},
			})
		} else if isAdminIntervention {
			// Notify both buyer and seller
			_ = s.notifRepo.Create(&models.Notification{
				UserID:        conv.BuyerID,
				Type:          models.NotificationTypeNewMessage,
				Title:         fmt.Sprintf("Intervention TBK Admin - Commande %s", orderNum),
				Body:          fmt.Sprintf("Support TBK: %s", truncateText(body, 80)),
				ReferenceType: "ORDER",
				ReferenceID:   order.ID,
				Metadata: map[string]interface{}{
					"order_id":        order.ID.String(),
					"order_number":    orderNum,
					"conversation_id": conv.ID.String(),
					"sender_type":     string(senderType),
					"is_admin":        true,
				},
			})

			sellerUserIDs, _ := s.getBusinessUserIDs(conv.BusinessID)
			for _, uid := range sellerUserIDs {
				_ = s.notifRepo.Create(&models.Notification{
					UserID:        uid,
					Type:          models.NotificationTypeNewMessage,
					Title:         fmt.Sprintf("Intervention TBK Admin - Commande %s", orderNum),
					Body:          fmt.Sprintf("Support TBK: %s", truncateText(body, 80)),
					ReferenceType: "ORDER",
					ReferenceID:   order.ID,
					Metadata: map[string]interface{}{
						"order_id":        order.ID.String(),
						"order_number":    orderNum,
						"conversation_id": conv.ID.String(),
						"sender_type":     string(senderType),
						"is_admin":        true,
					},
				})
			}
		}
	}()

	return msg, nil
}

// AdminIntervene sends an official admin message into the order conversation.
func (s *CommunicationService) AdminIntervene(
	orderID uuid.UUID,
	adminUserID uuid.UUID,
	adminRole string,
	adminName string,
	body string,
) (*models.OrderMessage, error) {
	if adminRole != "COMMERCE_ADMIN" && adminRole != "SUPER_ADMIN" && adminRole != "ADMIN" {
		return nil, errors.New("FORBIDDEN")
	}

	if strings.TrimSpace(adminName) == "" {
		adminName = "TBK Commerce Operations"
	} else if !strings.Contains(adminName, "TBK") {
		adminName = fmt.Sprintf("%s (TBK Admin)", adminName)
	}

	return s.SendMessage(orderID, adminUserID, adminRole, adminName, body)
}

// ListBuyerConversations returns all conversations for the buyer.
func (s *CommunicationService) ListBuyerConversations(buyerUserID uuid.UUID, limit, offset int) ([]models.ConversationListItemResponse, int, error) {
	return s.orderConvRepo.ListBuyerConversations(buyerUserID, limit, offset)
}

// ListSellerConversations returns conversations for the seller.
func (s *CommunicationService) ListSellerConversations(sellerUserID uuid.UUID, shopID *uuid.UUID, businessID *uuid.UUID, limit, offset int) ([]models.ConversationListItemResponse, int, error) {
	if (shopID == nil || *shopID == uuid.Nil) && (businessID == nil || *businessID == uuid.Nil) {
		// Find businesses for user
		businesses, err := s.businessRepo.GetByUserID(sellerUserID)
		if err != nil || len(businesses) == 0 {
			return []models.ConversationListItemResponse{}, 0, nil
		}
		bid := businesses[0].ID
		businessID = &bid
	}
	return s.orderConvRepo.ListSellerConversations(shopID, businessID, limit, offset)
}

// ListAdminConversations returns conversations for Commerce Admin supervision.
func (s *CommunicationService) ListAdminConversations(search string, status string, shopID *uuid.UUID, limit, offset int) ([]models.ConversationListItemResponse, int, error) {
	return s.orderConvRepo.ListAdminConversations(search, status, shopID, limit, offset)
}

// GetBuyerUnreadCounts returns total unread messages and notifications for a buyer.
func (s *CommunicationService) GetBuyerUnreadCounts(buyerUserID uuid.UUID) (*models.UnreadCountsResponse, error) {
	unreadMsgs, err := s.orderConvRepo.GetUnreadMessageCountForBuyer(buyerUserID)
	if err != nil {
		unreadMsgs = 0
	}
	unreadNotifs, err := s.notifRepo.GetUnreadCount(buyerUserID)
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
	unreadNotifs, err := s.notifRepo.GetUnreadCount(sellerUserID)
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
	adminUserIDs, _ := s.getAdminUserIDs("SUPER_ADMIN", "COMMERCE_ADMIN")

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

	switch eventType {
	case models.NotificationTypeNewOrder:
		notifySeller = true
		notifyAdmin = true
		sellerTitle = fmt.Sprintf("Nouvelle commande reçue: %s", orderNum)
		sellerBody = fmt.Sprintf("Vous avez reçu une nouvelle commande de %d article(s) pour un total de %.2f FCFA.", order.TotalItems, order.FinalTotal)
		adminTitle = fmt.Sprintf("Nouvelle commande client: %s", orderNum)
		adminBody = fmt.Sprintf("Commande de %.2f FCFA passée chez %s.", order.FinalTotal, shopName)

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
		} else {
			buyerTitle = fmt.Sprintf("Commande prête: %s", orderNum)
			buyerBody = "Votre commande est prête et attend la prise en charge pour la livraison."
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
		courierTitle = fmt.Sprintf("Nouvelle livraison assignée: %s", orderNum)
		courierBody = fmt.Sprintf("Une commande vous a été assignée pour livraison (Boutique: %s).", shopName)

	case models.NotificationTypeCourierPickedUp, models.NotificationTypeDeliveryInTransit:
		notifyBuyer = true
		notifySeller = true
		notifyAdmin = true
		buyerTitle = fmt.Sprintf("Commande en cours de livraison: %s", orderNum)
		buyerBody = "Le livreur a récupéré votre commande et est en route."
		sellerTitle = fmt.Sprintf("Commande récupérée: %s", orderNum)
		sellerBody = fmt.Sprintf("Le livreur a pris en charge la commande %s pour livraison.", orderNum)
		adminTitle = fmt.Sprintf("Livraison en cours: %s", orderNum)
		adminBody = fmt.Sprintf("La commande %s est en cours d'acheminement.", orderNum)

	case models.NotificationTypeCourierNearDestination:
		notifyBuyer = true
		buyerTitle = fmt.Sprintf("Livreur à proximité: %s", orderNum)
		buyerBody = "Votre livreur approche de votre adresse de livraison."

	case models.NotificationTypeCourierArrived:
		notifyBuyer = true
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
		buyerBody = fmt.Sprintf("Le paiement de %.2f FCFA a été validé avec succès.", order.FinalTotal)
		sellerTitle = fmt.Sprintf("Paiement reçu: %s", orderNum)
		sellerBody = fmt.Sprintf("Le paiement de %.2f FCFA pour la commande %s est confirmé.", order.FinalTotal, orderNum)

	case models.NotificationTypeCashConfirmationRequired:
		if courierUserID != uuid.Nil {
			notifyCourier = true
			courierTitle = fmt.Sprintf("Encaissement espèces à confirmer: %s", orderNum)
			courierBody = fmt.Sprintf("Veuillez confirmer l'encaissement de %.2f FCFA pour la commande %s.", order.FinalTotal, orderNum)
		}
		notifyAdmin = true
		adminTitle = fmt.Sprintf("Encaissement espèces en attente: %s", orderNum)
		adminBody = fmt.Sprintf("Encaissement espèces de %.2f FCFA en attente de confirmation pour la commande %s.", order.FinalTotal, orderNum)

	case models.NotificationTypeNewReview:
		notifySeller = true
		sellerTitle = fmt.Sprintf("Nouvel avis client: %s", orderNum)
		sellerBody = fmt.Sprintf("Un client a déposé une évaluation sur la commande %s.", orderNum)
	}

	dedupWindow := 10 * time.Second

	if notifyBuyer && buyerUserID != uuid.Nil {
		_, _ = s.notifRepo.CreateIfUnique(&models.Notification{
			UserID:        buyerUserID,
			Type:          eventType,
			Title:         buyerTitle,
			Body:          buyerBody,
			ReferenceType: "ORDER",
			ReferenceID:   order.ID,
			Metadata:      meta,
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
				Metadata:      meta,
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
			Metadata:      meta,
		}, dedupWindow)
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
				Metadata:      meta,
			}, dedupWindow)
		}
	}

	return nil
}

// ConfirmCourierArrival updates the delivery status to COURIER_ARRIVED and notifies the buyer.
func (s *CommunicationService) ConfirmCourierArrival(orderID uuid.UUID, courierUserID uuid.UUID) error {
	if err := s.orderRepo.UpdateDeliveryStatus(orderID, "COURIER_ARRIVED"); err != nil {
		return err
	}
	return s.TriggerOrderEventNotification(orderID, models.NotificationTypeCourierArrived, map[string]interface{}{
		"courier_user_id": courierUserID.String(),
	})
}

// ConfirmCourierPickedUp updates the delivery status to IN_TRANSIT and triggers notifications.
func (s *CommunicationService) ConfirmCourierPickedUp(orderID uuid.UUID, courierUserID uuid.UUID) error {
	if err := s.orderRepo.UpdateDeliveryStatus(orderID, "IN_TRANSIT"); err != nil {
		return err
	}
	return s.TriggerOrderEventNotification(orderID, models.NotificationTypeCourierPickedUp, map[string]interface{}{
		"courier_user_id": courierUserID.String(),
	})
}

// ConfirmCourierNearDestination updates the delivery status to NEAR_DESTINATION and notifies the buyer.
func (s *CommunicationService) ConfirmCourierNearDestination(orderID uuid.UUID, courierUserID uuid.UUID) error {
	if err := s.orderRepo.UpdateDeliveryStatus(orderID, "NEAR_DESTINATION"); err != nil {
		return err
	}
	return s.TriggerOrderEventNotification(orderID, models.NotificationTypeCourierNearDestination, map[string]interface{}{
		"courier_user_id": courierUserID.String(),
	})
}

// GetUserNotifications returns paginated notifications for the user.
func (s *CommunicationService) GetUserNotifications(userID uuid.UUID, limit, offset int) ([]models.NotificationResponse, int, error) {
	return s.notifRepo.GetByUserID(userID, limit, offset)
}

// MarkNotificationAsRead marks a notification as read.
func (s *CommunicationService) MarkNotificationAsRead(id, userID uuid.UUID) error {
	return s.notifRepo.MarkAsRead(id, userID)
}

// MarkAllNotificationsAsRead marks all notifications as read.
func (s *CommunicationService) MarkAllNotificationsAsRead(userID uuid.UUID) error {
	return s.notifRepo.MarkAllAsRead(userID)
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
