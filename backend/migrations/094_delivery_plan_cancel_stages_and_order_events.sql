-- Migration 094: delivery plan, staged buyer cancellation, return to seller,
-- and database-driven real-time order events.
-- Date: 2026-09-24
--
-- Delivery plan: once the courier has the parcel they commit to a day and a
-- slot; buyer, seller and commerce admin all read it from the order.
--
-- Cancellation: the buyer may now cancel at any stage before the handover.
-- cancelled_stage records which one (NOT_ASSIGNED, COURIER_ASSIGNED,
-- IN_DELIVERY, BUYER_NOT_FOUND). A parcel already collected travels back to the
-- seller (delivery_status RETURNING_TO_SELLER) and only returns to stock once
-- the seller confirms it is back (returned_to_seller_at).
--
-- Real time: every change to an order, its payment or its handover checks
-- raises a NOTIFY carrying the order id. The API listens and pushes the change
-- to the buyer, the seller, the courier and the commerce admins. NOTIFY is
-- delivered on commit only, so nobody is told about a change that rolled back.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS expected_delivery_date DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expected_delivery_slot VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expected_delivery_set_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_stage VARCHAR(30);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS returned_to_seller_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_expected_delivery_slot_check') THEN
        ALTER TABLE orders ADD CONSTRAINT orders_expected_delivery_slot_check
            CHECK (expected_delivery_slot IS NULL OR expected_delivery_slot IN ('MORNING', 'AFTERNOON', 'EVENING'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_cancelled_stage_check') THEN
        ALTER TABLE orders ADD CONSTRAINT orders_cancelled_stage_check
            CHECK (cancelled_stage IS NULL OR cancelled_stage IN ('NOT_ASSIGNED', 'COURIER_ASSIGNED', 'IN_DELIVERY', 'BUYER_NOT_FOUND'));
    END IF;
END $$;

CREATE OR REPLACE FUNCTION tbk_notify_order_row() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('tbk_order_events', NEW.id::text);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION tbk_notify_order_child() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM pg_notify('tbk_order_events', OLD.order_id::text);
    ELSE
        PERFORM pg_notify('tbk_order_events', NEW.order_id::text);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_notify_event ON orders;
CREATE TRIGGER orders_notify_event AFTER INSERT OR UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION tbk_notify_order_row();

DROP TRIGGER IF EXISTS buyer_payments_notify_event ON buyer_payments;
CREATE TRIGGER buyer_payments_notify_event AFTER INSERT OR UPDATE ON buyer_payments
    FOR EACH ROW EXECUTE FUNCTION tbk_notify_order_child();

DROP TRIGGER IF EXISTS product_handover_verifications_notify_event ON product_handover_verifications;
CREATE TRIGGER product_handover_verifications_notify_event AFTER INSERT OR UPDATE ON product_handover_verifications
    FOR EACH ROW EXECUTE FUNCTION tbk_notify_order_child();

DROP TRIGGER IF EXISTS order_line_receipt_acknowledgements_notify_event ON order_line_receipt_acknowledgements;
CREATE TRIGGER order_line_receipt_acknowledgements_notify_event AFTER INSERT OR UPDATE ON order_line_receipt_acknowledgements
    FOR EACH ROW EXECUTE FUNCTION tbk_notify_order_child();

DROP TRIGGER IF EXISTS delivery_packages_notify_event ON delivery_packages;
CREATE TRIGGER delivery_packages_notify_event AFTER INSERT OR UPDATE ON delivery_packages
    FOR EACH ROW EXECUTE FUNCTION tbk_notify_order_child();
