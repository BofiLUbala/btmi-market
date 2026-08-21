package repository

import (
	"database/sql"
	"fmt"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type BuyerProfileRepository struct {
	db *database.DB
}

func NewBuyerProfileRepository(db *database.DB) *BuyerProfileRepository {
	return &BuyerProfileRepository{db: db}
}

func (r *BuyerProfileRepository) Create(profile *models.BuyerProfile) error {
	query := `
		INSERT INTO buyer_profiles (id, user_id, first_name, last_name, phone, email, city, commune, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING created_at, updated_at
	`
	if profile.ID == uuid.Nil {
		profile.ID = uuid.New()
	}

	return r.db.QueryRow(query,
		profile.ID, profile.UserID, profile.FirstName, profile.LastName,
		profile.Phone, profile.Email, profile.City, profile.Commune, profile.Status,
	).Scan(&profile.CreatedAt, &profile.UpdatedAt)
}

func (r *BuyerProfileRepository) GetByID(id uuid.UUID) (*models.BuyerProfile, error) {
	query := `
		SELECT id, user_id, first_name, last_name, phone, email, city, commune, status, created_at, updated_at
		FROM buyer_profiles WHERE id = $1
	`
	p := &models.BuyerProfile{}
	err := r.db.QueryRow(query, id).Scan(
		&p.ID, &p.UserID, &p.FirstName, &p.LastName,
		&p.Phone, &p.Email, &p.City, &p.Commune, &p.Status,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("buyer profile not found")
	}
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (r *BuyerProfileRepository) GetByUserID(userID uuid.UUID) (*models.BuyerProfile, error) {
	query := `
		SELECT id, user_id, first_name, last_name, phone, email, city, commune, status, created_at, updated_at
		FROM buyer_profiles WHERE user_id = $1
	`
	p := &models.BuyerProfile{}
	err := r.db.QueryRow(query, userID).Scan(
		&p.ID, &p.UserID, &p.FirstName, &p.LastName,
		&p.Phone, &p.Email, &p.City, &p.Commune, &p.Status,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (r *BuyerProfileRepository) Update(profile *models.BuyerProfile) error {
	query := `
		UPDATE buyer_profiles 
		SET first_name=$1, last_name=$2, phone=$3, email=$4, city=$5, commune=$6, status=$7, updated_at=NOW()
		WHERE id = $8
	`
	_, err := r.db.Exec(query,
		profile.FirstName, profile.LastName, profile.Phone, profile.Email,
		profile.City, profile.Commune, profile.Status, profile.ID,
	)
	return err
}

func (r *BuyerProfileRepository) UpdateFromRequest(userID uuid.UUID, req *models.UpdateBuyerProfileRequest) error {
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if req.FirstName != nil {
		setClauses = append(setClauses, fmt.Sprintf("first_name=$%d", argIdx))
		args = append(args, *req.FirstName)
		argIdx++
	}
	if req.LastName != nil {
		setClauses = append(setClauses, fmt.Sprintf("last_name=$%d", argIdx))
		args = append(args, *req.LastName)
		argIdx++
	}
	if req.Phone != nil {
		setClauses = append(setClauses, fmt.Sprintf("phone=$%d", argIdx))
		args = append(args, *req.Phone)
		argIdx++
	}
	if req.Email != nil {
		setClauses = append(setClauses, fmt.Sprintf("email=$%d", argIdx))
		args = append(args, *req.Email)
		argIdx++
	}
	if req.City != nil {
		setClauses = append(setClauses, fmt.Sprintf("city=$%d", argIdx))
		args = append(args, *req.City)
		argIdx++
	}
	if req.Commune != nil {
		setClauses = append(setClauses, fmt.Sprintf("commune=$%d", argIdx))
		args = append(args, *req.Commune)
		argIdx++
	}

	if len(setClauses) == 0 {
		return nil
	}

	query := "UPDATE buyer_profiles SET updated_at=NOW()"
	for _, clause := range setClauses {
		query += ", " + clause
	}
	query += fmt.Sprintf(" WHERE user_id=$%d", argIdx)
	args = append(args, userID)

	_, err := r.db.Exec(query, args...)
	return err
}

func (r *BuyerProfileRepository) CountVerifiedPurchases(buyerProfileID uuid.UUID) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM verified_transactions WHERE buyer_profile_id = $1 AND status = 'VERIFIED'`
	err := r.db.QueryRow(query, buyerProfileID).Scan(&count)
	return count, err
}

func (r *BuyerProfileRepository) CountAllPurchases(buyerProfileID uuid.UUID) (int, error) {
	var count int
	query := `SELECT COUNT(*) FROM purchase_confirmations WHERE buyer_profile_id = $1`
	err := r.db.QueryRow(query, buyerProfileID).Scan(&count)
	return count, err
}
