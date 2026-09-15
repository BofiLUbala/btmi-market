-- Courier-side handover verification.
--
-- Before this migration only the buyer could verify the physical product against the
-- order. The handover the business actually runs has the courier scan the product QR
-- attached to the package, so product_handover_verifications has to record which role
-- performed the check and which order line it resolved to.

ALTER TABLE product_handover_verifications
    ADD COLUMN IF NOT EXISTS verified_by_role VARCHAR(20) NOT NULL DEFAULT 'BUYER',
    ADD COLUMN IF NOT EXISTS verified_by_user_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS order_line_id UUID REFERENCES order_lines(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS result_code VARCHAR(30) NOT NULL DEFAULT '';

ALTER TABLE product_handover_verifications
    DROP CONSTRAINT IF EXISTS product_handover_verifications_verified_by_role_check;
ALTER TABLE product_handover_verifications
    ADD CONSTRAINT product_handover_verifications_verified_by_role_check
    CHECK (verified_by_role IN ('BUYER','COURIER'));

-- Existing rows were all buyer-side successes/rejections; give them a result code so
-- the column can be read uniformly.
UPDATE product_handover_verifications
SET result_code = CASE WHEN result = 'SUCCESS' THEN 'VALID' ELSE 'INVALID_QR' END
WHERE result_code = '';

-- One successful verification per order line is all the handover needs. A second scan
-- of the same product for the same line is a duplicate, not a new verification, which
-- is what makes re-scanning idempotent rather than additive.
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_handover_line_success
ON product_handover_verifications(order_id, order_line_id)
WHERE result = 'SUCCESS' AND order_line_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_handover_role
ON product_handover_verifications(order_id, verified_by_role, result);

-- The buyer confirms each line of a multi-product order individually: that they have
-- the item in hand, that it is what they ordered, and that the quantity is right.
CREATE TABLE IF NOT EXISTS order_line_receipt_acknowledgements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_line_id UUID NOT NULL REFERENCES order_lines(id) ON DELETE CASCADE,
    buyer_profile_id UUID NOT NULL REFERENCES buyer_profiles(id),
    product_received BOOLEAN NOT NULL DEFAULT FALSE,
    matches_order BOOLEAN NOT NULL DEFAULT FALSE,
    quantity_correct BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (order_id, order_line_id)
);

CREATE INDEX IF NOT EXISTS idx_line_receipt_ack_order
ON order_line_receipt_acknowledgements(order_id);

-- Cash collected at the door is recorded against the courier who took it. It marks the
-- buyer's payment settled; it says nothing about TBK having received its commission,
-- which stays DUE on sale_commissions until Finance collects it.
ALTER TABLE buyer_payments
    ADD COLUMN IF NOT EXISTS cash_received_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS cash_received_at TIMESTAMPTZ;

-- The handover audit trail.
--
-- admin_audit_log cannot hold these events: its actor_admin_id has a foreign key to
-- admin_users, so a courier or buyer id is rejected outright and the row is lost. The
-- handover is performed by exactly those two roles, so it gets its own log, keyed to
-- users, with one row per step: who, in what role, on which order, when.
CREATE TABLE IF NOT EXISTS order_handover_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES users(id),
    actor_role VARCHAR(20) NOT NULL CHECK (actor_role IN ('COURIER','BUYER','SELLER','ADMIN','SYSTEM','PROVIDER')),
    action VARCHAR(60) NOT NULL,
    result VARCHAR(30) NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_handover_events_order
ON order_handover_events(order_id, created_at);
