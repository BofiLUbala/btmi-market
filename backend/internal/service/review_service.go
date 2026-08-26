package service

import (
	"errors"
	"fmt"
	"strings"

	"github.com/btmi-ai-market/backend/internal/jobs"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
)

type ReviewService struct {
	reviewRepo  *repository.ReviewRepository
	trustRepo   *repository.SellerTrustRepository
	rankingSvc  *CategoryRankingService
	asynqClient *asynq.Client
}

func NewReviewService(
	reviewRepo *repository.ReviewRepository,
	trustRepo *repository.SellerTrustRepository,
	rankingSvc *CategoryRankingService,
	asynqClient *asynq.Client,
) *ReviewService {
	return &ReviewService{
		reviewRepo:  reviewRepo,
		trustRepo:   trustRepo,
		rankingSvc:  rankingSvc,
		asynqClient: asynqClient,
	}
}

// CanBuyerReviewOrder checks if a buyer can review a specific order.
func (s *ReviewService) CanBuyerReviewOrder(buyerProfileID, orderID uuid.UUID) (*models.ReviewEligibilityResponse, error) {
	order, err := s.reviewRepo.GetOrderByIDForReview(orderID)
	if err != nil {
		return &models.ReviewEligibilityResponse{
			Eligible: false,
			Reason:   "ORDER_NOT_FOUND",
		}, nil
	}

	// Must belong to this buyer.
	if order.BuyerProfileID == nil || *order.BuyerProfileID != buyerProfileID {
		return &models.ReviewEligibilityResponse{
			Eligible: false,
			Reason:   "FORBIDDEN",
		}, nil
	}

	// Order must be completed.
	if order.Status != models.OrderStatusCompleted {
		return &models.ReviewEligibilityResponse{
			Eligible: false,
			Reason:   "ORDER_NOT_COMPLETED",
		}, nil
	}

	// Payment must be verified.
	paymentStatus, err := s.reviewRepo.GetPaymentStatus(orderID)
	if err != nil {
		return nil, err
	}
	if paymentStatus != "VERIFIED" {
		return &models.ReviewEligibilityResponse{
			Eligible: false,
			Reason:   "PAYMENT_NOT_VERIFIED",
		}, nil
	}

	// Check if review already exists.
	existingReview, err := s.reviewRepo.GetReviewByOrderID(orderID)
	if err != nil {
		return nil, err
	}
	if existingReview != nil {
		if existingReview.Status == string(models.ReviewStatusWithdrawn) {
			return &models.ReviewEligibilityResponse{
				Eligible:         false,
				Reason:           "REVIEW_WITHDRAWN",
				ExistingReviewID: &existingReview.ID,
			}, nil
		}
		return &models.ReviewEligibilityResponse{
			Eligible:         false,
			Reason:           "REVIEW_ALREADY_EXISTS",
			ExistingReviewID: &existingReview.ID,
		}, nil
	}

	return &models.ReviewEligibilityResponse{
		Eligible: true,
		Reason:   "VERIFIED_COMPLETED_PURCHASE",
	}, nil
}

func (s *ReviewService) CanBuyerReviewLine(buyerProfileID, orderID, lineID uuid.UUID) (*models.ReviewEligibilityResponse, error) {
	base, err := s.CanBuyerReviewOrder(buyerProfileID, orderID)
	if err != nil {
		return nil, err
	}
	if !base.Eligible && base.Reason != "REVIEW_ALREADY_EXISTS" {
		return base, nil
	}
	if _, err = s.reviewRepo.GetOrderLineForReview(orderID, lineID); err != nil {
		return &models.ReviewEligibilityResponse{Eligible: false, Reason: "ORDER_LINE_NOT_FOUND"}, nil
	}
	existing, err := s.reviewRepo.GetReviewByOrderLineID(lineID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return &models.ReviewEligibilityResponse{Eligible: false, Reason: "REVIEW_ALREADY_EXISTS", ExistingReviewID: &existing.ID}, nil
	}
	return &models.ReviewEligibilityResponse{Eligible: true, Reason: "VERIFIED_COMPLETED_PURCHASE"}, nil
}

