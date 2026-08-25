-- Separate product quality reviews from order/shop experience reviews.
ALTER TABLE seller_reviews ADD COLUMN delivery_rating SMALLINT CHECK (delivery_rating BETWEEN 1 AND 5);
ALTER TABLE seller_reviews ADD COLUMN service_rating SMALLINT CHECK (service_rating BETWEEN 1 AND 5);
ALTER TABLE seller_reviews ADD COLUMN order_experience_rating SMALLINT CHECK (order_experience_rating BETWEEN 1 AND 5);

CREATE UNIQUE INDEX uq_seller_reviews_order_experience
    ON seller_reviews(order_id) WHERE order_line_id IS NULL;

-- Product reviews are intentionally excluded from shop/service reputation.
UPDATE shop_review_aggregates sra SET
    average_rating = x.average_rating,
    total_reviews = x.total_reviews,
    rating_1_count = x.rating_1_count,
    rating_2_count = x.rating_2_count,
    rating_3_count = x.rating_3_count,
    rating_4_count = x.rating_4_count,
    rating_5_count = x.rating_5_count,
    last_review_at = x.last_review_at,
    updated_at = NOW()
FROM (
    SELECT s.id AS shop_id, COALESCE(AVG(sr.rating), 0) AS average_rating,
           COUNT(sr.id) AS total_reviews,
           COUNT(sr.id) FILTER (WHERE sr.rating = 1) AS rating_1_count,
           COUNT(sr.id) FILTER (WHERE sr.rating = 2) AS rating_2_count,
           COUNT(sr.id) FILTER (WHERE sr.rating = 3) AS rating_3_count,
           COUNT(sr.id) FILTER (WHERE sr.rating = 4) AS rating_4_count,
           COUNT(sr.id) FILTER (WHERE sr.rating = 5) AS rating_5_count,
           MAX(sr.created_at) AS last_review_at
    FROM shops s
    LEFT JOIN seller_reviews sr ON sr.shop_id = s.id AND sr.status = 'ACTIVE' AND sr.order_line_id IS NULL
    GROUP BY s.id
) x WHERE sra.shop_id = x.shop_id;
