package service

import (
	"context"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type MarketplaceService struct {
	marketplaceRepo *repository.MarketplaceRepository
	pointService    *PointService
}

func NewMarketplaceService(
	marketplaceRepo *repository.MarketplaceRepository,
	pointService *PointService,
) *MarketplaceService {
	return &MarketplaceService{
		marketplaceRepo: marketplaceRepo,
		pointService:    pointService,
	}
}

func (s *MarketplaceService) ListShops(query, city string, page, limit int) ([]*models.PublicShopResponse, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	return s.marketplaceRepo.ListPublicShops(query, city, page, limit)
}

func (s *MarketplaceService) GetShop(shopID uuid.UUID) (*models.PublicShopResponse, error) {
	return s.marketplaceRepo.GetPublicShopByID(shopID)
}

func (s *MarketplaceService) ListProducts(shopID uuid.UUID, page, limit int) ([]*models.PublicProductResponse, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	return s.marketplaceRepo.ListPublicProducts(shopID, page, limit)
}

func (s *MarketplaceService) GetProduct(productID uuid.UUID) (*models.PublicProductResponse, error) {
	p, err := s.marketplaceRepo.GetPublicProductByID(productID)
	if err != nil {
		return nil, err
	}

	variants, err := s.marketplaceRepo.GetVariantsForProduct(productID)
	if err == nil {
		p.Variants = variants
	}

	return p, nil
}

func (s *MarketplaceService) ListProductsByCategory(categoryID, subcategoryID uuid.UUID, city string, page, limit int) ([]*models.PublicProductResponse, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	return s.marketplaceRepo.ListProductsByCategory(categoryID, subcategoryID, city, page, limit)
}

func (s *MarketplaceService) ListMarketplaceCategories() ([]*models.CategoryResponse, error) {
	return s.marketplaceRepo.ListCategoriesWithSubs()
}

func (s *MarketplaceService) SearchProducts(params *models.MarketplaceSearchParams) (*models.MarketplaceSearchResult, error) {
	if params.Page <= 0 {
		params.Page = 1
	}
	if params.Limit <= 0 || params.Limit > 50 {
		params.Limit = 20
	}
	return s.marketplaceRepo.SearchProducts(params)
}

func (s *MarketplaceService) GetProductPrice(productID uuid.UUID, buyerProfileID *uuid.UUID) (*models.BuyerPriceResponse, error) {
	product, err := s.marketplaceRepo.GetPublicProductByID(productID)
	if err != nil {
		return nil, err
	}

	// Get price from variants
	variants, _ := s.marketplaceRepo.GetVariantsForProduct(productID)
	basePrice := 0.0
	if len(variants) > 0 {
		basePrice = variants[0].UnitPrice
	}

	if buyerProfileID == nil {
		return &models.BuyerPriceResponse{
			BasePrice:        basePrice,
			BuyerLevel:       "BRONZE",
			DiscountPercent:  0,
			DiscountAmount:   0,
			FinalPrice:       basePrice,
			FreeDelivery:     false,
			DeliveryDiscount: 0,
		}, nil
	}

	_ = product
	return s.pointService.GetBuyerPriceWithBenefit(basePrice, *buyerProfileID)
}

func (s *MarketplaceService) GetShopDetail(shopID uuid.UUID) (*models.PublicShopDetailResponse, error) {
	return s.marketplaceRepo.GetPublicShopDetailByID(shopID)
}

func (s *MarketplaceService) GetProductDetail(productID uuid.UUID, buyerProfileID *uuid.UUID) (*models.PublicProductDetailResponse, error) {
	return s.marketplaceRepo.GetPublicProductDetailByID(productID, buyerProfileID)
}

func (s *MarketplaceService) ListShopProducts(shopID uuid.UUID, params *models.ShopProductsParams) ([]*models.PublicProductResponse, int, error) {
	if params.Page <= 0 {
		params.Page = 1
	}
	if params.Limit <= 0 || params.Limit > 50 {
		params.Limit = 20
	}
	return s.marketplaceRepo.ListShopProducts(shopID, params)
}

func (s *MarketplaceService) GetSimilarProducts(ctx context.Context, productID uuid.UUID, buyerProfileID *uuid.UUID, page, limit int) ([]*models.PublicProductDetailResponse, int, error) {
	return s.marketplaceRepo.GetSimilarProducts(ctx, productID, page, limit, buyerProfileID)
}
