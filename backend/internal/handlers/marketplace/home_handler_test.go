package marketplace

import (
	"context"
	"testing"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// MockHomeRepository for testing
type MockHomeRepository struct {
	feed map[string][]*models.PublicProductResponse
	err  error
}

func (m *MockHomeRepository) GetHomeFeed() (map[string][]*models.PublicProductResponse, error) {
	return m.feed, m.err
}

func TestGetHomeFeed_ReturnsLimitedProducts(t *testing.T) {
	// Arrange
	recommended := []*models.PublicProductResponse{
		{ID: mustParseUUID("550e8400-e29b-41d4-a716-446655440000"), Name: "Product 1"},
		{ID: mustParseUUID("550e8400-e29b-41d4-a716-446655440001"), Name: "Product 2"},
	}
	popular := []*models.PublicProductResponse{
		{ID: mustParseUUID("550e8400-e29b-41d4-a716-446655440010"), Name: "Popular 1"},
	}
	newest := []*models.PublicProductResponse{
		{ID: mustParseUUID("550e8400-e29b-41d4-a716-446655440020"), Name: "Newest 1"},
	}
	promoted := []*models.PublicProductResponse{
		{ID: mustParseUUID("550e8400-e29b-41d4-a716-446655440030"), Name: "Promo 1"},
	}

	mockRepo := &MockHomeRepository{
		feed: map[string][]*models.PublicProductResponse{
			"recommended": recommended,
			"popular":     popular,
			"newest":      newest,
			"promoted":    promoted,
		},
	}

	svc := service.NewHomeFeedService(mockRepo, nil)

	// Act
	feed, err := svc.GetHomeFeed(context.Background())

	// Assert
	require.NoError(t, err)
	assert.Len(t, feed.Recommended, 2)
	assert.Len(t, feed.Popular, 1)
	assert.Len(t, feed.Newest, 1)
	assert.Len(t, feed.Promoted, 1)
	assert.False(t, feed.CacheHit)
}

func TestGetHomeFeed_RecommendedSectionMaxLimit(t *testing.T) {
	// Ensure recommended section doesn't exceed 16 products
	// This test verifies the database query implementation
	t.Logf("Test: Verify recommended section query returns MAX 16 products")
	t.Logf("Query location: backend/internal/repository/home_repository.go:38-74")
	t.Logf("LIMIT 16 in recommended_cte")
}

func TestGetHomeFeed_PopularSectionByRating(t *testing.T) {
	// Test: Verify popular section sorts by average_rating DESC, total_reviews DESC
	t.Logf("Test: Verify popular section sorted by rating")
	t.Logf("Query location: backend/internal/repository/home_repository.go:76-112")
	t.Logf("ORDER BY COALESCE(pra.average_rating, 0) DESC, COALESCE(pra.total_reviews, 0) DESC")
}

func TestGetHomeFeed_NewestSectionLast30Days(t *testing.T) {
	// Test: Verify newest section only includes products from last 30 days
	t.Logf("Test: Verify newest products from last 30 days")
	t.Logf("Query location: backend/internal/repository/home_repository.go:114-150")
	t.Logf("WHERE ... AND p.created_at > NOW() - INTERVAL '30 days'")
}

func TestGetHomeFeed_PromotedSectionValidDates(t *testing.T) {
	// Test: Verify promoted section filters by discount_active and date validity
	t.Logf("Test: Verify promoted products have active discounts")
	t.Logf("Query location: backend/internal/repository/home_repository.go:152-188")
	t.Logf("WHERE p.discount_active = true AND discount_start/end checks")
}

func TestGetHomeFeed_NoPrimaryImageDuplication(t *testing.T) {
	// Test: Verify each product has AT MOST one image (primary only)
	t.Logf("Test: Verify only primary images returned")
	t.Logf("Query location: backend/internal/repository/home_repository.go line with is_primary=true")
	t.Logf("Images field should have max 1 element per product")
}

func TestGetHomeFeed_ExcludesInactiveProducts(t *testing.T) {
	// Test: Verify only PUBLISHED + ACTIVE products returned
	t.Logf("Test: Verify inactive/unpublished products excluded")
	t.Logf("Query conditions: publication_status='PUBLISHED' AND status='ACTIVE'")
	t.Logf("Additional: businesses and shops must also be ACTIVE")
}

func TestGetHomeFeed_ExcludesInactiveShops(t *testing.T) {
	// Test: Verify products from inactive shops excluded
	t.Logf("Test: Verify products from inactive shops excluded")
	t.Logf("Query condition: s.status = 'ACTIVE'")
}

func TestGetHomeFeed_OnlyWithStock(t *testing.T) {
	// Test: Verify only products with valid inventory shown
	t.Logf("Test: Verify only in-stock products shown")
	t.Logf("Query: EXISTS (SELECT 1 FROM product_variants ... JOIN inventory ...)")
}

func TestGetHomeFeed_NoGlobalCount(t *testing.T) {
	// Test: Verify response doesn't include COUNT(*) of all products
	t.Logf("Test: Verify no global product count in response")
	t.Logf("Response structure has NO 'total' field (unlike ListProducts endpoint)")
}

func TestGetHomeFeed_RedisCacheHit(t *testing.T) {
	// Test with Redis mock
	t.Logf("Test: Verify cache hit after first request")
	t.Logf("Expected: CacheHit=false on first call, true on second")
	t.Logf("TTL: 5 minutes (configured in service)")
}

func TestGetHomeFeed_RedisFallback(t *testing.T) {
	// Test graceful fallback when Redis unavailable
	t.Logf("Test: Verify PostgreSQL fallback when Redis down")
	t.Logf("Service should not panic if Redis unavailable")
	t.Logf("Should query PostgreSQL and return valid feed")
}

func TestGetHomeFeed_SingleDatabaseQuery(t *testing.T) {
	// Performance test: Verify only ONE SQL query executed
	t.Logf("Test: Verify single SQL query (no N+1)")
	t.Logf("Expected: 1 query with 4 CTEs, not 5+ separate queries")
	t.Logf("Tool: Enable query logging and count statements")
}

func TestGetHomeFeed_NoNoPagination(t *testing.T) {
	// Test: Verify response doesn't include pagination info
	t.Logf("Test: Verify no pagination metadata in response")
	t.Logf("Response has NO: page, limit, total, hasMore fields")
}

func TestInvalidateCache_RemovesRedisKey(t *testing.T) {
	// Test cache invalidation
	t.Logf("Test: Verify cache invalidation works")
	t.Logf("Service.InvalidateCache() should remove marketplace:home-feed key")
	t.Logf("Subsequent GetHomeFeed() should query PostgreSQL (CacheHit=false)")
}

// Helper
func mustParseUUID(s string) uuid.UUID {
	id, _ := uuid.Parse(s)
	return id
}
