-- Migration 034: Add discount / offer fields to products and inventory_claimed to orders
ALTER TABLE products ADD COLUMN discount_active BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN discount_type VARCHAR(20) NOT NULL DEFAULT 'NONE';
ALTER TABLE products ADD COLUMN discount_value DECIMAL(15,2) NOT NULL DEFAULT 0.00;
ALTER TABLE products ADD COLUMN discount_start TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE products ADD COLUMN discount_end TIMESTAMP WITH TIME ZONE NULL;

ALTER TABLE orders ADD COLUMN inventory_claimed BOOLEAN NOT NULL DEFAULT FALSE;
