-- Kept separate so databases that applied the first version of migration 065
-- also receive the user-resolution invariant.
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
