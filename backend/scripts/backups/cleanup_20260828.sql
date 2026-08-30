-- BTMI mock/test data cleanup — 2026-08-28
-- Keeps only real accounts/businesses; removes everything else.
-- Full DB backup taken first: btmi_market_backup_20260828_151601.sql

BEGIN;

-- Keep sets
CREATE TEMP TABLE keep_users AS
  SELECT id FROM users WHERE email IN (
    'johnsonimpoke@gmail.com',
    'bofigauthier3@gmail.com',
    'bofibendedji@gmail.com'
  );

CREATE TEMP TABLE keep_biz AS
  SELECT id FROM businesses WHERE id IN (
    '34f536ff-c14c-4a57-a933-930518d428e2', -- Bofi Pharma
    '5eaaa271-4fcd-492b-8e57-40b2dc4a72e7'  -- Bofi Ecom
  );

CREATE TEMP TABLE keep_buyer_profiles AS
  SELECT id FROM buyer_profiles WHERE user_id IN (SELECT id FROM keep_users);

CREATE TEMP TABLE drop_test_products AS
  SELECT id FROM products WHERE name = 'BTMI Stock Test T-Shirt';

-- 1. review_history for reviews about to be dropped, and for any changed_by outside keep set
DELETE FROM review_history WHERE review_id IN (
  SELECT id FROM seller_reviews WHERE business_id NOT IN (SELECT id FROM keep_biz)
) OR changed_by NOT IN (SELECT id FROM keep_users);

-- 2. point_transactions depending on point_accounts we are about to drop
DELETE FROM point_transactions WHERE point_account_id IN (
  SELECT id FROM point_accounts
  WHERE (owner_type = 'BUSINESS' AND owner_id NOT IN (SELECT id FROM keep_biz))
     OR (owner_type = 'BUYER_PROFILE' AND owner_id NOT IN (SELECT id FROM keep_buyer_profiles))
);

DELETE FROM point_accounts
  WHERE (owner_type = 'BUSINESS' AND owner_id NOT IN (SELECT id FROM keep_biz))
     OR (owner_type = 'BUYER_PROFILE' AND owner_id NOT IN (SELECT id FROM keep_buyer_profiles));

-- 3. Rows with NO ACTION FKs into businesses/shops/orders/buyer_profiles that would
--    block cascading deletes below
DELETE FROM verified_transactions WHERE business_id NOT IN (SELECT id FROM keep_biz)
   OR buyer_profile_id NOT IN (SELECT id FROM keep_buyer_profiles);
DELETE FROM purchase_confirmations WHERE order_id IN (
    SELECT id FROM orders WHERE business_id NOT IN (SELECT id FROM keep_biz)
  ) OR buyer_profile_id NOT IN (SELECT id FROM keep_buyer_profiles);
DELETE FROM buyer_payments WHERE business_id NOT IN (SELECT id FROM keep_biz)
   OR buyer_profile_id NOT IN (SELECT id FROM keep_buyer_profiles);
DELETE FROM cash_payments WHERE business_id NOT IN (SELECT id FROM keep_biz);
DELETE FROM cash_sessions WHERE business_id NOT IN (SELECT id FROM keep_biz);
DELETE FROM seller_trust WHERE business_id NOT IN (SELECT id FROM keep_biz);
DELETE FROM shop_review_aggregates WHERE shop_id IN (
  SELECT id FROM shops WHERE business_id NOT IN (SELECT id FROM keep_biz)
);
DELETE FROM seller_reviews WHERE business_id NOT IN (SELECT id FROM keep_biz)
   OR buyer_profile_id NOT IN (SELECT id FROM keep_buyer_profiles);

-- 4. Buyer profiles for non-real users
DELETE FROM buyer_profiles WHERE user_id NOT IN (SELECT id FROM keep_users);

-- 5. Businesses not in the keep set — cascades shops, employees, products,
--    orders, inventory, memberships, stock movements/receipts, product_images
DELETE FROM businesses WHERE id NOT IN (SELECT id FROM keep_biz);

-- 6. Test-named product sitting inside a real business
DELETE FROM products WHERE id IN (SELECT id FROM drop_test_products);

-- 7. Users not in the keep set — cascades tokens, memberships, review replies/votes
DELETE FROM users WHERE id NOT IN (SELECT id FROM keep_users);

COMMIT;
