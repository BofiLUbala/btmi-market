-- 082_align_sale_commission_gross.sql
-- Normalize legacy sale_commissions rows so the reporting invariant
-- GROSS - COMMISSION = SELLER_NET holds. gross_amount is defined as the
-- commission base (products final total, delivery fee excluded). Delivery
-- fees surface separately via buyer_payments.cash_due (collected_cash).
UPDATE sale_commissions
SET gross_amount = commission_base
WHERE status <> 'WAIVED'
  AND commission_base IS NOT NULL
  AND commission_base > 0
  AND gross_amount <> commission_base;