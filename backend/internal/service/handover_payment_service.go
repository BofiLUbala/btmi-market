package service

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// paymentSettled reports whether the buyer has actually paid, as opposed to having
// promised to. Only PAID and its legacy spelling VERIFIED count: CONFIRMED was a
// declaration, and a declaration is not money.
func paymentSettled(status models.BuyerPaymentStatus) bool {
	return models.PaymentSettled(status)
}

// CourierConfirmCash records that the courier physically received the cash at the door.
//
// It settles the buyer's payment and nothing else. TBK's commission on the sale is a
// separate ledger and stays DUE until Finance collects it, so a courier walking away
// with 100 USD never marks the 3 USD commission collected.
func (s *QRService) CourierConfirmCash(courierUserID, orderID uuid.UUID, req models.ConfirmCashRequest) (*models.ConfirmCashResponse, error) {
	if !req.Confirmed {
		return nil, ErrHandoverWrongState
	}
	ctx, err := s.loadHandoverContext(orderID)
	if err != nil {
		return nil, err
	}
	if err = s.requireAssignedCourier(ctx, courierUserID); err != nil {
		return nil, err
	}
	if !handoverActiveStages[ctx.deliveryStatus] {
		return nil, ErrHandoverWrongState
	}
	if s.paymentRepo == nil {
		return nil, errors.New("PAYMENT_NOT_CONFIGURED")
	}

	payment, err := s.paymentRepo.GetByOrderID(orderID)
	if err != nil {
		return nil, err
	}
	if payment == nil {
		return nil, errors.New("PAYMENT_NOT_FOUND")
	}
	// Mobile money is settled by its provider alone. A courier tapping a button is not
	// evidence that money moved, so this path refuses anything but cash.
	if payment.PaymentMethod != models.PaymentMethodCashOnDelivery {
		return nil, ErrNotCashOnDelivery
	}

	// Cash changes hands only after the goods have been checked against the order.
	verified, total, err := s.lineVerificationCounts(orderID)
	if err != nil {
		return nil, err
	}
	if total == 0 || verified < total {
		return nil, ErrProductNotVerified
	}

	response := &models.ConfirmCashResponse{
		OrderID: orderID, PaymentID: payment.ID,
		AmountCollected: payment.FinalTotal, Currency: payment.Currency,
	}

	if paymentSettled(payment.Status) {
		response.AlreadyConfirmed = true
		response.PaymentStatus = string(payment.Status)
		s.fillCommission(orderID, response)
		return response, nil
	}

	// Settling is guarded on status, which is what makes a retried confirmation
	// harmless: the second call matches no row, so it neither re-credits points nor
	// re-books commission.
	settled, err := s.paymentRepo.SettleCashByCourier(payment.ID, courierUserID)
	if err != nil {
		return nil, err
	}
	if !settled {
		response.AlreadyConfirmed = true
		response.PaymentStatus = string(models.BuyerPaymentStatusPaid)
		s.fillCommission(orderID, response)
		return response, nil
	}

	now := time.Now()
	payment.Status = models.BuyerPaymentStatusPaid
	payment.VerifiedAt = &now
	payment.PaidAt = &now
	payment.CashReceivedAt = &now
	payment.CashReceivedBy = &courierUserID
	payment.ConfirmedByUserID = &courierUserID
	payment.ConfirmationActor = models.PaymentConfirmationActorCourier
	response.PaymentStatus = string(models.BuyerPaymentStatusPaid)
	response.ConfirmedAt = &now
	response.ConfirmedByUserID = &courierUserID
	response.ConfirmationActor = models.PaymentConfirmationActorCourier

	// The audit row carries who took the money, for which order, and how much, so the
	// cash trail can be reconstructed without joining back through the payment.
	s.audit(courierUserID, "COURIER", "HANDOVER_CASH_RECEIVED", orderID,
		fmt.Sprintf("Courier confirmed %s %.2f received in cash for order %s (payment %s, method %s)",
			payment.Currency, payment.FinalTotal, ctx.orderNumber, payment.ID, payment.PaymentMethod))

	if s.paymentSvc != nil {
		s.paymentSvc.enqueueVerified(payment)
		if s.paymentSvc.commService != nil {
			_, _ = s.paymentSvc.commService.CalculateAndRecordCommission(orderID)
		}
	}
	s.fillCommission(orderID, response)

	if s.commSvc != nil {
		_ = s.commSvc.TriggerOrderEventNotification(orderID, models.NotificationTypeBuyerReceiptRequired,
			map[string]interface{}{"payment_status": string(models.BuyerPaymentStatusPaid), "payment_method": payment.PaymentMethod})
	}
	return response, nil
}

