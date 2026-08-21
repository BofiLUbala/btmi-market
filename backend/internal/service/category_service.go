package service

import (
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type CategoryService struct {
	categoryRepo *repository.CategoryRepository
}

func NewCategoryService(categoryRepo *repository.CategoryRepository) *CategoryService {
	return &CategoryService{categoryRepo: categoryRepo}
}

func (s *CategoryService) ListCategories() ([]*models.CategoryResponse, error) {
	categories, err := s.categoryRepo.GetAllActive()
	if err != nil {
		return nil, err
	}
	var result []*models.CategoryResponse
	for _, c := range categories {
		result = append(result, &models.CategoryResponse{
			ID:       c.ID,
			Name:     c.Name,
			Slug:     c.Slug,
			SortOrder: c.SortOrder,
		})
	}
	return result, nil
}

func (s *CategoryService) ListSubcategories(categoryID uuid.UUID) ([]*models.SubcategoryResponse, error) {
	subs, err := s.categoryRepo.GetSubcategoriesByCategory(categoryID)
	if err != nil {
		return nil, err
	}
	var result []*models.SubcategoryResponse
	for _, sub := range subs {
		result = append(result, &models.SubcategoryResponse{
			ID:       sub.ID,
			Name:     sub.Name,
			Slug:     sub.Slug,
			SortOrder: sub.SortOrder,
		})
	}
	return result, nil
}

func (s *CategoryService) ListCategoriesWithSubcategories() ([]*models.CategoryWithSubcategories, error) {
	return s.categoryRepo.GetAllWithSubcategories()
}

func (s *CategoryService) GetCategoryDetails(categoryID uuid.UUID) (*models.CategoryWithSubcategories, error) {
	cat, err := s.categoryRepo.GetByID(categoryID)
	if err != nil {
		return nil, err
	}
	subs, err := s.categoryRepo.GetSubcategoriesByCategory(categoryID)
	if err != nil {
		return nil, err
	}
	return &models.CategoryWithSubcategories{
		ID:            cat.ID,
		Name:          cat.Name,
		Slug:          cat.Slug,
		Status:        cat.Status,
		SortOrder:     cat.SortOrder,
		CreatedAt:     cat.CreatedAt,
		UpdatedAt:     cat.UpdatedAt,
		Subcategories: subs,
	}, nil
}

func (s *CategoryService) GetCategoryDetailsBySlug(slug string) (*models.CategoryWithSubcategories, error) {
	cat, err := s.categoryRepo.GetBySlug(slug)
	if err != nil {
		return nil, err
	}
	subs, err := s.categoryRepo.GetSubcategoriesByCategory(cat.ID)
	if err != nil {
		return nil, err
	}
	return &models.CategoryWithSubcategories{
		ID:            cat.ID,
		Name:          cat.Name,
		Slug:          cat.Slug,
		Status:        cat.Status,
		SortOrder:     cat.SortOrder,
		CreatedAt:     cat.CreatedAt,
		UpdatedAt:     cat.UpdatedAt,
		Subcategories: subs,
	}, nil
}

func (s *CategoryService) GetSubcategoryBySlug(categoryID uuid.UUID, slug string) (*models.Subcategory, error) {
	return s.categoryRepo.GetSubcategoryBySlug(categoryID, slug)
}
