package service

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/jobs"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
)

type InventoryService struct {
	inventoryRepo     *repository.InventoryRepository
	stockMovementRepo *repository.StockMovementRepository
	shopRepo          *repository.ShopRepository
	productRepo       *repository.ProductRepository
	variantRepo       *repository.VariantRepository
	receiptRepo       *repository.ReceiptRepository
	assignmentRepo    *repository.AssignmentRepository
	membershipRepo    *repository.MembershipRepository
	employeeRepo      *repository.EmployeeRepository
	categoryRepo      *repository.CategoryRepository
	db                *database.DB
	stockEvents       []models.StockEvent
	eventsMutex       sync.RWMutex
	asynqClient       *asynq.Client
}

func NewInventoryService(
	inventoryRepo *repository.InventoryRepository,
	stockMovementRepo *repository.StockMovementRepository,
	shopRepo *repository.ShopRepository,
	productRepo *repository.ProductRepository,
	variantRepo *repository.VariantRepository,
	receiptRepo *repository.ReceiptRepository,
	assignmentRepo *repository.AssignmentRepository,
	membershipRepo *repository.MembershipRepository,
	employeeRepo *repository.EmployeeRepository,
	categoryRepo *repository.CategoryRepository,
	db *database.DB,
	asynqClient *asynq.Client,
) *InventoryService {
	return &InventoryService{
		inventoryRepo:     inventoryRepo,
		stockMovementRepo: stockMovementRepo,
		shopRepo:          shopRepo,
		productRepo:       productRepo,
		variantRepo:       variantRepo,
		receiptRepo:       receiptRepo,
		assignmentRepo:    assignmentRepo,
		membershipRepo:    membershipRepo,
		employeeRepo:      employeeRepo,
		categoryRepo:      categoryRepo,
		db:                db,
		stockEvents:       make([]models.StockEvent, 0),
		asynqClient:       asynqClient,
	}
}

func (s *InventoryService) requireOwnerOrAdmin(userID, businessID uuid.UUID) error {
	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil || membership == nil {
		return errors.New("FORBIDDEN")
	}
	if membership.Role != models.MembershipRoleOwner && membership.Role != models.MembershipRoleAdmin {
		return errors.New("FORBIDDEN")
	}
	return nil
}

func (s *InventoryService) requireMembership(userID, businessID uuid.UUID) error {
	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil || membership == nil {
		return errors.New("FORBIDDEN")
	}
	return nil
}

