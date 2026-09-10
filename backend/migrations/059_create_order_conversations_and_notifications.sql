-- 059_create_order_conversations_and_notifications.sql
-- Creates tables for order-specific communication channels and automated in-app notifications.

-- 1. Order Conversations (1:1 with orders)
CREATE TABLE IF NOT EXISTS order_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_conversations_order_id ON order_conversations(order_id);
CREATE INDEX IF NOT EXISTS idx_order_conversations_buyer_id ON order_conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_order_conversations_shop_id ON order_conversations(shop_id);
CREATE INDEX IF NOT EXISTS idx_order_conversations_business_id ON order_conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_order_conversations_updated_at ON order_conversations(updated_at DESC);

-- 2. Order Messages
CREATE TABLE IF NOT EXISTS order_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES order_conversations(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_type VARCHAR(32) NOT NULL, -- 'BUYER', 'SELLER', 'EMPLOYEE', 'COMMERCE_ADMIN', 'SUPER_ADMIN', 'SYSTEM'
    sender_name VARCHAR(255) NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    is_admin_intervention BOOLEAN NOT NULL DEFAULT FALSE,
    read_by_buyer_at TIMESTAMPTZ,
    read_by_seller_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_messages_conversation_id ON order_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_created_at ON order_messages(conversation_id, created_at ASC);

-- 3. In-App Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL, -- 'NEW_ORDER', 'ORDER_ACCEPTED', 'ORDER_REJECTED', 'ORDER_PREPARING', 'ORDER_READY_FOR_PICKUP', 'COURIER_ASSIGNED', 'DELIVERED', 'ORDER_COMPLETED', 'ORDER_CANCELLED', 'NEW_MESSAGE', 'PAYMENT_CONFIRMED'
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    reference_type VARCHAR(64) NOT NULL DEFAULT 'ORDER', -- 'ORDER', 'CONVERSATION'
    reference_id UUID NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;
