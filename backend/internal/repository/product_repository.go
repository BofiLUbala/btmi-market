package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type ProductRepository struct {
	db *database.DB
}

func NewProductRepository(db *database.DB) *ProductRepository {
	return &ProductRepository{db: db}
}

func (r *ProductRepository) Create(product *models.Product) error {
	query := `
		INSERT INTO products (id, business_id, name, sku, description, unit_price, cost_price, unit, status, publication_status, category_id, subcategory_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING created_at, updated_at
	`

	product.ID = uuid.New()
	product.CreatedAt = time.Now()
	product.UpdatedAt = time.Now()

	return r.db.QueryRow(query,
		product.ID, product.BusinessID, product.Name, product.SKU,
		product.Description, product.UnitPrice, product.CostPrice,
		product.Unit, product.Status, product.PublicationStatus,
		product.CategoryID, product.SubcategoryID,
	).Scan(&product.CreatedAt, &product.UpdatedAt)
}

func (r *ProductRepository) GetByID(id uuid.UUID) (*models.Product, error) {
	query := `
		SELECT id, business_id, name, sku, description, unit_price, cost_price, unit, status, publication_status, category_id, subcategory_id, created_at, updated_at
		FROM products WHERE id = $1
	`

	product := &models.Product{}
	err := r.db.QueryRow(query, id).Scan(
		&product.ID, &product.BusinessID, &product.Name, &product.SKU,
		&product.Description, &product.UnitPrice, &product.CostPrice,
		&product.Unit, &product.Status, &product.PublicationStatus,
		&product.CategoryID, &product.SubcategoryID,
		&product.CreatedAt, &product.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("product not found")
	}
	if err != nil {
		return nil, err
	}

	return product, nil
}

func (r *ProductRepository) GetByBusinessID(businessID uuid.UUID) ([]*models.Product, error) {
	query := `
		SELECT id, business_id, name, sku, description, unit_price, cost_price, unit, status, publication_status, category_id, subcategory_id, created_at, updated_at
		FROM products WHERE business_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []*models.Product
	for rows.Next() {
		product := &models.Product{}
		err := rows.Scan(
			&product.ID, &product.BusinessID, &product.Name, &product.SKU,
			&product.Description, &product.UnitPrice, &product.CostPrice,
			&product.Unit, &product.Status, &product.PublicationStatus,
			&product.CategoryID, &product.SubcategoryID,
			&product.CreatedAt, &product.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		products = append(products, product)
	}

	return products, rows.Err()
}

func (r *ProductRepository) Update(product *models.Product) error {
	query := `
		UPDATE products 
		SET name = $2, sku = $3, description = $4, unit_price = $5, cost_price = $6, unit = $7, status = $8,
		    publication_status = $9, category_id = $10, subcategory_id = $11, updated_at = NOW()
		WHERE id = $1
		RETURNING updated_at
	`

	return r.db.QueryRow(query,
		product.ID, product.Name, product.SKU, product.Description,
		product.UnitPrice, product.CostPrice, product.Unit, product.Status,
		product.PublicationStatus, product.CategoryID, product.SubcategoryID,
	).Scan(&product.UpdatedAt)
}

func (r *ProductRepository) CountPublishedByBusinessAndCategory(businessID, categoryID uuid.UUID) (int, error) {
	query := `
		SELECT COUNT(*) FROM products
		WHERE business_id = $1 AND category_id = $2
		AND publication_status = 'PUBLISHED' AND status = 'ACTIVE'
	`
	var count int
	err := r.db.QueryRow(query, businessID, categoryID).Scan(&count)
	return count, err
}

func (r *ProductRepository) GetPublishedProductCategories(businessID uuid.UUID) ([]uuid.UUID, error) {
	query := `
		SELECT DISTINCT category_id FROM products
		WHERE business_id = $1 AND publication_status = 'PUBLISHED' AND status = 'ACTIVE'
		AND category_id IS NOT NULL
	`
	rows, err := r.db.Query(query, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []uuid.UUID
	for rows.Next() {
		var catID uuid.UUID
		if err := rows.Scan(&catID); err != nil {
			return nil, err
		}
		categories = append(categories, catID)
	}
	return categories, rows.Err()
}

func (r *ProductRepository) GetDB() *database.DB {
	return r.db
}
