-- Migration 115: one explainer video per product.
-- Date: 2026-10-12
--
-- Sellers can attach a short video (filmed in the app or picked from the
-- gallery) next to the product photos. Kept in its own table so product_images
-- and everything that reads it stay untouched.

CREATE TABLE IF NOT EXISTS product_videos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    file_name   VARCHAR(255) NOT NULL DEFAULT '',
    mime_type   VARCHAR(50) NOT NULL DEFAULT 'video/mp4',
    size_bytes  BIGINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
