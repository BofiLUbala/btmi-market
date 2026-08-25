package service

import (
	"errors"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/jobs"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
)

type PaymentService struct {
	paymentRepo        *repository.BuyerPaymentRepository
	orderRepo          *repository.OrderRepository
	shopRepo           *repository.ShopRepository
	pointRepo          *repository.PointAccountRepository
	txnRepo            *repository.PointTransactionRepository
	levelRepo          *repository.LevelRepository
	buyerRepo          *repository.BuyerProfileRepository
	configRepo         *repository.PointConfigRepository
	pointRedemptionSvc *PointRedemptionService
	pointService       *PointService
	vtRepo             *repository.VerifiedTransactionRepository
	trustRepo          *repository.SellerTrustRepository
	membershipRepo     *repository.MembershipRepository
	employeeRepo       *repository.EmployeeRepository
	assignmentRepo     *repository.AssignmentRepository
	asynqClient        *asynq.Client
	db                 *database.DB
}

func NewPaymentService(
	paymentRepo *repository.BuyerPaymentRepository,
	orderRepo *repository.OrderRepository,
	shopRepo *repository.ShopRepository,
	pointRepo *repository.PointAccountRepository,
	txnRepo *repository.PointTransactionRepository,
	levelRepo *repository.LevelRepository,
	buyerRepo *repository.BuyerProfileRepository,
	configRepo *repository.PointConfigRepository,
	pointRedemptionSvc *PointRedemptionService,
	pointService *PointService,
	vtRepo *repository.VerifiedTransactionRepository,
	trustRepo *repository.SellerTrustRepository,
	membershipRepo *repository.MembershipRepository,
	employeeRepo *repository.EmployeeRepository,
	assignmentRepo *repository.AssignmentRepository,
	asynqClient *asynq.Client,
	db *database.DB,
) *PaymentService {
	return &PaymentService{
		paymentRepo:        paymentRepo,
		orderRepo:          orderRepo,
		shopRepo:           shopRepo,
		pointRepo:          pointRepo,
		txnRepo:            txnRepo,
		levelRepo:          levelRepo,
		buyerRepo:          buyerRepo,
		configRepo:         configRepo,
		pointRedemptionSvc: pointRedemptionSvc,
		pointService:       pointService,
		vtRepo:             vtRepo,
		trustRepo:          trustRepo,
		membershipRepo:     membershipRepo,
		employeeRepo:       employeeRepo,
		assignmentRepo:     assignmentRepo,
		asynqClient:        asynqClient,
		db:                 db,
	}
}

func (s *PaymentService) requireShopAccess(userID, shopID uuid.UUID) error {
	shop, err := s.shopRepo.GetByID(shopID)
	if err != nil {
		return errors.New("SHOP_NOT_FOUND")
	}

	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, shop.BusinessID)
	if err != nil || membership == nil {
		return errors.New("FORBIDDEN")
	}

	if membership.Role == models.MembershipRoleOwner || membership.Role == models.MembershipRoleAdmin {
		return nil
	}

	employee, err := s.employeeRepo.GetByLinkedUserID(userID)
	if err != nil || employee == nil {
		return errors.New("FORBIDDEN")
	}

	assignment, err := s.assignmentRepo.GetByEmployeeAndShop(employee.ID, shopID)
	if err != nil || assignment == nil {
		return errors.New("FORBIDDEN")
	}

	return nil
}

