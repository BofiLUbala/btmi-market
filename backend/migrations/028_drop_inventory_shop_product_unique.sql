-- Inventory is tracked per (shop, variant) since migration 012, which added
-- inventory_shop_variant_unique (shop_id, variant_id). The legacy product-level
-- constraint from migration 010 was not dropped and blocks stock for a second
-- variant of the same product in the same shop. Remove it.
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS unique_shop_product;
