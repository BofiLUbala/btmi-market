-- Migration 041: Add Platform Feature Flags and Global Configuration (Phase 5A)

CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT true,
    scope VARCHAR(30) NOT NULL DEFAULT 'GLOBAL', -- GLOBAL, WEB, ANDROID, BUYER, SELLER, ADMIN
    category VARCHAR(30) NOT NULL DEFAULT 'GENERAL', -- COMMERCE, FINANCE, TECHNICAL, GENERAL
    is_high_risk BOOLEAN NOT NULL DEFAULT false,
    environment VARCHAR(30) NOT NULL DEFAULT 'PRODUCTION',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by UUID
);
CREATE INDEX IF NOT EXISTS idx_feature_flags_category ON feature_flags(category);
CREATE INDEX IF NOT EXISTS idx_feature_flags_scope ON feature_flags(scope);

CREATE TABLE IF NOT EXISTS global_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    value_type VARCHAR(20) NOT NULL DEFAULT 'STRING', -- NUMBER, STRING, BOOLEAN
    value TEXT NOT NULL DEFAULT '',
    category VARCHAR(30) NOT NULL DEFAULT 'GENERAL', -- COMMERCE, FINANCE, TECHNICAL, GENERAL
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by UUID
);
CREATE INDEX IF NOT EXISTS idx_global_configs_category ON global_configs(category);

-- Seed the example feature flags from the Phase 5 spec.
-- All default to enabled=true to preserve current always-on behavior.
INSERT INTO feature_flags (key, description, enabled, scope, category, is_high_risk)
VALUES
    ('REVIEWS_ENABLED', 'Master switch for product and shop reviews platform-wide', true, 'GLOBAL', 'GENERAL', false),
    ('VISUAL_SEARCH_ENABLED', 'Enables the visual (image-based) product search feature', true, 'GLOBAL', 'TECHNICAL', false),
    ('SELLER_PROMOTIONS_ENABLED', 'Enables sellers creating and running promotions', true, 'GLOBAL', 'COMMERCE', false),
    ('BUYER_POINTS_ENABLED', 'Master switch for the buyer points/rewards program', true, 'GLOBAL', 'FINANCE', true),
    ('SHOP_REVIEWS_ENABLED', 'Enables buyers leaving shop-level (service) reviews', true, 'GLOBAL', 'FINANCE', false),
    ('PRODUCT_REVIEWS_ENABLED', 'Enables buyers leaving product reviews', true, 'GLOBAL', 'FINANCE', false),
    ('NEW_SELLER_REGISTRATION_ENABLED', 'Allows new seller account registration', true, 'GLOBAL', 'COMMERCE', true),
    ('ANDROID_ADMIN_ENABLED', 'Enables the Android Admin Control Center app', true, 'ANDROID', 'TECHNICAL', false),
    ('MARKETPLACE_SEARCH_V2_ENABLED', 'Enables the v2 marketplace search/ranking pipeline', true, 'GLOBAL', 'COMMERCE', false)
ON CONFLICT (key) DO NOTHING;

-- Seed a first batch of operational global configuration values.
INSERT INTO global_configs (key, description, value_type, value, category)
VALUES
    ('POINTS_CONVERSION_RATE', 'Currency units required to earn 1 buyer point', 'NUMBER', '100', 'FINANCE'),
    ('STUCK_ORDER_THRESHOLD_HOURS', 'Hours an order can remain unprocessed before flagged as stuck', 'NUMBER', '48', 'COMMERCE'),
    ('DEFAULT_DISPUTE_THRESHOLD', 'Number of disputes before a seller is flagged for review', 'NUMBER', '3', 'FINANCE'),
    ('RISK_ALERT_THRESHOLD', 'Risk score above which a risk event is raised', 'NUMBER', '75', 'FINANCE'),
    ('MIN_SUPPORTED_ANDROID_VERSION', 'Minimum Android app version allowed to authenticate', 'STRING', '1.0.0', 'TECHNICAL')
ON CONFLICT (key) DO NOTHING;
