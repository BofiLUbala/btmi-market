package repository

import (
	"database/sql"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

type ProductVideoRepository struct {
	db *database.DB
}

func NewProductVideoRepository(db *database.DB) *ProductVideoRepository {
	return &ProductVideoRepository{db: db}
}

const productVideoColumns = `id, business_id, product_id, url, file_name, mime_type, size_bytes, created_at`

func scanProductVideo(row interface{ Scan(...interface{}) error }) (*models.ProductVideo, error) {
	v := &models.ProductVideo{}
	err := row.Scan(&v.ID, &v.BusinessID, &v.ProductID, &v.URL, &v.FileName, &v.MimeType, &v.SizeBytes, &v.CreatedAt)
	if err != nil {
		return nil, err
	}
	return v, nil
}

// GetByProduct returns the product's video, or nil when it has none.
func (r *ProductVideoRepository) GetByProduct(productID uuid.UUID) (*models.ProductVideo, error) {
	row := r.db.QueryRow(`SELECT `+productVideoColumns+` FROM product_videos WHERE product_id = $1`, productID)
	v, err := scanProductVideo(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return v, err
}

// Upsert stores the product's video, replacing any previous one.
func (r *ProductVideoRepository) Upsert(v *models.ProductVideo) (*models.ProductVideo, error) {
	row := r.db.QueryRow(`
		INSERT INTO product_videos (business_id, product_id, url, file_name, mime_type, size_bytes)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (product_id) DO UPDATE
		SET url = EXCLUDED.url, file_name = EXCLUDED.file_name, mime_type = EXCLUDED.mime_type,
		    size_bytes = EXCLUDED.size_bytes, created_at = NOW()
		RETURNING `+productVideoColumns,
		v.BusinessID, v.ProductID, v.URL, v.FileName, v.MimeType, v.SizeBytes)
	return scanProductVideo(row)
}

// URLsByProductIDs maps each product that has a video to its video URL, in one
// query, so product lists can carry it without a lookup per card.
func (r *ProductVideoRepository) URLsByProductIDs(ids []uuid.UUID) (map[uuid.UUID]string, error) {
	out := make(map[uuid.UUID]string, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := r.db.Query(`SELECT product_id, url FROM product_videos WHERE product_id = ANY($1)`, pq.Array(ids))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id uuid.UUID
		var url string
		if err := rows.Scan(&id, &url); err != nil {
			return nil, err
		}
		out[id] = url
	}
	return out, rows.Err()
}

func (r *ProductVideoRepository) DeleteByProduct(productID uuid.UUID) error {
	_, err := r.db.Exec(`DELETE FROM product_videos WHERE product_id = $1`, productID)
	return err
}
