-- Migration 018: Buyer Side + Points System + Seller Growth Engine

-- ============================================================
-- BUYER PROFILES
-- ============================================================
CREATE TABLE buyer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    city VARCHAR(255) DEFAULT '',
    commune VARCHAR(255) DEFAULT '',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_buyer_profiles_user_id ON buyer_profiles(user_id);

-- ============================================================
-- SELLER LEVELS (configurable thresholds)
-- ============================================================
CREATE TABLE seller_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    min_points INTEGER NOT NULL,
    max_points INTEGER NOT NULL,
    search_boost DECIMAL(5,2) NOT NULL DEFAULT 0,
    recommendation_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    high_value_buyer_access BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO seller_levels (name, min_points, max_points, search_boost, recommendation_eligible, high_value_buyer_access, description) VALUES
('STARTER', 0, 499, 0.0, FALSE, FALSE, 'Normal marketplace presence'),
('ACTIVE', 500, 1999, 0.1, FALSE, FALSE, 'Small search ranking boost'),
('PRO', 2000, 4999, 0.25, TRUE, FALSE, 'Higher search boost, recommendation eligible'),
('ELITE', 5000, 9999, 0.5, TRUE, FALSE, 'Stronger recommendation exposure, higher visibility'),
('PREMIUM', 10000, 99999999, 1.0, TRUE, TRUE, 'Maximum organic visibility boost, priority recommendation eligibility');

-- ============================================================
-- BUYER LEVELS (configurable thresholds)
-- ============================================================
CREATE TABLE buyer_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    min_points INTEGER NOT NULL,
    max_points INTEGER NOT NULL,
    discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    delivery_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    free_delivery BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO buyer_levels (name, min_points, max_points, discount_percent, delivery_discount_percent, free_delivery, description) VALUES
('STANDARD', 0, 499, 0.0, 0.0, FALSE, 'Normal marketplace experience'),
('BRONZE', 500, 1999, 1.0, 0.0, FALSE, 'Small marketplace benefit'),
('SILVER', 2000, 4999, 3.0, 0.0, FALSE, 'Better purchase benefit'),
('GOLD', 5000, 9999, 5.0, 2.0, FALSE, 'Higher discount eligibility, delivery discount'),
('VIP', 10000, 99999999, 7.0, 5.0, TRUE, 'Highest discount, free delivery, special offers');

-- ============================================================
-- LEVEL BENEFITS (centralized benefit configuration)
-- ============================================================
CREATE TABLE level_benefits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level_type VARCHAR(20) NOT NULL, -- 'SELLER' or 'BUYER'
    level_name VARCHAR(50) NOT NULL,
    benefit_type VARCHAR(100) NOT NULL,
    benefit_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(level_type, level_name, benefit_type)
);

-- Seller benefits
INSERT INTO level_benefits (level_type, level_name, benefit_type, benefit_value) VALUES
('SELLER', 'STARTER', 'SEARCH_BOOST', 0),
('SELLER', 'STARTER', 'RECOMMENDATION_ELIGIBILITY', 0),
('SELLER', 'STARTER', 'HIGH_VALUE_BUYER_ACCESS', 0),
('SELLER', 'ACTIVE', 'SEARCH_BOOST', 0.1),
('SELLER', 'ACTIVE', 'RECOMMENDATION_ELIGIBILITY', 0),
('SELLER', 'ACTIVE', 'HIGH_VALUE_BUYER_ACCESS', 0),
('SELLER', 'PRO', 'SEARCH_BOOST', 0.25),
('SELLER', 'PRO', 'RECOMMENDATION_ELIGIBILITY', 1),
('SELLER', 'PRO', 'HIGH_VALUE_BUYER_ACCESS', 0),
('SELLER', 'ELITE', 'SEARCH_BOOST', 0.5),
('SELLER', 'ELITE', 'RECOMMENDATION_ELIGIBILITY', 1),
('SELLER', 'ELITE', 'HIGH_VALUE_BUYER_ACCESS', 0),
('SELLER', 'PREMIUM', 'SEARCH_BOOST', 1.0),
('SELLER', 'PREMIUM', 'RECOMMENDATION_ELIGIBILITY', 1),
('SELLER', 'PREMIUM', 'HIGH_VALUE_BUYER_ACCESS', 1);

