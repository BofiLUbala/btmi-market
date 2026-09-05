package repository

import (
	"database/sql"
	"fmt"
	"strings"
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
		INSERT INTO products (
			id, business_id, name, sku, description, unit_price, cost_price, unit, status, publication_status, category_id, subcategory_id,
			discount_active, discount_type, discount_value, discount_start, discount_end, self_rating
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
		product.DiscountActive, product.DiscountType, product.DiscountValue,
		product.DiscountStart, product.DiscountEnd, product.SelfRating,
	).Scan(&product.CreatedAt, &product.UpdatedAt)
}

func (r *ProductRepository) GetByID(id uuid.UUID) (*models.Product, error) {
	query := `
		SELECT id, business_id, name, sku, description, unit_price, cost_price, unit, status, publication_status, category_id, subcategory_id,
		       discount_active, discount_type, discount_value, discount_start, discount_end, self_rating, created_at, updated_at
		FROM products WHERE id = $1
	`

	product := &models.Product{}
	err := r.db.QueryRow(query, id).Scan(
		&product.ID, &product.BusinessID, &product.Name, &product.SKU,
		&product.Description, &product.UnitPrice, &product.CostPrice,
		&product.Unit, &product.Status, &product.PublicationStatus,
		&product.CategoryID, &product.SubcategoryID,
		&product.DiscountActive, &product.DiscountType, &product.DiscountValue,
		&product.DiscountStart, &product.DiscountEnd, &product.SelfRating,
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
		SELECT id, business_id, name, sku, description, unit_price, cost_price, unit, status, publication_status, category_id, subcategory_id,
		       discount_active, discount_type, discount_value, discount_start, discount_end, self_rating, created_at, updated_at
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
			&product.DiscountActive, &product.DiscountType, &product.DiscountValue,
			&product.DiscountStart, &product.DiscountEnd, &product.SelfRating,
			&product.CreatedAt, &product.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		products = append(products, product)
	}

	return products, rows.Err()
}

func (r *ProductRepository) GetWithSummaryByBusinessID(businessID uuid.UUID, search, publicationStatus string) ([]*models.ProductResponse, error) {
	query := `
		SELECT p.id, p.business_id, p.name, p.sku, p.description, p.unit_price, p.cost_price,
		       p.unit, p.status, p.publication_status, p.category_id, p.subcategory_id,
		       p.discount_active, p.discount_type, p.discount_value, p.discount_start, p.discount_end,
		       p.self_rating,
		       p.created_at, p.updated_at,
		       COALESCE(c.name, '') as category_name,
		       COUNT(DISTINCT v.id) as variant_count,
		       COALESCE(SUM(i.quantity), 0) as total_quantity,
		       COALESCE(SUM(i.reserved_quantity), 0) as reserved_quantity,
		       COALESCE(SUM(i.quantity - i.reserved_quantity), 0) as available_quantity
		FROM products p
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN product_variants v ON v.product_id = p.id AND v.status = 'ACTIVE'
		LEFT JOIN inventory i ON i.variant_id = v.id
		WHERE p.business_id = $1
		  AND p.status = 'ACTIVE'
		  AND ($2 = '' OR p.name ILIKE '%' || $2 || '%' OR p.sku ILIKE '%' || $2 || '%' OR p.description ILIKE '%' || $2 || '%')
		  AND ($3 = '' OR p.publication_status::text = UPPER($3))
		GROUP BY p.id, c.name
		ORDER BY p.created_at DESC
	`

	rows, err := r.db.Query(query, businessID, strings.TrimSpace(search), strings.TrimSpace(publicationStatus))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var responses []*models.ProductResponse
	for rows.Next() {
		p := &models.ProductResponse{}
		err := rows.Scan(
			&p.ID, &p.BusinessID, &p.Name, &p.SKU,
			&p.Description, &p.UnitPrice, &p.CostPrice,
			&p.Unit, &p.Status, &p.PublicationStatus,
			&p.CategoryID, &p.SubcategoryID,
			&p.DiscountActive, &p.DiscountType, &p.DiscountValue,
			&p.DiscountStart, &p.DiscountEnd,
			&p.SelfRating,
			&p.CreatedAt, &p.UpdatedAt,
			&p.CategoryName,
			&p.VariantCount,
			&p.TotalQuantity,
			&p.ReservedQuantity,
			&p.AvailableQuantity,
		)
		if err != nil {
			return nil, err
		}
		responses = append(responses, p)
	}

	return responses, rows.Err()
}

func (r *ProductRepository) Update(product *models.Product) error {
	query := `
		UPDATE products 
		SET name = $2, sku = $3, description = $4, unit_price = $5, cost_price = $6, unit = $7, status = $8,
		    publication_status = $9, category_id = $10, subcategory_id = $11,
		    discount_active = $12, discount_type = $13, discount_value = $14, discount_start = $15, discount_end = $16,
		    updated_at = NOW()
		WHERE id = $1
		RETURNING updated_at
	`

	return r.db.QueryRow(query,
		product.ID, product.Name, product.SKU, product.Description,
		product.UnitPrice, product.CostPrice, product.Unit, product.Status,
		product.PublicationStatus, product.CategoryID, product.SubcategoryID,
		product.DiscountActive, product.DiscountType, product.DiscountValue,
		product.DiscountStart, product.DiscountEnd,
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
