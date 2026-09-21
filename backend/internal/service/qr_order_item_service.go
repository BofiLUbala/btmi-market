package service

import (
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// ============================================================================
// ORDER_ITEM QR codes (kind "oi")
//
// The printed code is only the signed opaque reference
//
//	tbk.oi.<public_reference>.<signature>
//
// Resolving it validates the signature, authenticates the caller, finds the order
// item through the order_item_qr_codes table, reads the immutable snapshots stored
// on the order/order-line (price, product/variant, delivery address) and returns
// only what the caller's role may see. No buyer data, address or price ever
// reaches the barcode itself.
// ============================================================================

// EnsureOrderItemQR creates the QR identity for an order line if it does not exist
// yet. It is idempotent; the backfill in migration 091 already covers every line
// present at deploy time, so this only fills lines created afterwards.
func (s *QRService) EnsureOrderItemQR(orderID, lineID uuid.UUID) error {
	_, err := s.db.Exec(`INSERT INTO order_item_qr_codes(order_line_id, order_id)
		VALUES($1,$2)
		ON CONFLICT (order_line_id) DO NOTHING`, lineID, orderID)
	return err
}

// loadOrderItemQRIdentity reads the QR identity row for one order line. The token
// is the only scannable payload; the reference label is derived from the public
// UUID, never from order data.
func (s *QRService) loadOrderItemQRIdentity(lineID uuid.UUID) (*models.OrderItemQR, error) {
	var q models.OrderItemQR
	var ref uuid.UUID
	err := s.db.QueryRow(`SELECT order_id,public_reference,status,created_at
		FROM order_item_qr_codes WHERE order_line_id=$1`, lineID).
		Scan(&q.OrderID, &ref, &q.Status, &q.CreatedAt)
	if err != nil {
		return nil, ErrQRInvalid
	}
	q.OrderItemID = lineID
	q.Reference = "OI-" + refPrefix(ref)
	q.Token = s.token("oi", ref.String())
	return &q, nil
}

// SellerOrderItemQR returns the QR identity of one order line to the seller who
// owns the order's shop. The line must belong to the given order.
func (s *QRService) SellerOrderItemQR(userID, orderID, lineID uuid.UUID) (*models.OrderItemQR, error) {
	var businessID uuid.UUID
	if err := s.db.QueryRow(`SELECT business_id FROM orders WHERE id=$1`, orderID).Scan(&businessID); err != nil {
		return nil, ErrQRInvalid
	}
	m, err := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
	if err != nil || m == nil {
		return nil, ErrQRForbidden
	}
	if !s.lineInOrder(orderID, lineID) {
		return nil, ErrQRInvalid
	}
	if err := s.EnsureOrderItemQR(orderID, lineID); err != nil {
		return nil, err
	}
	return s.loadOrderItemQRIdentity(lineID)
}

// BuyerOrderItemQR returns the QR identity of one order line to the buyer who
// placed the order.
func (s *QRService) BuyerOrderItemQR(userID, orderID, lineID uuid.UUID) (*models.OrderItemQR, error) {
	var owner uuid.UUID
	err := s.db.QueryRow(`SELECT bp.user_id FROM orders o JOIN buyer_profiles bp ON bp.id=o.buyer_profile_id WHERE o.id=$1`, orderID).
		Scan(&owner)
	if err != nil || owner != userID {
		return nil, ErrQRForbidden
	}
	if !s.lineInOrder(orderID, lineID) {
		return nil, ErrQRInvalid
	}
	if err := s.EnsureOrderItemQR(orderID, lineID); err != nil {
		return nil, err
	}
	return s.loadOrderItemQRIdentity(lineID)
}

func (s *QRService) lineInOrder(orderID, lineID uuid.UUID) bool {
	var ok bool
	if err := s.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM order_lines WHERE id=$1 AND order_id=$2)`, lineID, orderID).Scan(&ok); err != nil {
		return false
	}
	return ok
}

// ResolveOrderItemQR is the scan entry point: validate the signed token, resolve
// the order item, determine the caller's role and return the role-filtered
// immutable snapshot. actorRole may be QRRoleAdmin (admin console token) or empty
// to resolve the role from the authenticated user.
func (s *QRService) ResolveOrderItemQR(userID uuid.UUID, actorRole models.QRRole, token string) (*models.OrderItemQRResolved, error) {
	ref, err := s.parse(token, "oi")
	if err != nil {
		return nil, err
	}

	line, err := s.loadOrderItemContext(ref)
	if err != nil {
		return nil, err
	}

	// Dead or revoked codes must not resolve no matter how the signature was
	// obtained; a printed label survives a revoke in real life.
	if strings.EqualFold(line.qrStatus, "REVOKED") {
		return nil, ErrQRInvalid
	}

	role := actorRole
	if role == "" {
		role, err = s.resolveRegularRole(userID, line.orderID)
		if err != nil {
			return nil, err
		}
	}
	switch role {
	case models.QRRoleAdmin, models.QRRoleBuyer, models.QRRoleSeller, models.QRRoleCourier:
	default:
		return nil, ErrQRForbidden
	}

	payment, paymentExists, err := s.loadOrderItemPaymentContext(line.orderID)
	if err != nil {
		return nil, err
	}

	out := s.buildOrderItemResolution(ref, line, payment)
	out.Role = role
	s.applyRoleVisibility(out, line, payment, paymentExists)
	return out, nil
}

// orderItemLineContext is the full immutable snapshot a resolution renders. Every
// field comes from order tables; nothing is read from the live catalogue.
type orderItemLineContext struct {
	qrStatus string
	orderID  uuid.UUID

	lineID    uuid.UUID
	productID uuid.UUID
	variantID uuid.UUID
	quantity  int

	unitPrice         float64
	baseUnitPrice     float64
	pointsDiscPerUnit float64
	finalUnitPrice    float64

	productName string
	productSKU  string
	variantName string
	variantSKU  string
	imageURL    string
	attributes  models.JSONMap

	orderNumber    string
	orderDate      time.Time
	orderStatus    string
	deliveryStatus string
	deliveryMethod string
	currency       string

	baseTotal          float64
	pointsUsed         int
	pointsDiscAmount   float64
	finalTotal         float64
	deliveryFeeBase    float64
	deliveryPointsUsed int
	deliveryPointsDisc float64
	deliveryFeeFinal   float64

	deliveryContactName string
	deliveryPhone       string
	deliveryNotes       string
	deliveryProvince    string
	deliveryCity        string
	deliveryCommune     string
	deliveryStreet      string
	deliveryBuildingNum string
	deliveryLandmark    string
	assignedCourierID   *uuid.UUID

	shopID       uuid.UUID
	shopName     string
	businessID   uuid.UUID
	businessName string

	buyerProfileID *uuid.UUID
	buyerUserID    *uuid.UUID
	buyerFirstName string
	buyerLastName  string
	buyerPhone     string
	buyerEmail     string

	productNumber string
}

// orderItemPaymentContext is the payment snapshot of the order. Only the amounts
// the resolution needs are carried here; the service records nothing new.
type orderItemPaymentContext struct {
	method     string
	status     string
	finalTotal float64
	cashDue    float64
	markup     float64
	markupType string
	timing     string
	currency   string
}

func (s *QRService) loadOrderItemContext(ref uuid.UUID) (*orderItemLineContext, error) {
	ctx := &orderItemLineContext{}
	var attrsRaw []byte
	err := s.db.QueryRow(`
		SELECT oi.status, oi.order_id,
		       ol.id, ol.product_id, ol.variant_id, ol.quantity,
		       ol.unit_price, ol.base_unit_price, ol.points_discount_per_unit, ol.final_unit_price,
		       COALESCE(ol.product_name,''), COALESCE(ol.product_sku,''),
		       COALESCE(ol.variant_name,''), COALESCE(ol.variant_sku,''),
		       COALESCE(ol.image_url,''), COALESCE(ol.variant_attributes,'{}'::jsonb),
		       COALESCE(o.order_number,''), o.created_at, o.status::text,
		       COALESCE(o.delivery_status,''), COALESCE(o.delivery_method,''),
		       o.base_total, o.points_used, o.points_discount_amount, o.final_total,
		       o.delivery_fee_base, o.delivery_points_used, o.delivery_points_discount, o.delivery_fee_final,
		       COALESCE(o.delivery_contact_name,''), COALESCE(o.delivery_phone,''), COALESCE(o.delivery_notes,''),
		       COALESCE(o.delivery_province,''), COALESCE(o.delivery_city,''), COALESCE(o.delivery_commune,''),
		       COALESCE(o.delivery_street,''), COALESCE(o.delivery_building_number,''), COALESCE(o.delivery_landmark,''),
		       o.assigned_courier_id, COALESCE(o.currency,'USD'),
		       s.id, COALESCE(s.name,''), b.id, COALESCE(b.name,''),
		       bp.id, bp.user_id, COALESCE(bp.first_name,''), COALESCE(bp.last_name,''),
		       COALESCE(bp.phone,''), COALESCE(bp.email,'')
		FROM order_item_qr_codes oi
		JOIN order_lines ol ON ol.id = oi.order_line_id
		JOIN orders o ON o.id = ol.order_id
		JOIN shops s ON s.id = o.shop_id
		JOIN businesses b ON b.id = o.business_id
		LEFT JOIN buyer_profiles bp ON bp.id = o.buyer_profile_id
		WHERE oi.public_reference=$1`, ref).
		Scan(&ctx.qrStatus, &ctx.orderID,
			&ctx.lineID, &ctx.productID, &ctx.variantID, &ctx.quantity,
			&ctx.unitPrice, &ctx.baseUnitPrice, &ctx.pointsDiscPerUnit, &ctx.finalUnitPrice,
			&ctx.productName, &ctx.productSKU, &ctx.variantName, &ctx.variantSKU, &ctx.imageURL, &attrsRaw,
			&ctx.orderNumber, &ctx.orderDate, &ctx.orderStatus,
			&ctx.deliveryStatus, &ctx.deliveryMethod,
			&ctx.baseTotal, &ctx.pointsUsed, &ctx.pointsDiscAmount, &ctx.finalTotal,
			&ctx.deliveryFeeBase, &ctx.deliveryPointsUsed, &ctx.deliveryPointsDisc, &ctx.deliveryFeeFinal,
			&ctx.deliveryContactName, &ctx.deliveryPhone, &ctx.deliveryNotes,
			&ctx.deliveryProvince, &ctx.deliveryCity, &ctx.deliveryCommune,
			&ctx.deliveryStreet, &ctx.deliveryBuildingNum, &ctx.deliveryLandmark,
			&ctx.assignedCourierID, &ctx.currency,
			&ctx.shopID, &ctx.shopName, &ctx.businessID, &ctx.businessName,
			&ctx.buyerProfileID, &ctx.buyerUserID, &ctx.buyerFirstName, &ctx.buyerLastName,
			&ctx.buyerPhone, &ctx.buyerEmail)
	if err != nil {
		return nil, ErrQRInvalid
	}
	_ = json.Unmarshal(attrsRaw, &ctx.attributes)
	if ctx.attributes == nil {
		ctx.attributes = models.JSONMap{}
	}
	if ctx.buyerProfileID != nil {
		ctx.productNumber = s.orderItemProductNumber(ctx.productID, ctx.variantID)
	}
	return ctx, nil
}

// orderItemProductNumber derives the PRD-/VAR- style public number the same way the
// rest of the QR system does, falling back to nothing when the product is long gone
// from the catalogue (the SKU snapshots remain visible either way).
func (s *QRService) orderItemProductNumber(productID, variantID uuid.UUID) string {
	var ref uuid.UUID
	var hasVariant bool
	err := s.db.QueryRow(`
		SELECT public_reference, variant_id IS NOT NULL
		FROM product_qr_codes
		WHERE product_id=$1 AND (variant_id=$2 OR variant_id IS NULL)
		ORDER BY CASE WHEN variant_id=$2 THEN 0 ELSE 1 END, variant_id NULLS LAST
		LIMIT 1`, productID, variantID).Scan(&ref, &hasVariant)
	if err != nil {
		return ""
	}
	prefix := "PRD-"
	if hasVariant {
		prefix = "VAR-"
	}
	return prefix + refPrefix(ref)
}

func (s *QRService) loadOrderItemPaymentContext(orderID uuid.UUID) (*orderItemPaymentContext, bool, error) {
	ctx := &orderItemPaymentContext{}
	err := s.db.QueryRow(`
		SELECT COALESCE(payment_method,''), COALESCE(status,''),
		       COALESCE(final_total,0), COALESCE(cash_due,0),
		       COALESCE(payment_markup,0), COALESCE(payment_markup_type,''),
		       COALESCE(payment_timing,''), COALESCE(currency,'')
		FROM buyer_payments WHERE order_id=$1`, orderID).
		Scan(&ctx.method, &ctx.status, &ctx.finalTotal, &ctx.cashDue, &ctx.markup, &ctx.markupType, &ctx.timing, &ctx.currency)
	if errors.Is(err, sql.ErrNoRows) {
		return ctx, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return ctx, true, nil
}

// resolveRegularRole identifies the caller among BUYER, SELLER and COURIER for the
// order. A user can hold several hats (a seller may shop), so the order is
// deliberate: the order's own buyer first, then anyone with an active membership in
// the order's business, then the courier assigned to that delivery.
func (s *QRService) resolveRegularRole(userID, orderID uuid.UUID) (models.QRRole, error) {
	var owner uuid.UUID
	err := s.db.QueryRow(`SELECT bp.user_id FROM orders o JOIN buyer_profiles bp ON bp.id=o.buyer_profile_id WHERE o.id=$1`, orderID).Scan(&owner)
	if err == nil && owner == userID {
		return models.QRRoleBuyer, nil
	}
	var businessID uuid.UUID
	if err := s.db.QueryRow(`SELECT business_id FROM orders WHERE id=$1`, orderID).Scan(&businessID); err == nil {
		m, merr := s.membershipRepo.GetActiveByUserAndBusiness(userID, businessID)
		if merr == nil && m != nil {
			return models.QRRoleSeller, nil
		}
	}
	var assigned *uuid.UUID
	if err := s.db.QueryRow(`SELECT assigned_courier_id FROM orders WHERE id=$1`, orderID).Scan(&assigned); err == nil && assigned != nil && *assigned == userID {
		return models.QRRoleCourier, nil
	}
	return "", ErrQRForbidden
}

// buildOrderItemResolution renders the full (admin) view of the scanned item. Every
// money figure is computed from snapshots: the line's own unit pricing, the order's
// delivery/points snapshot and the payment row. The current product price is never
// consulted.
func (s *QRService) buildOrderItemResolution(ref uuid.UUID, line *orderItemLineContext, payment *orderItemPaymentContext) *models.OrderItemQRResolved {
	currency := models.CurrencySnapshot(line.currency)
	if payment.currency != "" {
		currency = payment.currency
	}

	subtotal := models.RoundMoney(line.unitPrice * float64(line.quantity))
	discount := models.RoundMoney((line.baseUnitPrice - line.unitPrice) * float64(line.quantity))
	if discount < 0 {
		discount = 0
	}
	pointsDiscount := models.RoundMoney(line.pointsDiscPerUnit * float64(line.quantity))
	itemTotal := models.RoundMoney(line.finalUnitPrice * float64(line.quantity))

	finalAmount := models.RoundMoney(line.finalTotal + line.deliveryFeeFinal)
	if payment.finalTotal > 0 {
		finalAmount = models.RoundMoney(payment.finalTotal)
	}

	out := &models.OrderItemQRResolved{
		QR: models.OrderItemQRBase{
			Reference:   "OI-" + refPrefix(ref),
			OrderID:     line.orderID,
			OrderItemID: line.lineID,
			Status:      line.qrStatus,
		},
		Product: models.OrderItemQRProduct{
			ProductID:     line.productID,
			ProductNumber: line.productNumber,
			ProductName:   line.productName,
			ProductImage:  line.imageURL,
			ProductSKU:    line.productSKU,
			VariantID:     line.variantID,
			VariantName:   line.variantName,
			VariantSKU:    line.variantSKU,
			Attributes:    line.attributes,
			Quantity:      line.quantity,
		},
		Shop: models.OrderItemQRShop{
			ShopID:        line.shopID,
			ShopName:      line.shopName,
			ShopReference: "SHP-" + refPrefix(line.shopID),
			BusinessID:    line.businessID,
			SellerName:    line.businessName,
		},
		Order: models.OrderItemQROrder{
			OrderID:        line.orderID,
			OrderNumber:    line.orderNumber,
			OrderItemID:    line.lineID,
			OrderDate:      line.orderDate,
			OrderStatus:    line.orderStatus,
			DeliveryStatus: line.deliveryStatus,
			DeliveryMethod: line.deliveryMethod,
			PaymentMethod:  payment.method,
			PaymentStatus:  payment.status,
			PaymentTiming:  payment.timing,
		},
		Price: models.OrderItemQRPrice{
			UnitPrice:         line.unitPrice,
			Quantity:          line.quantity,
			Subtotal:          subtotal,
			Discount:          discount,
			PointsDiscount:    pointsDiscount,
			ItemTotal:         itemTotal,
			DeliveryFee:       line.deliveryFeeFinal,
			PaymentMarkup:     payment.markup,
			PaymentMarkupType: payment.markupType,
			FinalAmount:       finalAmount,
			Currency:          currency,
		},
	}
	if line.buyerProfileID != nil {
		out.Buyer = &models.OrderItemQRBuyer{
			BuyerProfileID: *line.buyerProfileID,
			BuyerReference: "BPR-" + refPrefix(*line.buyerProfileID),
			FirstName:      line.buyerFirstName,
			LastName:       line.buyerLastName,
			DisplayName:    strings.TrimSpace(line.buyerFirstName + " " + line.buyerLastName),
			Phone:          line.buyerPhone,
			Email:          line.buyerEmail,
		}
	}
	out.DeliveryAddress = s.orderItemAddress(line)
	return out
}

// orderItemAddress builds the immutable delivery-address snapshot from the order.
func (s *QRService) orderItemAddress(line *orderItemLineContext) *models.OrderItemQRAddress {
	return &models.OrderItemQRAddress{
		RecipientName:        line.deliveryContactName,
		RecipientPhone:       line.deliveryPhone,
		Province:             line.deliveryProvince,
		City:                 line.deliveryCity,
		Commune:              line.deliveryCommune,
		Street:               line.deliveryStreet,
		BuildingNumber:       line.deliveryBuildingNum,
		Landmark:             line.deliveryLandmark,
		DeliveryInstructions: line.deliveryNotes,
	}
}

// applyRoleVisibility trims the full resolution to what each authenticated role may
// see. The shared rule is: a role never receives fields the spec withholds, and the
// completely full view exists for ADMIN only.
func (s *QRService) applyRoleVisibility(out *models.OrderItemQRResolved, line *orderItemLineContext, payment *orderItemPaymentContext, paymentExists bool) {
	switch out.Role {
	case models.QRRoleAdmin:
		// Full operational context.
		return

	case models.QRRoleBuyer:
		// The buyer sees everything about their own order: product, price,
		// delivery address snapshot. No buyer identity block needed.
		out.Buyer = nil

	case models.QRRoleSeller:
		// Fulfillment context: product, quantity, order number, buyer
		// name/reference, price relevant to preparation, delivery method.
		// The seller gets no private buyer contact details and no delivery
		// address; they prepare at the shop, they do not deliver to the home.
		out.DeliveryAddress = nil
		if out.Buyer != nil {
			out.Buyer.Phone = ""
			out.Buyer.Email = ""
		}
		// Payment method and status are the buyer's/courier's business, not
		// preparation information.
		out.Order.PaymentMethod = ""
		out.Order.PaymentStatus = ""
		out.Order.PaymentTiming = ""

	case models.QRRoleCourier:
		// The courier needs the physical item (with image), the recipient
		// name and phone, the address and instructions, the delivery status
		// and, when collecting cash, the exact amount to collect. Every
		// other financial figure is irrelevant and withheld.
		if out.Buyer != nil {
			out.Buyer.Email = ""
			if out.Buyer.Phone == "" {
				out.Buyer.Phone = line.deliveryPhone
			}
			if out.Buyer.DisplayName == "" {
				out.Buyer.DisplayName = strings.TrimSpace(line.deliveryContactName)
			}
			out.Buyer.BuyerProfileID = uuid.Nil
			out.Buyer.BuyerReference = ""
		}
		recipientPhone := line.deliveryPhone
		if recipientPhone == "" && out.Buyer != nil {
			recipientPhone = out.Buyer.Phone
		}
		out.DeliveryAddress.RecipientPhone = recipientPhone
		out.DeliveryAddress.RecipientName = strings.TrimSpace(line.deliveryContactName)

		// Amount to collect: cash-on-delivery orders only, and only until
		// they are actually settled.
		out.Price = models.OrderItemQRPrice{}
		if s.courierCollectsCash(line, payment, paymentExists) {
			amount := models.RoundMoney(payment.cashDue)
			if amount <= 0 {
				amount = models.RoundMoney(payment.finalTotal)
			}
			out.Price.AmountToCollect = amount
		}
		out.Price.Currency = models.CurrencySnapshot(line.currency)
		if payment.currency != "" {
			out.Price.Currency = payment.currency
		}
		out.Order.OrderID = uuid.Nil
	}
}

// courierCollectsCash reports whether the courier must collect money at the door:
// the order is a delivery, the payment is timed at delivery and has not been
// settled yet. Prepaid mobile-money orders read "déjà payé" instead.
func (s *QRService) courierCollectsCash(line *orderItemLineContext, payment *orderItemPaymentContext, paymentExists bool) bool {
	if !paymentExists {
		return false
	}
	// Only delivery-timed payments are collected at the door.
	if !strings.EqualFold(payment.timing, "DELIVERY") {
		return false
	}
	// A settled payment is already paid ("déjà payé", nothing to collect).
	if paymentSettled(models.BuyerPaymentStatus(payment.status)) {
		return false
	}
	return true
}

// refPrefix renders the 8-character upper prefix used in every public reference
// label (OI-XXXXXXXX, SHP-XXXXXXXX, ...).
func refPrefix(id uuid.UUID) string {
	return strings.ToUpper(id.String()[:8])
}