// fillCommission reports the commission ledger as it stands, so the courier app can show
// that the sale is paid while TBK's own cut is still outstanding.
func (s *QRService) fillCommission(orderID uuid.UUID, out *models.ConfirmCashResponse) {
	var status string
	var amount float64
	err := s.db.QueryRow(`SELECT status, commission_amount FROM sale_commissions WHERE order_id=$1`, orderID).
		Scan(&status, &amount)
	if err != nil {
		return
	}
	out.CommissionStatus, out.CommissionAmount = status, amount
	out.CommissionCollected = status == string(models.CommissionStatusCollected)
}

// lineVerificationCounts returns how many of the order's lines have a successful physical
// product verification, and how many lines there are.
func (s *QRService) lineVerificationCounts(orderID uuid.UUID) (int, int, error) {
	var verified, total int
	err := s.db.QueryRow(`
		SELECT COUNT(*) FILTER (WHERE v.order_line_id IS NOT NULL), COUNT(*)
		FROM order_lines ol
		LEFT JOIN product_handover_verifications v
		       ON v.order_line_id = ol.id AND v.order_id = ol.order_id AND v.result = 'SUCCESS'
		WHERE ol.order_id = $1`, orderID).Scan(&verified, &total)
	return verified, total, err
}

// AcknowledgeHandoverLines records the buyer confirming, line by line, that the item is
// in their hands, is what they ordered, and is the right quantity. It is deliberately
// separate from confirming receipt: this says what arrived, not that the deal is done.
func (s *QRService) AcknowledgeHandoverLines(buyerUserID, orderID uuid.UUID, req models.AcknowledgeHandoverRequest) (*models.HandoverState, error) {
	ctx, err := s.loadHandoverContext(orderID)
	if err != nil {
		return nil, err
	}
	if ctx.buyerUserID != buyerUserID {
		return nil, ErrQRForbidden
	}
	if !handoverActiveStages[ctx.deliveryStatus] {
		return nil, ErrHandoverWrongState
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	for _, line := range req.Lines {
		var belongs bool
		if err = tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM order_lines WHERE id=$1 AND order_id=$2)`,
			line.OrderLineID, orderID).Scan(&belongs); err != nil {
			return nil, err
		}
		if !belongs {
			return nil, ErrQRInvalid
		}
		// Re-submitting an acknowledgement overwrites it rather than stacking rows, so a
		// buyer who taps twice, or corrects an answer, leaves exactly one record per line.
		if _, err = tx.Exec(`
			INSERT INTO order_line_receipt_acknowledgements
				(order_id,order_line_id,buyer_profile_id,product_received,matches_order,quantity_correct)
			VALUES($1,$2,$3,$4,$5,$6)
			ON CONFLICT (order_id,order_line_id) DO UPDATE
			SET product_received=EXCLUDED.product_received, matches_order=EXCLUDED.matches_order,
			    quantity_correct=EXCLUDED.quantity_correct, updated_at=NOW()`,
			orderID, line.OrderLineID, ctx.buyerProfileID,
			line.ProductReceived, line.MatchesOrder, line.QuantityCorrect); err != nil {
			return nil, err
		}
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}

	s.audit(buyerUserID, "BUYER", "HANDOVER_LINES_ACKNOWLEDGED", orderID, "Buyer acknowledged order lines at handover")
	return s.HandoverState(orderID, buyerUserID, "BUYER")
}

// HandoverState assembles what both apps render the handover from. The caller is checked
// against the order first: a courier sees only orders assigned to them, a buyer only
// their own.
func (s *QRService) HandoverState(orderID, userID uuid.UUID, role string) (*models.HandoverState, error) {
	ctx, err := s.loadHandoverContext(orderID)
	if err != nil {
		return nil, err
	}
	switch role {
	case "COURIER":
		if err = s.requireAssignedCourier(ctx, userID); err != nil {
			return nil, err
		}
	case "BUYER":
		if ctx.buyerUserID != userID {
			return nil, ErrQRForbidden
		}
	default:
		return nil, ErrQRForbidden
	}

	state := &models.HandoverState{
		OrderID: orderID, OrderNumber: ctx.orderNumber,
		OrderStatus: ctx.orderStatus, DeliveryStatus: ctx.deliveryStatus,
		Lines: []models.HandoverLine{},
	}

	_ = s.db.QueryRow(`
		SELECT COALESCE(o.delivery_contact_name,''), COALESCE(o.delivery_phone,''), COALESCE(o.delivery_address,''),
		       COALESCE(sh.name,''), COALESCE(b.name,''), COALESCE(o.currency,'USD')
		FROM orders o LEFT JOIN shops sh ON sh.id=o.shop_id LEFT JOIN businesses b ON b.id=o.business_id
		WHERE o.id=$1`, orderID).
		Scan(&state.BuyerName, &state.BuyerPhone, &state.DeliveryAddress, &state.ShopName, &state.SellerName, &state.Currency)

	if s.paymentRepo != nil {
		if payment, perr := s.paymentRepo.GetByOrderID(orderID); perr == nil && payment != nil {
			state.PaymentMethod = payment.PaymentMethod
			state.PaymentStatus = string(payment.Status)
			state.PaymentTiming = payment.PaymentTiming
			state.AmountDue = payment.FinalTotal
			state.Currency = payment.Currency
			state.PaymentVerified = paymentSettled(payment.Status)
		}
	}

	if err = s.loadHandoverLines(orderID, state); err != nil {
		return nil, err
	}

	var scanned, confirmed *time.Time
	_ = s.db.QueryRow(
		`SELECT delivery_scanned_at, receipt_confirmed_at FROM delivery_packages WHERE order_id=$1 AND qr_status='ACTIVE'`,
		orderID).Scan(&scanned, &confirmed)
	state.DeliveryScanned = scanned != nil
	state.ReceiptConfirmed = confirmed != nil
	state.CourierArrived = handoverActiveStages[ctx.deliveryStatus]

	s.applyHandoverGates(state)
	return state, nil
}

func (s *QRService) loadHandoverLines(orderID uuid.UUID, state *models.HandoverState) error {
	rows, err := s.db.Query(`
		SELECT ol.id, ol.product_id, ol.variant_id, ol.product_name, ol.variant_name, ol.variant_attributes,
		       COALESCE(ol.image_url,''), ol.quantity, ol.final_unit_price,
		       COALESCE('VAR-' || UPPER(LEFT(q.public_reference::text,8)), ''),
		       v.created_at, COALESCE(v.verified_by_role,''), (a.order_line_id IS NOT NULL) AS acknowledged
		FROM order_lines ol
		LEFT JOIN product_qr_codes q ON q.product_id = ol.product_id AND q.variant_id = ol.variant_id
		LEFT JOIN product_handover_verifications v
		       ON v.order_line_id = ol.id AND v.order_id = ol.order_id AND v.result = 'SUCCESS'
		LEFT JOIN order_line_receipt_acknowledgements a
		       ON a.order_line_id = ol.id AND a.order_id = ol.order_id
		      AND a.product_received AND a.matches_order AND a.quantity_correct
		WHERE ol.order_id = $1
		ORDER BY ol.created_at`, orderID)
	if err != nil {
		return err
	}
	defer rows.Close()

	allVerified, allAcknowledged := true, true
	for rows.Next() {
		var line models.HandoverLine
		var attrsRaw []byte
		var verifiedAt sql.NullTime
		var role string
		if err = rows.Scan(&line.OrderLineID, &line.ProductID, &line.VariantID, &line.ProductName, &line.VariantName,
			&attrsRaw, &line.ImageURL, &line.Quantity, &line.UnitPrice, &line.ProductNumber,
			&verifiedAt, &role, &line.BuyerAcknowledged); err != nil {
			return err
		}
		_ = json.Unmarshal(attrsRaw, &line.Attributes)
		line.LineTotal = models.RoundMoney(line.UnitPrice * float64(line.Quantity))
		if verifiedAt.Valid {
			at := verifiedAt.Time
			line.ProductVerified, line.VerifiedAt, line.VerifiedByRole = true, &at, role
		}
		allVerified = allVerified && line.ProductVerified
		allAcknowledged = allAcknowledged && line.BuyerAcknowledged
		state.Lines = append(state.Lines, line)
	}
	if err = rows.Err(); err != nil {
		return err
	}
	state.AllProductsVerified = len(state.Lines) > 0 && allVerified
	state.AllLinesAcknowledged = len(state.Lines) > 0 && allAcknowledged
	return nil
}

// applyHandoverGates derives the stage and the permission flags from the facts already
// loaded. The clients read these instead of re-implementing the rules, which keeps the
// button they see and the check the server runs in step.
func (s *QRService) applyHandoverGates(state *models.HandoverState) {
	switch {
	case state.ReceiptConfirmed:
		state.Stage = models.HandoverStageDelivered
	case !state.CourierArrived:
		state.Stage = models.HandoverStageInTransit
	case !state.AllProductsVerified:
		state.Stage = models.HandoverStageArrived
	case !state.PaymentVerified:
		state.Stage = models.HandoverStagePaymentPending
	case !state.DeliveryScanned:
		state.Stage = models.HandoverStagePaymentVerified
	default:
		state.Stage = models.HandoverStageAwaitingReceipt
	}

	if state.ReceiptConfirmed {
		return
	}
	state.CourierCanVerifyProduct = state.CourierArrived && !state.AllProductsVerified
	state.BuyerCanAcknowledge = state.CourierArrived && !state.AllLinesAcknowledged
	state.CourierCanConfirmCash = state.CourierArrived && state.AllProductsVerified &&
		state.PaymentMethod == models.PaymentMethodCashOnDelivery && !state.PaymentVerified
	state.BuyerCanConfirmReceipt = state.CourierArrived && state.AllProductsVerified &&
		state.AllLinesAcknowledged && state.PaymentVerified && state.DeliveryScanned

	if state.BuyerCanConfirmReceipt {
		return
	}
	switch {
	case !state.CourierArrived:
		state.BlockedReason = "COURIER_NOT_ARRIVED"
	case !state.AllProductsVerified:
		state.BlockedReason = "PRODUCT_NOT_VERIFIED"
	case !state.AllLinesAcknowledged:
		state.BlockedReason = "LINES_NOT_ACKNOWLEDGED"
	case !state.PaymentVerified:
		if state.PaymentMethod == models.PaymentMethodCashOnDelivery {
			state.BlockedReason = "AWAITING_CASH_CONFIRMATION"
		} else {
			state.BlockedReason = "AWAITING_PROVIDER_CONFIRMATION"
		}
	case !state.DeliveryScanned:
		state.BlockedReason = "DELIVERY_NOT_SCANNED"
	}
}