// CreatePayment creates a CASH payment for an order, deriving every amount from
// the Order + Delivery snapshot. The client never sends amounts.
func (s *PaymentService) CreatePayment(buyerProfileID, orderID uuid.UUID) (*models.BuyerPaymentResponse, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, errors.New("ORDER_NOT_FOUND")
	}
	if order.BuyerProfileID == nil || *order.BuyerProfileID != buyerProfileID {
		return nil, errors.New("FORBIDDEN")
	}
	if order.Status != models.OrderStatusPending && order.Status != models.OrderStatusAccepted {
		return nil, errors.New("INVALID_STATUS_TRANSITION")
	}
	if order.DeliveryMethod == "" {
		return nil, errors.New("DELIVERY_NOT_SELECTED")
	}

	existing, err := s.paymentRepo.GetByOrderID(orderID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return s.toResponse(existing), nil
	}

	cashDue := order.FinalTotal + order.DeliveryFeeFinal
	if cashDue < 0 {
		cashDue = 0
	}

	payment := &models.BuyerPayment{
		OrderID:                orderID,
		BusinessID:             order.BusinessID,
		ShopID:                 order.ShopID,
		BuyerProfileID:         buyerProfileID,
		PaymentMethod:          models.BuyerPaymentMethodCash,
		Currency:               "CDF",
		ProductsBaseTotal:      order.BaseTotal,
		ProductsPointsUsed:     order.PointsUsed,
		ProductsPointsDiscount: order.PointsDiscountAmount,
		ProductsFinalTotal:     order.FinalTotal,
		DeliveryFeeBase:        order.DeliveryFeeBase,
		DeliveryPointsUsed:     order.DeliveryPointsUsed,
		DeliveryPointsDiscount: order.DeliveryPointsDiscount,
		DeliveryFeeFinal:       order.DeliveryFeeFinal,
		CashDue:                cashDue,
		Status:                 models.BuyerPaymentStatusPending,
	}

	if err := s.paymentRepo.Create(payment); err != nil {
		return nil, err
	}

	return s.toResponse(payment), nil
}

func (s *PaymentService) GetPaymentByOrder(buyerProfileID, orderID uuid.UUID) (*models.BuyerPaymentResponse, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, errors.New("ORDER_NOT_FOUND")
	}
	if order.BuyerProfileID == nil || *order.BuyerProfileID != buyerProfileID {
		return nil, errors.New("FORBIDDEN")
	}

	payment, err := s.paymentRepo.GetByOrderID(orderID)
	if err != nil {
		return nil, err
	}
	if payment == nil {
		return nil, errors.New("PAYMENT_NOT_FOUND")
	}
	return s.toResponse(payment), nil
}

// GetPaymentByOrderForSeller returns the same authoritative payment snapshot
// after verifying that the authenticated seller/employee belongs to its Shop.
func (s *PaymentService) GetPaymentByOrderForSeller(userID, orderID uuid.UUID) (*models.BuyerPaymentResponse, error) {
	payment, err := s.paymentRepo.GetByOrderID(orderID)
	if err != nil {
		return nil, err
	}
	if payment == nil {
		return nil, errors.New("PAYMENT_NOT_FOUND")
	}
	if err := s.requireShopAccess(userID, payment.ShopID); err != nil {
		return nil, err
	}
	return s.toResponse(payment), nil
}

func (s *PaymentService) BuyerConfirm(buyerProfileID, paymentID uuid.UUID) (*models.BuyerPaymentResponse, error) {
	payment, err := s.paymentRepo.GetByID(paymentID)
	if err != nil {
		return nil, err
	}
	if payment == nil {
		return nil, errors.New("PAYMENT_NOT_FOUND")
	}
	if payment.BuyerProfileID != buyerProfileID {
		return nil, errors.New("FORBIDDEN")
	}

	if payment.Status == models.BuyerPaymentStatusVerified || payment.BuyerConfirmed {
		return s.toResponse(payment), nil
	}

	now := time.Now()
	payment.BuyerConfirmed = true
	payment.BuyerConfirmedAt = &now

	if payment.SellerConfirmed {
		payment.Status = models.BuyerPaymentStatusVerified
		payment.VerifiedAt = &now
	} else {
		payment.Status = models.BuyerPaymentStatusConfirmed
	}

	if err := s.paymentRepo.Update(payment); err != nil {
		return nil, err
	}
	if payment.Status == models.BuyerPaymentStatusVerified {
		s.enqueueVerified(payment)
	}
	return s.toResponse(payment), nil
}

