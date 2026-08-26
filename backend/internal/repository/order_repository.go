package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type OrderRepository struct {
	db *database.DB
}

func NewOrderRepository(db *database.DB) *OrderRepository {
	return &OrderRepository{db: db}
}

func (r *OrderRepository) Create(order *models.Order) error {
	query := `
		INSERT INTO orders (id, business_id, shop_id, customer_id, buyer_profile_id, status, total_items, notes, created_by, base_total, points_used, points_discount_amount, final_total, idempotency_key, order_number)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'BTMI-' || nextval('order_number_seq')::text)
		RETURNING created_at, updated_at, order_number
	`

	if order.ID == uuid.Nil {
		order.ID = uuid.New()
	}
	order.CreatedAt = time.Now()
	order.UpdatedAt = time.Now()

	return r.db.QueryRow(query,
		order.ID, order.BusinessID, order.ShopID, order.CustomerID, order.BuyerProfileID,
		order.Status, order.TotalItems, order.Notes, order.CreatedBy,
		order.BaseTotal, order.PointsUsed, order.PointsDiscountAmount, order.FinalTotal, order.IdempotencyKey,
	).Scan(&order.CreatedAt, &order.UpdatedAt, &order.OrderNumber)
}

func (r *OrderRepository) CreateLine(line *models.OrderLine) error {
	query := `
		INSERT INTO order_lines (id, order_id, product_id, variant_id, quantity, unit_price, base_unit_price, points_discount_per_unit, final_unit_price)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING created_at
	`

	if line.ID == uuid.Nil {
		line.ID = uuid.New()
	}
	line.CreatedAt = time.Now()

	return r.db.QueryRow(query,
		line.ID, line.OrderID, line.ProductID, line.VariantID,
		line.Quantity, line.UnitPrice, line.BaseUnitPrice, line.PointsDiscountPerUnit, line.FinalUnitPrice,
	).Scan(&line.CreatedAt)
}

func (r *OrderRepository) CreateStatusHistory(history *models.OrderStatusHistory) error {
	query := `
		INSERT INTO order_status_history (id, order_id, status, changed_by, notes)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING created_at
	`

	if history.ID == uuid.Nil {
		history.ID = uuid.New()
	}

	return r.db.QueryRow(query,
		history.ID, history.OrderID, history.Status,
		history.ChangedBy, history.Notes,
	).Scan(&history.CreatedAt)
}

func (r *OrderRepository) GetByID(id uuid.UUID) (*models.Order, error) {
	query := `
		SELECT id, business_id, shop_id, customer_id, buyer_profile_id, status, total_items, notes, created_by, base_total, points_used, points_discount_amount, final_total, idempotency_key,
		       order_number, delivery_method, delivery_fee_base, delivery_points_used, delivery_points_discount, delivery_fee_final,
		       delivery_contact_name, delivery_phone, delivery_address, delivery_notes, points_finalized, inventory_claimed,
		       accepted_at, preparing_at, ready_at, out_for_delivery_at, delivered_at, received_at, completed_at,
		       created_at, updated_at
		FROM orders WHERE id = $1
	`

	order := &models.Order{}
	err := r.db.QueryRow(query, id).Scan(
		&order.ID, &order.BusinessID, &order.ShopID, &order.CustomerID, &order.BuyerProfileID,
		&order.Status, &order.TotalItems, &order.Notes, &order.CreatedBy,
		&order.BaseTotal, &order.PointsUsed, &order.PointsDiscountAmount, &order.FinalTotal,
		&order.IdempotencyKey,
		&order.OrderNumber,
		&order.DeliveryMethod, &order.DeliveryFeeBase, &order.DeliveryPointsUsed, &order.DeliveryPointsDiscount, &order.DeliveryFeeFinal,
		&order.DeliveryContactName, &order.DeliveryPhone, &order.DeliveryAddress, &order.DeliveryNotes, &order.PointsFinalized, &order.InventoryClaimed,
		&order.AcceptedAt, &order.PreparingAt, &order.ReadyAt, &order.OutForDeliveryAt, &order.DeliveredAt, &order.ReceivedAt, &order.CompletedAt,
		&order.CreatedAt, &order.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("order not found")
	}
	if err != nil {
		return nil, err
	}

	return order, nil
}

