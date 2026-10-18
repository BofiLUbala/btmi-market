-- Reverting needs every account to hold an address again. Accounts created
-- from a phone number alone have none, so they get a per-row placeholder on
-- .invalid (RFC 2606: the TLD can never resolve, so nothing is ever mailed
-- there) which keeps the UNIQUE index satisfied.

UPDATE users
   SET email = 'no-email+' || id::text || '@invalid'
 WHERE email IS NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_not_blank;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