// CreateReview creates a verified purchase review.
func (s *ReviewService) CreateReview(buyerProfileID, orderID uuid.UUID, req *models.CreateReviewRequest) (*models.ReviewResponse, error) {
	// Validate rating.
	if req.Rating < 1 || req.Rating > 5 {
		return nil, fmt.Errorf("INVALID_RATING: must be between 1 and 5")
	}

	// Trim and validate comment.
	comment := strings.TrimSpace(req.Comment)
	if len(comment) > 1000 {
		return nil, fmt.Errorf("COMMENT_TOO_LONG: maximum 1000 characters")
	}

	lineID, err := uuid.Parse(req.OrderLineID)
	if err != nil {
		return nil, fmt.Errorf("INVALID_ORDER_LINE")
	}
	line, err := s.reviewRepo.GetOrderLineForReview(orderID, lineID)
	if err != nil {
		return nil, err
	}

	// Check order/payment eligibility.
	eligibility, err := s.CanBuyerReviewOrder(buyerProfileID, orderID)
	if err != nil {
		return nil, err
	}
	if !eligibility.Eligible && eligibility.Reason != "REVIEW_ALREADY_EXISTS" {
		return nil, fmt.Errorf("REVIEW_NOT_ELIGIBLE: %s", eligibility.Reason)
	}
	existing, err := s.reviewRepo.GetReviewByOrderLineID(lineID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, fmt.Errorf("REVIEW_NOT_ELIGIBLE: REVIEW_ALREADY_EXISTS")
	}

	// Get order info to derive shop/business.
	order, err := s.reviewRepo.GetOrderByIDForReview(orderID)
	if err != nil {
		return nil, err
	}

	// Create review.
	review := &models.SellerReview{
		OrderID:          orderID,
		BuyerProfileID:   buyerProfileID,
		BusinessID:       order.BusinessID,
		ShopID:           order.ShopID,
		ProductID:        &line.ProductID,
		OrderLineID:      &line.ID,
		VariantID:        &line.VariantID,
		Rating:           req.Rating,
		Comment:          comment,
		VerifiedPurchase: true,
	}

	if err := s.reviewRepo.CreateReview(review); err != nil {
		return nil, err
	}

	// Enqueue background processing.
	s.enqueueReviewProcessing(order.ShopID, order.BusinessID, "review_created")

	return s.toReviewResponse(review), nil
}

// CreateServiceReview records delivery and shop/order experience once per
// completed, payment-verified order. It is intentionally not product-scoped.
func (s *ReviewService) CreateServiceReview(buyerProfileID, orderID uuid.UUID, req *models.CreateServiceReviewRequest) (*models.ReviewResponse, error) {
	for _, rating := range []int{req.DeliveryRating, req.ServiceRating, req.ExperienceRating} {
		if rating < 1 || rating > 5 {
			return nil, fmt.Errorf("INVALID_RATING: must be between 1 and 5")
		}
	}
	comment := strings.TrimSpace(req.Comment)
	if len(comment) > 1000 {
		return nil, fmt.Errorf("COMMENT_TOO_LONG: maximum 1000 characters")
	}
	eligibility, err := s.CanBuyerReviewOrder(buyerProfileID, orderID)
	if err != nil {
		return nil, err
	}
	if !eligibility.Eligible {
		return nil, fmt.Errorf("REVIEW_NOT_ELIGIBLE: %s", eligibility.Reason)
	}
	order, err := s.reviewRepo.GetOrderByIDForReview(orderID)
	if err != nil {
		return nil, err
	}
	overall := (req.DeliveryRating + req.ServiceRating + req.ExperienceRating + 1) / 3
	review := &models.SellerReview{
		OrderID: orderID, BuyerProfileID: buyerProfileID, BusinessID: order.BusinessID,
		ShopID: order.ShopID, Rating: overall, Comment: comment, VerifiedPurchase: true,
		DeliveryRating: &req.DeliveryRating, ServiceRating: &req.ServiceRating,
		ExperienceRating: &req.ExperienceRating,
	}
	if err := s.reviewRepo.CreateServiceReview(review); err != nil {
		return nil, err
	}
	s.enqueueReviewProcessing(order.ShopID, order.BusinessID, "service_review_created")
	return s.toReviewResponse(review), nil
}

