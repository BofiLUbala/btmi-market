-- Migration 120: remember the language a delivery route was computed in.
-- Date: 2026-10-23
--
-- The turn-by-turn instructions are stored with the route, in the language
-- TomTom was asked for. It was always French, so a courier using the app in
-- English read French directions. The language now comes from the courier's
-- app, and is kept so the automatic reroute (which has no request, hence no
-- app language of its own) recomputes in the same language instead of
-- flipping to French mid-trip. Existing routes were French.
ALTER TABLE delivery_routes
    ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'fr'
    CHECK (language IN ('fr', 'en'));
