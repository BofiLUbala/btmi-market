-- Mobile money, multi-shop checkout, and the paper trail behind a payment.
--
-- Three things were conflated before this migration:
--
--   1. WHICH operator the buyer pays with was read off the Finance method config,
--      so every MOBILE_PAY_NOW payment in the platform necessarily used the same
--      one. The buyer's real choice - M-Pesa vs Airtel vs Orange - had nowhere to
--      live. It lives here now, on the payment itself, drawn from a catalog.
--   2. WHEN they pay (now / at the door) was already modelled correctly by
--      payment_method_configs.timing, but the two mobile methods shipped disabled
--      and provider-less, so checkout could only ever offer cash.
--   3. An order belonged to exactly one shop, which is right, but a buyer with two
--      shops' products in one cart had no object representing "the one checkout
--      those orders came from". checkout_groups is that object.

-- ---------------------------------------------------------------------------
-- 1. Provider catalog
-- ---------------------------------------------------------------------------
-- Normalised codes, one row per operator. The catalog is a table rather than an
-- enum so Finance can turn an operator off the day it stops settling, without a
-- deploy, and so a provider can never be spelled two ways across the system.
CREATE TABLE IF NOT EXISTS payment_providers (
    code          VARCHAR(30) PRIMARY KEY,
    label         VARCHAR(80) NOT NULL,
    enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    modified_by   UUID REFERENCES users(id),
    CONSTRAINT payment_providers_code_check
        CHECK (code IN ('MPESA', 'AIRTEL_MONEY', 'ORANGE_MONEY'))
);

INSERT INTO payment_providers (code, label, enabled, display_order) VALUES
    ('MPESA',        'M-Pesa',       TRUE, 1),
    ('AIRTEL_MONEY', 'Airtel Money', TRUE, 2),
    ('ORANGE_MONEY', 'Orange Money', TRUE, 3)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. The payment's own provider, reference and proof
-- ---------------------------------------------------------------------------
-- internal_reference is ours and is allocated before we ever call the operator,
-- so a charge that is started but never answered is still traceable from our
-- side. provider_reference stays the operator's own id for it.
ALTER TABLE buyer_payments
    ADD COLUMN IF NOT EXISTS internal_reference VARCHAR(64) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS payer_phone        VARCHAR(40) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS receipt_reference  VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS receipt_issued_at  TIMESTAMPTZ,
    -- Whatever the operator echoed back that is safe to keep. Never credentials,
    -- never a PIN, never a full account number: this is read by admins in a
    -- support screen.
    ADD COLUMN IF NOT EXISTS provider_metadata  JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Legacy rows carry free-text provider names from the config column. Fold the
-- recognisable ones onto the normalised codes before the constraint lands, and
-- blank anything unrecognisable rather than inventing an operator for it.
UPDATE buyer_payments SET provider = 'MPESA'
    WHERE provider <> '' AND upper(provider) LIKE '%PESA%';
UPDATE buyer_payments SET provider = 'AIRTEL_MONEY'
    WHERE provider <> '' AND upper(provider) LIKE '%AIRTEL%';
UPDATE buyer_payments SET provider = 'ORANGE_MONEY'
    WHERE provider <> '' AND upper(provider) LIKE '%ORANGE%';
UPDATE buyer_payments SET provider = ''
    WHERE provider NOT IN ('', 'MPESA', 'AIRTEL_MONEY', 'ORANGE_MONEY');

-- Cash has no operator, so '' is the honest value for it rather than a sentinel
-- that reads like one.
ALTER TABLE buyer_payments DROP CONSTRAINT IF EXISTS buyer_payments_provider_check;
ALTER TABLE buyer_payments
    ADD CONSTRAINT buyer_payments_provider_check
    CHECK (provider IN ('', 'MPESA', 'AIRTEL_MONEY', 'ORANGE_MONEY'));

-- A cash payment carrying an operator would corrupt every cash-vs-mobile split
-- Finance reads. Forbid that shape outright. The converse (a mobile payment with
-- no operator yet) stays legal on purpose: legacy rows predate the catalog, and
-- the service layer is what requires an operator on new mobile payments.
ALTER TABLE buyer_payments DROP CONSTRAINT IF EXISTS buyer_payments_method_provider_check;
ALTER TABLE buyer_payments
    ADD CONSTRAINT buyer_payments_method_provider_check
    CHECK (payment_method <> 'CASH_ON_DELIVERY' OR provider = '');

CREATE INDEX IF NOT EXISTS idx_buyer_payments_provider
    ON buyer_payments(provider) WHERE provider <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_buyer_payments_internal_reference
    ON buyer_payments(internal_reference) WHERE internal_reference <> '';

-- ---------------------------------------------------------------------------
-- 3. Checkout groups (multi-shop)
-- ---------------------------------------------------------------------------
-- An order still belongs to exactly one shop - that is what makes a seller's
-- order list, inventory reservation and commission unambiguous. A checkout group
-- is the buyer's side of the same event: one cart, one address, one payment
-- decision, fanned out to one order per shop. Finance can therefore answer both
-- "what did this buyer check out" and "what does Shop A owe commission on"
-- without either question borrowing the other's numbers.
CREATE TABLE IF NOT EXISTS checkout_groups (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_profile_id UUID NOT NULL REFERENCES buyer_profiles(id),
    currency         VARCHAR(10) NOT NULL DEFAULT 'USD',
    shop_count       INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS checkout_group_id UUID REFERENCES checkout_groups(id);

CREATE INDEX IF NOT EXISTS idx_orders_checkout_group
    ON orders(checkout_group_id) WHERE checkout_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_checkout_groups_buyer
    ON checkout_groups(buyer_profile_id);

-- ---------------------------------------------------------------------------
-- 4. Payment audit trail
-- ---------------------------------------------------------------------------
-- Every step that moves money or decides how money will move, in the order it
-- happened. payment_webhook_events already records what a provider sent us; this
-- records what we did about it, plus the steps no provider is involved in at all
-- (method chosen, operator chosen, cash taken at the door, commission computed).
CREATE TABLE IF NOT EXISTS payment_audit_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id  UUID REFERENCES buyer_payments(id) ON DELETE SET NULL,
    order_id    UUID REFERENCES orders(id) ON DELETE SET NULL,
    event_type  VARCHAR(40) NOT NULL,
    actor_type  VARCHAR(20) NOT NULL DEFAULT '',
    actor_id    UUID REFERENCES users(id),
    provider    VARCHAR(30) NOT NULL DEFAULT '',
    amount      NUMERIC(15,2),
    currency    VARCHAR(10) NOT NULL DEFAULT '',
    reference   VARCHAR(255) NOT NULL DEFAULT '',
    detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_audit_payment ON payment_audit_events(payment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_audit_order   ON payment_audit_events(order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_audit_type    ON payment_audit_events(event_type, created_at);

-- ---------------------------------------------------------------------------
-- 5. Turn the mobile methods on
-- ---------------------------------------------------------------------------
-- These shipped disabled because a method could not name an operator, which made
-- them unusable. Now that the operator comes from the buyer's own selection and
-- is validated against the catalog above, the methods are meaningful. Finance can
-- still disable any of them from the payment-config screen.
--
-- The legacy per-method `provider` column is deliberately left blank: a method no
-- longer implies an operator, so a value there would only ever be a stale default.
UPDATE payment_method_configs
SET enabled = TRUE, updated_at = now()
WHERE code IN ('MOBILE_PAY_NOW', 'MOBILE_AT_DELIVERY');
