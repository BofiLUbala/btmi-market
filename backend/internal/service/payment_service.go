package service

import (
	"errors"
	"strings"
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
	paymentConfigRepo  *repository.PaymentConfigRepository
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
	commService        *CommissionService
	webhookRepo        *repository.PaymentWebhookRepository
	webhookSecret      string
	providerRepo       *repository.PaymentProviderRepository
	auditRepo          *repository.PaymentAuditRepository
	driver             PaymentProviderDriver
	asynqClient        *asynq.Client
	db                 *database.DB
	// onSettled lets the handover close itself when a provider settles a payment
	// while the courier is already at the door with verified goods.
	onSettled func(orderID uuid.UUID)
}

// SetProviderDependencies wires the operator catalog, the payment audit trail and
// the driver that actually talks to an operator. A nil driver is the honest
// default: checkout can still record how the buyer intends to pay, but asking to
// be charged returns PAYMENT_PROVIDER_NOT_CONFIGURED rather than pretending.
func (s *PaymentService) SetProviderDependencies(
	providerRepo *repository.PaymentProviderRepository,
	auditRepo *repository.PaymentAuditRepository,
	driver PaymentProviderDriver,
) {
	s.providerRepo = providerRepo
	s.auditRepo = auditRepo
	s.driver = driver
}

// audit appends to the payment trail. It never returns an error: a trail that
// cannot be written must not take a real payment down with it.
func (s *PaymentService) audit(e *models.PaymentAuditEvent) {
	if s.auditRepo == nil {
		return
	}
	_ = s.auditRepo.Record(e)
}

