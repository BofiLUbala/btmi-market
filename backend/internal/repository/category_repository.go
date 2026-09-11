package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type CategoryRepository struct {
	db *database.DB
}

func NewCategoryRepository(db *database.DB) *CategoryRepository {
	return &CategoryRepository{db: db}
}

func (r *CategoryRepository) Create(category *models.Category) error {
	query := `INSERT INTO categories (id, name, slug, status, sort_order)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING created_at, updated_at`
	category.ID = uuid.New()
	category.CreatedAt = time.Now()
	category.UpdatedAt = time.Now()
	return r.db.QueryRow(query,
		category.ID, category.Name, category.Slug, category.Status, category.SortOrder,
	).Scan(&category.CreatedAt, &category.UpdatedAt)
}

func (r *CategoryRepository) GetAllActive() ([]*models.Category, error) {
	query := `SELECT id, name, slug, status, sort_order, created_at, updated_at
		FROM categories WHERE status = 'ACTIVE' ORDER BY sort_order ASC, name ASC`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []*models.Category
	for rows.Next() {
		c := &models.Category{}
		if err := rows.Scan(&c.ID, &c.Name, &c.Slug, &c.Status, &c.SortOrder, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		categories = append(categories, c)
	}
	return categories, rows.Err()
}

func (r *CategoryRepository) GetAllWithSubcategories() ([]*models.CategoryWithSubcategories, error) {
	rows, err := r.db.Query(`
		SELECT id, name, slug, status, sort_order, created_at, updated_at
		FROM categories WHERE status = 'ACTIVE' ORDER BY sort_order ASC, name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []*models.CategoryWithSubcategories
	for rows.Next() {
		c := &models.CategoryWithSubcategories{}
		if err := rows.Scan(&c.ID, &c.Name, &c.Slug, &c.Status, &c.SortOrder, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		result = append(result, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for _, cat := range result {
		subs, err := r.GetSubcategoriesByCategory(cat.ID)
		if err != nil {
			return nil, err
		}
		cat.Subcategories = subs
	}
	return result, nil
}

func (r *CategoryRepository) GetByID(id uuid.UUID) (*models.Category, error) {
	query := `SELECT id, name, slug, status, sort_order, created_at, updated_at
		FROM categories WHERE id = $1`
	c := &models.Category{}
	err := r.db.QueryRow(query, id).Scan(
		&c.ID, &c.Name, &c.Slug, &c.Status, &c.SortOrder, &c.CreatedAt, &c.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("category not found")
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *CategoryRepository) GetBySlug(slug string) (*models.Category, error) {
	query := `SELECT id, name, slug, status, sort_order, created_at, updated_at
		FROM categories WHERE slug = $1 AND status = 'ACTIVE'`
	c := &models.Category{}
	err := r.db.QueryRow(query, slug).Scan(
		&c.ID, &c.Name, &c.Slug, &c.Status, &c.SortOrder, &c.CreatedAt, &c.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("category not found")
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *CategoryRepository) CreateSubcategory(sub *models.Subcategory) error {
	query := `INSERT INTO subcategories (id, category_id, name, slug, status, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING created_at, updated_at`
	sub.ID = uuid.New()
	sub.CreatedAt = time.Now()
	sub.UpdatedAt = time.Now()
	return r.db.QueryRow(query,
		sub.ID, sub.CategoryID, sub.Name, sub.Slug, sub.Status, sub.SortOrder,
	).Scan(&sub.CreatedAt, &sub.UpdatedAt)
}

func (r *CategoryRepository) GetSubcategoriesByCategory(categoryID uuid.UUID) ([]*models.Subcategory, error) {
	query := `SELECT id, category_id, name, slug, status, sort_order, created_at, updated_at
		FROM subcategories WHERE category_id = $1 AND status = 'ACTIVE' ORDER BY sort_order ASC, name ASC`
	rows, err := r.db.Query(query, categoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []*models.Subcategory
	for rows.Next() {
		s := &models.Subcategory{}
		if err := rows.Scan(&s.ID, &s.CategoryID, &s.Name, &s.Slug, &s.Status, &s.SortOrder, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		subs = append(subs, s)
	}
	return subs, rows.Err()
}

func (r *CategoryRepository) GetSubcategoryByID(id uuid.UUID) (*models.Subcategory, error) {
	query := `SELECT id, category_id, name, slug, status, sort_order, created_at, updated_at
		FROM subcategories WHERE id = $1 AND status = 'ACTIVE'`
	s := &models.Subcategory{}
	err := r.db.QueryRow(query, id).Scan(
		&s.ID, &s.CategoryID, &s.Name, &s.Slug, &s.Status, &s.SortOrder, &s.CreatedAt, &s.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("subcategory not found")
	}
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *CategoryRepository) GetSubcategoryBySlug(categoryID uuid.UUID, slug string) (*models.Subcategory, error) {
	query := `SELECT id, category_id, name, slug, status, sort_order, created_at, updated_at
		FROM subcategories WHERE category_id = $1 AND slug = $2 AND status = 'ACTIVE'`
	s := &models.Subcategory{}
	err := r.db.QueryRow(query, categoryID, slug).Scan(
		&s.ID, &s.CategoryID, &s.Name, &s.Slug, &s.Status, &s.SortOrder, &s.CreatedAt, &s.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("subcategory not found")
	}
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *CategoryRepository) ListCategoriesWithSubs() ([]*models.CategoryResponse, error) {
	rows, err := r.db.Query(`
		SELECT id, name, slug, sort_order
		FROM categories WHERE status = 'ACTIVE'
		ORDER BY sort_order ASC, name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []*models.CategoryResponse
	for rows.Next() {
		c := &models.CategoryResponse{}
		if err := rows.Scan(&c.ID, &c.Name, &c.Slug, &c.SortOrder); err != nil {
			return nil, err
		}

		subRows, err := r.db.Query(`
			SELECT id, name, slug, sort_order
			FROM subcategories WHERE category_id = $1 AND status = 'ACTIVE'
			ORDER BY sort_order ASC, name ASC
		`, c.ID)
		if err != nil {
			return nil, err
		}
		var subs []models.SubcategoryResponse
		for subRows.Next() {
			var s models.SubcategoryResponse
			if err := subRows.Scan(&s.ID, &s.Name, &s.Slug, &s.SortOrder); err != nil {
				subRows.Close()
				return nil, err
			}
			subs = append(subs, s)
		}
		subRows.Close()
		c.Subcategories = subs
		result = append(result, c)
	}
	return result, rows.Err()
}

// GetEffectiveAttributes retrieves the attribute definitions for a category,
// taking subcategory-specific overrides into account if subcategoryID is provided.
func (r *CategoryRepository) GetEffectiveAttributes(categoryID uuid.UUID, subcategoryID *uuid.UUID) ([]*models.CategoryAttributeDefinition, error) {
	if subcategoryID != nil && *subcategoryID != uuid.Nil {
		// Check for subcategory-specific overrides
		subQuery := `
			SELECT id, category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute,
			       input_type, allowed_values, display_order, status, created_at, updated_at
			FROM category_attribute_definitions
			WHERE category_id = $1 AND subcategory_id = $2 AND status = 'ACTIVE'
			ORDER BY display_order ASC, key ASC
		`
		subRows, err := r.db.Query(subQuery, categoryID, *subcategoryID)
		if err == nil {
			defer subRows.Close()
			var subDefs []*models.CategoryAttributeDefinition
			for subRows.Next() {
				def := &models.CategoryAttributeDefinition{}
				var allowedValsJSON []byte
				if err := subRows.Scan(
					&def.ID, &def.CategoryID, &def.SubcategoryID, &def.Key, &def.LabelEn, &def.LabelFr,
					&def.Required, &def.VariantAttribute, &def.InputType, &allowedValsJSON,
					&def.DisplayOrder, &def.Status, &def.CreatedAt, &def.UpdatedAt,
				); err == nil {
					def.AllowedValues = []string{}
					if len(allowedValsJSON) > 0 {
						_ = json.Unmarshal(allowedValsJSON, &def.AllowedValues)
					}
					subDefs = append(subDefs, def)
				}
			}
			if len(subDefs) > 0 {
				return subDefs, nil
			}
		}
	}

	// Fallback to base category attributes (where subcategory_id IS NULL)
	catQuery := `
		SELECT id, category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute,
		       input_type, allowed_values, display_order, status, created_at, updated_at
		FROM category_attribute_definitions
		WHERE category_id = $1 AND subcategory_id IS NULL AND status = 'ACTIVE'
		ORDER BY display_order ASC, key ASC
	`
	rows, err := r.db.Query(catQuery, categoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var defs []*models.CategoryAttributeDefinition
	for rows.Next() {
		def := &models.CategoryAttributeDefinition{}
		var allowedValsJSON []byte
		if err := rows.Scan(
			&def.ID, &def.CategoryID, &def.SubcategoryID, &def.Key, &def.LabelEn, &def.LabelFr,
			&def.Required, &def.VariantAttribute, &def.InputType, &allowedValsJSON,
			&def.DisplayOrder, &def.Status, &def.CreatedAt, &def.UpdatedAt,
		); err != nil {
			return nil, err
		}
		def.AllowedValues = []string{}
		if len(allowedValsJSON) > 0 {
			_ = json.Unmarshal(allowedValsJSON, &def.AllowedValues)
		}
		defs = append(defs, def)
	}
	return defs, rows.Err()
}

// GetEffectiveAttributesBySlug retrieves the attribute definitions by category and subcategory slugs.
func (r *CategoryRepository) GetEffectiveAttributesBySlug(categorySlug string, subcategorySlug string) ([]*models.CategoryAttributeDefinition, error) {
	cat, err := r.GetBySlug(categorySlug)
	if err != nil {
		return nil, err
	}
	var subID *uuid.UUID
	if subcategorySlug != "" {
		if sub, err := r.GetSubcategoryBySlug(cat.ID, subcategorySlug); err == nil && sub != nil {
			subID = &sub.ID
		}
	}
	return r.GetEffectiveAttributes(cat.ID, subID)
}