// UpdateReview allows buyer to edit their own review.
func (s *ReviewService) UpdateReview(buyerProfileID, reviewID, userID uuid.UUID, req *models.UpdateReviewRequest) (*models.ReviewResponse, error) {
	// Validate rating.
	if req.Rating < 1 || req.Rating > 5 {
		return nil, fmt.Errorf("INVALID_RATING: must be between 1 and 5")
	}

	// Trim and validate comment.
	comment := strings.TrimSpace(req.Comment)
	if len(comment) > 1000 {
		return nil, fmt.Errorf("COMMENT_TOO_LONG: maximum 1000 characters")
	}

	review, err := s.reviewRepo.GetReviewByID(reviewID)
	if err != nil {
		return nil, err
	}

	// Must own the review.
	if review.BuyerProfileID != buyerProfileID {
		return nil, errors.New("FORBIDDEN")
	}

	// Must be active.
	if review.Status != string(models.ReviewStatusActive) {
		return nil, errors.New("REVIEW_NOT_ACTIVE")
	}

	// Update with history.
	_, err = s.reviewRepo.UpdateReview(reviewID, req.Rating, comment, userID)
	if err != nil {
		return nil, err
	}

	// Enqueue background processing.
	s.enqueueReviewProcessing(review.ShopID, review.BusinessID, "review_updated")

	// Re-fetch updated review.
	updated, err := s.reviewRepo.GetReviewByID(reviewID)
	if err != nil {
		return nil, err
	}

	return s.toReviewResponse(updated), nil
}

// WithdrawReview soft-deletes a buyer's review.
func (s *ReviewService) WithdrawReview(buyerProfileID, reviewID uuid.UUID) error {
	review, err := s.reviewRepo.GetReviewByID(reviewID)
	if err != nil {
		return err
	}

	// Must own the review.
	if review.BuyerProfileID != buyerProfileID {
		return errors.New("FORBIDDEN")
	}

	// Must be active.
	if review.Status != string(models.ReviewStatusActive) {
		return errors.New("REVIEW_NOT_ACTIVE")
	}

	if err := s.reviewRepo.WithdrawReview(reviewID); err != nil {
		return err
	}

	// Enqueue background processing.
	s.enqueueReviewProcessing(review.ShopID, review.BusinessID, "review_withdrawn")

	return nil
}

// GetShopReviews gets public reviews for a shop.
func (s *ReviewService) GetShopReviews(shopID uuid.UUID, reviewType, sortBy string, ratingFilter *int, page, perPage int) (*models.ShopReviewsResponse, error) {
	if perPage <= 0 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * perPage

	reviews, total, err := s.reviewRepo.GetReviewsByShopID(shopID, reviewType, sortBy, ratingFilter, offset, perPage)
	if err != nil {
		return nil, err
	}

	agg, err := s.reviewRepo.GetShopReviewAggregate(shopID)
	if err != nil {
		return nil, err
	}

	return &models.ShopReviewsResponse{
		ShopID:  shopID,
		Summary: *agg,
		Reviews: reviews,
		Pagination: models.PaginationInfo{
			Page:    page,
			Limit:   perPage,
			Total:   total,
			HasMore: offset+perPage < total,
		},
	}, nil
}

// GetBuyerReviews gets all reviews by a buyer.
func (s *ReviewService) GetBuyerReviews(buyerProfileID uuid.UUID, page, perPage int) (*models.BuyerReviewsResponse, error) {
	if perPage <= 0 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * perPage

	reviews, total, err := s.reviewRepo.GetReviewsByBuyerProfileID(buyerProfileID, offset, perPage)
	if err != nil {
		return nil, err
	}

	return &models.BuyerReviewsResponse{
		Reviews: reviews,
		Pagination: models.PaginationInfo{
			Page:    page,
			Limit:   perPage,
			Total:   total,
			HasMore: offset+perPage < total,
		},
	}, nil
}

