-- Migration 024: Verified Seller Reviews (Point 9)

-- Review statuses
-- ACTIVE = visible in public aggregates
-- WITHDRAWN = buyer withdrew, excluded from aggregates
-- HIDDEN = moderation-only, excluded from aggregates

CREATE TABLE seller_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
    buyer_profile_id UUID NOT NULL REFERENCES buyer_profiles(id),
    business_id UUID NOT NULL REFERENCES businesses(id),
    shop_id UUID NOT NULL REFERENCES shops(id),
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT DEFAULT '',
    verified_purchase BOOLEAN NOT NULL DEFAULT true,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_seller_reviews_shop_id ON seller_reviews(shop_id);
CREATE INDEX idx_seller_reviews_buyer_profile_id ON seller_reviews(buyer_profile_id);
CREATE INDEX idx_seller_reviews_created_at ON seller_reviews(created_at);
CREATE INDEX idx_seller_reviews_status ON seller_reviews(status);
CREATE INDEX idx_seller_reviews_business_id ON seller_reviews(business_id);

-- Review edit history (audit traceability)
CREATE TABLE review_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES seller_reviews(id),
    old_rating SMALLINT NOT NULL,
    new_rating SMALLINT NOT NULL,
    old_comment TEXT DEFAULT '',
    new_comment TEXT DEFAULT '',
    changed_by UUID NOT NULL REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_history_review_id ON review_history(review_id);

-- Cached aggregates per shop (PostgreSQL is authoritative)
CREATE TABLE shop_review_aggregates (
    shop_id UUID PRIMARY KEY REFERENCES shops(id),
    average_rating DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    rating_1_count INTEGER NOT NULL DEFAULT 0,
    rating_2_count INTEGER NOT NULL DEFAULT 0,
    rating_3_count INTEGER NOT NULL DEFAULT 0,
    rating_4_count INTEGER NOT NULL DEFAULT 0,
    rating_5_count INTEGER NOT NULL DEFAULT 0,
    last_review_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