func (s *PaymentService) SellerConfirm(userID, paymentID uuid.UUID) (*models.BuyerPaymentResponse, error) {
	payment, err := s.paymentRepo.GetByID(paymentID)
	if err != nil {
		return nil, err
	}
	if payment == nil {
		return nil, errors.New("PAYMENT_NOT_FOUND")
	}

	if err := s.requireShopAccess(userID, payment.ShopID); err != nil {
		return nil, err
	}

	if payment.Status == models.BuyerPaymentStatusVerified || payment.SellerConfirmed {
		return s.toResponse(payment), nil
	}

	now := time.Now()
	payment.SellerConfirmed = true
	payment.SellerConfirmedAt = &now

	employee, err := s.employeeRepo.GetByLinkedUserID(userID)
	if err == nil && employee != nil {
		payment.SellerConfirmedBy = &employee.ID
	} else {
		payment.SellerConfirmedBy = &userID
	}

	if payment.BuyerConfirmed {
		payment.Status = models.BuyerPaymentStatusVerified
		payment.VerifiedAt = &now
	} else {
		payment.Status = models.BuyerPaymentStatusConfirmed
	}

	if err := s.paymentRepo.Update(payment); err != nil {
		return nil, err
	}
	if payment.Status == models.BuyerPaymentStatusVerified {
		s.enqueueVerified(payment)
	}
	return s.toResponse(payment), nil
}

func (s *PaymentService) enqueueVerified(payment *models.BuyerPayment) {
	if s.asynqClient == nil {
		return
	}
	payload := jobs.MarshalPaymentVerified(payment.ID)
	task := asynq.NewTask(string(jobs.JobTypeProcessVerifiedPayment), payload)
	_, _ = s.asynqClient.Enqueue(task)
}

// ProcessVerifiedPayment finalizes a verified payment's points. Called by the
// Go worker. Idempotent: awarding is guarded by the CREDIT unique index and
// consumption by the order.points_finalized flag.
func (s *PaymentService) ProcessVerifiedPayment(paymentID uuid.UUID) error {
	payment, err := s.paymentRepo.GetByID(paymentID)
	if err != nil {
		return err
	}
	if payment == nil {
		return errors.New("PAYMENT_NOT_FOUND")
	}
	if payment.Status != models.BuyerPaymentStatusVerified {
		return errors.New("PAYMENT_NOT_VERIFIED")
	}

	order, err := s.orderRepo.GetByID(payment.OrderID)
	if err != nil {
		return errors.New("ORDER_NOT_FOUND")
	}

	if order.PointsFinalized {
		return nil
	}

	earnRate := s.pointRedemptionSvc.GetEarnRate()

	// Award buyer points on eligible merchandise spend only (no delivery fee, no
	// value already paid with old points). Idempotent via the CREDIT unique index.
	if _, err := s.pointService.AwardPointsAtRate(
		models.PointOwnerTypeBuyer,
		payment.BuyerProfileID,
		models.PointTransactionRefVerifiedPurchase,
		payment.ID,
		payment.ProductsFinalTotal,
		earnRate,
	); err != nil && err.Error() != "POINTS_ALREADY_AWARDED" {
		return err
	}

	// Award seller points on the same eligible spend.
	if _, err := s.pointService.AwardPointsAtRate(
		models.PointOwnerTypeSellerBusiness,
		order.BusinessID,
		models.PointTransactionRefVerifiedPurchase,
		payment.ID,
		payment.ProductsFinalTotal,
		earnRate,
	); err != nil && err.Error() != "POINTS_ALREADY_AWARDED" {
		return err
	}

	// Create / verify the verified transaction record (once per order).
	vt, err := s.vtRepo.GetByOrderID(payment.OrderID)
	if err != nil {
		return err
	}
	if vt == nil {
		vt = &models.VerifiedTransaction{
			OrderID:        payment.OrderID,
			BusinessID:     order.BusinessID,
			BuyerProfileID: payment.BuyerProfileID,
			ShopID:         payment.ShopID,
			Amount:         payment.CashDue,
			Currency:       payment.Currency,
			Status:         models.VerifiedTransactionStatusVerified,
		}
		verifiedAt := time.Now()
		vt.VerifiedAt = &verifiedAt
		if err := s.vtRepo.Create(vt); err != nil {
			return err
		}
	} else if vt.Status != models.VerifiedTransactionStatusVerified {
		if err := s.vtRepo.Verify(payment.OrderID, time.Now()); err != nil {
			return err
		}
	}

	// Recalculate seller trust.
	_, _ = s.trustRepo.RecalculateTrust(order.BusinessID)

	// Trigger ranking for the shop.
	if s.asynqClient != nil {
		payload := jobs.MarshalShopCategoryRanking(order.BusinessID, order.ShopID, "verified_sale")
		task := asynq.NewTask(string(jobs.JobTypeRecalculateShopCategoryRanking), payload)
		_, _ = s.asynqClient.Enqueue(task)
	}

	// Consume reserved points (product + delivery) atomically, guarded by the
	// points_finalized flag so a retry cannot double-deduct.
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	txOrderRepo := repository.NewOrderRepository(&database.DB{Tx: tx})
	locked, err := txOrderRepo.GetByIDForUpdate(payment.OrderID)
	if err != nil {
		return err
	}
	if locked.PointsFinalized {
		if err := tx.Commit(); err != nil {
			return err
		}
		return nil
	}

	if locked.PointsUsed > 0 {
		if err := s.pointRedemptionSvc.ConsumeReservedPoints(payment.BuyerProfileID, payment.OrderID, locked.PointsUsed, models.PointTransactionRefRedemptionProduct, &database.DB{Tx: tx}); err != nil {
			return err
		}
	}
	if locked.DeliveryPointsUsed > 0 {
		if err := s.pointRedemptionSvc.ConsumeReservedPoints(payment.BuyerProfileID, payment.OrderID, locked.DeliveryPointsUsed, models.PointTransactionRefRedemptionDelivery, &database.DB{Tx: tx}); err != nil {
			return err
		}
	}

	// Consume reserved inventory (convert reserved_quantity → sold).
	lines, err := s.orderRepo.GetLinesByOrderID(payment.OrderID)
	if err != nil {
		return err
	}
	txInventoryRepo := repository.NewInventoryRepository(&database.DB{Tx: tx})
	for _, line := range lines {
		if _, err := txInventoryRepo.ClaimReservedAtomic(order.ShopID, line.VariantID, line.Quantity); err != nil {
			return err
		}
	}

	if err := txOrderRepo.SetPointsFinalized(payment.OrderID); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	return nil
}

