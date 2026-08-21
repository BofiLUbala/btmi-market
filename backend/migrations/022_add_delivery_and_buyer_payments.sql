-- Migration 022: Delivery selection + Cash payment (buyer/seller confirmed)
-- Date: 2026-08-18

-- ============================================================
-- 1. Shop delivery configuration (backend-driven fees)
-- ============================================================
ALTER TABLE shops ADD COLUMN IF NOT EXISTS supports_shop_delivery BOOLEAN DEFAULT FALSE;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS shop_delivery_fee DECIMAL(15,2) DEFAULT 0;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS supports_partner_delivery BOOLEAN DEFAULT FALSE;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS partner_delivery_fee DECIMAL(15,2) DEFAULT 0;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS partner_delivery_provider VARCHAR(100) DEFAULT '';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS delivery_city VARCHAR(255) DEFAULT '';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS delivery_address VARCHAR(255) DEFAULT '';

-- ============================================================
-- 2. Order delivery snapshot
-- ============================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee_base DECIMAL(15,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_points_used INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_points_discount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee_final DECIMAL(15,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_contact_name VARCHAR(255) DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_phone VARCHAR(50) DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address VARCHAR(500) DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_finalized BOOLEAN DEFAULT FALSE;

-- ============================================================
-- 3. Point config: delivery coverage cap (separate, configurable)
-- ============================================================
INSERT INTO point_config (key, value, description) VALUES
('max_delivery_point_coverage', 100.0, 'Maximum percent of delivery fee coverable by points')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = NOW();

-- ============================================================
-- 4. Buyer payments (CASH only for now, extensible model)
--    All amounts derived from Order/Delivery snapshot; client never sends amounts.
-- ============================================================
CREATE TABLE IF NOT EXISTS buyer_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    business_id UUID NOT NULL REFERENCES businesses(id),
    shop_id UUID NOT NULL REFERENCES shops(id),
    buyer_profile_id UUID NOT NULL REFERENCES buyer_profiles(id),

    payment_method VARCHAR(20) NOT NULL DEFAULT 'CASH',
    currency VARCHAR(10) NOT NULL DEFAULT 'CDF',

    products_base_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    products_points_used INTEGER NOT NULL DEFAULT 0,
    products_points_discount DECIMAL(15,2) NOT NULL DEFAULT 0,
    products_final_total DECIMAL(15,2) NOT NULL DEFAULT 0,

    delivery_fee_base DECIMAL(15,2) NOT NULL DEFAULT 0,
    delivery_points_used INTEGER NOT NULL DEFAULT 0,
    delivery_points_discount DECIMAL(15,2) NOT NULL DEFAULT 0,
    delivery_fee_final DECIMAL(15,2) NOT NULL DEFAULT 0,

    cash_due DECIMAL(15,2) NOT NULL DEFAULT 0,

    buyer_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    buyer_confirmed_at TIMESTAMP WITH TIME ZONE,
    seller_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    seller_confirmed_by UUID,
    seller_confirmed_at TIMESTAMP WITH TIME ZONE,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING / CONFIRMED / VERIFIED / CANCELLED
    verified_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- One order => at most one payment
CREATE UNIQUE INDEX IF NOT EXISTS idx_buyer_payments_order_unique ON buyer_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_buyer_payments_buyer ON buyer_payments(buyer_profile_id);
CREATE INDEX IF NOT EXISTS idx_buyer_payments_status ON buyer_payments(status);
