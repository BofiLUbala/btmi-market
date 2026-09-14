-- Migration 078: the audit trail behind online payments.
-- A provider webhook is the only thing allowed to mark an online payment paid,
-- so every delivery is recorded: it makes retries idempotent and leaves a trace
-- of calls that failed signature checks.

CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(80) NOT NULL,
    -- The provider's own id for this event: the idempotency key for retries.
    event_id VARCHAR(255) NOT NULL,
    payment_id UUID REFERENCES buyer_payments(id) ON DELETE SET NULL,
    reference VARCHAR(255) NOT NULL DEFAULT '',
    reported_status VARCHAR(40) NOT NULL,
    reported_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
    accepted BOOLEAN NOT NULL DEFAULT FALSE,
    rejection_reason VARCHAR(255) NOT NULL DEFAULT '',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_payment ON payment_webhook_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_created ON payment_webhook_events(created_at DESC);

-- When the buyer asked the provider to charge them, so a stuck PROCESSING
-- payment can be told apart from one that was never initiated.
ALTER TABLE buyer_payments ADD COLUMN IF NOT EXISTS payment_initiated_at TIMESTAMPTZ;
ALTER TABLE buyer_payments ADD COLUMN IF NOT EXISTS payment_failure_reason VARCHAR(255) NOT NULL DEFAULT '';
