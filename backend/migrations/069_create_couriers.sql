-- Migration 069: Create couriers and courier_invitations tables
-- Links courier profiles to existing users table via user_id

-- Courier profile table
CREATE TABLE IF NOT EXISTS couriers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED')),
    availability VARCHAR(20) NOT NULL DEFAULT 'UNAVAILABLE' CHECK (availability IN ('AVAILABLE', 'UNAVAILABLE', 'BUSY')),
    transport_type VARCHAR(50),
    vehicle_info VARCHAR(255),
    service_zone VARCHAR(100),
    activated_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    suspension_reason VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_couriers_user_id ON couriers(user_id);
CREATE INDEX IF NOT EXISTS idx_couriers_status ON couriers(status);
CREATE INDEX IF NOT EXISTS idx_couriers_availability ON couriers(availability);

-- Courier invitation tokens
CREATE TABLE IF NOT EXISTS courier_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    transport_type VARCHAR(50),
    vehicle_info VARCHAR(255),
    service_zone VARCHAR(100),
    token_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    invited_by UUID REFERENCES admin_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for token lookups
CREATE INDEX IF NOT EXISTS idx_courier_invitations_token_hash ON courier_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_courier_invitations_email ON courier_invitations(email);
CREATE INDEX IF NOT EXISTS idx_courier_invitations_status ON courier_invitations(status);

-- Add courier_accept_reject columns to orders if not exists
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_accepted_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_rejected_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_rejection_reason VARCHAR(500);

-- Delivery status tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_started_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_arrived_at TIMESTAMPTZ;

-- Failed delivery reason
ALTER TABLE orders ADD COLUMN IF NOT EXISTS failed_delivery_reason VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS failed_delivery_notes VARCHAR(500);
