package redis

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type Client struct {
	client *redis.Client
}

func NewClient(cfg *config.Config) *Client {
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})
	return &Client{client: rdb}
}

func (c *Client) GetRedis() *redis.Client {
	return c.client
}

func (c *Client) Ping(ctx context.Context) error {
	return c.client.Ping(ctx).Err()
}

func (c *Client) Close() error {
	return c.client.Close()
}

func (c *Client) IsAvailable(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
	defer cancel()
	err := c.client.Ping(ctx).Err()
	return err == nil
}

type RankedShop struct {
	ShopID        uuid.UUID `json:"shop_id"`
	RankingScore  float64  `json:"ranking_score"`
	RankingPosition int    `json:"ranking_position"`
}

func (c *Client) keyForCategory(categorySlug string) string {
	return fmt.Sprintf("marketplace:category:%s:shops", categorySlug)
}

func (c *Client) keyForCategoryID(categoryID uuid.UUID) string {
	return fmt.Sprintf("marketplace:category:%s:shops", categoryID.String())
}

func (c *Client) SetShopRanking(ctx context.Context, categoryID uuid.UUID, shopID uuid.UUID, score float64) error {
	key := c.keyForCategoryID(categoryID)
	return c.client.ZAdd(ctx, key, redis.Z{
		Score:  score,
		Member: shopID.String(),
	}).Err()
}

func (c *Client) RemoveShopFromCategory(ctx context.Context, categoryID uuid.UUID, shopID uuid.UUID) error {
	key := c.keyForCategoryID(categoryID)
	return c.client.ZRem(ctx, key, shopID.String()).Err()
}

func (c *Client) RemoveAllShopsFromCategory(ctx context.Context, categoryID uuid.UUID) error {
	key := c.keyForCategoryID(categoryID)
	return c.client.Del(ctx, key).Err()
}

func (c *Client) GetCategoryRanking(ctx context.Context, categoryID uuid.UUID, page, limit int) ([]*RankedShop, int, error) {
	key := c.keyForCategoryID(categoryID)

	total, err := c.client.ZCard(ctx, key).Result()
	if err != nil {
		return nil, 0, err
	}

	start := (page - 1) * limit
	end := start + limit - 1

	results, err := c.client.ZRevRangeWithScores(ctx, key, int64(start), int64(end)).Result()
	if err != nil {
		return nil, 0, err
	}

	var shops []*RankedShop
	for i, z := range results {
		shopID, err := uuid.Parse(z.Member.(string))
		if err != nil {
			log.Printf("WARN: Failed to parse shop ID in ranking: %v", err)
			continue
		}
		shops = append(shops, &RankedShop{
			ShopID:          shopID,
			RankingScore:    z.Score,
			RankingPosition: start + i + 1,
		})
	}

	return shops, int(total), nil
}

func (c *Client) GetShopRankingInCategory(ctx context.Context, categoryID, shopID uuid.UUID) (float64, int, error) {
	key := c.keyForCategoryID(categoryID)

	score, err := c.client.ZScore(ctx, key, shopID.String()).Result()
	if err != nil {
		if err == redis.Nil {
			return 0, -1, nil
		}
		return 0, -1, err
	}

	rank, err := c.client.ZRevRank(ctx, key, shopID.String()).Result()
	if err != nil {
		if err == redis.Nil {
			return score, -1, nil
		}
		return score, -1, err
	}

	return score, int(rank) + 1, nil
}

func (c *Client) GetAllShopsInCategory(ctx context.Context, categoryID uuid.UUID) ([]*RankedShop, error) {
	key := c.keyForCategoryID(categoryID)

	results, err := c.client.ZRevRangeWithScores(ctx, key, 0, -1).Result()
	if err != nil {
		return nil, err
	}

	var shops []*RankedShop
	for i, z := range results {
		shopID, err := uuid.Parse(z.Member.(string))
		if err != nil {
			log.Printf("WARN: Failed to parse shop ID in ranking: %v", err)
			continue
		}
		shops = append(shops, &RankedShop{
			ShopID:          shopID,
			RankingScore:    z.Score,
			RankingPosition: i + 1,
		})
	}

	return shops, nil
}

func (c *Client) SetShopRankingBySlug(ctx context.Context, categorySlug string, shopID uuid.UUID, score float64) error {
	key := c.keyForCategory(categorySlug)
	return c.client.ZAdd(ctx, key, redis.Z{
		Score:  score,
		Member: shopID.String(),
	}).Err()
}

func (c *Client) RemoveAllShopsFromCategoryBySlug(ctx context.Context, categorySlug string) error {
	key := c.keyForCategory(categorySlug)
	return c.client.Del(ctx, key).Err()
}

func (c *Client) GetCategoryRankingBySlug(ctx context.Context, categorySlug string, page, limit int) ([]*RankedShop, int, error) {
	key := c.keyForCategory(categorySlug)

	total, err := c.client.ZCard(ctx, key).Result()
	if err != nil {
		return nil, 0, err
	}

	if total == 0 {
		return nil, 0, nil
	}

	start := (page - 1) * limit
	end := start + limit - 1

	results, err := c.client.ZRevRangeWithScores(ctx, key, int64(start), int64(end)).Result()
	if err != nil {
		return nil, 0, err
	}

	var shops []*RankedShop
	for i, z := range results {
		shopID, err := uuid.Parse(z.Member.(string))
		if err != nil {
			log.Printf("WARN: Failed to parse shop ID in ranking: %v", err)
			continue
		}
		shops = append(shops, &RankedShop{
			ShopID:          shopID,
			RankingScore:    z.Score,
			RankingPosition: start + i + 1,
		})
	}

	return shops, int(total), nil
}

func (c *Client) ParseFloat(s string) float64 {
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return f
}
