CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS product_qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    public_reference UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    UNIQUE (product_id, variant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_qr_product
ON product_qr_codes(product_id) WHERE variant_id IS NULL;

INSERT INTO product_qr_codes(product_id)
SELECT p.id FROM products p
WHERE NOT EXISTS (SELECT 1 FROM product_qr_codes q WHERE q.product_id = p.id AND q.variant_id IS NULL);

CREATE OR REPLACE FUNCTION tbk_create_product_qr() RETURNS trigger AS $$
BEGIN
  INSERT INTO product_qr_codes(product_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tbk_create_product_qr ON products;
CREATE TRIGGER trg_tbk_create_product_qr AFTER INSERT ON products
FOR EACH ROW EXECUTE FUNCTION tbk_create_product_qr();

CREATE TABLE IF NOT EXISTS delivery_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id),
    buyer_profile_id UUID REFERENCES buyer_profiles(id),
    package_number INTEGER NOT NULL DEFAULT 1,
    public_reference UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    qr_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (qr_status IN ('ACTIVE','REVOKED','EXPIRED')),
    operational BOOLEAN NOT NULL DEFAULT FALSE,
    pickup_verified_at TIMESTAMPTZ,
    delivery_scanned_at TIMESTAMPTZ,
    receipt_confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(order_id, package_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_package_active
ON delivery_packages(order_id, package_number) WHERE qr_status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS delivery_scan_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key VARCHAR(100),
    delivery_id UUID NOT NULL REFERENCES delivery_packages(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES delivery_packages(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    courier_id UUID REFERENCES users(id),
    scan_type VARCHAR(20) NOT NULL CHECK (scan_type IN ('PICKUP','DELIVERY')),
    scan_result VARCHAR(20) NOT NULL CHECK (scan_result IN ('SUCCESS','REJECTED','DUPLICATE','INVALID')),
    reason VARCHAR(100) NOT NULL DEFAULT '',
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    device_id VARCHAR(255),
    device_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_scan_idempotency
ON delivery_scan_events(courier_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_scan_order ON delivery_scan_events(order_id, created_at DESC);
