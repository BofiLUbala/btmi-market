package repository

import (
	"fmt"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// HomeRepository handles optimized queries for the homepage feed.
// Single query design: no N+1, no global COUNT, primary image only.
type HomeRepository struct {
	db *database.DB
}

func NewHomeRepository(db *database.DB) *HomeRepository {
	return &HomeRepository{db: db}
}

// HomeFeedSection represents one section of the homepage.
type HomeFeedSection struct {
	Section  string // "recommended", "popular", "newest", "promoted"
	Products []*models.PublicProductResponse
}

// GetHomeFeed returns a curated homepage feed with 4 sections:
// - recommended (16 products by search_boost)
// - popular (8 products by rating)
// - newest (8 products from last 30 days)
// - promoted (8 discounted products)
//
// Design: Single optimized query, no COUNT, primary image only.
func (r *HomeRepository) GetHomeFeed() (map[string][]*models.PublicProductResponse, error) {
	// One query to rule them all. Uses CTEs to avoid duplication.
	query := `
		WITH recommended_cte AS (
			SELECT
				p.id, s.id as shop_id, s.name as shop_name, b.id as business_id, b.name as business_name,
				p.name, p.sku, p.description, p.unit,
				COALESCE(MIN(v.sale_price), p.unit_price, 0) as unit_price,
				COALESCE(NULLIF(p.currency, ''), 'USD') as currency,
				p.category_id,
				COALESCE(c.name, '') as category_name,
				COALESCE(c.slug, '') as category_slug,
				p.subcategory_id,
				COALESCE(sc.name, '') as subcategory_name,
				COALESCE(sc.slug, '') as subcategory_slug,
				COALESCE(sl.name, 'STARTER') as seller_level,
				COALESCE(st.trust_status, 'NORMAL') as seller_trust,
				COALESCE(pra.average_rating, 0)::float8 as average_rating,
				COALESCE(pra.total_reviews, 0)::int as total_reviews,
				p.self_rating,
				p.discount_active, p.discount_type, p.discount_value, p.discount_start, p.discount_end,
				p.created_at,
				COALESCE(SUM(i.quantity), 0) - COALESCE(SUM(i.reserved_quantity), 0) as available_quantity,
				CASE
					WHEN COALESCE(SUM(i.quantity), 0) - COALESCE(SUM(i.reserved_quantity), 0) > COALESCE((SELECT gc.value::int FROM global_configs gc WHERE gc.key = 'LOW_STOCK_THRESHOLD'), 5) THEN 'AVAILABLE'
					WHEN COALESCE(SUM(i.quantity), 0) - COALESCE(SUM(i.reserved_quantity), 0) > 0 THEN 'LOW_STOCK'
					ELSE 'OUT_OF_STOCK'
				END as availability,
				-- Primary image only (is_primary = true)
				pi.id as image_id,
				pi.url as image_url,
				pi.file_name as image_file_name,
				pi.created_at as image_created_at,
				'recommended' as section
			FROM products p
			JOIN businesses b ON b.id = p.business_id AND b.status = 'ACTIVE'
			JOIN shops s ON s.business_id = b.id AND s.status = 'ACTIVE'
			LEFT JOIN categories c ON c.id = p.category_id
			LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
			LEFT JOIN product_variants v ON v.product_id = p.id AND v.status = 'ACTIVE'
			LEFT JOIN inventory i ON i.variant_id = v.id AND i.shop_id = s.id
			LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = b.id
			LEFT JOIN seller_levels sl ON sl.id = pa.level_id
			LEFT JOIN seller_trust st ON st.business_id = b.id
			LEFT JOIN product_review_aggregates pra ON pra.product_id = p.id
			LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
			WHERE p.publication_status = 'PUBLISHED' AND p.status = 'ACTIVE'
			AND EXISTS (
				SELECT 1 FROM product_variants v2
				JOIN inventory i2 ON i2.variant_id = v2.id
				WHERE v2.product_id = p.id AND v2.status = 'ACTIVE' AND i2.shop_id = s.id
			)
			GROUP BY p.id, s.id, s.name, b.id, b.name, p.name, p.sku, p.description, p.unit, p.unit_price, p.currency,
					 p.category_id, c.name, c.slug, p.subcategory_id, sc.name, sc.slug, sl.name, st.trust_status,
					 pra.average_rating, pra.total_reviews, p.self_rating,
					 p.discount_active, p.discount_type, p.discount_value, p.discount_start, p.discount_end,
					 p.created_at, pi.id, pi.url, pi.file_name, pi.created_at
			ORDER BY COALESCE(sl.search_boost, 0) DESC, p.created_at DESC
			LIMIT 16
		),
		popular_cte AS (
			SELECT
				p.id, s.id as shop_id, s.name as shop_name, b.id as business_id, b.name as business_name,
				p.name, p.sku, p.description, p.unit,
				COALESCE(MIN(v.sale_price), p.unit_price, 0) as unit_price,
				COALESCE(NULLIF(p.currency, ''), 'USD') as currency,
				p.category_id,
				COALESCE(c.name, '') as category_name,
				COALESCE(c.slug, '') as category_slug,
				p.subcategory_id,
				COALESCE(sc.name, '') as subcategory_name,
				COALESCE(sc.slug, '') as subcategory_slug,
				COALESCE(sl.name, 'STARTER') as seller_level,
				COALESCE(st.trust_status, 'NORMAL') as seller_trust,
				COALESCE(pra.average_rating, 0)::float8 as average_rating,
				COALESCE(pra.total_reviews, 0)::int as total_reviews,
				p.self_rating,
				p.discount_active, p.discount_type, p.discount_value, p.discount_start, p.discount_end,
				p.created_at,
				COALESCE(SUM(i.quantity), 0) - COALESCE(SUM(i.reserved_quantity), 0) as available_quantity,
				CASE
					WHEN COALESCE(SUM(i.quantity), 0) - COALESCE(SUM(i.reserved_quantity), 0) > COALESCE((SELECT gc.value::int FROM global_configs gc WHERE gc.key = 'LOW_STOCK_THRESHOLD'), 5) THEN 'AVAILABLE'
					WHEN COALESCE(SUM(i.quantity), 0) - COALESCE(SUM(i.reserved_quantity), 0) > 0 THEN 'LOW_STOCK'
					ELSE 'OUT_OF_STOCK'
				END as availability,
				pi.id as image_id,
				pi.url as image_url,
				pi.file_name as image_file_name,
				pi.created_at as image_created_at,
				'popular' as section
			FROM products p
			JOIN businesses b ON b.id = p.business_id AND b.status = 'ACTIVE'
			JOIN shops s ON s.business_id = b.id AND s.status = 'ACTIVE'
			LEFT JOIN categories c ON c.id = p.category_id
			LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
			LEFT JOIN product_variants v ON v.product_id = p.id AND v.status = 'ACTIVE'
			LEFT JOIN inventory i ON i.variant_id = v.id AND i.shop_id = s.id
			LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = b.id
			LEFT JOIN seller_levels sl ON sl.id = pa.level_id
			LEFT JOIN seller_trust st ON st.business_id = b.id
			LEFT JOIN product_review_aggregates pra ON pra.product_id = p.id
			LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
			WHERE p.publication_status = 'PUBLISHED' AND p.status = 'ACTIVE'
			AND EXISTS (
				SELECT 1 FROM product_variants v2
				JOIN inventory i2 ON i2.variant_id = v2.id
				WHERE v2.product_id = p.id AND v2.status = 'ACTIVE' AND i2.shop_id = s.id
			)
			GROUP BY p.id, s.id, s.name, b.id, b.name, p.name, p.sku, p.description, p.unit, p.unit_price, p.currency,
					 p.category_id, c.name, c.slug, p.subcategory_id, sc.name, sc.slug, sl.name, st.trust_status,
					 pra.average_rating, pra.total_reviews, p.self_rating,
					 p.discount_active, p.discount_type, p.discount_value, p.discount_start, p.discount_end,
					 p.created_at, pi.id, pi.url, pi.file_name, pi.created_at
			ORDER BY COALESCE(pra.average_rating, 0) DESC, COALESCE(pra.total_reviews, 0) DESC
			LIMIT 8
		),
		newest_cte AS (
			SELECT
				p.id, s.id as shop_id, s.name as shop_name, b.id as business_id, b.name as business_name,
				p.name, p.sku, p.description, p.unit,
				COALESCE(MIN(v.sale_price), p.unit_price, 0) as unit_price,
				COALESCE(NULLIF(p.currency, ''), 'USD') as currency,
				p.category_id,
				COALESCE(c.name, '') as category_name,
				COALESCE(c.slug, '') as category_slug,
				p.subcategory_id,
				COALESCE(sc.name, '') as subcategory_name,
				COALESCE(sc.slug, '') as subcategory_slug,
				COALESCE(sl.name, 'STARTER') as seller_level,
				COALESCE(st.trust_status, 'NORMAL') as seller_trust,
				COALESCE(pra.average_rating, 0)::float8 as average_rating,
				COALESCE(pra.total_reviews, 0)::int as total_reviews,
				p.self_rating,
				p.discount_active, p.discount_type, p.discount_value, p.discount_start, p.discount_end,
				p.created_at,
				COALESCE(SUM(i.quantity), 0) - COALESCE(SUM(i.reserved_quantity), 0) as available_quantity,
				CASE
					WHEN COALESCE(SUM(i.quantity), 0) - COALESCE(SUM(i.reserved_quantity), 0) > COALESCE((SELECT gc.value::int FROM global_configs gc WHERE gc.key = 'LOW_STOCK_THRESHOLD'), 5) THEN 'AVAILABLE'
					WHEN COALESCE(SUM(i.quantity), 0) - COALESCE(SUM(i.reserved_quantity), 0) > 0 THEN 'LOW_STOCK'
					ELSE 'OUT_OF_STOCK'
				END as availability,
				pi.id as image_id,
				pi.url as image_url,
				pi.file_name as image_file_name,
				pi.created_at as image_created_at,
				'newest' as section
			FROM products p
			JOIN businesses b ON b.id = p.business_id AND b.status = 'ACTIVE'
			JOIN shops s ON s.business_id = b.id AND s.status = 'ACTIVE'
			LEFT JOIN categories c ON c.id = p.category_id
			LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
			LEFT JOIN product_variants v ON v.product_id = p.id AND v.status = 'ACTIVE'
			LEFT JOIN inventory i ON i.variant_id = v.id AND i.shop_id = s.id
			LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = b.id
			LEFT JOIN seller_levels sl ON sl.id = pa.level_id
			LEFT JOIN seller_trust st ON st.business_id = b.id
			LEFT JOIN product_review_aggregates pra ON pra.product_id = p.id
			LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
			WHERE p.publication_status = 'PUBLISHED' AND p.status = 'ACTIVE'
			AND p.created_at > NOW() - INTERVAL '30 days'
			AND EXISTS (
				SELECT 1 FROM product_variants v2
				JOIN inventory i2 ON i2.variant_id = v2.id
				WHERE v2.product_id = p.id AND v2.status = 'ACTIVE' AND i2.shop_id = s.id
			)
			GROUP BY p.id, s.id, s.name, b.id, b.name, p.name, p.sku, p.description, p.unit, p.unit_price, p.currency,
					 p.category_id, c.name, c.slug, p.subcategory_id, sc.name, sc.slug, sl.name, st.trust_status,
					 pra.average_rating, pra.total_reviews, p.self_rating,
					 p.discount_active, p.discount_type, p.discount_value, p.discount_start, p.discount_end,
					 p.created_at, pi.id, pi.url, pi.file_name, pi.created_at
			ORDER BY p.created_at DESC
			LIMIT 8
		),
		promoted_cte AS (
			SELECT
				p.id, s.id as shop_id, s.name as shop_name, b.id as business_id, b.name as business_name,
				p.name, p.sku, p.description, p.unit,
				COALESCE(MIN(v.sale_price), p.unit_price, 0) as unit_price,
				COALESCE(NULLIF(p.currency, ''), 'USD') as currency,
				p.category_id,
				COALESCE(c.name, '') as category_name,
				COALESCE(c.slug, '') as category_slug,
				p.subcategory_id,
				COALESCE(sc.name, '') as subcategory_name,
				COALESCE(sc.slug, '') as subcategory_slug,
				COALESCE(sl.name, 'STARTER') as seller_level,
				COALESCE(st.trust_status, 'NORMAL') as seller_trust,
				COALESCE(pra.average_rating, 0)::float8 as average_rating,
				COALESCE(pra.total_reviews, 0)::int as total_reviews,
				p.self_rating,
				p.discount_active, p.discount_type, p.discount_value, p.discount_start, p.discount_end,
				p.created_at,
				COALESCE(SUM(i.quantity), 0) - COALESCE(SUM(i.reserved_quantity), 0) as available_quantity,
				CASE
					WHEN COALESCE(SUM(i.quantity), 0) - COALESCE(SUM(i.reserved_quantity), 0) > COALESCE((SELECT gc.value::int FROM global_configs gc WHERE gc.key = 'LOW_STOCK_THRESHOLD'), 5) THEN 'AVAILABLE'
					WHEN COALESCE(SUM(i.quantity), 0) - COALESCE(SUM(i.reserved_quantity), 0) > 0 THEN 'LOW_STOCK'
					ELSE 'OUT_OF_STOCK'
				END as availability,
				pi.id as image_id,
				pi.url as image_url,
				pi.file_name as image_file_name,
				pi.created_at as image_created_at,
				'promoted' as section
			FROM products p
			JOIN businesses b ON b.id = p.business_id AND b.status = 'ACTIVE'
			JOIN shops s ON s.business_id = b.id AND s.status = 'ACTIVE'
			LEFT JOIN categories c ON c.id = p.category_id
			LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
			LEFT JOIN product_variants v ON v.product_id = p.id AND v.status = 'ACTIVE'
			LEFT JOIN inventory i ON i.variant_id = v.id AND i.shop_id = s.id
			LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = b.id
			LEFT JOIN seller_levels sl ON sl.id = pa.level_id
			LEFT JOIN seller_trust st ON st.business_id = b.id
			LEFT JOIN product_review_aggregates pra ON pra.product_id = p.id
			LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
			WHERE p.publication_status = 'PUBLISHED' AND p.status = 'ACTIVE'
			AND p.discount_active = true
			AND (p.discount_start IS NULL OR p.discount_start <= NOW())
			AND (p.discount_end IS NULL OR p.discount_end >= NOW())
			AND EXISTS (
				SELECT 1 FROM product_variants v2
				JOIN inventory i2 ON i2.variant_id = v2.id
				WHERE v2.product_id = p.id AND v2.status = 'ACTIVE' AND i2.shop_id = s.id
			)
			GROUP BY p.id, s.id, s.name, b.id, b.name, p.name, p.sku, p.description, p.unit, p.unit_price, p.currency,
					 p.category_id, c.name, c.slug, p.subcategory_id, sc.name, sc.slug, sl.name, st.trust_status,
					 pra.average_rating, pra.total_reviews, p.self_rating,
					 p.discount_active, p.discount_type, p.discount_value, p.discount_start, p.discount_end,
					 p.created_at, pi.id, pi.url, pi.file_name, pi.created_at
			ORDER BY p.discount_value DESC, p.created_at DESC
			LIMIT 8
		),
		all_sections AS (
			SELECT * FROM recommended_cte
			UNION ALL
			SELECT * FROM popular_cte
			UNION ALL
			SELECT * FROM newest_cte
			UNION ALL
			SELECT * FROM promoted_cte
		)
		SELECT * FROM all_sections
		ORDER BY
			CASE section
				WHEN 'recommended' THEN 1
				WHEN 'popular' THEN 2
				WHEN 'newest' THEN 3
				WHEN 'promoted' THEN 4
			END,
			section
	`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sections := make(map[string][]*models.PublicProductResponse)
	productsByID := make(map[uuid.UUID]*models.PublicProductResponse)

	for rows.Next() {
		p := &models.PublicProductResponse{}
		var section string
		var discountStart, discountEnd time.Time
		var imageID, imageURL, imageFileName, imageCreatedAt interface{}

		if err := rows.Scan(
			&p.ID, &p.ShopID, &p.ShopName, &p.BusinessID, &p.BusinessName,
			&p.Name, &p.SKU, &p.Description, &p.Unit, &p.BasePrice, &p.Currency,
			&p.CategoryID, &p.CategoryName, &p.CategorySlug,
			&p.SubcategoryID, &p.SubcategoryName, &p.SubcategorySlug,
			&p.SellerLevel, &p.SellerTrust,
			&p.AverageRating, &p.TotalReviews, &p.SelfRating,
			&p.DiscountActive, &p.DiscountType, &p.DiscountValue, &discountStart, &discountEnd,
			&p.CreatedAt, &p.AvailableQuantity, &p.Availability,
			&imageID, &imageURL, &imageFileName, &imageCreatedAt,
			&section,
		); err != nil {
			return nil, err
		}

		// Hydrate discount times
		if discountStart.String() != "0001-01-01 00:00:00 +0000 UTC" {
			p.DiscountStart = &discountStart
		}
		if discountEnd.String() != "0001-01-01 00:00:00 +0000 UTC" {
			p.DiscountEnd = &discountEnd
		}
		p.SellerSalePrice = models.Promotion{
			Active: p.DiscountActive, Type: p.DiscountType, Value: p.DiscountValue,
			Start: p.DiscountStart, End: p.DiscountEnd,
		}.EffectivePrice(p.BasePrice, time.Now())

		// Add image if present
		if imageID != nil {
			p.Images = []models.ProductImageResponse{{
				URL:       imageURL.(string),
				FileName:  imageFileName.(string),
				IsPrimary: true,
			}}
		}

		// Only add if new
		if _, exists := productsByID[p.ID]; !exists {
			productsByID[p.ID] = p
			sections[section] = append(sections[section], p)
		}
	}

	return sections, rows.Err()
}
