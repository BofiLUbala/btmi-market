package service

import (
	"database/sql"
	"errors"
	"math"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type CommissionService struct {
	commRepo     *repository.CommissionRepository
	orderRepo    *repository.OrderRepository
	paymentRepo  *repository.BuyerPaymentRepository
	businessRepo *repository.BusinessRepository
}

func NewCommissionService(
	commRepo *repository.CommissionRepository,
	orderRepo *repository.OrderRepository,
	paymentRepo *repository.BuyerPaymentRepository,
	businessRepo *repository.BusinessRepository,
) *CommissionService {
	return &CommissionService{
		commRepo:     commRepo,
		orderRepo:    orderRepo,
		paymentRepo:  paymentRepo,
		businessRepo: businessRepo,
	}
}

// GetConfig returns the active platform commission rate and historical rate changes.
func (s *CommissionService) GetConfig() (*models.CommissionConfig, error) {
	rate, err := s.commRepo.GetCommissionRate()
	if err != nil {
		return nil, err
	}
	history, err := s.commRepo.GetRateHistory()
	if err != nil {
		history = []models.CommissionHistory{}
	}
	return &models.CommissionConfig{
		Rate:    rate,
		History: history,
	}, nil
}

// UpdateConfig allows FINANCE_SUPPORT_ADMIN or SUPER_ADMIN to change the platform rate.
func (s *CommissionService) UpdateConfig(adminID uuid.UUID, adminRole models.AdminRole, newRate float64, reason string) (*models.CommissionConfig, error) {
	if adminRole != models.AdminRoleFinanceSupportAdmin && adminRole != models.AdminRoleSuperAdmin {
		return nil, errors.New("FORBIDDEN: Only Finance Admin or Super Admin can modify platform commission configuration")
	}

	if newRate < 0 || newRate > 100 {
		return nil, errors.New("INVALID_RATE: Commission rate must be between 0% and 100%")
	}

	oldRate, err := s.commRepo.GetCommissionRate()
	if err != nil {
		oldRate = 3.00
	}

	if math.Abs(oldRate-newRate) < 0.001 {
		return s.GetConfig()
	}

	if err := s.commRepo.UpdateCommissionRate(oldRate, newRate, adminID, reason); err != nil {
		return nil, err
	}

	return s.GetConfig()
}

// CalculateAndRecordCommission calculates the TBK platform commission for a verified order and saves a per-sale snapshot.
func (s *CommissionService) CalculateAndRecordCommission(orderID uuid.UUID) (*models.SaleCommission, error) {
	// Check if commission already calculated for this order (idempotency)
	existing, err := s.commRepo.GetByOrderID(orderID)
	if err == nil && existing != nil {
		return existing, nil
	}

	// Fetch order details
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, err
	}

	// Fetch payment details
	payment, err := s.paymentRepo.GetByOrderID(orderID)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// Commission base is merchandise total after discounts (EXCLUDES delivery fees!).
	// gross_amount is kept equal to that base so the reporting invariant
	// GROSS - COMMISSION = SELLER NET always holds; the delivery fee is the
	// seller's to keep and reported separately in buyer_payments.cash_due.
	grossAmount := models.RoundMoney(order.BaseTotal - order.PointsDiscountAmount)
	commissionBase := grossAmount
	if payment != nil {
		grossAmount = payment.ProductsFinalTotal
		commissionBase = grossAmount
	}
	if commissionBase < 0 {
		commissionBase = 0
		grossAmount = 0
	}

	// Fetch current rate
	rate, err := s.commRepo.GetCommissionRate()
	if err != nil {
		rate = 3.00
	}

	// Calculate commission amount and seller net
	commissionAmount := models.PercentOf(commissionBase, rate)
	sellerNet := models.RoundMoney(commissionBase - commissionAmount)
	if sellerNet < 0 {
		sellerNet = 0
	}

	var paymentID *uuid.UUID
	if payment != nil {
		paymentID = &payment.ID
	}

	comm := &models.SaleCommission{
		ID:               uuid.New(),
		OrderID:          order.ID,
		OrderNumber:      order.OrderNumber,
		PaymentID:        paymentID,
		BusinessID:       order.BusinessID,
		ShopID:           order.ShopID,
		SellerUserID:     order.CreatedBy,
		GrossAmount:      grossAmount,
		CommissionBase:   commissionBase,
		CommissionRate:   rate,
		CommissionAmount: commissionAmount,
		SellerNetAmount:  sellerNet,
		// The commission is a slice of this order, so it is in the order's
		// currency - never re-labelled by whoever reads the report later.
		Currency:     orderCurrency(order),
		Status:       models.CommissionStatusDue,
		CalculatedAt: time.Now(),
	}

	if err := s.commRepo.CreateCommission(comm); err != nil {
		return nil, err
	}

	return s.commRepo.GetByOrderID(order.ID)
}

// GetSummary returns Finance Admin aggregate KPI statistics.
func (s *CommissionService) GetSummary(filter *models.CommissionFilter) (*models.CommissionSummary, error) {
	return s.commRepo.GetSummary(filter)
}

