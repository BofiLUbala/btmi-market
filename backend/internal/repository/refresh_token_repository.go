package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"sync"
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

// RevokeAllForUser signs the account out everywhere: its refresh tokens die,
// and every access token issued up to now is refused (see SessionsRevokedAt).
func (r *RefreshTokenRepository) RevokeAllForUser(userID uuid.UUID) error {
	var revokedAt time.Time
	err := r.db.QueryRow(`
		WITH tokens AS (
			UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL
		)
		UPDATE users SET sessions_revoked_at = NOW() WHERE id = $1
		RETURNING sessions_revoked_at`, userID).Scan(&revokedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	revocations.Store(userID, revocationEntry{at: revokedAt, fetched: time.Now()})
	return nil
}

// revocationTTL bounds how stale a cached "sessions revoked at" may be when
// another API instance revoked the account; this instance updates its own
// cache at once.
const revocationTTL = 30 * time.Second

type revocationEntry struct {
	at      time.Time // zero: never revoked
	fetched time.Time
}

// revocations is shared by every repository instance of this process.
var revocations sync.Map // uuid.UUID -> revocationEntry

// SessionsRevokedAt is the instant the account was last signed out
// everywhere (zero when never). Cached briefly: it is read on every request.
func (r *RefreshTokenRepository) SessionsRevokedAt(userID uuid.UUID) (time.Time, error) {
	if v, ok := revocations.Load(userID); ok {
		if e := v.(revocationEntry); time.Since(e.fetched) < revocationTTL {
			return e.at, nil
		}
	}
	var at sql.NullTime
	err := r.db.QueryRow(`SELECT sessions_revoked_at FROM users WHERE id = $1`, userID).Scan(&at)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return time.Time{}, err
	}
	e := revocationEntry{fetched: time.Now()}
	if at.Valid {
		e.at = at.Time
	}
	revocations.Store(userID, e)
	return e.at, nil
}

func (r *RefreshTokenRepository) DeleteExpired() error {
	query := `DELETE FROM refresh_tokens WHERE expires_at < NOW()`
	_, err := r.db.Exec(query)
	return err
}
