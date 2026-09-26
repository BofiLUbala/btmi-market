-- Buyers and sellers can archive or delete their own notifications to keep
-- their list tidy. Both are soft: archived rows stay queryable in the
-- "archived" view, deleted rows are hidden everywhere but kept for audit.
-- Admin notifications are intentionally excluded — that surface has no
-- archive/delete UI and keeps every alert visible.

ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_user_active
    ON notifications(user_id, created_at DESC)
    WHERE deleted_at IS NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_archived
    ON notifications(user_id, created_at DESC)
    WHERE deleted_at IS NULL AND archived_at IS NOT NULL;
