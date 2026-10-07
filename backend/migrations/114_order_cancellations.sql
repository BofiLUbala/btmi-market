-- Migration 114: who cancelled an order, and why.
-- Date: 2026-10-07
--
-- One row per cancelled order: the actor's role (BUYER, SELLER, COURIER,
-- ADMIN or SYSTEM), the user when known, the reason they gave and the stage
-- the order had reached. Buyers and sellers must give a reason; buyers,
-- sellers and admins all see it on the order.

CREATE TABLE IF NOT EXISTS order_cancellations (
    order_id     UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
    cancelled_by_role VARCHAR(20) NOT NULL
        CHECK (cancelled_by_role IN ('BUYER', 'SELLER', 'COURIER', 'ADMIN', 'SYSTEM')),
    cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reason       VARCHAR(500) NOT NULL DEFAULT '',
    stage        VARCHAR(30),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders cancelled before this table existed: rebuilt from their history.
INSERT INTO order_cancellations (order_id, cancelled_by_role, cancelled_by, reason, stage, created_at)
SELECT DISTINCT ON (h.order_id)
       h.order_id,
       CASE
           WHEN h.notes ILIKE '%by buyer%' THEN 'BUYER'
           WHEN h.notes ILIKE '%by seller%' THEN 'SELLER'
           WHEN h.notes ILIKE '%buyer not found%' THEN 'COURIER'
           ELSE 'SYSTEM'
       END,
       NULL,
       '',
       o.cancelled_stage,
       h.created_at
FROM order_status_history h
JOIN orders o ON o.id = h.order_id
WHERE h.status = 'CANCELLED'
ORDER BY h.order_id, h.created_at DESC
ON CONFLICT (order_id) DO NOTHING;
