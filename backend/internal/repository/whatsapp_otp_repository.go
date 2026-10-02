package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/google/uuid"
)

// WhatsAppOTPChallenge is one code sent over WhatsApp; only its hash is kept.
type WhatsAppOTPChallenge struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	Purpose   string
	Phone     string
	CodeHash  string
	Attempts  int
	ExpiresAt time.Time
	UsedAt    *time.Time
	CreatedAt time.Time
}

type WhatsAppOTPRepository struct {
	db *database.DB
}

func NewWhatsAppOTPRepository(db *database.DB) *WhatsAppOTPRepository {
	return &WhatsAppOTPRepository{db: db}
}

func (r *WhatsAppOTPRepository) Create(ch *WhatsAppOTPChallenge) error {
	return r.db.QueryRow(`
		INSERT INTO whatsapp_otp_challenges (id, user_id, purpose, phone, code_hash, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING created_at`,
		ch.ID, ch.UserID, ch.Purpose, ch.Phone, ch.CodeHash, ch.ExpiresAt,
	).Scan(&ch.CreatedAt)
}

func (r *WhatsAppOTPRepository) GetByID(id uuid.UUID) (*WhatsAppOTPChallenge, error) {
	ch := &WhatsAppOTPChallenge{}
	err := r.db.QueryRow(`
		SELECT id, user_id, purpose, phone, code_hash, attempts, expires_at, used_at, created_at
		FROM whatsapp_otp_challenges WHERE id = $1`, id,
	).Scan(&ch.ID, &ch.UserID, &ch.Purpose, &ch.Phone, &ch.CodeHash, &ch.Attempts, &ch.ExpiresAt, &ch.UsedAt, &ch.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("challenge not found")
	}
	return ch, err
}

// IncrementAttempts counts a wrong code and returns the new total.
func (r *WhatsAppOTPRepository) IncrementAttempts(id uuid.UUID) (int, error) {
	var attempts int
	err := r.db.QueryRow(`UPDATE whatsapp_otp_challenges SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts`, id).Scan(&attempts)
	return attempts, err
}

// MarkUsed consumes the code once; false means it was already consumed.
func (r *WhatsAppOTPRepository) MarkUsed(id uuid.UUID) (bool, error) {
	res, err := r.db.Exec(`UPDATE whatsapp_otp_challenges SET used_at = NOW() WHERE id = $1 AND used_at IS NULL`, id)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n == 1, nil
}

// InvalidateOpen closes every pending code of the user for a purpose, so only
// the latest one sent can be entered.
func (r *WhatsAppOTPRepository) InvalidateOpen(userID uuid.UUID, purpose string) error {
	_, err := r.db.Exec(`UPDATE whatsapp_otp_challenges SET used_at = NOW() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`, userID, purpose)
	return err
}
