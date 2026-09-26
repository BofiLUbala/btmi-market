package repository

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// ListBusinesses is Commerce's register of real business entities: the name the
// merchant registered, its owner, and live shop/product/order/GMV counters.
func (r *AdminCommerceRepository) ListBusinesses(search, status string, limit, offset int) ([]*models.AdminBusinessListItem, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	conds := []string{"1=1"}
	args := []interface{}{}
	if search != "" {
		args = append(args, "%"+search+"%")
		n := len(args)
		conds = append(conds, fmt.Sprintf("(b.name ILIKE $%d OR b.email ILIKE $%d OR b.city ILIKE $%d OR COALESCE(o.email,'') ILIKE $%d OR COALESCE(o.name,'') ILIKE $%d)", n, n, n, n, n))
	}
	if status != "" {
		args = append(args, status)
		conds = append(conds, fmt.Sprintf("b.status::text = $%d", len(args)))
	}
	from := `
		FROM businesses b
		LEFT JOIN LATERAL (
			SELECT u.id, TRIM(u.first_name || ' ' || u.last_name) AS name, u.email
			FROM business_memberships bm JOIN users u ON u.id = bm.user_id
			WHERE bm.business_id = b.id
			ORDER BY (bm.role = 'OWNER') DESC, bm.created_at
			LIMIT 1
		) o ON TRUE
		WHERE ` + strings.Join(conds, " AND ")

	var total int
	if err := r.db.QueryRow(`SELECT COUNT(*) `+from, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	query := `
		SELECT b.id, b.name, b.business_type::text, b.category, b.email, b.phone, b.city, b.country,
			b.default_currency, COALESCE(b.status::text, 'ACTIVE'), b.created_at,
			o.id, COALESCE(o.name, ''), COALESCE(o.email, ''),
			(SELECT COUNT(*) FROM shops s WHERE s.business_id = b.id),
			(SELECT COUNT(*) FROM shops s WHERE s.business_id = b.id AND s.status = 'ACTIVE'),
			(SELECT COUNT(*) FROM products p WHERE p.business_id = b.id),
			(SELECT COUNT(*) FROM products p WHERE p.business_id = b.id AND p.publication_status = 'PUBLISHED'),
			(SELECT COUNT(*) FROM orders od WHERE od.business_id = b.id),
			(SELECT COALESCE(SUM(od.final_total), 0) FROM orders od WHERE od.business_id = b.id AND od.status = 'COMPLETED')
		` + from + fmt.Sprintf(` ORDER BY b.created_at DESC LIMIT $%d OFFSET $%d`, len(args)-1, len(args))

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := make([]*models.AdminBusinessListItem, 0)
	for rows.Next() {
		it := &models.AdminBusinessListItem{}
		var ownerID uuid.NullUUID
		if err := rows.Scan(&it.ID, &it.Name, &it.BusinessType, &it.Category, &it.Email, &it.Phone, &it.City, &it.Country,
			&it.Currency, &it.Status, &it.CreatedAt, &ownerID, &it.OwnerName, &it.OwnerEmail,
			&it.ShopCount, &it.ActiveShopCount, &it.ProductCount, &it.PublishedProductCount, &it.OrderCount, &it.CompletedSales); err != nil {
			return nil, 0, err
		}
		if ownerID.Valid {
			id := ownerID.UUID
			it.OwnerID = &id
		}
		items = append(items, it)
	}
	return items, total, rows.Err()
}

// ListShops lists every shop with its owning business and live activity.
func (r *AdminCommerceRepository) ListShops(search, status, businessID string, limit, offset int) ([]*models.AdminShopListItem, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	conds := []string{"1=1"}
	args := []interface{}{}
	if search != "" {
		args = append(args, "%"+search+"%")
		n := len(args)
		conds = append(conds, fmt.Sprintf("(s.name ILIKE $%d OR b.name ILIKE $%d OR s.city ILIKE $%d)", n, n, n))
	}
	if status != "" {
		args = append(args, status)
		conds = append(conds, fmt.Sprintf("s.status::text = $%d", len(args)))
	}
	if businessID != "" {
		if _, err := uuid.Parse(businessID); err != nil {
			return nil, 0, fmt.Errorf("invalid business_id")
		}
		args = append(args, businessID)
		conds = append(conds, fmt.Sprintf("s.business_id = $%d", len(args)))
	}
	from := ` FROM shops s JOIN businesses b ON b.id = s.business_id WHERE ` + strings.Join(conds, " AND ")

	var total int
	if err := r.db.QueryRow(`SELECT COUNT(*)`+from, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	args = append(args, limit, offset)
	query := `
		SELECT s.id, s.name, s.type::text, COALESCE(s.city, ''), COALESCE(s.phone, ''), COALESCE(s.status::text, 'ACTIVE'), s.created_at,
			b.id, b.name, COALESCE(b.status::text, 'ACTIVE'),
			COALESCE(s.supports_shop_delivery, false), COALESCE(s.supports_partner_delivery, false),
			(SELECT COUNT(DISTINCT i.product_id) FROM inventory i WHERE i.shop_id = s.id),
			(SELECT COALESCE(SUM(GREATEST(i.quantity - i.reserved_quantity, 0)), 0) FROM inventory i WHERE i.shop_id = s.id),
			(SELECT COUNT(*) FROM orders od WHERE od.shop_id = s.id),
			(SELECT COUNT(*) FROM orders od WHERE od.shop_id = s.id AND od.status NOT IN ('COMPLETED','CANCELLED','REJECTED')),
			COALESCE((SELECT a.average_rating FROM shop_review_aggregates a WHERE a.shop_id = s.id), 0),
			COALESCE((SELECT a.total_reviews FROM shop_review_aggregates a WHERE a.shop_id = s.id), 0)
		` + from + fmt.Sprintf(` ORDER BY s.created_at DESC LIMIT $%d OFFSET $%d`, len(args)-1, len(args))

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := make([]*models.AdminShopListItem, 0)
	for rows.Next() {
		it := &models.AdminShopListItem{}
		if err := rows.Scan(&it.ID, &it.Name, &it.Type, &it.City, &it.Phone, &it.Status, &it.CreatedAt,
			&it.BusinessID, &it.BusinessName, &it.BusinessStatus, &it.SupportsShopDelivery, &it.SupportsPartnerDelivery,
			&it.ProductCount, &it.AvailableUnits, &it.OrderCount, &it.OpenOrderCount, &it.ReviewScore, &it.ReviewCount); err != nil {
			return nil, 0, err
		}
		items = append(items, it)
	}
	return items, total, rows.Err()
}

// SetBusinessStatus moves a business through its lifecycle and returns the previous status.
func (r *AdminCommerceRepository) SetBusinessStatus(id uuid.UUID, status string) (string, error) {
	var old string
	err := r.db.QueryRow(`
		UPDATE businesses b SET status = $2::business_status, updated_at = $3
		FROM (SELECT id, COALESCE(status::text, 'ACTIVE') AS old FROM businesses WHERE id = $1 FOR UPDATE) prev
		WHERE b.id = prev.id RETURNING prev.old`, id, status, time.Now()).Scan(&old)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("BUSINESS_NOT_FOUND")
	}
	return old, err
}

// SetShopStatus moves a shop through its lifecycle and returns the previous status.
func (r *AdminCommerceRepository) SetShopStatus(id uuid.UUID, status string) (string, error) {
	var old string
	err := r.db.QueryRow(`
		UPDATE shops s SET status = $2::shop_status, updated_at = $3
		FROM (SELECT id, COALESCE(status::text, 'ACTIVE') AS old FROM shops WHERE id = $1 FOR UPDATE) prev
		WHERE s.id = prev.id RETURNING prev.old`, id, status, time.Now()).Scan(&old)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("SHOP_NOT_FOUND")
	}
	return old, err
}
