-- Migration 105: real-time stock and cash events.
-- Date: 2026-09-30
--
-- Every change to a shop's stock (restock, goods-in note, sale, order
-- reservation or release, cancellation) and to its cash (session opened,
-- closed or reconciled, takings recorded) raises a NOTIFY on the same channel
-- as order events, carrying only "stock:<business_id>" or "cash:<business_id>".
-- The API's hub pushes it to the members of that business, whose pages then
-- refetch through their normal, authorised endpoints. Being on the table
-- itself, it covers every code path, present and future. NOTIFY is delivered
-- on commit only and identical payloads in one transaction are merged, so a
-- goods-in note with many lines is one event.

CREATE OR REPLACE FUNCTION tbk_notify_business_change() RETURNS trigger AS $$
DECLARE
    biz uuid;
BEGIN
    IF TG_OP = 'DELETE' THEN
        biz := OLD.business_id;
    ELSE
        biz := NEW.business_id;
    END IF;
    IF biz IS NOT NULL THEN
        PERFORM pg_notify('tbk_order_events', TG_ARGV[0] || ':' || biz::text);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inventory_notify_event ON inventory;
CREATE TRIGGER inventory_notify_event AFTER INSERT OR UPDATE OR DELETE ON inventory
    FOR EACH ROW EXECUTE FUNCTION tbk_notify_business_change('stock');

DROP TRIGGER IF EXISTS cash_sessions_notify_event ON cash_sessions;
CREATE TRIGGER cash_sessions_notify_event AFTER INSERT OR UPDATE OR DELETE ON cash_sessions
    FOR EACH ROW EXECUTE FUNCTION tbk_notify_business_change('cash');

DROP TRIGGER IF EXISTS cash_payments_notify_event ON cash_payments;
CREATE TRIGGER cash_payments_notify_event AFTER INSERT OR UPDATE OR DELETE ON cash_payments
    FOR EACH ROW EXECUTE FUNCTION tbk_notify_business_change('cash');
