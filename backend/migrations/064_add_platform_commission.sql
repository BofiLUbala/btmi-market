-- Migration 064: Add Platform Commission System (3% Default) & Commission Audit Trail

-- 1. Ensure PLATFORM_COMMISSION_RATE is present in global_configs
INSERT INTO global_configs (key, description, value_type, value, category)
VALUES ('PLATFORM_COMMISSION_RATE', 'Pourcentage de commission TBK prélevé sur les ventes vérifiées (ex: 3.00 pour 3%)', 'NUMBER', '3.00', 'FINANCE')
ON CONFLICT (key) DO NOTHING;

-- 2. Create sale_commissions table to store per-sale financial snapshots
CREATE TABLE IF NOT EXISTS sale_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
    payment_id UUID REFERENCES buyer_payments(id),
    business_id UUID NOT NULL REFERENCES businesses(id),
    shop_id UUID NOT NULL REFERENCES shops(id),
    seller_user_id UUID,

    gross_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    commission_base DECIMAL(15,2) NOT NULL DEFAULT 0,
    commission_rate DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    commission_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    seller_net_amount DECIMAL(15,2) NOT NULL DEFAULT 0,

    status VARCHAR(20) NOT NULL DEFAULT 'DUE', -- 'DUE' (À reverser), 'COLLECTED' (Réglée), 'WAIVED', 'ADJUSTED'

    calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    collected_at TIMESTAMP WITH TIME ZONE,
    collected_by UUID,
    notes TEXT DEFAULT '',

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_commissions_business ON sale_commissions(business_id);
CREATE INDEX IF NOT EXISTS idx_sale_commissions_shop ON sale_commissions(shop_id);
CREATE INDEX IF NOT EXISTS idx_sale_commissions_seller ON sale_commissions(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_sale_commissions_status ON sale_commissions(status);
CREATE INDEX IF NOT EXISTS idx_sale_commissions_calculated ON sale_commissions(calculated_at);

-- 3. Create platform_commission_history table for auditing rate modifications by Finance Admin
CREATE TABLE IF NOT EXISTS platform_commission_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    old_rate DECIMAL(5,2) NOT NULL,
    new_rate DECIMAL(5,2) NOT NULL,
    changed_by UUID,
    reason TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
