-- Preserve historical Super Admin rows while enforcing one effective authority.
-- Bootstrap and Admin Management additionally enforce the friendly service rule.
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_users_one_active_super_admin
ON admin_users ((role))
WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE';
