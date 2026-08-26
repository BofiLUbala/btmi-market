package repository

import (
	"database/sql"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

type ProductImageRepository struct {
	db *database.DB
}

func NewProductImageRepository(db *database.DB) *ProductImageRepository {
	return &ProductImageRepository{db: db}
}

func (r *ProductImageRepository) scanImage(row interface{ Scan(...interface{}) error }) (*models.ProductImage, error) {
	img := &models.ProductImage{}
	var createdAt time.Time
	var variantID uuid.NullUUID
	err := row.Scan(
		&img.ID, &img.BusinessID, &img.ProductID, &variantID,
		&img.URL, &img.FileName, &img.SortOrder, &img.IsPrimary, &createdAt,
	)
	if err != nil {
		return nil, err
	}
	if variantID.Valid {
		v := variantID.UUID
		img.VariantID = &v
	}
	img.CreatedAt = createdAt
	return img, nil
}

func (r *ProductImageRepository) Create(img *models.ProductImage) (*models.ProductImage, error) {
	query := `
		INSERT INTO product_images (business_id, product_id, variant_id, url, file_name, sort_order, is_primary)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, business_id, product_id, variant_id, url, file_name, sort_order, is_primary, created_at`

	row := r.db.QueryRow(query,
		img.BusinessID, img.ProductID, img.VariantID, img.URL, img.FileName, img.SortOrder, img.IsPrimary,
	)
	return r.scanImage(row)
}

// SetVariant links an image to one Variant, or clears the link when
// variantID is nil so the image applies to the whole Product again.
func (r *ProductImageRepository) SetVariant(id uuid.UUID, variantID *uuid.UUID) error {
	_, err := r.db.Exec(`UPDATE product_images SET variant_id = $2 WHERE id = $1`, id, variantID)
	return err
}

func (r *ProductImageRepository) GetByID(id uuid.UUID) (*models.ProductImage, error) {
	query := `
		SELECT id, business_id, product_id, variant_id, url, file_name, sort_order, is_primary, created_at
		FROM product_images WHERE id = $1`
	row := r.db.QueryRow(query, id)
	img, err := r.scanImage(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return img, err
}

func (r *ProductImageRepository) ListByProduct(productID uuid.UUID) ([]*models.ProductImage, error) {
	query := `
		SELECT id, business_id, product_id, variant_id, url, file_name, sort_order, is_primary, created_at
		FROM product_images
		WHERE product_id = $1
		ORDER BY is_primary DESC, sort_order ASC, created_at ASC`

	rows, err := r.db.Query(query, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	images := make([]*models.ProductImage, 0)
	for rows.Next() {
		img, err := r.scanImage(rows)
		if err != nil {
			continue
		}
		images = append(images, img)
	}
	return images, rows.Err()
}

// ListByProductIDs returns all images for the given products ordered so the
// primary image of each product comes first.
func (r *ProductImageRepository) ListByProductIDs(productIDs []uuid.UUID) (map[uuid.UUID][]*models.ProductImage, error) {
	result := make(map[uuid.UUID][]*models.ProductImage)
	if len(productIDs) == 0 {
		return result, nil
	}

	query := `
		SELECT id, business_id, product_id, variant_id, url, file_name, sort_order, is_primary, created_at
		FROM product_images
		WHERE product_id = ANY($1)
		ORDER BY is_primary DESC, sort_order ASC, created_at ASC`

	rows, err := r.db.Query(query, pq.Array(productIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		img, err := r.scanImage(rows)
		if err != nil {
			continue
		}
		result[img.ProductID] = append(result[img.ProductID], img)
	}
	return result, rows.Err()
}

func (r *ProductImageRepository) ClearPrimary(productID, exceptID uuid.UUID) error {
	query := `UPDATE product_images SET is_primary = FALSE WHERE product_id = $1 AND id <> $2`
	_, err := r.db.Exec(query, productID, exceptID)
	return err
}

func (r *ProductImageRepository) SetPrimary(id uuid.UUID) error {
	_, err := r.db.Exec(`UPDATE product_images SET is_primary = TRUE WHERE id = $1`, id)
	return err
}

func (r *ProductImageRepository) CountByProduct(productID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM product_images WHERE product_id = $1`, productID).Scan(&count)
	return count, err
}

func (r *ProductImageRepository) Delete(id uuid.UUID) error {
	_, err := r.db.Exec(`DELETE FROM product_images WHERE id = $1`, id)
	return err
}

// FirstProductID returns the product_id of an image (used to resolve ownership).
func (r *ProductImageRepository) MaxSortOrder(productID uuid.UUID) (int, error) {
	var maxOrder sql.NullInt64
	err := r.db.QueryRow(`SELECT MAX(sort_order) FROM product_images WHERE product_id = $1`, productID).Scan(&maxOrder)
	if err != nil {
		return 0, err
	}
	if !maxOrder.Valid {
		return 0, nil
	}
	return int(maxOrder.Int64), nil
}
