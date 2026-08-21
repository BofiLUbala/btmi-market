package service

import (
	"errors"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/config"
	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/email"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type EmployeeService struct {
	employeeRepo       *repository.EmployeeRepository
	assignmentRepo     *repository.AssignmentRepository
	shopRepo           *repository.ShopRepository
	membershipRepo     *repository.MembershipRepository
	invitationRepo     *repository.EmployeeInvitationRepository
	activationTokenRepo *repository.EmployeeActivationTokenRepository
	userRepo           *repository.UserRepository
	emailService       *email.Service
	config             *config.Config
	db                 *database.DB
}

func NewEmployeeService(
	employeeRepo *repository.EmployeeRepository,
	assignmentRepo *repository.AssignmentRepository,
	shopRepo *repository.ShopRepository,
	membershipRepo *repository.MembershipRepository,
	invitationRepo *repository.EmployeeInvitationRepository,
	activationTokenRepo *repository.EmployeeActivationTokenRepository,
	userRepo *repository.UserRepository,
	emailService *email.Service,
	cfg *config.Config,
	db *database.DB,
) *EmployeeService {
	return &EmployeeService{
		employeeRepo:       employeeRepo,
		assignmentRepo:     assignmentRepo,
		shopRepo:           shopRepo,
		membershipRepo:     membershipRepo,
		invitationRepo:     invitationRepo,
		activationTokenRepo: activationTokenRepo,
		userRepo:           userRepo,
		emailService:       emailService,
		config:             cfg,
		db:                 db,
	}
}

func (s *EmployeeService) CreateEmployee(userID, businessID uuid.UUID, req *models.CreateEmployeeRequest) (*models.Employee, error) {
	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil || membership == nil {
		return nil, errors.New("FORBIDDEN")
	}

	if membership.Role != models.MembershipRoleOwner && membership.Role != models.MembershipRoleAdmin {
		return nil, errors.New("FORBIDDEN")
	}

	employee := &models.Employee{
		BusinessID: businessID,
		FirstName:  req.FirstName,
		MiddleName: req.MiddleName,
		LastName:   req.LastName,
		Phone:      req.Phone,
		Email:      req.Email,
		JobTitle:   req.JobTitle,
		Status:     models.EmployeeStatusActive,
	}

	if err := s.employeeRepo.Create(employee); err != nil {
		return nil, err
	}

	return employee, nil
}

func (s *EmployeeService) GetEmployeeByID(userID, employeeID uuid.UUID) (*models.Employee, error) {
	employee, err := s.employeeRepo.GetByID(employeeID)
	if err != nil {
		return nil, errors.New("EMPLOYEE_NOT_FOUND")
	}

	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, employee.BusinessID)
	if err != nil || membership == nil {
		return nil, errors.New("FORBIDDEN")
	}

	return employee, nil
}

func (s *EmployeeService) ListEmployeesByBusiness(userID, businessID uuid.UUID) ([]*models.Employee, error) {
	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil || membership == nil {
		return nil, errors.New("FORBIDDEN")
	}

	return s.employeeRepo.GetByBusinessID(businessID)
}

func (s *EmployeeService) UpdateEmployee(userID, employeeID uuid.UUID, req *models.UpdateEmployeeRequest) (*models.Employee, error) {
	employee, err := s.employeeRepo.GetByID(employeeID)
	if err != nil {
		return nil, errors.New("EMPLOYEE_NOT_FOUND")
	}

	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, employee.BusinessID)
	if err != nil || membership == nil {
		return nil, errors.New("FORBIDDEN")
	}

	if membership.Role != models.MembershipRoleOwner && membership.Role != models.MembershipRoleAdmin {
		return nil, errors.New("FORBIDDEN")
	}

	if req.FirstName != nil {
		employee.FirstName = *req.FirstName
	}
	if req.MiddleName != nil {
		employee.MiddleName = *req.MiddleName
	}
	if req.LastName != nil {
		employee.LastName = *req.LastName
	}
	if req.Phone != nil {
		employee.Phone = *req.Phone
	}
	if req.Email != nil {
		employee.Email = *req.Email
	}
	if req.JobTitle != nil {
		employee.JobTitle = *req.JobTitle
	}
	if req.Status != nil {
		employee.Status = models.EmployeeStatus(*req.Status)
	}

	if err := s.employeeRepo.Update(employee); err != nil {
		return nil, err
	}

	return employee, nil
}

