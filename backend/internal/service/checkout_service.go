package service

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

// CheckoutService turns a cart into orders.
//
// The bug it exists to fix: the cart used to be summarised client-side by taking
// the FIRST line's shop and sending every line to that shop's endpoints. A cart
// holding two shops' products therefore asked Shop A for Shop B's variant, which
// came back INVENTORY_NOT_FOUND - so adding a second product appeared to "not
// work", when what had actually broken was checking out with it.
//
// Here the shop is a property of each line, every line is validated against its
// own shop, and the cart fans out to one order per shop.
type CheckoutService struct {
	orderService   *OrderService
	checkoutRepo   *repository.CheckoutGroupRepository
	shopRepo       *repository.ShopRepository
	productRepo    *repository.ProductRepository
	variantRepo    *repository.VariantRepository
	inventoryRepo  *repository.InventoryRepository
	buyerRepo      *repository.BuyerProfileRepository
	pointRedeemSvc *PointRedemptionService
}

func NewCheckoutService(
	orderService *OrderService,
	checkoutRepo *repository.CheckoutGroupRepository,
	shopRepo *repository.ShopRepository,
	productRepo *repository.ProductRepository,
	variantRepo *repository.VariantRepository,
	inventoryRepo *repository.InventoryRepository,
	buyerRepo *repository.BuyerProfileRepository,
	pointRedeemSvc *PointRedemptionService,
) *CheckoutService {
	return &CheckoutService{
		orderService:   orderService,
		checkoutRepo:   checkoutRepo,
		shopRepo:       shopRepo,
		productRepo:    productRepo,
		variantRepo:    variantRepo,
		inventoryRepo:  inventoryRepo,
		buyerRepo:      buyerRepo,
		pointRedeemSvc: pointRedeemSvc,
	}
}

// cartLineKey is a cart line's identity: the same product, in the same variant,
// from the same shop. Two different variants of one product are two lines; the
// same variant stocked by two shops is two lines, because they are two different
// things to buy with two different sellers behind them.
type cartLineKey struct {
	productID uuid.UUID
	variantID uuid.UUID
	shopID    uuid.UUID
}

type resolvedLine struct {
	key         cartLineKey
	quantity    int
	unitPrice   float64
	currency    string
	productName string
	variantName string
	shopName    string
}

// validateCart resolves every line against its own shop and reports each problem
// against the line that caused it.
//
// Nothing here rejects the cart as a whole. A buyer whose third line went out of
// stock keeps the other two and is told exactly which product and variant to fix
// - the alternative, failing the cart on the first bad line, is what made the
// cart feel like it was refusing products at random.
func (s *CheckoutService) validateCart(items []models.CartLineInput) ([]resolvedLine, []models.CartLineIssue) {
	// Fold duplicates first: the same product+variant+shop sent twice is one line
	// of the combined quantity, checked against stock once.
	merged := map[cartLineKey]int{}
	order := []cartLineKey{}
	raw := map[cartLineKey]models.CartLineInput{}
	issues := []models.CartLineIssue{}

	for _, item := range items {
		productID, productErr := uuid.Parse(strings.TrimSpace(item.ProductID))
		variantID, variantErr := uuid.Parse(strings.TrimSpace(item.VariantID))
		shopID, shopErr := uuid.Parse(strings.TrimSpace(item.ShopID))
		if productErr != nil || variantErr != nil || shopErr != nil {
			issues = append(issues, models.CartLineIssue{
				ProductID: item.ProductID, VariantID: item.VariantID, ShopID: item.ShopID,
				Code: "INVALID_LINE", Message: "Ligne de panier invalide.", Requested: item.Quantity,
			})
			continue
		}
		key := cartLineKey{productID: productID, variantID: variantID, shopID: shopID}
		if _, seen := merged[key]; !seen {
			order = append(order, key)
			raw[key] = item
		}
		merged[key] += item.Quantity
	}

	resolved := []resolvedLine{}
	for _, key := range order {
		quantity := merged[key]
		item := raw[key]

		issue := func(code, message string, available int) {
			issues = append(issues, models.CartLineIssue{
				ProductID: key.productID.String(), VariantID: key.variantID.String(), ShopID: key.shopID.String(),
				Code: code, Message: message, Available: available, Requested: quantity,
			})
		}

		shop, err := s.shopRepo.GetByID(key.shopID)
		if err != nil || shop == nil {
			issue("SHOP_NOT_FOUND", "Cette boutique n'est plus disponible.", 0)
			continue
		}
		if shop.Status != "ACTIVE" {
			issue("SHOP_NOT_ACTIVE", fmt.Sprintf("La boutique %s n'accepte pas de commandes actuellement.", shop.Name), 0)
			continue
		}

		variant, err := s.variantRepo.GetByID(key.variantID)
		if err != nil || variant == nil {
			issue("VARIANT_NOT_FOUND", "Cette déclinaison n'existe plus.", 0)
			continue
		}
		if variant.ProductID != key.productID {
			issue("VARIANT_NOT_PRODUCT", "Cette déclinaison n'appartient pas à ce produit.", 0)
			continue
		}

		product, err := s.productRepo.GetByID(key.productID)
		if err != nil || product == nil {
			issue("PRODUCT_NOT_FOUND", "Ce produit n'est plus disponible.", 0)
			continue
		}

		// The line's own shop, not the cart's first shop. This single argument is
		// the difference between a working multi-shop cart and INVENTORY_NOT_FOUND.
		inventory, err := s.inventoryRepo.GetByShopAndVariant(key.shopID, key.variantID)
		if err != nil || inventory == nil {
			issue("INVENTORY_NOT_FOUND", fmt.Sprintf("%s n'est pas vendu par %s.", product.Name, shop.Name), 0)
			continue
		}
		available := inventory.Quantity - inventory.ReservedQuantity
		if available <= 0 {
			issue("OUT_OF_STOCK", fmt.Sprintf("%s (%s) est en rupture de stock.", product.Name, variantLabel(variant)), 0)
			continue
		}
		if available < quantity {
			issue("INSUFFICIENT_STOCK",
				fmt.Sprintf("%s (%s) : %d disponible(s), %d demandé(s).", product.Name, variantLabel(variant), available, quantity),
				available)
			continue
		}

		resolved = append(resolved, resolvedLine{
			key:         key,
			quantity:    quantity,
			unitPrice:   s.pointRedeemSvc.getEffectiveVariantPrice(variant, product),
			currency:    productCurrency(product),
			productName: product.Name,
			variantName: variantLabel(variant),
			shopName:    shop.Name,
		})
		_ = item
	}

	return resolved, issues
}

