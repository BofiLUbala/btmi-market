package repository

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type OrderConversationRepository struct {
	db *database.DB
}

func NewOrderConversationRepository(db *database.DB) *OrderConversationRepository {
	return &OrderConversationRepository{db: db}
}

var ErrConversationNotFound = fmt.Errorf("order conversation not found")

// CreateOrGetConversation ensures an order conversation exists for the given order, returning it.
func (r *OrderConversationRepository) CreateOrGetConversation(orderID, buyerID, shopID, businessID uuid.UUID) (*models.OrderConversation, error) {
	// First attempt insert
	conv := &models.OrderConversation{
		ID:         uuid.New(),
		OrderID:    orderID,
		BuyerID:    buyerID,
		ShopID:     shopID,
		BusinessID: businessID,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	query := `
		INSERT INTO order_conversations (id, order_id, buyer_id, shop_id, business_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (order_id) DO UPDATE SET updated_at = NOW()
		RETURNING id, order_id, buyer_id, shop_id, business_id, created_at, updated_at
	`

	err := r.db.QueryRow(query, conv.ID, conv.OrderID, conv.BuyerID, conv.ShopID, conv.BusinessID, conv.CreatedAt, conv.UpdatedAt).Scan(
		&conv.ID,
		&conv.OrderID,
		&conv.BuyerID,
		&conv.ShopID,
		&conv.BusinessID,
		&conv.CreatedAt,
		&conv.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create or get order conversation: %w", err)
	}

	return conv, nil
}

// GetConversationByOrderID fetches the conversation attached to an order.
func (r *OrderConversationRepository) GetConversationByOrderID(orderID uuid.UUID) (*models.OrderConversation, error) {
	query := `
		SELECT id, order_id, buyer_id, shop_id, business_id, created_at, updated_at
		FROM order_conversations
		WHERE order_id = $1
	`
	conv := &models.OrderConversation{}
	err := r.db.QueryRow(query, orderID).Scan(
		&conv.ID,
		&conv.OrderID,
		&conv.BuyerID,
		&conv.ShopID,
		&conv.BusinessID,
		&conv.CreatedAt,
		&conv.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrConversationNotFound
		}
		return nil, fmt.Errorf("failed to query conversation by order_id: %w", err)
	}
	return conv, nil
}

// GetConversationByID fetches the conversation by its ID.
func (r *OrderConversationRepository) GetConversationByID(id uuid.UUID) (*models.OrderConversation, error) {
	query := `
		SELECT id, order_id, buyer_id, shop_id, business_id, created_at, updated_at
		FROM order_conversations
		WHERE id = $1
	`
	conv := &models.OrderConversation{}
	err := r.db.QueryRow(query, id).Scan(
		&conv.ID,
		&conv.OrderID,
		&conv.BuyerID,
		&conv.ShopID,
		&conv.BusinessID,
		&conv.CreatedAt,
		&conv.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrConversationNotFound
		}
		return nil, fmt.Errorf("failed to query conversation by id: %w", err)
	}
	return conv, nil
}

// CreateMessage adds a message to the conversation and updates conversation updated_at.
func (r *OrderConversationRepository) CreateMessage(msg *models.OrderMessage) error {
	if msg.ID == uuid.Nil {
		msg.ID = uuid.New()
	}
	if msg.CreatedAt.IsZero() {
		msg.CreatedAt = time.Now()
	}

	query := `
		INSERT INTO order_messages (
			id, conversation_id, sender_user_id, sender_type, sender_name, body,
			is_admin_intervention, read_by_buyer_at, read_by_seller_at, created_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING created_at
	`

	err := r.db.QueryRow(
		query,
		msg.ID,
		msg.ConversationID,
		msg.SenderUserID,
		msg.SenderType,
		msg.SenderName,
		msg.Body,
		msg.IsAdminIntervention,
		msg.ReadByBuyerAt,
		msg.ReadBySellerAt,
		msg.CreatedAt,
	).Scan(&msg.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert order message: %w", err)
	}

	// Update conversation updated_at
	_, _ = r.db.Exec(`UPDATE order_conversations SET updated_at = $1 WHERE id = $2`, msg.CreatedAt, msg.ConversationID)

	return nil
}

