package service

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

var (
	// ErrHandoverForbidden covers "this is not your order" for either party.
	ErrHandoverForbidden = errors.New("HANDOVER_FORBIDDEN")
	// ErrHandoverWrongState is returned when the handover step is real but premature:
	// the courier has not arrived, the product is unverified, the cash is not in.
	ErrHandoverWrongState   = errors.New("HANDOVER_WRONG_STATE")
	ErrPaymentNotVerified   = errors.New("PAYMENT_NOT_VERIFIED")
	ErrNotCashOnDelivery    = errors.New("NOT_CASH_ON_DELIVERY")
	ErrLinesNotAcknowledged = errors.New("LINES_NOT_ACKNOWLEDGED")
)

// handoverActiveStages are the delivery stages at which the courier is physically with
// the buyer and product checks are meaningful. Before COURIER_ARRIVED there is nothing
// to verify; after receipt the handover is closed.
var handoverActiveStages = map[string]bool{
	"COURIER_ARRIVED":             true,
	"DELIVERY_SCAN_SUCCESS":       true,
	"AWAITING_BUYER_CONFIRMATION": true,
}

// SetHandoverDependencies wires the payment side of the handover into the QR service.
// It arrives after construction because PaymentService is itself built from repositories
// this service does not own.
func (s *QRService) SetHandoverDependencies(payments *PaymentService, paymentRepo *repository.BuyerPaymentRepository) {
	s.paymentSvc = payments
	s.paymentRepo = paymentRepo
}

// audit writes one handover step to the handover trail: who, in what role, on which
// order, when. Every step of the handover goes through here.
//
// It deliberately does not use admin_audit_log: that table's actor_admin_id is a foreign
// key to admin_users, so a courier or buyer id cannot be stored there at all.
func (s *QRService) audit(actorID uuid.UUID, role, action string, orderID uuid.UUID, reason string) {
	s.RecordHandoverEvent(orderID, actorID, role, action, "", reason)
}

// RecordHandoverEvent appends one step to an order's handover timeline. Callers outside
// this service — the courier service marking an arrival, for instance — use it so the
// whole handover reads as a single ordered trail.
func (s *QRService) RecordHandoverEvent(orderID uuid.UUID, actorID uuid.UUID, role, action, result, detail string) {
	var actor interface{}
	if actorID != uuid.Nil {
		actor = actorID
	}
	if _, err := s.db.Exec(`
		INSERT INTO order_handover_events(order_id,actor_user_id,actor_role,action,result,detail)
		VALUES($1,$2,$3,$4,$5,$6)`, orderID, actor, role, action, result, detail); err != nil {
		log.Printf("handover audit failed for order %s action %s: %v", orderID, action, err)
	}
}

