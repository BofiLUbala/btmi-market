package service

import (
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

// productIdentity is what one verified order line records: the product and variant in
// the box, how the courier confirmed it and what they typed.
type productIdentity struct {
	productID uuid.UUID
	variantID *uuid.UUID
	method    string
	reference string
}

// normalizeOrderCode reduces a typed order number to its comparable form: case, spaces,
// dashes and a missing BTMI prefix do not matter ("btmi 7k4m-9q2x", "7K4M9Q2X").
func normalizeOrderCode(v string) string {
	var b strings.Builder
	for _, r := range strings.ToUpper(v) {
		if r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	code := b.String()
	if code != "" && !strings.HasPrefix(code, "BTMI") {
		code = "BTMI" + code
	}
	return code
}

// matchOrderCode decides whether what the courier typed or scanned is this order's code:
// its order number, or the QR printed next to it on the parcel label. It reports whether
// the code belongs to another order, so the courier is told they hold the wrong parcel.
func (s *QRService) matchOrderCode(ctx *handoverContext, req models.ProductVerificationRequest) (matched, otherOrder bool, method, supplied string) {
	token := strings.TrimSpace(req.Token)
	typed := strings.TrimSpace(req.ProductNumber)
	// A camera reading the order number printed as a plain QR is still a scan.
	scannedText := false
	if token != "" && !strings.HasPrefix(strings.ToLower(token), "tbk.") {
		typed, token, scannedText = token, "", true
	}
	if token == "" && strings.HasPrefix(strings.ToLower(typed), "tbk.") {
		token, typed = typed, ""
	}

	if token != "" {
		ref, err := s.parse(token, "d")
		if err != nil {
			return false, false, "QR_SCAN", ""
		}
		var packageOrder uuid.UUID
		if err := s.db.QueryRow(`SELECT order_id FROM delivery_packages WHERE public_reference=$1`, ref).Scan(&packageOrder); err != nil {
			return false, false, "QR_SCAN", ""
		}
		return packageOrder == ctx.orderID, packageOrder != ctx.orderID, "QR_SCAN", ctx.orderNumber
	}

	method = "MANUAL_ORDER_CODE"
	if scannedText {
		method = "QR_SCAN"
	}
	supplied = normalizeOrderCode(typed)
	if supplied == "" {
		return false, false, method, ""
	}
	if supplied == normalizeOrderCode(ctx.orderNumber) {
		return true, false, method, supplied
	}
	_ = s.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM orders WHERE regexp_replace(UPPER(order_number), '[^A-Z0-9]', '', 'g') = $1)`,
		supplied).Scan(&otherOrder)
	return false, otherOrder, method, supplied
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
	if _, err := s.db.Exec(`
		INSERT INTO product_handover_verifications
			(order_id,buyer_profile_id,courier_id,product_id,variant_id,verification_method,
			 supplied_reference,result,reason,verified_by_role,verified_by_user_id,order_line_id,result_code)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		ON CONFLICT DO NOTHING`,
		orderID, buyerProfileID, courierID, productID, variantID, method,
		reference, dbResult, reason, role, actorID, lineID, resultCode); err != nil {
		// A lost success row leaves the order unverifiable, so it must never fail silently.
		log.Printf("handover verification not recorded for order %s: %v", orderID, err)
	}
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

	matched, otherOrder, method, supplied := s.matchOrderCode(ctx, req)
	if !matched {
		result, reason := models.HandoverResultInvalidQR, "INVALID_ORDER_CODE"
		if otherOrder {
			result, reason = models.HandoverResultWrongOrder, "WRONG_ORDER_CODE"
		}
		s.recordVerification(ctx.orderID, ctx.buyerProfileID, ctx.courierID, actorID, role,
			&productIdentity{method: method, reference: supplied}, nil, result, reason)
		s.audit(actorID, role, "HANDOVER_PRODUCT_VERIFY_REJECTED", ctx.orderID, "Order code refused: "+reason)
		return &models.HandoverVerificationResult{
			Result: result, Reason: reason, VerificationMethod: method, OrderID: ctx.orderID, OrderNumber: ctx.orderNumber,
		}, nil
	}

	// The right order code confirms the parcel, so every line in it is verified at once.
	rows, err := s.db.Query(`
		SELECT ol.id, ol.product_id, ol.variant_id, p.name, COALESCE(v.name, ''), ol.quantity,
		       EXISTS(SELECT 1 FROM product_handover_verifications h
		              WHERE h.order_id = ol.order_id AND h.order_line_id = ol.id AND h.result = 'SUCCESS')
		FROM order_lines ol
		JOIN products p ON p.id = ol.product_id
		LEFT JOIN product_variants v ON v.id = ol.variant_id
		WHERE ol.order_id = $1 ORDER BY ol.id`, ctx.orderID)
	if err != nil {
		return nil, err
	}
	type line struct {
		id, productID uuid.UUID
		variantID     *uuid.UUID
		name, variant string
		quantity      int
		verified      bool
	}
	var lines []line
	for rows.Next() {
		var l line
		if err := rows.Scan(&l.id, &l.productID, &l.variantID, &l.name, &l.variant, &l.quantity, &l.verified); err != nil {
			rows.Close()
			return nil, err
		}
		lines = append(lines, l)
	}
	rows.Close()

	out := &models.HandoverVerificationResult{
		Result: models.HandoverResultValid, VerificationMethod: method, OrderID: ctx.orderID,
		OrderNumber: ctx.orderNumber, ProductNumber: ctx.orderNumber,
	}
	names := make([]string, 0, len(lines))
	newlyVerified := 0
	for _, l := range lines {
		label := l.name
		if l.variant != "" && l.variant != l.name {
			label += " · " + l.variant
		}
		names = append(names, label)
		out.Quantity += l.quantity
		if l.verified {
			continue
		}
		lineID := l.id
		s.recordVerification(ctx.orderID, ctx.buyerProfileID, ctx.courierID, actorID, role,
			&productIdentity{productID: l.productID, variantID: l.variantID, method: method, reference: supplied},
			&lineID, models.HandoverResultValid, "")
		newlyVerified++
	}
	out.ProductName = strings.Join(names, ", ")
	if len(lines) > 0 {
		first := lines[0]
		out.OrderLineID, out.ProductID, out.VariantID = &first.id, &first.productID, first.variantID
		out.VariantName = first.variant
	}
	now := time.Now()
	out.VerifiedAt = &now
	if newlyVerified == 0 {
		out.Result, out.Reason = models.HandoverResultAlreadyUsed, "ALREADY_VERIFIED"
		return out, nil
	}
	s.audit(actorID, role, "HANDOVER_PRODUCT_VERIFIED", ctx.orderID, "Order code confirmed via "+method)
	if s.commSvc != nil {
		_ = s.commSvc.TriggerOrderEventNotification(ctx.orderID, models.NotificationTypeBuyerReceiptRequired,
			map[string]interface{}{"product_verified": true})
	}
	return out, nil
}
