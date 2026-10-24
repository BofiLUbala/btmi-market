-- Migration 122: setup codes issued from the console.
-- Date: 2026-10-24
--
-- Until now the one-time super admin setup code only came from the server's
-- SUPER_ADMIN_SETUP_CODE, which meant editing .env and restarting the API to
-- hand a new owner his code. A SUPER_ADMIN can now issue one from the Admin
-- Users page: the code itself is shown once and never stored, only its hash,
-- the same way activation tokens are kept. Whether a code was spent is read
-- from super_admin_setup_claims, so there is one source of truth for that.
CREATE TABLE IF NOT EXISTS super_admin_setup_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code_hash VARCHAR(64) NOT NULL UNIQUE,
    created_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- One live code at a time is the rule the service enforces; this index makes
-- looking the live one up cheap.
CREATE INDEX IF NOT EXISTS idx_super_admin_setup_codes_live
    ON super_admin_setup_codes (expires_at)
    WHERE revoked_at IS NULL;
