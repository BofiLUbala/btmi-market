package repository

import (
	"context"
	"database/sql"
	"strings"
	"time"
	"unicode"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// Similar products are scored, not merely "same category": a polo must not
// surface bottled water just because a seller filed both under one broad
// category. The score blends the signals a buyer would use themselves:
//
//	same subcategory                         +45
//	same category                            +20
//	each name keyword in the candidate name  +18 (max 3)
//	name keyword only in its description     +4  (max 3)
//	each shared variant dimension (Taille…)  +5  (max 2, colour excluded)
//	price within ×0.5 … ×2 of the source     +4
//
// Only candidates reaching similarMinScore are shown. Category plus shared
// dimensions plus price tops out at 34, so a same-category product still needs
// a common keyword or the same subcategory — colour and size alone are shared
// by headphones and coats alike.
const (
	similarMinScore       = 35
	similarMaxPerBusiness = 3
	similarMaxKeywords    = 6
)

// Words that carry no product meaning in listing names (FR + EN).
var similarStopwords = map[string]bool{
	"les": true, "des": true, "une": true, "pour": true, "avec": true, "sans": true,
	"dans": true, "sur": true, "par": true, "aux": true, "the": true, "and": true,
	"for": true, "with": true, "pack": true, "lot": true, "neuf": true, "new": true,
	"produit": true, "article": true, "qualite": true, "qualité": true, "top": true,
	"super": true, "promo": true, "original": true, "officiel": true,
}

// Colour is carried by almost every physical product, so it says nothing
// about two products being alike.
var similarColourKeys = map[string]bool{"couleur": true, "color": true, "colour": true, "coloris": true, "teinte": true}

// similarKeywords turns a product name into lowercase stems that can be
// matched with LIKE: plurals are trimmed so "polos" still finds "polo".
func similarKeywords(name string) []string {
	fields := strings.FieldsFunc(strings.ToLower(name), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})
	seen := map[string]bool{}
	out := make([]string, 0, len(fields))
	for _, f := range fields {
		if len([]rune(f)) < 3 || similarStopwords[f] || strings.IndexFunc(f, unicode.IsLetter) < 0 {
			continue
		}
		if len([]rune(f)) > 4 {
			f = strings.TrimRight(f, "sx")
		}
		if seen[f] {
			continue
		}
		seen[f] = true
		out = append(out, f)
		if len(out) == similarMaxKeywords {
			break
		}
	}
	return out
}

