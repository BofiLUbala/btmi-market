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
	// ErrSetupNotPending: the account this activation points at is gone or already active.
	ErrSetupNotPending = errors.New("SETUP_NOT_PENDING")
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

// StartSuperAdminClaim spends a setup code on a SUPER_ADMIN account that is
// created PENDING, in one transaction: the owner only becomes the super admin
// once he follows the link e-mailed to the address he typed (see
// ActivateSuperAdminClaim). The current holder is left untouched until then,
// so a mistyped address or a lost e-mail cannot lock anyone out.
// It returns the new account's id and whether it is the platform's first one.
func (r *AdminRepository) StartSuperAdminClaim(claim SuperAdminClaim) (uuid.UUID, bool, error) {
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

	first := current == uuid.Nil

	var pending uuid.UUID
	err = tx.QueryRow(`
		INSERT INTO admin_users (first_name, last_name, email, password_hash, role, status, mfa_enabled, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW(), NOW())
		RETURNING id`,
		claim.FirstName, claim.LastName, claim.Email, claim.PasswordHash, models.AdminRoleSuperAdmin, models.AdminStatusPending,
	).Scan(&pending)
	if err != nil {
		return uuid.Nil, false, fmt.Errorf("failed to create super admin: %w", err)
	}

	if _, err := tx.Exec(`UPDATE super_admin_setup_claims SET admin_id = $1 WHERE code_hash = $2`, pending, claim.CodeHash); err != nil {
		return uuid.Nil, false, fmt.Errorf("failed to record setup code: %w", err)
	}

	if _, err := tx.Exec(`
		INSERT INTO admin_audit_log (actor_admin_id, actor_role, action, target_type, target_id, reason, created_at)
		VALUES ($1, $2, 'SUPER_ADMIN_SETUP_REQUESTED', 'admin_user', $3, $4, NOW())`,
		pending, models.AdminRoleSuperAdmin, pending.String(),
		"Setup code spent; the account waits for the activation link e-mailed to "+claim.Email); err != nil {
		return uuid.Nil, false, fmt.Errorf("failed to audit setup: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return uuid.Nil, false, fmt.Errorf("failed to finish setup: %w", err)
	}
	return pending, first, nil
}

// CancelSuperAdminClaim undoes a claim whose activation e-mail could not be
// sent: the pending account goes, and the code is free again so the owner can
// retry with a correct address.
func (r *AdminRepository) CancelSuperAdminClaim(pendingID uuid.UUID, codeHash string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start rollback: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.Exec(`DELETE FROM admin_audit_log WHERE target_id = $1 AND action = 'SUPER_ADMIN_SETUP_REQUESTED'`, pendingID.String()); err != nil {
		return fmt.Errorf("failed to drop setup audit: %w", err)
	}
	if _, err := tx.Exec(`DELETE FROM admin_users WHERE id = $1 AND status = $2`, pendingID, models.AdminStatusPending); err != nil {
		return fmt.Errorf("failed to drop pending super admin: %w", err)
	}
	if _, err := tx.Exec(`DELETE FROM super_admin_setup_claims WHERE code_hash = $1`, codeHash); err != nil {
		return fmt.Errorf("failed to free the setup code: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to finish rollback: %w", err)
	}
	return nil
}

// ActivateSuperAdminClaim turns the pending account into the one super admin:
// it goes ACTIVE and every other super admin is deactivated, its sessions
// ended, so the rule that there is only ever one holder still stands.
func (r *AdminRepository) ActivateSuperAdminClaim(pendingID uuid.UUID) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start activation: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	// uq_admin_users_one_active_super_admin allows a single ACTIVE holder, so the
	// previous one has to step down before this account can take the seat.
	var status models.AdminStatus
	if err := tx.QueryRow(`SELECT status FROM admin_users WHERE id = $1 AND role = $2 FOR UPDATE`,
		pendingID, models.AdminRoleSuperAdmin).Scan(&status); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrSetupNotPending
		}
		return fmt.Errorf("failed to read the pending super admin: %w", err)
	}
	if status != models.AdminStatusPending {
		return ErrSetupNotPending
	}

	// session_version + 1 voids the previous holders' access tokens at once.
	if _, err := tx.Exec(`
		UPDATE admin_users
		SET status = $1, session_version = session_version + 1, updated_at = NOW()
		WHERE role = $2 AND id <> $3 AND status = $4`,
		models.AdminStatusDeactivated, models.AdminRoleSuperAdmin, pendingID, models.AdminStatusActive); err != nil {
		return fmt.Errorf("failed to retire the previous super admin: %w", err)
	}
	if _, err := tx.Exec(`
		UPDATE admin_refresh_tokens SET revoked_at = NOW()
		WHERE revoked_at IS NULL AND admin_id IN (SELECT id FROM admin_users WHERE role = $1 AND id <> $2)`,
		models.AdminRoleSuperAdmin, pendingID); err != nil {
		return fmt.Errorf("failed to end previous sessions: %w", err)
	}

	if _, err := tx.Exec(`UPDATE admin_users SET status = $1, updated_at = NOW() WHERE id = $2`,
		models.AdminStatusActive, pendingID); err != nil {
		return fmt.Errorf("failed to activate super admin: %w", err)
	}

	if _, err := tx.Exec(`
		INSERT INTO admin_audit_log (actor_admin_id, actor_role, action, target_type, target_id, reason, created_at)
		VALUES ($1, $2, 'SUPER_ADMIN_SETUP_ACTIVATED', 'admin_user', $3, $4, NOW())`,
		pendingID, models.AdminRoleSuperAdmin, pendingID.String(),
		"Owner activated the super admin account from the e-mailed link"); err != nil {
		return fmt.Errorf("failed to audit activation: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to finish activation: %w", err)
	}
	return nil
}
