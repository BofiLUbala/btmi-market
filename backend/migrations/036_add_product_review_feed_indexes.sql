-- Migration: Add indexes for optimized homepage feed queries
-- Improves performance on: recommended, popular, newest, promoted sections

-- Index for newest section (created_at DESC)
-- Used by: ORDER BY created_at DESC with WHERE created_at > NOW() - INTERVAL '30 days'
CREATE INDEX IF NOT EXISTS idx_products_created_at_desc
ON products(created_at DESC)
WHERE publication_status = 'PUBLISHED' AND status = 'ACTIVE';

-- Index for promoted section (discount state + value)
-- Used by: WHERE discount_active=true AND discount_start/end checks
CREATE INDEX IF NOT EXISTS idx_products_discount_active
ON products(discount_active, discount_value DESC)
WHERE publication_status = 'PUBLISHED' AND status = 'ACTIVE' AND discount_active = true;

-- Composite index for publication+status (used by all sections)
CREATE INDEX IF NOT EXISTS idx_products_pub_status
ON products(publication_status, status)
WHERE publication_status = 'PUBLISHED' AND status = 'ACTIVE';

-- Index for product ratings lookup (optional: only needed if materializing reviews)
-- Used by: LEFT JOIN product_review_aggregates pra ON pra.product_id = p.id
CREATE INDEX IF NOT EXISTS idx_product_review_aggregates_rating
ON product_review_aggregates(average_rating DESC NULLS LAST, total_reviews DESC NULLS LAST);

-- Index for primary image lookup (is_primary=true)
-- Used by: LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
CREATE INDEX IF NOT EXISTS idx_product_images_primary
ON product_images(product_id, is_primary)
WHERE is_primary = true;

COMMENT ON INDEX idx_products_created_at_desc IS 'Newest section: fetch recent products';
COMMENT ON INDEX idx_products_discount_active IS 'Promoted section: fetch discounted products';
COMMENT ON INDEX idx_products_pub_status IS 'All sections: filter by publication status';
COMMENT ON INDEX idx_product_review_aggregates_rating IS 'Popular section: fetch by rating aggregate';
COMMENT ON INDEX idx_product_images_primary IS 'All sections: fetch primary images only';