func (r *OrderRepository) GetByIDForUpdate(id uuid.UUID) (*models.Order, error) {
	query := `
		SELECT id, business_id, shop_id, customer_id, buyer_profile_id, status, total_items, notes, created_by, base_total, points_used, points_discount_amount, final_total, idempotency_key,
		       order_number, delivery_method, delivery_fee_base, delivery_points_used, delivery_points_discount, delivery_fee_final,
		       delivery_contact_name, delivery_phone, delivery_address, delivery_notes, points_finalized, inventory_claimed,
		       accepted_at, preparing_at, ready_at, out_for_delivery_at, delivered_at, received_at, completed_at,
		       created_at, updated_at
		FROM orders WHERE id = $1
		FOR UPDATE
	`

	order := &models.Order{}
	err := r.db.QueryRow(query, id).Scan(
		&order.ID, &order.BusinessID, &order.ShopID, &order.CustomerID, &order.BuyerProfileID,
		&order.Status, &order.TotalItems, &order.Notes, &order.CreatedBy,
		&order.BaseTotal, &order.PointsUsed, &order.PointsDiscountAmount, &order.FinalTotal,
		&order.IdempotencyKey,
		&order.OrderNumber,
		&order.DeliveryMethod, &order.DeliveryFeeBase, &order.DeliveryPointsUsed, &order.DeliveryPointsDiscount, &order.DeliveryFeeFinal,
		&order.DeliveryContactName, &order.DeliveryPhone, &order.DeliveryAddress, &order.DeliveryNotes, &order.PointsFinalized, &order.InventoryClaimed,
		&order.AcceptedAt, &order.PreparingAt, &order.ReadyAt, &order.OutForDeliveryAt, &order.DeliveredAt, &order.ReceivedAt, &order.CompletedAt,
		&order.CreatedAt, &order.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("order not found")
	}
	if err != nil {
		return nil, err
	}

	return order, nil
}

func (r *OrderRepository) UpdateDelivery(id uuid.UUID, delivery *models.Order) error {
	query := `
		UPDATE orders
		SET delivery_method = $2, delivery_fee_base = $3, delivery_points_used = $4, delivery_points_discount = $5,
		    delivery_fee_final = $6, delivery_contact_name = $7, delivery_phone = $8, delivery_address = $9,
		    delivery_notes = $10, updated_at = NOW()
		WHERE id = $1
		RETURNING updated_at
	`
	var updatedAt time.Time
	return r.db.QueryRow(query,
		id, delivery.DeliveryMethod, delivery.DeliveryFeeBase, delivery.DeliveryPointsUsed, delivery.DeliveryPointsDiscount,
		delivery.DeliveryFeeFinal, delivery.DeliveryContactName, delivery.DeliveryPhone, delivery.DeliveryAddress,
		delivery.DeliveryNotes,
	).Scan(&updatedAt)
}

