-- Migration 118: an account can be created from a phone number alone.
-- Date: 2026-10-18
--
-- Signing in already worked from the phone number and a WhatsApp code
-- (migration 108), but users.email was UNIQUE NOT NULL, so every account
-- still needed an address. A phone-only account now stores NULL instead:
-- Postgres lets a UNIQUE column hold many NULLs, so the constraint goes on
-- rejecting two accounts that share a real address.
--
-- NULL and not '': the empty string is a value, so a second phone-only
-- account would collide on the unique index. The CHECK below makes that
-- mistake impossible rather than leaving it to the callers.
--
-- Readers scan email into a Go string, which cannot hold NULL, so the three
-- queries behind models.User (and the two admin listings that select it raw)
-- now COALESCE it to ''. phone stays UNIQUE NOT NULL, so every row still has
-- exactly one channel that is guaranteed present.

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Only now that the column accepts NULL: any row that slipped in blank has
-- to become NULL before the CHECK below can be trusted.
UPDATE users SET email = NULL WHERE TRIM(email) = '';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_not_blank;
ALTER TABLE users ADD CONSTRAINT users_email_not_blank
    CHECK (email IS NULL OR TRIM(email) <> '');
