-- TBK runs delivery, so Finance — not each seller — sets what a delivery costs.
-- One platform-wide default, optional per-city overrides, an optional
-- free-delivery threshold, and an append-only history of every change.
-- Each order keeps its own snapshot in orders.delivery_fee_base/final, so a
-- tariff change never rewrites an order already placed.

CREATE TABLE IF NOT EXISTS delivery_fee_settings (
    id                       BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    default_fee              NUMERIC(12,2) NOT NULL DEFAULT 2.00 CHECK (default_fee >= 0),
    currency                 VARCHAR(3)    NOT NULL DEFAULT 'USD',
    free_delivery_threshold  NUMERIC(12,2) CHECK (free_delivery_threshold IS NULL OR free_delivery_threshold > 0),
    updated_by               UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO delivery_fee_settings (id, default_fee, currency)
VALUES (TRUE, 2.00, 'USD')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS delivery_fee_zones (
    city_id     UUID PRIMARY KEY REFERENCES cities(id) ON DELETE CASCADE,
    fee         NUMERIC(12,2) NOT NULL CHECK (fee >= 0),
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by  UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_fee_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope       VARCHAR(20) NOT NULL CHECK (scope IN ('DEFAULT', 'THRESHOLD', 'CITY')),
    city_id     UUID REFERENCES cities(id) ON DELETE SET NULL,
    old_value   NUMERIC(12,2),
    new_value   NUMERIC(12,2),
    reason      TEXT NOT NULL,
    admin_id    UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_delivery_fee_history_created ON delivery_fee_history(created_at DESC);
