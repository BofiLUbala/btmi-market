-- Migration 047: TBK Centralized Delivery & Courier Assignment
-- Date: 2026-09-05

-- 1. Add courier assignment and TBK delivery tracking fields to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_courier_id UUID REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(50) DEFAULT 'PENDING_TBK_ASSIGNMENT';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_latitude NUMERIC(10,7);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_longitude NUMERIC(10,7);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_assigned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_notes TEXT DEFAULT '';

-- 2. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_orders_assigned_courier ON orders(assigned_courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON orders(delivery_status);

-- 3. Set default delivery_status for existing orders that have delivery selected
UPDATE orders
SET delivery_status = 'PENDING_TBK_ASSIGNMENT'
WHERE delivery_status IS NULL OR delivery_status = '';
