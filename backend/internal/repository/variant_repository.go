package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type VariantRepository struct {
	db *database.DB
}

func NewVariantRepository(db *database.DB) *VariantRepository {
	return &VariantRepository{db: db}
}

func (r *VariantRepository) Create(v *models.ProductVariant) error {
	query := `
		INSERT INTO product_variants (id, product_id, sku, name, attributes, sale_price, purchase_price, barcode, unit, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING created_at, updated_at
	`

	v.ID = uuid.New()
	v.CreatedAt = time.Now()
	v.UpdatedAt = time.Now()

	if v.Attributes == nil {
		v.Attributes = make(models.JSONMap)
	}

	return r.db.QueryRow(query,
		v.ID, v.ProductID, v.SKU, v.Name,
		v.Attributes,
		v.SalePrice, v.PurchasePrice, v.Barcode, v.Unit, v.Status,
	).Scan(&v.CreatedAt, &v.UpdatedAt)
}

func (r *VariantRepository) GetByID(id uuid.UUID) (*models.ProductVariant, error) {
	query := `
		SELECT id, product_id, sku, name, attributes, sale_price, purchase_price, barcode, unit, status, created_at, updated_at
		FROM product_variants WHERE id = $1
	`

	v := &models.ProductVariant{}
	var attrs []byte
	err := r.db.QueryRow(query, id).Scan(
		&v.ID, &v.ProductID, &v.SKU, &v.Name,
		&attrs,
		&v.SalePrice, &v.PurchasePrice, &v.Barcode, &v.Unit, &v.Status,
		&v.CreatedAt, &v.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("variant not found")
	}
	if err != nil {
		return nil, err
	}

	if attrs != nil {
		v.Attributes = make(models.JSONMap)
		v.Attributes.Scan(attrs)
	} else {
		v.Attributes = make(models.JSONMap)
	}

	return v, nil
}

func (r *VariantRepository) GetByProductID(productID uuid.UUID) ([]*models.ProductVariant, error) {
	query := `
		SELECT id, product_id, sku, name, attributes, sale_price, purchase_price, barcode, unit, status, created_at, updated_at
		FROM product_variants WHERE product_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var variants []*models.ProductVariant
	for rows.Next() {
		v := &models.ProductVariant{}
		var attrs []byte
		err := rows.Scan(
			&v.ID, &v.ProductID, &v.SKU, &v.Name,
			&attrs,
			&v.SalePrice, &v.PurchasePrice, &v.Barcode, &v.Unit, &v.Status,
			&v.CreatedAt, &v.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		if attrs != nil {
			v.Attributes = make(models.JSONMap)
			v.Attributes.Scan(attrs)
		} else {
			v.Attributes = make(models.JSONMap)
		}
		variants = append(variants, v)
	}

	return variants, rows.Err()
}

func (r *VariantRepository) GetByBusinessID(businessID uuid.UUID) ([]*models.ProductVariant, error) {
	query := `
		SELECT pv.id, pv.product_id, pv.sku, pv.name, pv.attributes, pv.sale_price, pv.purchase_price, pv.barcode, pv.unit, pv.status, pv.created_at, pv.updated_at
		FROM product_variants pv
		INNER JOIN products p ON pv.product_id = p.id
		WHERE p.business_id = $1
		ORDER BY pv.created_at DESC
	`

	rows, err := r.db.Query(query, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var variants []*models.ProductVariant
	for rows.Next() {
		v := &models.ProductVariant{}
		var attrs []byte
		err := rows.Scan(
			&v.ID, &v.ProductID, &v.SKU, &v.Name,
			&attrs,
			&v.SalePrice, &v.PurchasePrice, &v.Barcode, &v.Unit, &v.Status,
			&v.CreatedAt, &v.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		if attrs != nil {
			v.Attributes = make(models.JSONMap)
			v.Attributes.Scan(attrs)
		} else {
			v.Attributes = make(models.JSONMap)
		}
		variants = append(variants, v)
	}

	return variants, rows.Err()
}

func (r *VariantRepository) Update(v *models.ProductVariant) error {
	query := `
		UPDATE product_variants 
		SET sku = $2, name = $3, attributes = $4, sale_price = $5, purchase_price = $6, barcode = $7, unit = $8, status = $9, updated_at = NOW()
		WHERE id = $1
		RETURNING updated_at
	`

	return r.db.QueryRow(query,
		v.ID, v.SKU, v.Name, v.Attributes,
		v.SalePrice, v.PurchasePrice, v.Barcode, v.Unit, v.Status,
	).Scan(&v.UpdatedAt)
}

func (r *VariantRepository) GetBySKU(sku string) (*models.ProductVariant, error) {
	query := `
		SELECT id, product_id, sku, name, attributes, sale_price, purchase_price, barcode, unit, status, created_at, updated_at
		FROM product_variants WHERE sku = $1
	`

	v := &models.ProductVariant{}
	var attrs []byte
	err := r.db.QueryRow(query, sku).Scan(
		&v.ID, &v.ProductID, &v.SKU, &v.Name,
		&attrs,
		&v.SalePrice, &v.PurchasePrice, &v.Barcode, &v.Unit, &v.Status,
		&v.CreatedAt, &v.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("variant not found")
	}
	if err != nil {
		return nil, err
	}

	if attrs != nil {
		v.Attributes = make(models.JSONMap)
		v.Attributes.Scan(attrs)
	} else {
		v.Attributes = make(models.JSONMap)
	}

	return v, nil
}
