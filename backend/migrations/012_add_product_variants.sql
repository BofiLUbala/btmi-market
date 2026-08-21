CREATE TYPE variant_status AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED');

CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) DEFAULT '',
    name VARCHAR(255) DEFAULT '',
    attributes JSONB DEFAULT '{}',
    sale_price DECIMAL(15,2) DEFAULT 0,
    purchase_price DECIMAL(15,2) DEFAULT 0,
    barcode VARCHAR(100) DEFAULT '',
    unit VARCHAR(50) DEFAULT 'PCS',
    status variant_status DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);
CREATE INDEX idx_variants_barcode ON product_variants(barcode);
CREATE INDEX idx_variants_status ON product_variants(status);

-- Add variant_id to inventory
ALTER TABLE inventory ADD COLUMN variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE;

-- Create default variants for existing inventory rows
DO $$
DECLARE
    inv RECORD;
    var_id UUID;
BEGIN
    FOR inv IN SELECT DISTINCT product_id, business_id FROM inventory LOOP
        SELECT id INTO var_id FROM product_variants WHERE product_id = inv.product_id LIMIT 1;
        IF var_id IS NULL THEN
            INSERT INTO product_variants (product_id, sku, name, sale_price, purchase_price, unit, status)
            SELECT inv.product_id, p.sku, p.name, p.unit_price, p.cost_price, p.unit, 'ACTIVE'::variant_status
            FROM products p WHERE p.id = inv.product_id
            RETURNING id INTO var_id;
        END IF;
        UPDATE inventory SET variant_id = var_id WHERE product_id = inv.product_id;
    END LOOP;
END $$;

-- Make variant_id NOT NULL after backfill
ALTER TABLE inventory ALTER COLUMN variant_id SET NOT NULL;

-- Update unique constraint to include variant_id
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_shop_id_product_id_key;
ALTER TABLE inventory ADD CONSTRAINT inventory_shop_variant_unique UNIQUE (shop_id, variant_id);

-- Add variant_id to stock_movements
ALTER TABLE stock_movements ADD COLUMN variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;

-- Backfill stock_movements variant_id from inventory relationships
UPDATE stock_movements sm
SET variant_id = inv.variant_id
FROM inventory inv
WHERE sm.shop_id = inv.shop_id AND sm.product_id = inv.product_id AND sm.variant_id IS NULL;
