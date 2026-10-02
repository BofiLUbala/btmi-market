-- Migration 113: the buyer follows the courier from the moment the mission is
-- accepted, not only once the parcel is on its way.
-- Date: 2026-10-02
--
-- Tracking now covers COURIER_ACCEPTED, READY_FOR_PICKUP, PICKED_UP and
-- IN_TRANSIT (models.LiveTrackingStatuses). The live position is still
-- dropped, in the same transaction, the moment the order leaves those
-- statuses (arrival, failure, return, cancellation, unassignment...).

DROP TRIGGER IF EXISTS orders_stop_live_location ON orders;
CREATE TRIGGER orders_stop_live_location
    AFTER UPDATE OF delivery_status ON orders
    FOR EACH ROW
    WHEN (NEW.delivery_status IS NULL
          OR NEW.delivery_status NOT IN ('COURIER_ACCEPTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT'))
    EXECUTE FUNCTION tbk_stop_live_location();
