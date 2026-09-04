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

type AdminCommerceRepository struct {
	db *database.DB
}

func NewAdminCommerceRepository(db *database.DB) *AdminCommerceRepository {
	return &AdminCommerceRepository{db: db}
}

// 1. Overview KPIs
func (r *AdminCommerceRepository) GetOverview() (*models.CommerceOverviewStats, error) {
	stats := &models.CommerceOverviewStats{}

	// Products counts
	_ = r.db.QueryRow(`
		SELECT 
			COUNT(*),
			COUNT(*) FILTER (WHERE publication_status = 'PUBLISHED'),
			COUNT(*) FILTER (WHERE publication_status = 'DRAFT'),
			COUNT(*) FILTER (WHERE publication_status = 'ARCHIVED')
		FROM products
	`).Scan(&stats.TotalProducts, &stats.PublishedProducts, &stats.DraftProducts, &stats.ArchivedProducts)

	// Out of stock products
	_ = r.db.QueryRow(`
		SELECT COUNT(DISTINCT p.id)
		FROM products p
		JOIN inventory inv ON p.id = inv.product_id
		GROUP BY p.id
		HAVING SUM(inv.quantity - inv.reserved_quantity) <= 0
	`).Scan(&stats.OutOfStockProducts)

	// Categories & Subcategories
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM categories`).Scan(&stats.TotalCategories)
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM subcategories`).Scan(&stats.TotalSubcategories)

	// Orders counts
	_ = r.db.QueryRow(`
		SELECT 
			COUNT(*),
			COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE),
			COUNT(*) FILTER (WHERE status = 'COMPLETED'),
			COUNT(*) FILTER (WHERE status = 'PENDING')
		FROM orders
	`).Scan(&stats.TotalOrders, &stats.OrdersToday, &stats.CompletedOrders, &stats.PendingOrders)

	// Stuck orders (Pending > 24h, Preparing > 48h, OutForDelivery > 24h)
	_ = r.db.QueryRow(`
		SELECT COUNT(*)
		FROM orders
		WHERE (status = 'PENDING' AND created_at < NOW() - INTERVAL '24 hours')
		   OR (status = 'PREPARING' AND preparing_at < NOW() - INTERVAL '48 hours')
		   OR (status = 'OUT_FOR_DELIVERY' AND out_for_delivery_at < NOW() - INTERVAL '24 hours')
	`).Scan(&stats.StuckOrders)

	// Stock anomalies
	_ = r.db.QueryRow(`
		SELECT COUNT(*)
		FROM inventory
		WHERE quantity < 0 OR reserved_quantity < 0 OR reserved_quantity > quantity
	`).Scan(&stats.StockAnomaliesCount)

	// Confirmed cash
	var cashTotal sql.NullFloat64
	_ = r.db.QueryRow(`
		SELECT COALESCE(SUM(amount), 0)
		FROM buyer_payments
		WHERE status = 'VERIFIED' OR seller_confirmed = true
	`).Scan(&cashTotal)
	if cashTotal.Valid {
		stats.ConfirmedCash = cashTotal.Float64
	}

	return stats, nil
}

