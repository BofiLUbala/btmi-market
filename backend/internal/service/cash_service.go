package service

import (
	"errors"
	"fmt"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type CashService struct {
	cashRepo       *repository.CashRepository
	shopRepo       *repository.ShopRepository
	employeeRepo   *repository.EmployeeRepository
	assignmentRepo *repository.AssignmentRepository
	membershipRepo *repository.MembershipRepository
	db             *database.DB
}

func NewCashService(
	cashRepo *repository.CashRepository,
	shopRepo *repository.ShopRepository,
	employeeRepo *repository.EmployeeRepository,
	assignmentRepo *repository.AssignmentRepository,
	membershipRepo *repository.MembershipRepository,
	db *database.DB,
) *CashService {
	return &CashService{
		cashRepo:       cashRepo,
		shopRepo:       shopRepo,
		employeeRepo:   employeeRepo,
		assignmentRepo: assignmentRepo,
		membershipRepo: membershipRepo,
		db:             db,
	}
}

func (s *CashService) requireMembership(userID, businessID uuid.UUID) error {
	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil || membership == nil {
		return errors.New("FORBIDDEN")
	}
	return nil
}

func (s *CashService) requireOwnerOrAdmin(userID, businessID uuid.UUID) error {
	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil || membership == nil {
		return errors.New("FORBIDDEN")
	}
	if membership.Role != models.MembershipRoleOwner && membership.Role != models.MembershipRoleAdmin {
		return errors.New("FORBIDDEN")
	}
	return nil
}

func (s *CashService) requireShopAccess(userID, shopID uuid.UUID) (uuid.UUID, error) {
	shop, err := s.shopRepo.GetByID(shopID)
	if err != nil {
		return uuid.Nil, errors.New("SHOP_NOT_FOUND")
	}

	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, shop.BusinessID)
	if err != nil || membership == nil {
		return uuid.Nil, errors.New("FORBIDDEN")
	}

	return shop.BusinessID, nil
}

func (s *CashService) getEmployeeForUser(userID uuid.UUID) (*models.Employee, error) {
	employee, err := s.employeeRepo.GetByLinkedUserID(userID)
	if err != nil || employee == nil {
		return nil, errors.New("EMPLOYEE_NOT_FOUND")
	}
	return employee, nil
}

func (s *CashService) OpenCashSession(userID uuid.UUID, shopID uuid.UUID, req *models.OpenCashSessionRequest) (*models.CashSession, error) {
	businessID, err := s.requireShopAccess(userID, shopID)
	if err != nil {
		return nil, err
	}

	employee, _ := s.getEmployeeForUser(userID)
	if employee != nil && employee.BusinessID != businessID {
		employee = nil
	}

	if employee == nil {
		membership, memErr := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
		if memErr != nil || membership == nil {
			return nil, errors.New("EMPLOYEE_NOT_FOUND")
		}
		if membership.Role != models.MembershipRoleOwner && membership.Role != models.MembershipRoleAdmin {
			return nil, errors.New("EMPLOYEE_NOT_FOUND")
		}
	}

	var employeeID *uuid.UUID
	if employee != nil {
		employeeID = &employee.ID
		assignment, err := s.assignmentRepo.GetByEmployeeAndShop(employee.ID, shopID)
		if err != nil || assignment == nil {
			return nil, errors.New("EMPLOYEE_NOT_ASSIGNED_TO_SHOP")
		}
	}

	existingSession, _ := s.cashRepo.GetOpenSessionByEmployeeShop(employeeID, shopID)
	if existingSession != nil {
		return nil, errors.New("CASH_SESSION_ALREADY_OPEN")
	}

	session := &models.CashSession{
		BusinessID:    businessID,
		ShopID:        shopID,
		EmployeeID:    employeeID,
		OpeningAmount: req.OpeningAmount,
		Currency:      req.Currency,
	}
	if session.Currency == "" {
		session.Currency = "USD"
	}

	if err := s.cashRepo.CreateSession(session); err != nil {
		return nil, err
	}

	return session, nil
}

