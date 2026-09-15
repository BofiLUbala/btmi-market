-- Cash at delivery is confirmed by the assigned courier at the physical handover.
--
-- Before this migration a cash payment was settled by a two-sided "declaration"
-- ritual: the buyer declared they had paid, the seller declared they had received,
-- and the pair of flags moved the payment to VERIFIED. Neither actor is present at
-- the door, so neither one is evidence that money changed hands. The courier is.
--
-- The declaration columns stay for the rows that were written under the old rule -
-- Finance still has to be able to read that history - but nothing writes them again.

-- Who settled the payment, and when. confirmation_actor names the authority, so a
-- cash settlement can never be mistaken for a provider one in an audit.
ALTER TABLE buyer_payments
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS confirmed_by_user_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS confirmation_actor VARCHAR(20) NOT NULL DEFAULT '';

ALTER TABLE buyer_payments
    DROP CONSTRAINT IF EXISTS buyer_payments_confirmation_actor_check;
ALTER TABLE buyer_payments
    ADD CONSTRAINT buyer_payments_confirmation_actor_check
    CHECK (confirmation_actor IN ('', 'COURIER', 'PROVIDER', 'ADMIN', 'LEGACY_DECLARATION'));

-- Backfill: a settled row already carries the facts, they were just spread across
-- three columns. Cash taken by a courier is attributed to that courier; an online
-- payment to its provider; anything else settled under the old double-declaration
-- is marked as such rather than being dressed up as a courier confirmation.
UPDATE buyer_payments
SET paid_at = COALESCE(paid_at, cash_received_at, verified_at),
    confirmed_by_user_id = COALESCE(confirmed_by_user_id, cash_received_by),
    confirmation_actor = CASE
        WHEN cash_received_by IS NOT NULL THEN 'COURIER'
        WHEN payment_method <> 'CASH_ON_DELIVERY' AND provider_reference <> '' THEN 'PROVIDER'
        ELSE 'LEGACY_DECLARATION'
    END
WHERE status IN ('VERIFIED', 'PAID') AND confirmation_actor = '';

-- PAID is the settled status from here on. VERIFIED remains readable everywhere it
-- already is, so historical rows keep their meaning and no report has to be rewritten.
CREATE INDEX IF NOT EXISTS idx_buyer_payments_confirmation_actor
ON buyer_payments(confirmation_actor)
WHERE confirmation_actor <> '';