// variantLabel names a variant the way the buyer saw it on the product page.
func variantLabel(variant *models.ProductVariant) string {
	if variant == nil {
		return ""
	}
	if strings.TrimSpace(variant.Name) != "" {
		return variant.Name
	}
	return variant.SKU
}

// productCurrency falls back to USD, which is what every new sale is priced in.
func productCurrency(product *models.Product) string {
	if product == nil || strings.TrimSpace(product.Currency) == "" {
		return models.CurrencyUSD
	}
	return product.Currency
}

// groupByShop splits validated lines into the orders they will become, in a
// stable order so the same cart always presents the same way.
func groupByShop(lines []resolvedLine) []models.CartShopGroup {
	index := map[uuid.UUID]int{}
	groups := []models.CartShopGroup{}

	for _, line := range lines {
		position, seen := index[line.key.shopID]
		if !seen {
			groups = append(groups, models.CartShopGroup{
				ShopID: line.key.shopID, ShopName: line.shopName,
				Currency: line.currency, Lines: []models.CartLineInput{},
			})
			position = len(groups) - 1
			index[line.key.shopID] = position
		}
		groups[position].Lines = append(groups[position].Lines, models.CartLineInput{
			ProductID: line.key.productID.String(),
			VariantID: line.key.variantID.String(),
			ShopID:    line.key.shopID.String(),
			Quantity:  line.quantity,
		})
		groups[position].Subtotal = models.RoundMoney(groups[position].Subtotal + line.unitPrice*float64(line.quantity))
		groups[position].ItemCount += line.quantity
	}

	sort.SliceStable(groups, func(i, j int) bool { return groups[i].ShopName < groups[j].ShopName })
	return groups
}

// PreviewCart prices the cart and reports everything wrong with it, without
// changing anything.
func (s *CheckoutService) PreviewCart(buyerProfileID uuid.UUID, req *models.CartPreviewRequest) (*models.CartPreviewResponse, error) {
	if req == nil || len(req.Items) == 0 {
		return nil, errors.New("CART_EMPTY")
	}

	resolved, issues := s.validateCart(req.Items)
	groups := groupByShop(resolved)

	response := &models.CartPreviewResponse{
		Currency: models.CurrencyUSD,
		Shops:    groups,
		Issues:   issues,
		// Checkout needs at least one good line and no outstanding problem: the
		// buyer fixes what is named rather than discovering it at the last step.
		Checkoutable: len(resolved) > 0 && len(issues) == 0,
	}
	for _, group := range groups {
		response.Subtotal = models.RoundMoney(response.Subtotal + group.Subtotal)
		response.ItemCount += group.ItemCount
		if group.Currency != "" {
			response.Currency = group.Currency
		}
	}
	response.ShopCount = len(groups)
	response.FinalTotal = response.Subtotal

	// Points belong to the buyer, not to a shop, so they are previewed once over
	// the whole cart. Per-order allocation happens when the orders are created.
	if len(resolved) > 0 {
		if preview, err := s.previewCartPoints(buyerProfileID, groups, req.UsePoints); err == nil && preview != nil {
			response.AvailablePoints = preview.AvailablePoints
			if req.UsePoints {
				response.PointsDiscountAmount = preview.PointsDiscountAmount
				response.FinalTotal = preview.FinalTotal
			}
		}
	}

	return response, nil
}

// cartPointsPreview is the whole-cart view of a redemption: the sum of what each
// child order would redeem, computed with the existing per-shop rules so the
// preview and the orders can never disagree.
type cartPointsPreview struct {
	AvailablePoints      int
	PointsDiscountAmount float64
	FinalTotal           float64
}