func (s *CashService) GetOpenSession(userID uuid.UUID, shopID uuid.UUID) (*models.CashSession, error) {
	if _, err := s.requireShopAccess(userID, shopID); err != nil {
		return nil, err
	}

	employee, _ := s.getEmployeeForUser(userID)

	if employee != nil {
		empID := employee.ID
		session, err := s.cashRepo.GetOpenSessionByEmployeeShop(&empID, shopID)
		if err != nil {
			return nil, errors.New("NO_OPEN_CASH_SESSION")
		}
		return session, nil
	}

	return nil, errors.New("NO_OPEN_CASH_SESSION")
}

func (s *CashService) CloseCashSession(userID, sessionID uuid.UUID, req *models.CloseCashSessionRequest) (*models.CashSession, error) {
	session, err := s.cashRepo.GetSessionByID(sessionID)
	if err != nil {
		return nil, errors.New("CASH_SESSION_NOT_FOUND")
	}

	if _, err := s.requireShopAccess(userID, session.ShopID); err != nil {
		return nil, err
	}

	employee, _ := s.getEmployeeForUser(userID)

	membership, memErr := s.membershipRepo.GetActiveByUserAndBusiness(userID, session.BusinessID)
	isOwnerOrAdmin := memErr == nil && membership != nil &&
		(membership.Role == models.MembershipRoleOwner || membership.Role == models.MembershipRoleAdmin)

	if employee != nil && session.EmployeeID != nil && *session.EmployeeID != employee.ID && !isOwnerOrAdmin {
		return nil, errors.New("FORBIDDEN")
	}
	if employee == nil && !isOwnerOrAdmin {
		return nil, errors.New("FORBIDDEN")
	}

	if session.Status != models.CashSessionStatusOpen {
		return nil, errors.New("CASH_SESSION_NOT_OPEN")
	}

	if err := s.cashRepo.CloseSession(sessionID, req.DeclaredClosingAmount); err != nil {
		return nil, err
	}

	updatedSession, _ := s.cashRepo.GetSessionByID(sessionID)
	return updatedSession, nil
}

func (s *CashService) ReconcileSession(userID, sessionID uuid.UUID) (*models.CashSession, error) {
	session, err := s.cashRepo.GetSessionByID(sessionID)
	if err != nil {
		return nil, errors.New("CASH_SESSION_NOT_FOUND")
	}

	if err := s.requireOwnerOrAdmin(userID, session.BusinessID); err != nil {
		return nil, err
	}

	if session.Status != models.CashSessionStatusClosed {
		return nil, errors.New("CASH_SESSION_NOT_CLOSED")
	}

	if session.DeclaredClosingAmount == nil {
		return nil, errors.New("NO_DECLARED_AMOUNT")
	}

	_ = s.cashRepo.UpdateSessionSalesTotal(sessionID)
	_ = s.cashRepo.RecalculateExpected(sessionID)

	refreshedSession, _ := s.cashRepo.GetSessionByID(sessionID)

	expected := refreshedSession.ExpectedAmount
	actual := *refreshedSession.DeclaredClosingAmount
	diff := actual - expected

	var result string
	if diff == 0 {
		result = "MATCHED"
	} else if diff < 0 {
		result = "SHORTAGE"
	} else {
		result = "OVERAGE"
	}

	if err := s.cashRepo.ReconcileSession(sessionID, diff, result); err != nil {
		return nil, err
	}

	finalSession, _ := s.cashRepo.GetSessionByID(sessionID)
	return finalSession, nil
}

func (s *CashService) GetSessionByID(userID, sessionID uuid.UUID) (*models.CashSession, error) {
	session, err := s.cashRepo.GetSessionByID(sessionID)
	if err != nil {
		return nil, err
	}

	if _, err := s.requireShopAccess(userID, session.ShopID); err != nil {
		return nil, err
	}

	return session, nil
}

func (s *CashService) ListShopSessions(userID, shopID uuid.UUID, page, limit int) ([]models.CashSession, int, error) {
	if _, err := s.requireShopAccess(userID, shopID); err != nil {
		return nil, 0, err
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}
	return s.cashRepo.ListSessionsByShop(shopID, page, limit)
}

