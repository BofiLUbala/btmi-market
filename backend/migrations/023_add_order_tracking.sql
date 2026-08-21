-- Migration 023: Order Tracking / Point 8
-- Adds new order statuses for tracking lifecycle, order_number reference, and tracking timestamps.

-- Add new enum values for tracking lifecycle
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'READY';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'RECEIVED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'READY_FOR_PICKUP';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'HANDED_TO_PARTNER';

-- Order number for buyer-facing reference (BTMI-XXXXX)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(20);

-- Unique index for order_number (generated on insert)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number) WHERE order_number IS NOT NULL;

-- Tracking timestamps for display and SLA preparation
ALTER TABLE orders ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS out_for_delivery_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1000;

-- Auto-generate order_number for existing orders that don't have one
UPDATE orders SET order_number = 'BTMI-' || nextval('order_number_seq')::text WHERE order_number IS NULL;
