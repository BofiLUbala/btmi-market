package repository

import (
	"database/sql"
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