func (s *PaymentService) toResponse(p *models.BuyerPayment) *models.BuyerPaymentResponse {
	shopName := ""
	if shop, err := s.shopRepo.GetByID(p.ShopID); err == nil && shop != nil {
		shopName = shop.Name
	}

	return &models.BuyerPaymentResponse{
		ID:                     p.ID,
		OrderID:                p.OrderID,
		ShopID:                 p.ShopID,
		ShopName:               shopName,
		BuyerProfileID:         p.BuyerProfileID,
		PaymentMethod:          p.PaymentMethod,
		Currency:               p.Currency,
		ProductsBaseTotal:      p.ProductsBaseTotal,
		ProductsPointsUsed:     p.ProductsPointsUsed,
		ProductsPointsDiscount: p.ProductsPointsDiscount,
		ProductsFinalTotal:     p.ProductsFinalTotal,
		DeliveryFeeBase:        p.DeliveryFeeBase,
		DeliveryPointsUsed:     p.DeliveryPointsUsed,
		DeliveryPointsDiscount: p.DeliveryPointsDiscount,
		DeliveryFeeFinal:       p.DeliveryFeeFinal,
		CashDue:                p.CashDue,
		BuyerConfirmed:         p.BuyerConfirmed,
		BuyerConfirmedAt:       p.BuyerConfirmedAt,
		SellerConfirmed:        p.SellerConfirmed,
		SellerConfirmedBy:      p.SellerConfirmedBy,
		SellerConfirmedAt:      p.SellerConfirmedAt,
		Status:                 string(p.Status),
		VerifiedAt:             p.VerifiedAt,
		CreatedAt:              p.CreatedAt,
		UpdatedAt:              p.UpdatedAt,
	}
}
