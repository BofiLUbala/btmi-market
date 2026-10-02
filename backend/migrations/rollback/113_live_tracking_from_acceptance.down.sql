-- Rollback 113: live position only while IN_TRANSIT again.

DROP TRIGGER IF EXISTS orders_stop_live_location ON orders;
CREATE TRIGGER orders_stop_live_location
    AFTER UPDATE OF delivery_status ON orders
    FOR EACH ROW
    WHEN (NEW.delivery_status IS DISTINCT FROM 'IN_TRANSIT')
    EXECUTE FUNCTION tbk_stop_live_location();

DELETE FROM delivery_live_locations l
USING orders o
WHERE o.id = l.order_id AND o.delivery_status IS DISTINCT FROM 'IN_TRANSIT';
