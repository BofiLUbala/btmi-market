-- Migration 119: one-time codes for the super admin to set up his own account.
-- Date: 2026-10-22
--
-- The platform owner should not wait for the builder to hand over a login.
-- The builder puts SUPER_ADMIN_SETUP_CODE in the server environment and gives
-- the code to the owner, who enters it in the app with his own name, e-mail
-- and password. That creates the SUPER_ADMIN account, or takes over the one
-- that exists, so there is never a second one (migration 076 already allows
-- only one ACTIVE SUPER_ADMIN).
--
-- A code must work once. Only its SHA-256 is kept here; the primary key makes
-- two simultaneous claims of the same code impossible, and a new code in the
-- environment opens a new, single, hand-over.

CREATE TABLE IF NOT EXISTS super_admin_setup_claims (
    code_hash  TEXT PRIMARY KEY,
    admin_id   UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
