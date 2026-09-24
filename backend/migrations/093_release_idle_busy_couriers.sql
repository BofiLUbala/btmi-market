-- Migration 093: release couriers left BUSY after a successful delivery
-- Date: 2026-09-24
--
-- Accepting a mission sets a courier BUSY, but until now only a failed
-- delivery set them back to AVAILABLE. Every courier who completed a delivery
-- stayed BUSY and disappeared from the admin assignment list. The order status
-- transition now releases them; this repairs the couriers already stuck.
--
-- Only BUSY couriers with no mission still in progress are touched, using the
-- same definition of "active mission" as the courier service.

UPDATE couriers c
SET availability = 'AVAILABLE', updated_at = NOW()
WHERE c.availability = 'BUSY'
  AND NOT EXISTS (
      SELECT 1 FROM orders o
      WHERE o.assigned_courier_id = c.user_id
        AND o.delivery_status IN ('COURIER_ASSIGNED', 'COURIER_ACCEPTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION')
        AND o.status NOT IN ('CANCELLED', 'RECEIVED', 'COMPLETED')
  );
