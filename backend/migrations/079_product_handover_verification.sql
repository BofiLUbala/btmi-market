-- Buyer-side product identity verification at physical handover.
-- The QR/reference resolves server-side; no buyer or payment data is encoded.
CREATE TABLE IF NOT EXISTS product_handover_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    buyer_profile_id UUID NOT NULL REFERENCES buyer_profiles(id),
    courier_id UUID REFERENCES users(id),
    product_id UUID REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    verification_method VARCHAR(30) NOT NULL CHECK (verification_method IN ('QR_SCAN','MANUAL_PRODUCT_NUMBER')),
    supplied_reference VARCHAR(120) NOT NULL DEFAULT '',
    result VARCHAR(20) NOT NULL CHECK (result IN ('SUCCESS','REJECTED')),
    reason VARCHAR(100) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_handover_order
ON product_handover_verifications(order_id, created_at DESC);

