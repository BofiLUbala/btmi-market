-- 083_backfill_commission_seller_user.sql
-- Backfill seller_user_id on legacy sale_commissions rows from the order's creator.
UPDATE sale_commissions c
SET seller_user_id = o.created_by
FROM orders o
WHERE c.order_id = o.id
  AND c.seller_user_id IS NULL;