// HandoverTimeline is the ordered audit trail of one order's handover.
func (s *QRService) HandoverTimeline(orderID uuid.UUID) ([]models.HandoverEvent, error) {
	rows, err := s.db.Query(`
		SELECT id, actor_user_id, actor_role, action, result, detail, created_at
		FROM order_handover_events WHERE order_id=$1 ORDER BY created_at`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.HandoverEvent{}
	for rows.Next() {
		var e models.HandoverEvent
		if err = rows.Scan(&e.ID, &e.ActorUserID, &e.ActorRole, &e.Action, &e.Result, &e.Detail, &e.CreatedAt); err != nil {
			return nil, err
		}
		e.OrderID = orderID
		out = append(out, e)
	}
	return out, rows.Err()
}

// productIdentity is what a QR token or a typed product number resolves to. It is always
// resolved server-side: the scanned value is an opaque reference, never product data.
type productIdentity struct {
	productID uuid.UUID
	variantID *uuid.UUID
	method    string
	reference string
}

// resolveProductIdentity turns a scanned token or a manually typed product number into a
// product/variant pair. The manual path runs the identical lookup, so typing the number
// is a fallback for a broken camera, not a way around verification.
func (s *QRService) resolveProductIdentity(req models.ProductVerificationRequest) (*productIdentity, error) {
	token := strings.TrimSpace(req.Token)
	manual := strings.ToUpper(strings.TrimSpace(req.ProductNumber))

	ident := &productIdentity{method: "MANUAL_PRODUCT_NUMBER", reference: manual}
	var ref uuid.UUID
	var err error

	if token != "" {
		ident.method = "QR_SCAN"
		ident.reference = ""
		ref, err = s.parse(token, "p")
		if err != nil {
			return ident, ErrQRInvalid
		}
	} else {
		parts := strings.SplitN(manual, "-", 2)
		if len(parts) != 2 || (parts[0] != "PRD" && parts[0] != "VAR") || len(parts[1]) != 8 {
			return ident, ErrQRInvalid
		}
		if err = s.db.QueryRow(
			`SELECT public_reference FROM product_qr_codes WHERE UPPER(LEFT(public_reference::text,8))=$1`,
			parts[1]).Scan(&ref); err != nil {
			return ident, ErrQRInvalid
		}
	}

	var status string
	if err = s.db.QueryRow(`SELECT product_id,variant_id,status FROM product_qr_codes WHERE public_reference=$1`, ref).
		Scan(&ident.productID, &ident.variantID, &status); err != nil || status != "ACTIVE" {
		return ident, ErrQRInvalid
	}
	return ident, nil
}

// matchIdentityToOrder decides what a resolved product means for this order. The checks
// run narrowest-last so the courier gets the most specific reason: a product that is not
// in the order at all is WRONG_PRODUCT, one whose variant differs is WRONG_VARIANT.
func (s *QRService) matchIdentityToOrder(orderID uuid.UUID, ident *productIdentity) (string, *models.HandoverVerificationResult) {
	// The seller behind the scanned product must be the seller behind the order.
	var sameBusiness bool
	if err := s.db.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM products p JOIN orders o ON o.business_id=p.business_id WHERE p.id=$1 AND o.id=$2)`,
		ident.productID, orderID).Scan(&sameBusiness); err != nil || !sameBusiness {
		return models.HandoverResultWrongShop, nil
	}

	var productInOrder bool
	if err := s.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM order_lines WHERE order_id=$1 AND product_id=$2)`,
		orderID, ident.productID).Scan(&productInOrder); err != nil || !productInOrder {
		return models.HandoverResultWrongProduct, nil
	}

	// A product-level QR cannot identify which variant is in the box, and the order was
	// placed for a specific variant. That is a variant mismatch, not an acceptable scan.
	if ident.variantID == nil {
		return models.HandoverResultWrongVariant, nil
	}

	out := &models.HandoverVerificationResult{OrderID: orderID}
	var attrsRaw []byte
	var publicRef uuid.UUID
	var lineID, productID, variantID uuid.UUID
	err := s.db.QueryRow(`
		SELECT ol.id, ol.product_id, ol.variant_id, COALESCE(o.order_number,''), p.name, v.name, v.attributes,
		       q.public_reference, s.name, b.name, ol.quantity, ol.final_unit_price, COALESCE(o.currency,'USD')
		FROM order_lines ol
		JOIN orders o ON o.id = ol.order_id
		JOIN products p ON p.id = ol.product_id
		JOIN product_variants v ON v.id = ol.variant_id
		JOIN shops s ON s.id = o.shop_id
		JOIN businesses b ON b.id = o.business_id
		JOIN product_qr_codes q ON q.product_id = p.id AND q.variant_id = v.id
		WHERE ol.order_id=$1 AND ol.product_id=$2 AND ol.variant_id=$3`,
		orderID, ident.productID, *ident.variantID).
		Scan(&lineID, &productID, &variantID, &out.OrderNumber, &out.ProductName, &out.VariantName, &attrsRaw,
			&publicRef, &out.ShopName, &out.SellerName, &out.Quantity, &out.UnitPrice, &out.Currency)
	if errors.Is(err, sql.ErrNoRows) {
		return models.HandoverResultWrongVariant, nil
	}
	if err != nil {
		return models.HandoverResultInvalidQR, nil
	}

	_ = json.Unmarshal(attrsRaw, &out.Attributes)
	out.OrderLineID, out.ProductID, out.VariantID = &lineID, &productID, &variantID
	out.ProductNumber = "VAR-" + strings.ToUpper(publicRef.String()[:8])
	out.LineTotal = models.RoundMoney(out.UnitPrice * float64(out.Quantity))
	return models.HandoverResultValid, out
}