// GetMessagesByConversationID retrieves all messages for a conversation ordered chronologically.
func (r *OrderConversationRepository) GetMessagesByConversationID(conversationID uuid.UUID) ([]models.OrderMessage, error) {
	query := `
		SELECT 
			id, conversation_id, sender_user_id, sender_type, sender_name, body,
			is_admin_intervention, read_by_buyer_at, read_by_seller_at, created_at
		FROM order_messages
		WHERE conversation_id = $1
		ORDER BY created_at ASC
	`
	rows, err := r.db.Query(query, conversationID)
	if err != nil {
		return nil, fmt.Errorf("failed to query messages: %w", err)
	}
	defer rows.Close()

	var messages []models.OrderMessage
	for rows.Next() {
		var msg models.OrderMessage
		var readBuyer, readSeller sql.NullTime
		var senderType string

		err := rows.Scan(
			&msg.ID,
			&msg.ConversationID,
			&msg.SenderUserID,
			&senderType,
			&msg.SenderName,
			&msg.Body,
			&msg.IsAdminIntervention,
			&readBuyer,
			&readSeller,
			&msg.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan message: %w", err)
		}
		msg.SenderType = models.SenderType(senderType)
		if readBuyer.Valid {
			t := readBuyer.Time
			msg.ReadByBuyerAt = &t
		}
		if readSeller.Valid {
			t := readSeller.Time
			msg.ReadBySellerAt = &t
		}
		messages = append(messages, msg)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}
	return messages, nil
}

// MarkMessagesAsReadByBuyer marks all unread seller/admin/system messages in a conversation as read by buyer.
func (r *OrderConversationRepository) MarkMessagesAsReadByBuyer(conversationID uuid.UUID) error {
	query := `
		UPDATE order_messages
		SET read_by_buyer_at = NOW()
		WHERE conversation_id = $1 AND read_by_buyer_at IS NULL AND sender_type != 'BUYER'
	`
	_, err := r.db.Exec(query, conversationID)
	return err
}

// MarkMessagesAsReadBySeller marks all unread buyer/admin/system messages in a conversation as read by seller.
func (r *OrderConversationRepository) MarkMessagesAsReadBySeller(conversationID uuid.UUID) error {
	query := `
		UPDATE order_messages
		SET read_by_seller_at = NOW()
		WHERE conversation_id = $1 AND read_by_seller_at IS NULL AND sender_type NOT IN ('SELLER', 'EMPLOYEE')
	`
	_, err := r.db.Exec(query, conversationID)
	return err
}

// ListBuyerConversations lists conversations for a buyer with last message and unread count.
func (r *OrderConversationRepository) ListBuyerConversations(buyerID uuid.UUID, limit, offset int) ([]models.ConversationListItemResponse, int, error) {
	if limit <= 0 {
		limit = 20
	}

	countQuery := `SELECT COUNT(*) FROM order_conversations WHERE buyer_id = $1`
	var total int
	if err := r.db.QueryRow(countQuery, buyerID).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT 
			c.id AS conversation_id,
			c.order_id,
			COALESCE(o.order_number, '') AS order_number,
			COALESCE(o.status::text, '') AS order_status,
			c.buyer_id,
			COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email, '') AS buyer_name,
			c.shop_id,
			COALESCE(s.name, '') AS shop_name,
			c.business_id,
			COALESCE(b.name, '') AS business_name,
			COALESCE(last_m.body, '') AS last_message,
			COALESCE(last_m.sender_type, '') AS last_sender_type,
			COALESCE(last_m.created_at, c.created_at) AS last_message_at,
			(
				SELECT COUNT(*) FROM order_messages m
				WHERE m.conversation_id = c.id
				  AND m.read_by_buyer_at IS NULL
				  AND m.sender_type != 'BUYER'
			) AS unread_count,
			c.created_at
		FROM order_conversations c
		LEFT JOIN orders o ON o.id = c.order_id
		LEFT JOIN users u ON u.id = c.buyer_id
		LEFT JOIN shops s ON s.id = c.shop_id
		LEFT JOIN businesses b ON b.id = c.business_id
		LEFT JOIN LATERAL (
			SELECT body, sender_type, created_at
			FROM order_messages
			WHERE conversation_id = c.id
			ORDER BY created_at DESC
			LIMIT 1
		) last_m ON true
		WHERE c.buyer_id = $1
		ORDER BY last_message_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(query, buyerID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list buyer conversations: %w", err)
	}
	defer rows.Close()

	var items []models.ConversationListItemResponse
	for rows.Next() {
		var item models.ConversationListItemResponse
		var lastSenderType string
		err := rows.Scan(
			&item.ConversationID,
			&item.OrderID,
			&item.OrderNumber,
			&item.OrderStatus,
			&item.BuyerID,
			&item.BuyerName,
			&item.ShopID,
			&item.ShopName,
			&item.BusinessID,
			&item.BusinessName,
			&item.LastMessage,
			&lastSenderType,
			&item.LastMessageAt,
			&item.UnreadCount,
			&item.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan conversation item: %w", err)
		}
		item.LastSenderType = models.SenderType(lastSenderType)
		items = append(items, item)
	}

	return items, total, nil
}

