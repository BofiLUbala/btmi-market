-- Migration 116: split each mobile money payment to its seller.
-- Date: 2026-10-12
--
-- A buyer's mobile payment lands on TBK's Moko merchant account. As soon as the
-- operator confirms it, the seller's share (products total minus TBK's
-- commission) is credited to the seller's own number on the SAME network the
-- buyer paid with. TBK keeps the commission and the delivery fee and pays
-- Moko's fee itself. A refund goes back to the buyer from TBK's account; if the
-- seller was already paid, that amount is clawed back from their next payout.

-- 1. Afrimoney (Africell) joins the operator catalog, disabled until Finance
--    turns it on.
ALTER TABLE payment_providers DROP CONSTRAINT IF EXISTS payment_providers_code_check;
ALTER TABLE payment_providers
    ADD CONSTRAINT payment_providers_code_check
    CHECK (code IN ('MPESA', 'AIRTEL_MONEY', 'ORANGE_MONEY', 'AFRIMONEY'));

INSERT INTO payment_providers (code, label, enabled, display_order)
VALUES ('AFRIMONEY', 'Afrimoney', false, 4)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE buyer_payments DROP CONSTRAINT IF EXISTS buyer_payments_provider_check;
ALTER TABLE buyer_payments
    ADD CONSTRAINT buyer_payments_provider_check
    CHECK (provider IN ('', 'MPESA', 'AIRTEL_MONEY', 'ORANGE_MONEY', 'AFRIMONEY'));

-- 2. Where each business receives its money: one number per network.
CREATE TABLE IF NOT EXISTS seller_payout_accounts (
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    provider    VARCHAR(20) NOT NULL
        CHECK (provider IN ('MPESA', 'AIRTEL_MONEY', 'ORANGE_MONEY', 'AFRIMONEY')),
    phone       VARCHAR(20) NOT NULL,
    updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (business_id, provider)
);

-- 3. Every money movement to a seller. PAYOUT pays an order's seller share;
--    CLAWBACK records an amount a refunded order owes back, deducted from the
--    business's next payout.
CREATE TABLE IF NOT EXISTS seller_payouts (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind               VARCHAR(10) NOT NULL CHECK (kind IN ('PAYOUT', 'CLAWBACK')),
    order_id           UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    business_id        UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    payment_id         UUID REFERENCES buyer_payments(id) ON DELETE SET NULL,
    provider           VARCHAR(20) NOT NULL DEFAULT '',
    phone              VARCHAR(20) NOT NULL DEFAULT '',
    gross_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
    deducted_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
    amount             NUMERIC(14,2) NOT NULL,
    currency           VARCHAR(3) NOT NULL DEFAULT 'USD',
    status             VARCHAR(20) NOT NULL
        CHECK (status IN ('PENDING', 'BLOCKED_NO_ACCOUNT', 'SENT', 'PAID', 'FAILED', 'CANCELLED', 'APPLIED')),
    provider_reference VARCHAR(100) NOT NULL DEFAULT '',
    attempts           INT NOT NULL DEFAULT 0,
    last_error         TEXT NOT NULL DEFAULT '',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at         TIMESTAMPTZ,
    UNIQUE (order_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_seller_payouts_business ON seller_payouts(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_payouts_open ON seller_payouts(status)
    WHERE status IN ('PENDING', 'BLOCKED_NO_ACCOUNT', 'SENT', 'FAILED');

-- 4. Money returned to a buyer from TBK's account.
CREATE TABLE IF NOT EXISTS buyer_refunds (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id           UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    payment_id         UUID REFERENCES buyer_payments(id) ON DELETE SET NULL,
    provider           VARCHAR(20) NOT NULL,
    phone              VARCHAR(20) NOT NULL,
    amount             NUMERIC(14,2) NOT NULL,
    currency           VARCHAR(3) NOT NULL DEFAULT 'USD',
    status             VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'SENT', 'PAID', 'FAILED')),
    provider_reference VARCHAR(100) NOT NULL DEFAULT '',
    attempts           INT NOT NULL DEFAULT 0,
    last_error         TEXT NOT NULL DEFAULT '',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
