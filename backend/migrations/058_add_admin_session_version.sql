-- Invalidate already-issued admin access tokens after a forced logout.
ALTER TABLE admin_users
    ADD COLUMN IF NOT EXISTS session_version BIGINT NOT NULL DEFAULT 0;
