-- A mobile client can time out waiting for POST /businesses/:id/products after
-- the row has already been committed. Retrying that call must return the same
-- Product instead of creating a second one, so the create request may carry a
-- client-generated key that is unique within the business.
ALTER TABLE products ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_business_idempotency_key
    ON products (business_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
