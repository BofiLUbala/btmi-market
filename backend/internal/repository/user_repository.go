package repository

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// ErrUserNotFound is returned when no row matches. Callers that must tell
// "nobody has this number" apart from "the database is down" test for it;
// phone sign-in does, because it registers the number in the first case.
var ErrUserNotFound = errors.New("user not found")

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
		user.Phone, nullableEmail(user.Email), user.PasswordHash,
		user.Status, user.EmailVerified, user.AccountType,
	).Scan(&user.CreatedAt, &user.UpdatedAt)
}

// nullableEmail keeps a phone-only account out of the e-mail unique index.
// The column holds NULL, which Postgres allows any number of times, whereas
// '' is a value and the second such account would collide (migration 118).
func nullableEmail(email string) interface{} {
	if strings.TrimSpace(email) == "" {
		return nil
	}
	return email
}

func (r *UserRepository) GetByID(id uuid.UUID) (*models.User, error) {
	query := `
		SELECT id, first_name, middle_name, last_name, phone, COALESCE(email, '') AS email, password_hash, status, email_verified, phone_verified, account_type, avatar_url, created_at, updated_at
		FROM users WHERE id = $1
	`

	user := &models.User{}
	err := r.db.QueryRow(query, id).Scan(
		&user.ID, &user.FirstName, &user.MiddleName, &user.LastName,
		&user.Phone, &user.Email, &user.PasswordHash,
		&user.Status, &user.EmailVerified, &user.PhoneVerified, &user.AccountType, &user.AvatarURL, &user.CreatedAt, &user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}

	return user, nil
}

func (r *UserRepository) GetByEmail(email string) (*models.User, error) {
	query := `
		SELECT id, first_name, middle_name, last_name, phone, COALESCE(email, '') AS email, password_hash, status, email_verified, phone_verified, account_type, avatar_url, created_at, updated_at
		FROM users WHERE LOWER(email) = LOWER($1)
	`

	user := &models.User{}
	err := r.db.QueryRow(query, email).Scan(
		&user.ID, &user.FirstName, &user.MiddleName, &user.LastName,
		&user.Phone, &user.Email, &user.PasswordHash,
		&user.Status, &user.EmailVerified, &user.PhoneVerified, &user.AccountType, &user.AvatarURL, &user.CreatedAt, &user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}

	return user, nil
}

func (r *UserRepository) GetByPhone(phone string) (*models.User, error) {
	query := `
		SELECT id, first_name, middle_name, last_name, phone, COALESCE(email, '') AS email, password_hash, status, email_verified, phone_verified, account_type, avatar_url, created_at, updated_at
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
		&user.Status, &user.EmailVerified, &user.PhoneVerified, &user.AccountType, &user.AvatarURL, &user.CreatedAt, &user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}

	return user, nil
}

func (r *UserRepository) UpdateAvatar(id uuid.UUID, avatarURL string) error {
	query := `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(query, avatarURL, id)
	return err
}

func (r *UserRepository) UpdateStatus(id uuid.UUID, status models.UserStatus) error {
	query := `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(query, status, id)
	return err
}

func (r *UserRepository) UpdatePhone(id uuid.UUID, phone string) error {
	query := `UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(query, phone, id)
	return err
}

func (r *UserRepository) UpdateEmailVerified(id uuid.UUID, verified bool) error {
	query := `UPDATE users SET email_verified = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(query, verified, id)
	return err
}

func (r *UserRepository) UpdatePhoneVerified(id uuid.UUID, verified bool) error {
	_, err := r.db.Exec(`UPDATE users SET phone_verified = $1, updated_at = NOW() WHERE id = $2`, verified, id)
	return err
}

func (r *UserRepository) UpdateAccountType(id uuid.UUID, accountType models.AccountType) error {
	_, err := r.db.Exec(`UPDATE users SET account_type = $1, updated_at = NOW() WHERE id = $2`, accountType, id)
	return err
}

func (r *UserRepository) EmailExists(email string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER($1))`
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

// CreateWithPassword creates a new user with a hashed password (bcrypt)
func (r *UserRepository) CreateWithPassword(user *models.User, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	user.PasswordHash = string(hash)
	return r.Create(user)
}

// AccountDeletionBlockers counts what must be settled before an account can be
// deleted: orders still in progress as buyer or courier, and active businesses
// the user owns.
func (r *UserRepository) AccountDeletionBlockers(id uuid.UUID) (openOrders, ownedBusinesses int, err error) {
	err = r.db.QueryRow(`
		SELECT COUNT(*) FROM orders o
		WHERE o.status::text NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED', 'DELIVERED')
		  AND (o.assigned_courier_id = $1
		       OR o.buyer_profile_id IN (SELECT bp.id FROM buyer_profiles bp WHERE bp.user_id = $1))`,
		id).Scan(&openOrders)
	if err != nil {
		return 0, 0, err
	}
	err = r.db.QueryRow(`
		SELECT COUNT(*) FROM business_memberships m
		JOIN businesses b ON b.id = m.business_id
		WHERE m.user_id = $1 AND m.role = 'OWNER' AND m.status::text = 'ACTIVE'
		  AND b.status::text = 'ACTIVE'`,
		id).Scan(&ownedBusinesses)
	return openOrders, ownedBusinesses, err
}

// AnonymizeAccount overwrites a user's personal data and blocks sign-in. The
// row stays because orders, payments and audit records point at it.
func (r *UserRepository) AnonymizeAccount(id uuid.UUID) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	short := id.String()[:8]
	if _, err := tx.Exec(`
		UPDATE users SET
			first_name = 'Deleted', middle_name = '', last_name = 'account',
			email = $2, phone = $3, password_hash = '!', avatar_url = NULL,
			status = 'DEACTIVATED', email_verified = FALSE, phone_verified = FALSE,
			deleted_at = NOW(), updated_at = NOW()
		WHERE id = $1`,
		id, "deleted+"+id.String()+"@deleted.invalid", "del"+short); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM push_subscriptions WHERE principal_kind = 'USER' AND principal_id = $1`, id); err != nil {
		return err
	}
	return tx.Commit()
}

// SetPassword sets a new password for an existing user (bcrypt)
func (r *UserRepository) SetPassword(id uuid.UUID, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return r.UpdatePassword(id, string(hash))
}
