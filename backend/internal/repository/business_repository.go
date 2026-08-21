package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type BusinessRepository struct {
	db *database.DB
}

func NewBusinessRepository(db *database.DB) *BusinessRepository {
	return &BusinessRepository{db: db}
}

func (r *BusinessRepository) Create(business *models.Business) error {
	query := `
		INSERT INTO businesses (id, name, business_type, category, phone, whatsapp, email, country, city, default_currency, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING created_at, updated_at
	`

	business.ID = uuid.New()
	business.CreatedAt = time.Now()
	business.UpdatedAt = time.Now()

	return r.db.QueryRow(query,
		business.ID, business.Name, business.BusinessType, business.Category,
		business.Phone, business.Whatsapp, business.Email,
		business.Country, business.City, business.DefaultCurrency,
		business.Status,
	).Scan(&business.CreatedAt, &business.UpdatedAt)
}

func (r *BusinessRepository) GetByID(id uuid.UUID) (*models.Business, error) {
	query := `
		SELECT id, name, business_type, category, phone, whatsapp, email, country, city, default_currency, status, created_at, updated_at
		FROM businesses WHERE id = $1
	`

	business := &models.Business{}
	err := r.db.QueryRow(query, id).Scan(
		&business.ID, &business.Name, &business.BusinessType, &business.Category,
		&business.Phone, &business.Whatsapp, &business.Email,
		&business.Country, &business.City, &business.DefaultCurrency,
		&business.Status, &business.CreatedAt, &business.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("business not found")
	}
	if err != nil {
		return nil, err
	}

	return business, nil
}

func (r *BusinessRepository) GetByUserID(userID uuid.UUID) ([]*models.Business, error) {
	query := `
		SELECT b.id, b.name, b.business_type, b.category, b.phone, b.whatsapp, b.email, b.country, b.city, b.default_currency, b.status, b.created_at, b.updated_at
		FROM businesses b
		INNER JOIN business_memberships bm ON b.id = bm.business_id
		WHERE bm.user_id = $1 AND bm.status = 'ACTIVE'
		ORDER BY b.created_at DESC
	`

	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var businesses []*models.Business
	for rows.Next() {
		business := &models.Business{}
		err := rows.Scan(
			&business.ID, &business.Name, &business.BusinessType, &business.Category,
			&business.Phone, &business.Whatsapp, &business.Email,
			&business.Country, &business.City, &business.DefaultCurrency,
			&business.Status, &business.CreatedAt, &business.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		businesses = append(businesses, business)
	}

	return businesses, rows.Err()
}
