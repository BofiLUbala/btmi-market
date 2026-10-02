-- Migration 107: the planned road route of a delivery.
-- Date: 2026-10-01
--
-- One row per order. The courier (or Commerce Admin) confirms a start and a
-- destination on the map; the API asks TomTom for the road route matching the
-- courier's transport and stores it here. When the courier leaves the route,
-- the API recomputes it from the courier's position and bumps reroute_count.
--
-- Each point records where it came from (GPS, typed coordinates, an address
-- found on the map, a pin placed by hand, the buyer's own checkout point):
-- an address TomTom cannot place is never replaced silently by a guess.
--
-- Like the live position, a route change only raises 'location:<order_id>'
-- for the buyer and Commerce Admin streams, never an order event.

CREATE TABLE IF NOT EXISTS delivery_routes (
    order_id         UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
    start_latitude   NUMERIC(10,7) NOT NULL CHECK (start_latitude BETWEEN -90 AND 90),
    start_longitude  NUMERIC(10,7) NOT NULL CHECK (start_longitude BETWEEN -180 AND 180),
    start_source     VARCHAR(20) NOT NULL CHECK (start_source IN ('GPS', 'COORDINATES', 'ADDRESS', 'MAP', 'REROUTE')),
    start_label      TEXT NOT NULL DEFAULT '',
    dest_latitude    NUMERIC(10,7) NOT NULL CHECK (dest_latitude BETWEEN -90 AND 90),
    dest_longitude   NUMERIC(10,7) NOT NULL CHECK (dest_longitude BETWEEN -180 AND 180),
    dest_source      VARCHAR(20) NOT NULL CHECK (dest_source IN ('BUYER_GPS', 'COORDINATES', 'ADDRESS', 'MAP')),
    dest_label       TEXT NOT NULL DEFAULT '',
    travel_mode      VARCHAR(20) NOT NULL,
    geometry         JSONB NOT NULL,
    length_m         REAL NOT NULL,
    duration_s       REAL NOT NULL,
    instructions     JSONB NOT NULL DEFAULT '[]'::jsonb,
    planned_length_m REAL NOT NULL,
    set_by_user_id   UUID NULL REFERENCES users(id),
    set_by_role      VARCHAR(20) NOT NULL CHECK (set_by_role IN ('COURIER', 'COMMERCE_ADMIN', 'SYSTEM')),
    reroute_count    INTEGER NOT NULL DEFAULT 0,
    computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A route change refreshes the buyer's and Commerce Admin's map.
CREATE OR REPLACE FUNCTION tbk_notify_delivery_route() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('tbk_order_events', 'location:' || NEW.order_id::text);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS delivery_routes_notify_event ON delivery_routes;
CREATE TRIGGER delivery_routes_notify_event
    AFTER INSERT OR UPDATE ON delivery_routes
    FOR EACH ROW EXECUTE FUNCTION tbk_notify_delivery_route();
