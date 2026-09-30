-- Reverses migrations/106_delivery_live_locations.sql.
--
-- Run manually, then remove the bookkeeping row so the forward migration can be
-- re-applied later:
--   psql ... -f migrations/rollback/106_delivery_live_locations.down.sql
--
-- Deliveries keep working without it: GPS is auxiliary to delivery_status.

BEGIN;

DROP TRIGGER IF EXISTS orders_stop_live_location ON orders;
DROP FUNCTION IF EXISTS tbk_stop_live_location();
DROP TRIGGER IF EXISTS delivery_live_locations_notify_event ON delivery_live_locations;
DROP FUNCTION IF EXISTS tbk_notify_delivery_location();
DROP TABLE IF EXISTS delivery_location_points;
DROP TABLE IF EXISTS delivery_live_locations;

DELETE FROM schema_migrations WHERE version = '106_delivery_live_locations.sql';

COMMIT;
