package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type AdminInvitationRepository struct {
	db *database.DB
}

func NewAdminInvitationRepository(db *database.DB) *AdminInvitationRepository {
	return &AdminInvitationRepository{db: db}
}

func (r *AdminInvitationRepository) Create(invitation *models.AdminInvitation) error {
	query := `
		INSERT INTO admin_invitations (id, admin_id, invited_by_admin_id, token_hash, status, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING created_at
	`

	invitation.ID = uuid.New()
	invitation.CreatedAt = time.Now()

	return r.db.QueryRow(query,
		invitation.ID, invitation.AdminID, invitation.InvitedByAdminID, invitation.TokenHash,
		invitation.Status, invitation.ExpiresAt,
	).Scan(&invitation.CreatedAt)
}

func (r *AdminInvitationRepository) GetByTokenHash(tokenHash string) (*models.AdminInvitation, error) {
	query := `
		SELECT id, admin_id, invited_by_admin_id, token_hash, status, expires_at, accepted_at, created_at
		FROM admin_invitations WHERE token_hash = $1
	`

	invitation := &models.AdminInvitation{}
	err := r.db.QueryRow(query, tokenHash).Scan(
		&invitation.ID, &invitation.AdminID, &invitation.InvitedByAdminID, &invitation.TokenHash,
		&invitation.Status, &invitation.ExpiresAt, &invitation.AcceptedAt, &invitation.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("invitation not found")
	}
	if err != nil {
		return nil, err
	}

	return invitation, nil
}

func (r *AdminInvitationRepository) GetByAdminID(adminID uuid.UUID) (*models.AdminInvitation, error) {
	query := `
		SELECT id, admin_id, invited_by_admin_id, token_hash, status, expires_at, accepted_at, created_at
		FROM admin_invitations WHERE admin_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`

	invitation := &models.AdminInvitation{}
	err := r.db.QueryRow(query, adminID).Scan(
		&invitation.ID, &invitation.AdminID, &invitation.InvitedByAdminID, &invitation.TokenHash,
		&invitation.Status, &invitation.ExpiresAt, &invitation.AcceptedAt, &invitation.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("invitation not found")
	}
	if err != nil {
		return nil, err
	}

	return invitation, nil
}

func (r *AdminInvitationRepository) UpdateStatus(id uuid.UUID, status models.AdminInvitationStatus, acceptedAt *time.Time) error {
	query := `UPDATE admin_invitations SET status = $1, accepted_at = $2 WHERE id = $3`
	_, err := r.db.Exec(query, status, acceptedAt, id)
	return err
}

func (r *AdminInvitationRepository) InvalidateAllForAdmin(adminID uuid.UUID) error {
	query := `UPDATE admin_invitations SET status = 'REVOKED' WHERE admin_id = $1 AND status = 'PENDING'`
	_, err := r.db.Exec(query, adminID)
	return err
}