func (r *OrderRepository) SetPointsFinalized(id uuid.UUID) error {
	query := `UPDATE orders SET points_finalized = TRUE, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

func (r *OrderRepository) GetLinesByOrderID(orderID uuid.UUID) ([]*models.OrderLine, error) {
	query := `
		SELECT ol.id, ol.order_id, ol.product_id, ol.variant_id, ol.quantity, ol.unit_price,
		       ol.base_unit_price, ol.points_discount_per_unit, ol.final_unit_price, ol.created_at,
		       COALESCE(p.name, ''), COALESCE(p.sku, ''), COALESCE(v.name, ''), COALESCE(v.sku, ''),
		       COALESCE(v.attributes, '{}'::jsonb), COALESCE(img.url, '')
		FROM order_lines ol
		LEFT JOIN products p ON p.id = ol.product_id
		LEFT JOIN product_variants v ON v.id = ol.variant_id
		LEFT JOIN LATERAL (
			SELECT pi.url FROM product_images pi
			WHERE pi.product_id = ol.product_id
			ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.created_at ASC
			LIMIT 1
		) img ON TRUE
		WHERE ol.order_id = $1
		ORDER BY ol.created_at ASC
	`

	rows, err := r.db.Query(query, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lines []*models.OrderLine
	for rows.Next() {
		line := &models.OrderLine{}
		var attrs []byte
		err := rows.Scan(
			&line.ID, &line.OrderID, &line.ProductID, &line.VariantID,
			&line.Quantity, &line.UnitPrice, &line.BaseUnitPrice,
			&line.PointsDiscountPerUnit, &line.FinalUnitPrice, &line.CreatedAt,
			&line.ProductName, &line.ProductSKU, &line.VariantName, &line.VariantSKU,
			&attrs, &line.ImageURL,
		)
		if err != nil {
			return nil, err
		}
		line.VariantAttributes = make(models.JSONMap)
		_ = line.VariantAttributes.Scan(attrs)
		lines = append(lines, line)
	}

	return lines, rows.Err()
}

func (r *OrderRepository) GetHistoryByOrderID(orderID uuid.UUID) ([]*models.OrderStatusHistory, error) {
	query := `
		SELECT id, order_id, status, changed_by, notes, created_at
		FROM order_status_history WHERE order_id = $1
		ORDER BY created_at ASC
	`

	rows, err := r.db.Query(query, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []*models.OrderStatusHistory
	for rows.Next() {
		h := &models.OrderStatusHistory{}
		err := rows.Scan(
			&h.ID, &h.OrderID, &h.Status, &h.ChangedBy,
			&h.Notes, &h.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		history = append(history, h)
	}

	return history, rows.Err()
}

func (r *OrderRepository) GetByShopID(shopID uuid.UUID) ([]*models.Order, error) {
	query := `
		SELECT id, business_id, shop_id, customer_id, status, total_items, notes, created_by,
		       base_total, final_total, order_number, delivery_method, created_at, updated_at
		FROM orders WHERE shop_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, shopID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []*models.Order
	for rows.Next() {
		order := &models.Order{}
		err := rows.Scan(
			&order.ID, &order.BusinessID, &order.ShopID, &order.CustomerID, &order.Status,
			&order.TotalItems, &order.Notes, &order.CreatedBy, &order.BaseTotal, &order.FinalTotal,
			&order.OrderNumber, &order.DeliveryMethod,
			&order.CreatedAt, &order.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		orders = append(orders, order)
	}

	return orders, rows.Err()
}

func (r *OrderRepository) GetByBusinessID(businessID uuid.UUID) ([]*models.Order, error) {
	query := `
		SELECT id, business_id, shop_id, customer_id, status, total_items, notes, created_by,
		       base_total, final_total, order_number, delivery_method, created_at, updated_at
		FROM orders WHERE business_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []*models.Order
	for rows.Next() {
		order := &models.Order{}
		err := rows.Scan(
			&order.ID, &order.BusinessID, &order.ShopID, &order.CustomerID, &order.Status,
			&order.TotalItems, &order.Notes, &order.CreatedBy, &order.BaseTotal, &order.FinalTotal,
			&order.OrderNumber, &order.DeliveryMethod,
			&order.CreatedAt, &order.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		orders = append(orders, order)
	}

	return orders, rows.Err()
}

func (r *OrderRepository) UpdateStatus(id uuid.UUID, status models.OrderStatus) (*models.Order, error) {
	query := `
		UPDATE orders
		SET status = $2::order_status, updated_at = NOW(),
		    accepted_at = CASE WHEN $2 = 'ACCEPTED' THEN COALESCE(accepted_at, NOW()) ELSE accepted_at END,
		    preparing_at = CASE WHEN $2 = 'PREPARING' THEN COALESCE(preparing_at, NOW()) ELSE preparing_at END,
		    ready_at = CASE WHEN $2 IN ('READY', 'READY_FOR_PICKUP') THEN COALESCE(ready_at, NOW()) ELSE ready_at END,
		    out_for_delivery_at = CASE WHEN $2 = 'OUT_FOR_DELIVERY' THEN COALESCE(out_for_delivery_at, NOW()) ELSE out_for_delivery_at END,
		    delivered_at = CASE WHEN $2 = 'DELIVERED' THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END,
		    received_at = CASE WHEN $2 = 'RECEIVED' THEN COALESCE(received_at, NOW()) ELSE received_at END,
		    completed_at = CASE WHEN $2 = 'COMPLETED' THEN COALESCE(completed_at, NOW()) ELSE completed_at END
		WHERE id = $1
		RETURNING id, business_id, shop_id, customer_id, status, total_items, notes, created_by, created_at, updated_at
	`
	order := &models.Order{}
	err := r.db.QueryRow(query, id, status).Scan(
		&order.ID, &order.BusinessID, &order.ShopID, &order.CustomerID, &order.Status,
		&order.TotalItems, &order.Notes, &order.CreatedBy,
		&order.CreatedAt, &order.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("order not found")
	}
	if err != nil {
		return nil, err
	}

	return order, nil
}

func (r *OrderRepository) UpdateTotalItems(id uuid.UUID, totalItems int) error {
	query := `
		UPDATE orders 
		SET total_items = $2, updated_at = NOW()
		WHERE id = $1
	`

	_, err := r.db.Exec(query, id, totalItems)
	return err
}

func (r *OrderRepository) GetByShopIDAndStatus(shopID uuid.UUID, status models.OrderStatus) ([]*models.Order, error) {
	query := `
		SELECT id, business_id, shop_id, customer_id, status, total_items, notes, created_by, created_at, updated_at
		FROM orders WHERE shop_id = $1 AND status = $2
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, shopID, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []*models.Order
	for rows.Next() {
		order := &models.Order{}
		err := rows.Scan(
			&order.ID, &order.BusinessID, &order.ShopID, &order.CustomerID, &order.Status,
			&order.TotalItems, &order.Notes, &order.CreatedBy,
			&order.CreatedAt, &order.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		orders = append(orders, order)
	}

	return orders, rows.Err()
}

func (r *OrderRepository) GetByBuyerProfileID(buyerProfileID uuid.UUID) ([]*models.Order, error) {
	query := `
		SELECT id, business_id, shop_id, customer_id, buyer_profile_id, status, total_items, notes, created_by, base_total, points_used, points_discount_amount, final_total, idempotency_key,
		       order_number, delivery_method, delivery_fee_base, delivery_points_used, delivery_points_discount, delivery_fee_final,
		       delivery_contact_name, delivery_phone, delivery_address, delivery_notes, points_finalized,
		       accepted_at, preparing_at, ready_at, out_for_delivery_at, delivered_at, received_at, completed_at,
		       created_at, updated_at
		FROM orders WHERE buyer_profile_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, buyerProfileID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []*models.Order
	for rows.Next() {
		order := &models.Order{}
		err := rows.Scan(
			&order.ID, &order.BusinessID, &order.ShopID, &order.CustomerID, &order.BuyerProfileID,
			&order.Status, &order.TotalItems, &order.Notes, &order.CreatedBy,
			&order.BaseTotal, &order.PointsUsed, &order.PointsDiscountAmount, &order.FinalTotal,
			&order.IdempotencyKey,
			&order.OrderNumber,
			&order.DeliveryMethod, &order.DeliveryFeeBase, &order.DeliveryPointsUsed, &order.DeliveryPointsDiscount, &order.DeliveryFeeFinal,
			&order.DeliveryContactName, &order.DeliveryPhone, &order.DeliveryAddress, &order.DeliveryNotes, &order.PointsFinalized,
			&order.AcceptedAt, &order.PreparingAt, &order.ReadyAt, &order.OutForDeliveryAt, &order.DeliveredAt, &order.ReceivedAt, &order.CompletedAt,
			&order.CreatedAt, &order.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		orders = append(orders, order)
	}

	return orders, rows.Err()
}

func (r *OrderRepository) GetByBuyerAndIdempotencyKey(buyerProfileID uuid.UUID, idempotencyKey string) (*models.Order, error) {
	query := `
		SELECT id, business_id, shop_id, customer_id, buyer_profile_id, status, total_items, notes, created_by, base_total, points_used, points_discount_amount, final_total, idempotency_key,
		       order_number, delivery_method, delivery_fee_base, delivery_points_used, delivery_points_discount, delivery_fee_final,
		       delivery_contact_name, delivery_phone, delivery_address, delivery_notes, points_finalized,
		       accepted_at, preparing_at, ready_at, out_for_delivery_at, delivered_at, received_at, completed_at,
		       created_at, updated_at
		FROM orders WHERE buyer_profile_id = $1 AND idempotency_key = $2
		LIMIT 1
	`
	order := &models.Order{}
	err := r.db.QueryRow(query, buyerProfileID, idempotencyKey).Scan(
		&order.ID, &order.BusinessID, &order.ShopID, &order.CustomerID, &order.BuyerProfileID,
		&order.Status, &order.TotalItems, &order.Notes, &order.CreatedBy,
		&order.BaseTotal, &order.PointsUsed, &order.PointsDiscountAmount, &order.FinalTotal,
		&order.IdempotencyKey,
		&order.OrderNumber,
		&order.DeliveryMethod, &order.DeliveryFeeBase, &order.DeliveryPointsUsed, &order.DeliveryPointsDiscount, &order.DeliveryFeeFinal,
		&order.DeliveryContactName, &order.DeliveryPhone, &order.DeliveryAddress, &order.DeliveryNotes, &order.PointsFinalized,
		&order.AcceptedAt, &order.PreparingAt, &order.ReadyAt, &order.OutForDeliveryAt, &order.DeliveredAt, &order.ReceivedAt, &order.CompletedAt,
		&order.CreatedAt, &order.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return order, nil
}

// UpdateTrackingStatus atomically updates order status and its corresponding timestamp.
func (r *OrderRepository) UpdateTrackingStatus(id uuid.UUID, status models.OrderStatus) (*models.Order, error) {
	now := time.Now()
	query := `
		UPDATE orders
		SET status = $2::order_status, updated_at = NOW(),
		    accepted_at = CASE WHEN $2 = 'ACCEPTED' THEN COALESCE(accepted_at, NOW()) ELSE accepted_at END,
		    preparing_at = CASE WHEN $2 = 'PREPARING' THEN COALESCE(preparing_at, NOW()) ELSE preparing_at END,
		    ready_at = CASE WHEN $2 IN ('READY', 'READY_FOR_PICKUP') THEN COALESCE(ready_at, NOW()) ELSE ready_at END,
		    out_for_delivery_at = CASE WHEN $2 = 'OUT_FOR_DELIVERY' THEN COALESCE(out_for_delivery_at, NOW()) ELSE out_for_delivery_at END,
		    delivered_at = CASE WHEN $2 = 'DELIVERED' THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END,
		    received_at = CASE WHEN $2 = 'RECEIVED' THEN COALESCE(received_at, NOW()) ELSE received_at END,
		    completed_at = CASE WHEN $2 = 'COMPLETED' THEN COALESCE(completed_at, NOW()) ELSE completed_at END
		WHERE id = $1
		RETURNING id, business_id, shop_id, customer_id, buyer_profile_id, status, total_items, notes, created_by,
		          base_total, points_used, points_discount_amount, final_total, idempotency_key,
		          order_number, delivery_method, delivery_fee_base, delivery_points_used, delivery_points_discount,
		          delivery_fee_final, delivery_contact_name, delivery_phone, delivery_address, delivery_notes,
		          points_finalized,
		          accepted_at, preparing_at, ready_at, out_for_delivery_at, delivered_at, received_at, completed_at,
		          created_at, updated_at
	`
	_ = now
	order := &models.Order{}
	err := r.db.QueryRow(query, id, status).Scan(
		&order.ID, &order.BusinessID, &order.ShopID, &order.CustomerID, &order.BuyerProfileID,
		&order.Status, &order.TotalItems, &order.Notes, &order.CreatedBy,
		&order.BaseTotal, &order.PointsUsed, &order.PointsDiscountAmount, &order.FinalTotal,
		&order.IdempotencyKey,
		&order.OrderNumber,
		&order.DeliveryMethod, &order.DeliveryFeeBase, &order.DeliveryPointsUsed, &order.DeliveryPointsDiscount, &order.DeliveryFeeFinal,
		&order.DeliveryContactName, &order.DeliveryPhone, &order.DeliveryAddress, &order.DeliveryNotes, &order.PointsFinalized,
		&order.AcceptedAt, &order.PreparingAt, &order.ReadyAt, &order.OutForDeliveryAt, &order.DeliveredAt, &order.ReceivedAt, &order.CompletedAt,
		&order.CreatedAt, &order.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("order not found")
	}
	if err != nil {
		return nil, err
	}
	return order, nil
}

// GetHistoryWithActor returns status history enriched with actor_type.
func (r *OrderRepository) GetHistoryWithActor(orderID uuid.UUID) ([]map[string]interface{}, error) {
	query := `
		SELECT osh.id, osh.order_id, osh.status, osh.changed_by, osh.notes, osh.created_at,
		       CASE
		           WHEN osh.changed_by IS NULL THEN 'SYSTEM'
		           WHEN m.id IS NOT NULL THEN 'SELLER'
		           WHEN e.id IS NOT NULL THEN 'SELLER'
		           WHEN bp.id IS NOT NULL THEN 'BUYER'
		           ELSE 'UNKNOWN'
		       END as actor_type
		FROM order_status_history osh
		LEFT JOIN business_memberships m ON osh.changed_by = m.user_id
		LEFT JOIN employees e ON osh.changed_by = e.id
		LEFT JOIN buyer_profiles bp ON osh.changed_by = bp.user_id
		WHERE osh.order_id = $1
		ORDER BY osh.created_at ASC
	`

	rows, err := r.db.Query(query, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []map[string]interface{}
	for rows.Next() {
		var id, oid uuid.UUID
		var status, notes, actorType string
		var changedBy *uuid.UUID
		var createdAt time.Time
		if err := rows.Scan(&id, &oid, &status, &changedBy, &notes, &createdAt, &actorType); err != nil {
			return nil, err
		}
		entry := map[string]interface{}{
			"id":         id,
			"order_id":   oid,
			"status":     status,
			"changed_by": changedBy,
			"actor_type": actorType,
			"notes":      notes,
			"created_at": createdAt,
		}
		history = append(history, entry)
	}
	return history, rows.Err()
}

func (r *OrderRepository) SetInventoryClaimed(id uuid.UUID) error {
	query := `UPDATE orders SET inventory_claimed = TRUE, updated_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}
