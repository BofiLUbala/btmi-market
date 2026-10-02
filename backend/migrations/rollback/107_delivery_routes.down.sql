-- Reverses migrations/107_delivery_routes.sql.
--
-- Run manually, then remove the bookkeeping row so the forward migration can be
-- re-applied later:
--   psql ... -f migrations/rollback/107_delivery_routes.down.sql
--
-- Deliveries keep working without it: the route is auxiliary to delivery_status.

BEGIN;

DROP TRIGGER IF EXISTS delivery_routes_notify_event ON delivery_routes;
DROP FUNCTION IF EXISTS tbk_notify_delivery_route();
DROP TABLE IF EXISTS delivery_routes;

DELETE FROM schema_migrations WHERE version = '107_delivery_routes.sql';

COMMIT;
