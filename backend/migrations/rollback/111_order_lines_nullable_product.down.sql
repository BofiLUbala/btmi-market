-- Fails if lines of deleted products exist; those must be removed first.
ALTER TABLE order_lines ALTER COLUMN product_id SET NOT NULL;
ALTER TABLE order_lines ALTER COLUMN variant_id SET NOT NULL;
