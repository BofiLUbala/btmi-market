package repository

import (
	"database/sql"

	"github.com/btmi-ai-market/backend/internal/database"
)

type PointConfigRepository struct {
	db *database.DB
}

func NewPointConfigRepository(db *database.DB) *PointConfigRepository {
	return &PointConfigRepository{db: db}
}

func (r *PointConfigRepository) GetFloat(key string, defaultValue float64) float64 {
	var value float64
	query := `SELECT value FROM point_config WHERE key = $1`
	err := r.db.QueryRow(query, key).Scan(&value)
	if err == sql.ErrNoRows {
		return defaultValue
	}
	if err != nil {
		return defaultValue
	}
	return value
}

func (r *PointConfigRepository) SetFloat(key string, value float64) error {
	query := `
		INSERT INTO point_config (key, value, updated_at) VALUES ($1, $2, NOW())
		ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
	`
	_, err := r.db.Exec(query, key, value)
	return err
}
