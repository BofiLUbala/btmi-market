-- Migration 121: a phone-only account can be deleted too (App Store 5.1.1(v)).
-- Date: 2026-10-23
--
-- Migration 118 let an account exist with a phone number alone. Such an
-- account stores a password_hash derived from random bytes that are thrown
-- away immediately, so its holder has no password to type -- and the deletion
-- endpoint asked for exactly that, which made those accounts impossible to
-- erase. Apple does not accept that.
--
-- Two things are needed. First, a way to tell the two kinds apart: a hash the
-- user chose from a placeholder nobody knows. Comparing the hash cannot do it,
-- so the fact is recorded as a column. Second, the replacement proof -- a code
-- sent to the account's own number -- needs its own OTP purpose, otherwise a
-- login code could be replayed to delete the account.

-- TRUE for every existing row: an account registered through the form has a
-- password its holder picked.
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_password BOOLEAN NOT NULL DEFAULT TRUE;

-- Phone-only accounts are exactly the rows migration 118 made possible: the
-- registration form requires an address, and only createPhoneOnlyUser leaves
-- email NULL. Their hash is the discarded placeholder, so they get FALSE.
UPDATE users SET has_password = FALSE WHERE email IS NULL;

-- DELETE_ACCOUNT codes are kept apart from SIGNUP and LOGIN so one cannot
-- stand in for the other: the partial unique index on (user_id, purpose)
-- already keeps a single open code per purpose.
ALTER TABLE whatsapp_otp_challenges DROP CONSTRAINT IF EXISTS whatsapp_otp_challenges_purpose_check;
ALTER TABLE whatsapp_otp_challenges ADD CONSTRAINT whatsapp_otp_challenges_purpose_check
    CHECK (purpose IN ('SIGNUP', 'LOGIN', 'DELETE_ACCOUNT'));
