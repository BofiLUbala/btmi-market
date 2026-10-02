-- Migration 112: signing an account out everywhere takes effect at once.
-- Date: 2026-10-02
--
-- Revoking refresh tokens alone left every access token already issued valid
-- until it expired (up to ACCESS_TOKEN_TTL minutes): an account the Direction
-- "signed out" kept working and kept showing as active. Access tokens issued
-- at or before this instant are now refused.
--
-- Set by every "revoke all sessions" path (Direction force-logout, password
-- reset, account suspension...). NULL: never revoked.

ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_revoked_at TIMESTAMPTZ NULL;
