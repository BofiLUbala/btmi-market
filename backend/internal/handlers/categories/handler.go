package categories

import (
	"net/http"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	categoryService *service.CategoryService
}

func NewHandler(categoryService *service.CategoryService) *Handler {
	return &Handler{categoryService: categoryService}
}

func (h *Handler) errResponse(c *gin.Context, statusCode int, errorCode, message string) {
	c.JSON(statusCode, models.ErrorResponse{
		Error: struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}{
			Code:    errorCode,
			Message: message,
		},
	})
}

func (h *Handler) ListCategories(c *gin.Context) {
	withSubs := c.Query("with_subcategories") == "true"

	if withSubs {
		categories, err := h.categoryService.ListCategoriesWithSubcategories()
		if err != nil {
			h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
			return
		}

		var result []map[string]interface{}
		for _, cat := range categories {
			subs := make([]models.SubcategoryResponse, 0)
			for _, s := range cat.Subcategories {
				subs = append(subs, models.SubcategoryResponse{
					ID:       s.ID,
					Name:     s.Name,
					Slug:     s.Slug,
					SortOrder: s.SortOrder,
				})
			}
			result = append(result, map[string]interface{}{
				"id":            cat.ID,
				"name":          cat.Name,
				"slug":          cat.Slug,
				"sort_order":    cat.SortOrder,
				"subcategories": subs,
			})
		}

		c.JSON(http.StatusOK, models.SuccessResponse{
			Message: "Categories retrieved successfully",
			Data:    result,
		})
		return
	}

	categories, err := h.categoryService.ListCategories()
	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Categories retrieved successfully",
		Data:    categories,
	})
}

func (h *Handler) ListSubcategories(c *gin.Context) {
	categoryIDStr := c.Param("category_id")
	categoryID, err := uuid.Parse(categoryIDStr)
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid category ID")
		return
	}

	subs, err := h.categoryService.ListSubcategories(categoryID)
	if err != nil {
		if err.Error() == "category not found" {
			h.errResponse(c, http.StatusNotFound, "CATEGORY_NOT_FOUND", "Category not found")
			return
		}
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Subcategories retrieved successfully",
		Data:    subs,
	})
}

func (h *Handler) GetCategoryAttributes(c *gin.Context) {
	categoryParam := c.Param("category_id")
	subIDParam := c.Query("subcategory_id")
	subSlugParam := c.Query("subcategory_slug")

	var defs []*models.CategoryAttributeDefinition
	categoryID, err := uuid.Parse(categoryParam)
	if err == nil {
		var subcategoryID *uuid.UUID
		if subIDParam != "" {
			if sid, parseErr := uuid.Parse(subIDParam); parseErr == nil {
				subcategoryID = &sid
			}
		} else if subSlugParam != "" {
			if sub, subErr := h.categoryService.GetSubcategoryBySlug(categoryID, subSlugParam); subErr == nil && sub != nil {
				subcategoryID = &sub.ID
			}
		}
		defs, err = h.categoryService.GetCategoryAttributes(categoryID, subcategoryID)
	} else {
		// Try slug
		defs, err = h.categoryService.GetCategoryAttributesBySlug(categoryParam, subSlugParam)
	}

	if err != nil {
		h.errResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	if defs == nil {
		defs = []*models.CategoryAttributeDefinition{}
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Category attributes retrieved successfully",
		Data:    defs,
	})
}
