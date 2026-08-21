package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/btmi-ai-market/backend/internal/database"
	redislib "github.com/btmi-ai-market/backend/internal/redis"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type MarketplaceRepository struct {
	db         *database.DB
	productRepo *ProductRepository
}

func NewMarketplaceRepository(db *database.DB, productRepo *ProductRepository) *MarketplaceRepository {
	return &MarketplaceRepository{db: db, productRepo: productRepo}
}

func (r *MarketplaceRepository) ListPublicShops(city string, page, limit int) ([]*models.PublicShopResponse, int, error) {
	where := []string{"s.status = 'ACTIVE'"}
	args := []interface{}{}
	argIdx := 1

	if city != "" {
		where = append(where, fmt.Sprintf("s.city ILIKE $%d", argIdx))
		args = append(args, "%"+city+"%")
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM shops s WHERE %s", whereClause)
	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(`
		SELECT s.id, s.business_id, b.name as business_name, s.name, s.type, s.city, s.address, s.phone, s.status,
		       COALESCE(sl.name, 'STARTER') as seller_level,
		       COALESCE(st.trust_status, 'NORMAL') as seller_trust,
		       (SELECT COUNT(*) FROM products p WHERE p.business_id = s.business_id AND p.publication_status = 'PUBLISHED') as product_count,
		       s.created_at
		FROM shops s
		JOIN businesses b ON b.id = s.business_id
		LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = s.business_id
		LEFT JOIN seller_levels sl ON sl.id = pa.level_id
		LEFT JOIN seller_trust st ON st.business_id = s.business_id
		WHERE %s
		ORDER BY s.name ASC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)
	args = append(args, limit, (page-1)*limit)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var shops []*models.PublicShopResponse
	for rows.Next() {
		s := &models.PublicShopResponse{}
		if err := rows.Scan(
			&s.ID, &s.BusinessID, &s.BusinessName, &s.Name, &s.Type, &s.City, &s.Address, &s.Phone, &s.Status,
			&s.SellerLevel, &s.SellerTrust, &s.ProductCount, &s.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		shops = append(shops, s)
	}
	return shops, total, rows.Err()
}

func (r *MarketplaceRepository) GetPublicShopByID(shopID uuid.UUID) (*models.PublicShopResponse, error) {
	query := `
		SELECT s.id, s.business_id, b.name as business_name, s.name, s.type, s.city, s.address, s.phone, s.status,
		       COALESCE(sl.name, 'STARTER') as seller_level,
		       COALESCE(st.trust_status, 'NORMAL') as seller_trust,
		       (SELECT COUNT(*) FROM products p WHERE p.business_id = s.business_id AND p.publication_status = 'PUBLISHED') as product_count,
		       s.created_at
		FROM shops s
		JOIN businesses b ON b.id = s.business_id
		LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = s.business_id
		LEFT JOIN seller_levels sl ON sl.id = pa.level_id
		LEFT JOIN seller_trust st ON st.business_id = s.business_id
		WHERE s.id = $1 AND s.status = 'ACTIVE'
	`
	s := &models.PublicShopResponse{}
	err := r.db.QueryRow(query, shopID).Scan(
		&s.ID, &s.BusinessID, &s.BusinessName, &s.Name, &s.Type, &s.City, &s.Address, &s.Phone, &s.Status,
		&s.SellerLevel, &s.SellerTrust, &s.ProductCount, &s.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *MarketplaceRepository) ListPublicProducts(shopID uuid.UUID, page, limit int) ([]*models.PublicProductResponse, int, error) {
	where := []string{"p.publication_status = 'PUBLISHED'", "s.status = 'ACTIVE'"}
	args := []interface{}{}
	argIdx := 1

	if shopID != uuid.Nil {
		where = append(where, fmt.Sprintf("s.id = $%d", argIdx))
		args = append(args, shopID)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf(`
		SELECT COUNT(*) 
		FROM products p
		JOIN businesses b ON b.id = p.business_id
		JOIN shops s ON s.business_id = b.id
		WHERE %s
	`, whereClause)
	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(`
		SELECT DISTINCT p.id, s.id as shop_id, s.name as shop_name, p.business_id, b.name as business_name,
		       p.name, p.sku, p.description, p.unit, p.unit_price as unit_price,
		       COALESCE(sl.name, 'STARTER') as seller_level,
		       COALESCE(st.trust_status, 'NORMAL') as seller_trust,
		       p.created_at
		FROM products p
		JOIN businesses b ON b.id = p.business_id
		JOIN shops s ON s.business_id = b.id AND s.status = 'ACTIVE'
		LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = b.id
		LEFT JOIN seller_levels sl ON sl.id = pa.level_id
		LEFT JOIN seller_trust st ON st.business_id = b.id
		WHERE %s
		ORDER BY p.name ASC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)
	args = append(args, limit, (page-1)*limit)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var products []*models.PublicProductResponse
	for rows.Next() {
		p := &models.PublicProductResponse{}
		if err := rows.Scan(
			&p.ID, &p.ShopID, &p.ShopName, &p.BusinessID, &p.BusinessName,
			&p.Name, &p.SKU, &p.Description, &p.Unit, &p.BasePrice,
			&p.SellerLevel, &p.SellerTrust, &p.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		products = append(products, p)
	}
	return products, total, rows.Err()
}

func (r *MarketplaceRepository) ListCategoriesWithSubs() ([]*models.CategoryResponse, error) {
	rows, err := r.db.Query(`
		SELECT c.id, c.name, c.slug, c.sort_order
		FROM categories c
		WHERE c.status = 'ACTIVE'
		ORDER BY c.sort_order ASC, c.name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []*models.CategoryResponse
	for rows.Next() {
		c := &models.CategoryResponse{}
		if err := rows.Scan(&c.ID, &c.Name, &c.Slug, &c.SortOrder); err != nil {
			return nil, err
		}

		subRows, err := r.db.Query(`
			SELECT id, name, slug, sort_order
			FROM subcategories WHERE category_id = $1 AND status = 'ACTIVE'
			ORDER BY sort_order ASC, name ASC
		`, c.ID)
		if err != nil {
			return nil, err
		}
		var subs []models.SubcategoryResponse
		for subRows.Next() {
			var s models.SubcategoryResponse
			if err := subRows.Scan(&s.ID, &s.Name, &s.Slug, &s.SortOrder); err != nil {
				subRows.Close()
				return nil, err
			}
			subs = append(subs, s)
		}
		subRows.Close()
		c.Subcategories = subs
		result = append(result, c)
	}
	return result, rows.Err()
}

func (r *MarketplaceRepository) GetPublicProductByID(productID uuid.UUID) (*models.PublicProductResponse, error) {
	query := `
		SELECT p.id, s.id as shop_id, s.name as shop_name, p.business_id, b.name as business_name,
		       p.name, p.sku, p.description, p.unit, p.unit_price as unit_price, p.category_id, p.subcategory_id,
		       COALESCE(sl.name, 'STARTER') as seller_level,
		       COALESCE(st.trust_status, 'NORMAL') as seller_trust,
		       p.created_at
		FROM products p
		JOIN businesses b ON b.id = p.business_id
		JOIN shops s ON s.business_id = b.id AND s.status = 'ACTIVE'
		LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = b.id
		LEFT JOIN seller_levels sl ON sl.id = pa.level_id
		LEFT JOIN seller_trust st ON st.business_id = b.id
		WHERE p.id = $1 AND p.publication_status = 'PUBLISHED'
	`
	p := &models.PublicProductResponse{}
	err := r.db.QueryRow(query, productID).Scan(
		&p.ID, &p.ShopID, &p.ShopName, &p.BusinessID, &p.BusinessName,
		&p.Name, &p.SKU, &p.Description, &p.Unit, &p.BasePrice, &p.CategoryID, &p.SubcategoryID,
		&p.SellerLevel, &p.SellerTrust, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (r *MarketplaceRepository) GetVariantsForProduct(productID uuid.UUID) ([]models.PublicVariantResponse, error) {
	query := `
		SELECT v.id, v.sku,
		       COALESCE(v.sale_price, 0) as sale_price,
		       CASE 
		           WHEN COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) > 5 THEN 'AVAILABLE'
		           WHEN COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) > 0 THEN 'LOW_STOCK'
		           ELSE 'OUT_OF_STOCK'
		       END as stock,
		       COALESCE(i.quantity - i.reserved_quantity, 0) as stock_qty
		FROM product_variants v
		LEFT JOIN inventory i ON i.variant_id = v.id
		WHERE v.product_id = $1
		ORDER BY v.sku ASC
	`
	rows, err := r.db.Query(query, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var variants []models.PublicVariantResponse
	for rows.Next() {
		v := models.PublicVariantResponse{}
		if err := rows.Scan(&v.ID, &v.SKU, &v.UnitPrice, &v.Stock, &v.StockQty); err != nil {
			return nil, err
		}
		variants = append(variants, v)
	}
	return variants, rows.Err()
}

func (r *MarketplaceRepository) SearchProducts(search *models.MarketplaceSearchParams) (*models.MarketplaceSearchResult, error) {
	where := []string{"p.publication_status = 'PUBLISHED'", "s.status = 'ACTIVE'"}
	args := []interface{}{}
	argIdx := 1

	if search.Query != "" {
		where = append(where, fmt.Sprintf("(p.name ILIKE $%d OR p.sku ILIKE $%d OR p.description ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+search.Query+"%")
		argIdx++
	}
	if search.CategorySlug != "" {
		where = append(where, fmt.Sprintf("c.slug = $%d", argIdx))
		args = append(args, search.CategorySlug)
		argIdx++
	}
	if search.SubcategorySlug != "" {
		where = append(where, fmt.Sprintf("sc.slug = $%d", argIdx))
		args = append(args, search.SubcategorySlug)
		argIdx++
	}
	if search.ShopID != "" {
		where = append(where, fmt.Sprintf("s.id = $%d", argIdx))
		args = append(args, search.ShopID)
		argIdx++
	}
	if search.BusinessID != "" {
		where = append(where, fmt.Sprintf("p.business_id = $%d", argIdx))
		args = append(args, search.BusinessID)
		argIdx++
	}
	if search.City != "" {
		where = append(where, fmt.Sprintf("s.city ILIKE $%d", argIdx))
		args = append(args, "%"+search.City+"%")
		argIdx++
	}
	if search.MinPrice > 0 {
		where = append(where, fmt.Sprintf("v.sale_price >= $%d", argIdx))
		args = append(args, search.MinPrice)
		argIdx++
	}
	if search.MaxPrice > 0 {
		where = append(where, fmt.Sprintf("v.sale_price <= $%d", argIdx))
		args = append(args, search.MaxPrice)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf(`
		SELECT COUNT(DISTINCT p.id)
		FROM products p
		JOIN businesses b ON b.id = p.business_id
		JOIN shops s ON s.business_id = b.id
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
		WHERE %s
	`, whereClause)
	var total int
	if err := r.db.QueryRow(countQuery, args[:argIdx-1]...).Scan(&total); err != nil {
		return nil, err
	}

	orderBy := "p.name ASC"
	if search.Sort == "price_asc" {
		orderBy = "unit_price ASC"
	} else if search.Sort == "price_desc" {
		orderBy = "unit_price DESC"
	} else if search.Sort == "seller_level" {
		orderBy = "search_boost DESC, p.name ASC"
	} else if search.Sort == "relevance" || search.Sort == "" {
		orderBy = fmt.Sprintf(
			"CASE WHEN p.name ILIKE $%d THEN 3 ELSE 0 END DESC, "+"search_boost DESC, p.created_at DESC",
			argIdx)
		args = append(args, "%"+search.Query+"%")
		argIdx++
	}

	if search.Page == 0 {
		search.Page = 1
	}
	if search.Limit == 0 {
		search.Limit = 20
	}

	query := fmt.Sprintf(`
		SELECT p.id, s.id as shop_id, s.name as shop_name, p.business_id, b.name as business_name,
		       p.name, p.sku, p.description, p.unit, COALESCE(MIN(v.sale_price), 0) as unit_price,
		       COALESCE(sl.name, 'STARTER') as seller_level,
		       COALESCE(st.trust_status, 'NORMAL') as seller_trust,
		       p.created_at,
		       COALESCE(sl.search_boost, 0) as search_boost
		FROM products p
		JOIN businesses b ON b.id = p.business_id
		JOIN shops s ON s.business_id = b.id
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
		LEFT JOIN product_variants v ON v.product_id = p.id AND v.status = 'ACTIVE'
		LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = b.id
		LEFT JOIN seller_levels sl ON sl.id = pa.level_id
		LEFT JOIN seller_trust st ON st.business_id = b.id
		WHERE %s
		GROUP BY p.id, s.id, s.name, s.business_id, b.name, p.name, p.sku, p.description, p.unit, sl.name, st.trust_status, p.created_at, sl.search_boost
		ORDER BY %s
		LIMIT $%d OFFSET $%d
	`, whereClause, orderBy, argIdx, argIdx+1)
	args = append(args, search.Limit, (search.Page-1)*search.Limit)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []*models.PublicProductResponse
	for rows.Next() {
		p := &models.PublicProductResponse{}
		var _searchBoost float64
		if err := rows.Scan(
			&p.ID, &p.ShopID, &p.ShopName, &p.BusinessID, &p.BusinessName,
			&p.Name, &p.SKU, &p.Description, &p.Unit, &p.BasePrice,
			&p.SellerLevel, &p.SellerTrust, &p.CreatedAt, &_searchBoost,
		); err != nil {
			return nil, err
		}
		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &models.MarketplaceSearchResult{
		Products: products,
		Pagination: models.PaginationInfo{
			Page:  search.Page,
			Limit: search.Limit,
			Total: total,
		},
	}, nil
}

func (r *MarketplaceRepository) ListProductsByCategory(categoryID, subcategoryID uuid.UUID, city string, page, limit int) ([]*models.PublicProductResponse, int, error) {
	where := []string{"p.publication_status = 'PUBLISHED'", "s.status = 'ACTIVE'"}
	args := []interface{}{}
	argIdx := 1

	where = append(where, fmt.Sprintf("p.category_id = $%d", argIdx))
	args = append(args, categoryID)
	argIdx++

	if subcategoryID != uuid.Nil {
		where = append(where, fmt.Sprintf("p.subcategory_id = $%d", argIdx))
		args = append(args, subcategoryID)
		argIdx++
	}

	if city != "" {
		where = append(where, fmt.Sprintf("s.city ILIKE $%d", argIdx))
		args = append(args, "%"+city+"%")
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM products p
		JOIN businesses b ON b.id = p.business_id
		JOIN shops s ON s.business_id = b.id
		WHERE %s
	`, whereClause)
	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(`
		SELECT DISTINCT p.id, s.id as shop_id, s.name as shop_name, p.business_id, b.name as business_name,
		       p.name, p.sku, p.description, p.unit, COALESCE(v.sale_price, 0) as unit_price,
		       COALESCE(sl.name, 'STARTER') as seller_level,
		       COALESCE(st.trust_status, 'NORMAL') as seller_trust,
		       p.created_at
		FROM products p
		JOIN businesses b ON b.id = p.business_id
		JOIN shops s ON s.business_id = b.id AND s.status = 'ACTIVE'
		LEFT JOIN product_variants v ON v.product_id = p.id AND v.status = 'ACTIVE'
		LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = b.id
		LEFT JOIN seller_levels sl ON sl.id = pa.level_id
		LEFT JOIN seller_trust st ON st.business_id = b.id
		WHERE %s
		ORDER BY p.name ASC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)
	args = append(args, limit, (page-1)*limit)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var products []*models.PublicProductResponse
	for rows.Next() {
		p := &models.PublicProductResponse{}
		if err := rows.Scan(
			&p.ID, &p.ShopID, &p.ShopName, &p.BusinessID, &p.BusinessName,
			&p.Name, &p.SKU, &p.Description, &p.Unit, &p.BasePrice,
			&p.SellerLevel, &p.SellerTrust, &p.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		products = append(products, p)
	}
	return products, total, rows.Err()
}

func (r *MarketplaceRepository) GetCategoryRankingFromPostgres(categoryID uuid.UUID, page, limit int) ([]*redislib.RankedShop, int, error) {
	query := `
		SELECT s.id,
		       COALESCE(pa.current_points, 0) * (1 + COALESCE(sl.search_boost, 0)/100.0) as ranking_score
		FROM shops s
		JOIN businesses b ON b.id = s.business_id
		JOIN products p ON p.business_id = s.business_id
		LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = s.business_id
		LEFT JOIN seller_levels sl ON sl.id = pa.level_id
		WHERE s.status = 'ACTIVE' AND b.status = 'ACTIVE'
		AND p.publication_status = 'PUBLISHED' AND p.status = 'ACTIVE'
		AND p.category_id = $1
		GROUP BY s.id, pa.current_points, sl.search_boost
		ORDER BY ranking_score DESC
		LIMIT $2 OFFSET $3
	`
	offset := (page - 1) * limit

	rows, err := r.db.Query(query, categoryID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var shops []*redislib.RankedShop
	for rows.Next() {
		shop := &redislib.RankedShop{}
		if err := rows.Scan(&shop.ShopID, &shop.RankingScore); err != nil {
			return nil, 0, err
		}
		shops = append(shops, shop)
	}

	countQuery := `
		SELECT COUNT(DISTINCT s.id)
		FROM shops s
		JOIN businesses b ON b.id = s.business_id
		JOIN products p ON p.business_id = s.business_id
		WHERE s.status = 'ACTIVE' AND b.status = 'ACTIVE'
		AND p.publication_status = 'PUBLISHED' AND p.status = 'ACTIVE'
		AND p.category_id = $1
	`
	var total int
	if err := r.db.QueryRow(countQuery, categoryID).Scan(&total); err != nil {
		return nil, 0, err
	}

	return shops, total, nil
}

func (r *MarketplaceRepository) GetAllShopsInCategoryFromPostgres(categoryID uuid.UUID) ([]*redislib.RankedShop, error) {
	query := `
		SELECT s.id,
		       COALESCE(pa.current_points, 0) * (1 + COALESCE(sl.search_boost, 0)/100.0) as ranking_score
		FROM shops s
		JOIN businesses b ON b.id = s.business_id
		JOIN products p ON p.business_id = s.business_id
		LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = s.business_id
		LEFT JOIN seller_levels sl ON sl.id = pa.level_id
		WHERE s.status = 'ACTIVE' AND b.status = 'ACTIVE'
		AND p.publication_status = 'PUBLISHED' AND p.status = 'ACTIVE'
		AND p.category_id = $1
		GROUP BY s.id, pa.current_points, sl.search_boost
		ORDER BY ranking_score DESC
	`
	rows, err := r.db.Query(query, categoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var shops []*redislib.RankedShop
	pos := 1
	for rows.Next() {
		shop := &redislib.RankedShop{}
		if err := rows.Scan(&shop.ShopID, &shop.RankingScore); err != nil {
			return nil, err
		}
		shop.RankingPosition = pos
		pos++
		shops = append(shops, shop)
	}

	return shops, rows.Err()
}

func (r *MarketplaceRepository) GetBusinessIDByShopID(shopID uuid.UUID) (uuid.UUID, error) {
	var businessID uuid.UUID
	err := r.db.QueryRow("SELECT business_id FROM shops WHERE id = $1", shopID).Scan(&businessID)
	return businessID, err
}

func (r *MarketplaceRepository) GetCategoriesByBusiness(businessID uuid.UUID) ([]uuid.UUID, error) {
	query := `
		SELECT DISTINCT category_id FROM products
		WHERE business_id = $1 AND publication_status = 'PUBLISHED' AND status = 'ACTIVE'
		AND category_id IS NOT NULL
	`
	rows, err := r.db.Query(query, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []uuid.UUID
	for rows.Next() {
		var catID uuid.UUID
		if err := rows.Scan(&catID); err != nil {
			return nil, err
		}
		categories = append(categories, catID)
	}
	return categories, rows.Err()
}

func (r *MarketplaceRepository) GetDB() *database.DB {
	return r.db
}

func (r *MarketplaceRepository) GetShopIDsByBusinessID(businessID uuid.UUID) ([]uuid.UUID, error) {
	query := `SELECT id FROM shops WHERE business_id = $1 AND status = 'ACTIVE'`
	rows, err := r.db.Query(query, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var shopIDs []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		shopIDs = append(shopIDs, id)
	}
	return shopIDs, rows.Err()
}

func (r *MarketplaceRepository) HasPublishedProductsInCategory(businessID, categoryID uuid.UUID) (bool, error) {
	query := `
		SELECT COUNT(*) > 0 FROM products
		WHERE business_id = $1 AND category_id = $2
		AND publication_status = 'PUBLISHED' AND status = 'ACTIVE'
	`
	var exists bool
	err := r.db.QueryRow(query, businessID, categoryID).Scan(&exists)
	return exists, err
}

func (r *MarketplaceRepository) GetPublicShopDetailByID(shopID uuid.UUID) (*models.PublicShopDetailResponse, error) {
	query := `
		SELECT s.id, s.business_id, b.name as business_name, s.name, s.type, s.city, s.address, s.phone, s.status,
		       COALESCE(sl.name, 'STARTER') as seller_level,
		       COALESCE(st.trust_status, 'NORMAL') as seller_trust,
		       (SELECT COUNT(*) FROM products p WHERE p.business_id = s.business_id AND p.publication_status = 'PUBLISHED') as product_count,
		       sra.average_rating,
		       sra.total_reviews,
		       s.created_at
		FROM shops s
		JOIN businesses b ON b.id = s.business_id
		LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = s.business_id
		LEFT JOIN seller_levels sl ON sl.id = pa.level_id
		LEFT JOIN seller_trust st ON st.business_id = s.business_id
		LEFT JOIN shop_review_aggregates sra ON sra.shop_id = s.id
		WHERE s.id = $1 AND s.status = 'ACTIVE'
	`
	shop := &models.PublicShopDetailResponse{}
	var averageRating *float64
	var totalReviews *int
	err := r.db.QueryRow(query, shopID).Scan(
		&shop.ID, &shop.BusinessID, &shop.BusinessName, &shop.Name, &shop.Type, &shop.City, &shop.Address, &shop.Phone, &shop.Status,
		&shop.SellerLevel, &shop.SellerTrust, &shop.ProductCount, &averageRating, &totalReviews, &shop.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	shop.AverageRating = averageRating
	shop.TotalReviews = totalReviews

	// Get categories from published products
	categories, err := r.GetShopCategories(shop.BusinessID)
	if err != nil {
		return nil, err
	}
	shop.Categories = categories

	return shop, nil
}

func (r *MarketplaceRepository) GetShopCategories(businessID uuid.UUID) ([]*models.CategorySummary, error) {
	query := `
		SELECT DISTINCT c.id, c.name, c.slug, c.sort_order
		FROM categories c
		JOIN products p ON p.category_id = c.id
		WHERE p.business_id = $1
		AND p.publication_status = 'PUBLISHED' AND p.status = 'ACTIVE'
		AND c.status = 'ACTIVE'
		ORDER BY c.sort_order ASC, c.name ASC
	`
	rows, err := r.db.Query(query, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []*models.CategorySummary
	for rows.Next() {
		c := &models.CategorySummary{}
		var sortOrder int
		if err := rows.Scan(&c.ID, &c.Name, &c.Slug, &sortOrder); err != nil {
			return nil, err
		}
		categories = append(categories, c)
	}
	return categories, rows.Err()
}

func (r *MarketplaceRepository) GetPublicProductDetailByID(productID uuid.UUID, buyerProfileID *uuid.UUID) (*models.PublicProductDetailResponse, error) {
	query := `
		SELECT p.id, s.id as shop_id, s.name as shop_name, p.business_id, b.name as business_name,
		       p.name, p.sku, p.description, p.unit, p.unit_price as unit_price, p.category_id, p.subcategory_id,
		       COALESCE(sl.name, 'STARTER') as seller_level,
		       COALESCE(st.trust_status, 'NORMAL') as seller_trust,
		       p.created_at,
		       c.name as category_name, c.slug as category_slug,
		       sc.name as subcategory_name, sc.slug as subcategory_slug
		FROM products p
		JOIN businesses b ON b.id = p.business_id
		JOIN shops s ON s.business_id = b.id AND s.status = 'ACTIVE'
		LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = b.id
		LEFT JOIN seller_levels sl ON sl.id = pa.level_id
		LEFT JOIN seller_trust st ON st.business_id = b.id
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
		WHERE p.id = $1 AND p.publication_status = 'PUBLISHED' AND p.status = 'ACTIVE'
	`
	product := &models.PublicProductDetailResponse{}
	product.Category = &models.CategorySummary{}
	product.Subcategory = &models.CategorySummary{}
	err := r.db.QueryRow(query, productID).Scan(
		&product.ID, &product.ShopID, &product.ShopName, &product.BusinessID, &product.BusinessName,
		&product.Name, &product.SKU, &product.Description, &product.Unit, &product.BasePrice,
		&product.CategoryID, &product.SubcategoryID,
		&product.SellerLevel, &product.SellerTrust, &product.CreatedAt,
		&product.Category.Name, &product.Category.Slug,
		&product.Subcategory.Name, &product.Subcategory.Slug,
	)
	if err != nil {
		return nil, err
	}

	// Set category IDs
	if product.CategoryID != nil {
		product.Category.ID = *product.CategoryID
	}
	if product.SubcategoryID != nil {
		product.Subcategory.ID = *product.SubcategoryID
	}

	// Get variants with stock
	variants, err := r.GetVariantsWithStockForProduct(productID)
	if err != nil {
		return nil, err
	}
	product.Variants = variants

	// Determine overall availability
	product.Availability = r.determineProductAvailability(variants)

	// Calculate personalized price if buyer provided
	if buyerProfileID != nil {
		price, err := r.GetProductPriceForBuyer(productID, *buyerProfileID)
		if err == nil {
			product.BasePrice = price.BasePrice
			// The final price will be set by the service layer
		}
	}

	return product, nil
}

func (r *MarketplaceRepository) GetVariantsWithStockForProduct(productID uuid.UUID) ([]models.PublicVariantDetailResponse, error) {
	query := `
		SELECT v.id, v.sku, v.name, v.attributes,
		       COALESCE(v.sale_price, 0) as sale_price,
		       CASE 
		           WHEN COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) > 5 THEN 'AVAILABLE'
		           WHEN COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) > 0 THEN 'LOW_STOCK'
		           ELSE 'OUT_OF_STOCK'
		       END as stock,
		       COALESCE(i.quantity - i.reserved_quantity, 0) as stock_qty
		FROM product_variants v
		LEFT JOIN inventory i ON i.variant_id = v.id
		WHERE v.product_id = $1 AND v.status = 'ACTIVE'
		ORDER BY v.sku ASC
	`
	rows, err := r.db.Query(query, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var variants []models.PublicVariantDetailResponse
	for rows.Next() {
		v := models.PublicVariantDetailResponse{}
		var attrsJSON []byte
		if err := rows.Scan(&v.ID, &v.SKU, &v.Name, &attrsJSON, &v.UnitPrice, &v.Stock, &v.StockQty); err != nil {
			return nil, err
		}
		if attrsJSON != nil {
			v.Attributes = make(map[string]string)
			_ = json.Unmarshal(attrsJSON, &v.Attributes)
		}
		variants = append(variants, v)
	}
	return variants, rows.Err()
}

func (r *MarketplaceRepository) determineProductAvailability(variants []models.PublicVariantDetailResponse) string {
	hasAvailable := false
	hasLowStock := false
	for _, v := range variants {
		if v.Stock == "AVAILABLE" {
			hasAvailable = true
		}
		if v.Stock == "LOW_STOCK" {
			hasLowStock = true
		}
	}
	if hasAvailable {
		return "AVAILABLE"
	}
	if hasLowStock {
		return "LOW_STOCK"
	}
	if len(variants) > 0 {
		return "OUT_OF_STOCK"
	}
	return "OUT_OF_STOCK"
}

func (r *MarketplaceRepository) GetProductPriceForBuyer(productID, buyerProfileID uuid.UUID) (*models.BuyerPriceResponse, error) {
	// Get base price from variants
	variants, err := r.GetVariantsWithStockForProduct(productID)
	if err != nil {
		return nil, err
	}
	basePrice := 0.0
	if len(variants) > 0 {
		basePrice = variants[0].UnitPrice
	}

	return &models.BuyerPriceResponse{
		BasePrice:        basePrice,
		BuyerLevel:       "BRONZE",
		DiscountPercent:  0,
		DiscountAmount:   0,
		FinalPrice:       basePrice,
		FreeDelivery:     false,
		DeliveryDiscount: 0,
	}, nil
}

func (r *MarketplaceRepository) ListShopProducts(shopID uuid.UUID, params *models.ShopProductsParams) ([]*models.PublicProductResponse, int, error) {
	where := []string{"p.publication_status = 'PUBLISHED'", "p.status = 'ACTIVE'", "s.status = 'ACTIVE'"}
	args := []interface{}{}
	argIdx := 1

	where = append(where, fmt.Sprintf("s.id = $%d", argIdx))
	args = append(args, shopID)
	argIdx++

	if params.CategorySlug != "" {
		where = append(where, fmt.Sprintf("c.slug = $%d", argIdx))
		args = append(args, params.CategorySlug)
		argIdx++
	}
	if params.SubcategorySlug != "" {
		where = append(where, fmt.Sprintf("sc.slug = $%d", argIdx))
		args = append(args, params.SubcategorySlug)
		argIdx++
	}
	if params.Query != "" {
		where = append(where, fmt.Sprintf("(p.name ILIKE $%d OR p.sku ILIKE $%d OR p.description ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+params.Query+"%")
		argIdx++
	}
	if params.Availability != "" {
		// This requires joining variants and inventory
		where = append(where, fmt.Sprintf(`
			EXISTS (
				SELECT 1 FROM product_variants v
				LEFT JOIN inventory i ON i.variant_id = v.id
				WHERE v.product_id = p.id AND v.status = 'ACTIVE'
				AND CASE 
					WHEN $%d = 'available' THEN COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) > 0
					WHEN $%d = 'low_stock' THEN COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) > 0 AND COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) <= 5
					WHEN $%d = 'out_of_stock' THEN COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) <= 0
					ELSE TRUE
				END
			)
		`, argIdx, argIdx, argIdx))
		args = append(args, params.Availability)
		argIdx++
	}
	if params.MinPrice > 0 {
		where = append(where, fmt.Sprintf("v.sale_price >= $%d", argIdx))
		args = append(args, params.MinPrice)
		argIdx++
	}
	if params.MaxPrice > 0 {
		where = append(where, fmt.Sprintf("v.sale_price <= $%d", argIdx))
		args = append(args, params.MaxPrice)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf(`
		SELECT COUNT(DISTINCT p.id)
		FROM products p
		JOIN businesses b ON b.id = p.business_id
		JOIN shops s ON s.business_id = b.id
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
		LEFT JOIN product_variants v ON v.product_id = p.id AND v.status = 'ACTIVE'
		WHERE %s
	`, whereClause)
	var total int
	if err := r.db.QueryRow(countQuery, args[:argIdx-1]...).Scan(&total); err != nil {
		return nil, 0, err
	}

	orderBy := "p.name ASC"
	if params.Sort == "price_asc" {
		orderBy = "unit_price ASC"
	} else if params.Sort == "price_desc" {
		orderBy = "unit_price DESC"
	} else if params.Sort == "newest" {
		orderBy = "p.created_at DESC"
	} else if params.Sort == "popular" {
		orderBy = "p.created_at DESC"
	} else if params.Sort == "relevance" && params.Query != "" {
		orderBy = fmt.Sprintf("CASE WHEN p.name ILIKE $%d THEN 3 ELSE 0 END DESC, p.created_at DESC", argIdx)
		args = append(args, "%"+params.Query+"%")
		argIdx++
	}

	if params.Page <= 0 {
		params.Page = 1
	}
	if params.Limit <= 0 || params.Limit > 50 {
		params.Limit = 20
	}

	query := fmt.Sprintf(`
		SELECT DISTINCT p.id, s.id as shop_id, s.name as shop_name, p.business_id, b.name as business_name,
		       p.name, p.sku, p.description, p.unit, COALESCE(MIN(v.sale_price), 0) as unit_price,
		       COALESCE(sl.name, 'STARTER') as seller_level,
		       COALESCE(st.trust_status, 'NORMAL') as seller_trust,
		       p.created_at,
		       COALESCE(sl.search_boost, 0) as search_boost
		FROM products p
		JOIN businesses b ON b.id = p.business_id
		JOIN shops s ON s.business_id = b.id
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
		LEFT JOIN product_variants v ON v.product_id = p.id AND v.status = 'ACTIVE'
		LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = b.id
		LEFT JOIN seller_levels sl ON sl.id = pa.level_id
		LEFT JOIN seller_trust st ON st.business_id = b.id
		WHERE %s
		GROUP BY p.id, s.id, s.name, s.business_id, b.name, p.name, p.sku, p.description, p.unit, sl.name, st.trust_status, p.created_at, sl.search_boost
		ORDER BY %s
		LIMIT $%d OFFSET $%d
	`, whereClause, orderBy, argIdx, argIdx+1)
	args = append(args, params.Limit, (params.Page-1)*params.Limit)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var products []*models.PublicProductResponse
	for rows.Next() {
		p := &models.PublicProductResponse{}
		var _searchBoost float64
		if err := rows.Scan(
			&p.ID, &p.ShopID, &p.ShopName, &p.BusinessID, &p.BusinessName,
			&p.Name, &p.SKU, &p.Description, &p.Unit, &p.BasePrice,
			&p.SellerLevel, &p.SellerTrust, &p.CreatedAt, &_searchBoost,
		); err != nil {
			return nil, 0, err
		}
		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	return products, total, nil
}

func (r *MarketplaceRepository) GetSimilarProducts(ctx context.Context, productID uuid.UUID, page, limit int, buyerProfileID *uuid.UUID) ([]*models.PublicProductDetailResponse, int, error) {
	sourceProduct, err := r.productRepo.GetByID(productID)
	if err != nil || sourceProduct == nil {
		return nil, 0, err
	}

	if sourceProduct.CategoryID == nil {
		return nil, 0, nil
	}

	query := `
		SELECT p.id, s.id as shop_id, s.name as shop_name, p.business_id, b.name as business_name,
		       p.name, p.sku, p.description, p.unit, p.unit_price as unit_price,
		       p.category_id, p.subcategory_id,
		       COALESCE(sl.name, 'STARTER') as seller_level,
		       COALESCE(st.trust_status, 'NORMAL') as seller_trust,
		       p.created_at,
		       c.name as category_name, c.slug as category_slug,
		       sc.name as subcategory_name, sc.slug as subcategory_slug
		FROM products p
		JOIN businesses b ON b.id = p.business_id
		JOIN shops s ON s.business_id = b.id AND s.status = 'ACTIVE'
		LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = b.id
		LEFT JOIN seller_levels sl ON sl.id = pa.level_id
		LEFT JOIN seller_trust st ON st.business_id = b.id
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
		WHERE p.publication_status = 'PUBLISHED' AND p.status = 'ACTIVE'
		AND p.category_id = $1
		AND p.id != $2
		ORDER BY p.name ASC
		LIMIT $3 OFFSET $4
	`

	offset := (page - 1) * limit

	rows, err := r.db.Query(query, sourceProduct.CategoryID, productID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []*models.PublicProductDetailResponse
	for rows.Next() {
		p := &models.PublicProductDetailResponse{}
		var catName, catSlug, subName, subSlug string
		err := rows.Scan(
			&p.ID, &p.ShopID, &p.ShopName, &p.BusinessID, &p.BusinessName,
			&p.Name, &p.SKU, &p.Description, &p.Unit, &p.BasePrice,
			&p.CategoryID, &p.SubcategoryID,
			&p.SellerLevel, &p.SellerTrust, &p.CreatedAt,
			&catName, &catSlug, &subName, &subSlug,
		)
		if err != nil {
			return nil, 0, err
		}

		if p.CategoryID != nil {
			p.Category = &models.CategorySummary{
				ID:   *p.CategoryID,
				Name: catName,
				Slug: catSlug,
			}
		}
		if p.SubcategoryID != nil {
			p.Subcategory = &models.CategorySummary{
				ID:   *p.SubcategoryID,
				Name: subName,
				Slug: subSlug,
			}
		}

		variants, err := r.GetVariantsWithStockForProduct(p.ID)
		if err == nil {
			p.Variants = variants
		}

		p.Availability = "OUT_OF_STOCK"
		if p.Variants != nil {
			for _, v := range p.Variants {
				if v.Stock == "AVAILABLE" || v.Stock == "LOW_STOCK" {
					p.Availability = v.Stock
					break
				}
			}
		}

		if buyerProfileID != nil {
			price, err := r.GetProductPriceForBuyer(p.ID, *buyerProfileID)
			if err == nil {
				p.BuyerLevel = price.BuyerLevel
				p.DiscountPercent = price.DiscountPercent
				p.DiscountAmount = price.DiscountAmount
				p.FinalPrice = price.FinalPrice
				p.FreeDelivery = price.FreeDelivery
				p.DeliveryDiscount = price.DeliveryDiscount
			}
		}

		results = append(results, p)
	}

	countQuery := `
		SELECT COUNT(*) FROM products p
		JOIN businesses b ON b.id = p.business_id
		JOIN shops s ON s.business_id = b.id
		WHERE p.publication_status = 'PUBLISHED' AND p.status = 'ACTIVE'
		AND s.status = 'ACTIVE'
		AND p.category_id = $1
		AND p.id != $2
	`
	var total int
	if err := r.db.QueryRow(countQuery, sourceProduct.CategoryID, productID).Scan(&total); err != nil {
		return nil, 0, err
	}

	return results, total, nil
}

