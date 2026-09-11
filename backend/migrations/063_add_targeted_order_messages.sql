ALTER TABLE order_messages
    ADD COLUMN IF NOT EXISTS recipient_scope VARCHAR(32) NOT NULL DEFAULT 'ALL_PARTICIPANTS',
    ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Administrative senders live in admin_users, while marketplace senders live
-- in users. Keep the UUID plus sender_type discriminator instead of an invalid
-- users-only foreign key.
ALTER TABLE order_messages DROP CONSTRAINT IF EXISTS order_messages_sender_user_id_fkey;

ALTER TABLE order_messages DROP CONSTRAINT IF EXISTS order_messages_recipient_scope_check;
ALTER TABLE order_messages ADD CONSTRAINT order_messages_recipient_scope_check
    CHECK (recipient_scope IN ('BUYER', 'SELLER_OWNER', 'EMPLOYEE', 'ALL_PARTICIPANTS'));

CREATE INDEX IF NOT EXISTS idx_order_messages_recipient_user
    ON order_messages(recipient_user_id) WHERE recipient_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS order_conversation_reads (
    conversation_id UUID NOT NULL REFERENCES order_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);