// GetSimilarProducts returns published products from other listings that are
// genuinely comparable to productID, each attributed to the one active shop
// that actually stocks it (a business with several shops used to repeat the
// same product once per shop).
func (r *MarketplaceRepository) GetSimilarProducts(ctx context.Context, productID uuid.UUID, page, limit int) ([]*models.PublicProductResponse, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 50 {
		limit = 12
	}

	var (
		name          string
		categoryID    uuid.NullUUID
		subcategoryID uuid.NullUUID
		price         float64
	)
	err := r.db.QueryRowContext(ctx, `
		SELECT p.name, p.category_id, p.subcategory_id,
		       COALESCE((SELECT MIN(v.sale_price) FROM product_variants v
		                 WHERE v.product_id = p.id AND v.status = 'ACTIVE' AND v.sale_price > 0),
		                p.unit_price, 0)::float8
		FROM products p WHERE p.id = $1
	`, productID).Scan(&name, &categoryID, &subcategoryID, &price)
	if err == sql.ErrNoRows {
		return []*models.PublicProductResponse{}, 0, nil
	}
	if err != nil {
		return nil, 0, err
	}

	keywords := similarKeywords(name)
	attrKeys := []string{}
	keyRows, err := r.db.QueryContext(ctx, `
		SELECT DISTINCT lower(k)
		FROM product_variants v,
		     jsonb_object_keys(CASE WHEN jsonb_typeof(v.attributes) = 'object' THEN v.attributes ELSE '{}'::jsonb END) k
		WHERE v.product_id = $1 AND v.status = 'ACTIVE'
	`, productID)
	if err != nil {
		return nil, 0, err
	}
	for keyRows.Next() {
		var k string
		if keyRows.Scan(&k) == nil && k != "" && !similarColourKeys[k] {
			attrKeys = append(attrKeys, k)
		}
	}
	keyRows.Close()

	if !categoryID.Valid && !subcategoryID.Valid && len(keywords) == 0 {
		return []*models.PublicProductResponse{}, 0, nil
	}

	query := `
		WITH scored AS (
			SELECT p.id, p.business_id,
			       COALESCE((SELECT MIN(v.sale_price) FROM product_variants v
			                 WHERE v.product_id = p.id AND v.status = 'ACTIVE' AND v.sale_price > 0),
			                p.unit_price, 0)::float8 AS price,
			       (CASE WHEN $2::uuid IS NOT NULL AND p.subcategory_id = $2::uuid THEN 45 ELSE 0 END)
			     + (CASE WHEN $1::uuid IS NOT NULL AND p.category_id = $1::uuid THEN 20 ELSE 0 END)
			     + 18 * LEAST(3, (SELECT COUNT(*) FROM unnest($3::text[]) t
			                      WHERE lower(p.name) LIKE '%' || t || '%'))
			     + 4 * LEAST(3, (SELECT COUNT(*) FROM unnest($3::text[]) t
			                     WHERE lower(p.name) NOT LIKE '%' || t || '%'
			                       AND lower(COALESCE(p.description, '')) LIKE '%' || t || '%'))
			     + 5 * LEAST(2, (SELECT COUNT(DISTINCT lower(k))
			                     FROM product_variants v,
			                          jsonb_object_keys(CASE WHEN jsonb_typeof(v.attributes) = 'object' THEN v.attributes ELSE '{}'::jsonb END) k
			                     WHERE v.product_id = p.id AND v.status = 'ACTIVE' AND lower(k) = ANY($4::text[])))
			       AS score
			FROM products p
			WHERE p.publication_status = 'PUBLISHED' AND p.status = 'ACTIVE' AND p.id <> $5
			  AND (p.category_id = $1::uuid OR p.subcategory_id = $2::uuid
			       OR EXISTS (SELECT 1 FROM unnest($3::text[]) t WHERE lower(p.name) LIKE '%' || t || '%'))
		), ranked AS (
			SELECT sc.*,
			       sc.score + (CASE WHEN $6::float8 > 0 AND sc.price BETWEEN $6::float8 * 0.5 AND $6::float8 * 2 THEN 4 ELSE 0 END) AS final_score
			FROM scored sc
		), offers AS (
			SELECT rk.*, bs.shop_id, bs.shop_name, bs.stock,
			       ROW_NUMBER() OVER (PARTITION BY rk.business_id ORDER BY rk.final_score DESC, rk.id) AS per_business
			FROM ranked rk
			JOIN LATERAL (
				SELECT s.id AS shop_id, s.name AS shop_name,
				       SUM(GREATEST(i.quantity - i.reserved_quantity, 0)) AS stock
				FROM shops s
				JOIN inventory i ON i.shop_id = s.id
				JOIN product_variants v ON v.id = i.variant_id AND v.product_id = rk.id AND v.status = 'ACTIVE'
				WHERE s.business_id = rk.business_id AND s.status = 'ACTIVE'
				GROUP BY s.id, s.name, s.created_at
				ORDER BY stock DESC, s.created_at ASC
				LIMIT 1
			) bs ON bs.stock > 0
			WHERE rk.final_score >= $7
		)
		SELECT p.id, o.shop_id, o.shop_name, p.business_id, b.name,
		       p.name, p.sku, COALESCE(p.description, ''), p.unit, o.price,
		       COALESCE(NULLIF(p.currency, ''), 'USD'),
		       p.category_id, COALESCE(c.name, ''), COALESCE(c.slug, ''),
		       p.subcategory_id, COALESCE(sc.name, ''), COALESCE(sc.slug, ''),
		       COALESCE(sl.name, 'STARTER'), COALESCE(st.trust_status, 'NORMAL'),
		       CASE WHEN o.stock > COALESCE((SELECT gc.value::int FROM global_configs gc WHERE gc.key = 'LOW_STOCK_THRESHOLD'), 5)
		            THEN 'AVAILABLE' ELSE 'LOW_STOCK' END,
		       p.discount_active, p.discount_type, p.discount_value, p.discount_start, p.discount_end,
		       p.created_at,
		       COUNT(*) OVER () AS total
		FROM offers o
		JOIN products p ON p.id = o.id
		JOIN businesses b ON b.id = p.business_id
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
		LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = b.id
		LEFT JOIN seller_levels sl ON sl.id = pa.level_id
		LEFT JOIN seller_trust st ON st.business_id = b.id
		LEFT JOIN product_review_aggregates pra ON pra.product_id = p.id
		WHERE o.per_business <= $8
		ORDER BY o.final_score DESC, COALESCE(pra.average_rating, 0) DESC,
		         COALESCE(sl.search_boost, 0) DESC, p.created_at DESC
		LIMIT $9 OFFSET $10
	`

	rows, err := r.db.QueryContext(ctx, query,
		categoryID, subcategoryID, pq.Array(keywords), pq.Array(attrKeys), productID,
		price, similarMinScore, similarMaxPerBusiness, limit, (page-1)*limit,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	products := []*models.PublicProductResponse{}
	total := 0
	for rows.Next() {
		p := &models.PublicProductResponse{}
		var discountStart, discountEnd sql.NullTime
		if err := rows.Scan(
			&p.ID, &p.ShopID, &p.ShopName, &p.BusinessID, &p.BusinessName,
			&p.Name, &p.SKU, &p.Description, &p.Unit, &p.BasePrice,
			&p.Currency,
			&p.CategoryID, &p.CategoryName, &p.CategorySlug,
			&p.SubcategoryID, &p.SubcategoryName, &p.SubcategorySlug,
			&p.SellerLevel, &p.SellerTrust,
			&p.Availability,
			&p.DiscountActive, &p.DiscountType, &p.DiscountValue, &discountStart, &discountEnd,
			&p.CreatedAt,
			&total,
		); err != nil {
			return nil, 0, err
		}
		if discountStart.Valid {
			p.DiscountStart = &discountStart.Time
		}
		if discountEnd.Valid {
			p.DiscountEnd = &discountEnd.Time
		}
		p.SellerSalePrice = models.Promotion{
			Active: p.DiscountActive, Type: p.DiscountType, Value: p.DiscountValue,
			Start: p.DiscountStart, End: p.DiscountEnd,
		}.EffectivePrice(p.BasePrice, time.Now())
		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	if err := r.attachProductRatings(products); err != nil {
		return nil, 0, err
	}
	return products, total, nil
}
