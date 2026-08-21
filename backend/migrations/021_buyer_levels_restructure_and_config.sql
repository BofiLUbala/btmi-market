-- Migration 021: Buyer Level restructure + Point config + Order idempotency
-- Date: 2026-08-17

-- ============================================================
-- 1. Update BUYER LEVELS to spec thresholds
-- ============================================================
DELETE FROM level_benefits WHERE level_type = 'BUYER';
DELETE FROM buyer_levels;

INSERT INTO buyer_levels (id, name, min_points, max_points, discount_percent, delivery_discount_percent, free_delivery, description) VALUES
('a0000000-0000-0000-0000-000000000001', 'BRONZE',    0,     499,   0.0, 0.0, FALSE, 'Normal marketplace experience'),
('a0000000-0000-0000-0000-000000000002', 'SILVER',    500,   1999,  1.0, 0.0, FALSE, 'Small marketplace benefit'),
('a0000000-0000-0000-0000-000000000003', 'GOLD',      2000,  4999,  3.0, 0.0, FALSE, 'Better purchase benefit'),
('a0000000-0000-0000-0000-000000000004', 'PLATINUM',  5000,  9999,  5.0, 2.0, FALSE, 'Higher discount, delivery discount'),
('a0000000-0000-0000-0000-000000000005', 'DIAMOND',   10000, 99999999, 7.0, 5.0, TRUE, 'Highest discount, free delivery, special offers');

INSERT INTO level_benefits (level_type, level_name, benefit_type, benefit_value) VALUES
('BUYER', 'BRONZE',    'PRICE_DISCOUNT_PERCENT',  0),
('BUYER', 'BRONZE',    'DELIVERY_DISCOUNT_PERCENT', 0),
('BUYER', 'BRONZE',    'FREE_DELIVERY', 0),
('BUYER', 'SILVER',    'PRICE_DISCOUNT_PERCENT',  1.0),
('BUYER', 'SILVER',    'DELIVERY_DISCOUNT_PERCENT', 0),
('BUYER', 'SILVER',    'FREE_DELIVERY', 0),
('BUYER', 'GOLD',      'PRICE_DISCOUNT_PERCENT',  3.0),
('BUYER', 'GOLD',      'DELIVERY_DISCOUNT_PERCENT', 0),
('BUYER', 'GOLD',      'FREE_DELIVERY', 0),
('BUYER', 'PLATINUM',  'PRICE_DISCOUNT_PERCENT',  5.0),
('BUYER', 'PLATINUM',  'DELIVERY_DISCOUNT_PERCENT', 2.0),
('BUYER', 'PLATINUM',  'FREE_DELIVERY', 0),
('BUYER', 'DIAMOND',   'PRICE_DISCOUNT_PERCENT',  7.0),
('BUYER', 'DIAMOND',   'DELIVERY_DISCOUNT_PERCENT', 5.0),
('BUYER', 'DIAMOND',   'FREE_DELIVERY', 1);

-- Reset all buyer point accounts to BRONZE level (lowest)
UPDATE point_accounts SET level_id = 'a0000000-0000-0000-0000-000000000001'
WHERE owner_type = 'BUYER';

-- ============================================================
-- 2. Point Redemption Configuration
-- ============================================================
CREATE TABLE IF NOT EXISTS point_config (
    key         VARCHAR(100) PRIMARY KEY,
    value       DECIMAL(15,4) NOT NULL,
    description TEXT DEFAULT '',
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Earn rate: 1000 CDF = 1 POINT
INSERT INTO point_config (key, value, description) VALUES
('earn_rate', 1000.0, 'CDF per 1 point earned')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = NOW();

-- Redeem rate: 1 POINT = 1000 CDF discount
INSERT INTO point_config (key, value, description) VALUES
('redeem_rate', 1000.0, 'CDF discount per 1 point redeemed')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = NOW();

-- Maximum percentage of order that points may cover (20%)
INSERT INTO point_config (key, value, description) VALUES
('max_point_coverage', 20.0, 'Maximum percent of order total coverable by points')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = NOW();

-- ============================================================
-- 3. Order idempotency protection
-- ============================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key
ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