// requireShopAccess allows the action when the caller is an OWNER/ADMIN member
// of the shop's business OR an employee actively assigned to that shop.
func (s *InventoryService) requireShopAccess(userID, shopID uuid.UUID) error {
	shop, err := s.shopRepo.GetByID(shopID)
	if err != nil {
		return errors.New("SHOP_NOT_FOUND")
	}

	membership, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, shop.BusinessID)
	if err == nil && membership != nil {
		if membership.Role == models.MembershipRoleOwner || membership.Role == models.MembershipRoleAdmin {
			return nil
		}
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

func (s *InventoryService) validateBusinessBoundary(shopID, businessID uuid.UUID) error {
	shop, err := s.shopRepo.GetByID(shopID)
	if err != nil {
		return errors.New("SHOP_NOT_FOUND")
	}
	if shop.BusinessID != businessID {
		return errors.New("FORBIDDEN")
	}
	return nil
}

func (s *InventoryService) validateVariantBusiness(variantID, businessID uuid.UUID) (*models.ProductVariant, error) {
	variant, err := s.variantRepo.GetByID(variantID)
	if err != nil {
		return nil, errors.New("VARIANT_NOT_FOUND")
	}
	product, err := s.productRepo.GetByID(variant.ProductID)
	if err != nil {
		return nil, errors.New("PRODUCT_NOT_FOUND")
	}
	if product.BusinessID != businessID {
		return nil, errors.New("FORBIDDEN")
	}
	return variant, nil
}

func (s *InventoryService) validateEmployeeAssignment(employeeID, shopID, businessID uuid.UUID) error {
	employee, err := s.assignmentRepo.GetByEmployeeAndShop(employeeID, shopID)
	if err != nil || employee == nil {
		return errors.New("EMPLOYEE_NOT_ASSIGNED_TO_SHOP")
	}
	return nil
}

func (s *InventoryService) AddStock(userID, shopID uuid.UUID, req *models.AddStockRequest) (*models.Inventory, error) {
	shop, err := s.shopRepo.GetByID(shopID)
	if err != nil {
		return nil, errors.New("SHOP_NOT_FOUND")
	}
	businessID := shop.BusinessID

	if err := s.requireShopAccess(userID, shopID); err != nil {
		return nil, err
	}

	variantID, err := uuid.Parse(req.VariantID)
	if err != nil {
		return nil, errors.New("INVALID_VARIANT_ID")
	}

	variant, err := s.validateVariantBusiness(variantID, businessID)
	if err != nil {
		return nil, err
	}

	_ = variant

	inventory, err := s.inventoryRepo.GetByShopAndVariant(shopID, variantID)
	if err != nil {
		inventory = &models.Inventory{
			BusinessID: businessID,
			ShopID:     shopID,
			ProductID:  variant.ProductID,
			VariantID:  variantID,
			Quantity:   0,
		}
	}

	previousQuantity := inventory.Quantity

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	inventoryRepo := repository.NewInventoryRepository(&database.DB{Tx: tx})
	stockMovementRepo := repository.NewStockMovementRepository(&database.DB{Tx: tx})

	if inventory.ID == uuid.Nil {
		err = inventoryRepo.CreateOrUpdate(&models.Inventory{
			BusinessID: businessID,
			ShopID:     shopID,
			ProductID:  variant.ProductID,
			VariantID:  variantID,
			Quantity:   req.Quantity,
		})
	} else {
		_, err = inventoryRepo.UpdateQuantity(shopID, variantID, req.Quantity)
	}
	if err != nil {
		return nil, err
	}

	movementType := models.StockMovementTypeStockIn
	existingMovements, _ := stockMovementRepo.GetByShopAndVariant(shopID, variantID)
	if len(existingMovements) == 0 {
		movementType = models.StockMovementTypeInitial
	}

	movement := models.StockMovement{
		BusinessID:       businessID,
		ShopID:           shopID,
		ProductID:        variant.ProductID,
		VariantID:        &variantID,
		MovementType:     movementType,
		Quantity:         req.Quantity,
		PreviousQuantity: previousQuantity,
		NewQuantity:      previousQuantity + req.Quantity,
		Notes:            req.Notes,
		PerformedBy:      &userID,
	}

	if err := stockMovementRepo.Create(&movement); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	updatedInventory, err := s.inventoryRepo.GetByShopAndVariant(shopID, variantID)
	if err != nil {
		return nil, err
	}

	s.emitEvent(models.StockEvent{
		Event:            "stock.updated",
		BusinessID:       businessID,
		ShopID:           shopID,
		ProductID:        variant.ProductID,
		VariantID:        variantID,
		PreviousQuantity: previousQuantity,
		Change:           req.Quantity,
		NewQuantity:      previousQuantity + req.Quantity,
		PerformedBy:      &userID,
		Timestamp:        movement.CreatedAt,
	})

	return updatedInventory, nil
}

func (s *InventoryService) RecordSale(userID, shopID uuid.UUID, req *models.RecordSaleRequest) (*models.Inventory, error) {
	shop, err := s.shopRepo.GetByID(shopID)
	if err != nil {
		return nil, errors.New("SHOP_NOT_FOUND")
	}
	businessID := shop.BusinessID

	if err := s.requireShopAccess(userID, shopID); err != nil {
		return nil, err
	}

	variantID, err := uuid.Parse(req.VariantID)
	if err != nil {
		return nil, errors.New("INVALID_VARIANT_ID")
	}

	variant, err := s.validateVariantBusiness(variantID, businessID)
	if err != nil {
		return nil, err
	}

	var employeeID *uuid.UUID
	if req.EmployeeID != "" {
		eID, err := uuid.Parse(req.EmployeeID)
		if err != nil {
			return nil, errors.New("INVALID_EMPLOYEE_ID")
		}
		employeeID = &eID

		emp, empErr := s.assignmentRepo.GetByEmployeeAndShop(*employeeID, shopID)
		if empErr != nil || emp == nil {
			return nil, errors.New("EMPLOYEE_NOT_ASSIGNED_TO_SHOP")
		}
	}

	available := req.Quantity
	movementType := models.StockMovementTypeSalePhysical
	if req.SaleType == "ONLINE" {
		movementType = models.StockMovementTypeSaleOnline
	} else if req.SaleType != "PHYSICAL" {
		return nil, errors.New("INVALID_SALE_TYPE")
	}

	inventory, err := s.inventoryRepo.GetByShopAndVariant(shopID, variantID)
	if err != nil {
		return nil, errors.New("INSUFFICIENT_STOCK")
	}

	previousQuantity := inventory.Quantity

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	inventoryRepo := repository.NewInventoryRepository(&database.DB{Tx: tx})
	stockMovementRepo := repository.NewStockMovementRepository(&database.DB{Tx: tx})

	updatedInventory, err := inventoryRepo.UpdateQuantityAtomic(shopID, variantID, -available, available)
	if err != nil {
		if err.Error() == "insufficient_stock" {
			return nil, errors.New("INSUFFICIENT_STOCK")
		}
		return nil, err
	}

	movement := models.StockMovement{
		BusinessID:       businessID,
		ShopID:           shopID,
		ProductID:        variant.ProductID,
		VariantID:        &variantID,
		MovementType:     movementType,
		Quantity:         -available,
		PreviousQuantity: previousQuantity,
		NewQuantity:      updatedInventory.Quantity,
		PerformedBy:      &userID,
		EmployeeID:       employeeID,
	}

	if err := stockMovementRepo.Create(&movement); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	s.emitEvent(models.StockEvent{
		Event:            "stock.updated",
		BusinessID:       businessID,
		ShopID:           shopID,
		ProductID:        variant.ProductID,
		VariantID:        variantID,
		PreviousQuantity: previousQuantity,
		Change:           -available,
		NewQuantity:      updatedInventory.Quantity,
		PerformedBy:      &userID,
		Timestamp:        movement.CreatedAt,
	})

	return updatedInventory, nil
}

func (s *InventoryService) ReserveStock(userID, shopID uuid.UUID, req *models.ReserveStockRequest) (*models.Inventory, error) {
	shop, err := s.shopRepo.GetByID(shopID)
	if err != nil {
		return nil, errors.New("SHOP_NOT_FOUND")
	}
	businessID := shop.BusinessID

	if err := s.requireMembership(userID, businessID); err != nil {
		return nil, err
	}

	variantID, err := uuid.Parse(req.VariantID)
	if err != nil {
		return nil, errors.New("INVALID_VARIANT_ID")
	}

	if _, err := s.validateVariantBusiness(variantID, businessID); err != nil {
		return nil, err
	}

	inventory, err := s.inventoryRepo.GetByShopAndVariant(shopID, variantID)
	if err != nil {
		return nil, errors.New("INSUFFICIENT_STOCK")
	}

	previousQuantity := inventory.Quantity

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	inventoryRepo := repository.NewInventoryRepository(&database.DB{Tx: tx})
	stockMovementRepo := repository.NewStockMovementRepository(&database.DB{Tx: tx})

	updatedInventory, err := inventoryRepo.ReserveAtomic(shopID, variantID, req.Quantity)
	if err != nil {
		if err.Error() == "insufficient_stock" {
			return nil, errors.New("INSUFFICIENT_STOCK")
		}
		return nil, err
	}

	movement := models.StockMovement{
		BusinessID:       businessID,
		ShopID:           shopID,
		ProductID:        inventory.ProductID,
		VariantID:        &variantID,
		MovementType:     models.StockMovementTypeAdjustment,
		Quantity:         -req.Quantity,
		PreviousQuantity: previousQuantity,
		NewQuantity:      previousQuantity,
		Notes:            "Reserved for online order",
		PerformedBy:      &userID,
	}

	if err := stockMovementRepo.Create(&movement); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return updatedInventory, nil
}

func (s *InventoryService) ReleaseStock(userID, shopID uuid.UUID, req *models.ReleaseStockRequest) (*models.Inventory, error) {
	shop, err := s.shopRepo.GetByID(shopID)
	if err != nil {
		return nil, errors.New("SHOP_NOT_FOUND")
	}
	businessID := shop.BusinessID

	if err := s.requireMembership(userID, businessID); err != nil {
		return nil, err
	}

	variantID, err := uuid.Parse(req.VariantID)
	if err != nil {
		return nil, errors.New("INVALID_VARIANT_ID")
	}

	inventory, err := s.inventoryRepo.GetByShopAndVariant(shopID, variantID)
	if err != nil {
		return nil, errors.New("INSUFFICIENT_STOCK")
	}

	previousQuantity := inventory.Quantity

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	inventoryRepo := repository.NewInventoryRepository(&database.DB{Tx: tx})
	stockMovementRepo := repository.NewStockMovementRepository(&database.DB{Tx: tx})

	updatedInventory, err := inventoryRepo.ReleaseAtomic(shopID, variantID, req.Quantity)
	if err != nil {
		if err.Error() == "insufficient_reserved" {
			return nil, errors.New("INSUFFICIENT_RESERVED")
		}
		return nil, err
	}

	movement := models.StockMovement{
		BusinessID:       businessID,
		ShopID:           shopID,
		ProductID:        inventory.ProductID,
		VariantID:        &variantID,
		MovementType:     models.StockMovementTypeAdjustment,
		Quantity:         req.Quantity,
		PreviousQuantity: previousQuantity,
		NewQuantity:      previousQuantity,
		Notes:            "Released reservation",
		PerformedBy:      &userID,
	}

	if err := stockMovementRepo.Create(&movement); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return updatedInventory, nil
}

func (s *InventoryService) ReceiveStock(userID uuid.UUID, req *models.CreateReceiptRequest) (*models.ReceiptWithLinesResponse, error) {
	shopID, err := uuid.Parse(req.ShopID)
	if err != nil {
		return nil, errors.New("INVALID_SHOP_ID")
	}

	shop, err := s.shopRepo.GetByID(shopID)
	if err != nil {
		return nil, errors.New("SHOP_NOT_FOUND")
	}
	businessID := shop.BusinessID

	if err := s.requireOwnerOrAdmin(userID, businessID); err != nil {
		return nil, err
	}

	for _, line := range req.Lines {
		variantID, err := uuid.Parse(line.VariantID)
		if err != nil {
			return nil, errors.New("INVALID_VARIANT_ID")
		}
		if _, err := s.validateVariantBusiness(variantID, businessID); err != nil {
			return nil, err
		}
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	receiptRepo := repository.NewReceiptRepository(&database.DB{Tx: tx})
	inventoryRepo := repository.NewInventoryRepository(&database.DB{Tx: tx})
	stockMovementRepo := repository.NewStockMovementRepository(&database.DB{Tx: tx})

	receipt := &models.StockReceipt{
		BusinessID:      businessID,
		ShopID:          shopID,
		ReceivedBy:      &userID,
		ReferenceNumber: req.ReferenceNumber,
		Notes:           req.Notes,
		Status:          models.ReceiptStatusReceived,
	}

	if err := receiptRepo.CreateReceipt(receipt); err != nil {
		return nil, err
	}

	lines := make([]models.StockReceiptLine, 0, len(req.Lines))
	movements := make([]models.StockMovement, 0, len(req.Lines))

	for _, lineInput := range req.Lines {
		variantID, _ := uuid.Parse(lineInput.VariantID)
		variant, _ := s.variantRepo.GetByID(variantID)

		line := models.StockReceiptLine{
			ReceiptID: receipt.ID,
			VariantID: variantID,
			Quantity:  lineInput.Quantity,
			UnitCost:  lineInput.UnitCost,
			Notes:     lineInput.Notes,
		}
		if err := receiptRepo.CreateReceiptLine(&line); err != nil {
			return nil, err
		}
		lines = append(lines, line)

		inv, err := inventoryRepo.GetByShopAndVariant(shopID, variantID)
		previousQty := 0
		if err == nil {
			previousQty = inv.Quantity
		}

		if err != nil {
			err = inventoryRepo.CreateOrUpdate(&models.Inventory{
				BusinessID: businessID,
				ShopID:     shopID,
				ProductID:  variant.ProductID,
				VariantID:  variantID,
				Quantity:   lineInput.Quantity,
			})
		} else {
			_, err = inventoryRepo.UpdateQuantity(shopID, variantID, lineInput.Quantity)
		}
		if err != nil {
			return nil, err
		}

		movement := models.StockMovement{
			BusinessID:       businessID,
			ShopID:           shopID,
			ProductID:        variant.ProductID,
			VariantID:        &variantID,
			MovementType:     models.StockMovementTypeStockIn,
			Quantity:         lineInput.Quantity,
			PreviousQuantity: previousQty,
			NewQuantity:      previousQty + lineInput.Quantity,
			ReferenceID:      &receipt.ID,
			Notes:            "Stock receipt",
			PerformedBy:      &userID,
		}
		if err := stockMovementRepo.Create(&movement); err != nil {
			return nil, err
		}
		movements = append(movements, movement)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	for i := range lines {
		if i < len(movements) {
			vID := lines[i].VariantID
			s.emitEvent(models.StockEvent{
				Event:            "stock.received",
				BusinessID:       businessID,
				ShopID:           shopID,
				VariantID:        vID,
				PreviousQuantity: movements[i].PreviousQuantity,
				Change:           lines[i].Quantity,
				NewQuantity:      movements[i].NewQuantity,
				PerformedBy:      &userID,
				Timestamp:        movements[i].CreatedAt,
			})
		}
	}

	lineResponses := make([]models.ReceiptLineResponse, len(lines))
	for i, l := range lines {
		lineResponses[i] = models.ReceiptLineResponse{
			ID:        l.ID,
			ReceiptID: l.ReceiptID,
			VariantID: l.VariantID,
			Quantity:  l.Quantity,
			UnitCost:  l.UnitCost,
			Notes:     l.Notes,
			CreatedAt: l.CreatedAt,
		}
	}

	return &models.ReceiptWithLinesResponse{
		Receipt: models.ReceiptResponse{
			ID:              receipt.ID,
			BusinessID:      receipt.BusinessID,
			ShopID:          receipt.ShopID,
			ReceivedBy:      receipt.ReceivedBy,
			ReferenceNumber: receipt.ReferenceNumber,
			Notes:           receipt.Notes,
			Status:          receipt.Status,
			ReceivedAt:      receipt.ReceivedAt,
			CreatedAt:       receipt.CreatedAt,
			UpdatedAt:       receipt.UpdatedAt,
		},
		Lines: lineResponses,
	}, nil
}

func (s *InventoryService) GetShopInventory(userID, shopID uuid.UUID) ([]*models.InventoryWithVariantResponse, error) {
	if err := s.requireShopAccess(userID, shopID); err != nil {
		return nil, err
	}

	inventories, err := s.inventoryRepo.GetByShopID(shopID)
	if err != nil {
		return nil, err
	}

	var responses []*models.InventoryWithVariantResponse
	for _, inv := range inventories {
		variant, err := s.variantRepo.GetByID(inv.VariantID)
		if err != nil {
			continue
		}
		product, err := s.productRepo.GetByID(inv.ProductID)
		if err != nil {
			continue
		}
		responses = append(responses, &models.InventoryWithVariantResponse{
			Inventory: models.InventoryResponse{
				ID:               inv.ID,
				BusinessID:       inv.BusinessID,
				ShopID:           inv.ShopID,
				ProductID:        inv.ProductID,
				VariantID:        inv.VariantID,
				Quantity:         inv.Quantity,
				ReservedQuantity: inv.ReservedQuantity,
				Available:        inv.Quantity - inv.ReservedQuantity,
				CreatedAt:        inv.CreatedAt,
				UpdatedAt:        inv.UpdatedAt,
			},
			Variant: s.toVariantResponse(variant),
			Product: s.toProductResponse(product),
		})
	}

	return responses, nil
}

func (s *InventoryService) GetVariantInventory(userID, variantID uuid.UUID) ([]*models.InventoryResponse, error) {
	variant, err := s.variantRepo.GetByID(variantID)
	if err != nil {
		return nil, errors.New("VARIANT_NOT_FOUND")
	}

	product, err := s.productRepo.GetByID(variant.ProductID)
	if err != nil {
		return nil, errors.New("PRODUCT_NOT_FOUND")
	}

	if err := s.requireMembership(userID, product.BusinessID); err != nil {
		return nil, err
	}

	inventories, err := s.inventoryRepo.GetByVariantID(variantID)
	if err != nil {
		return nil, err
	}

	var responses []*models.InventoryResponse
	for _, inv := range inventories {
		responses = append(responses, &models.InventoryResponse{
			ID:               inv.ID,
			BusinessID:       inv.BusinessID,
			ShopID:           inv.ShopID,
			ProductID:        inv.ProductID,
			VariantID:        inv.VariantID,
			Quantity:         inv.Quantity,
			ReservedQuantity: inv.ReservedQuantity,
			Available:        inv.Quantity - inv.ReservedQuantity,
			CreatedAt:        inv.CreatedAt,
			UpdatedAt:        inv.UpdatedAt,
		})
	}

	return responses, nil
}

func (s *InventoryService) GetStockMovements(userID, shopID uuid.UUID) ([]*models.StockMovementResponse, error) {
	if err := s.requireShopAccess(userID, shopID); err != nil {
		return nil, err
	}

	movements, err := s.stockMovementRepo.GetByShopID(shopID)
	if err != nil {
		return nil, err
	}

	var responses []*models.StockMovementResponse
	for _, m := range movements {
		responses = append(responses, &models.StockMovementResponse{
			ID:               m.ID,
			BusinessID:       m.BusinessID,
			ShopID:           m.ShopID,
			ProductID:        m.ProductID,
			VariantID:        m.VariantID,
			MovementType:     string(m.MovementType),
			Quantity:         m.Quantity,
			PreviousQuantity: m.PreviousQuantity,
			NewQuantity:      m.NewQuantity,
			Notes:            m.Notes,
			PerformedBy:      m.PerformedBy,
			EmployeeID:       m.EmployeeID,
			CreatedAt:        m.CreatedAt,
		})
	}

	return responses, nil
}

func (s *InventoryService) GetStockEvents() []models.StockEvent {
	s.eventsMutex.RLock()
	defer s.eventsMutex.RUnlock()

	events := make([]models.StockEvent, len(s.stockEvents))
	copy(events, s.stockEvents)
	return events
}

func (s *InventoryService) emitEvent(event models.StockEvent) {
	s.eventsMutex.Lock()
	s.stockEvents = append(s.stockEvents, event)
	s.eventsMutex.Unlock()
}

func (s *InventoryService) toVariantResponse(v *models.ProductVariant) models.VariantResponse {
	return models.VariantResponse{
		ID:            v.ID,
		ProductID:     v.ProductID,
		SKU:           v.SKU,
		Name:          v.Name,
		Attributes:    v.Attributes,
		SalePrice:     v.SalePrice,
		PurchasePrice: v.PurchasePrice,
		Barcode:       v.Barcode,
		Unit:          v.Unit,
		Status:        v.Status,
		CreatedAt:     v.CreatedAt,
		UpdatedAt:     v.UpdatedAt,
	}
}

func (s *InventoryService) toProductResponse(p *models.Product) models.ProductResponse {
	return models.ProductResponse{
		ID:          p.ID,
		BusinessID:  p.BusinessID,
		Name:        p.Name,
		SKU:         p.SKU,
		Description: p.Description,
		UnitPrice:   p.UnitPrice,
		CostPrice:   p.CostPrice,
		Unit:        p.Unit,
		Status:      p.Status,
		// The Seller Products page reads publication and discount state from
		// this response; omitting them made every product look unpublished
		// and broke the Published/Drafts filter.
		PublicationStatus: p.PublicationStatus,
		CategoryID:        p.CategoryID,
		SubcategoryID:     p.SubcategoryID,
		DiscountActive:    p.DiscountActive,
		DiscountType:      p.DiscountType,
		DiscountValue:     p.DiscountValue,
		DiscountStart:     p.DiscountStart,
		DiscountEnd:       p.DiscountEnd,
		CreatedAt:         p.CreatedAt,
		UpdatedAt:         p.UpdatedAt,
	}
}

func (s *InventoryService) CreateProduct(userID, businessID uuid.UUID, req *models.CreateProductRequest) (*models.Product, error) {
	if err := s.requireOwnerOrAdmin(userID, businessID); err != nil {
		return nil, err
	}

	product := &models.Product{
		BusinessID:  businessID,
		Name:        req.Name,
		SKU:         req.SKU,
		Description: req.Description,
		UnitPrice:   req.UnitPrice,
		CostPrice:   req.CostPrice,
		Unit:        req.Unit,
		Status:      models.ProductStatusActive,
	}

	if product.Unit == "" {
		product.Unit = "PCS"
	}

	if req.CategoryID != nil && *req.CategoryID != "" {
		catID, err := uuid.Parse(*req.CategoryID)
		if err != nil {
			return nil, errors.New("INVALID_CATEGORY_ID")
		}
		category, err := s.categoryRepo.GetByID(catID)
		if err != nil {
			return nil, errors.New("CATEGORY_NOT_FOUND")
		}
		if category.Status != "ACTIVE" {
			return nil, errors.New("CATEGORY_INACTIVE")
		}
		product.CategoryID = &catID

		if req.SubcategoryID != nil && *req.SubcategoryID != "" {
			subID, err := uuid.Parse(*req.SubcategoryID)
			if err != nil {
				return nil, errors.New("INVALID_SUBCATEGORY_ID")
			}
			sub, err := s.categoryRepo.GetSubcategoryByID(subID)
			if err != nil {
				return nil, errors.New("SUBCATEGORY_NOT_FOUND")
			}
			if sub.CategoryID != category.ID {
				return nil, errors.New("INVALID_SUBCATEGORY")
			}
			product.SubcategoryID = &subID
		}
	}

	product.PublicationStatus = models.PublicationStatusDraft
	if req.PublicationStatus != "" {
		pubStatus := models.PublicationStatus(strings.ToUpper(req.PublicationStatus))
		switch pubStatus {
		case models.PublicationStatusDraft, models.PublicationStatusPublished, models.PublicationStatusArchived:
			product.PublicationStatus = pubStatus
		default:
			product.PublicationStatus = models.PublicationStatusDraft
		}
	}

	if err := s.productRepo.Create(product); err != nil {
		return nil, err
	}

	defaultVariant := &models.ProductVariant{
		ProductID:     product.ID,
		SKU:           product.SKU,
		Name:          product.Name,
		Attributes:    make(map[string]string),
		SalePrice:     product.UnitPrice,
		PurchasePrice: product.CostPrice,
		Unit:          product.Unit,
		Status:        models.VariantStatusActive,
	}
	if err := s.variantRepo.Create(defaultVariant); err != nil {
		return nil, err
	}

	if product.PublicationStatus == models.PublicationStatusPublished {
		s.triggerSimilarityJob(product.ID, "product_created")
	}

	return product, nil
}

func (s *InventoryService) ListProductsByBusiness(userID, businessID uuid.UUID, search, publicationStatus string) ([]*models.ProductResponse, error) {
	if err := s.requireMembership(userID, businessID); err != nil {
		return nil, err
	}
	return s.productRepo.GetWithSummaryByBusinessID(businessID, search, publicationStatus)
}

func (s *InventoryService) GetProductByID(userID, productID uuid.UUID) (*models.Product, error) {
	product, err := s.productRepo.GetByID(productID)
	if err != nil {
		return nil, errors.New("PRODUCT_NOT_FOUND")
	}
	if err := s.requireMembership(userID, product.BusinessID); err != nil {
		return nil, err
	}
	return product, nil
}

// requireCategoryAttributes rejects publication when the product's category
// demands characteristics the product does not carry.
//
// Characteristics live on the variants' Attributes map, so the check looks at
// the union of attribute names across every variant that actually assigns a
// value — a key present with an empty string is treated as not filled in.
// Categories with no rules pass unconditionally, so this never blocks a
// product whose category is simply not covered.
func (s *InventoryService) requireCategoryAttributes(product *models.Product) error {
	if product.CategoryID == nil {
		return nil
	}

	category, err := s.categoryRepo.GetByID(*product.CategoryID)
	if err != nil {
		// A product whose category vanished should not be blocked from
		// publishing by a rule we cannot even resolve.
		return nil
	}
	categoryKey := category.Slug
	if categoryKey == "" {
		categoryKey = category.Name
	}

	subKey := ""
	if product.SubcategoryID != nil {
		if sub, err := s.categoryRepo.GetSubcategoryByID(*product.SubcategoryID); err == nil {
			if subKey = sub.Slug; subKey == "" {
				subKey = sub.Name
			}
		}
	}

	requirements := models.GetCategoryRequirements(categoryKey, subKey)
	if requirements.IsEmpty() {
		return nil
	}

	variants, err := s.variantRepo.GetByProductID(product.ID)
	if err != nil {
		return err
	}
	var present []string
	for _, v := range variants {
		for name, value := range v.Attributes {
			if strings.TrimSpace(value) != "" {
				present = append(present, name)
			}
		}
	}

	if missing := models.MissingRequiredAttributes(requirements, present); len(missing) > 0 {
		return fmt.Errorf("MISSING_REQUIRED_ATTRIBUTES: %s", strings.Join(missing, ", "))
	}
	return nil
}

func (s *InventoryService) UpdateProduct(userID, businessID, productID uuid.UUID, req *models.UpdateProductRequest) (*models.Product, error) {
	if err := s.requireOwnerOrAdmin(userID, businessID); err != nil {
		return nil, err
	}

	product, err := s.productRepo.GetByID(productID)
	if err != nil {
		return nil, errors.New("PRODUCT_NOT_FOUND")
	}
	if product.BusinessID != businessID {
		return nil, errors.New("FORBIDDEN")
	}

	if err := s.requireOwnerOrAdmin(userID, product.BusinessID); err != nil {
		return nil, err
	}

	categoryProvided := req.CategoryID != nil && *req.CategoryID != ""
	if categoryProvided {
		catID, err := uuid.Parse(*req.CategoryID)
		if err != nil {
			return nil, errors.New("INVALID_CATEGORY_ID")
		}
		category, err := s.categoryRepo.GetByID(catID)
		if err != nil {
			return nil, errors.New("CATEGORY_NOT_FOUND")
		}
		if category.Status != "ACTIVE" {
			return nil, errors.New("CATEGORY_INACTIVE")
		}
		product.CategoryID = &catID
	}

	if req.SubcategoryID != nil && *req.SubcategoryID != "" {
		subID, err := uuid.Parse(*req.SubcategoryID)
		if err != nil {
			return nil, errors.New("INVALID_SUBCATEGORY_ID")
		}
		sub, err := s.categoryRepo.GetSubcategoryByID(subID)
		if err != nil {
			return nil, errors.New("SUBCATEGORY_NOT_FOUND")
		}
		// The subcategory must belong to the explicitly provided category or,
		// when only a subcategory is updated, to the product's current category.
		var targetCategoryID uuid.UUID
		if categoryProvided {
			targetCategoryID = *product.CategoryID
		} else if product.CategoryID != nil {
			targetCategoryID = *product.CategoryID
		} else {
			return nil, errors.New("INVALID_SUBCATEGORY")
		}
		if sub.CategoryID != targetCategoryID {
			return nil, errors.New("INVALID_SUBCATEGORY")
		}
		product.SubcategoryID = &subID
	}

	if req.PublicationStatus != nil && *req.PublicationStatus != "" {
		pubStatus := models.PublicationStatus(strings.ToUpper(*req.PublicationStatus))
		switch pubStatus {
		case models.PublicationStatusDraft, models.PublicationStatusPublished, models.PublicationStatusArchived:
			// Products are always created as DRAFT and promoted here, so this is
			// the single choke point for publication — both the create wizard's
			// final step and "Publish to Marketplace" on the detail page go
			// through it. Enforcing the category rule here makes it impossible
			// to bypass by calling the API directly.
			if pubStatus == models.PublicationStatusPublished {
				if err := s.requireCategoryAttributes(product); err != nil {
					return nil, err
				}
			}
			product.PublicationStatus = pubStatus
		}
	}

	if req.Status != nil {
		product.Status = models.ProductStatus(*req.Status)
	}

	if req.Name != nil {
		product.Name = *req.Name
	}
	if req.SKU != nil {
		product.SKU = *req.SKU
	}
	if req.Description != nil {
		product.Description = *req.Description
	}
	if req.UnitPrice != nil {
		product.UnitPrice = *req.UnitPrice
	}
	if req.CostPrice != nil {
		product.CostPrice = *req.CostPrice
	}
	if req.Unit != nil {
		product.Unit = *req.Unit
	}

	if err := s.productRepo.Update(product); err != nil {
		return nil, err
	}

	// Trigger ranking job if publication status changed to PUBLISHED or ARCHIVED
	if s.asynqClient != nil && req.PublicationStatus != nil {
		newStatus := models.PublicationStatus(strings.ToUpper(*req.PublicationStatus))
		if newStatus == models.PublicationStatusPublished || newStatus == models.PublicationStatusArchived {
			if product.CategoryID != nil && *product.CategoryID != uuid.Nil {
				// Get the shop ID for this business (assuming first active shop)
				shopIDs, err := s.getActiveShopIDsForBusiness(product.BusinessID)
				if err == nil && len(shopIDs) > 0 {
					payload := jobs.MarshalShopCategoryRanking(product.BusinessID, shopIDs[0], "product_publication_change")
					task := asynq.NewTask(string(jobs.JobTypeRecalculateShopCategoryRanking), payload)
					_, _ = s.asynqClient.Enqueue(task)
				}
			}
		}
	}

	// Trigger similarity job for the updated product
	s.triggerSimilarityJob(productID, "product_updated")

	return product, nil
}

// Trigger similarity job for a product
func (s *InventoryService) triggerSimilarityJob(productID uuid.UUID, reason string) {
	if s.asynqClient != nil {
		payload := jobs.MarshalProductSimilarity(productID, reason)
		task := asynq.NewTask(string(jobs.JobTypeRecalculateProductSimilarity), payload)
		_, _ = s.asynqClient.Enqueue(task)
	}
}

func (s *InventoryService) CreateVariant(userID, productID uuid.UUID, req *models.CreateVariantRequest) (*models.ProductVariant, error) {
	product, err := s.productRepo.GetByID(productID)
	if err != nil {
		return nil, errors.New("PRODUCT_NOT_FOUND")
	}

	if err := s.requireOwnerOrAdmin(userID, product.BusinessID); err != nil {
		return nil, err
	}

	if req.Attributes == nil {
		req.Attributes = make(map[string]string)
	}

	variant := &models.ProductVariant{
		ProductID:     productID,
		SKU:           req.SKU,
		Name:          req.Name,
		Attributes:    req.Attributes,
		SalePrice:     req.SalePrice,
		PurchasePrice: req.PurchasePrice,
		Barcode:       req.Barcode,
		Unit:          req.Unit,
		Status:        models.VariantStatusActive,
	}

	if variant.Unit == "" {
		variant.Unit = product.Unit
	}

	if err := s.variantRepo.Create(variant); err != nil {
		return nil, err
	}

	return variant, nil
}

func (s *InventoryService) ListVariantsByProduct(userID, productID uuid.UUID) ([]*models.ProductVariant, error) {
	product, err := s.productRepo.GetByID(productID)
	if err != nil {
		return nil, errors.New("PRODUCT_NOT_FOUND")
	}

	if err := s.requireMembership(userID, product.BusinessID); err != nil {
		return nil, err
	}

	return s.variantRepo.GetByProductID(productID)
}

func (s *InventoryService) GetVariantByID(userID, variantID uuid.UUID) (*models.ProductVariant, error) {
	variant, err := s.variantRepo.GetByID(variantID)
	if err != nil {
		return nil, errors.New("VARIANT_NOT_FOUND")
	}

	product, err := s.productRepo.GetByID(variant.ProductID)
	if err != nil {
		return nil, errors.New("PRODUCT_NOT_FOUND")
	}

	if err := s.requireMembership(userID, product.BusinessID); err != nil {
		return nil, err
	}

	return variant, nil
}

func (s *InventoryService) UpdateVariant(userID, variantID uuid.UUID, req *models.UpdateVariantRequest) (*models.ProductVariant, error) {
	variant, err := s.variantRepo.GetByID(variantID)
	if err != nil {
		return nil, errors.New("VARIANT_NOT_FOUND")
	}

	product, err := s.productRepo.GetByID(variant.ProductID)
	if err != nil {
		return nil, errors.New("PRODUCT_NOT_FOUND")
	}

	if err := s.requireOwnerOrAdmin(userID, product.BusinessID); err != nil {
		return nil, err
	}

	if req.SKU != nil {
		variant.SKU = *req.SKU
	}
	if req.Name != nil {
		variant.Name = *req.Name
	}
	if req.Attributes != nil {
		variant.Attributes = req.Attributes
	}
	if req.SalePrice != nil {
		variant.SalePrice = *req.SalePrice
	}
	if req.PurchasePrice != nil {
		variant.PurchasePrice = *req.PurchasePrice
	}
	if req.Barcode != nil {
		variant.Barcode = *req.Barcode
	}
	if req.Unit != nil {
		variant.Unit = *req.Unit
	}
	if req.Status != nil {
		variant.Status = models.VariantStatus(*req.Status)
	}

	if err := s.variantRepo.Update(variant); err != nil {
		return nil, err
	}

	return variant, nil
}

func (s *InventoryService) GetReceiptByID(userID, receiptID uuid.UUID) (*models.ReceiptWithLinesResponse, error) {
	receipt, err := s.receiptRepo.GetByID(receiptID)
	if err != nil {
		return nil, errors.New("RECEIPT_NOT_FOUND")
	}

	if err := s.requireMembership(userID, receipt.BusinessID); err != nil {
		return nil, err
	}

	lines, err := s.receiptRepo.GetLinesByReceiptID(receiptID)
	if err != nil {
		return nil, err
	}

	lineResponses := make([]models.ReceiptLineResponse, len(lines))
	for i, l := range lines {
		lineResponses[i] = models.ReceiptLineResponse{
			ID:        l.ID,
			ReceiptID: l.ReceiptID,
			VariantID: l.VariantID,
			Quantity:  l.Quantity,
			UnitCost:  l.UnitCost,
			Notes:     l.Notes,
			CreatedAt: l.CreatedAt,
		}
	}

	return &models.ReceiptWithLinesResponse{
		Receipt: models.ReceiptResponse{
			ID:              receipt.ID,
			BusinessID:      receipt.BusinessID,
			ShopID:          receipt.ShopID,
			ReceivedBy:      receipt.ReceivedBy,
			ReferenceNumber: receipt.ReferenceNumber,
			Notes:           receipt.Notes,
			Status:          receipt.Status,
			ReceivedAt:      receipt.ReceivedAt,
			CreatedAt:       receipt.CreatedAt,
			UpdatedAt:       receipt.UpdatedAt,
		},
		Lines: lineResponses,
	}, nil
}

func (s *InventoryService) ListReceiptsByBusiness(userID, businessID uuid.UUID) ([]*models.StockReceipt, error) {
	if err := s.requireMembership(userID, businessID); err != nil {
		return nil, err
	}
	return s.receiptRepo.GetByBusinessID(businessID)
}

func (s *InventoryService) GetShopStockHistory(userID, shopID uuid.UUID, query models.StockMovementHistoryQuery) (*models.StockMovementHistoryResponse, error) {
	shop, err := s.shopRepo.GetByID(shopID)
	if err != nil {
		return nil, errors.New("SHOP_NOT_FOUND")
	}

	if err := s.requireMembership(userID, shop.BusinessID); err != nil {
		return nil, err
	}

	filter, err := s.buildMovementFilter(query)
	if err != nil {
		return nil, err
	}
	filter.ShopID = &shopID

	return s.executeMovementQuery(filter, query)
}

func (s *InventoryService) GetVariantStockHistory(userID, variantID uuid.UUID, query models.StockMovementHistoryQuery) (*models.StockMovementHistoryResponse, error) {
	variant, err := s.variantRepo.GetByID(variantID)
	if err != nil {
		return nil, errors.New("VARIANT_NOT_FOUND")
	}

	product, err := s.productRepo.GetByID(variant.ProductID)
	if err != nil {
		return nil, errors.New("PRODUCT_NOT_FOUND")
	}

	if err := s.requireMembership(userID, product.BusinessID); err != nil {
		return nil, err
	}

	filter, err := s.buildMovementFilter(query)
	if err != nil {
		return nil, err
	}
	filter.VariantID = &variantID

	if query.ShopID != "" {
		shopID, err := uuid.Parse(query.ShopID)
		if err != nil {
			return nil, errors.New("INVALID_REQUEST")
		}
		shop, err := s.shopRepo.GetByID(shopID)
		if err != nil {
			return nil, errors.New("SHOP_NOT_FOUND")
		}
		if shop.BusinessID != product.BusinessID {
			return nil, errors.New("FORBIDDEN")
		}
		filter.ShopID = &shopID
	}

	return s.executeMovementQuery(filter, query)
}

func (s *InventoryService) GetBusinessStockHistory(userID, businessID uuid.UUID, query models.StockMovementHistoryQuery) (*models.StockMovementHistoryResponse, error) {
	if err := s.requireMembership(userID, businessID); err != nil {
		return nil, err
	}

	filter, err := s.buildMovementFilter(query)
	if err != nil {
		return nil, err
	}
	filter.BusinessID = &businessID

	return s.executeMovementQuery(filter, query)
}

func (s *InventoryService) buildMovementFilter(query models.StockMovementHistoryQuery) (repository.StockMovementFilter, error) {
	filter := repository.StockMovementFilter{
		Page:  1,
		Limit: 50,
	}

	if query.Page > 0 {
		filter.Page = query.Page
	}
	if query.Limit > 0 && query.Limit <= 200 {
		filter.Limit = query.Limit
	}
	filter.Sort = query.Sort

	if query.From != "" {
		t, err := time.Parse("2006-01-02", query.From)
		if err != nil {
			t, err = time.Parse(time.RFC3339, query.From)
			if err != nil {
				return filter, errors.New("INVALID_REQUEST")
			}
		}
		filter.From = &t
	}
	if query.To != "" {
		t, err := time.Parse("2006-01-02", query.To)
		if err != nil {
			t, err = time.Parse(time.RFC3339, query.To)
			if err != nil {
				return filter, errors.New("INVALID_REQUEST")
			}
		}
		t = t.Add(24*time.Hour - time.Second)
		filter.To = &t
	}

	if query.ProductID != "" {
		id, err := uuid.Parse(query.ProductID)
		if err != nil {
			return filter, errors.New("INVALID_REQUEST")
		}
		filter.ProductID = &id
	}
	if query.VariantID != "" {
		id, err := uuid.Parse(query.VariantID)
		if err != nil {
			return filter, errors.New("INVALID_REQUEST")
		}
		filter.VariantID = &id
	}
	if query.Type != "" {
		filter.Type = query.Type
	}
	if query.EmployeeID != "" {
		id, err := uuid.Parse(query.EmployeeID)
		if err != nil {
			return filter, errors.New("INVALID_REQUEST")
		}
		filter.EmployeeID = &id
	}

	return filter, nil
}

func (s *InventoryService) executeMovementQuery(filter repository.StockMovementFilter, query models.StockMovementHistoryQuery) (*models.StockMovementHistoryResponse, error) {
	if filter.Limit == 0 {
		filter.Limit = 50
	}
	if filter.Page == 0 {
		filter.Page = 1
	}

	rows, total, err := s.stockMovementRepo.ListFiltered(filter)
	if err != nil {
		return nil, err
	}

	data := make([]models.StockMovementHistoryData, 0, len(rows))
	for _, row := range rows {
		item := models.StockMovementHistoryData{
			ID:               row.ID,
			BusinessID:       row.BusinessID,
			MovementType:     string(row.MovementType),
			Quantity:         row.Quantity,
			PreviousQuantity: row.PreviousQuantity,
			NewQuantity:      row.NewQuantity,
			Notes:            row.Notes,
			ReferenceID:      row.ReferenceID,
			CreatedAt:        row.CreatedAt,
			Shop: models.StockMovementShopInfo{
				ID:   row.ShopID,
				Name: row.ShopName,
			},
			Product: models.StockMovementProductInfo{
				ID:   row.ProductID,
				Name: row.ProductName,
			},
		}

		if row.VariantID != nil {
			variantInfo := &models.StockMovementVariantInfo{
				ID:  *row.VariantID,
				SKU: row.VariantSKU,
			}
			if row.VariantAttr != nil && *row.VariantAttr != "" {
				attrs := make(map[string]string)
				attrStr := *row.VariantAttr
				attrStr = strings.Trim(attrStr, "{}")
				if attrStr != "" {
					pairs := strings.Split(attrStr, ",")
					for _, pair := range pairs {
						kv := strings.SplitN(pair, ":", 2)
						if len(kv) == 2 {
							key := strings.TrimSpace(strings.Trim(kv[0], "\""))
							val := strings.TrimSpace(strings.Trim(kv[1], "\""))
							attrs[key] = val
						}
					}
				}
				variantInfo.Attributes = attrs
			}
			item.Variant = variantInfo
		}

		if row.PerformedBy != nil && row.PerformerName != nil && *row.PerformerName != "" {
			item.PerformedBy = &models.StockMovementPerformerInfo{
				EmployeeID: row.EmployeeID,
				Name:       *row.PerformerName,
			}
		} else if row.EmployeeID != nil && row.EmployeeName != nil && *row.EmployeeName != "" {
			item.PerformedBy = &models.StockMovementPerformerInfo{
				EmployeeID: row.EmployeeID,
				Name:       *row.EmployeeName,
			}
		}

		data = append(data, item)
	}

	return &models.StockMovementHistoryResponse{
		Data: data,
		Pagination: models.PaginationInfo{
			Page:  filter.Page,
			Limit: filter.Limit,
			Total: total,
		},
	}, nil
}

func (s *InventoryService) getActiveShopIDsForBusiness(businessID uuid.UUID) ([]uuid.UUID, error) {
	query := `SELECT id FROM shops WHERE business_id = $1 AND status = 'ACTIVE'`
	rows, err := s.db.Query(query, businessID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var shopIDs []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		shopIDs = append(shopIDs, id)
	}
	return shopIDs, rows.Err()
}

// RemoveProductFromShop stops selling one Product at one Shop by removing its
// stock rows there. Historical movements are preserved and an ADJUSTMENT
// movement records the removal. Other Shops selling the same Product are not
// affected, and Marketplace visibility for this Shop offer disappears
// immediately because marketplace queries derive from live inventory.
func (s *InventoryService) RemoveProductFromShop(userID, shopID, productID uuid.UUID) (int, error) {
	shop, err := s.shopRepo.GetByID(shopID)
	if err != nil {
		return 0, errors.New("SHOP_NOT_FOUND")
	}

	if err := s.requireShopAccess(userID, shopID); err != nil {
		return 0, err
	}

	product, err := s.productRepo.GetByID(productID)
	if err != nil || product == nil {
		return 0, errors.New("PRODUCT_NOT_FOUND")
	}
	if product.BusinessID != shop.BusinessID {
		return 0, errors.New("FORBIDDEN")
	}

	variants, err := s.variantRepo.GetByProductID(productID)
	if err != nil {
		return 0, err
	}

	tx, err := s.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	inventoryRepo := repository.NewInventoryRepository(&database.DB{Tx: tx})
	stockMovementRepo := repository.NewStockMovementRepository(&database.DB{Tx: tx})

	removed := 0
	for _, v := range variants {
		inv, err := inventoryRepo.GetByShopAndVariant(shopID, v.ID)
		if err != nil || inv == nil {
			continue
		}
		movement := models.StockMovement{
			BusinessID:       shop.BusinessID,
			ShopID:           shopID,
			ProductID:        productID,
			VariantID:        &v.ID,
			MovementType:     models.StockMovementTypeAdjustment,
			Quantity:         -inv.Quantity,
			PreviousQuantity: inv.Quantity,
			NewQuantity:      0,
			Notes:            "Product removed from Shop",
			PerformedBy:      &userID,
		}
		if err := stockMovementRepo.Create(&movement); err != nil {
			return 0, err
		}
		if err := inventoryRepo.Delete(shopID, v.ID); err != nil {
			return 0, err
		}
		removed++
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return removed, nil
}
