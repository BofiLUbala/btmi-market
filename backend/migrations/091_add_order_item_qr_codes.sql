-- Migration 091: per-ORDER_ITEM QR identities
-- Date: 2026-09-21
--
-- Every ordered item is print-scannable through its own QR code, independent of
-- the per-order delivery package QR. The QR payload is only a signed opaque
-- reference (tbk.oi.<public_reference>.<signature>); all context — product and
-- variant snapshots, shop, order and payment context, the immutable delivery
-- address and the item's own pricing snapshot — is read from the order tables
-- when the reference is resolved. Scanning can therefore never forge what the
-- code resolves to, and a buyer changing their profile address later never
-- changes what an old order's QR returns.

CREATE TABLE IF NOT EXISTS order_item_qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_line_id UUID NOT NULL UNIQUE REFERENCES order_lines(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    public_reference UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_order_item_qr_order ON order_item_qr_codes(order_id);

-- Backfill every existing order line so historical orders are scannable too.
INSERT INTO order_item_qr_codes(order_line_id, order_id)
SELECT ol.id, ol.order_id
FROM order_lines ol
WHERE NOT EXISTS (SELECT 1 FROM order_item_qr_codes q WHERE q.order_line_id = ol.id);