func (s *CashService) ListEmployeeSessions(userID, employeeID uuid.UUID, page, limit int) ([]models.CashSession, int, error) {
	employee, err := s.employeeRepo.GetByID(employeeID)
	if err != nil {
		return nil, 0, errors.New("EMPLOYEE_NOT_FOUND")
	}

	if err := s.requireMembership(userID, employee.BusinessID); err != nil {
		return nil, 0, err
	}

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}
	return s.cashRepo.ListSessionsByEmployee(employeeID, page, limit)
}

func (s *CashService) ListBusinessSessions(userID, businessID uuid.UUID, page, limit int) ([]models.CashSession, int, error) {
	if err := s.requireMembership(userID, businessID); err != nil {
		return nil, 0, err
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}
	return s.cashRepo.ListSessionsByBusiness(businessID, page, limit)
}

func (s *CashService) GetBusinessCashSummary(userID, businessID uuid.UUID) (*models.CashSummaryResponse, error) {
	if err := s.requireMembership(userID, businessID); err != nil {
		return nil, err
	}
	return s.cashRepo.GetBusinessCashSummary(businessID)
}

func (s *CashService) GetShopCashSummary(userID, shopID uuid.UUID) (*models.CashSummaryShop, error) {
	if _, err := s.requireShopAccess(userID, shopID); err != nil {
		return nil, err
	}
	return s.cashRepo.GetShopCashSummary(shopID)
}

func (s *CashService) ListShopPayments(userID, shopID uuid.UUID, page, limit int) ([]models.CashPayment, int, error) {
	if _, err := s.requireShopAccess(userID, shopID); err != nil {
		return nil, 0, err
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}
	return s.cashRepo.ListPaymentsByShop(shopID, page, limit)
}

func (s *CashService) GetPaymentByID(userID, paymentID uuid.UUID) (*models.CashPayment, error) {
	payment, err := s.cashRepo.GetPaymentByID(paymentID)
	if err != nil {
		return nil, err
	}

	if _, err := s.requireShopAccess(userID, payment.ShopID); err != nil {
		return nil, err
	}

	return payment, nil
}

func (s *CashService) GetSessionPayments(userID, sessionID uuid.UUID) ([]models.CashPayment, error) {
	session, err := s.cashRepo.GetSessionByID(sessionID)
	if err != nil {
		return nil, err
	}

	if _, err := s.requireShopAccess(userID, session.ShopID); err != nil {
		return nil, err
	}

	return s.cashRepo.GetPaymentsBySession(sessionID)
}

func (s *CashService) CreateCashPaymentFromOrder(order *models.Order, lines []models.OrderLine, employeeID *uuid.UUID) (*models.CashPayment, error) {
	var totalAmount float64
	for _, line := range lines {
		totalAmount += line.UnitPrice * float64(line.Quantity)
	}

	if totalAmount <= 0 {
		return nil, fmt.Errorf("invalid_order_amount")
	}

	var openSession *models.CashSession
	if employeeID != nil {
		openSession, _ = s.cashRepo.GetOpenSessionByEmployeeShop(employeeID, order.ShopID)
	}

	payment := &models.CashPayment{
		BusinessID:    order.BusinessID,
		ShopID:        order.ShopID,
		EmployeeID:    employeeID,
		CustomerID:    order.CustomerID,
		ReferenceType: models.CashReferenceTypeOrder,
		ReferenceID:   order.ID,
		Amount:        totalAmount,
		Currency:      "USD",
		Status:        models.CashPaymentStatusConfirmed,
	}

	if openSession != nil {
		payment.CashSessionID = &openSession.ID
	}

	if err := s.cashRepo.CreatePayment(payment); err != nil {
		return nil, err
	}

	if openSession != nil {
		_ = s.cashRepo.UpdateSessionSalesTotal(openSession.ID)
		_ = s.cashRepo.RecalculateExpected(openSession.ID)
	}

	return payment, nil
}
