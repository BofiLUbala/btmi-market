-- Product-level review aggregate, mirroring shop_review_aggregates.
--
-- Buyers decide on listing pages (home, search, category, shop, similar), but
-- ratings were only reachable from the product detail page. Computing an
-- average per row in those list queries would add a correlated subquery to
-- every marketplace listing, so the aggregate is maintained on write instead
-- and simply LEFT JOINed on read.
CREATE TABLE product_review_aggregates (
    product_id UUID PRIMARY KEY,
    average_rating NUMERIC(3,2) NOT NULL DEFAULT 0.00,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    rating_1_count INTEGER NOT NULL DEFAULT 0,
    rating_2_count INTEGER NOT NULL DEFAULT 0,
    rating_3_count INTEGER NOT NULL DEFAULT 0,
    rating_4_count INTEGER NOT NULL DEFAULT 0,
    rating_5_count INTEGER NOT NULL DEFAULT 0,
    last_review_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_product_review_aggregates_product
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Supports "4 stars and above" filtering and rating sorts.
CREATE INDEX idx_product_review_aggregates_rating
    ON product_review_aggregates(average_rating DESC, total_reviews DESC);

-- Backfill from reviews that already exist. Product reviews are the ones tied
-- to an order line; reviews with a NULL order_line_id are shop/service reviews.
INSERT INTO product_review_aggregates (
    product_id, average_rating, total_reviews,
    rating_1_count, rating_2_count, rating_3_count, rating_4_count, rating_5_count,
    last_review_at, updated_at
)
SELECT
    sr.product_id,
    COALESCE(ROUND(AVG(sr.rating)::numeric, 2), 0.00),
    COUNT(*),
    COUNT(*) FILTER (WHERE sr.rating = 1),
    COUNT(*) FILTER (WHERE sr.rating = 2),
    COUNT(*) FILTER (WHERE sr.rating = 3),
    COUNT(*) FILTER (WHERE sr.rating = 4),
    COUNT(*) FILTER (WHERE sr.rating = 5),
    MAX(sr.created_at),
    NOW()
FROM seller_reviews sr
WHERE sr.product_id IS NOT NULL
  AND sr.order_line_id IS NOT NULL
  AND sr.status = 'ACTIVE'
GROUP BY sr.product_id
ON CONFLICT (product_id) DO NOTHING;
