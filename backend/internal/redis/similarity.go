package redis

import (
	"context"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type SimilarProduct struct {
	ProductID     uuid.UUID `json:"product_id"`
	SimilarityScore float64 `json:"similarity_score"`
	SellerScore   float64 `json:"seller_score"`
	FinalScore    float64 `json:"final_score"`
}

func (c *Client) keyForProductSimilarity(productID uuid.UUID) string {
	return fmt.Sprintf("marketplace:similar:product:%s", productID.String())
}

func (c *Client) SetProductSimilarity(ctx context.Context, productID uuid.UUID, similar []*SimilarProduct) error {
	key := c.keyForProductSimilarity(productID)

	if len(similar) == 0 {
		return c.client.Del(ctx, key).Err()
	}

	pipe := c.client.Pipeline()
	pipe.Del(ctx, key)

	zs := make([]redis.Z, len(similar))
	for i, p := range similar {
		zs[i] = redis.Z{
			Score:  p.FinalScore,
			Member: p.ProductID.String(),
		}
	}
	pipe.ZAdd(ctx, key, zs...)

	_, err := pipe.Exec(ctx)
	return err
}

func (c *Client) GetProductSimilarity(ctx context.Context, productID uuid.UUID, page, limit int) ([]*SimilarProduct, int, error) {
	key := c.keyForProductSimilarity(productID)

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

	var products []*SimilarProduct
	for _, z := range results {
		productID, err := uuid.Parse(z.Member.(string))
		if err != nil {
			log.Printf("WARN: Failed to parse product ID in similarity: %v", err)
			continue
		}
		products = append(products, &SimilarProduct{
			ProductID:     productID,
			FinalScore:    z.Score,
			SimilarityScore: 0,
			SellerScore:   0,
		})
	}

	return products, int(total), nil
}

func (c *Client) RemoveProductSimilarity(ctx context.Context, productID uuid.UUID) error {
	key := c.keyForProductSimilarity(productID)
	return c.client.Del(ctx, key).Err()
}

func (c *Client) GetAllProductSimilarity(ctx context.Context, productID uuid.UUID) ([]*SimilarProduct, error) {
	key := c.keyForProductSimilarity(productID)

	results, err := c.client.ZRevRangeWithScores(ctx, key, 0, -1).Result()
	if err != nil {
		return nil, err
	}

	var products []*SimilarProduct
	for _, z := range results {
		productID, err := uuid.Parse(z.Member.(string))
		if err != nil {
			log.Printf("WARN: Failed to parse product ID in similarity: %v", err)
			continue
		}
		products = append(products, &SimilarProduct{
			ProductID:     productID,
			FinalScore:    z.Score,
			SimilarityScore: 0,
			SellerScore:   0,
		})
	}

	return products, nil
}

func (c *Client) GetProductSimilarityCount(ctx context.Context, productID uuid.UUID) (int64, error) {
	key := c.keyForProductSimilarity(productID)
	return c.client.ZCard(ctx, key).Result()
}