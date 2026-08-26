package service

import (
	"database/sql"
	"errors"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

const (
	DefaultEarnRate            = 1000.0
	DefaultRedeemRate          = 1000.0
	DefaultMaxPointCoverage    = 20.0
	DefaultMaxDeliveryCoverage = 100.0
)

type PointRedemptionService struct {
	pointRepo     *repository.PointAccountRepository
	txRepo        *repository.PointTransactionRepository
	levelRepo     *repository.LevelRepository
	productRepo   *repository.ProductRepository
	variantRepo   *repository.VariantRepository
	inventoryRepo *repository.InventoryRepository
	shopRepo      *repository.ShopRepository
	buyerRepo     *repository.BuyerProfileRepository
	configRepo    *repository.PointConfigRepository
}

func NewPointRedemptionService(
	pointRepo *repository.PointAccountRepository,
	txRepo *repository.PointTransactionRepository,
	levelRepo *repository.LevelRepository,
	productRepo *repository.ProductRepository,
	variantRepo *repository.VariantRepository,
	inventoryRepo *repository.InventoryRepository,
	shopRepo *repository.ShopRepository,
	buyerRepo *repository.BuyerProfileRepository,
	configRepo *repository.PointConfigRepository,
) *PointRedemptionService {
	return &PointRedemptionService{
		pointRepo:     pointRepo,
		txRepo:        txRepo,
		levelRepo:     levelRepo,
		productRepo:   productRepo,
		variantRepo:   variantRepo,
		inventoryRepo: inventoryRepo,
		shopRepo:      shopRepo,
		buyerRepo:     buyerRepo,
		configRepo:    configRepo,
	}
}

func (s *PointRedemptionService) GetRedeemRate() float64 {
	return s.configRepo.GetFloat("redeem_rate", DefaultRedeemRate)
}

func (s *PointRedemptionService) GetEarnRate() float64 {
	return s.configRepo.GetFloat("earn_rate", DefaultEarnRate)
}

func (s *PointRedemptionService) GetMaxPointCoveragePercent() float64 {
	return s.configRepo.GetFloat("max_point_coverage", DefaultMaxPointCoverage)
}

func (s *PointRedemptionService) GetMaxPointCoverageDecimal() float64 {
	return s.GetMaxPointCoveragePercent() / 100.0
}

func (s *PointRedemptionService) GetMaxDeliveryPointCoveragePercent() float64 {
	return s.configRepo.GetFloat("max_delivery_point_coverage", DefaultMaxDeliveryCoverage)
}

func (s *PointRedemptionService) GetMaxDeliveryPointCoverageDecimal() float64 {
	return s.GetMaxDeliveryPointCoveragePercent() / 100.0
}

func (s *PointRedemptionService) CalculatePointsDiscount(points int) float64 {
	return float64(points) * s.GetRedeemRate()
}

func (s *PointRedemptionService) getEffectiveVariantPrice(variant *models.ProductVariant, product *models.Product) float64 {
	if product.DiscountActive && (product.DiscountStart == nil || time.Now().After(*product.DiscountStart)) && (product.DiscountEnd == nil || time.Now().Before(*product.DiscountEnd)) {
		if product.DiscountType == "PERCENTAGE" {
			return variant.SalePrice * (1.0 - product.DiscountValue/100.0)
		} else if product.DiscountType == "FIXED" {
			val := variant.SalePrice - product.DiscountValue
			if val < 0 {
				return 0
			}
			return val
		}
	}
	return variant.SalePrice
}

func (s *PointRedemptionService) GetRedemptionPreview(
	buyerProfileID uuid.UUID,
	shopID uuid.UUID,
	items []models.OrderLineInput,
	usePoints bool,
) (*models.PointRedemptionPreviewResponse, error) {
	account, err := s.pointRepo.GetByOwner(models.PointOwnerTypeBuyer, buyerProfileID)
	if err != nil {
		return nil, err
	}
	// A buyer without a point account is a valid zero-points state. Pricing and
	// stock preview must still work so checkout remains available.
	trulyAvailable := 0
	if account != nil {
		trulyAvailable = account.CurrentPoints - account.ReservedPoints
	}
	if trulyAvailable < 0 {
		trulyAvailable = 0
	}

	var baseTotal float64
	for _, item := range items {
		variantID, err := uuid.Parse(item.VariantID)
		if err != nil {
			return nil, errors.New("INVALID_VARIANT_ID")
		}

		variant, err := s.variantRepo.GetByID(variantID)
		if err != nil {
			return nil, errors.New("VARIANT_NOT_FOUND")
		}

		product, err := s.productRepo.GetByID(variant.ProductID)
		if err != nil {
			return nil, errors.New("PRODUCT_NOT_FOUND")
		}

		inv, err := s.inventoryRepo.GetByShopAndVariant(shopID, variantID)
		if err != nil {
			return nil, errors.New("INVENTORY_NOT_FOUND")
		}

		available := inv.Quantity - inv.ReservedQuantity
		if available < item.Quantity {
			return nil, errors.New("INSUFFICIENT_STOCK")
		}

		baseTotal += s.getEffectiveVariantPrice(variant, product) * float64(item.Quantity)
	}

	if !usePoints {
		return &models.PointRedemptionPreviewResponse{
			BaseTotal:            baseTotal,
			PointsUsed:           0,
			PointsDiscountAmount: 0,
			FinalTotal:           baseTotal,
			Currency:             "CDF",
			AvailablePoints:      trulyAvailable,
			MaximumUsablePoints:  0,
			RedeemRate:           s.GetRedeemRate(),
			MaxPointCoverage:     s.GetMaxPointCoveragePercent(),
		}, nil
	}

	maxDiscountByCoverage := baseTotal * s.GetMaxPointCoverageDecimal()
	maxPointsByCoverage := int(maxDiscountByCoverage / s.GetRedeemRate())
	maxPointsByBalance := trulyAvailable

	maximumUsablePoints := maxPointsByCoverage
	if maxPointsByBalance < maximumUsablePoints {
		maximumUsablePoints = maxPointsByBalance
	}
	if maximumUsablePoints < 0 {
		maximumUsablePoints = 0
	}

	pointsDiscountAmount := float64(maximumUsablePoints) * s.GetRedeemRate()
	finalTotal := baseTotal - pointsDiscountAmount
	if finalTotal < 0 {
		finalTotal = 0
	}

	return &models.PointRedemptionPreviewResponse{
		BaseTotal:            baseTotal,
		PointsUsed:           maximumUsablePoints,
		PointsDiscountAmount: pointsDiscountAmount,
		FinalTotal:           finalTotal,
		Currency:             "CDF",
		AvailablePoints:      trulyAvailable,
		MaximumUsablePoints:  maximumUsablePoints,
		RedeemRate:           s.GetRedeemRate(),
		MaxPointCoverage:     s.GetMaxPointCoveragePercent(),
	}, nil
}

func (s *PointRedemptionService) ReservePointsForOrder(
	buyerProfileID uuid.UUID,
	orderID uuid.UUID,
	pointsToUse int,
	refType models.PointTransactionReferenceType,
	db *database.DB,
) error {
	account, err := s.pointRepo.GetByOwner(models.PointOwnerTypeBuyer, buyerProfileID)
	if err != nil {
		return err
	}
	if account == nil {
		return errors.New("NO_POINT_ACCOUNT")
	}

	txPointRepo := repository.NewPointAccountRepository(db)
	txTxnRepo := repository.NewPointTransactionRepository(db)

	reserved, err := txPointRepo.ReserveAtomic(account.ID, pointsToUse)
	if err != nil {
		if err == sql.ErrNoRows {
			return errors.New("INSUFFICIENT_POINTS")
		}
		return err
	}

	txn := &models.PointTransaction{
		PointAccountID: account.ID,
		ReferenceType:  refType,
		ReferenceID:    orderID,
		Type:           models.PointTransactionTypeDebit,
		PointsChange:   pointsToUse,
		PreviousPoints: reserved.CurrentPoints,
		NewPoints:      reserved.CurrentPoints,
	}

	return txTxnRepo.Create(txn)
}

func (s *PointRedemptionService) ReleaseReservedPoints(
	buyerProfileID uuid.UUID,
	orderID uuid.UUID,
	pointsToRelease int,
	refType models.PointTransactionReferenceType,
	db *database.DB,
) error {
	account, err := s.pointRepo.GetByOwner(models.PointOwnerTypeBuyer, buyerProfileID)
	if err != nil {
		return err
	}
	if account == nil {
		return errors.New("NO_POINT_ACCOUNT")
	}

	txPointRepo := repository.NewPointAccountRepository(db)
	txTxnRepo := repository.NewPointTransactionRepository(db)

	released, err := txPointRepo.ReleaseAtomic(account.ID, pointsToRelease)
	if err != nil {
		if err == sql.ErrNoRows {
			return errors.New("INSUFFICIENT_RESERVED_POINTS")
		}
		return err
	}

	txn := &models.PointTransaction{
		PointAccountID: account.ID,
		ReferenceType:  refType,
		ReferenceID:    orderID,
		Type:           models.PointTransactionTypeCredit,
		PointsChange:   pointsToRelease,
		PreviousPoints: released.CurrentPoints,
		NewPoints:      released.CurrentPoints,
	}

	return txTxnRepo.Create(txn)
}

func (s *PointRedemptionService) ConsumeReservedPoints(
	buyerProfileID uuid.UUID,
	orderID uuid.UUID,
	pointsToConsume int,
	refType models.PointTransactionReferenceType,
	db *database.DB,
) error {
	account, err := s.pointRepo.GetByOwner(models.PointOwnerTypeBuyer, buyerProfileID)
	if err != nil {
		return err
	}
	if account == nil {
		return errors.New("NO_POINT_ACCOUNT")
	}

	txPointRepo := repository.NewPointAccountRepository(db)
	txTxnRepo := repository.NewPointTransactionRepository(db)

	consumed, err := txPointRepo.ConsumeAtomic(account.ID, pointsToConsume)
	if err != nil {
		if err == sql.ErrNoRows {
			return errors.New("INSUFFICIENT_RESERVED_POINTS")
		}
		return err
	}

	txn := &models.PointTransaction{
		PointAccountID: account.ID,
		ReferenceType:  refType,
		ReferenceID:    orderID,
		Type:           models.PointTransactionTypeDebit,
		PointsChange:   pointsToConsume,
		PreviousPoints: consumed.CurrentPoints + pointsToConsume,
		NewPoints:      consumed.CurrentPoints,
	}

	return txTxnRepo.Create(txn)
}

// calculateDeliveryPoints computes the delivery point redemption given the
// truly-available balance and the base delivery fee.
func (s *PointRedemptionService) calculateDeliveryPoints(trulyAvailable int, feeBase float64, usePoints bool) (used int, discount float64, feeFinal float64) {
	if feeBase <= 0 {
		return 0, 0, 0
	}
	if !usePoints || trulyAvailable <= 0 {
		return 0, 0, feeBase
	}

	maxDiscountByCoverage := feeBase * s.GetMaxDeliveryPointCoverageDecimal()
	maxPointsByCoverage := int(maxDiscountByCoverage / s.GetRedeemRate())
	maximumUsablePoints := maxPointsByCoverage
	if trulyAvailable < maximumUsablePoints {
		maximumUsablePoints = trulyAvailable
	}
	if maximumUsablePoints < 0 {
		maximumUsablePoints = 0
	}

	discount = float64(maximumUsablePoints) * s.GetRedeemRate()
	feeFinal = feeBase - discount
	if feeFinal < 0 {
		feeFinal = 0
	}
	return maximumUsablePoints, discount, feeFinal
}

// GetDeliveryPointsPreview returns the delivery point redemption preview for an
// order that already has a selected delivery method.
func (s *PointRedemptionService) GetDeliveryPointsPreview(
	buyerProfileID uuid.UUID,
	feeBase float64,
	usePoints bool,
) (*models.DeliveryPointsPreviewResponse, error) {
	account, err := s.pointRepo.GetByOwner(models.PointOwnerTypeBuyer, buyerProfileID)
	if err != nil {
		return nil, err
	}
	if account == nil {
		return nil, errors.New("NO_POINT_ACCOUNT")
	}

	trulyAvailable := account.CurrentPoints - account.ReservedPoints
	if trulyAvailable < 0 {
		trulyAvailable = 0
	}

	used, discount, feeFinal := s.calculateDeliveryPoints(trulyAvailable, feeBase, usePoints)

	return &models.DeliveryPointsPreviewResponse{
		FeeBase:              feeBase,
		PointsUsed:           used,
		PointsDiscountAmount: discount,
		FeeFinal:             feeFinal,
		Currency:             "CDF",
		AvailablePoints:      trulyAvailable,
		MaximumUsablePoints:  used,
		RedeemRate:           s.GetRedeemRate(),
		MaxDeliveryCoverage:  s.GetMaxDeliveryPointCoveragePercent(),
	}, nil
}

// CalculateDeliveryPointsSelection computes how many delivery points may be used
// given the current balance and base fee. Used by delivery selection before the
// reservation is made.
func (s *PointRedemptionService) CalculateDeliveryPointsSelection(
	buyerProfileID uuid.UUID,
	feeBase float64,
	usePoints bool,
) (used int, discount float64, feeFinal float64, available int, err error) {
	account, err := s.pointRepo.GetByOwner(models.PointOwnerTypeBuyer, buyerProfileID)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	if account == nil {
		return 0, 0, 0, 0, errors.New("NO_POINT_ACCOUNT")
	}

	trulyAvailable := account.CurrentPoints - account.ReservedPoints
	if trulyAvailable < 0 {
		trulyAvailable = 0
	}

	used, discount, feeFinal = s.calculateDeliveryPoints(trulyAvailable, feeBase, usePoints)
	return used, discount, feeFinal, trulyAvailable, nil
}

func (s *PointRedemptionService) CalculateOrderTotals(
	items []models.OrderLineInput,
	shopID uuid.UUID,
) (float64, error) {
	var total float64
	for _, item := range items {
		variantID, err := uuid.Parse(item.VariantID)
		if err != nil {
			return 0, errors.New("INVALID_VARIANT_ID")
		}

		variant, err := s.variantRepo.GetByID(variantID)
		if err != nil {
			return 0, errors.New("VARIANT_NOT_FOUND")
		}

		product, err := s.productRepo.GetByID(variant.ProductID)
		if err != nil {
			return 0, errors.New("PRODUCT_NOT_FOUND")
		}

		inv, err := s.inventoryRepo.GetByShopAndVariant(shopID, variantID)
		if err != nil {
			return 0, errors.New("INVENTORY_NOT_FOUND")
		}

		available := inv.Quantity - inv.ReservedQuantity
		if available < item.Quantity {
			return 0, errors.New("INSUFFICIENT_STOCK")
		}

		total += s.getEffectiveVariantPrice(variant, product) * float64(item.Quantity)
	}
	return total, nil
}
