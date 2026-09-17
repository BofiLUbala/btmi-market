-- Add pickup_verified_at to orders so the courier mission timeline can record
-- when the courier physically collected the package from the seller.
-- TransitionMission writes this timestamp from the orders scope (like
-- courier_started_at / courier_arrived_at are written on orders).
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS pickup_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_pickup_verified_at
ON orders(pickup_verified_at);