// recordVerification persists every attempt, successful or not. A rejected scan is
// exactly the kind of event an investigation needs, so failures are never dropped.
func (s *QRService) recordVerification(orderID, buyerProfileID uuid.UUID, courierID *uuid.UUID, actorID uuid.UUID,
	role string, ident *productIdentity, lineID *uuid.UUID, resultCode, reason string) {
	dbResult := "REJECTED"
	if resultCode == models.HandoverResultValid {
		dbResult = "SUCCESS"
	}
	var productID, variantID interface{}
	if ident != nil && ident.productID != uuid.Nil {
		productID = ident.productID
		if ident.variantID != nil {
			variantID = *ident.variantID
		}
	}
	method, reference := "MANUAL_PRODUCT_NUMBER", ""
	if ident != nil {
		method, reference = ident.method, ident.reference
	}
	_, _ = s.db.Exec(`
		INSERT INTO product_handover_verifications
			(order_id,buyer_profile_id,courier_id,product_id,variant_id,verification_method,
			 supplied_reference,result,reason,verified_by_role,verified_by_user_id,order_line_id,result_code)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		ON CONFLICT DO NOTHING`,
		orderID, buyerProfileID, courierID, productID, variantID, method,
		reference, dbResult, reason, role, actorID, lineID, resultCode)
}

// handoverContext is the order state every handover action validates against.
type handoverContext struct {
	orderID        uuid.UUID
	orderNumber    string
	orderStatus    string
	deliveryStatus string
	buyerProfileID uuid.UUID
	buyerUserID    uuid.UUID
	courierID      *uuid.UUID
}

func (s *QRService) loadHandoverContext(orderID uuid.UUID) (*handoverContext, error) {
	ctx := &handoverContext{orderID: orderID}
	err := s.db.QueryRow(`
		SELECT COALESCE(o.order_number,''), o.status::text, COALESCE(o.delivery_status,''),
		       bp.id, bp.user_id, o.assigned_courier_id
		FROM orders o JOIN buyer_profiles bp ON bp.id=o.buyer_profile_id
		WHERE o.id=$1`, orderID).
		Scan(&ctx.orderNumber, &ctx.orderStatus, &ctx.deliveryStatus, &ctx.buyerProfileID, &ctx.buyerUserID, &ctx.courierID)
	if err != nil {
		return nil, ErrHandoverForbidden
	}
	return ctx, nil
}

