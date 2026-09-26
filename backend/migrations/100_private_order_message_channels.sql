-- Order messages become private two-party channels. Every message has one
-- sender party and one recipient party (BUYER, SELLER, COURIER, ADMIN) and is
-- readable only by those two parties. Allowed pairs are enforced by the
-- service: buyer<->admin, buyer<->courier, seller<->admin, seller<->courier,
-- courier<->admin. Buyer<->seller is not a channel.

ALTER TABLE order_messages
    ADD COLUMN IF NOT EXISTS sender_party VARCHAR(16),
    ADD COLUMN IF NOT EXISTS recipient_party VARCHAR(16),
    ADD COLUMN IF NOT EXISTS recipient_read_at TIMESTAMPTZ;

UPDATE order_messages SET sender_party = CASE
        WHEN sender_type = 'BUYER' THEN 'BUYER'
        WHEN sender_type IN ('SELLER', 'EMPLOYEE') THEN 'SELLER'
        WHEN sender_type = 'COURIER' THEN 'COURIER'
        ELSE 'ADMIN'
    END
WHERE sender_party IS NULL;

-- History: buyer and seller wrote to each other; admin messages keep the
-- person they targeted. Admin "all participants" broadcasts stay admin-only.
UPDATE order_messages SET recipient_party = CASE
        WHEN sender_party = 'BUYER' THEN 'SELLER'
        WHEN sender_party = 'SELLER' THEN 'BUYER'
        WHEN recipient_scope = 'BUYER' THEN 'BUYER'
        WHEN recipient_scope IN ('SELLER_OWNER', 'EMPLOYEE') THEN 'SELLER'
        ELSE 'ADMIN'
    END
WHERE recipient_party IS NULL;

UPDATE order_messages SET recipient_read_at = CASE
        WHEN recipient_party = 'BUYER' THEN read_by_buyer_at
        WHEN recipient_party = 'SELLER' THEN read_by_seller_at
    END
WHERE recipient_read_at IS NULL AND recipient_party IN ('BUYER', 'SELLER');

ALTER TABLE order_messages ALTER COLUMN sender_party SET NOT NULL;
ALTER TABLE order_messages ALTER COLUMN recipient_party SET NOT NULL;

ALTER TABLE order_messages DROP CONSTRAINT IF EXISTS order_messages_party_check;
ALTER TABLE order_messages ADD CONSTRAINT order_messages_party_check
    CHECK (sender_party IN ('BUYER', 'SELLER', 'COURIER', 'ADMIN')
       AND recipient_party IN ('BUYER', 'SELLER', 'COURIER', 'ADMIN'));

ALTER TABLE order_messages DROP CONSTRAINT IF EXISTS order_messages_recipient_scope_check;
ALTER TABLE order_messages ADD CONSTRAINT order_messages_recipient_scope_check
    CHECK (recipient_scope IN ('BUYER', 'SELLER_OWNER', 'EMPLOYEE', 'COURIER', 'ADMIN', 'ALL_PARTICIPANTS'));

CREATE INDEX IF NOT EXISTS idx_order_messages_parties
    ON order_messages(conversation_id, sender_party, recipient_party);
CREATE INDEX IF NOT EXISTS idx_order_messages_unread_recipient
    ON order_messages(recipient_party, conversation_id) WHERE recipient_read_at IS NULL;

-- A new message wakes the order's open screens at once. The event names only
-- the order; each client refetches through its own party-filtered endpoint.
CREATE OR REPLACE FUNCTION tbk_notify_order_message() RETURNS trigger AS $$
DECLARE
    oid UUID;
BEGIN
    SELECT order_id INTO oid FROM order_conversations WHERE id = NEW.conversation_id;
    IF oid IS NOT NULL THEN
        PERFORM pg_notify('tbk_order_events', oid::text);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS order_messages_notify_event ON order_messages;
CREATE TRIGGER order_messages_notify_event AFTER INSERT ON order_messages
    FOR EACH ROW EXECUTE FUNCTION tbk_notify_order_message();