func (s *CheckoutService) previewCartPoints(buyerProfileID uuid.UUID, groups []models.CartShopGroup, usePoints bool) (*cartPointsPreview, error) {
	result := &cartPointsPreview{}
	for _, group := range groups {
		items := make([]models.OrderLineInput, 0, len(group.Lines))
		for _, line := range group.Lines {
			items = append(items, models.OrderLineInput{
				ProductID: line.ProductID, VariantID: line.VariantID, Quantity: line.Quantity,
			})
		}
		preview, err := s.pointRedeemSvc.GetRedemptionPreview(buyerProfileID, group.ShopID, items, usePoints)
		if err != nil {
			// A shop whose points preview fails simply redeems nothing; it must
			// not take the other shops' pricing down with it.
			result.FinalTotal = models.RoundMoney(result.FinalTotal + group.Subtotal)
			continue
		}
		// The buyer's balance is one number, not a per-shop one: every preview
		// reports the same account, so the last one read is the balance.
		result.AvailablePoints = preview.AvailablePoints
		result.PointsDiscountAmount = models.RoundMoney(result.PointsDiscountAmount + preview.PointsDiscountAmount)
		result.FinalTotal = models.RoundMoney(result.FinalTotal + preview.FinalTotal)
	}
	return result, nil
}

// CreateCheckout turns the cart into one order per shop, tied together by a
// checkout group.
//
// It is all-or-nothing from the buyer's point of view: if any shop's order fails
// to be created, the ones already created are cancelled - which releases their
// stock reservations and points - so the buyer never ends up half checked out.
func (s *CheckoutService) CreateCheckout(buyerProfileID uuid.UUID, req *models.CheckoutCreateRequest) (*models.CheckoutCreateResponse, error) {
	if req == nil || len(req.Items) == 0 {
		return nil, errors.New("CART_EMPTY")
	}

	buyerProfile, err := s.buyerRepo.GetByID(buyerProfileID)
	if err != nil || buyerProfile == nil {
		return nil, errors.New("BUYER_PROFILE_NOT_FOUND")
	}
	if strings.TrimSpace(buyerProfile.Phone) == "" {
		return nil, errors.New("BUYER_PROFILE_INCOMPLETE")
	}

	resolved, issues := s.validateCart(req.Items)
	if len(issues) > 0 {
		// The caller gets the per-line detail from PreviewCart; this is the last
		// gate, and it names the first offending line rather than a bare failure.
		return nil, errors.New(issues[0].Code)
	}
	if len(resolved) == 0 {
		return nil, errors.New("CART_EMPTY")
	}

	groups := groupByShop(resolved)
	currency := models.CurrencyUSD
	if len(groups) > 0 && groups[0].Currency != "" {
		currency = groups[0].Currency
	}

	group := &models.CheckoutGroup{
		BuyerProfileID: buyerProfileID,
		Currency:       currency,
		ShopCount:      len(groups),
	}
	if err := s.checkoutRepo.Create(group); err != nil {
		return nil, err
	}

	response := &models.CheckoutCreateResponse{
		CheckoutGroupID: group.ID,
		Currency:        currency,
		ShopCount:       len(groups),
		Shops:           make([]models.CartShopGroup, 0, len(groups)),
		OrderIDs:        []uuid.UUID{},
	}

	created := []uuid.UUID{}
	rollback := func() {
		for _, orderID := range created {
			_, _ = s.orderService.CancelBuyerOrder(buyerProfileID, orderID)
		}
	}

	for _, shopGroup := range groups {
		items := make([]models.OrderLineInput, 0, len(shopGroup.Lines))
		for _, line := range shopGroup.Lines {
			items = append(items, models.OrderLineInput{
				ProductID: line.ProductID, VariantID: line.VariantID, Quantity: line.Quantity,
			})
		}

		// Each child order gets its own idempotency key derived from the cart's,
		// so a retried checkout is still idempotent per shop rather than colliding
		// on one key across several orders.
		var idempotencyKey *string
		if req.IdempotencyKey != nil && strings.TrimSpace(*req.IdempotencyKey) != "" {
			scoped := fmt.Sprintf("%s:%s", strings.TrimSpace(*req.IdempotencyKey), shopGroup.ShopID.String())
			idempotencyKey = &scoped
		}

		order, err := s.orderService.CreateBuyerOrder(buyerProfileID, &models.BuyerCreateOrderRequest{
			ShopID:         shopGroup.ShopID.String(),
			Items:          items,
			UsePoints:      req.UsePoints,
			IdempotencyKey: idempotencyKey,
		})
		if err != nil {
			rollback()
			return nil, err
		}

		orderID := order.Order.ID
		if err := s.checkoutRepo.AttachOrder(group.ID, orderID); err != nil {
			rollback()
			return nil, err
		}

		created = append(created, orderID)
		shopGroup.OrderID = &orderID
		shopGroup.OrderNumber = order.Order.OrderNumber
		response.Shops = append(response.Shops, shopGroup)
		response.OrderIDs = append(response.OrderIDs, orderID)
		response.Subtotal = models.RoundMoney(response.Subtotal + shopGroup.Subtotal)
	}

	return response, nil
}
