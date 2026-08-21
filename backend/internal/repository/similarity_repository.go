package repository

import (
	"context"
	"fmt"
	"log"

	redislib "github.com/btmi-ai-market/backend/internal/redis"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type SimilarityRepository struct {
	redisClient  *redislib.Client
	marketplaceRepo *MarketplaceRepository
	productRepo    *ProductRepository
}

func NewSimilarityRepository(
	redisClient *redislib.Client,
	marketplaceRepo *MarketplaceRepository,
	productRepo *ProductRepository,
) *SimilarityRepository {
	return &SimilarityRepository{
		redisClient:     redisClient,
		marketplaceRepo: marketplaceRepo,
		productRepo:     productRepo,
	}
}

func (r *SimilarityRepository) GetSimilarProducts(ctx context.Context, productID uuid.UUID, page, limit int, buyerProfileID *uuid.UUID) ([]*models.PublicProductDetailResponse, int, error) {
	if r.redisClient == nil || !r.redisClient.IsAvailable(ctx) {
		log.Printf("Redis unavailable for product similarity, using PostgreSQL fallback")
		return r.getSimilarProductsFromPostgres(ctx, productID, page, limit, buyerProfileID)
	}

	redisSimilar, total, err := r.redisClient.GetProductSimilarity(ctx, productID, page, limit)
	if err != nil {
		log.Printf("Redis error getting product similarity: %v, falling back to PostgreSQL", err)
		return r.getSimilarProductsFromPostgres(ctx, productID, page, limit, buyerProfileID)
	}

	if len(redisSimilar) == 0 && total == 0 {
		return r.getSimilarProductsFromPostgres(ctx, productID, page, limit, buyerProfileID)
	}

	var results []*models.PublicProductDetailResponse
	for _, sp := range redisSimilar {
		product, err := r.marketplaceRepo.GetPublicProductDetailByID(sp.ProductID, buyerProfileID)
		if err != nil {
			log.Printf("Failed to get product detail for %s: %v", sp.ProductID, err)
			continue
		}
		if product != nil {
			results = append(results, product)
		}
	}

	return results, total, nil
}

func (r *SimilarityRepository) getSimilarProductsFromPostgres(ctx context.Context, productID uuid.UUID, page, limit int, buyerProfileID *uuid.UUID) ([]*models.PublicProductDetailResponse, int, error) {
	sourceProduct, err := r.productRepo.GetByID(productID)
	if err != nil || sourceProduct == nil {
		return nil, 0, err
	}

	if sourceProduct.CategoryID == nil {
		return nil, 0, nil
	}

	query := `
		SELECT p.id, s.id as shop_id, s.name as shop_name, p.business_id, b.name as business_name,
		       p.name, p.sku, p.description, p.unit, p.unit_price as unit_price,
		       p.category_id, p.subcategory_id,
		       COALESCE(sl.name, 'STARTER') as seller_level,
		       COALESCE(st.trust_status, 'NORMAL') as seller_trust,
		       p.created_at,
		       c.name as category_name, c.slug as category_slug,
		       sc.name as subcategory_name, sc.slug as subcategory_slug
		FROM products p
		JOIN businesses b ON b.id = p.business_id
		JOIN shops s ON s.business_id = b.id AND s.status = 'ACTIVE'
		LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = b.id
		LEFT JOIN seller_levels sl ON sl.id = pa.level_id
		LEFT JOIN seller_trust st ON st.business_id = b.id
		LEFT JOIN categories c ON c.id = p.category_id
		LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
		WHERE p.publication_status = 'PUBLISHED' AND p.status = 'ACTIVE'
		AND p.category_id = $1
		AND p.id != $2
		ORDER BY p.name ASC
		LIMIT $3 OFFSET $4
	`

	offset := (page - 1) * limit

	rows, err := r.productRepo.GetDB().QueryContext(ctx, query, sourceProduct.CategoryID, productID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []*models.PublicProductDetailResponse
	for rows.Next() {
		p := &models.PublicProductDetailResponse{}
		var catName, catSlug, subName, subSlug string
		err := rows.Scan(
			&p.ID, &p.ShopID, &p.ShopName, &p.BusinessID, &p.BusinessName,
			&p.Name, &p.SKU, &p.Description, &p.Unit, &p.BasePrice,
			&p.CategoryID, &p.SubcategoryID,
			&p.SellerLevel, &p.SellerTrust, &p.CreatedAt,
			&catName, &catSlug, &subName, &subSlug,
		)
		if err != nil {
			return nil, 0, err
		}

		if p.CategoryID != nil {
			p.Category = &models.CategorySummary{
				ID:   *p.CategoryID,
				Name: catName,
				Slug: catSlug,
			}
		}
		if p.SubcategoryID != nil {
			p.Subcategory = &models.CategorySummary{
				ID:   *p.SubcategoryID,
				Name: subName,
				Slug: subSlug,
			}
		}

		variants, err := r.marketplaceRepo.GetVariantsWithStockForProduct(p.ID)
		if err == nil {
			p.Variants = variants
		}

		if buyerProfileID != nil {
			price, err := r.marketplaceRepo.GetProductPriceForBuyer(p.ID, *buyerProfileID)
			if err == nil {
				p.BuyerLevel = price.BuyerLevel
				p.DiscountPercent = price.DiscountPercent
				p.DiscountAmount = price.DiscountAmount
				p.FinalPrice = price.FinalPrice
				p.FreeDelivery = price.FreeDelivery
				p.DeliveryDiscount = price.DeliveryDiscount
			}
		}

		results = append(results, p)
	}

	countQuery := `
		SELECT COUNT(*) FROM products p
		JOIN businesses b ON b.id = p.business_id
		JOIN shops s ON s.business_id = b.id
		WHERE p.publication_status = 'PUBLISHED' AND p.status = 'ACTIVE'
		AND s.status = 'ACTIVE'
		AND p.category_id = $1
		AND p.id != $2
	`
	var total int
	if err := r.productRepo.GetDB().QueryRowContext(ctx, countQuery, sourceProduct.CategoryID, productID).Scan(&total); err != nil {
		return nil, 0, err
	}

	return results, total, nil
}

func (r *SimilarityRepository) UpdateProductSimilarity(ctx context.Context, productID uuid.UUID, similarProducts []*SimilarProductData) error {
	if r.redisClient == nil || !r.redisClient.IsAvailable(ctx) {
		return fmt.Errorf("redis not available")
	}

	similar := make([]*redislib.SimilarProduct, len(similarProducts))
	for i, sp := range similarProducts {
		similar[i] = &redislib.SimilarProduct{
			ProductID:    sp.ProductID,
			FinalScore:   sp.FinalScore,
			SimilarityScore: sp.SimilarityScore,
			SellerScore:  sp.SellerScore,
		}
	}

	return r.redisClient.SetProductSimilarity(ctx, productID, similar)
}

func (r *SimilarityRepository) RemoveProductSimilarity(ctx context.Context, productID uuid.UUID) error {
	if r.redisClient == nil || !r.redisClient.IsAvailable(ctx) {
		return fmt.Errorf("redis not available")
	}
	return r.redisClient.RemoveProductSimilarity(ctx, productID)
}

func (r *SimilarityRepository) GetAllProductSimilarity(ctx context.Context, productID uuid.UUID) ([]*redislib.SimilarProduct, error) {
	if r.redisClient == nil || !r.redisClient.IsAvailable(ctx) {
		return nil, fmt.Errorf("redis not available")
	}
	return r.redisClient.GetAllProductSimilarity(ctx, productID)
}

func (r *SimilarityRepository) GetProductSimilarityCount(ctx context.Context, productID uuid.UUID) (int64, error) {
	if r.redisClient == nil || !r.redisClient.IsAvailable(ctx) {
		return 0, fmt.Errorf("redis not available")
	}
	return r.redisClient.GetProductSimilarityCount(ctx, productID)
}

type SimilarProductData struct {
	ProductID       uuid.UUID
	SimilarityScore float64
	SellerScore     float64
	FinalScore      float64
}