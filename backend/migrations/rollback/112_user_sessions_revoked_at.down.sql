-- Reverses migrations/112_user_sessions_revoked_at.sql.
--
-- Run manually, then remove the bookkeeping row so the forward migration can be
-- re-applied later:
--   psql ... -f migrations/rollback/112_user_sessions_revoked_at.down.sql
--
-- Without the column, a sign-out only stops refresh: access tokens already
-- issued keep working until they expire.

BEGIN;

ALTER TABLE users DROP COLUMN IF EXISTS sessions_revoked_at;

DELETE FROM schema_migrations WHERE version = '112_user_sessions_revoked_at.sql';

COMMIT;