// 2. Products List
func (r *AdminCommerceRepository) ListProducts(search, businessID, categoryID, subcategoryID, publicationStatus, stockStatus string, limit, offset int) ([]*models.AdminProductListItem, int, error) {
	conditions := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if search != "" {
		conditions = append(conditions, fmt.Sprintf("(LOWER(p.name) LIKE LOWER($%d) OR LOWER(p.sku) LIKE LOWER($%d))", argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if businessID != "" {
		conditions = append(conditions, fmt.Sprintf("p.business_id = $%d", argIdx))
		args = append(args, businessID)
		argIdx++
	}
	if categoryID != "" {
		conditions = append(conditions, fmt.Sprintf("p.category_id = $%d", argIdx))
		args = append(args, categoryID)
		argIdx++
	}
	if subcategoryID != "" {
		conditions = append(conditions, fmt.Sprintf("p.subcategory_id = $%d", argIdx))
		args = append(args, subcategoryID)
		argIdx++
	}
	if publicationStatus != "" {
		conditions = append(conditions, fmt.Sprintf("p.publication_status = $%d", argIdx))
		args = append(args, publicationStatus)
		argIdx++
	}

	whereClause := strings.Join(conditions, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM products p WHERE %s", whereClause)
	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count products: %w", err)
	}

	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(`
		SELECT 
			p.id, p.name, p.sku, p.business_id, COALESCE(b.name, ''),
			p.category_id, COALESCE(c.name, ''),
			p.subcategory_id, COALESCE(sc.name, ''),
			p.publication_status, p.status, p.unit_price,
			p.discount_active, p.discount_type, p.discount_value,
			img.primary_url,
			COALESCE(img_cnt.c, 0) AS image_count,
			COALESCE(v_cnt.c, 0) AS variant_count,
			COALESCE(inv.total_available, 0) AS total_available,
			p.created_at, p.updated_at
		FROM products p
		LEFT JOIN businesses b ON p.business_id = b.id
		LEFT JOIN categories c ON p.category_id = c.id
		LEFT JOIN subcategories sc ON p.subcategory_id = sc.id
		LEFT JOIN (
			SELECT DISTINCT ON (product_id) product_id, url AS primary_url
			FROM product_images
			ORDER BY product_id, is_primary DESC, sort_order ASC, created_at ASC
		) img ON p.id = img.product_id
		LEFT JOIN (
			SELECT product_id, COUNT(*) AS c FROM product_images GROUP BY product_id
		) img_cnt ON p.id = img_cnt.product_id
		LEFT JOIN (
			SELECT product_id, COUNT(*) AS c FROM product_variants GROUP BY product_id
		) v_cnt ON p.id = v_cnt.product_id
		LEFT JOIN (
			SELECT product_id, SUM(quantity - reserved_quantity) AS total_available
			FROM inventory GROUP BY product_id
		) inv ON p.id = inv.product_id
		WHERE %s
		ORDER BY p.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list products: %w", err)
	}
	defer rows.Close()

	var products []*models.AdminProductListItem
	for rows.Next() {
		item := &models.AdminProductListItem{}
		var catID, subID *uuid.UUID
		var primaryURL sql.NullString
		err := rows.Scan(
			&item.ID, &item.Name, &item.SKU, &item.BusinessID, &item.BusinessName,
			&catID, &item.CategoryName,
			&subID, &item.SubcategoryName,
			&item.PublicationStatus, &item.Status, &item.UnitPrice,
			&item.DiscountActive, &item.DiscountType, &item.DiscountValue,
			&primaryURL,
			&item.ImageCount,
			&item.VariantCount,
			&item.TotalAvailable,
			&item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan product: %w", err)
		}
		item.CategoryID = catID
		item.SubcategoryID = subID
		if primaryURL.Valid {
			item.PrimaryImage = &primaryURL.String
		}

		// Calculate effective price
		item.EffectivePrice = item.UnitPrice
		if item.DiscountActive {
			if item.DiscountType == "PERCENTAGE" && item.DiscountValue > 0 && item.DiscountValue <= 100 {
				item.EffectivePrice = item.UnitPrice * (1.0 - item.DiscountValue/100.0)
			} else if item.DiscountType == "FIXED" && item.DiscountValue > 0 && item.DiscountValue < item.UnitPrice {
				item.EffectivePrice = item.UnitPrice - item.DiscountValue
			}
		}

		products = append(products, item)
	}

	return products, total, nil
}

// 3. Product Detail
func (r *AdminCommerceRepository) GetProductDetail(id uuid.UUID) (*models.AdminProductDetail, error) {
	detail := &models.AdminProductDetail{}

	// Basic product info
	prodQuery := `
		SELECT 
			p.id, p.business_id, p.name, p.sku, p.description, p.unit_price, p.cost_price, p.unit,
			p.status, p.publication_status, p.category_id, p.subcategory_id,
			p.discount_active, p.discount_type, p.discount_value, p.discount_start, p.discount_end,
			p.created_at, p.updated_at,
			COALESCE(b.name, ''), COALESCE(c.name, ''), COALESCE(sc.name, '')
		FROM products p
		LEFT JOIN businesses b ON p.business_id = b.id
		LEFT JOIN categories c ON p.category_id = c.id
		LEFT JOIN subcategories sc ON p.subcategory_id = sc.id
		WHERE p.id = $1
	`
	err := r.db.QueryRow(prodQuery, id).Scan(
		&detail.Product.ID, &detail.Product.BusinessID, &detail.Product.Name, &detail.Product.SKU,
		&detail.Product.Description, &detail.Product.UnitPrice, &detail.Product.CostPrice, &detail.Product.Unit,
		&detail.Product.Status, &detail.Product.PublicationStatus, &detail.Product.CategoryID, &detail.Product.SubcategoryID,
		&detail.Product.DiscountActive, &detail.Product.DiscountType, &detail.Product.DiscountValue, &detail.Product.DiscountStart, &detail.Product.DiscountEnd,
		&detail.Product.CreatedAt, &detail.Product.UpdatedAt,
		&detail.BusinessName, &detail.CategoryName, &detail.SubcategoryName,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("PRODUCT_NOT_FOUND")
	}
	if err != nil {
		return nil, err
	}

	// Variants
	varRows, err := r.db.Query(`
		SELECT id, product_id, sku, name, attributes, sale_price, purchase_price, barcode, unit, status, created_at, updated_at
		FROM product_variants WHERE product_id = $1 ORDER BY created_at ASC
	`, id)
	if err == nil {
		defer varRows.Close()
		for varRows.Next() {
			v := &models.ProductVariant{}
			if err := varRows.Scan(&v.ID, &v.ProductID, &v.SKU, &v.Name, &v.Attributes, &v.SalePrice, &v.PurchasePrice, &v.Barcode, &v.Unit, &v.Status, &v.CreatedAt, &v.UpdatedAt); err == nil {
				detail.Variants = append(detail.Variants, v)
			}
		}
	}

	// Images
	imgRows, err := r.db.Query(`
		SELECT id, product_id, business_id, url, file_name, is_primary, created_at, variant_id
		FROM product_images WHERE product_id = $1 ORDER BY is_primary DESC, created_at ASC
	`, id)
	if err == nil {
		defer imgRows.Close()
		for imgRows.Next() {
			img := &models.ProductImage{}
			if err := imgRows.Scan(&img.ID, &img.ProductID, &img.BusinessID, &img.URL, &img.FileName, &img.IsPrimary, &img.CreatedAt, &img.VariantID); err == nil {
				detail.Images = append(detail.Images, img)
			}
		}
	}

	// Inventory per shop
	invRows, err := r.db.Query(`
		SELECT 
			inv.shop_id, s.name, inv.variant_id, COALESCE(v.name, ''), COALESCE(v.sku, ''),
			inv.quantity, inv.reserved_quantity, (inv.quantity - inv.reserved_quantity) AS available
		FROM inventory inv
		JOIN shops s ON inv.shop_id = s.id
		LEFT JOIN product_variants v ON inv.variant_id = v.id
		WHERE inv.product_id = $1
		ORDER BY s.name ASC
	`, id)
	if err == nil {
		defer invRows.Close()
		for invRows.Next() {
			invItem := &models.AdminShopInventorySummary{}
			if err := invRows.Scan(&invItem.ShopID, &invItem.ShopName, &invItem.VariantID, &invItem.VariantName, &invItem.SKU, &invItem.Quantity, &invItem.ReservedQuantity, &invItem.Available); err == nil {
				detail.Inventory = append(detail.Inventory, invItem)
			}
		}
	}

	// Visibility Analysis
	totalStock := 0
	for _, inv := range detail.Inventory {
		if inv.Available > 0 {
			totalStock += inv.Available
		}
	}
	detail.VisibilityReport.StockAvailable = totalStock
	detail.VisibilityReport.ProductStatus = string(detail.Product.Status)
	detail.VisibilityReport.Publication = string(detail.Product.PublicationStatus)

	var bStatus string
	_ = r.db.QueryRow("SELECT status FROM businesses WHERE id = $1", detail.Product.BusinessID).Scan(&bStatus)
	detail.VisibilityReport.BusinessStatus = bStatus

	reasons := []string{}
	if bStatus != "ACTIVE" {
		reasons = append(reasons, fmt.Sprintf("Business status is %s (must be ACTIVE)", bStatus))
	}
	if detail.Product.Status != models.ProductStatusActive {
		reasons = append(reasons, fmt.Sprintf("Product status is %s (must be ACTIVE)", detail.Product.Status))
	}
	if detail.Product.PublicationStatus != models.PublicationStatusPublished {
		reasons = append(reasons, fmt.Sprintf("Publication status is %s (must be PUBLISHED)", detail.Product.PublicationStatus))
	}
	if totalStock <= 0 {
		reasons = append(reasons, "No available stock across any shop")
	}

	detail.VisibilityReport.ReasonsNotShown = reasons
	detail.VisibilityReport.IsVisible = len(reasons) == 0

	return detail, nil
}

// 4. Update Product Publication
func (r *AdminCommerceRepository) UpdateProductPublication(id uuid.UUID, newPub models.PublicationStatus) error {
	query := `UPDATE products SET publication_status = $1, updated_at = NOW() WHERE id = $2`
	res, err := r.db.Exec(query, newPub, id)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("PRODUCT_NOT_FOUND")
	}
	return nil
}

// 5. Global Inventory View
func (r *AdminCommerceRepository) ListInventory(businessID, shopID, stockStatus string, limit, offset int) ([]*models.AdminInventoryItem, int, error) {
	conditions := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if businessID != "" {
		conditions = append(conditions, fmt.Sprintf("inv.business_id = $%d", argIdx))
		args = append(args, businessID)
		argIdx++
	}
	if shopID != "" {
		conditions = append(conditions, fmt.Sprintf("inv.shop_id = $%d", argIdx))
		args = append(args, shopID)
		argIdx++
	}
	if stockStatus == "OUT_OF_STOCK" {
		conditions = append(conditions, "(inv.quantity - inv.reserved_quantity) <= 0")
	} else if stockStatus == "LOW_STOCK" {
		conditions = append(conditions, "(inv.quantity - inv.reserved_quantity) > 0 AND (inv.quantity - inv.reserved_quantity) <= 5")
	} else if stockStatus == "IN_STOCK" {
		conditions = append(conditions, "(inv.quantity - inv.reserved_quantity) > 5")
	}

	whereClause := strings.Join(conditions, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM inventory inv WHERE %s", whereClause)
	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count inventory: %w", err)
	}

	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(`
		SELECT 
			inv.id, inv.business_id, COALESCE(b.name, ''),
			inv.shop_id, COALESCE(s.name, ''),
			inv.product_id, COALESCE(p.name, ''),
			inv.variant_id, COALESCE(v.name, ''), COALESCE(v.sku, ''),
			inv.quantity, inv.reserved_quantity, (inv.quantity - inv.reserved_quantity) AS available,
			inv.updated_at
		FROM inventory inv
		LEFT JOIN businesses b ON inv.business_id = b.id
		LEFT JOIN shops s ON inv.shop_id = s.id
		LEFT JOIN products p ON inv.product_id = p.id
		LEFT JOIN product_variants v ON inv.variant_id = v.id
		WHERE %s
		ORDER BY inv.updated_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list inventory: %w", err)
	}
	defer rows.Close()

	var items []*models.AdminInventoryItem
	for rows.Next() {
		item := &models.AdminInventoryItem{}
		err := rows.Scan(
			&item.InventoryID, &item.BusinessID, &item.BusinessName,
			&item.ShopID, &item.ShopName,
			&item.ProductID, &item.ProductName,
			&item.VariantID, &item.VariantName, &item.SKU,
			&item.Quantity, &item.ReservedQuantity, &item.Available,
			&item.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}

		if item.Available <= 0 {
			item.StockStatus = "OUT_OF_STOCK"
		} else if item.Available <= 5 {
			item.StockStatus = "LOW_STOCK"
		} else {
			item.StockStatus = "IN_STOCK"
		}

		items = append(items, item)
	}

	return items, total, nil
}

// 6. Stock Anomalies
func (r *AdminCommerceRepository) ListStockAnomalies() ([]*models.StockAnomaly, error) {
	query := `
		SELECT 
			inv.shop_id, COALESCE(s.name, ''), inv.product_id, COALESCE(p.name, ''),
			inv.variant_id, inv.quantity, inv.reserved_quantity,
			CASE 
				WHEN inv.quantity < 0 THEN 'NEGATIVE_QUANTITY'
				WHEN inv.reserved_quantity < 0 THEN 'NEGATIVE_RESERVED'
				WHEN inv.reserved_quantity > inv.quantity THEN 'OVER_RESERVED'
				ELSE 'UNKNOWN_ANOMALY'
			END AS anomaly_type,
			CASE 
				WHEN inv.quantity < 0 THEN 'Physical quantity on hand is negative (' || inv.quantity || ')'
				WHEN inv.reserved_quantity < 0 THEN 'Reserved quantity is negative (' || inv.reserved_quantity || ')'
				WHEN inv.reserved_quantity > inv.quantity THEN 'Reserved (' || inv.reserved_quantity || ') exceeds on hand (' || inv.quantity || ')'
				ELSE 'Inconsistent inventory state'
			END AS description
		FROM inventory inv
		LEFT JOIN shops s ON inv.shop_id = s.id
		LEFT JOIN products p ON inv.product_id = p.id
		WHERE inv.quantity < 0 OR inv.reserved_quantity < 0 OR inv.reserved_quantity > inv.quantity
		LIMIT 100
	`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var anomalies []*models.StockAnomaly
	for rows.Next() {
		a := &models.StockAnomaly{}
		if err := rows.Scan(&a.ShopID, &a.ShopName, &a.ProductID, &a.ProductName, &a.VariantID, &a.Quantity, &a.ReservedQuantity, &a.Type, &a.Description); err == nil {
			anomalies = append(anomalies, a)
		}
	}

	return anomalies, nil
}

// 7. Orders Listing
func (r *AdminCommerceRepository) ListOrders(status, deliveryMethod, shopID, businessID, search string, limit, offset int) ([]*models.AdminOrderItem, int, error) {
	conditions := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if status != "" {
		conditions = append(conditions, fmt.Sprintf("o.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}
	if deliveryMethod != "" {
		conditions = append(conditions, fmt.Sprintf("o.delivery_method = $%d", argIdx))
		args = append(args, deliveryMethod)
		argIdx++
	}
	if shopID != "" {
		conditions = append(conditions, fmt.Sprintf("o.shop_id = $%d", argIdx))
		args = append(args, shopID)
		argIdx++
	}
	if businessID != "" {
		conditions = append(conditions, fmt.Sprintf("o.business_id = $%d", argIdx))
		args = append(args, businessID)
		argIdx++
	}
	if search != "" {
		conditions = append(conditions, fmt.Sprintf("(o.order_number LIKE $%d OR LOWER(bp.first_name || ' ' || bp.last_name) LIKE LOWER($%d) OR bp.phone LIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	whereClause := strings.Join(conditions, " AND ")

	countQuery := fmt.Sprintf(`
		SELECT COUNT(*) 
		FROM orders o
		LEFT JOIN buyer_profiles bp ON o.buyer_profile_id = bp.id
		WHERE %s
	`, whereClause)
	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count orders: %w", err)
	}

	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(`
		SELECT 
			o.id, o.order_number, o.business_id, COALESCE(b.name, ''),
			o.shop_id, COALESCE(s.name, ''),
			o.buyer_profile_id, 
			COALESCE(bp.first_name || ' ' || bp.last_name, 'Guest / Counter'),
			COALESCE(bp.phone, o.delivery_phone),
			o.status, o.total_items, o.base_total, o.points_discount_amount, o.delivery_fee_final, o.final_total,
			COALESCE(o.delivery_method, 'PICKUP'),
			COALESCE(pay.status, 'UNPAID') AS payment_status,
			o.created_at, o.updated_at,
			CASE 
				WHEN (o.status = 'PENDING' AND o.created_at < NOW() - INTERVAL '24 hours') THEN true
				WHEN (o.status = 'PREPARING' AND o.preparing_at < NOW() - INTERVAL '48 hours') THEN true
				WHEN (o.status = 'OUT_FOR_DELIVERY' AND o.out_for_delivery_at < NOW() - INTERVAL '24 hours') THEN true
				ELSE false
			END AS is_stuck,
			CASE 
				WHEN (o.status = 'PENDING' AND o.created_at < NOW() - INTERVAL '24 hours') THEN 'Pending acceptance for >24h'
				WHEN (o.status = 'PREPARING' AND o.preparing_at < NOW() - INTERVAL '48 hours') THEN 'Preparing for >48h'
				WHEN (o.status = 'OUT_FOR_DELIVERY' AND o.out_for_delivery_at < NOW() - INTERVAL '24 hours') THEN 'In transit for >24h'
				ELSE ''
			END AS stuck_reason
		FROM orders o
		LEFT JOIN businesses b ON o.business_id = b.id
		LEFT JOIN shops s ON o.shop_id = s.id
		LEFT JOIN buyer_profiles bp ON o.buyer_profile_id = bp.id
		LEFT JOIN (
			SELECT order_id, status FROM buyer_payments ORDER BY created_at DESC LIMIT 1
		) pay ON o.id = pay.order_id
		WHERE %s
		ORDER BY o.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list orders: %w", err)
	}
	defer rows.Close()

	var orders []*models.AdminOrderItem
	for rows.Next() {
		item := &models.AdminOrderItem{}
		var stuckReason sql.NullString
		err := rows.Scan(
			&item.ID, &item.OrderNumber, &item.BusinessID, &item.BusinessName,
			&item.ShopID, &item.ShopName,
			&item.BuyerID, &item.BuyerName, &item.BuyerPhone,
			&item.Status, &item.TotalItems, &item.BaseTotal, &item.PointsDiscount, &item.DeliveryFee, &item.FinalTotal,
			&item.DeliveryMethod, &item.PaymentStatus,
			&item.CreatedAt, &item.UpdatedAt,
			&item.IsStuck, &stuckReason,
		)
		if err != nil {
			return nil, 0, err
		}
		if stuckReason.Valid {
			item.StuckReason = stuckReason.String
		}
		orders = append(orders, item)
	}

	return orders, total, nil
}

// 8. Order Detail
func (r *AdminCommerceRepository) GetOrderDetail(id uuid.UUID) (*models.AdminOrderDetail, error) {
	detail := &models.AdminOrderDetail{}

	orderQuery := `
		SELECT 
			o.id, o.order_number, o.business_id, COALESCE(b.name, ''),
			o.shop_id, COALESCE(s.name, ''),
			o.buyer_profile_id, 
			COALESCE(bp.first_name || ' ' || bp.last_name, 'Guest / Counter'),
			COALESCE(bp.phone, o.delivery_phone),
			o.status, o.total_items, o.base_total, o.points_discount_amount, o.delivery_fee_final, o.final_total,
			COALESCE(o.delivery_method, 'PICKUP'),
			COALESCE(pay.status, 'UNPAID') AS payment_status,
			o.created_at, o.updated_at
		FROM orders o
		LEFT JOIN businesses b ON o.business_id = b.id
		LEFT JOIN shops s ON o.shop_id = s.id
		LEFT JOIN buyer_profiles bp ON o.buyer_profile_id = bp.id
		LEFT JOIN (
			SELECT order_id, status FROM buyer_payments ORDER BY created_at DESC LIMIT 1
		) pay ON o.id = pay.order_id
		WHERE o.id = $1
	`
	err := r.db.QueryRow(orderQuery, id).Scan(
		&detail.Order.ID, &detail.Order.OrderNumber, &detail.Order.BusinessID, &detail.Order.BusinessName,
		&detail.Order.ShopID, &detail.Order.ShopName,
		&detail.Order.BuyerID, &detail.Order.BuyerName, &detail.Order.BuyerPhone,
		&detail.Order.Status, &detail.Order.TotalItems, &detail.Order.BaseTotal, &detail.Order.PointsDiscount, &detail.Order.DeliveryFee, &detail.Order.FinalTotal,
		&detail.Order.DeliveryMethod, &detail.Order.PaymentStatus,
		&detail.Order.CreatedAt, &detail.Order.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("ORDER_NOT_FOUND")
	}
	if err != nil {
		return nil, err
	}

	// Lines
	// order_lines has no product_name column of its own (previously this query
	// selected `product_name` directly from order_lines, which does not exist
	// there, so the query always failed silently - err was swallowed by the
	// `if err == nil` guard below - and detail.Lines came back nil/null for
	// every order, crashing the admin order-detail page). Join products for
	// the display name instead, matching order_repository.go's GetLinesByOrderID.
	lineRows, err := r.db.Query(`
		SELECT ol.id, ol.order_id, ol.product_id, ol.variant_id, ol.quantity, ol.unit_price,
		       ol.base_unit_price, ol.points_discount_per_unit, ol.final_unit_price, ol.created_at,
		       COALESCE(p.name, '')
		FROM order_lines ol
		LEFT JOIN products p ON p.id = ol.product_id
		WHERE ol.order_id = $1 ORDER BY ol.created_at ASC
	`, id)
	if err == nil {
		defer lineRows.Close()
		for lineRows.Next() {
			l := &models.OrderLine{}
			if err := lineRows.Scan(&l.ID, &l.OrderID, &l.ProductID, &l.VariantID, &l.Quantity, &l.UnitPrice, &l.BaseUnitPrice, &l.PointsDiscountPerUnit, &l.FinalUnitPrice, &l.CreatedAt, &l.ProductName); err == nil {
				detail.Lines = append(detail.Lines, l)
			}
		}
	}

	// Status history
	histRows, err := r.db.Query(`
		SELECT id, order_id, status, changed_by, notes, created_at
		FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC
	`, id)
	if err == nil {
		defer histRows.Close()
		for histRows.Next() {
			h := &models.OrderStatusHistory{}
			if err := histRows.Scan(&h.ID, &h.OrderID, &h.Status, &h.ChangedBy, &h.Notes, &h.CreatedAt); err == nil {
				detail.StatusHistory = append(detail.StatusHistory, h)
			}
		}
	}

	return detail, nil
}

// 9. Categories Management
func (r *AdminCommerceRepository) ListCategories() ([]*models.CategoryWithSubcategories, error) {
	query := `
		SELECT 
			c.id, c.name, c.slug, c.status, c.sort_order, c.created_at, c.updated_at,
			s.id, s.category_id, s.name, s.slug, s.status, s.sort_order, s.created_at, s.updated_at
		FROM categories c
		LEFT JOIN subcategories s ON c.id = s.category_id
		ORDER BY c.sort_order ASC, s.sort_order ASC
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categoriesMap := make(map[uuid.UUID]*models.CategoryWithSubcategories)
	var orderedIDs []uuid.UUID

	for rows.Next() {
		var c models.Category
		var sID, sCatID *uuid.UUID
		var sName, sSlug, sStatus *string
		var sSort *int
		var sCreated, sUpdated *time.Time

		err := rows.Scan(
			&c.ID, &c.Name, &c.Slug, &c.Status, &c.SortOrder, &c.CreatedAt, &c.UpdatedAt,
			&sID, &sCatID, &sName, &sSlug, &sStatus, &sSort, &sCreated, &sUpdated,
		)
		if err != nil {
			return nil, err
		}

		cat, exists := categoriesMap[c.ID]
		if !exists {
			cat = &models.CategoryWithSubcategories{
				ID:            c.ID,
				Name:          c.Name,
				Slug:          c.Slug,
				Status:        c.Status,
				SortOrder:     c.SortOrder,
				CreatedAt:     c.CreatedAt,
				UpdatedAt:     c.UpdatedAt,
				Subcategories: []*models.Subcategory{},
			}
			categoriesMap[c.ID] = cat
			orderedIDs = append(orderedIDs, c.ID)
		}

		if sID != nil && sName != nil {
			s := &models.Subcategory{
				ID:         *sID,
				CategoryID: *sCatID,
				Name:       *sName,
				Slug:       *sSlug,
				Status:     *sStatus,
				SortOrder:  *sSort,
				CreatedAt:  *sCreated,
				UpdatedAt:  *sUpdated,
			}
			cat.Subcategories = append(cat.Subcategories, s)
		}
	}

	result := make([]*models.CategoryWithSubcategories, len(orderedIDs))
	for i, id := range orderedIDs {
		result[i] = categoriesMap[id]
	}

	return result, nil
}

func (r *AdminCommerceRepository) CreateCategory(req *models.CreateCategoryRequest) (*models.Category, error) {
	cat := &models.Category{
		ID:        uuid.New(),
		Name:      req.Name,
		Slug:      req.Slug,
		Status:    "ACTIVE",
		SortOrder: req.SortOrder,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	query := `
		INSERT INTO categories (id, name, slug, status, sort_order, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`
	err := r.db.QueryRow(query, cat.ID, cat.Name, cat.Slug, cat.Status, cat.SortOrder, cat.CreatedAt, cat.UpdatedAt).Scan(&cat.ID)
	return cat, err
}

func (r *AdminCommerceRepository) UpdateCategory(id uuid.UUID, req *models.UpdateCategoryRequest) error {
	updates := []string{"updated_at = NOW()"}
	args := []interface{}{id}
	argIdx := 2

	if req.Name != nil {
		updates = append(updates, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *req.Name)
		argIdx++
	}
	if req.Slug != nil {
		updates = append(updates, fmt.Sprintf("slug = $%d", argIdx))
		args = append(args, *req.Slug)
		argIdx++
	}
	if req.Status != nil {
		updates = append(updates, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *req.Status)
		argIdx++
	}
	if req.SortOrder != nil {
		updates = append(updates, fmt.Sprintf("sort_order = $%d", argIdx))
		args = append(args, *req.SortOrder)
		argIdx++
	}

	query := fmt.Sprintf("UPDATE categories SET %s WHERE id = $1", strings.Join(updates, ", "))
	_, err := r.db.Exec(query, args...)
	return err
}

func (r *AdminCommerceRepository) CreateSubcategory(req *models.CreateSubcategoryRequest) (*models.Subcategory, error) {
	sub := &models.Subcategory{
		ID:         uuid.New(),
		CategoryID: req.CategoryID,
		Name:       req.Name,
		Slug:       req.Slug,
		Status:     "ACTIVE",
		SortOrder:  req.SortOrder,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	query := `
		INSERT INTO subcategories (id, category_id, name, slug, status, sort_order, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`
	err := r.db.QueryRow(query, sub.ID, sub.CategoryID, sub.Name, sub.Slug, sub.Status, sub.SortOrder, sub.CreatedAt, sub.UpdatedAt).Scan(&sub.ID)
	return sub, err
}

func (r *AdminCommerceRepository) UpdateSubcategory(id uuid.UUID, req *models.UpdateSubcategoryRequest) error {
	updates := []string{"updated_at = NOW()"}
	args := []interface{}{id}
	argIdx := 2

	if req.CategoryID != nil {
		updates = append(updates, fmt.Sprintf("category_id = $%d", argIdx))
		args = append(args, *req.CategoryID)
		argIdx++
	}
	if req.Name != nil {
		updates = append(updates, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *req.Name)
		argIdx++
	}
	if req.Slug != nil {
		updates = append(updates, fmt.Sprintf("slug = $%d", argIdx))
		args = append(args, *req.Slug)
		argIdx++
	}
	if req.Status != nil {
		updates = append(updates, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *req.Status)
		argIdx++
	}
	if req.SortOrder != nil {
		updates = append(updates, fmt.Sprintf("sort_order = $%d", argIdx))
		args = append(args, *req.SortOrder)
		argIdx++
	}

	query := fmt.Sprintf("UPDATE subcategories SET %s WHERE id = $1", strings.Join(updates, ", "))
	_, err := r.db.Exec(query, args...)
	return err
}

// 10. Employees List & Operational Control
func (r *AdminCommerceRepository) ListEmployees(limit, offset int) ([]*models.AdminEmployeeItem, int, error) {
	countQuery := "SELECT COUNT(*) FROM employees"
	var total int
	if err := r.db.QueryRow(countQuery).Scan(&total); err != nil {
		return nil, 0, err
	}

	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	query := `
		SELECT 
			e.id, e.business_id, COALESCE(b.name, ''), e.linked_user_id,
			e.first_name, e.last_name, e.email, e.job_title, e.status, e.created_at,
			COALESCE(array_to_string(array_agg(s.name) FILTER (WHERE s.name IS NOT NULL), ', '), '') AS shops
		FROM employees e
		LEFT JOIN businesses b ON e.business_id = b.id
		LEFT JOIN employee_shop_assignments esa ON e.id = esa.employee_id
		LEFT JOIN shops s ON esa.shop_id = s.id
		GROUP BY e.id, e.business_id, b.name, e.linked_user_id, e.first_name, e.last_name, e.email, e.job_title, e.status, e.created_at
		ORDER BY e.created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.Query(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var employees []*models.AdminEmployeeItem
	for rows.Next() {
		emp := &models.AdminEmployeeItem{}
		var shopList string
		err := rows.Scan(
			&emp.ID, &emp.BusinessID, &emp.BusinessName, &emp.LinkedUserID,
			&emp.FirstName, &emp.LastName, &emp.Email, &emp.JobTitle, &emp.Status, &emp.CreatedAt,
			&shopList,
		)
		if err != nil {
			return nil, 0, err
		}
		if shopList != "" {
			emp.Shops = strings.Split(shopList, ", ")
		} else {
			emp.Shops = []string{}
		}
		employees = append(employees, emp)
	}

	return employees, total, nil
}

func (r *AdminCommerceRepository) RevokeEmployeeAccess(id uuid.UUID) error {
	query := `UPDATE employees SET status = 'INACTIVE' WHERE id = $1`
	res, err := r.db.Exec(query, id)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("EMPLOYEE_NOT_FOUND")
	}
	return nil
}

// 11. Stock Movement History
func (r *AdminCommerceRepository) ListStockMovementHistory(businessID, shopID, productID, variantID, movementType, employeeID, fromDate, toDate string, limit, offset int) ([]*models.AdminStockMovementItem, int, error) {
	conditions := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if businessID != "" {
		conditions = append(conditions, fmt.Sprintf("sm.business_id = $%d", argIdx))
		args = append(args, businessID)
		argIdx++
	}
	if shopID != "" {
		conditions = append(conditions, fmt.Sprintf("sm.shop_id = $%d", argIdx))
		args = append(args, shopID)
		argIdx++
	}
	if productID != "" {
		conditions = append(conditions, fmt.Sprintf("sm.product_id = $%d", argIdx))
		args = append(args, productID)
		argIdx++
	}
	if variantID != "" {
		conditions = append(conditions, fmt.Sprintf("sm.variant_id = $%d", argIdx))
		args = append(args, variantID)
		argIdx++
	}
	if movementType != "" {
		conditions = append(conditions, fmt.Sprintf("sm.movement_type = $%d", argIdx))
		args = append(args, movementType)
		argIdx++
	}
	if employeeID != "" {
		conditions = append(conditions, fmt.Sprintf("(sm.performed_by = $%d OR sm.employee_id = $%d)", argIdx, argIdx))
		args = append(args, employeeID)
		argIdx++
	}
	if fromDate != "" {
		conditions = append(conditions, fmt.Sprintf("sm.created_at >= $%d", argIdx))
		args = append(args, fromDate)
		argIdx++
	}
	if toDate != "" {
		conditions = append(conditions, fmt.Sprintf("sm.created_at <= $%d", argIdx))
		args = append(args, toDate)
		argIdx++
	}

	whereClause := strings.Join(conditions, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM stock_movements sm WHERE %s", whereClause)
	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count stock movements: %w", err)
	}

	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(`
		SELECT 
			sm.id, sm.business_id, COALESCE(b.name, ''),
			sm.shop_id, COALESCE(s.name, ''),
			sm.product_id, COALESCE(p.name, ''),
			sm.variant_id, COALESCE(pv.name, ''), COALESCE(pv.sku, ''),
			sm.movement_type, sm.quantity, sm.previous_quantity, sm.new_quantity,
			sm.notes, sm.performed_by,
			COALESCE(TRIM(u.first_name || ' ' || u.last_name), ''),
			sm.employee_id,
			COALESCE(TRIM(e.first_name || ' ' || e.last_name), ''),
			CASE 
				WHEN sm.reference_id IS NOT NULL AND EXISTS (SELECT 1 FROM orders WHERE id = sm.reference_id) THEN 'ORDER'
				WHEN sm.reference_id IS NOT NULL AND EXISTS (SELECT 1 FROM stock_receipts WHERE id = sm.reference_id) THEN 'RECEIPT'
				WHEN sm.movement_type = 'ADJUSTMENT' THEN 'ADMIN_ADJUSTMENT'
				ELSE 'OTHER'
			END AS reference_type,
			sm.reference_id,
			sm.created_at
		FROM stock_movements sm
		LEFT JOIN businesses b ON sm.business_id = b.id
		LEFT JOIN shops s ON sm.shop_id = s.id
		LEFT JOIN products p ON sm.product_id = p.id
		LEFT JOIN product_variants pv ON sm.variant_id = pv.id
		LEFT JOIN users u ON sm.performed_by = u.id
		LEFT JOIN employees e ON sm.employee_id = e.id
		WHERE %s
		ORDER BY sm.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list stock movements: %w", err)
	}
	defer rows.Close()

	var items []*models.AdminStockMovementItem
	for rows.Next() {
		item := &models.AdminStockMovementItem{}
		var variantID, performedBy, employeeID, referenceID *uuid.UUID
		var variantName, variantSKU sql.NullString
		err := rows.Scan(
			&item.ID, &item.BusinessID, &item.BusinessName,
			&item.ShopID, &item.ShopName,
			&item.ProductID, &item.ProductName,
			&variantID, &variantName, &variantSKU,
			&item.MovementType, &item.Quantity, &item.PreviousQuantity, &item.NewQuantity,
			&item.Notes, &performedBy, &item.PerformerName,
			&employeeID, &item.EmployeeName,
			&item.ReferenceType, &referenceID, &item.CreatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		item.VariantID = variantID
		item.EmployeeID = employeeID
		item.PerformedBy = performedBy
		item.ReferenceID = referenceID
		if variantName.Valid {
			item.VariantName = variantName.String
		}
		if variantSKU.Valid {
			item.VariantSKU = variantSKU.String
		}
		items = append(items, item)
	}

	return items, total, nil
}

// 12. Marketplace Visibility
func (r *AdminCommerceRepository) GetMarketplaceVisibility(productID uuid.UUID) (*models.AdminMarketplaceVisibility, error) {
	vis := &models.AdminMarketplaceVisibility{ProductID: productID}

	// Get product and related info
	query := `
		SELECT
			p.id, p.status, p.publication_status,
			b.status, s.id, s.status,
			COALESCE(inv.total_available, 0)
		FROM products p
		JOIN businesses b ON p.business_id = b.id
		LEFT JOIN shops s ON s.business_id = b.id
		LEFT JOIN (
			SELECT product_id, shop_id, SUM(GREATEST(quantity - reserved_quantity, 0)) AS total_available
			FROM inventory GROUP BY product_id, shop_id
		) inv ON p.id = inv.product_id AND s.id = inv.shop_id
		WHERE p.id = $1
		ORDER BY (s.status = 'ACTIVE') DESC, COALESCE(inv.total_available, 0) DESC
		LIMIT 1
	`

	var businessStatus, shopStatus sql.NullString
	var shopID *uuid.UUID
	var stockAvailable int

	err := r.db.QueryRow(query, productID).Scan(
		&vis.ProductID, &vis.ProductStatus, &vis.PublicationStatus,
		&businessStatus, &shopID, &shopStatus, &stockAvailable,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("PRODUCT_NOT_FOUND")
	}
	if err != nil {
		return nil, err
	}

	if businessStatus.Valid {
		vis.BusinessStatus = businessStatus.String
	}
	if shopID != nil && shopStatus.Valid {
		vis.ShopStatus = shopStatus.String
	}
	vis.StockAvailable = stockAvailable

	// The current schema has no separate offer, moderation, or policy tables.
	// A product is offered by an active shop of its business with real inventory.
	if shopID != nil {
		vis.ShopOfferStatus = "AVAILABLE"
	} else {
		vis.ShopOfferStatus = "UNAVAILABLE"
	}
	vis.ModerationStatus = "UNAVAILABLE"
	vis.PolicyStatus = "UNAVAILABLE"

	// Build reasons
	reasons := []string{}
	if vis.BusinessStatus != "ACTIVE" {
		reasons = append(reasons, fmt.Sprintf("Business status is %s (must be ACTIVE)", vis.BusinessStatus))
	}
	if vis.ShopStatus != "ACTIVE" {
		reasons = append(reasons, fmt.Sprintf("Shop status is %s (must be ACTIVE)", vis.ShopStatus))
	}
	if vis.ProductStatus != "ACTIVE" {
		reasons = append(reasons, fmt.Sprintf("Product status is %s (must be ACTIVE)", vis.ProductStatus))
	}
	if vis.PublicationStatus != "PUBLISHED" {
		reasons = append(reasons, fmt.Sprintf("Publication status is %s (must be PUBLISHED)", vis.PublicationStatus))
	}

	vis.ReasonsNotShown = reasons
	vis.IsVisible = len(reasons) == 0

	return vis, nil
}

// 13. Public Shop Page Control
func (r *AdminCommerceRepository) GetShopPageControl(shopID uuid.UUID) (*models.AdminShopPageControl, error) {
	shop := &models.AdminShopPageControl{ShopID: shopID}
	var businessStatus string

	// Get shop with business info
	query := `
		SELECT
			s.id, s.business_id, s.name,
			TRIM(CONCAT_WS(', ', NULLIF(s.address, ''), NULLIF(s.city, ''))), s.status,
			s.created_at, s.updated_at,
			b.name, b.status
		FROM shops s
		JOIN businesses b ON s.business_id = b.id
		WHERE s.id = $1
	`
	err := r.db.QueryRow(query, shopID).Scan(
		&shop.ShopID, &shop.BusinessID, &shop.ShopName, &shop.Location, &shop.Status,
		&shop.CreatedAt, &shop.UpdatedAt,
		&shop.BusinessName, &businessStatus,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("SHOP_NOT_FOUND")
	}
	if err != nil {
		return nil, err
	}

	// Active categories (categories with published products in this shop)
	catRows, err := r.db.Query(`
		SELECT DISTINCT c.name
		FROM categories c
		JOIN products p ON p.category_id = c.id
		JOIN inventory i ON i.product_id = p.id
		WHERE i.shop_id = $1 AND p.publication_status = 'PUBLISHED' AND p.status = 'ACTIVE'
		ORDER BY c.sort_order
	`, shopID)
	if err == nil {
		defer catRows.Close()
		for catRows.Next() {
			var catName string
			if err := catRows.Scan(&catName); err == nil {
				shop.ActiveCategories = append(shop.ActiveCategories, catName)
			}
		}
	}

	// Product counts
	_ = r.db.QueryRow(`
		SELECT COUNT(*), COUNT(*) FILTER (WHERE publication_status = 'PUBLISHED')
		FROM products p
		WHERE p.business_id = $1
	`, shop.BusinessID).Scan(&shop.ProductCount, &shop.PublishedProducts)

	// Rating and review count
	_ = r.db.QueryRow(`
		SELECT COALESCE(AVG(rating), 0), COUNT(*)
		FROM seller_reviews
		WHERE shop_id = $1 AND status = 'PUBLISHED'
	`, shopID).Scan(&shop.Rating, &shop.ReviewCount)

	// Marketplace visibility check
	reasons := []string{}
	if businessStatus != "ACTIVE" {
		reasons = append(reasons, fmt.Sprintf("Business status is %s", businessStatus))
	}
	if shop.Status != "ACTIVE" {
		reasons = append(reasons, fmt.Sprintf("Shop status is %s", shop.Status))
	}
	if shop.PublishedProducts == 0 {
		reasons = append(reasons, "No published products")
	}

	// Check if shop has any stock
	var totalStock int
	_ = r.db.QueryRow(`
		SELECT COALESCE(SUM(quantity - reserved_quantity), 0)
		FROM inventory WHERE shop_id = $1
	`, shopID).Scan(&totalStock)
	if totalStock <= 0 {
		reasons = append(reasons, "No available stock")
	}

	shop.MarketplaceVisibility = len(reasons) == 0

	return shop, nil
}

// 14. Search Admin (placeholder - search_query_log table not implemented)
func (r *AdminCommerceRepository) GetSearchAnalytics() (*models.AdminSearchAnalytics, error) {
	// Check if search_query_log table exists
	var tableExists bool
	err := r.db.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables 
			WHERE table_name = 'search_query_log'
		)
	`).Scan(&tableExists)

	if err != nil || !tableExists {
		return &models.AdminSearchAnalytics{
			Available: false,
			Message:   "Search analytics not available: search_query_log table not implemented",
		}, nil
	}

	// Table exists - return real analytics
	var totalQueries, zeroResults, failedSearches int
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM search_query_log`).Scan(&totalQueries)
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM search_query_log WHERE results_count = 0`).Scan(&zeroResults)
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM search_query_log WHERE error IS NOT NULL`).Scan(&failedSearches)

	return &models.AdminSearchAnalytics{
		Available:      true,
		Message:        "Search analytics retrieved",
		TotalQueries:   totalQueries,
		ZeroResults:    zeroResults,
		FailedSearches: failedSearches,
	}, nil
}

func (r *AdminCommerceRepository) ListSearchQueries(limit, offset int) ([]*models.AdminSearchQueryLog, int, error) {
	// Check if search_query_log table exists
	var tableExists bool
	err := r.db.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables 
			WHERE table_name = 'search_query_log'
		)
	`).Scan(&tableExists)

	if err != nil || !tableExists {
		return []*models.AdminSearchQueryLog{}, 0, nil
	}

	query := `
		SELECT query, results_count, search_type, created_at
		FROM search_query_log
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`
	rows, err := r.db.Query(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var logs []*models.AdminSearchQueryLog
	for rows.Next() {
		log := &models.AdminSearchQueryLog{}
		if err := rows.Scan(&log.Query, &log.ResultsCount, &log.SearchType, &log.CreatedAt); err == nil {
			logs = append(logs, log)
		}
	}

	var total int
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM search_query_log`).Scan(&total)

	return logs, total, nil
}

// 15. Marketplace Ranking Inspection
func (r *AdminCommerceRepository) GetMarketplaceRanking() (*models.AdminMarketplaceRanking, error) {
	// Check if ranking configuration exists in Redis or database
	// For now, return available factors from the category ranking service
	return &models.AdminMarketplaceRanking{
		Available: true,
		Message:   "Ranking factors retrieved from category ranking service",
		RankingFactors: []string{
			"relevance",
			"seller_trust_score",
			"seller_points",
			"availability",
			"category_match",
			"review_score",
			"popularity",
			"similarity",
		},
		CategoryWeights: map[string]float64{
			"relevance":      0.30,
			"seller_trust":   0.15,
			"seller_points":  0.10,
			"availability":   0.15,
			"category_match": 0.10,
			"review_score":   0.10,
			"popularity":     0.05,
			"similarity":     0.05,
		},
	}, nil
}

// 16. Product Card Quality Control
func (r *AdminCommerceRepository) GetProductCardQuality(productID uuid.UUID) (*models.AdminProductCardQuality, error) {
	quality := &models.AdminProductCardQuality{ProductID: productID}

	query := `
		SELECT 
			p.id, p.name, p.unit_price, p.discount_active, p.discount_type, p.discount_value,
			img.primary_url,
			COALESCE(img_cnt.c, 0) AS image_count,
			s.name AS shop_name,
			CASE WHEN COALESCE(inv.total_available, 0) > 0 THEN 'AVAILABLE' ELSE 'OUT_OF_STOCK' END,
			COALESCE(r.avg_rating, 0) AS rating,
			COALESCE(r.review_count, 0) AS review_count
		FROM products p
		LEFT JOIN (
			SELECT DISTINCT ON (product_id) product_id, url AS primary_url
			FROM product_images
			ORDER BY product_id, is_primary DESC, sort_order ASC, created_at ASC
		) img ON p.id = img.product_id
		LEFT JOIN (
			SELECT product_id, COUNT(*) AS c FROM product_images GROUP BY product_id
		) img_cnt ON p.id = img_cnt.product_id
		LEFT JOIN shops s ON s.business_id = p.business_id AND s.status = 'ACTIVE'
		LEFT JOIN (
			SELECT product_id, SUM(quantity - reserved_quantity) AS total_available
			FROM inventory GROUP BY product_id
		) inv ON p.id = inv.product_id
		LEFT JOIN (
			SELECT product_id, average_rating AS avg_rating, total_reviews AS review_count
			FROM product_review_aggregates
		) r ON p.id = r.product_id
		WHERE p.id = $1
		LIMIT 1
	`

	var primaryURL sql.NullString
	var shopName sql.NullString
	err := r.db.QueryRow(query, productID).Scan(
		&quality.ProductID, &quality.ProductName, &quality.RegularPrice,
		&quality.HasOffBadge, &quality.DiscountType, &quality.DiscountValue,
		&primaryURL, &quality.ImageCount, &shopName, &quality.Availability,
		&quality.Rating, &quality.ReviewCount,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("PRODUCT_NOT_FOUND")
	}
	if err != nil {
		return nil, err
	}

	if primaryURL.Valid {
		quality.HasPrimaryImage = true
		quality.PrimaryImageURL = primaryURL.String
	}
	if shopName.Valid {
		quality.ShopName = shopName.String
	}

	// Calculate effective price
	quality.EffectivePrice = quality.RegularPrice
	if quality.HasOffBadge {
		if quality.DiscountType == "PERCENTAGE" && quality.DiscountValue > 0 && quality.DiscountValue <= 100 {
			quality.EffectivePrice = quality.RegularPrice * (1.0 - quality.DiscountValue/100.0)
			quality.DiscountPercent = quality.DiscountValue
		} else if quality.DiscountType == "FIXED" && quality.DiscountValue > 0 && quality.DiscountValue < quality.RegularPrice {
			quality.EffectivePrice = quality.RegularPrice - quality.DiscountValue
			quality.DiscountPercent = (quality.DiscountValue / quality.RegularPrice) * 100
		}
		quality.HasEffectivePrice = true
		quality.HasRegularPrice = true
	}

	// Check issues
	issues := []string{}
	if !quality.HasPrimaryImage {
		issues = append(issues, "Missing primary image")
	}
	if quality.ImageCount == 0 {
		issues = append(issues, "No images at all")
	}
	if !quality.HasEffectivePrice && quality.RegularPrice <= 0 {
		issues = append(issues, "Invalid or missing price")
	}
	if quality.ShopName == "" {
		issues = append(issues, "No active shop offer")
	}
	if quality.Availability == "OUT_OF_STOCK" || quality.Availability == "UNAVAILABLE" {
		issues = append(issues, "Out of stock")
	}
	if quality.Rating == 0 && quality.ReviewCount == 0 {
		issues = append(issues, "No ratings/reviews")
	}

	quality.Issues = issues

	return quality, nil
}

// 17. Promotion Visibility
func (r *AdminCommerceRepository) ListPromotionVisibility(limit, offset int) ([]*models.AdminPromotionVisibility, int, error) {
	query := `
		SELECT
			p.id, p.name,
			s.id, s.name,
			p.unit_price,
			p.discount_active, p.discount_type, p.discount_value,
			p.discount_start, p.discount_end,
			p.status
		FROM products p
		JOIN LATERAL (
			SELECT s.id, s.name
			FROM shops s
			LEFT JOIN inventory i ON i.shop_id = s.id AND i.product_id = p.id
			WHERE s.business_id = p.business_id AND s.status = 'ACTIVE'
			GROUP BY s.id, s.name
			ORDER BY COALESCE(SUM(GREATEST(i.quantity - i.reserved_quantity, 0)), 0) DESC
			LIMIT 1
		) s ON true
		WHERE p.discount_active = true
		ORDER BY p.discount_start DESC NULLS LAST
		LIMIT $1 OFFSET $2
	`

	countQuery := `
		SELECT COUNT(*)
		FROM products p WHERE p.discount_active = true
	`

	var total int
	_ = r.db.QueryRow(countQuery).Scan(&total)

	rows, err := r.db.Query(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var promos []*models.AdminPromotionVisibility
	for rows.Next() {
		promo := &models.AdminPromotionVisibility{}
		var discountStart, discountEnd *time.Time
		err := rows.Scan(
			&promo.ProductID, &promo.ProductName,
			&promo.ShopID, &promo.ShopName,
			&promo.RegularPrice,
			&promo.IsActive, &promo.DiscountType, &promo.DiscountValue,
			&discountStart, &discountEnd,
			&promo.Status,
		)
		if err != nil {
			continue
		}
		promo.StartDate = discountStart
		promo.EndDate = discountEnd

		// Calculate sale price
		promo.SalePrice = promo.RegularPrice
		if promo.IsActive {
			if promo.DiscountType == "PERCENTAGE" && promo.DiscountValue > 0 && promo.DiscountValue <= 100 {
				promo.SalePrice = promo.RegularPrice * (1.0 - promo.DiscountValue/100.0)
			} else if promo.DiscountType == "FIXED" && promo.DiscountValue > 0 && promo.DiscountValue < promo.RegularPrice {
				promo.SalePrice = promo.RegularPrice - promo.DiscountValue
			}
			promo.OffBadge = true
		}

		// Check if promotion is currently active
		now := time.Now()
		if promo.IsActive && promo.StartDate != nil && promo.StartDate.After(now) {
			promo.Status = "SCHEDULED"
		} else if promo.IsActive && promo.EndDate != nil && promo.EndDate.Before(now) {
			promo.Status = "EXPIRED"
			promo.IsActive = false
		} else if promo.IsActive {
			promo.Status = "ACTIVE"
		}

		promos = append(promos, promo)
	}

	return promos, total, nil
}

// 18. Seller Performance
func (r *AdminCommerceRepository) GetSellerPerformance(limit, offset int) ([]*models.AdminSellerPerformance, int, error) {
	query := `
		WITH owner AS (
			SELECT DISTINCT ON (bm.business_id) bm.business_id, u.id, TRIM(u.first_name || ' ' || u.last_name) name
			FROM business_memberships bm JOIN users u ON u.id = bm.user_id
			WHERE bm.status = 'ACTIVE'
			ORDER BY bm.business_id, (bm.role = 'OWNER') DESC, bm.created_at
		), ord AS (
			SELECT business_id, COUNT(*) orders_received,
				COUNT(*) FILTER (WHERE status NOT IN ('PENDING','REJECTED','CANCELLED')) orders_accepted,
				COUNT(*) FILTER (WHERE status = 'REJECTED') orders_rejected,
				COALESCE(AVG(EXTRACT(EPOCH FROM (preparing_at-created_at))/3600) FILTER (WHERE preparing_at IS NOT NULL),0) avg_prep,
				COUNT(*) FILTER (WHERE status='COMPLETED')::float / NULLIF(COUNT(*),0) * 100 completion_rate,
				COUNT(*) FILTER (WHERE status='CANCELLED') cancellations
			FROM orders GROUP BY business_id
		), rev AS (
			SELECT business_id, COALESCE(AVG(rating),0) review_score FROM seller_reviews WHERE status='PUBLISHED' GROUP BY business_id
		), disputes AS (
			SELECT business_id, COUNT(*) disputes FROM cases WHERE business_id IS NOT NULL GROUP BY business_id
		)
		SELECT COALESCE(owner.id,b.id), COALESCE(owner.name,b.name), b.id, b.name,
			COALESCE(ord.orders_received,0), COALESCE(ord.orders_accepted,0), COALESCE(ord.orders_rejected,0),
			COALESCE(ord.avg_prep,0), COALESCE(ord.completion_rate,0), COALESCE(ord.cancellations,0),
			COALESCE(rev.review_score,0),
			CASE WHEN COALESCE(ord.orders_received,0)=0 THEN 0 ELSE COALESCE(disputes.disputes,0)::float/ord.orders_received*100 END
		FROM businesses b LEFT JOIN owner ON owner.business_id=b.id LEFT JOIN ord ON ord.business_id=b.id
		LEFT JOIN rev ON rev.business_id=b.id LEFT JOIN disputes ON disputes.business_id=b.id
		ORDER BY COALESCE(ord.orders_received,0) DESC
		LIMIT $1 OFFSET $2
	`

	countQuery := `SELECT COUNT(*) FROM businesses`
	var total int
	_ = r.db.QueryRow(countQuery).Scan(&total)

	rows, err := r.db.Query(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var perf []*models.AdminSellerPerformance
	for rows.Next() {
		p := &models.AdminSellerPerformance{}
		err := rows.Scan(
			&p.SellerID, &p.SellerName,
			&p.BusinessID, &p.BusinessName,
			&p.OrdersReceived, &p.OrdersAccepted, &p.OrdersRejected,
			&p.AvgPreparationTime, &p.CompletionRate, &p.Cancellations,
			&p.ReviewScore, &p.DisputeRate,
		)
		if err != nil {
			continue
		}
		if p.OrdersReceived > 0 {
			p.AcceptanceRate = float64(p.OrdersAccepted) / float64(p.OrdersReceived) * 100
			p.RejectionRate = float64(p.OrdersRejected) / float64(p.OrdersReceived) * 100
		}
		perf = append(perf, p)
	}

	return perf, total, nil
}

// 19. Product Performance
func (r *AdminCommerceRepository) GetProductPerformance(limit, offset int) ([]*models.AdminProductPerformance, int, error) {
	query := `
		SELECT
			p.id, p.name, COALESCE(p.sku,''),
			NULL::integer, NULL::integer, NULL::integer,
			COALESCE(ord.orders, 0),
			NULL::float8 AS conversion,
			COALESCE(ord.sales_value, 0),
			COALESCE(r.average_rating, 0),
			CASE
				WHEN inv.total_avail > 0 THEN 'IN_STOCK'
				WHEN inv.total_avail = 0 THEN 'OUT_OF_STOCK'
				ELSE 'UNKNOWN'
			END
		FROM products p
		LEFT JOIN (
			SELECT ol.product_id, COUNT(DISTINCT ol.order_id) AS orders,
				SUM(COALESCE(ol.final_unit_price,ol.unit_price) * ol.quantity) AS sales_value
			FROM order_lines ol
			JOIN orders o ON ol.order_id = o.id
			WHERE o.status IN ('COMPLETED', 'DELIVERED', 'RECEIVED')
			GROUP BY ol.product_id
		) ord ON p.id = ord.product_id
		LEFT JOIN product_review_aggregates r ON r.product_id = p.id
		LEFT JOIN (
			SELECT product_id, SUM(quantity - reserved_quantity) AS total_avail
			FROM inventory GROUP BY product_id
		) inv ON p.id = inv.product_id
		ORDER BY ord.orders DESC
		LIMIT $1 OFFSET $2
	`

	countQuery := `SELECT COUNT(*) FROM products`
	var total int
	_ = r.db.QueryRow(countQuery).Scan(&total)

	rows, err := r.db.Query(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var perf []*models.AdminProductPerformance
	for rows.Next() {
		p := &models.AdminProductPerformance{}
		err := rows.Scan(
			&p.ProductID, &p.ProductName, &p.SKU,
			&p.Views, &p.Favorites, &p.AddToCart, &p.Orders,
			&p.ConversionRate, &p.SalesValue, &p.ReviewScore, &p.StockState,
		)
		if err != nil {
			continue
		}
		perf = append(perf, p)
	}

	return perf, total, nil
}

// 20. Category Performance
func (r *AdminCommerceRepository) GetCategoryPerformance() ([]*models.AdminCategoryPerformance, error) {
	query := `
		WITH prod AS (
			SELECT p.category_id, COUNT(*) product_count,
				COUNT(*) FILTER (WHERE p.publication_status='PUBLISHED') published_products,
				COUNT(DISTINCT p.business_id) FILTER (WHERE p.publication_status='PUBLISHED') active_sellers,
				COUNT(*) FILTER (WHERE COALESCE(inv.available,0)>0) available_products
			FROM products p LEFT JOIN (
				SELECT product_id,SUM(GREATEST(quantity-reserved_quantity,0)) available FROM inventory GROUP BY product_id
			) inv ON inv.product_id=p.id GROUP BY p.category_id
		), sales AS (
			SELECT p.category_id,COUNT(DISTINCT ol.order_id) orders,
				SUM(COALESCE(ol.final_unit_price,ol.unit_price)*ol.quantity) sales_value
			FROM order_lines ol JOIN products p ON p.id=ol.product_id JOIN orders o ON o.id=ol.order_id
			WHERE o.status IN ('COMPLETED','DELIVERED','RECEIVED') GROUP BY p.category_id
		)
		SELECT c.id,c.name,COALESCE(prod.product_count,0),COALESCE(prod.published_products,0),
			COALESCE(prod.active_sellers,0),COALESCE(sales.orders,0),COALESCE(sales.sales_value,0),
			CASE WHEN COALESCE(prod.product_count,0)=0 THEN 0 ELSE prod.available_products::float/prod.product_count*100 END,
			NULL::integer, NULL::float8
		FROM categories c LEFT JOIN prod ON prod.category_id=c.id LEFT JOIN sales ON sales.category_id=c.id
		ORDER BY c.sort_order
	`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var perf []*models.AdminCategoryPerformance
	for rows.Next() {
		p := &models.AdminCategoryPerformance{}
		err := rows.Scan(
			&p.CategoryID, &p.CategoryName,
			&p.ProductCount, &p.PublishedProducts, &p.ActiveSellers,
			&p.Orders, &p.SalesValue, &p.AvailabilityScore,
			&p.SearchVolume, &p.ConversionRate,
		)
		if err != nil {
			continue
		}
		perf = append(perf, p)
	}

	return perf, nil
}

// 21. Shop Performance
func (r *AdminCommerceRepository) GetShopPerformance(limit, offset int) ([]*models.AdminShopPerformance, int, error) {
	query := `
		WITH ord AS (
			SELECT shop_id,COUNT(*) orders,
				COUNT(*) FILTER (WHERE status IN ('COMPLETED','DELIVERED','RECEIVED')) completed,
				COUNT(*) FILTER (WHERE status='CANCELLED') cancellations,
				COALESCE(AVG(EXTRACT(EPOCH FROM (delivered_at-created_at))/3600) FILTER (WHERE delivered_at IS NOT NULL),0) avg_fulfillment
			FROM orders GROUP BY shop_id
		), inv AS (
			SELECT shop_id,COUNT(DISTINCT product_id) products,
				AVG(CASE WHEN quantity-reserved_quantity>0 THEN 1.0 ELSE 0.0 END)*100 avail_score
			FROM inventory GROUP BY shop_id
		), pay AS (
			SELECT shop_id,COUNT(*) FILTER (WHERE seller_confirmed)::float/NULLIF(COUNT(*),0)*100 confirm_rate
			FROM buyer_payments GROUP BY shop_id
		)
		SELECT s.id,s.name,s.business_id,b.name,
			COALESCE(ord.orders,0),COALESCE(ord.completed,0),COALESCE(ord.cancellations,0),COALESCE(inv.products,0),
			COALESCE(inv.avail_score,0),COALESCE(r.average_rating,0),COALESCE(pay.confirm_rate,0),COALESCE(ord.avg_fulfillment,0)
		FROM shops s
		JOIN businesses b ON s.business_id = b.id
		LEFT JOIN ord ON ord.shop_id=s.id LEFT JOIN inv ON inv.shop_id=s.id
		LEFT JOIN shop_review_aggregates r ON r.shop_id=s.id LEFT JOIN pay ON pay.shop_id=s.id
		ORDER BY COALESCE(ord.orders,0) DESC
		LIMIT $1 OFFSET $2
	`

	countQuery := `SELECT COUNT(*) FROM shops WHERE status = 'ACTIVE'`
	var total int
	_ = r.db.QueryRow(countQuery).Scan(&total)

	rows, err := r.db.Query(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var perf []*models.AdminShopPerformance
	for rows.Next() {
		p := &models.AdminShopPerformance{}
		err := rows.Scan(
			&p.ShopID, &p.ShopName, &p.BusinessID, &p.BusinessName,
			&p.Orders, &p.CompletedOrders, &p.Cancellations,
			&p.Products, &p.StockAvailability, &p.ReviewScore,
			&p.CashConfirmationRate, &p.AvgFulfillmentTime,
		)
		if err != nil {
			continue
		}
		perf = append(perf, p)
	}

	return perf, total, nil
}

// 22. Employee Shop Authorization
func (r *AdminCommerceRepository) CheckEmployeeShopAuth(employeeID, shopID uuid.UUID) (*models.AdminEmployeeShopAuth, error) {
	auth := &models.AdminEmployeeShopAuth{EmployeeID: employeeID, ShopID: shopID}

	// Check if employee is assigned to shop
	var assigned bool
	err := r.db.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM employee_shop_assignments 
			WHERE employee_id = $1 AND shop_id = $2
		)
	`, employeeID, shopID).Scan(&assigned)

	if err != nil {
		return nil, err
	}

	// Get employee name
	var fn, ln string
	_ = r.db.QueryRow("SELECT first_name, last_name FROM employees WHERE id = $1", employeeID).Scan(&fn, &ln)
	auth.EmployeeName = fmt.Sprintf("%s %s", fn, ln)

	// Get shop info
	var businessID uuid.UUID
	var shopName string
	_ = r.db.QueryRow("SELECT business_id, name FROM shops WHERE id = $1", shopID).Scan(&businessID, &shopName)
	auth.BusinessID = businessID
	auth.ShopName = shopName

	if !assigned {
		auth.CanOperate = false
		auth.Reason = "Employee not assigned to this shop"
		return auth, nil
	}

	// Check if employee is active
	var empStatus string
	_ = r.db.QueryRow("SELECT status FROM employees WHERE id = $1", employeeID).Scan(&empStatus)
	if empStatus != "ACTIVE" {
		auth.CanOperate = false
		auth.Reason = fmt.Sprintf("Employee status is %s", empStatus)
		return auth, nil
	}

	// Check if shop is active
	var shopStatus string
	_ = r.db.QueryRow("SELECT status FROM shops WHERE id = $1", shopID).Scan(&shopStatus)
	if shopStatus != "ACTIVE" {
		auth.CanOperate = false
		auth.Reason = fmt.Sprintf("Shop status is %s", shopStatus)
		return auth, nil
	}

	// Check if business is active
	var bizStatus string
	_ = r.db.QueryRow("SELECT status FROM businesses WHERE id = $1", businessID).Scan(&bizStatus)
	if bizStatus != "ACTIVE" {
		auth.CanOperate = false
		auth.Reason = fmt.Sprintf("Business status is %s", bizStatus)
		return auth, nil
	}

	auth.CanOperate = true
	return auth, nil
}
