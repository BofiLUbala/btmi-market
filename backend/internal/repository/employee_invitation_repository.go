package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type EmployeeInvitationRepository struct {
	db *database.DB
}

func NewEmployeeInvitationRepository(db *database.DB) *EmployeeInvitationRepository {
	return &EmployeeInvitationRepository{db: db}
}

func (r *EmployeeInvitationRepository) Create(invitation *models.EmployeeInvitation) error {
	query := `
		INSERT INTO employee_invitations (id, employee_id, token_hash, status, expires_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING created_at
	`

	invitation.ID = uuid.New()
	invitation.CreatedAt = time.Now()

	return r.db.QueryRow(query,
		invitation.ID, invitation.EmployeeID, invitation.TokenHash,
		invitation.Status, invitation.ExpiresAt,
	).Scan(&invitation.CreatedAt)
}

func (r *EmployeeInvitationRepository) GetByTokenHash(tokenHash string) (*models.EmployeeInvitation, error) {
	query := `
		SELECT id, employee_id, token_hash, status, expires_at, accepted_at, created_at
		FROM employee_invitations WHERE token_hash = $1
	`

	invitation := &models.EmployeeInvitation{}
	err := r.db.QueryRow(query, tokenHash).Scan(
		&invitation.ID, &invitation.EmployeeID, &invitation.TokenHash,
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

func (r *EmployeeInvitationRepository) GetByEmployeeID(employeeID uuid.UUID) (*models.EmployeeInvitation, error) {
	query := `
		SELECT id, employee_id, token_hash, status, expires_at, accepted_at, created_at
		FROM employee_invitations WHERE employee_id = $1
	`

	invitation := &models.EmployeeInvitation{}
	err := r.db.QueryRow(query, employeeID).Scan(
		&invitation.ID, &invitation.EmployeeID, &invitation.TokenHash,
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

func (r *EmployeeInvitationRepository) UpdateStatus(id uuid.UUID, status models.EmployeeInvitationStatus, acceptedAt *time.Time) error {
	query := `UPDATE employee_invitations SET status = $1, accepted_at = $2 WHERE id = $3`
	_, err := r.db.Exec(query, status, acceptedAt, id)
	return err
}

func (r *EmployeeInvitationRepository) InvalidateAllForEmployee(employeeID uuid.UUID) error {
	query := `UPDATE employee_invitations SET status = 'REVOKED' WHERE employee_id = $1 AND status = 'PENDING'`
	_, err := r.db.Exec(query, employeeID)
	return err
}

type EmployeeActivationTokenRepository struct {
	db *database.DB
}

func NewEmployeeActivationTokenRepository(db *database.DB) *EmployeeActivationTokenRepository {
	return &EmployeeActivationTokenRepository{db: db}
}

func (r *EmployeeActivationTokenRepository) Create(token *models.EmployeeActivationToken) error {
	query := `
		INSERT INTO employee_activation_tokens (id, user_id, token_hash, expires_at)
		VALUES ($1, $2, $3, $4)
		RETURNING created_at
	`

	token.ID = uuid.New()
	token.CreatedAt = time.Now()

	return r.db.QueryRow(query,
		token.ID, token.UserID, token.TokenHash, token.ExpiresAt,
	).Scan(&token.CreatedAt)
}

func (r *EmployeeActivationTokenRepository) GetByTokenHash(tokenHash string) (*models.EmployeeActivationToken, error) {
	query := `
		SELECT id, user_id, token_hash, expires_at, used_at, created_at
		FROM employee_activation_tokens WHERE token_hash = $1
	`

	token := &models.EmployeeActivationToken{}
	err := r.db.QueryRow(query, tokenHash).Scan(
		&token.ID, &token.UserID, &token.TokenHash, &token.ExpiresAt, &token.UsedAt, &token.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("token not found")
	}
	if err != nil {
		return nil, err
	}

	return token, nil
}

func (r *EmployeeActivationTokenRepository) MarkAsUsed(id uuid.UUID) error {
	query := `UPDATE employee_activation_tokens SET used_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}

func (r *EmployeeActivationTokenRepository) InvalidateAllForUser(userID uuid.UUID) error {
	query := `UPDATE employee_activation_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`
	_, err := r.db.Exec(query, userID)
	return err
}