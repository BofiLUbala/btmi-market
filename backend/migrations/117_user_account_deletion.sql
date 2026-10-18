-- Migration 117: let a user delete their own account (App Store rule 5.1.1(v)).
-- The users row is kept, because orders, payments and audit records reference
-- it. Personal data is overwritten and the account can no longer sign in.

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
