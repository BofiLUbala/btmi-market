-- Migration 080: USD becomes the canonical selling currency.
--
-- Currency used to be implicit: products carried a bare amount and everything
-- downstream assumed CDF in some places and the business default in others.
-- Every money-bearing row now says which currency it is in, and an order keeps
-- that answer forever so a later price or config change cannot reinterpret it.
--
-- Existing rows are labelled USD without any conversion: the amounts are left
-- byte-for-byte as they are. No exchange rate is invented anywhere in this file.

ALTER TABLE products ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE shops ADD COLUMN IF NOT EXISTS delivery_fee_currency VARCHAR(3) NOT NULL DEFAULT 'USD';

-- Finance sets a fixed markup as an amount, so it needs a currency of its own;
-- a percentage markup is currency-free and ignores this column.
ALTER TABLE payment_method_configs ADD COLUMN IF NOT EXISTS markup_currency VARCHAR(3) NOT NULL DEFAULT 'USD';

-- These two defaulted to CDF, which is how "CDF" ended up hardcoded in the
-- payment snapshot. New rows follow the order they belong to.
ALTER TABLE buyer_payments ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE verified_transactions ALTER COLUMN currency SET DEFAULT 'USD';

-- Label the existing test data as USD, leaving every amount untouched.
UPDATE products SET currency = 'USD' WHERE currency IS NULL OR currency = '';
UPDATE orders SET currency = 'USD' WHERE currency IS NULL OR currency = '';
UPDATE buyer_payments SET currency = 'USD' WHERE currency = 'CDF';
UPDATE verified_transactions SET currency = 'USD' WHERE currency = 'CDF';
UPDATE payment_method_configs SET markup_currency = 'USD' WHERE markup_currency IS NULL OR markup_currency = '';
UPDATE businesses SET default_currency = 'USD' WHERE default_currency = 'CDF';

-- Added after the backfill so it validates against real rows, and guarded so a
-- re-run cannot fail on a duplicate constraint name.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_currency_check') THEN
        ALTER TABLE products ADD CONSTRAINT products_currency_check CHECK (currency IN ('USD', 'CDF'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_currency_check') THEN
        ALTER TABLE orders ADD CONSTRAINT orders_currency_check CHECK (currency IN ('USD', 'CDF'));
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_products_currency ON products(currency);

-- Commission rows are amounts too: they must say which currency they are in
-- rather than inheriting an assumption from whoever reads the report.
ALTER TABLE sale_commissions ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD';
UPDATE sale_commissions SET currency = 'USD' WHERE currency IS NULL OR currency = '';