// ListSellerConversations lists conversations for a shop or business.
func (r *OrderConversationRepository) ListSellerConversations(shopID *uuid.UUID, businessID *uuid.UUID, limit, offset int) ([]models.ConversationListItemResponse, int, error) {
	if limit <= 0 {
		limit = 20
	}

	whereClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if shopID != nil && *shopID != uuid.Nil {
		whereClauses = append(whereClauses, fmt.Sprintf("c.shop_id = $%d", argIdx))
		args = append(args, *shopID)
		argIdx++
	} else if businessID != nil && *businessID != uuid.Nil {
		whereClauses = append(whereClauses, fmt.Sprintf("c.business_id = $%d", argIdx))
		args = append(args, *businessID)
		argIdx++
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM order_conversations c %s", whereSQL)
	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(`
		SELECT 
			c.id AS conversation_id,
			c.order_id,
			COALESCE(o.order_number, '') AS order_number,
			COALESCE(o.status::text, '') AS order_status,
			c.buyer_id,
			COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email, '') AS buyer_name,
			c.shop_id,
			COALESCE(s.name, '') AS shop_name,
			c.business_id,
			COALESCE(b.name, '') AS business_name,
			COALESCE(last_m.body, '') AS last_message,
			COALESCE(last_m.sender_type, '') AS last_sender_type,
			COALESCE(last_m.created_at, c.created_at) AS last_message_at,
			(
				SELECT COUNT(*) FROM order_messages m
				WHERE m.conversation_id = c.id
				  AND m.read_by_seller_at IS NULL
				  AND m.sender_type NOT IN ('SELLER', 'EMPLOYEE')
			) AS unread_count,
			c.created_at
		FROM order_conversations c
		LEFT JOIN orders o ON o.id = c.order_id
		LEFT JOIN users u ON u.id = c.buyer_id
		LEFT JOIN shops s ON s.id = c.shop_id
		LEFT JOIN businesses b ON b.id = c.business_id
		LEFT JOIN LATERAL (
			SELECT body, sender_type, created_at
			FROM order_messages
			WHERE conversation_id = c.id
			ORDER BY created_at DESC
			LIMIT 1
		) last_m ON true
		%s
		ORDER BY last_message_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	args = append(args, limit, offset)
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list seller conversations: %w", err)
	}
	defer rows.Close()

	var items []models.ConversationListItemResponse
	for rows.Next() {
		var item models.ConversationListItemResponse
		var lastSenderType string
		err := rows.Scan(
			&item.ConversationID,
			&item.OrderID,
			&item.OrderNumber,
			&item.OrderStatus,
			&item.BuyerID,
			&item.BuyerName,
			&item.ShopID,
			&item.ShopName,
			&item.BusinessID,
			&item.BusinessName,
			&item.LastMessage,
			&lastSenderType,
			&item.LastMessageAt,
			&item.UnreadCount,
			&item.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan seller conversation: %w", err)
		}
		item.LastSenderType = models.SenderType(lastSenderType)
		items = append(items, item)
	}

	return items, total, nil
}

// ListAdminConversations lists all order conversations for Commerce & Operations supervision.
func (r *OrderConversationRepository) ListAdminConversations(search string, status string, shopID *uuid.UUID, limit, offset int) ([]models.ConversationListItemResponse, int, error) {
	if limit <= 0 {
		limit = 20
	}

	whereClauses := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if shopID != nil && *shopID != uuid.Nil {
		whereClauses = append(whereClauses, fmt.Sprintf("c.shop_id = $%d", argIdx))
		args = append(args, *shopID)
		argIdx++
	}
	if status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("o.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}
	if search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(o.order_number ILIKE $%d OR u.first_name ILIKE $%d OR u.last_name ILIKE $%d OR s.name ILIKE $%d OR b.name ILIKE $%d)", argIdx, argIdx, argIdx, argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	whereSQL := "WHERE " + strings.Join(whereClauses, " AND ")

	countQuery := fmt.Sprintf(`
		SELECT COUNT(*) 
		FROM order_conversations c
		LEFT JOIN orders o ON o.id = c.order_id
		LEFT JOIN users u ON u.id = c.buyer_id
		LEFT JOIN shops s ON s.id = c.shop_id
		LEFT JOIN businesses b ON b.id = c.business_id
		%s
	`, whereSQL)

	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(`
		SELECT 
			c.id AS conversation_id,
			c.order_id,
			COALESCE(o.order_number, '') AS order_number,
			COALESCE(o.status::text, '') AS order_status,
			c.buyer_id,
			COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.email, '') AS buyer_name,
			c.shop_id,
			COALESCE(s.name, '') AS shop_name,
			c.business_id,
			COALESCE(b.name, '') AS business_name,
			COALESCE(last_m.body, '') AS last_message,
			COALESCE(last_m.sender_type, '') AS last_sender_type,
			COALESCE(last_m.created_at, c.created_at) AS last_message_at,
			(
				SELECT COUNT(*) FROM order_messages m
				WHERE m.conversation_id = c.id
			) AS unread_count,
			c.created_at
		FROM order_conversations c
		LEFT JOIN orders o ON o.id = c.order_id
		LEFT JOIN users u ON u.id = c.buyer_id
		LEFT JOIN shops s ON s.id = c.shop_id
		LEFT JOIN businesses b ON b.id = c.business_id
		LEFT JOIN LATERAL (
			SELECT body, sender_type, created_at
			FROM order_messages
			WHERE conversation_id = c.id
			ORDER BY created_at DESC
			LIMIT 1
		) last_m ON true
		%s
		ORDER BY last_message_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	args = append(args, limit, offset)
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list admin conversations: %w", err)
	}
	defer rows.Close()

	var items []models.ConversationListItemResponse
	for rows.Next() {
		var item models.ConversationListItemResponse
		var lastSenderType string
		err := rows.Scan(
			&item.ConversationID,
			&item.OrderID,
			&item.OrderNumber,
			&item.OrderStatus,
			&item.BuyerID,
			&item.BuyerName,
			&item.ShopID,
			&item.ShopName,
			&item.BusinessID,
			&item.BusinessName,
			&item.LastMessage,
			&lastSenderType,
			&item.LastMessageAt,
			&item.UnreadCount,
			&item.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan admin conversation: %w", err)
		}
		item.LastSenderType = models.SenderType(lastSenderType)
		items = append(items, item)
	}

	return items, total, nil
}

