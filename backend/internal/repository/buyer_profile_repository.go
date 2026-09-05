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
		INSERT INTO buyer_profiles (id, user_id, first_name, last_name, phone, backup_phone, address, email, city, commune, country, latitude, longitude, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING created_at, updated_at
	`
	if profile.ID == uuid.Nil {
		profile.ID = uuid.New()
	}
	if profile.Country == "" {
		profile.Country = "DRC"
	}

	return r.db.QueryRow(query,
		profile.ID, profile.UserID, profile.FirstName, profile.LastName,
		profile.Phone, profile.BackupPhone, profile.Address, profile.Email, profile.City, profile.Commune,
		profile.Country, profile.Latitude, profile.Longitude, profile.Status,
	).Scan(&profile.CreatedAt, &profile.UpdatedAt)
}

func (r *BuyerProfileRepository) GetByID(id uuid.UUID) (*models.BuyerProfile, error) {
	query := `
		SELECT id, user_id, first_name, last_name, phone, backup_phone, address, email, city, commune, country, latitude, longitude, status, created_at, updated_at
		FROM buyer_profiles WHERE id = $1
	`
	p := &models.BuyerProfile{}
	err := r.db.QueryRow(query, id).Scan(
		&p.ID, &p.UserID, &p.FirstName, &p.LastName,
		&p.Phone, &p.BackupPhone, &p.Address, &p.Email, &p.City, &p.Commune,
		&p.Country, &p.Latitude, &p.Longitude, &p.Status,
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
		SELECT id, user_id, first_name, last_name, phone, backup_phone, address, email, city, commune, country, latitude, longitude, status, created_at, updated_at
		FROM buyer_profiles WHERE user_id = $1
	`
	p := &models.BuyerProfile{}
	err := r.db.QueryRow(query, userID).Scan(
		&p.ID, &p.UserID, &p.FirstName, &p.LastName,
		&p.Phone, &p.BackupPhone, &p.Address, &p.Email, &p.City, &p.Commune,
		&p.Country, &p.Latitude, &p.Longitude, &p.Status,
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
	if profile.Country == "" {
		profile.Country = "DRC"
	}
	query := `
		UPDATE buyer_profiles 
		SET first_name=$1, last_name=$2, phone=$3, backup_phone=$4, address=$5, email=$6, city=$7, commune=$8, country=$9, latitude=$10, longitude=$11, status=$12, updated_at=NOW()
		WHERE id = $13
	`
	_, err := r.db.Exec(query,
		profile.FirstName, profile.LastName, profile.Phone, profile.BackupPhone, profile.Address, profile.Email,
		profile.City, profile.Commune, profile.Country, profile.Latitude, profile.Longitude, profile.Status, profile.ID,
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
	if req.BackupPhone != nil {
		setClauses = append(setClauses, fmt.Sprintf("backup_phone=$%d", argIdx))
		args = append(args, *req.BackupPhone)
		argIdx++
	}
	if req.Address != nil {
		setClauses = append(setClauses, fmt.Sprintf("address=$%d", argIdx))
		args = append(args, *req.Address)
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
	if req.Country != nil {
		setClauses = append(setClauses, fmt.Sprintf("country=$%d", argIdx))
		args = append(args, *req.Country)
		argIdx++
	}
	if req.Latitude != nil {
		setClauses = append(setClauses, fmt.Sprintf("latitude=$%d", argIdx))
		args = append(args, *req.Latitude)
		argIdx++
	}
	if req.Longitude != nil {
		setClauses = append(setClauses, fmt.Sprintf("longitude=$%d", argIdx))
		args = append(args, *req.Longitude)
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
