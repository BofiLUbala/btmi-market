-- Migration 106: live courier location during a delivery.
-- Date: 2026-09-30
--
-- GPS is auxiliary to the delivery: orders.delivery_status stays the only
-- truth, and a position exists only while that status is IN_TRANSIT. Pings
-- never touch orders (that would raise an order event, and a full reload on
-- every page, every ten seconds); they live in two tables of their own.
--
--   delivery_live_locations  one row per order in transit: the latest point.
--   delivery_location_points thin append-only history, kept 30 days.
--
-- Each new latest point raises NOTIFY 'location:<order_id>' on the order-event
-- channel. The hub forwards it to the buyer and to Commerce Admin streams only;
-- the event carries no coordinates, clients refetch them through the
-- authorised endpoints.

CREATE TABLE IF NOT EXISTS delivery_live_locations (
    order_id        UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
    courier_user_id UUID NOT NULL REFERENCES users(id),
    latitude        NUMERIC(10,7) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude       NUMERIC(10,7) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    accuracy_m      REAL NULL,
    heading_deg     REAL NULL,
    speed_mps       REAL NULL,
    captured_at     TIMESTAMPTZ NOT NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_location_points (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    courier_user_id UUID NOT NULL REFERENCES users(id),
    latitude        NUMERIC(10,7) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude       NUMERIC(10,7) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    accuracy_m      REAL NULL,
    heading_deg     REAL NULL,
    speed_mps       REAL NULL,
    captured_at     TIMESTAMPTZ NOT NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_location_points_order_captured
    ON delivery_location_points (order_id, captured_at);
-- The 30-day retention sweep deletes by age.
CREATE INDEX IF NOT EXISTS idx_delivery_location_points_received
    ON delivery_location_points (received_at);

-- A new latest point: tell the order's buyer and Commerce Admin to refetch.
CREATE OR REPLACE FUNCTION tbk_notify_delivery_location() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('tbk_order_events', 'location:' || NEW.order_id::text);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS delivery_live_locations_notify_event ON delivery_live_locations;
CREATE TRIGGER delivery_live_locations_notify_event
    AFTER INSERT OR UPDATE ON delivery_live_locations
    FOR EACH ROW EXECUTE FUNCTION tbk_notify_delivery_location();

-- Tracking ends the moment the order is no longer IN_TRANSIT, whatever moved
-- it (arrival, failure, buyer not found, return, cancellation, an admin fix,
-- a future code path). Being on the table, it runs in the same transaction as
-- the status change. The courier's write locks the order row FOR SHARE, so a
-- ping racing a transition either lands before it (and is deleted here) or
-- sees the new status and is refused.
CREATE OR REPLACE FUNCTION tbk_stop_live_location() RETURNS trigger AS $$
BEGIN
    DELETE FROM delivery_live_locations WHERE order_id = NEW.id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_stop_live_location ON orders;
CREATE TRIGGER orders_stop_live_location
    AFTER UPDATE OF delivery_status ON orders
    FOR EACH ROW
    WHEN (NEW.delivery_status IS DISTINCT FROM 'IN_TRANSIT')
    EXECUTE FUNCTION tbk_stop_live_location();
