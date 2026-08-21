package repository

import (
	"context"
	"fmt"
	"log"

	redislib "github.com/btmi-ai-market/backend/internal/redis"
	"github.com/google/uuid"
)

type RankingRepository struct {
	redisClient *redislib.Client
	pgFallback  *MarketplaceRepository
}

func NewRankingRepository(redisClient *redislib.Client, marketplaceRepo *MarketplaceRepository) *RankingRepository {
	return &RankingRepository{
		redisClient: redisClient,
		pgFallback:  marketplaceRepo,
	}
}

func (r *RankingRepository) GetCategoryRanking(ctx context.Context, categoryID uuid.UUID, page, limit int) ([]*redislib.RankedShop, int, error) {
	if r.redisClient == nil || !r.redisClient.IsAvailable(ctx) {
		log.Printf("Redis unavailable for category ranking, using PostgreSQL fallback")
		return r.getCategoryRankingFromPostgres(categoryID, page, limit)
	}

	shops, total, err := r.redisClient.GetCategoryRanking(ctx, categoryID, page, limit)
	if err != nil {
		log.Printf("Redis error getting category ranking: %v, falling back to PostgreSQL", err)
		return r.getCategoryRankingFromPostgres(categoryID, page, limit)
	}

	if len(shops) == 0 && total == 0 {
		return r.getCategoryRankingFromPostgres(categoryID, page, limit)
	}

	return shops, total, nil
}

func (r *RankingRepository) getCategoryRankingFromPostgres(categoryID uuid.UUID, page, limit int) ([]*redislib.RankedShop, int, error) {
	return r.pgFallback.GetCategoryRankingFromPostgres(categoryID, page, limit)
}

func (r *RankingRepository) SetShopRanking(ctx context.Context, categoryID, shopID uuid.UUID, score float64) error {
	if r.redisClient == nil || !r.redisClient.IsAvailable(ctx) {
		return fmt.Errorf("redis not available")
	}
	return r.redisClient.SetShopRanking(ctx, categoryID, shopID, score)
}

func (r *RankingRepository) RemoveShopFromCategory(ctx context.Context, categoryID, shopID uuid.UUID) error {
	if r.redisClient == nil || !r.redisClient.IsAvailable(ctx) {
		return fmt.Errorf("redis not available")
	}
	return r.redisClient.RemoveShopFromCategory(ctx, categoryID, shopID)
}

func (r *RankingRepository) RemoveAllShopsFromCategory(ctx context.Context, categoryID uuid.UUID) error {
	if r.redisClient == nil || !r.redisClient.IsAvailable(ctx) {
		return fmt.Errorf("redis not available")
	}
	return r.redisClient.RemoveAllShopsFromCategory(ctx, categoryID)
}

func (r *RankingRepository) GetAllShopsInCategory(ctx context.Context, categoryID uuid.UUID) ([]*redislib.RankedShop, error) {
	if r.redisClient == nil || !r.redisClient.IsAvailable(ctx) {
		log.Printf("Redis unavailable, using PostgreSQL fallback for all shops in category")
		return r.getAllShopsInCategoryFromPostgres(categoryID)
	}

	shops, err := r.redisClient.GetAllShopsInCategory(ctx, categoryID)
	if err != nil {
		log.Printf("Redis error getting all shops in category: %v, falling back to PostgreSQL", err)
		return r.getAllShopsInCategoryFromPostgres(categoryID)
	}

	if len(shops) == 0 {
		return r.getAllShopsInCategoryFromPostgres(categoryID)
	}

	return shops, nil
}

func (r *RankingRepository) getAllShopsInCategoryFromPostgres(categoryID uuid.UUID) ([]*redislib.RankedShop, error) {
	return r.pgFallback.GetAllShopsInCategoryFromPostgres(categoryID)
}

func (r *RankingRepository) GetShopRankingInCategory(ctx context.Context, categoryID, shopID uuid.UUID) (float64, int, error) {
	if r.redisClient == nil || !r.redisClient.IsAvailable(ctx) {
		return 0, 0, fmt.Errorf("redis not available")
	}
	return r.redisClient.GetShopRankingInCategory(ctx, categoryID, shopID)
}
