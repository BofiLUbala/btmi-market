-- Migration 123: the super admin setup no longer uses a one-time code.
-- Date: 2026-11-01
--
-- The setup page is open only while the platform has no active super admin, and
-- the account is confirmed by the link e-mailed to the owner. The code tables
-- (119/122) have nothing left to record.
DROP TABLE IF EXISTS super_admin_setup_codes;
DROP TABLE IF EXISTS super_admin_setup_claims;
