-- Rollback of migration 121. Open DELETE_ACCOUNT codes are closed first,
-- otherwise the narrowed CHECK cannot be re-applied.
DELETE FROM whatsapp_otp_challenges WHERE purpose = 'DELETE_ACCOUNT';

ALTER TABLE whatsapp_otp_challenges DROP CONSTRAINT IF EXISTS whatsapp_otp_challenges_purpose_check;
ALTER TABLE whatsapp_otp_challenges ADD CONSTRAINT whatsapp_otp_challenges_purpose_check
    CHECK (purpose IN ('SIGNUP', 'LOGIN'));

ALTER TABLE users DROP COLUMN IF EXISTS has_password;
