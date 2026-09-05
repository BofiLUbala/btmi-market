-- Migration 046: Add country, latitude, longitude to buyer_profiles
ALTER TABLE buyer_profiles
    ADD COLUMN IF NOT EXISTS country VARCHAR(100) NOT NULL DEFAULT 'DRC',
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
