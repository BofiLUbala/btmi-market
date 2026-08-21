package service

import (
	"errors"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

type ShopService struct {
	shopRepo       *repository.ShopRepository
	membershipRepo *repository.MembershipRepository
	db             *database.DB
}

func NewShopService(
	shopRepo *repository.ShopRepository,
	membershipRepo *repository.MembershipRepository,
	db *database.DB,
) *ShopService {
	return &ShopService{
		shopRepo:       shopRepo,
		membershipRepo: membershipRepo,
		db:             db,
	}
}

func (s *ShopService) CreateShop(userID, businessID uuid.UUID, req *models.CreateShopRequest) (*models.Shop, error) {
	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil || membership == nil {
		return nil, errors.New("FORBIDDEN")
	}

	if membership.Role != models.MembershipRoleOwner && membership.Role != models.MembershipRoleAdmin {
		return nil, errors.New("FORBIDDEN")
	}

	shop := &models.Shop{
		BusinessID: businessID,
		Name:       req.Name,
		Type:       models.ShopType(req.Type),
		City:       req.City,
		Address:    req.Address,
		Phone:      req.Phone,
		Status:     models.ShopStatusActive,
	}
	if req.SupportsShopDelivery != nil {
		shop.SupportsShopDelivery = *req.SupportsShopDelivery
	}
	shop.ShopDeliveryFee = req.ShopDeliveryFee
	if req.SupportsPartnerDelivery != nil {
		shop.SupportsPartnerDelivery = *req.SupportsPartnerDelivery
	}
	shop.PartnerDeliveryFee = req.PartnerDeliveryFee
	shop.PartnerDeliveryProvider = req.PartnerDeliveryProvider

	if err := s.shopRepo.Create(shop); err != nil {
		return nil, err
	}

	return shop, nil
}

func (s *ShopService) GetShopByID(userID, shopID uuid.UUID) (*models.Shop, error) {
	shop, err := s.shopRepo.GetByID(shopID)
	if err != nil {
		return nil, errors.New("SHOP_NOT_FOUND")
	}

	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, shop.BusinessID)
	if err != nil || membership == nil {
		return nil, errors.New("FORBIDDEN")
	}

	return shop, nil
}

func (s *ShopService) ListShopsByBusiness(userID, businessID uuid.UUID) ([]*models.Shop, error) {
	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil || membership == nil {
		return nil, errors.New("FORBIDDEN")
	}

	return s.shopRepo.GetByBusinessID(businessID)
}

func (s *ShopService) UpdateShop(userID, shopID uuid.UUID, req *models.UpdateShopRequest) (*models.Shop, error) {
	shop, err := s.shopRepo.GetByID(shopID)
	if err != nil {
		return nil, errors.New("SHOP_NOT_FOUND")
	}

	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, shop.BusinessID)
	if err != nil || membership == nil {
		return nil, errors.New("FORBIDDEN")
	}

	if membership.Role != models.MembershipRoleOwner && membership.Role != models.MembershipRoleAdmin {
		return nil, errors.New("FORBIDDEN")
	}

	if req.Name != nil {
		shop.Name = *req.Name
	}
	if req.Type != nil {
		shop.Type = models.ShopType(*req.Type)
	}
	if req.City != nil {
		shop.City = *req.City
	}
	if req.Address != nil {
		shop.Address = *req.Address
	}
	if req.Phone != nil {
		shop.Phone = *req.Phone
	}
	if req.Status != nil {
		shop.Status = models.ShopStatus(*req.Status)
	}
	if req.SupportsShopDelivery != nil {
		shop.SupportsShopDelivery = *req.SupportsShopDelivery
	}
	if req.ShopDeliveryFee != nil {
		shop.ShopDeliveryFee = *req.ShopDeliveryFee
	}
	if req.SupportsPartnerDelivery != nil {
		shop.SupportsPartnerDelivery = *req.SupportsPartnerDelivery
	}
	if req.PartnerDeliveryFee != nil {
		shop.PartnerDeliveryFee = *req.PartnerDeliveryFee
	}
	if req.PartnerDeliveryProvider != nil {
		shop.PartnerDeliveryProvider = *req.PartnerDeliveryProvider
	}

	if err := s.shopRepo.Update(shop); err != nil {
		return nil, err
	}

	return shop, nil
}