// requireAssignedCourier is the gate on every courier handover action: the caller must be
// the courier this order was assigned to, and still an active courier.
func (s *QRService) requireAssignedCourier(ctx *handoverContext, courierUserID uuid.UUID) error {
	if ctx.courierID == nil || *ctx.courierID != courierUserID {
		return ErrQRWrongCourier
	}
	var active bool
	if err := s.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM couriers WHERE user_id=$1 AND status='ACTIVE')`, courierUserID).
		Scan(&active); err != nil || !active {
		return ErrQRForbidden
	}
	return nil
}

// CourierVerifyProduct is the courier-side product check at the door: scan the QR on the
// package, or type its reference when the camera fails, and the server decides whether
// that physical item belongs to this order. Nothing about the order advances here — a
// valid scan only unlocks the steps that follow.
func (s *QRService) CourierVerifyProduct(courierUserID, orderID uuid.UUID, req models.ProductVerificationRequest) (*models.HandoverVerificationResult, error) {
	ctx, err := s.loadHandoverContext(orderID)
	if err != nil {
		return nil, err
	}
	if err = s.requireAssignedCourier(ctx, courierUserID); err != nil {
		return nil, err
	}
	return s.verifyProduct(ctx, courierUserID, "COURIER", req)
}

// verifyProduct is the one product verifier. Buyer and courier reach it by different
// routes and with different authorisation, but the identity resolution, the order match
// and the audit row are identical — there is no weaker path.
func (s *QRService) verifyProduct(ctx *handoverContext, actorID uuid.UUID, role string, req models.ProductVerificationRequest) (*models.HandoverVerificationResult, error) {
	if !handoverActiveStages[ctx.deliveryStatus] ||
		ctx.orderStatus == string(models.OrderStatusCancelled) || ctx.orderStatus == string(models.OrderStatusRejected) {
		s.recordVerification(ctx.orderID, ctx.buyerProfileID, ctx.courierID, actorID, role, nil, nil,
			models.HandoverResultWrongOrder, "INVALID_DELIVERY_STATE")
		s.audit(actorID, role, "HANDOVER_PRODUCT_VERIFY_REJECTED", ctx.orderID, "Order not in handover state: "+ctx.deliveryStatus)
		return nil, ErrQRNotOperational
	}

	ident, err := s.resolveProductIdentity(req)
	if err != nil {
		s.recordVerification(ctx.orderID, ctx.buyerProfileID, ctx.courierID, actorID, role, ident, nil,
			models.HandoverResultInvalidQR, "INVALID_PRODUCT_IDENTITY")
		s.audit(actorID, role, "HANDOVER_PRODUCT_VERIFY_REJECTED", ctx.orderID, "Unresolvable product reference")
		return &models.HandoverVerificationResult{
			Result: models.HandoverResultInvalidQR, Reason: "INVALID_PRODUCT_IDENTITY",
			VerificationMethod: ident.method, OrderID: ctx.orderID,
		}, nil
	}

	code, detail := s.matchIdentityToOrder(ctx.orderID, ident)
	if code != models.HandoverResultValid {
		s.recordVerification(ctx.orderID, ctx.buyerProfileID, ctx.courierID, actorID, role, ident, nil, code, code)
		s.audit(actorID, role, "HANDOVER_PRODUCT_VERIFY_REJECTED", ctx.orderID, "Product does not match order: "+code)
		return &models.HandoverVerificationResult{
			Result: code, Reason: code, VerificationMethod: ident.method, OrderID: ctx.orderID, OrderNumber: ctx.orderNumber,
		}, nil
	}

	detail.VerificationMethod = ident.method

	// A line already verified stays verified. Re-scanning reports the original result
	// rather than writing a second row, so a duplicate scan has no duplicate effect.
	var existingAt time.Time
	err = s.db.QueryRow(
		`SELECT created_at FROM product_handover_verifications WHERE order_id=$1 AND order_line_id=$2 AND result='SUCCESS'`,
		ctx.orderID, *detail.OrderLineID).Scan(&existingAt)
	if err == nil {
		detail.Result = models.HandoverResultAlreadyUsed
		detail.Reason = "ALREADY_VERIFIED"
		detail.VerifiedAt = &existingAt
		return detail, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	s.recordVerification(ctx.orderID, ctx.buyerProfileID, ctx.courierID, actorID, role, ident, detail.OrderLineID,
		models.HandoverResultValid, "")
	s.audit(actorID, role, "HANDOVER_PRODUCT_VERIFIED", ctx.orderID,
		"Verified "+detail.ProductNumber+" via "+ident.method)

	now := time.Now()
	detail.Result = models.HandoverResultValid
	detail.VerifiedAt = &now
	if s.commSvc != nil {
		_ = s.commSvc.TriggerOrderEventNotification(ctx.orderID, models.NotificationTypeBuyerReceiptRequired,
			map[string]interface{}{"product_verified": true, "order_line_id": detail.OrderLineID.String()})
	}
	return detail, nil
}
