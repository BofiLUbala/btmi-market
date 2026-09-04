-- Migration 040: Add Admin Technical and Security Tables

CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO', -- INFO, WARNING, HIGH, CRITICAL
    actor_id UUID,
    target_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'NEW', -- NEW, ACKNOWLEDGED, RESOLVED, IGNORED
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);

CREATE TABLE IF NOT EXISTS system_health_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL, -- HEALTHY, DEGRADED, DOWN, UNKNOWN
    latency_ms INT DEFAULT 0,
    error_message TEXT,
    checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_events_service ON system_health_events(service_name, checked_at DESC);

CREATE TABLE IF NOT EXISTS app_version_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(50) NOT NULL UNIQUE, -- WEB, ANDROID, API
    current_version VARCHAR(50) NOT NULL,
    min_supported_version VARCHAR(50) NOT NULL,
    recommended_version VARCHAR(50) NOT NULL,
    updated_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Seed initial app version records if not existing
INSERT INTO app_version_configs (platform, current_version, min_supported_version, recommended_version)
VALUES
    ('WEB', '1.4.0', '1.0.0', '1.4.0'),
    ('ANDROID', '1.4.0', '1.2.0', '1.4.0'),
    ('API', 'v1.4.0', 'v1.0.0', 'v1.4.0')
ON CONFLICT (platform) DO NOTHING;
