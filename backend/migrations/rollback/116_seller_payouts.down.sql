DROP TABLE IF EXISTS buyer_refunds;
DROP TABLE IF EXISTS seller_payouts;
DROP TABLE IF EXISTS seller_payout_accounts;
DELETE FROM payment_providers WHERE code = 'AFRIMONEY';