// GetReviewEligibilityForOrder returns eligibility info embedded in order detail.
func (s *ReviewService) GetReviewEligibilityForOrder(buyerProfileID, orderID uuid.UUID) (*models.ReviewEligibilityInOrder, error) {
	eligibility, err := s.CanBuyerReviewOrder(buyerProfileID, orderID)
	if err != nil {
		return nil, err
	}

	result := &models.ReviewEligibilityInOrder{
		ReviewEligible: eligibility.Eligible,
		Reviewed:       eligibility.ExistingReviewID != nil,
		ReviewID:       eligibility.ExistingReviewID,
	}
	return result, nil
}

func (s *ReviewService) enqueueReviewProcessing(shopID, businessID uuid.UUID, reason string) {
	if s.asynqClient == nil {
		return
	}
	payload := jobs.MarshalReviewAggregate(shopID, businessID, reason)
	task := asynq.NewTask(string(jobs.JobTypeProcessReviewAggregate), payload)
	s.asynqClient.Enqueue(task)
}

func (s *ReviewService) toReviewResponse(review *models.SellerReview) *models.ReviewResponse {
	return &models.ReviewResponse{
		ID:               review.ID,
		OrderID:          review.OrderID,
		BuyerProfileID:   review.BuyerProfileID,
		BusinessID:       review.BusinessID,
		ShopID:           review.ShopID,
		ProductID:        review.ProductID,
		OrderLineID:      review.OrderLineID,
		VariantID:        review.VariantID,
		DeliveryRating:   review.DeliveryRating,
		ServiceRating:    review.ServiceRating,
		ExperienceRating: review.ExperienceRating,
		Rating:           review.Rating,
		Comment:          review.Comment,
		VerifiedPurchase: review.VerifiedPurchase,
		Status:           review.Status,
		CreatedAt:        review.CreatedAt,
		UpdatedAt:        review.UpdatedAt,
	}
}

func (s *ReviewService) GetProductReviews(productID uuid.UUID, viewerID *uuid.UUID, sortBy string, rating *int, page, perPage int) (*models.ProductReviewsResponse, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 {
		perPage = 20
	}
	if perPage > 100 {
		perPage = 100
	}
	offset := (page - 1) * perPage
	reviews, summary, total, err := s.reviewRepo.GetProductReviews(productID, viewerID, sortBy, rating, offset, perPage)
	if err != nil {
		return nil, err
	}
	return &models.ProductReviewsResponse{ProductID: productID, Summary: summary, Reviews: reviews, Pagination: models.PaginationInfo{Page: page, Limit: perPage, Total: total, HasMore: offset+perPage < total}}, nil
}

func (s *ReviewService) SetHelpful(reviewID, userID uuid.UUID, helpful bool) (int, error) {
	return s.reviewRepo.SetHelpful(reviewID, userID, helpful)
}

func (s *ReviewService) Reply(reviewID, userID uuid.UUID, body string) (*models.ReviewReplyResponse, error) {
	body = strings.TrimSpace(body)
	if body == "" {
		return nil, fmt.Errorf("REPLY_REQUIRED")
	}
	if len(body) > 1000 {
		return nil, fmt.Errorf("REPLY_TOO_LONG")
	}
	return s.reviewRepo.CreateReply(reviewID, userID, body)
}

// ProcessReviewAggregate handles the background job to recalculate shop aggregates.
func (s *ReviewService) ProcessReviewAggregate(shopID, businessID uuid.UUID) error {
	// Recalculate aggregate
	if _, err := s.reviewRepo.RecalculateShopAggregate(shopID); err != nil {
		return fmt.Errorf("failed to recalculate aggregate: %w", err)
	}

	// Recalculate trust
	if _, err := s.trustRepo.RecalculateTrust(businessID); err != nil {
		return fmt.Errorf("failed to recalculate trust: %w", err)
	}

	return nil
}
