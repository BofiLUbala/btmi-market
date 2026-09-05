package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type AdminRepository struct {
	db *database.DB
}

func NewAdminRepository(db *database.DB) *AdminRepository {
	return &AdminRepository{db: db}
}

func (r *AdminRepository) Create(admin *models.AdminUser) error {
	query := `
		INSERT INTO admin_users (
			first_name, last_name, email, password_hash, role, status, mfa_enabled, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at
	`
	now := time.Now()
	return r.db.QueryRow(
		query,
		admin.FirstName,
		admin.LastName,
		admin.Email,
		admin.PasswordHash,
		admin.Role,
		admin.Status,
		admin.MFAEnabled,
		now,
		now,
	).Scan(&admin.ID, &admin.CreatedAt, &admin.UpdatedAt)
}

func (r *AdminRepository) GetByID(id uuid.UUID) (*models.AdminUser, error) {
	query := `
		SELECT id, first_name, last_name, email, password_hash, role, status, mfa_enabled, last_login_at, created_at, updated_at
		FROM admin_users
		WHERE id = $1
	`
	admin := &models.AdminUser{}
	err := r.db.QueryRow(query, id).Scan(
		&admin.ID,
		&admin.FirstName,
		&admin.LastName,
		&admin.Email,
		&admin.PasswordHash,
		&admin.Role,
		&admin.Status,
		&admin.MFAEnabled,
		&admin.LastLoginAt,
		&admin.CreatedAt,
		&admin.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errors.New("admin not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get admin by id: %w", err)
	}
	return admin, nil
}

func (r *AdminRepository) GetByEmail(email string) (*models.AdminUser, error) {
	query := `
		SELECT id, first_name, last_name, email, password_hash, role, status, mfa_enabled, last_login_at, created_at, updated_at
		FROM admin_users
		WHERE LOWER(email) = LOWER($1) OR (LOWER($1) = 'admin@tbkmarket.com' AND LOWER(email) = 'admin@tbk.market')
	`
	admin := &models.AdminUser{}
	err := r.db.QueryRow(query, email).Scan(
		&admin.ID,
		&admin.FirstName,
		&admin.LastName,
		&admin.Email,
		&admin.PasswordHash,
		&admin.Role,
		&admin.Status,
		&admin.MFAEnabled,
		&admin.LastLoginAt,
		&admin.CreatedAt,
		&admin.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errors.New("admin not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get admin by email: %w", err)
	}
	return admin, nil
}

func (r *AdminRepository) UpdateLastLogin(id uuid.UUID) error {
	query := `UPDATE admin_users SET last_login_at = $1, updated_at = $1 WHERE id = $2`
	_, err := r.db.Exec(query, time.Now(), id)
	return err
}

// List returns a paginated, filterable list of admin control-center accounts
// (i.e. admin_users rows), excluding platform end-users entirely.
func (r *AdminRepository) List(roleFilter, statusFilter, search string, limit, offset int) ([]*models.AdminUser, int, error) {
	conditions := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if roleFilter != "" {
		conditions = append(conditions, fmt.Sprintf("role = $%d", argIdx))
		args = append(args, roleFilter)
		argIdx++
	}
	if statusFilter != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, statusFilter)
		argIdx++
	}
	if search != "" {
		conditions = append(conditions, fmt.Sprintf("(LOWER(email) LIKE LOWER($%d) OR LOWER(first_name) LIKE LOWER($%d) OR LOWER(last_name) LIKE LOWER($%d))", argIdx, argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	whereClause := strings.Join(conditions, " AND ")

	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM admin_users WHERE %s", whereClause)
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count admin users: %w", err)
	}

	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(`
		SELECT id, first_name, last_name, email, password_hash, role, status, mfa_enabled, last_login_at, created_at, updated_at
		FROM admin_users
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list admin users: %w", err)
	}
	defer rows.Close()

	var admins []*models.AdminUser
	for rows.Next() {
		a := &models.AdminUser{}
		if err := rows.Scan(
			&a.ID, &a.FirstName, &a.LastName, &a.Email, &a.PasswordHash,
			&a.Role, &a.Status, &a.MFAEnabled, &a.LastLoginAt, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan admin user row: %w", err)
		}
		admins = append(admins, a)
	}

	return admins, total, nil
}

// UpdateStatus transitions an admin_users row to a new status (ACTIVE, SUSPENDED, PENDING, ...).
func (r *AdminRepository) UpdateStatus(id uuid.UUID, status models.AdminStatus) error {
	query := `UPDATE admin_users SET status = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(query, status, id)
	return err
}

// UpdateRole changes the role of an admin_users row.
func (r *AdminRepository) UpdateRole(id uuid.UUID, role models.AdminRole) error {
	query := `UPDATE admin_users SET role = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(query, role, id)
	return err
}

// ActivateWithPassword transitions a PENDING admin to ACTIVE and sets its password hash,
// used when an invited admin completes account activation.
func (r *AdminRepository) ActivateWithPassword(id uuid.UUID, passwordHash string) error {
	query := `UPDATE admin_users SET password_hash = $1, status = $2, updated_at = NOW() WHERE id = $3`
	_, err := r.db.Exec(query, passwordHash, models.AdminStatusActive, id)
	return err
}

// UpdatePassword updates the password hash and ensures active status for the given admin ID.
func (r *AdminRepository) UpdatePassword(id uuid.UUID, passwordHash string) error {
	query := `UPDATE admin_users SET password_hash = $1, status = $2, updated_at = NOW() WHERE id = $3`
	_, err := r.db.Exec(query, passwordHash, models.AdminStatusActive, id)
	return err
}

func (r *AdminRepository) CreateRefreshToken(token *models.AdminRefreshToken) error {
	query := `
		INSERT INTO admin_refresh_tokens (
			admin_id, token_hash, expires_at, ip_address, user_agent, created_at
		) VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`
	return r.db.QueryRow(
		query,
		token.AdminID,
		token.TokenHash,
		token.ExpiresAt,
		token.IPAddress,
		token.UserAgent,
		time.Now(),
	).Scan(&token.ID, &token.CreatedAt)
}

func (r *AdminRepository) GetRefreshToken(tokenHash string) (*models.AdminRefreshToken, error) {
	query := `
		SELECT id, admin_id, token_hash, expires_at, revoked_at, ip_address, user_agent, created_at
		FROM admin_refresh_tokens
		WHERE token_hash = $1
	`
	token := &models.AdminRefreshToken{}
	err := r.db.QueryRow(query, tokenHash).Scan(
		&token.ID,
		&token.AdminID,
		&token.TokenHash,
		&token.ExpiresAt,
		&token.RevokedAt,
		&token.IPAddress,
		&token.UserAgent,
		&token.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errors.New("refresh token not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get admin refresh token: %w", err)
	}
	return token, nil
}

func (r *AdminRepository) RevokeRefreshToken(id uuid.UUID) error {
	query := `UPDATE admin_refresh_tokens SET revoked_at = $1 WHERE id = $2`
	_, err := r.db.Exec(query, time.Now(), id)
	return err
}

func (r *AdminRepository) RevokeAllRefreshTokensForAdmin(adminID uuid.UUID) error {
	query := `UPDATE admin_refresh_tokens SET revoked_at = $1 WHERE admin_id = $2 AND revoked_at IS NULL`
	_, err := r.db.Exec(query, time.Now(), adminID)
	return err
}

// CountSuperAdmins returns the number of accounts with SUPER_ADMIN role.
func (r *AdminRepository) CountSuperAdmins() (int, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM admin_users WHERE role = $1`, models.AdminRoleSuperAdmin).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count super admins: %w", err)
	}
	return count, nil
}