// GetDashboardReport returns the real-totals finance dashboard (gross,
// commission, seller net, collected/due/waived, cash collected, pipeline).
func (s *CommissionService) GetDashboardReport(filter *models.FinanceReportFilter) (*models.FinanceDashboardReport, error) {
	return s.commRepo.GetDashboardReport(filter)
}

// GetBreakdownReport returns the finance dashboard grouped by shop, product,
// seller or business for the same filter.
func (s *CommissionService) GetBreakdownReport(group models.FinanceBreakdownGroup, filter *models.FinanceReportFilter) ([]models.FinanceBreakdownItem, error) {
	return s.commRepo.GetBreakdownReport(group, filter)
}

// ListCommissions lists per-sale commission records for Finance Admin.
func (s *CommissionService) ListCommissions(filter *models.CommissionFilter) ([]models.SaleCommission, int, error) {
	return s.commRepo.ListCommissions(filter)
}

// MarkCollected allows Finance Admin to mark a commission as collected from seller.
func (s *CommissionService) MarkCollected(adminID uuid.UUID, adminRole models.AdminRole, commissionID uuid.UUID, notes string) error {
	if adminRole != models.AdminRoleFinanceSupportAdmin && adminRole != models.AdminRoleSuperAdmin {
		return errors.New("FORBIDDEN: Only Finance Admin or Super Admin can mark commission as collected")
	}
	return s.commRepo.MarkCollected(commissionID, adminID, notes)
}

// VoidForRefund waives the commission attached to a refunded order so refunded
// sales never count as revenue. Safe to call whether or not a snapshot exists.
func (s *CommissionService) VoidForRefund(orderID uuid.UUID, notes string) error {
	return s.commRepo.VoidCommissionForRefund(orderID, notes)
}

// GetSellerSummary computes aggregate financial summary for a seller user.
func (s *CommissionService) GetSellerSummary(userID uuid.UUID) (*models.SellerFinanceSummary, error) {
	businessIDs, err := s.getSellerBusinessIDs(userID)
	if err != nil {
		return nil, err
	}
	return s.commRepo.GetSellerSummary(businessIDs)
}

// GetSellerDashboardReport returns the real-totals dashboard scoped to the
// businesses the seller belongs to.
func (s *CommissionService) GetSellerDashboardReport(userID uuid.UUID, filter *models.FinanceReportFilter) (*models.FinanceDashboardReport, error) {
	businessIDs, err := s.getSellerBusinessIDs(userID)
	if err != nil {
		return nil, err
	}
	if len(businessIDs) == 0 {
		return &models.FinanceDashboardReport{}, nil
	}
	filter.BusinessID = businessIDs[0].String()
	return s.commRepo.GetDashboardReport(filter)
}

// GetSellerBreakdownReport returns the grouped report scoped to the seller's
// businesses.
func (s *CommissionService) GetSellerBreakdownReport(userID uuid.UUID, group models.FinanceBreakdownGroup, filter *models.FinanceReportFilter) ([]models.FinanceBreakdownItem, error) {
	businessIDs, err := s.getSellerBusinessIDs(userID)
	if err != nil {
		return nil, err
	}
	if len(businessIDs) == 0 {
		return []models.FinanceBreakdownItem{}, nil
	}
	filter.BusinessID = businessIDs[0].String()
	return s.commRepo.GetBreakdownReport(group, filter)
}

// ListSellerSales lists per-sale financial records for a seller user.
func (s *CommissionService) ListSellerSales(userID uuid.UUID, filter *models.CommissionFilter) ([]models.SaleCommission, int, error) {
	businessIDs, err := s.getSellerBusinessIDs(userID)
	if err != nil {
		return nil, 0, err
	}
	if len(businessIDs) == 0 {
		return []models.SaleCommission{}, 0, nil
	}
	filter.BusinessID = businessIDs[0].String()
	return s.commRepo.ListCommissions(filter)
}

// GetSellerSaleDetail retrieves per-sale financial detail for a seller.
func (s *CommissionService) GetSellerSaleDetail(userID uuid.UUID, orderID uuid.UUID) (*models.SaleCommission, error) {
	comm, err := s.commRepo.GetByOrderID(orderID)
	if err != nil {
		return nil, err
	}
	if comm == nil {
		return nil, errors.New("COMMISSION_NOT_FOUND")
	}

	businessIDs, err := s.getSellerBusinessIDs(userID)
	if err != nil {
		return nil, err
	}

	authorized := false
	for _, bID := range businessIDs {
		if bID == comm.BusinessID {
			authorized = true
			break
		}
	}

	if !authorized {
		return nil, errors.New("FORBIDDEN")
	}

	return comm, nil
}

func (s *CommissionService) getSellerBusinessIDs(userID uuid.UUID) ([]uuid.UUID, error) {
	businesses, err := s.businessRepo.GetByUserID(userID)
	if err != nil {
		return nil, err
	}
	var ids []uuid.UUID
	for _, b := range businesses {
		ids = append(ids, b.ID)
	}
	return ids, nil
}
