package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type PasswordResetTokenRepository struct {
	db *database.DB
}

func NewPasswordResetTokenRepository(db *database.DB) *PasswordResetTokenRepository {
	return &PasswordResetTokenRepository{db: db}
}

func (r *PasswordResetTokenRepository) Create(token *models.PasswordResetToken) error {
	query := `
		INSERT INTO password_reset_tokens (id, user_id, token_hash, created_at, expires_at, used_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	token.ID = uuid.New()
	token.CreatedAt = time.Now()

	_, err := r.db.Exec(query,
		token.ID, token.UserID, token.TokenHash,
		token.CreatedAt, token.ExpiresAt, token.UsedAt,
	)
	return err
}

func (r *PasswordResetTokenRepository) GetByTokenHash(tokenHash string) (*models.PasswordResetToken, error) {
	query := `
		SELECT id, user_id, token_hash, created_at, expires_at, used_at
		FROM password_reset_tokens WHERE token_hash = $1
	`

	token := &models.PasswordResetToken{}
	err := r.db.QueryRow(query, tokenHash).Scan(
		&token.ID, &token.UserID, &token.TokenHash,
		&token.CreatedAt, &token.ExpiresAt, &token.UsedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("token not found")
	}
	if err != nil {
		return nil, err
	}

	return token, nil
}

func (r *PasswordResetTokenRepository) GetValidByUserID(userID uuid.UUID) (*models.PasswordResetToken, error) {
	query := `
		SELECT id, user_id, token_hash, created_at, expires_at, used_at
		FROM password_reset_tokens 
		WHERE user_id = $1 AND used_at IS NULL AND expires_at > NOW()
		ORDER BY created_at DESC
		LIMIT 1
	`

	token := &models.PasswordResetToken{}
	err := r.db.QueryRow(query, userID).Scan(
		&token.ID, &token.UserID, &token.TokenHash,
		&token.CreatedAt, &token.ExpiresAt, &token.UsedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("no valid token found")
	}
	if err != nil {
		return nil, err
	}

	return token, nil
}

func (r *PasswordResetTokenRepository) MarkAsUsed(id uuid.UUID) error {
	query := `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

func (r *PasswordResetTokenRepository) InvalidateAllForUser(userID uuid.UUID) error {
	query := `
		UPDATE password_reset_tokens 
		SET used_at = NOW() 
		WHERE user_id = $1 AND used_at IS NULL
	`
	_, err := r.db.Exec(query, userID)
	return err
}