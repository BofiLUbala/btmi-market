package jobs

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type JobType string

const (
	JobTypeRecalculateShopCategoryRanking JobType = "ranking:shop_category:recalculate"
	JobTypeRebuildCategoryRanking        JobType = "ranking:category:rebuild"
	JobTypePeriodicConsistencyCheck      JobType = "ranking:consistency_check"
	JobTypeRecalculateProductSimilarity  JobType = "similarity:product:recalculate"
	JobTypeRebuildProductSimilarity      JobType = "similarity:product:rebuild"
	JobTypeRebuildAllProductSimilarity   JobType = "similarity:product:rebuild_all"
	JobTypeProcessVerifiedPayment       JobType = "payment:process_verified"
	JobTypeProcessReviewAggregate       JobType = "review:aggregate:recalculate"
)

type ShopCategoryRankingPayload struct {
	BusinessID uuid.UUID `json:"business_id"`
	ShopID     uuid.UUID `json:"shop_id"`
	Reason     string    `json:"reason"`
}

type CategoryRebuildPayload struct {
	CategoryID uuid.UUID `json:"category_id"`
}

type ConsistencyCheckPayload struct {
	FullRebuild bool `json:"full_rebuild"`
}

type ProductSimilarityPayload struct {
	ProductID uuid.UUID `json:"product_id"`
	Reason    string    `json:"reason"`
}

type ProductSimilarityRebuildPayload struct {
	ProductID uuid.UUID `json:"product_id"`
}

type ProductSimilarityRebuildAllPayload struct {
	CategoryID *uuid.UUID `json:"category_id,omitempty"`
}

type PaymentVerifiedPayload struct {
	PaymentID uuid.UUID `json:"payment_id"`
}

type ReviewAggregatePayload struct {
	ShopID     uuid.UUID `json:"shop_id"`
	BusinessID uuid.UUID `json:"business_id"`
	Reason     string    `json:"reason"`
}

func MarshalReviewAggregate(shopID, businessID uuid.UUID, reason string) []byte {
	p := ReviewAggregatePayload{ShopID: shopID, BusinessID: businessID, Reason: reason}
	b, _ := json.Marshal(p)
	return b
}

func UnmarshalReviewAggregate(b []byte) (*ReviewAggregatePayload, error) {
	var p ReviewAggregatePayload
	err := json.Unmarshal(b, &p)
	return &p, err
}

func MarshalPaymentVerified(paymentID uuid.UUID) []byte {
	p := PaymentVerifiedPayload{PaymentID: paymentID}
	b, _ := json.Marshal(p)
	return b
}

func UnmarshalPaymentVerified(b []byte) (*PaymentVerifiedPayload, error) {
	var p PaymentVerifiedPayload
	err := json.Unmarshal(b, &p)
	return &p, err
}

func MarshalShopCategoryRanking(businessID, shopID uuid.UUID, reason string) []byte {
	p := ShopCategoryRankingPayload{
		BusinessID: businessID,
		ShopID:     shopID,
		Reason:     reason,
	}
	b, _ := json.Marshal(p)
	return b
}

func UnmarshalShopCategoryRanking(b []byte) (*ShopCategoryRankingPayload, error) {
	var p ShopCategoryRankingPayload
	err := json.Unmarshal(b, &p)
	return &p, err
}

func MarshalCategoryRebuild(categoryID uuid.UUID) []byte {
	p := CategoryRebuildPayload{
		CategoryID: categoryID,
	}
	b, _ := json.Marshal(p)
	return b
}

func UnmarshalCategoryRebuild(b []byte) (*CategoryRebuildPayload, error) {
	var p CategoryRebuildPayload
	err := json.Unmarshal(b, &p)
	return &p, err
}

func MarshalConsistencyCheck(fullRebuild bool) []byte {
	p := ConsistencyCheckPayload{
		FullRebuild: fullRebuild,
	}
	b, _ := json.Marshal(p)
	return b
}

func UnmarshalConsistencyCheck(b []byte) (*ConsistencyCheckPayload, error) {
	var p ConsistencyCheckPayload
	err := json.Unmarshal(b, &p)
	return &p, err
}

func MarshalProductSimilarity(productID uuid.UUID, reason string) []byte {
	p := ProductSimilarityPayload{
		ProductID: productID,
		Reason:    reason,
	}
	b, _ := json.Marshal(p)
	return b
}

func UnmarshalProductSimilarity(b []byte) (*ProductSimilarityPayload, error) {
	var p ProductSimilarityPayload
	err := json.Unmarshal(b, &p)
	return &p, err
}

func MarshalProductSimilarityRebuild(productID uuid.UUID) []byte {
	p := ProductSimilarityRebuildPayload{
		ProductID: productID,
	}
	b, _ := json.Marshal(p)
	return b
}

func UnmarshalProductSimilarityRebuild(b []byte) (*ProductSimilarityRebuildPayload, error) {
	var p ProductSimilarityRebuildPayload
	err := json.Unmarshal(b, &p)
	return &p, err
}

func MarshalProductSimilarityRebuildAll(categoryID *uuid.UUID) []byte {
	p := ProductSimilarityRebuildAllPayload{
		CategoryID: categoryID,
	}
	b, _ := json.Marshal(p)
	return b
}

func UnmarshalProductSimilarityRebuildAll(b []byte) (*ProductSimilarityRebuildAllPayload, error) {
	var p ProductSimilarityRebuildAllPayload
	err := json.Unmarshal(b, &p)
	return &p, err
}

func Now() time.Time {
	return time.Now()
}
