-- Migration 095: every sold item can be verified at the buyer's door.
-- Date: 2026-09-24
--
-- The courier verifies each product with its label: the variant code (VAR-...) or the
-- per-item code the seller prints from the order (OI-...). Some sold variants never
-- received a code (their product was not published when they were created) and order
-- lines created after migration 091 only got one when the seller opened it. For those
-- orders no code could ever be accepted, whatever the courier typed.

-- Variant codes for everything that has been sold. The status follows the product's
-- publication; verification accepts a revoked code for an item already sold.
INSERT INTO product_qr_codes(product_id, variant_id, status, revoked_at)
SELECT DISTINCT ol.product_id, ol.variant_id,
       CASE WHEN p.publication_status = 'PUBLISHED' THEN 'ACTIVE' ELSE 'REVOKED' END,
       CASE WHEN p.publication_status = 'PUBLISHED' THEN NULL ELSE NOW() END
FROM order_lines ol
JOIN products p ON p.id = ol.product_id
WHERE ol.variant_id IS NOT NULL
ON CONFLICT (product_id, variant_id) DO NOTHING;

-- Item codes for every existing line.
INSERT INTO order_item_qr_codes(order_line_id, order_id)
SELECT ol.id, ol.order_id
FROM order_lines ol
WHERE NOT EXISTS (SELECT 1 FROM order_item_qr_codes q WHERE q.order_line_id = ol.id);

-- And for every new line, as soon as it is written.
CREATE OR REPLACE FUNCTION tbk_create_order_item_qr() RETURNS trigger AS $$
BEGIN
    INSERT INTO order_item_qr_codes(order_line_id, order_id)
    SELECT NEW.id, NEW.order_id
    WHERE NOT EXISTS (SELECT 1 FROM order_item_qr_codes q WHERE q.order_line_id = NEW.id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS order_lines_create_item_qr ON order_lines;
CREATE TRIGGER order_lines_create_item_qr AFTER INSERT ON order_lines
    FOR EACH ROW EXECUTE FUNCTION tbk_create_order_item_qr();
