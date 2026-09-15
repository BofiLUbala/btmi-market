-- Migration 081: Order line history snapshots, low-stock threshold config, commission backfill
-- Date: 2026-09-15

-- ============================================================
-- 1. order_lines: snapshot product/variant data so purchase history
--    survives product edits, archives and deletions.
-- ============================================================
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS product_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS product_sku VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS variant_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS variant_sku VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS variant_attributes JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';

-- Backfill existing lines from the current product data.
UPDATE order_lines ol
SET product_name       = COALESCE(p.name, ''),
    product_sku        = COALESCE(p.sku, ''),
    variant_name       = COALESCE(v.name, ''),
    variant_sku        = COALESCE(v.sku, ''),
    variant_attributes = COALESCE(v.attributes, '{}'::jsonb),
    image_url          = COALESCE((
        SELECT pi.url FROM product_images pi
        WHERE pi.product_id = ol.product_id
        ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.created_at ASC
        LIMIT 1
    ), '')
FROM products p, product_variants v
WHERE p.id = ol.product_id
  AND v.id = ol.variant_id;

-- Reading history must not rely on a product/variant still existing.
-- order_lines keeps its FK to orders (ON DELETE CASCADE), but product/variant
-- references become soft: deleting a product no longer deletes its sales lines.
ALTER TABLE order_lines DROP CONSTRAINT IF EXISTS order_lines_product_id_fkey;
ALTER TABLE order_lines DROP CONSTRAINT IF EXISTS order_lines_variant_id_fkey;
ALTER TABLE order_lines ADD CONSTRAINT order_lines_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE order_lines ADD CONSTRAINT order_lines_variant_id_fkey
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;

-- ============================================================
-- 2. Low-stock threshold: single source of truth consumed by seller
--    stock pages, admin commerce and marketplace availability badges.
-- ============================================================
INSERT INTO global_configs (key, description, value_type, value, category)
VALUES ('LOW_STOCK_THRESHOLD', 'Seuil de stock faible au-dessous duquel une disponibilite passe en alerte pour les vendeurs et l''administrateur', 'NUMBER', '5', 'COMMERCE')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, updated_at = NOW();

-- ============================================================
-- 3. Backfill a per-sale commission snapshot for every VERIFIED
--    cash payment that is not yet recorded (idempotent).
-- ============================================================
INSERT INTO sale_commissions (
    id, order_id, payment_id, business_id, shop_id, seller_user_id,
    gross_amount, commission_base, commission_rate, commission_amount, seller_net_amount, currency,
    status, calculated_at, notes, created_at, updated_at
)
SELECT
    gen_random_uuid(), o.id, p.id, o.business_id, o.shop_id, o.created_by,
    p.products_final_total,
    p.products_final_total,
    COALESCE((SELECT value::numeric FROM global_configs WHERE key = 'PLATFORM_COMMISSION_RATE'), 0),
    ROUND(p.products_final_total * COALESCE((SELECT value::numeric FROM global_configs WHERE key = 'PLATFORM_COMMISSION_RATE'), 0) / 100, 2),
    ROUND(p.products_final_total - p.products_final_total * COALESCE((SELECT value::numeric FROM global_configs WHERE key = 'PLATFORM_COMMISSION_RATE'), 0) / 100, 2),
    o.currency,
    'DUE', p.verified_at, 'Backfilled from verified payment', NOW(), NOW()
FROM buyer_payments p
JOIN orders o ON o.id = p.order_id
WHERE p.status = 'VERIFIED'
  AND NOT EXISTS (SELECT 1 FROM sale_commissions sc WHERE sc.order_id = p.order_id);