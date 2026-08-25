-- Product-scoped verified reviews and social interactions.
ALTER TABLE seller_reviews ADD COLUMN product_id UUID REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE seller_reviews ADD COLUMN order_line_id UUID REFERENCES order_lines(id) ON DELETE CASCADE;
ALTER TABLE seller_reviews ADD COLUMN variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;

-- Preserve legacy shop reviews while allowing one review for every purchased line.
ALTER TABLE seller_reviews DROP CONSTRAINT IF EXISTS seller_reviews_order_id_key;
CREATE UNIQUE INDEX uq_seller_reviews_order_line
    ON seller_reviews(order_line_id) WHERE order_line_id IS NOT NULL;
CREATE INDEX idx_seller_reviews_product_active
    ON seller_reviews(product_id, status, created_at DESC);

CREATE TABLE review_helpful_votes (
    review_id UUID NOT NULL REFERENCES seller_reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (review_id, user_id)
);

CREATE TABLE review_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES seller_reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_review_replies_review ON review_replies(review_id, created_at);
