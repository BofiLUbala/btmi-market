-- 084_backfill_commission_seller_user_owner.sql
-- Backfill seller_user_id on legacy sale_commissions rows from the business
-- OWNER membership (the authoritative seller identity).
UPDATE sale_commissions c
SET seller_user_id = (
  SELECT bm.user_id
  FROM business_memberships bm
  WHERE bm.business_id = c.business_id
    AND bm.role = 'OWNER'
    AND (bm.status = 'ACTIVE' OR bm.status IS NULL)
  ORDER BY bm.joined_at ASC
  LIMIT 1
)
WHERE c.seller_user_id IS NULL AND c.business_id IS NOT NULL;