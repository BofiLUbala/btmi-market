-- Reverses migrations/105_stock_cash_realtime.sql.
--
-- Run manually, then remove the bookkeeping row so the forward migration can be
-- re-applied later:
--   psql ... -f migrations/rollback/105_stock_cash_realtime.down.sql
--
-- Pages keep working without it: they fall back to their slow polling.

BEGIN;

DROP TRIGGER IF EXISTS inventory_notify_event ON inventory;
DROP TRIGGER IF EXISTS cash_sessions_notify_event ON cash_sessions;
DROP TRIGGER IF EXISTS cash_payments_notify_event ON cash_payments;
DROP FUNCTION IF EXISTS tbk_notify_business_change();

DELETE FROM schema_migrations WHERE version = '105_stock_cash_realtime.sql';

COMMIT;
