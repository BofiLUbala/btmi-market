-- Repair installations where migration 085 was recorded before its handover
-- audit table was added, then establish one database-owned delivery timeline.
CREATE TABLE IF NOT EXISTS order_handover_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    actor_user_id UUID,
    actor_role VARCHAR(30) NOT NULL,
    action VARCHAR(80) NOT NULL,
    result VARCHAR(30) NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_handover_events_order
ON order_handover_events(order_id, created_at);

CREATE TABLE IF NOT EXISTS delivery_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    delivery_id UUID REFERENCES delivery_packages(id) ON DELETE SET NULL,
    previous_status VARCHAR(50) NOT NULL,
    new_status VARCHAR(50) NOT NULL,
    actor_user_id UUID,
    actor_role VARCHAR(30) NOT NULL DEFAULT 'SYSTEM',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_status_history_order
ON delivery_status_history(order_id, created_at);

CREATE OR REPLACE FUNCTION record_delivery_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    configured_actor_id TEXT;
    configured_actor_role TEXT;
    package_id UUID;
BEGIN
    IF COALESCE(OLD.delivery_status, '') IS NOT DISTINCT FROM COALESCE(NEW.delivery_status, '') THEN
        RETURN NEW;
    END IF;

    configured_actor_id := NULLIF(current_setting('tbk.actor_user_id', true), '');
    configured_actor_role := COALESCE(NULLIF(current_setting('tbk.actor_role', true), ''), 'SYSTEM');
    SELECT id INTO package_id FROM delivery_packages WHERE order_id = NEW.id ORDER BY package_number LIMIT 1;

    INSERT INTO delivery_status_history(
        order_id, delivery_id, previous_status, new_status,
        actor_user_id, actor_role, metadata
    ) VALUES (
        NEW.id, package_id, COALESCE(OLD.delivery_status, ''), COALESCE(NEW.delivery_status, ''),
        CASE WHEN configured_actor_id IS NULL THEN NULL ELSE configured_actor_id::uuid END,
        configured_actor_role,
        jsonb_build_object('order_status', NEW.status::text)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_record_delivery_status_transition ON orders;
CREATE TRIGGER trg_record_delivery_status_transition
AFTER UPDATE OF delivery_status ON orders
FOR EACH ROW EXECUTE FUNCTION record_delivery_status_transition();

