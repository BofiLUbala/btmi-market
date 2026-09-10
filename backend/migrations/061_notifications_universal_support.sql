-- 061_notifications_universal_support.sql
-- Allow notifications table to store notifications for both regular users (buyers, sellers, couriers) and admin users.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

CREATE INDEX IF NOT EXISTS idx_notifications_reference ON notifications(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_ref ON notifications(user_id, type, reference_id);
