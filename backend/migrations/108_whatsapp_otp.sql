-- Migration 108: sign-up and sign-in confirmed by a WhatsApp one-time code.
-- Date: 2026-10-01
--
-- The registration form is unchanged; the user only picks where the
-- confirmation goes. With WhatsApp, a 6-digit code is sent through the OpenWA
-- gateway to the account phone instead of the e-mailed activation link, and a
-- WhatsApp sign-in (phone + password) is completed by a fresh code as well.
--
--   users.phone_verified   set once a code sent to users.phone was entered;
--                          counts as account verification like email_verified.
--   whatsapp_otp_challenges one row per code sent; only the hash is stored.

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS whatsapp_otp_challenges (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose     VARCHAR(16) NOT NULL CHECK (purpose IN ('SIGNUP', 'LOGIN')),
    phone       VARCHAR(32) NOT NULL,
    code_hash   VARCHAR(64) NOT NULL,
    attempts    INT NOT NULL DEFAULT 0,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_user_open
    ON whatsapp_otp_challenges (user_id, purpose) WHERE used_at IS NULL;
