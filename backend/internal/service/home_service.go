package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/redis/go-redis/v9"
)

// HomeFeedSource is what the feed needs from storage (implemented by
// repository.HomeRepository; tests pass an in-memory fake).
type HomeFeedSource interface {
	GetHomeFeed() (map[string][]*models.PublicProductResponse, error)
}

var _ HomeFeedSource = (*repository.HomeRepository)(nil)

// HomeFeedService orchestrates the homepage feed with Redis caching.
// Strategy: Try Redis → Fallback to PostgreSQL → Cache in Redis
type HomeFeedService struct {
	homeRepo    HomeFeedSource
	redisClient *redis.Client
	cacheTTL    time.Duration
}

func NewHomeFeedService(
	homeRepo HomeFeedSource,
	redisClient *redis.Client,
) *HomeFeedService {
	return &HomeFeedService{
		homeRepo:    homeRepo,
		redisClient: redisClient,
		cacheTTL:    5 * time.Minute,
	}
}

// HomeFeedResponse is the API response structure for the homepage feed.
type HomeFeedResponse struct {
	Recommended []*models.PublicProductResponse `json:"recommended"`
	Popular     []*models.PublicProductResponse `json:"popular"`
	Newest      []*models.PublicProductResponse `json:"newest"`
	Promoted    []*models.PublicProductResponse `json:"promoted"`
	CachedAt    time.Time                       `json:"cached_at"`
	CacheHit    bool                            `json:"cache_hit"`
}

const redisKeyHomeFeed = "marketplace:home-feed"

// GetHomeFeed returns the homepage feed, using Redis cache when available.
// Fallback to PostgreSQL if Redis is unavailable or miss.
func (s *HomeFeedService) GetHomeFeed(ctx context.Context) (*HomeFeedResponse, error) {
	// Attempt 1: Try Redis cache
	cached, err := s.getFromRedis(ctx)
	if err == nil && cached != nil {
		cached.CacheHit = true
		return cached, nil
	}

	// Fallback 2: Query PostgreSQL
	sections, err := s.homeRepo.GetHomeFeed()
	if err != nil {
		return nil, fmt.Errorf("home feed query failed: %w", err)
	}

	// Build response
	response := &HomeFeedResponse{
		Recommended: sections["recommended"],
		Popular:     sections["popular"],
		Newest:      sections["newest"],
		Promoted:    sections["promoted"],
		CachedAt:    time.Now(),
		CacheHit:    false,
	}

	// Cache in Redis (non-blocking)
	go s.cacheInRedis(context.Background(), response)

	return response, nil
}

// InvalidateCache removes the homepage feed from Redis cache.
// Called when products are modified (new promotion, new product, etc).
func (s *HomeFeedService) InvalidateCache(ctx context.Context) error {
	if s.redisClient == nil {
		return nil
	}
	return s.redisClient.Del(ctx, redisKeyHomeFeed).Err()
}

// getFromRedis attempts to retrieve the cached feed from Redis.
// Returns nil if cache miss or Redis unavailable.
func (s *HomeFeedService) getFromRedis(ctx context.Context) (*HomeFeedResponse, error) {
	if s.redisClient == nil {
		return nil, fmt.Errorf("redis not configured")
	}

	ctx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
	defer cancel()

	val, err := s.redisClient.Get(ctx, redisKeyHomeFeed).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil // Cache miss
		}
		return nil, err // Redis error (but not fatal)
	}

	var response HomeFeedResponse
	if err := json.Unmarshal([]byte(val), &response); err != nil {
		return nil, err
	}

	return &response, nil
}

// cacheInRedis stores the feed in Redis with TTL.
// Non-blocking operation; errors are logged but not returned.
func (s *HomeFeedService) cacheInRedis(ctx context.Context, response *HomeFeedResponse) {
	if s.redisClient == nil {
		return
	}

	ctx, cancel := context.WithTimeout(ctx, 1*time.Second)
	defer cancel()

	data, err := json.Marshal(response)
	if err != nil {
		return
	}

	_ = s.redisClient.Set(ctx, redisKeyHomeFeed, data, s.cacheTTL).Err()
}

// SetCacheTTL allows configuration of cache duration (useful for testing).
func (s *HomeFeedService) SetCacheTTL(ttl time.Duration) {
	s.cacheTTL = ttl
}
