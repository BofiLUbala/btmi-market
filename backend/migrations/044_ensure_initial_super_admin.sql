-- Migration 044: Ensure initial SUPER_ADMIN exists (Idempotent Bootstrap)
-- If no SUPER_ADMIN exists in admin_users, bootstrap the inaugural active SUPER_ADMIN account
-- matching the developer bootstrap architecture. If one or more already exist, skip cleanly.

DO $$
DECLARE
    v_admin_id UUID := uuid_generate_v4();
    v_existing_count INT;
BEGIN
    SELECT COUNT(*) INTO v_existing_count FROM admin_users WHERE role = 'SUPER_ADMIN';
    
    IF v_existing_count = 0 THEN
        INSERT INTO admin_users (
            id,
            first_name,
            last_name,
            email,
            password_hash,
            role,
            status,
            mfa_enabled,
            created_at,
            updated_at
        ) VALUES (
            v_admin_id,
            'Gauthier',
            'Bofi',
            'admin@tbk.market',
            '$2a$10$IRJE0aHSjYHjtszcAVANbOHgRaYJd52S3uyDMSA/V1kDFsb9x.K/m',
            'SUPER_ADMIN',
            'ACTIVE',
            FALSE,
            NOW(),
            NOW()
        );

        INSERT INTO admin_audit_log (
            actor_admin_id,
            actor_role,
            action,
            target_type,
            target_id,
            reason,
            created_at
        ) VALUES (
            v_admin_id,
            'SUPER_ADMIN',
            'SUPER_ADMIN_BOOTSTRAP_CREATED',
            'admin_user',
            v_admin_id::text,
            'Initial automated bootstrap of first Super Admin',
            NOW()
        );
    END IF;
END $$;
