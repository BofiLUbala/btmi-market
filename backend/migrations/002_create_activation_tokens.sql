CREATE TABLE account_activation_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE NULL,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_activation_tokens_user_id ON account_activation_tokens(user_id);
CREATE INDEX idx_activation_tokens_token_hash ON account_activation_tokens(token_hash);
CREATE INDEX idx_activation_tokens_expires_at ON account_activation_tokens(expires_at);
