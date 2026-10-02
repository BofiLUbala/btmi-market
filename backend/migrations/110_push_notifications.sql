-- Push notifications (web + mobile), per-category preferences, explicit
-- marketing consent and server-side followed products.
--
-- A "principal" is whoever a notification is written for: a regular user
-- (users.id) or an admin (admin_users.id). The two live in separate tables, so
-- every row here carries principal_kind to keep them apart.

-- 1. Devices that can receive push. A web subscription is identified by its
-- endpoint, a mobile one by its Expo push token. Either is a capability URL /
-- token owned by one device, so it is unique: when another account signs in on
-- the same device, the row moves to that account instead of being duplicated.
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_kind   VARCHAR(10) NOT NULL CHECK (principal_kind IN ('USER', 'ADMIN')),
    principal_id     UUID NOT NULL,
    platform         VARCHAR(10) NOT NULL CHECK (platform IN ('WEB', 'EXPO')),
    endpoint         TEXT,
    p256dh           TEXT,
    auth_secret      TEXT,
    expo_token       TEXT,
    vapid_key_id     VARCHAR(64),
    device_label     VARCHAR(160) NOT NULL DEFAULT '',
    user_agent       TEXT NOT NULL DEFAULT '',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_success_at  TIMESTAMPTZ,
    failure_count    INT NOT NULL DEFAULT 0,
    -- A subscription stops receiving once revoked_at is in the past. It can be
    -- set slightly in the future so a security alert still reaches the device
    -- that is being signed out.
    revoked_at       TIMESTAMPTZ,
    revoked_reason   VARCHAR(64),
    CHECK ((platform = 'WEB' AND endpoint IS NOT NULL AND p256dh IS NOT NULL AND auth_secret IS NOT NULL)
        OR (platform = 'EXPO' AND expo_token IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_push_subscriptions_endpoint ON push_subscriptions(endpoint) WHERE endpoint IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_push_subscriptions_expo_token ON push_subscriptions(expo_token) WHERE expo_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_principal ON push_subscriptions(principal_kind, principal_id);

-- 2. Outbox: one row per (notification, device). The dispatcher claims due
-- rows, sends them and records the outcome; failures are retried with backoff.
CREATE TABLE IF NOT EXISTS push_deliveries (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id  UUID NOT NULL,
    subscription_id  UUID NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
    -- Pushes sharing a key (same order and audience, same conversation...)
    -- replace each other while still pending, so a burst becomes one alert.
    coalesce_key     VARCHAR(200) NOT NULL DEFAULT '',
    priority         VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
    status           VARCHAR(16) NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'FAILED', 'EXPIRED', 'SUPERSEDED', 'SKIPPED')),
    attempts         INT NOT NULL DEFAULT 0,
    next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at       TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
    last_error       TEXT,
    ticket_id        VARCHAR(100),
    receipt_checked_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at          TIMESTAMPTZ,
    UNIQUE (notification_id, subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_push_deliveries_due ON push_deliveries(next_attempt_at) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_push_deliveries_coalesce ON push_deliveries(subscription_id, coalesce_key, created_at DESC) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_push_deliveries_receipts ON push_deliveries(sent_at) WHERE ticket_id IS NOT NULL AND receipt_checked_at IS NULL;

-- 3. Preferences per category. A missing row means the category default
-- (see notify.DefaultPush). consented_at records explicit opt-in for the
-- categories that require it (WATCHLIST, MARKETING).
CREATE TABLE IF NOT EXISTS notification_preferences (
    principal_kind   VARCHAR(10) NOT NULL CHECK (principal_kind IN ('USER', 'ADMIN')),
    principal_id     UUID NOT NULL,
    category         VARCHAR(20) NOT NULL,
    push_enabled     BOOLEAN NOT NULL,
    in_app_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    consented_at     TIMESTAMPTZ,
    consent_source   VARCHAR(40),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (principal_kind, principal_id, category)
);

-- 4. Products a buyer follows (their favourites, mirrored server-side). The
-- snapshot columns hold what was last announced, so a sweep only alerts on a
-- real change.
CREATE TABLE IF NOT EXISTS product_watches (
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id         UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_price         NUMERIC(14, 2),
    last_in_stock      BOOLEAN,
    last_alert_at      TIMESTAMPTZ,
    PRIMARY KEY (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_watches_product ON product_watches(product_id);

-- 5. Seller stock-out alerts are sent once per rupture: a row exists while
-- the variant is out of stock in that shop and is removed once it is back.
CREATE TABLE IF NOT EXISTS stock_out_alerts (
    shop_id     UUID NOT NULL,
    variant_id  UUID NOT NULL,
    alerted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (shop_id, variant_id)
);

-- 6. Server-wide push settings (generated VAPID key pair when none is
-- configured through the environment, so every API instance signs alike).
CREATE TABLE IF NOT EXISTS push_settings (
    key        VARCHAR(64) PRIMARY KEY,
    value      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Category lookups for frequency caps (marketing, watchlist).
CREATE INDEX IF NOT EXISTS idx_notifications_user_category_created
    ON notifications(user_id, (metadata->>'category'), created_at DESC);
