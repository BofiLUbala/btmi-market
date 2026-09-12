-- Preserve which courier rejected an assignment after the order is released
-- for reassignment. The operational assigned_courier_id must still be cleared.
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS rejected_by_courier_id UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_orders_rejected_by_courier
    ON orders(rejected_by_courier_id)
    WHERE rejected_by_courier_id IS NOT NULL;
