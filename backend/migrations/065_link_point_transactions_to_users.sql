-- Every ledger mutation is directly traceable to the authenticated user and,
-- for administrative changes, to the administrator and justification.
ALTER TABLE point_transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE point_transactions ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE point_transactions ADD COLUMN IF NOT EXISTS created_by_admin UUID REFERENCES admin_users(id);

UPDATE point_transactions pt SET user_id = bp.user_id
FROM point_accounts pa JOIN buyer_profiles bp ON pa.owner_type='BUYER' AND pa.owner_id=bp.id
WHERE pt.point_account_id=pa.id AND pt.user_id IS NULL;

UPDATE point_transactions pt SET user_id = owner_membership.user_id
FROM point_accounts pa
JOIN LATERAL (
  SELECT bm.user_id FROM business_memberships bm
  WHERE bm.business_id=pa.owner_id AND bm.role='OWNER' ORDER BY bm.created_at LIMIT 1
) owner_membership ON TRUE
WHERE pt.point_account_id=pa.id AND pa.owner_type='SELLER_BUSINESS' AND pt.user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_point_transactions_user ON point_transactions(user_id, created_at DESC);

-- Non-admin earning/redemption code continues to write the polymorphic owner.
-- Resolve its real user automatically so future ledger rows cannot be orphaned.
CREATE OR REPLACE FUNCTION resolve_point_transaction_user() RETURNS trigger AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT CASE
      WHEN pa.owner_type='BUYER' THEN (SELECT bp.user_id FROM buyer_profiles bp WHERE bp.id=pa.owner_id)
      WHEN pa.owner_type='SELLER_BUSINESS' THEN (SELECT bm.user_id FROM business_memberships bm WHERE bm.business_id=pa.owner_id AND bm.role='OWNER' ORDER BY bm.created_at LIMIT 1)
    END INTO NEW.user_id
    FROM point_accounts pa WHERE pa.id=NEW.point_account_id;
  END IF;
  IF NEW.user_id IS NULL THEN RAISE EXCEPTION 'point transaction cannot resolve to users.id'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_point_transaction_user ON point_transactions;
CREATE TRIGGER trg_point_transaction_user BEFORE INSERT ON point_transactions
FOR EACH ROW EXECUTE FUNCTION resolve_point_transaction_user();