// CountActiveSuperAdmins returns the number of active accounts with SUPER_ADMIN role.
func (r *AdminRepository) CountActiveSuperAdmins() (int, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM admin_users WHERE role = $1 AND status = $2`, models.AdminRoleSuperAdmin, models.AdminStatusActive).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count active super admins: %w", err)
	}
	return count, nil
}

// GetFirstSuperAdmin returns the first SUPER_ADMIN account found in the database.
func (r *AdminRepository) GetFirstSuperAdmin() (*models.AdminUser, error) {
	query := `
		SELECT id, first_name, last_name, email, password_hash, role, status, mfa_enabled, last_login_at, created_at, updated_at
		FROM admin_users
		WHERE role = $1
		ORDER BY created_at ASC
		LIMIT 1
	`
	admin := &models.AdminUser{}
	err := r.db.QueryRow(query, models.AdminRoleSuperAdmin).Scan(
		&admin.ID,
		&admin.FirstName,
		&admin.LastName,
		&admin.Email,
		&admin.PasswordHash,
		&admin.Role,
		&admin.Status,
		&admin.MFAEnabled,
		&admin.LastLoginAt,
		&admin.CreatedAt,
		&admin.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errors.New("super admin not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get super admin: %w", err)
	}
	return admin, nil
}

// UpdateSuperAdminCredentials updates first_name, last_name, email, and password_hash for the specified SUPER_ADMIN account.
func (r *AdminRepository) UpdateSuperAdminCredentials(id uuid.UUID, firstName, lastName, email, passwordHash string) error {
	query := `
		UPDATE admin_users
		SET first_name = $1, last_name = $2, email = $3, password_hash = $4, status = $5, updated_at = NOW()
		WHERE id = $6 AND role = $7
	`
	res, err := r.db.Exec(query, firstName, lastName, email, passwordHash, models.AdminStatusActive, id, models.AdminRoleSuperAdmin)
	if err != nil {
		return fmt.Errorf("failed to update super admin credentials: %w", err)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return errors.New("super admin not found or role is not SUPER_ADMIN")
	}
	return nil
}

// ValidateSuperAdminProtection ensures that the invariant "at least one ACTIVE SUPER_ADMIN remains" is respected.
func (r *AdminRepository) ValidateSuperAdminProtection(targetAdminID uuid.UUID, newRole models.AdminRole, newStatus models.AdminStatus) error {
	admin, err := r.GetByID(targetAdminID)
	if err != nil {
		return err
	}
	if admin.Role == models.AdminRoleSuperAdmin && admin.Status == models.AdminStatusActive {
		// If changing role away from SUPER_ADMIN or changing status away from ACTIVE:
		if newRole != models.AdminRoleSuperAdmin || newStatus != models.AdminStatusActive {
			activeCount, err := r.CountActiveSuperAdmins()
			if err != nil {
				return err
			}
			if activeCount <= 1 {
				return errors.New("cannot modify, downgrade, or deactivate the last remaining active SUPER_ADMIN")
			}
		}
	}
	return nil
}

