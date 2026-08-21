package service

import (
	"errors"
	"time"

	"github.com/btmi-ai-market/backend/internal/jobs"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
)

type PurchaseConfirmationService struct {
	confirmRepo *repository.PurchaseConfirmationRepository
	vtRepo      *repository.VerifiedTransactionRepository
	orderRepo   *repository.OrderRepository
	shopRepo    *repository.ShopRepository
	cashRepo    *repository.CashRepository
	pointService *PointService
	trustRepo   *repository.SellerTrustRepository
	asynqClient *asynq.Client
}

func NewPurchaseConfirmationService(
	confirmRepo *repository.PurchaseConfirmationRepository,
	vtRepo      *repository.VerifiedTransactionRepository,
	orderRepo   *repository.OrderRepository,
	shopRepo    *repository.ShopRepository,
	cashRepo    *repository.CashRepository,
	pointService *PointService,
	trustRepo   *repository.SellerTrustRepository,
	asynqClient *asynq.Client,
) *PurchaseConfirmationService {
	return &PurchaseConfirmationService{
		confirmRepo: confirmRepo,
		vtRepo:      vtRepo,
		orderRepo:   orderRepo,
		shopRepo:    shopRepo,
		cashRepo:    cashRepo,
		pointService: pointService,
		trustRepo:   trustRepo,
		asynqClient: asynqClient,
	}
}

func (s *PurchaseConfirmationService) GetPendingPurchases(buyerProfileID uuid.UUID) ([]*models.PendingPurchaseResponse, error) {
	return s.confirmRepo.GetPendingByBuyer(buyerProfileID)
}

func (s *PurchaseConfirmationService) ConfirmPurchase(buyerProfileID, orderID uuid.UUID) (*models.VerifiedTransactionResponse, error) {
	// Check if already confirmed
	existing, _ := s.confirmRepo.GetByOrderAndBuyer(orderID, buyerProfileID)
	if existing != nil {
		return nil, errors.New("ALREADY_CONFIRMED")
	}

	// Check order exists and is completed
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, errors.New("ORDER_NOT_FOUND")
	}
	if order.Status != models.OrderStatusCompleted {
		return nil, errors.New("ORDER_NOT_COMPLETED")
	}

	// Get cash payment for this order
	payments, err := s.cashRepo.GetPaymentsByOrder(orderID)
	if err != nil || len(payments) == 0 {
		return nil, errors.New("NO_CASH_PAYMENT_FOUND")
	}
	cashPayment := payments[0]

	// Create purchase confirmation
	pc := &models.PurchaseConfirmation{
		OrderID:        orderID,
		BuyerProfileID: buyerProfileID,
		CashPaymentID:  &cashPayment.ID,
	}
	if err := s.confirmRepo.Create(pc); err != nil {
		return nil, err
	}

	// Create or update verified transaction
	vt, _ := s.vtRepo.GetByOrderID(orderID)
	if vt == nil {
		vt = &models.VerifiedTransaction{
			OrderID:        orderID,
			BusinessID:     order.BusinessID,
			BuyerProfileID: buyerProfileID,
			ShopID:         order.ShopID,
			Amount:         cashPayment.Amount,
			Currency:       cashPayment.Currency,
			Status:         models.VerifiedTransactionStatusPending,
		}
		if err := s.vtRepo.Create(vt); err != nil {
			return nil, err
		}
	}

	// Check if this order has any other buyer confirmations
	// For now, we treat the first confirmation as the verified one
	// Verify the transaction
	verifiedAt := time.Now()
	if err := s.vtRepo.Verify(orderID, verifiedAt); err != nil {
		return nil, err
	}

	// Award points to seller (business)
	sellerPoints, err := s.pointService.AwardPoints(
		models.PointOwnerTypeSellerBusiness,
		order.BusinessID,
		models.PointTransactionRefVerifiedPurchase,
		orderID,
		cashPayment.Amount,
	)
	if err == nil && sellerPoints > 0 {
		_ = s.vtRepo.MarkPointsAwardedSeller(orderID)

		// Enqueue ranking job for the shop
		if s.asynqClient != nil {
			payload := jobs.MarshalShopCategoryRanking(order.BusinessID, order.ShopID, "verified_sale")
			task := asynq.NewTask(string(jobs.JobTypeRecalculateShopCategoryRanking), payload)
			_, _ = s.asynqClient.Enqueue(task)
		}
	}

	// Award points to buyer
	buyerPoints, err := s.pointService.AwardPoints(
		models.PointOwnerTypeBuyer,
		buyerProfileID,
		models.PointTransactionRefVerifiedPurchase,
		orderID,
		cashPayment.Amount,
	)
	if err == nil && buyerPoints > 0 {
		_ = s.vtRepo.MarkPointsAwardedBuyer(orderID)
	}

	// Recalculate seller trust
	_, _ = s.trustRepo.RecalculateTrust(order.BusinessID)

	// Get shop and business names
	shop, _ := s.shopRepo.GetByID(order.ShopID)

	return &models.VerifiedTransactionResponse{
		ID:             vt.ID,
		OrderID:        vt.OrderID,
		BusinessID:     vt.BusinessID,
		BuyerProfileID: vt.BuyerProfileID,
		ShopID:         vt.ShopID,
		ShopName:       shop.Name,
		Amount:         vt.Amount,
		Currency:       vt.Currency,
		Status:         "VERIFIED",
		VerifiedAt:     &verifiedAt,
		CreatedAt:      vt.CreatedAt,
	}, nil
}

func (s *PurchaseConfirmationService) RefundTransaction(buyerProfileID, orderID uuid.UUID) error {
	vt, err := s.vtRepo.GetByOrderID(orderID)
	if err != nil || vt == nil {
		return errors.New("VERIFIED_TRANSACTION_NOT_FOUND")
	}

	if vt.Status == models.VerifiedTransactionStatusRefunded {
		return errors.New("ALREADY_REFUNDED")
	}

	if vt.BuyerProfileID != buyerProfileID {
		return errors.New("FORBIDDEN")
	}

	refundedAt := time.Now()
	if err := s.vtRepo.Refund(orderID, refundedAt); err != nil {
		return err
	}

	// Debit seller points
	_ = s.pointService.DebitPoints(
		models.PointOwnerTypeSellerBusiness,
		vt.BusinessID,
		models.PointTransactionRefRefund,
		orderID,
		int(vt.Amount/PointsPerCDF),
	)

	// Enqueue ranking job for the shop after points change
	if s.asynqClient != nil {
		// Get shop ID from verified transaction
		shopID := vt.ShopID
		if shopID != uuid.Nil {
			payload := jobs.MarshalShopCategoryRanking(vt.BusinessID, shopID, "refund")
			task := asynq.NewTask(string(jobs.JobTypeRecalculateShopCategoryRanking), payload)
			_, _ = s.asynqClient.Enqueue(task)
		}
	}

	// Debit buyer points
	_ = s.pointService.DebitPoints(
		models.PointOwnerTypeBuyer,
		vt.BuyerProfileID,
		models.PointTransactionRefRefund,
		orderID,
		int(vt.Amount/PointsPerCDF),
	)

	// Recalculate trust
	_, _ = s.trustRepo.RecalculateTrust(vt.BusinessID)

	return nil
}

func (s *PurchaseConfirmationService) GetVerifiedTransaction(orderID uuid.UUID) (*models.VerifiedTransaction, error) {
	return s.vtRepo.GetByOrderID(orderID)
}
