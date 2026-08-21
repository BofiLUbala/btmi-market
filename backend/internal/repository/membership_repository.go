package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type MembershipRepository struct {
	db *database.DB
}

func NewMembershipRepository(db *database.DB) *MembershipRepository {
	return &MembershipRepository{db: db}
}

func (r *MembershipRepository) Create(membership *models.BusinessMembership) error {
	query := `
		INSERT INTO business_memberships (id, user_id, business_id, role, status, joined_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	membership.ID = uuid.New()
	membership.JoinedAt = time.Now()
	membership.CreatedAt = time.Now()
	membership.UpdatedAt = time.Now()

	_, err := r.db.Exec(query,
		membership.ID, membership.UserID, membership.BusinessID,
		membership.Role, membership.Status,
		membership.JoinedAt, membership.CreatedAt, membership.UpdatedAt,
	)
	return err
}

func (r *MembershipRepository) GetByID(id uuid.UUID) (*models.BusinessMembership, error) {
	query := `
		SELECT id, user_id, business_id, role, status, joined_at, created_at, updated_at
		FROM business_memberships WHERE id = $1
	`

	membership := &models.BusinessMembership{}
	err := r.db.QueryRow(query, id).Scan(
		&membership.ID, &membership.UserID, &membership.BusinessID,
		&membership.Role, &membership.Status,
		&membership.JoinedAt, &membership.CreatedAt, &membership.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("membership not found")
	}
	if err != nil {
		return nil, err
	}

	return membership, nil
}

func (r *MembershipRepository) GetByUserAndBusiness(userID, businessID uuid.UUID) (*models.BusinessMembership, error) {
	query := `
		SELECT id, user_id, business_id, role, status, joined_at, created_at, updated_at
		FROM business_memberships 
		WHERE user_id = $1 AND business_id = $2
	`

	membership := &models.BusinessMembership{}
	err := r.db.QueryRow(query, userID, businessID).Scan(
		&membership.ID, &membership.UserID, &membership.BusinessID,
		&membership.Role, &membership.Status,
		&membership.JoinedAt, &membership.CreatedAt, &membership.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("membership not found")
	}
	if err != nil {
		return nil, err
	}

	return membership, nil
}

func (r *MembershipRepository) GetActiveByUserAndBusiness(userID, businessID uuid.UUID) (*models.BusinessMembership, error) {
	query := `
		SELECT id, user_id, business_id, role, status, joined_at, created_at, updated_at
		FROM business_memberships 
		WHERE user_id = $1 AND business_id = $2 AND status = 'ACTIVE'
	`

	membership := &models.BusinessMembership{}
	err := r.db.QueryRow(query, userID, businessID).Scan(
		&membership.ID, &membership.UserID, &membership.BusinessID,
		&membership.Role, &membership.Status,
		&membership.JoinedAt, &membership.CreatedAt, &membership.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("membership not found")
	}
	if err != nil {
		return nil, err
	}

	return membership, nil
}

func (r *MembershipRepository) GetByBusinessID(businessID uuid.UUID) ([]*models.BusinessMembership, error) {
	query := `
		SELECT id, user_id, business_id, role, status, joined_at, created_at, updated_at
		FROM business_memberships 
		WHERE business_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var memberships []*models.BusinessMembership
	for rows.Next() {
		membership := &models.BusinessMembership{}
		err := rows.Scan(
			&membership.ID, &membership.UserID, &membership.BusinessID,
			&membership.Role, &membership.Status,
			&membership.JoinedAt, &membership.CreatedAt, &membership.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		memberships = append(memberships, membership)
	}

	return memberships, rows.Err()
}