// GetUnreadMessageCountForBuyer counts unread messages for a buyer across all conversations.
func (r *OrderConversationRepository) GetUnreadMessageCountForBuyer(buyerID uuid.UUID) (int, error) {
	query := `
		SELECT COUNT(*)
		FROM order_messages m
		INNER JOIN order_conversations c ON c.id = m.conversation_id
		WHERE c.buyer_id = $1
		  AND m.read_by_buyer_at IS NULL
		  AND m.sender_type != 'BUYER'
	`
	var count int
	err := r.db.QueryRow(query, buyerID).Scan(&count)
	return count, err
}

// GetUnreadMessageCountForSeller counts unread messages for a shop or business.
func (r *OrderConversationRepository) GetUnreadMessageCountForSeller(shopID *uuid.UUID, businessID *uuid.UUID) (int, error) {
	where := ""
	var arg interface{}
	if shopID != nil && *shopID != uuid.Nil {
		where = "c.shop_id = $1"
		arg = *shopID
	} else if businessID != nil && *businessID != uuid.Nil {
		where = "c.business_id = $1"
		arg = *businessID
	} else {
		return 0, nil
	}

	query := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM order_messages m
		INNER JOIN order_conversations c ON c.id = m.conversation_id
		WHERE %s
		  AND m.read_by_seller_at IS NULL
		  AND m.sender_type NOT IN ('SELLER', 'EMPLOYEE')
	`, where)

	var count int
	err := r.db.QueryRow(query, arg).Scan(&count)
	return count, err
}
