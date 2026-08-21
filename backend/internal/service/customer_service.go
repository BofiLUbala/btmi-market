package service

import (
	"errors"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type CustomerService struct {
	customerRepo  *repository.CustomerRepository
	shopRepo      *repository.ShopRepository
	membershipRepo *repository.MembershipRepository
	db            *database.DB
}

func NewCustomerService(
	customerRepo *repository.CustomerRepository,
	shopRepo *repository.ShopRepository,
	membershipRepo *repository.MembershipRepository,
	db *database.DB,
) *CustomerService {
	return &CustomerService{
		customerRepo:  customerRepo,
		shopRepo:      shopRepo,
		membershipRepo: membershipRepo,
		db:            db,
	}
}

func (s *CustomerService) requireMembership(userID, businessID uuid.UUID) error {
	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil || membership == nil {
		return errors.New("FORBIDDEN")
	}
	return nil
}

func (s *CustomerService) CreateCustomer(userID, businessID uuid.UUID, req *models.CreateCustomerRequest) (*models.CustomerResponse, error) {
	if err := s.requireMembership(userID, businessID); err != nil {
		return nil, err
	}

	if req.Phone != nil && *req.Phone != "" {
		existing, err := s.customerRepo.GetByBusinessAndPhone(businessID, *req.Phone)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return nil, errors.New("CUSTOMER_EXISTS")
		}
	}

	if req.Email != nil && *req.Email != "" {
		existing, err := s.customerRepo.GetByBusinessAndEmail(businessID, *req.Email)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return nil, errors.New("CUSTOMER_EXISTS")
		}
	}

	customer := &models.Customer{
		BusinessID: businessID,
		FirstName:  req.FirstName,
		LastName:   req.LastName,
		Phone:      req.Phone,
		Email:      req.Email,
		Status:     models.CustomerStatusActive,
	}

	if err := s.customerRepo.Create(customer); err != nil {
		return nil, err
	}

	return s.toResponse(customer), nil
}

func (s *CustomerService) GetCustomer(userID, customerID uuid.UUID) (*models.CustomerSummaryResponse, error) {
	customer, err := s.customerRepo.GetByID(customerID)
	if err != nil {
		return nil, errors.New("CUSTOMER_NOT_FOUND")
	}

	if err := s.requireMembership(userID, customer.BusinessID); err != nil {
		return nil, err
	}

	return s.customerRepo.GetCustomerSummary(customerID)
}

func (s *CustomerService) UpdateCustomer(userID, customerID uuid.UUID, req *models.UpdateCustomerRequest) (*models.CustomerResponse, error) {
	customer, err := s.customerRepo.GetByID(customerID)
	if err != nil {
		return nil, errors.New("CUSTOMER_NOT_FOUND")
	}

	if err := s.requireMembership(userID, customer.BusinessID); err != nil {
		return nil, err
	}

	if req.FirstName != nil {
		customer.FirstName = *req.FirstName
	}
	if req.LastName != nil {
		customer.LastName = *req.LastName
	}
	if req.Phone != nil {
		if *req.Phone != "" {
			existing, err := s.customerRepo.GetByBusinessAndPhone(customer.BusinessID, *req.Phone)
			if err != nil {
				return nil, err
			}
			if existing != nil && existing.ID != customerID {
				return nil, errors.New("CUSTOMER_EXISTS")
			}
		}
		customer.Phone = req.Phone
	}
	if req.Email != nil {
		if *req.Email != "" {
			existing, err := s.customerRepo.GetByBusinessAndEmail(customer.BusinessID, *req.Email)
			if err != nil {
				return nil, err
			}
			if existing != nil && existing.ID != customerID {
				return nil, errors.New("CUSTOMER_EXISTS")
			}
		}
		customer.Email = req.Email
	}
	if req.Status != nil {
		customer.Status = models.CustomerStatus(*req.Status)
	}

	if err := s.customerRepo.Update(customer); err != nil {
		return nil, err
	}

	return s.toResponse(customer), nil
}

func (s *CustomerService) ListBusinessCustomers(userID, businessID uuid.UUID, search string, page, limit int) (*models.CustomerListResponse, error) {
	if err := s.requireMembership(userID, businessID); err != nil {
		return nil, err
	}

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}

	customers, total, err := s.customerRepo.ListByBusiness(businessID, search, page, limit)
	if err != nil {
		return nil, err
	}

	summaries := make([]models.CustomerSummaryResponse, 0, len(customers))
	for _, c := range customers {
		summary, err := s.customerRepo.GetCustomerSummary(c.ID)
		if err != nil {
			continue
		}
		summaries = append(summaries, *summary)
	}

	return &models.CustomerListResponse{
		Data: summaries,
		Pagination: models.PaginationInfo{
			Page:  page,
			Limit: limit,
			Total: total,
		},
	}, nil
}

func (s *CustomerService) GetCustomerOrders(userID, customerID uuid.UUID, shopID *uuid.UUID, status string, from, to *time.Time, page, limit int) (*models.PaginatedCustomerOrders, error) {
	customer, err := s.customerRepo.GetByID(customerID)
	if err != nil {
		return nil, errors.New("CUSTOMER_NOT_FOUND")
	}

	if err := s.requireMembership(userID, customer.BusinessID); err != nil {
		return nil, err
	}

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}

	orders, total, err := s.customerRepo.GetCustomerOrders(customerID, shopID, status, from, to, page, limit)
	if err != nil {
		return nil, err
	}

	return &models.PaginatedCustomerOrders{
		Data: orders,
		Pagination: models.PaginationInfo{
			Page:  page,
			Limit: limit,
			Total: total,
		},
	}, nil
}

func (s *CustomerService) FindOrCreateCustomer(businessID uuid.UUID, phone, email, firstName, lastName string) (*models.Customer, error) {
	if phone != "" {
		existing, err := s.customerRepo.GetByBusinessAndPhone(businessID, phone)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return existing, nil
		}
	}

	if email != "" {
		existing, err := s.customerRepo.GetByBusinessAndEmail(businessID, email)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return existing, nil
		}
	}

	customer := &models.Customer{
		BusinessID: businessID,
		FirstName:  firstName,
		LastName:   lastName,
		Status:     models.CustomerStatusActive,
	}
	if phone != "" {
		customer.Phone = &phone
	}
	if email != "" {
		customer.Email = &email
	}

	if err := s.customerRepo.Create(customer); err != nil {
		return nil, err
	}

	return customer, nil
}

func (s *CustomerService) toResponse(c *models.Customer) *models.CustomerResponse {
	return &models.CustomerResponse{
		ID:         c.ID,
		BusinessID: c.BusinessID,
		FirstName:  c.FirstName,
		LastName:   c.LastName,
		Phone:      c.Phone,
		Email:      c.Email,
		Status:     string(c.Status),
		CreatedAt:  c.CreatedAt,
		UpdatedAt:  c.UpdatedAt,
	}
}