func (s *EmployeeService) AssignEmployeeToShop(userID, employeeID, shopID uuid.UUID) (*models.EmployeeShopAssignment, error) {
	employee, err := s.employeeRepo.GetByID(employeeID)
	if err != nil {
		return nil, errors.New("EMPLOYEE_NOT_FOUND")
	}

	shop, err := s.shopRepo.GetByID(shopID)
	if err != nil {
		return nil, errors.New("SHOP_NOT_FOUND")
	}

	if employee.BusinessID != shop.BusinessID {
		return nil, errors.New("FORBIDDEN")
	}

	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, employee.BusinessID)
	if err != nil || membership == nil {
		return nil, errors.New("FORBIDDEN")
	}

	if membership.Role != models.MembershipRoleOwner && membership.Role != models.MembershipRoleAdmin {
		return nil, errors.New("FORBIDDEN")
	}

	existingAssignment, _ := s.assignmentRepo.GetByEmployeeAndShop(employeeID, shopID)
	if existingAssignment != nil {
		return nil, errors.New("ALREADY_ASSIGNED")
	}

	assignment := &models.EmployeeShopAssignment{
		EmployeeID: employeeID,
		ShopID:     shopID,
		AssignedBy: userID,
		Status:     models.AssignmentStatusActive,
	}

	if err := s.assignmentRepo.Create(assignment); err != nil {
		return nil, err
	}

	return assignment, nil
}

func (s *EmployeeService) RemoveEmployeeFromShop(userID, employeeID, shopID uuid.UUID) error {
	employee, err := s.employeeRepo.GetByID(employeeID)
	if err != nil {
		return errors.New("EMPLOYEE_NOT_FOUND")
	}

	shop, err := s.shopRepo.GetByID(shopID)
	if err != nil {
		return errors.New("SHOP_NOT_FOUND")
	}

	if employee.BusinessID != shop.BusinessID {
		return errors.New("FORBIDDEN")
	}

	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, employee.BusinessID)
	if err != nil || membership == nil {
		return errors.New("FORBIDDEN")
	}

	if membership.Role != models.MembershipRoleOwner && membership.Role != models.MembershipRoleAdmin {
		return errors.New("FORBIDDEN")
	}

	return s.assignmentRepo.RemoveAssignment(employeeID, shopID)
}

func (s *EmployeeService) ListShopEmployees(userID, shopID uuid.UUID) ([]*models.Employee, error) {
	shop, err := s.shopRepo.GetByID(shopID)
	if err != nil {
		return nil, errors.New("SHOP_NOT_FOUND")
	}

	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, shop.BusinessID)
	if err != nil || membership == nil {
		return nil, errors.New("FORBIDDEN")
	}

	assignments, err := s.assignmentRepo.GetByShopID(shopID)
	if err != nil {
		return nil, err
	}

	var employees []*models.Employee
	for _, assignment := range assignments {
		employee, err := s.employeeRepo.GetByID(assignment.EmployeeID)
		if err != nil {
			continue
		}
		employees = append(employees, employee)
	}

	return employees, nil
}

func (s *EmployeeService) ListEmployeeShops(userID, employeeID uuid.UUID) ([]*models.Shop, error) {
	employee, err := s.employeeRepo.GetByID(employeeID)
	if err != nil {
		return nil, errors.New("EMPLOYEE_NOT_FOUND")
	}

	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, employee.BusinessID)
	if err != nil || membership == nil {
		return nil, errors.New("FORBIDDEN")
	}

	assignments, err := s.assignmentRepo.GetByEmployeeID(employeeID)
	if err != nil {
		return nil, err
	}

	var shops []*models.Shop
	for _, assignment := range assignments {
		shop, err := s.shopRepo.GetByID(assignment.ShopID)
		if err != nil {
			continue
		}
		shops = append(shops, shop)
	}

	return shops, nil
}

func (s *EmployeeService) IsEmployeeAssignedToShop(employeeID, shopID uuid.UUID) bool {
	assignment, err := s.assignmentRepo.GetByEmployeeAndShop(employeeID, shopID)
	return err == nil && assignment != nil
}

