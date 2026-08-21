package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type RefreshTokenRepository struct {
	db *database.DB
}

func NewRefreshTokenRepository(db *database.DB) *RefreshTokenRepository {
	return &RefreshTokenRepository{db: db}
}

func (r *RefreshTokenRepository) Create(token *models.RefreshToken) error {
	query := `
		INSERT INTO refresh_tokens (id, user_id, token_hash, user_agent, ip_address, created_at, expires_at, revoked_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	token.ID = uuid.New()
	token.CreatedAt = time.Now()

	_, err := r.db.Exec(query,
		token.ID, token.UserID, token.TokenHash,
		token.UserAgent, token.IPAddress,
		token.CreatedAt, token.ExpiresAt, token.RevokedAt,
	)
	return err
}

func (r *RefreshTokenRepository) GetByTokenHash(tokenHash string) (*models.RefreshToken, error) {
	query := `
		SELECT id, user_id, token_hash, user_agent, ip_address, created_at, expires_at, revoked_at
		FROM refresh_tokens WHERE token_hash = $1
	`

	token := &models.RefreshToken{}
	err := r.db.QueryRow(query, tokenHash).Scan(
		&token.ID, &token.UserID, &token.TokenHash,
		&token.UserAgent, &token.IPAddress,
		&token.CreatedAt, &token.ExpiresAt, &token.RevokedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("token not found")
	}
	if err != nil {
		return nil, err
	}

	return token, nil
}

func (r *RefreshTokenRepository) Revoke(id uuid.UUID) error {
	query := `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

func (r *RefreshTokenRepository) RevokeAllForUser(userID uuid.UUID) error {
	query := `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`
	_, err := r.db.Exec(query, userID)
	return err
}

func (r *RefreshTokenRepository) DeleteExpired() error {
	query := `DELETE FROM refresh_tokens WHERE expires_at < NOW()`
	_, err := r.db.Exec(query)
	return err
}
