-- Migration: Add point redemption and buyer order fields
-- Date: 2026-08-17

-- Add reserved_points to point_accounts
ALTER TABLE point_accounts ADD COLUMN IF NOT EXISTS reserved_points INTEGER DEFAULT 0;

-- Add buyer order fields to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_profile_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS base_total DECIMAL(15,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_used INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_discount_amount DECIMAL(15,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS final_total DECIMAL(15,2) DEFAULT 0;

-- Add price snapshot fields to order_lines
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS base_unit_price DECIMAL(15,2) DEFAULT 0;
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS points_discount_per_unit DECIMAL(15,2) DEFAULT 0;
ALTER TABLE order_lines ADD COLUMN IF NOT EXISTS final_unit_price DECIMAL(15,2) DEFAULT 0;

-- Create index for buyer orders
CREATE INDEX IF NOT EXISTS idx_orders_buyer_profile_id ON orders(buyer_profile_id);