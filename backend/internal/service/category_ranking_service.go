package service

import (
	"context"
	"fmt"
	"log"

	"github.com/btmi-ai-market/backend/internal/models"
	redislib "github.com/btmi-ai-market/backend/internal/redis"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type CategoryRankingService struct {
	redisClient *redislib.Client
	rankRepo    *repository.RankingRepository
	mpRepo      *repository.MarketplaceRepository
	categoryRepo *repository.CategoryRepository
	pointRepo   *repository.PointAccountRepository
	levelRepo   *repository.LevelRepository
	trustRepo   *repository.SellerTrustRepository
}

func NewCategoryRankingService(
	redisClient *redislib.Client,
	rankRepo *repository.RankingRepository,
	mpRepo *repository.MarketplaceRepository,
	categoryRepo *repository.CategoryRepository,
	pointRepo *repository.PointAccountRepository,
	levelRepo *repository.LevelRepository,
	trustRepo *repository.SellerTrustRepository,
) *CategoryRankingService {
	return &CategoryRankingService{
		redisClient: redisClient,
		rankRepo:    rankRepo,
		mpRepo:      mpRepo,
		categoryRepo: categoryRepo,
		pointRepo:   pointRepo,
		levelRepo:   levelRepo,
		trustRepo:   trustRepo,
	}
}

func (s *CategoryRankingService) RecalculateShopCategoryRanking(ctx context.Context, businessID, shopID uuid.UUID, categoryID uuid.UUID, reason string) error {
	score, err := s.calculateScore(ctx, businessID)
	if err != nil {
		log.Printf("Failed to calculate score for business %s: %v", businessID, err)
		return err
	}

	log.Printf("Recalculating ranking for shop %s in category %s: score=%.2f (reason=%s)", shopID, categoryID, score, reason)

	return s.rankRepo.SetShopRanking(ctx, categoryID, shopID, score)
}

func (s *CategoryRankingService) RecalculateShopAllCategories(ctx context.Context, businessID uuid.UUID, reason string) error {
	shopIDs, err := s.mpRepo.GetShopIDsByBusinessID(businessID)
	if err != nil {
		log.Printf("Failed to get shops for business %s: %v", businessID, err)
		return err
	}

	categories, err := s.mpRepo.GetCategoriesByBusiness(businessID)
	if err != nil {
		log.Printf("Failed to get categories for business %s: %v", businessID, err)
		return err
	}

	score, err := s.calculateScore(ctx, businessID)
	if err != nil {
		log.Printf("Failed to calculate score for business %s: %v", businessID, err)
		return err
	}

	for _, categoryID := range categories {
		for _, shopID := range shopIDs {
			if err := s.rankRepo.SetShopRanking(ctx, categoryID, shopID, score); err != nil {
				log.Printf("Failed to set ranking for shop %s in category %s: %v", shopID, categoryID, err)
			}
		}
	}

	return nil
}

func (s *CategoryRankingService) RebuildCategoryRanking(ctx context.Context, categoryID uuid.UUID) error {
	log.Printf("Rebuilding ranking for category %s", categoryID)

	if err := s.rankRepo.RemoveAllShopsFromCategory(ctx, categoryID); err != nil {
		log.Printf("Failed to clear existing ranking for category %s: %v", categoryID, err)
		return err
	}

	shops, _, err := s.mpRepo.GetCategoryRankingFromPostgres(categoryID, 1, 10000)
	if err != nil {
		log.Printf("Failed to get category ranking from postgres for category %s: %v", categoryID, err)
		return err
	}

	for _, shop := range shops {
		businessID, err := s.mpRepo.GetBusinessIDByShopID(shop.ShopID)
		if err != nil {
			log.Printf("Failed to get business ID for shop %s: %v", shop.ShopID, err)
			continue
		}

		score, err := s.calculateScore(ctx, businessID)
		if err != nil {
			log.Printf("Failed to calculate score for business %s: %v", businessID, err)
			continue
		}

		if err := s.rankRepo.SetShopRanking(ctx, categoryID, shop.ShopID, score); err != nil {
			log.Printf("Failed to set ranking for shop %s: %v", shop.ShopID, err)
		}
	}

	log.Printf("Rebuild complete for category %s: %d shops ranked", categoryID, len(shops))
	return nil
}

func (s *CategoryRankingService) RebuildAllCategories(ctx context.Context) error {
	categories, err := s.categoryRepo.GetAllActive()
	if err != nil {
		return fmt.Errorf("failed to get categories: %w", err)
	}

	for _, cat := range categories {
		if err := s.RebuildCategoryRanking(ctx, cat.ID); err != nil {
			log.Printf("Failed to rebuild category %s: %v", cat.Slug, err)
		}
	}

	log.Printf("All category rankings rebuilt: %d categories", len(categories))
	return nil
}

func (s *CategoryRankingService) RemoveShopFromCategoryIfNoEligibleProducts(ctx context.Context, businessID, shopID, categoryID uuid.UUID) error {
	hasProducts, err := s.mpRepo.HasPublishedProductsInCategory(businessID, categoryID)
	if err != nil {
		return err
	}

	if !hasProducts {
		log.Printf("Shop %s no longer has published products in category %s, removing from ranking", shopID, categoryID)
		return s.rankRepo.RemoveShopFromCategory(ctx, categoryID, shopID)
	}

	return nil
}

func (s *CategoryRankingService) GetCategoryTopShops(ctx context.Context, categorySlug string, page, limit int) ([]*RankedShopInfo, int, error) {
	category, err := s.categoryRepo.GetBySlug(categorySlug)
	if err != nil {
		return nil, 0, err
	}

	shops, total, err := s.rankRepo.GetCategoryRanking(ctx, category.ID, page, limit)
	if err != nil {
		log.Printf("Failed to get category ranking for %s: %v, falling back to postgres", categorySlug, err)
		shops, total, err = s.mpRepo.GetCategoryRankingFromPostgres(category.ID, page, limit)
		if err != nil {
			return nil, 0, err
		}
	}

	result := make([]*RankedShopInfo, 0, len(shops))
	for i, shop := range shops {
		info, err := s.getShopInfo(ctx, shop.ShopID)
		if err != nil {
			log.Printf("Failed to get shop info for %s: %v", shop.ShopID, err)
			continue
		}
		info.RankingScore = shop.RankingScore
		info.RankingPosition = i + 1
		result = append(result, info)
	}

	return result, total, nil
}

type RankedShopInfo struct {
	ShopID          uuid.UUID `json:"shop_id"`
	BusinessID      uuid.UUID `json:"business_id"`
	BusinessName    string    `json:"business_name"`
	Name            string    `json:"name"`
	City            string    `json:"city"`
	SellerLevel     string    `json:"seller_level"`
	SellerTrust     string    `json:"seller_trust"`
	RankingScore    float64   `json:"ranking_score"`
	RankingPosition int       `json:"ranking_position"`
}

func (s *CategoryRankingService) getShopInfo(ctx context.Context, shopID uuid.UUID) (*RankedShopInfo, error) {
	query := `
		SELECT s.id, s.business_id, b.name, s.name, s.city,
		       COALESCE(sl.name, 'STARTER') as seller_level,
		       COALESCE(st.trust_status, 'NORMAL') as seller_trust
		FROM shops s
		JOIN businesses b ON b.id = s.business_id
		LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = s.business_id
		LEFT JOIN seller_levels sl ON sl.id = pa.level_id
		LEFT JOIN seller_trust st ON st.business_id = s.business_id
		WHERE s.id = $1
	`
	shop := &RankedShopInfo{}
	err := s.mpRepo.GetDB().QueryRow(query, shopID).Scan(
		&shop.ShopID, &shop.BusinessID, &shop.BusinessName, &shop.Name, &shop.City,
		&shop.SellerLevel, &shop.SellerTrust,
	)
	if err != nil {
		return nil, err
	}
	return shop, nil
}

func (s *CategoryRankingService) calculateScore(ctx context.Context, businessID uuid.UUID) (float64, error) {
	account, err := s.pointRepo.GetByOwner(models.PointOwnerTypeSellerBusiness, businessID)
	if err != nil {
		return 0, err
	}

	points := 0
	levelName := "STARTER"
	searchBoost := 0.0

	if account != nil {
		points = account.CurrentPoints
		if account.LevelID != nil {
			level, err := s.levelRepo.GetSellerLevelByID(*account.LevelID)
			if err == nil && level != nil {
				levelName = level.Name
				searchBoost = level.SearchBoost
			}
		}
	}

	fallbackLevel, _ := s.levelRepo.GetSellerLevelByPoints(points)
	if points > 0 && (fallbackLevel != nil) {
		searchBoost = fallbackLevel.SearchBoost
	}

	trust, _ := s.trustRepo.GetByBusinessID(businessID)
	trustStatus := "NORMAL"
	if trust != nil {
		trustStatus = trust.TrustStatus
	}

	benefitActive := true
	if trustStatus == "LOW" || trustStatus == "SUSPENDED" {
		benefitActive = false
	}

	score := float64(points) * (1 + searchBoost/100.0)

	if !benefitActive {
		score = float64(points) * 0.5
	}

	log.Printf("Score calc: business=%s, points=%d, level=%s, searchBoost=%.2f, trust=%s, benefitActive=%v, score=%.2f",
		businessID, points, levelName, searchBoost, trustStatus, benefitActive, score)

	return score, nil
}

func (s *CategoryRankingService) GetEligibleCategoriesForShop(businessID, shopID uuid.UUID, reason string) ([]uuid.UUID, error) {
	categories, err := s.mpRepo.GetCategoriesByBusiness(businessID)
	if err != nil {
		return nil, err
	}
	return categories, nil
}

func (s *CategoryRankingService) CalculateShopScore(businessID uuid.UUID) (float64, error) {
	ctx := context.Background()
	return s.calculateScore(ctx, businessID)
}

func (s *CategoryRankingService) UpdateShopRanking(ctx context.Context, categoryID, shopID uuid.UUID, score float64) error {
	return s.rankRepo.SetShopRanking(ctx, categoryID, shopID, score)
}