-- Buyer benefits
INSERT INTO level_benefits (level_type, level_name, benefit_type, benefit_value) VALUES
('BUYER', 'STANDARD', 'PRICE_DISCOUNT_PERCENT', 0),
('BUYER', 'STANDARD', 'DELIVERY_DISCOUNT_PERCENT', 0),
('BUYER', 'STANDARD', 'FREE_DELIVERY', 0),
('BUYER', 'BRONZE', 'PRICE_DISCOUNT_PERCENT', 1.0),
('BUYER', 'BRONZE', 'DELIVERY_DISCOUNT_PERCENT', 0),
('BUYER', 'BRONZE', 'FREE_DELIVERY', 0),
('BUYER', 'SILVER', 'PRICE_DISCOUNT_PERCENT', 3.0),
('BUYER', 'SILVER', 'DELIVERY_DISCOUNT_PERCENT', 0),
('BUYER', 'SILVER', 'FREE_DELIVERY', 0),
('BUYER', 'GOLD', 'PRICE_DISCOUNT_PERCENT', 5.0),
('BUYER', 'GOLD', 'DELIVERY_DISCOUNT_PERCENT', 2.0),
('BUYER', 'GOLD', 'FREE_DELIVERY', 0),
('BUYER', 'VIP', 'PRICE_DISCOUNT_PERCENT', 7.0),
('BUYER', 'VIP', 'DELIVERY_DISCOUNT_PERCENT', 5.0),
('BUYER', 'VIP', 'FREE_DELIVERY', 1);

-- ============================================================
-- POINT ACCOUNTS
-- ============================================================
CREATE TABLE point_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type VARCHAR(20) NOT NULL, -- 'BUYER' or 'SELLER_BUSINESS'
    owner_id UUID NOT NULL,
    current_points INTEGER NOT NULL DEFAULT 0,
    lifetime_points INTEGER NOT NULL DEFAULT 0,
    level_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(owner_type, owner_id)
);

-- For sellers, owner_id = business_id
-- For buyers, owner_id = buyer_profile_id

CREATE INDEX idx_point_accounts_owner ON point_accounts(owner_type, owner_id);

-- ============================================================
-- POINT TRANSACTIONS (every point change is traceable)
-- ============================================================
CREATE TABLE point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_account_id UUID NOT NULL REFERENCES point_accounts(id),
    reference_type VARCHAR(50) NOT NULL, -- 'VERIFIED_PURCHASE', 'REFUND', etc.
    reference_id UUID NOT NULL, -- order_id or refund_id
    type VARCHAR(20) NOT NULL, -- 'CREDIT' or 'DEBIT'
    points_change INTEGER NOT NULL,
    previous_points INTEGER NOT NULL,
    new_points INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_point_transactions_account ON point_transactions(point_account_id);
CREATE INDEX idx_point_transactions_reference ON point_transactions(reference_type, reference_id);

-- Idempotency: one verified sale generates points at most once per account
CREATE UNIQUE INDEX idx_point_transactions_reference_unique 
ON point_transactions(point_account_id, reference_type, reference_id, type) 
WHERE type = 'CREDIT';

-- ============================================================
-- SELLER TRUST STATUS
-- ============================================================
CREATE TABLE seller_trust (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL UNIQUE REFERENCES businesses(id),
    trust_status VARCHAR(20) NOT NULL DEFAULT 'NORMAL', -- 'HIGH', 'NORMAL', 'LOW', 'SUSPENDED'
    verified_sales_count INTEGER NOT NULL DEFAULT 0,
    order_completion_rate DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    cancellation_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    purchase_confirmation_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    stock_reliability_rate DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    last_calculated_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VERIFIED TRANSACTIONS
-- ============================================================
CREATE TABLE verified_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    business_id UUID NOT NULL REFERENCES businesses(id),
    buyer_profile_id UUID NOT NULL REFERENCES buyer_profiles(id),
    shop_id UUID NOT NULL REFERENCES shops(id),
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'CDF',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'VERIFIED', 'REFUNDED'
    verified_at TIMESTAMP,
    refunded_at TIMESTAMP,
    points_awarded_seller BOOLEAN NOT NULL DEFAULT FALSE,
    points_awarded_buyer BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verified_transactions_order ON verified_transactions(order_id);
CREATE INDEX idx_verified_transactions_business ON verified_transactions(business_id);
CREATE INDEX idx_verified_transactions_buyer ON verified_transactions(buyer_profile_id);

-- One order can only be verified once
CREATE UNIQUE INDEX idx_verified_transactions_order_unique ON verified_transactions(order_id) WHERE status != 'REFUNDED';

-- ============================================================
-- PURCHASE CONFIRMATIONS (buyer confirms cash purchase)
-- ============================================================
CREATE TABLE purchase_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    buyer_profile_id UUID NOT NULL REFERENCES buyer_profiles(id),
    cash_payment_id UUID REFERENCES cash_payments(id),
    confirmed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_confirmations_order ON purchase_confirmations(order_id);
CREATE INDEX idx_purchase_confirmations_buyer ON purchase_confirmations(buyer_profile_id);

-- One buyer can only confirm each order once
CREATE UNIQUE INDEX idx_purchase_confirmations_unique ON purchase_confirmations(order_id, buyer_profile_id);