func (s *EmployeeService) CreateEmployeeInvitation(userID, businessID, employeeID uuid.UUID) (*models.EmployeeInvitation, string, error) {
	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil || membership == nil {
		return nil, "", errors.New("FORBIDDEN")
	}

	if membership.Role != models.MembershipRoleOwner && membership.Role != models.MembershipRoleAdmin {
		return nil, "", errors.New("FORBIDDEN")
	}

	employee, err := s.employeeRepo.GetByID(employeeID)
	if err != nil {
		return nil, "", errors.New("EMPLOYEE_NOT_FOUND")
	}

	if employee.BusinessID != businessID {
		return nil, "", errors.New("FORBIDDEN")
	}

	if employee.Email == "" {
		return nil, "", errors.New("EMPLOYEE_EMAIL_REQUIRED")
	}

	existingInvitation, _ := s.invitationRepo.GetByEmployeeID(employeeID)
	if existingInvitation != nil && existingInvitation.Status == models.EmployeeInvitationStatusPending {
		if time.Now().Before(existingInvitation.ExpiresAt) {
			return nil, "", errors.New("INVITATION_ALREADY_PENDING")
		}
		if err := s.invitationRepo.InvalidateAllForEmployee(employeeID); err != nil {
			return nil, "", fmt.Errorf("failed to invalidate old invitation: %w", err)
		}
	}

	rawToken, err := GenerateSecureToken(32)
	if err != nil {
		return nil, "", err
	}

	tokenHash := HashToken(rawToken)

	invitation := &models.EmployeeInvitation{
		EmployeeID: employeeID,
		TokenHash:  tokenHash,
		Status:     models.EmployeeInvitationStatusPending,
		ExpiresAt:  time.Now().Add(7 * 24 * time.Hour),
	}

	if err := s.invitationRepo.Create(invitation); err != nil {
		return nil, "", fmt.Errorf("failed to create invitation: %w", err)
	}

	invitationURL := s.emailService.BuildEmployeeInvitationURL(rawToken)
	if err := s.emailService.SendEmployeeInvitationEmail(employee.Email, employee.FirstName, invitationURL); err != nil {
		return nil, "", fmt.Errorf("failed to send invitation email: %w", err)
	}

	return invitation, rawToken, nil
}

func (s *EmployeeService) AcceptEmployeeInvitation(req *models.AcceptEmployeeInvitationRequest) (*models.User, error) {
	if req.Password != req.PasswordConfirm {
		return nil, errors.New("PASSWORD_CONFIRMATION_MISMATCH")
	}

	if len(req.Password) < 8 {
		return nil, errors.New("PASSWORD_TOO_WEAK")
	}

	tokenHash := HashToken(req.Token)

	invitation, err := s.invitationRepo.GetByTokenHash(tokenHash)
	if err != nil {
		return nil, errors.New("INVALID_INVITATION")
	}

	if invitation.Status != models.EmployeeInvitationStatusPending {
		return nil, errors.New("INVALID_INVITATION")
	}

	if time.Now().After(invitation.ExpiresAt) {
		return nil, errors.New("INVITATION_EXPIRED")
	}

	employee, err := s.employeeRepo.GetByID(invitation.EmployeeID)
	if err != nil {
		return nil, errors.New("EMPLOYEE_NOT_FOUND")
	}

	existingUser, err := s.userRepo.GetByEmail(employee.Email)
	if err == nil && existingUser != nil {
		return nil, errors.New("EMAIL_ALREADY_EXISTS")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user := &models.User{
		FirstName:     employee.FirstName,
		MiddleName:    employee.MiddleName,
		LastName:      employee.LastName,
		Phone:         employee.Phone,
		Email:         employee.Email,
		PasswordHash:  string(hashedPassword),
		Status:        models.UserStatusActive,
		EmailVerified: true,
		AccountType:   models.AccountTypeEmployee,
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	employee.LinkedUserID = &user.ID
	if err := s.employeeRepo.Update(employee); err != nil {
		return nil, fmt.Errorf("failed to link employee to user: %w", err)
	}

	now := time.Now()
	if err := s.invitationRepo.UpdateStatus(invitation.ID, models.EmployeeInvitationStatusAccepted, &now); err != nil {
		return nil, fmt.Errorf("failed to update invitation status: %w", err)
	}

	return user, nil
}

func (s *EmployeeService) GetEmployeeByUserID(userID uuid.UUID) (*models.Employee, error) {
	return s.employeeRepo.GetByLinkedUserID(userID)
}

// GetEmployeeWorkspaceByUserID resolves the employee record and assigned shops
// for a logged-in employee user (account_type = EMPLOYEE).
func (s *EmployeeService) GetEmployeeWorkspaceByUserID(userID uuid.UUID) (*models.Employee, []*models.Shop, error) {
	employee, err := s.employeeRepo.GetByLinkedUserID(userID)
	if err != nil {
		return nil, nil, errors.New("EMPLOYEE_NOT_FOUND")
	}

	assignments, err := s.assignmentRepo.GetByEmployeeID(employee.ID)
	if err != nil {
		return nil, nil, err
	}

	var shops []*models.Shop
	for _, assignment := range assignments {
		shop, err := s.shopRepo.GetByID(assignment.ShopID)
		if err != nil {
			continue
		}
		shops = append(shops, shop)
	}

	return employee, shops, nil
}
