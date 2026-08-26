package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type UserRepository struct {
	db *database.DB
}

func NewUserRepository(db *database.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(user *models.User) error {
	query := `
		INSERT INTO users (id, first_name, middle_name, last_name, phone, email, password_hash, status, email_verified, account_type)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING created_at, updated_at
	`

	user.ID = uuid.New()
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()

	if user.AccountType == "" {
		user.AccountType = models.AccountTypeBuyer
	}

	return r.db.QueryRow(query,
		user.ID, user.FirstName, user.MiddleName, user.LastName,
		user.Phone, user.Email, user.PasswordHash,
		user.Status, user.EmailVerified, user.AccountType,
	).Scan(&user.CreatedAt, &user.UpdatedAt)
}

func (r *UserRepository) GetByID(id uuid.UUID) (*models.User, error) {
	query := `
		SELECT id, first_name, middle_name, last_name, phone, email, password_hash, status, email_verified, account_type, created_at, updated_at
		FROM users WHERE id = $1
	`

	user := &models.User{}
	err := r.db.QueryRow(query, id).Scan(
		&user.ID, &user.FirstName, &user.MiddleName, &user.LastName,
		&user.Phone, &user.Email, &user.PasswordHash,
		&user.Status, &user.EmailVerified, &user.AccountType, &user.CreatedAt, &user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	if err != nil {
		return nil, err
	}

	return user, nil
}

func (r *UserRepository) GetByEmail(email string) (*models.User, error) {
	query := `
		SELECT id, first_name, middle_name, last_name, phone, email, password_hash, status, email_verified, account_type, created_at, updated_at
		FROM users WHERE LOWER(email) = LOWER($1)
	`

	user := &models.User{}
	err := r.db.QueryRow(query, email).Scan(
		&user.ID, &user.FirstName, &user.MiddleName, &user.LastName,
		&user.Phone, &user.Email, &user.PasswordHash,
		&user.Status, &user.EmailVerified, &user.AccountType, &user.CreatedAt, &user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	if err != nil {
		return nil, err
	}

	return user, nil
}

func (r *UserRepository) GetByPhone(phone string) (*models.User, error) {
	query := `
		SELECT id, first_name, middle_name, last_name, phone, email, password_hash, status, email_verified, account_type, created_at, updated_at
		FROM users
		WHERE phone = $1
		   OR RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 9) =
		      RIGHT(regexp_replace($1, '[^0-9]', '', 'g'), 9)
		ORDER BY CASE WHEN phone = $1 THEN 0 ELSE 1 END
		LIMIT 1
	`

	user := &models.User{}
	err := r.db.QueryRow(query, phone).Scan(
		&user.ID, &user.FirstName, &user.MiddleName, &user.LastName,
		&user.Phone, &user.Email, &user.PasswordHash,
		&user.Status, &user.EmailVerified, &user.AccountType, &user.CreatedAt, &user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	if err != nil {
		return nil, err
	}

	return user, nil
}

func (r *UserRepository) UpdateStatus(id uuid.UUID, status models.UserStatus) error {
	query := `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(query, status, id)
	return err
}

func (r *UserRepository) UpdateEmailVerified(id uuid.UUID, verified bool) error {
	query := `UPDATE users SET email_verified = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(query, verified, id)
	return err
}

func (r *UserRepository) EmailExists(email string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`
	err := r.db.QueryRow(query, email).Scan(&exists)
	return exists, err
}

func (r *UserRepository) PhoneExists(phone string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM users WHERE phone = $1)`
	err := r.db.QueryRow(query, phone).Scan(&exists)
	return exists, err
}

func (r *UserRepository) UpdatePassword(id uuid.UUID, passwordHash string) error {
	query := `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(query, passwordHash, id)
	return err
}