func NewPaymentService(
	paymentRepo *repository.BuyerPaymentRepository,
	paymentConfigRepo *repository.PaymentConfigRepository,
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
		paymentConfigRepo:  paymentConfigRepo,
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

// markupFor prices a Finance-configured markup against an order. A percentage
// is currency-free; a fixed amount only applies to an order in the currency
// Finance entered it in, so a 2.00 USD fee can never be charged as 2 CDF.
func markupFor(config *models.PaymentMethodConfig, baseDue float64, currency string) (float64, error) {
	switch config.MarkupType {
	case "PERCENTAGE":
		return models.PercentOf(baseDue, config.MarkupValue), nil
	case "FIXED":
		configured := config.MarkupCurrency
		if configured == "" {
			configured = models.CurrencyUSD
		}
		if configured != currency {
			return 0, errors.New("MARKUP_CURRENCY_MISMATCH")
		}
		return models.RoundMoney(config.MarkupValue), nil
	}
	return 0, nil
}

// orderCurrency is the order's own snapshot, falling back to USD for rows
// written before orders carried a currency.
func orderCurrency(order *models.Order) string {
	if order == nil || order.Currency == "" {
		return models.CurrencyUSD
	}
	return order.Currency
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

// resolveProvider validates the operator the buyer picked against the catalog and
// against the method they picked it for.
//
// The rule is symmetric and deliberate: cash has no operator, and mobile money
// without one is not a decision anyone can act on. Rejecting both shapes here is
// what keeps every downstream cash-vs-mobile split honest, rather than leaving a
// report to guess what an empty provider on a mobile payment meant.
func (s *PaymentService) resolveProvider(method, requested string) (string, error) {
	requested = strings.ToUpper(strings.TrimSpace(requested))

	if !models.IsMobileMethod(method) {
		if requested != "" {
			return "", errors.New("PROVIDER_NOT_APPLICABLE")
		}
		return "", nil
	}
	if requested == "" {
		return "", errors.New("PAYMENT_PROVIDER_REQUIRED")
	}
	if s.providerRepo == nil {
		return "", errors.New("PAYMENT_PROVIDER_NOT_CONFIGURED")
	}
	provider, err := s.providerRepo.Get(requested)
	if err != nil {
		return "", err
	}
	if provider == nil {
		return "", errors.New("PAYMENT_PROVIDER_UNKNOWN")
	}
	if !provider.Enabled {
		return "", errors.New("PAYMENT_PROVIDER_UNAVAILABLE")
	}
	return provider.Code, nil
}

// CreatePayment records how the buyer intends to pay for an order, deriving every
// amount from the Order + Delivery snapshot. The client never sends amounts.
//
// Whatever the method, the payment is created DUE. Choosing how you will pay is
// not paying: cash is settled by the courier at the door and mobile money by its
// operator's callback, so nothing on this path can mark an order paid.
func (s *PaymentService) CreatePayment(buyerProfileID, orderID uuid.UUID, req *models.CreatePaymentRequest) (*models.BuyerPaymentResponse, error) {
	paymentMethod := models.PaymentMethodCashOnDelivery
	requestedProvider, payerPhone := "", ""
	if req != nil {
		if method := strings.TrimSpace(req.PaymentMethod); method != "" {
			paymentMethod = method
		}
		requestedProvider = req.Provider
		payerPhone = strings.TrimSpace(req.PayerPhone)
	}
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, mapOrderNotFoundErr(err)
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
	if order.DeliveryMethod != models.DeliveryMethodPickup {
		if strings.TrimSpace(order.DeliveryAddress) == "" || strings.TrimSpace(order.DeliveryContactName) == "" || strings.TrimSpace(order.DeliveryPhone) == "" {
			return nil, errors.New("DELIVERY_DETAILS_INCOMPLETE")
		}
	}

	existing, err := s.paymentRepo.GetByOrderID(orderID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		if existing.PaymentMethod != paymentMethod {
			return nil, errors.New("PAYMENT_ALREADY_SELECTED")
		}
		return s.toResponse(existing), nil
	}
	config, err := s.paymentConfigRepo.Get(paymentMethod)
	if err != nil {
		return nil, err
	}
	if config == nil || !config.Enabled {
		return nil, errors.New("PAYMENT_METHOD_UNAVAILABLE")
	}

	// The operator comes from the buyer, not from the method config. A method no
	// longer implies an operator: that is what let a single platform-wide
	// provider stand in for the buyer's actual choice.
	provider, err := s.resolveProvider(paymentMethod, requestedProvider)
	if err != nil {
		return nil, err
	}

	baseDue := models.RoundMoney(order.FinalTotal + order.DeliveryFeeFinal)
	markup, err := markupFor(config, baseDue, orderCurrency(order))
	if err != nil {
		return nil, err
	}
	cashDue := models.RoundMoney(baseDue + markup)
	if cashDue < 0 {
		cashDue = 0
	}

	payment := &models.BuyerPayment{
		OrderID:                orderID,
		BusinessID:             order.BusinessID,
		ShopID:                 order.ShopID,
		BuyerProfileID:         buyerProfileID,
		PaymentMethod:          config.Code,
		Currency:               orderCurrency(order),
		ProductsBaseTotal:      order.BaseTotal,
		ProductsPointsUsed:     order.PointsUsed,
		ProductsPointsDiscount: order.PointsDiscountAmount,
		ProductsFinalTotal:     order.FinalTotal,
		DeliveryFeeBase:        order.DeliveryFeeBase,
		DeliveryPointsUsed:     order.DeliveryPointsUsed,
		DeliveryPointsDiscount: order.DeliveryPointsDiscount,
		DeliveryFeeFinal:       order.DeliveryFeeFinal,
		CashDue:                cashDue,
		PaymentMarkup:          markup,
		PaymentMarkupType:      config.MarkupType,
		PaymentMarkupValue:     config.MarkupValue,
		FinalTotal:             cashDue,
		Provider:               provider,
		PayerPhone:             payerPhone,
		PaymentTiming:          config.Timing,
		// DUE, always. See the doc comment: selecting a method is not paying.
		Status: models.BuyerPaymentStatusDue,
	}
	// Our own reference exists from the moment the payment does, so a charge that
	// is later started and never answered is still traceable from our side.
	payment.InternalReference = newInternalReference()

	if err := s.paymentRepo.Create(payment); err != nil {
		return nil, err
	}

	s.audit(&models.PaymentAuditEvent{
		PaymentID: &payment.ID, OrderID: &orderID,
		EventType: models.PaymentEventMethodSelected, ActorType: models.PaymentActorBuyer,
		Provider: provider, Amount: &payment.FinalTotal, Currency: payment.Currency,
		Reference: payment.InternalReference,
		Detail:    models.JSONMap{"payment_method": paymentMethod, "timing": config.Timing},
	})
	if provider != "" {
		s.audit(&models.PaymentAuditEvent{
			PaymentID: &payment.ID, OrderID: &orderID,
			EventType: models.PaymentEventProviderSelected, ActorType: models.PaymentActorBuyer,
			Provider: provider, Currency: payment.Currency, Reference: payment.InternalReference,
		})
	}

	return s.toResponse(payment), nil
}

// newInternalReference is our own handle on a payment: short enough to read back
// over the phone, unique enough to key support on.
func newInternalReference() string {
	return "TBK-" + strings.ToUpper(uuid.NewString()[:8])
}

// Quote is the authoritative checkout price. It prices every enabled method so
// the buyer can compare, and returns the selected method's total as final_total
// - the frontend never adds a markup of its own.
func (s *PaymentService) Quote(buyerProfileID, orderID uuid.UUID, selectedMethod ...string) (*models.CheckoutQuote, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, mapOrderNotFoundErr(err)
	}
	if order.BuyerProfileID == nil || *order.BuyerProfileID != buyerProfileID {
		return nil, errors.New("FORBIDDEN")
	}
	if order.DeliveryMethod == "" {
		return nil, errors.New("DELIVERY_NOT_SELECTED")
	}
	methods, err := s.paymentConfigRepo.List(true)
	if err != nil {
		return nil, err
	}
	baseDue := models.RoundMoney(order.FinalTotal + order.DeliveryFeeFinal)
	currency := orderCurrency(order)
	priceable := methods[:0]
	for index := range methods {
		markup, err := markupFor(&methods[index], baseDue, currency)
		if err != nil {
			// A method Finance priced in another currency cannot be quoted for
			// this order; hiding it beats showing a total we cannot honour.
			continue
		}
		methods[index].MarkupAmount = markup
		methods[index].QuotedTotal = models.RoundMoney(baseDue + markup)
		priceable = append(priceable, methods[index])
	}
	methods = priceable
	selected := ""
	if len(selectedMethod) > 0 {
		selected = strings.TrimSpace(selectedMethod[0])
	}
	// The operators travel with the quote so the client renders the provider step
	// from the live catalog instead of a hardcoded list.
	providers := []models.PaymentProvider{}
	if s.providerRepo != nil {
		if enabled, err := s.providerRepo.List(true); err == nil {
			providers = enabled
		}
	}

	quote := &models.CheckoutQuote{OrderID: order.ID.String(), Currency: orderCurrency(order), Subtotal: order.BaseTotal, Discount: 0,
		PointsDiscount: order.PointsDiscountAmount + order.DeliveryPointsDiscount, DeliveryFee: order.DeliveryFeeFinal,
		FinalTotal: baseDue, PaymentMethods: methods, Providers: providers}
	for _, method := range methods {
		if method.Code == selected {
			quote.SelectedPaymentMethod = method.Code
			quote.PaymentMarkup = method.MarkupAmount
			quote.FinalTotal = method.QuotedTotal
			break
		}
	}
	if quote.SelectedPaymentMethod == "" && selected != "" {
		return nil, errors.New("PAYMENT_METHOD_UNAVAILABLE")
	}
	return quote, nil
}

func (s *PaymentService) GetPaymentByOrder(buyerProfileID, orderID uuid.UUID) (*models.BuyerPaymentResponse, error) {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return nil, mapOrderNotFoundErr(err)
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
	// The client needs to know whether to offer "Pay now" - and, when it should
	// not, why - so the answer travels with the payment itself.
	response := s.toResponse(payment)
	payability := s.Payability(payment, order)
	response.Payable, response.PayableReason = payability.Payable, payability.Reason
	return response, nil
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

// Cash at delivery is settled by the assigned courier at the door
// (QRService.CourierConfirmCash), and an online payment by its provider's webhook
// (HandleProviderWebhook). There is deliberately no buyer- or seller-facing way to
// declare a payment received: neither party is present at the handover, so neither
// one's word is evidence that money moved.

func (s *PaymentService) SetCommissionService(cs *CommissionService) {
	s.commService = cs
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
	if !models.PaymentSettled(payment.Status) {
		return errors.New("PAYMENT_NOT_VERIFIED")
	}

	order, err := s.orderRepo.GetByID(payment.OrderID)
	if err != nil {
		return mapOrderNotFoundErr(err)
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

	// Consume reserved inventory (convert reserved_quantity → sold) if not already claimed.
	if !locked.InventoryClaimed {
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
		if err := txOrderRepo.SetInventoryClaimed(payment.OrderID); err != nil {
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

// providerLabel turns a stored operator code into the name the buyer knows it
// by. It falls back to the code so a withdrawn operator still reads sensibly on
// an old payment rather than showing up blank.
func (s *PaymentService) providerLabel(code string) string {
	if code == "" || s.providerRepo == nil {
		return ""
	}
	if provider, err := s.providerRepo.Get(code); err == nil && provider != nil {
		return provider.Label
	}
	return code
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
		PaymentMarkup:          p.PaymentMarkup,
		PaymentMarkupType:      p.PaymentMarkupType,
		PaymentMarkupValue:     p.PaymentMarkupValue,
		FinalTotal:             p.FinalTotal,
		Provider:               p.Provider,
		ProviderLabel:          s.providerLabel(p.Provider),
		ProviderReference:      p.ProviderReference,
		InternalReference:      p.InternalReference,
		PayerPhone:             p.PayerPhone,
		ReceiptReference:       p.ReceiptReference,
		ReceiptIssuedAt:        p.ReceiptIssuedAt,
		InitiatedAt:            p.InitiatedAt,
		PaymentTiming:          p.PaymentTiming,
		BuyerConfirmed:         p.BuyerConfirmed,
		BuyerConfirmedAt:       p.BuyerConfirmedAt,
		SellerConfirmed:        p.SellerConfirmed,
		SellerConfirmedBy:      p.SellerConfirmedBy,
		SellerConfirmedAt:      p.SellerConfirmedAt,
		Status:                 string(p.Status),
		VerifiedAt:             p.VerifiedAt,
		PaidAt:                 p.PaidAt,
		ConfirmedByUserID:      p.ConfirmedByUserID,
		ConfirmationActor:      p.ConfirmationActor,
		CashReceivedAt:         p.CashReceivedAt,
		CreatedAt:              p.CreatedAt,
		UpdatedAt:              p.UpdatedAt,
	}
}
