package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
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
		WHERE LOWER(email) = LOWER($1)
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

// EnsureDefaultSuperAdmin bootstraps the initial super administrator if none exists.
func (r *AdminRepository) EnsureDefaultSuperAdmin() error {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM admin_users WHERE role = $1`, models.AdminRoleSuperAdmin).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to count super admins: %w", err)
	}

	if count > 0 {
		return nil
	}

	defaultPassword := "Admin@TBK2025!"
	hash, err := bcrypt.GenerateFromPassword([]byte(defaultPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash default admin password: %w", err)
	}

	superAdmin := &models.AdminUser{
		FirstName:    "Direction",
		LastName:     "SuperAdmin",
		Email:        "admin@tbkmarket.com",
		PasswordHash: string(hash),
		Role:         models.AdminRoleSuperAdmin,
		Status:       models.AdminStatusActive,
		MFAEnabled:   false,
	}

	if err := r.Create(superAdmin); err != nil {
		return fmt.Errorf("failed to create default super admin: %w", err)
	}

	log.Printf("Bootstrap: created initial Super Admin (%s)", superAdmin.Email)
	return nil
}
