CREATE TABLE IF NOT EXISTS auth_security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    event_type VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_user_created
    ON auth_security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_security_events_type_created
    ON auth_security_events(event_type, created_at DESC);
