-- Product identities become active only when the product is published. Each
-- active variant receives its own opaque signed-token identity as well.
DROP TRIGGER IF EXISTS trg_tbk_create_product_qr ON products;
DROP FUNCTION IF EXISTS tbk_create_product_qr();

CREATE OR REPLACE FUNCTION tbk_sync_product_qr() RETURNS trigger AS $$
BEGIN
  IF NEW.publication_status = 'PUBLISHED' THEN
    INSERT INTO product_qr_codes(product_id)
    SELECT NEW.id
    WHERE NOT EXISTS (
      SELECT 1 FROM product_qr_codes
      WHERE product_id = NEW.id AND variant_id IS NULL
    );
    UPDATE product_qr_codes
    SET status = 'ACTIVE', revoked_at = NULL
    WHERE product_id = NEW.id AND variant_id IS NULL;

    INSERT INTO product_qr_codes(product_id, variant_id)
    SELECT NEW.id, v.id
    FROM product_variants v
    WHERE v.product_id = NEW.id AND v.status = 'ACTIVE'
    ON CONFLICT (product_id, variant_id) DO UPDATE
      SET status = 'ACTIVE', revoked_at = NULL;
  ELSE
    UPDATE product_qr_codes
    SET status = 'REVOKED', revoked_at = COALESCE(revoked_at, NOW())
    WHERE product_id = NEW.id AND status = 'ACTIVE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tbk_sync_product_qr
AFTER INSERT OR UPDATE OF publication_status ON products
FOR EACH ROW EXECUTE FUNCTION tbk_sync_product_qr();

CREATE OR REPLACE FUNCTION tbk_sync_variant_qr() RETURNS trigger AS $$
DECLARE
  published BOOLEAN;
BEGIN
  SELECT publication_status = 'PUBLISHED' INTO published
  FROM products WHERE id = NEW.product_id;

  IF published AND NEW.status = 'ACTIVE' THEN
    INSERT INTO product_qr_codes(product_id, variant_id)
    VALUES (NEW.product_id, NEW.id)
    ON CONFLICT (product_id, variant_id) DO UPDATE
      SET status = 'ACTIVE', revoked_at = NULL;
  ELSE
    UPDATE product_qr_codes
    SET status = 'REVOKED', revoked_at = COALESCE(revoked_at, NOW())
    WHERE product_id = NEW.product_id AND variant_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tbk_sync_variant_qr ON product_variants;
CREATE TRIGGER trg_tbk_sync_variant_qr
AFTER INSERT OR UPDATE OF status ON product_variants
FOR EACH ROW EXECUTE FUNCTION tbk_sync_variant_qr();

-- Align existing identities with the same lifecycle.
UPDATE product_qr_codes q
SET status = 'REVOKED', revoked_at = COALESCE(q.revoked_at, NOW())
FROM products p
WHERE p.id = q.product_id AND p.publication_status <> 'PUBLISHED'
  AND q.status = 'ACTIVE';

INSERT INTO product_qr_codes(product_id)
SELECT p.id FROM products p
WHERE p.publication_status = 'PUBLISHED'
  AND NOT EXISTS (
    SELECT 1 FROM product_qr_codes q
    WHERE q.product_id = p.id AND q.variant_id IS NULL
  );

INSERT INTO product_qr_codes(product_id, variant_id)
SELECT v.product_id, v.id
FROM product_variants v
JOIN products p ON p.id = v.product_id
WHERE p.publication_status = 'PUBLISHED' AND v.status = 'ACTIVE'
ON CONFLICT (product_id, variant_id) DO UPDATE
  SET status = 'ACTIVE', revoked_at = NULL;
