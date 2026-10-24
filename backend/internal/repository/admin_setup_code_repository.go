package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// IssuedSetupCode is a setup code handed out from the console. The code itself
// is never stored: only its hash, like every other single-use token here.
type IssuedSetupCode struct {
	ID        uuid.UUID
	CreatedBy *uuid.UUID
	CreatedAt time.Time
	ExpiresAt time.Time
	// Claimed is read from super_admin_setup_claims, the one place that says
	// whether a code was spent.
	Claimed bool
}

// IssueSetupCode revokes whatever code was live and records the new one, so
// there is never more than one code that opens the setup.
func (r *AdminRepository) IssueSetupCode(codeHash string, createdBy uuid.UUID, expiresAt time.Time) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start issuing: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.Exec(`UPDATE super_admin_setup_codes SET revoked_at = NOW() WHERE revoked_at IS NULL`); err != nil {
		return fmt.Errorf("failed to revoke the previous code: %w", err)
	}
	if _, err := tx.Exec(`
		INSERT INTO super_admin_setup_codes (code_hash, created_by_admin_id, expires_at)
		VALUES ($1, $2, $3)`, codeHash, createdBy, expiresAt); err != nil {
		return fmt.Errorf("failed to record the code: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to finish issuing: %w", err)
	}
	return nil
}

// LiveSetupCode returns the code that is still open, if there is one: not
// revoked, not expired and not already spent.
func (r *AdminRepository) LiveSetupCode() (*IssuedSetupCode, error) {
	var code IssuedSetupCode
	err := r.db.QueryRow(`
		SELECT c.id, c.created_by_admin_id, c.created_at, c.expires_at
		FROM super_admin_setup_codes c
		WHERE c.revoked_at IS NULL
		  AND c.expires_at > NOW()
		  AND NOT EXISTS (SELECT 1 FROM super_admin_setup_claims s WHERE s.code_hash = c.code_hash)
		ORDER BY c.created_at DESC
		LIMIT 1`).Scan(&code.ID, &code.CreatedBy, &code.CreatedAt, &code.ExpiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to read the setup code: %w", err)
	}
	return &code, nil
}

// SetupCodeIsLive reports whether this hash is a code the console issued and
// that is still open.
func (r *AdminRepository) SetupCodeIsLive(codeHash string) (bool, error) {
	var live bool
	err := r.db.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM super_admin_setup_codes
			WHERE code_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
		)`, codeHash).Scan(&live)
	if err != nil {
		return false, fmt.Errorf("failed to check the setup code: %w", err)
	}
	return live, nil
}

// RevokeSetupCodes closes every live code without issuing another.
func (r *AdminRepository) RevokeSetupCodes() error {
	if _, err := r.db.Exec(`UPDATE super_admin_setup_codes SET revoked_at = NOW() WHERE revoked_at IS NULL`); err != nil {
		return fmt.Errorf("failed to revoke the setup code: %w", err)
	}
	return nil
}
