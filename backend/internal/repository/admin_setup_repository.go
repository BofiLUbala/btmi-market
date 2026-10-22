package repository

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

var (
	// ErrSetupCodeUsed: this setup code has already created or taken over the account.
	ErrSetupCodeUsed = errors.New("SETUP_CODE_USED")
	// ErrAdminEmailTaken: another admin account already uses the e-mail address.
	ErrAdminEmailTaken = errors.New("EMAIL_ALREADY_EXISTS")
)

// SuperAdminClaim is what the owner types on the setup screen, password already hashed.
type SuperAdminClaim struct {
	CodeHash     string
	FirstName    string
	LastName     string
	Email        string
	PasswordHash string
}

// IsSetupCodeClaimed reports whether a setup code (by its hash) has been used.
func (r *AdminRepository) IsSetupCodeClaimed(codeHash string) (bool, error) {
	var used bool
	err := r.db.QueryRow(`SELECT EXISTS (SELECT 1 FROM super_admin_setup_claims WHERE code_hash = $1)`, codeHash).Scan(&used)
	if err != nil {
		return false, fmt.Errorf("failed to check setup code: %w", err)
	}
	return used, nil
}

// ClaimSuperAdmin uses a setup code to give the single SUPER_ADMIN account the
// owner's name, e-mail and password, in one transaction. With no active
// SUPER_ADMIN the account is created; otherwise the active one is taken over
// and every session it had is ended, so there is never a second super admin.
// It returns the account id and whether it was created.
func (r *AdminRepository) ClaimSuperAdmin(claim SuperAdminClaim) (uuid.UUID, bool, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return uuid.Nil, false, fmt.Errorf("failed to start setup: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	// The primary key makes this the one claim of the code, even under a race.
	res, err := tx.Exec(`INSERT INTO super_admin_setup_claims (code_hash) VALUES ($1) ON CONFLICT DO NOTHING`, claim.CodeHash)
	if err != nil {
		return uuid.Nil, false, fmt.Errorf("failed to record setup code: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return uuid.Nil, false, ErrSetupCodeUsed
	}

	var current uuid.UUID
	err = tx.QueryRow(`SELECT id FROM admin_users WHERE role = $1 AND status = $2 ORDER BY created_at LIMIT 1 FOR UPDATE`,
		models.AdminRoleSuperAdmin, models.AdminStatusActive).Scan(&current)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return uuid.Nil, false, fmt.Errorf("failed to find super admin: %w", err)
	}

	var taken bool
	if err := tx.QueryRow(`SELECT EXISTS (SELECT 1 FROM admin_users WHERE LOWER(email) = LOWER($1) AND id <> $2)`,
		claim.Email, current).Scan(&taken); err != nil {
		return uuid.Nil, false, fmt.Errorf("failed to check e-mail: %w", err)
	}
	if taken {
		return uuid.Nil, false, ErrAdminEmailTaken
	}

	created := current == uuid.Nil
	if created {
		err = tx.QueryRow(`
			INSERT INTO admin_users (first_name, last_name, email, password_hash, role, status, mfa_enabled, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW(), NOW())
			RETURNING id`,
			claim.FirstName, claim.LastName, claim.Email, claim.PasswordHash, models.AdminRoleSuperAdmin, models.AdminStatusActive,
		).Scan(&current)
		if err != nil {
			return uuid.Nil, false, fmt.Errorf("failed to create super admin: %w", err)
		}
	} else {
		// session_version + 1 voids the previous holder's access tokens.
		if _, err := tx.Exec(`
			UPDATE admin_users
			SET first_name = $1, last_name = $2, email = $3, password_hash = $4,
			    session_version = session_version + 1, updated_at = NOW()
			WHERE id = $5`,
			claim.FirstName, claim.LastName, claim.Email, claim.PasswordHash, current); err != nil {
			return uuid.Nil, false, fmt.Errorf("failed to take over super admin: %w", err)
		}
		if _, err := tx.Exec(`UPDATE admin_refresh_tokens SET revoked_at = NOW() WHERE admin_id = $1 AND revoked_at IS NULL`, current); err != nil {
			return uuid.Nil, false, fmt.Errorf("failed to end previous sessions: %w", err)
		}
	}

	if _, err := tx.Exec(`UPDATE super_admin_setup_claims SET admin_id = $1 WHERE code_hash = $2`, current, claim.CodeHash); err != nil {
		return uuid.Nil, false, fmt.Errorf("failed to record setup code: %w", err)
	}

	action, reason := "SUPER_ADMIN_SETUP_TAKEOVER", "Owner took over the super admin account with a setup code"
	if created {
		action, reason = "SUPER_ADMIN_SETUP_CREATED", "Owner created the super admin account with a setup code"
	}
	if _, err := tx.Exec(`
		INSERT INTO admin_audit_log (actor_admin_id, actor_role, action, target_type, target_id, reason, created_at)
		VALUES ($1, $2, $3, 'admin_user', $4, $5, NOW())`,
		current, models.AdminRoleSuperAdmin, action, current.String(), reason); err != nil {
		return uuid.Nil, false, fmt.Errorf("failed to audit setup: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return uuid.Nil, false, fmt.Errorf("failed to finish setup: %w", err)
	}
	return current, created, nil
}
