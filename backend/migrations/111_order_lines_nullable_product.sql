-- Migration 111: order lines survive the deletion of their product.
-- Date: 2026-10-01
--
-- Migration 081 made order_lines' product/variant FKs ON DELETE SET NULL but
-- left the columns NOT NULL, so deleting any product ever sold failed (e.g.
-- the permanent shop deletion of migration 109). The line keeps its own
-- name/SKU/price/image snapshot; only the link becomes NULL.
ALTER TABLE order_lines ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE order_lines ALTER COLUMN variant_id DROP NOT NULL;
