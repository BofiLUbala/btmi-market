package service

import (
	"context"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type MarketplaceService struct {
	marketplaceRepo  *repository.MarketplaceRepository
	productImageRepo *repository.ProductImageRepository
	visualSearchURL  string
	pointService     *PointService
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

func (s *MarketplaceService) SetProductImageRepo(repo *repository.ProductImageRepository) {
	s.productImageRepo = repo
}

func (s *MarketplaceService) SetVisualSearchURL(url string) { s.visualSearchURL = url }

// attachImages fills the Images field of each product with its persisted
// media, ordered primary-first. Failures are non-fatal.
func (s *MarketplaceService) attachImages(products []*models.PublicProductResponse) {
	if s.productImageRepo == nil || len(products) == 0 {
		return
	}
	ids := make([]uuid.UUID, 0, len(products))
	for _, p := range products {
		ids = append(ids, p.ID)
	}
	imageMap, err := s.productImageRepo.ListByProductIDs(ids)
	if err != nil {
		return
	}
	for _, p := range products {
		for _, img := range imageMap[p.ID] {
			p.Images = append(p.Images, models.ProductImageResponse{
				ID:        img.ID,
				ProductID: img.ProductID,
				URL:       img.URL,
				FileName:  img.FileName,
				SortOrder: img.SortOrder,
				IsPrimary: img.IsPrimary,
				CreatedAt: img.CreatedAt,
			})
		}
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

func (s *MarketplaceService) ListProducts(shopID uuid.UUID, page, limit int, sort string) ([]*models.PublicProductResponse, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	products, total, err := s.marketplaceRepo.ListPublicProducts(shopID, page, limit, sort)
	if err == nil {
		s.attachImages(products)
	}
	return products, total, err
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
	s.attachImages([]*models.PublicProductResponse{p})

	return p, nil
}

func (s *MarketplaceService) ListProductsByCategory(categoryID, subcategoryID uuid.UUID, city string, page, limit int) ([]*models.PublicProductResponse, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	products, total, err := s.marketplaceRepo.ListProductsByCategory(categoryID, subcategoryID, city, page, limit)
	if err == nil {
		s.attachImages(products)
	}
	return products, total, err
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
	res, err := s.marketplaceRepo.SearchProducts(params)
	if err == nil && res != nil {
		s.attachImages(res.Products)
	}
	return res, err
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
	detail, err := s.marketplaceRepo.GetPublicProductDetailByID(productID, buyerProfileID)
	if err != nil {
		return nil, err
	}
	if detail != nil && s.productImageRepo != nil {
		imageMap, imgErr := s.productImageRepo.ListByProductIDs([]uuid.UUID{productID})
		if imgErr == nil {
			for _, img := range imageMap[productID] {
				detail.Images = append(detail.Images, models.ProductImageResponse{
					ID:        img.ID,
					ProductID: img.ProductID,
					URL:       img.URL,
					FileName:  img.FileName,
					SortOrder: img.SortOrder,
					IsPrimary: img.IsPrimary,
					CreatedAt: img.CreatedAt,
				})
			}
		}
	}
	return detail, nil
}

func (s *MarketplaceService) ListShopProducts(shopID uuid.UUID, params *models.ShopProductsParams) ([]*models.PublicProductResponse, int, error) {
	if params.Page <= 0 {
		params.Page = 1
	}
	if params.Limit <= 0 || params.Limit > 50 {
		params.Limit = 20
	}
	products, total, err := s.marketplaceRepo.ListShopProducts(shopID, params)
	if err == nil {
		s.attachImages(products)
	}
	return products, total, err
}

func (s *MarketplaceService) GetSimilarProducts(ctx context.Context, productID uuid.UUID, buyerProfileID *uuid.UUID, page, limit int) ([]*models.PublicProductDetailResponse, int, error) {
	return s.marketplaceRepo.GetSimilarProducts(ctx, productID, page, limit, buyerProfileID)
}
