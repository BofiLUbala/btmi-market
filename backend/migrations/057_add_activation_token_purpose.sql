ALTER TABLE account_activation_tokens
ADD COLUMN IF NOT EXISTS purpose VARCHAR(32) NOT NULL DEFAULT 'ACTIVATION';

CREATE INDEX IF NOT EXISTS idx_activation_tokens_purpose
ON account_activation_tokens(purpose, token_hash);
