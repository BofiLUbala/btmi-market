package service

import (
	"database/sql"
	"errors"
	"time"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/google/uuid"
)

const (
	DeliveryStatusReturningToSeller = "RETURNING_TO_SELLER"
	DeliveryStatusReturnedToSeller  = "RETURNED_TO_SELLER"
	DeliveryStatusCancelled         = "CANCELLED"

	CancelStageNotAssigned     = "NOT_ASSIGNED"
	CancelStageCourierAssigned = "COURIER_ASSIGNED"
	CancelStageInDelivery      = "IN_DELIVERY"
	CancelStageBuyerNotFound   = "BUYER_NOT_FOUND"

	// A second "buyer not found" sends the parcel back instead of a third trip.
	MaxDeliveryAttempts = 2
)

var (
	ErrOrderAlreadyHandedOver   = errors.New("ORDER_ALREADY_HANDED_OVER")
	ErrNotReturningToSeller     = errors.New("NOT_RETURNING_TO_SELLER")
	ErrExpectedDeliveryRequired = errors.New("EXPECTED_DELIVERY_REQUIRED")
	ErrInvalidExpectedDelivery  = errors.New("INVALID_EXPECTED_DELIVERY")
)

// The parcel has left the shop and is with the courier.
var parcelWithCourier = map[string]bool{"PICKED_UP": true, "IN_TRANSIT": true, "COURIER_ARRIVED": true}

// The handover already happened; the buyer confirms receipt instead of cancelling.
var parcelHandedOver = map[string]bool{"DELIVERY_SCAN_SUCCESS": true, "AWAITING_BUYER_CONFIRMATION": true, "RECEIVED": true}

// releaseCourierIfIdleTx puts a BUSY courier back to AVAILABLE once no mission
// needs them. A parcel travelling back to the seller still needs its courier
// even though the order itself is already cancelled.
func releaseCourierIfIdleTx(tx *sql.Tx, courierUserID uuid.UUID) error {
	_, err := tx.Exec(`
		UPDATE couriers SET availability = 'AVAILABLE', updated_at = NOW()
		WHERE user_id = $1 AND availability = 'BUSY'
		  AND NOT EXISTS (
		      SELECT 1 FROM orders
		      WHERE assigned_courier_id = $1
		        AND ((delivery_status IN ('COURIER_ASSIGNED', 'COURIER_ACCEPTED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED', 'DELIVERY_SCAN_SUCCESS', 'AWAITING_BUYER_CONFIRMATION')
		              AND status NOT IN ('CANCELLED', 'RECEIVED', 'COMPLETED'))
		             OR delivery_status = 'RETURNING_TO_SELLER'))`, courierUserID)
	return err
}

// CancelBuyerOrder lets a buyer cancel their own order at any stage before the
// handover. Before pickup the reservation, points and courier are released at
// once. Once the courier holds the parcel it travels back to the seller, and
// the stock returns only when the seller confirms it is back.
// The buyer's reason is kept with the order (order_cancellations).
func (s *OrderService) CancelBuyerOrder(buyerProfileID, orderID uuid.UUID, reason string) (*models.Order, error) {
	if _, err := s.getBuyerOrder(buyerProfileID, orderID); err != nil {
		return nil, err
	}
	notes := "Order cancelled by buyer"
	if reason != "" {
		notes += ": " + reason
	}
	var by *uuid.UUID
	var buyerUser uuid.UUID
	if err := s.db.QueryRow(`SELECT user_id FROM buyer_profiles WHERE id = $1`, buyerProfileID).Scan(&buyerUser); err == nil {
		by = &buyerUser
	}
	return s.cancelWithStage(orderID, "", notes, models.CancelledByBuyer, by, reason)
}

// CancelUnfinishedCheckout cancels an order the checkout itself could not
// complete (another shop's order failed): no buyer decision, so SYSTEM.
func (s *OrderService) CancelUnfinishedCheckout(buyerProfileID, orderID uuid.UUID) {
	if _, err := s.getBuyerOrder(buyerProfileID, orderID); err != nil {
		return
	}
	_, _ = s.cancelWithStage(orderID, "", "Checkout not completed", models.CancelledBySystem, nil, "Commande non finalisée")
}

// cancelWithStage performs the buyer-side cancellation. forcedStage is set only
// by the courier's second "buyer not found". role, by and reason say who
// cancelled and why (order_cancellations).
func (s *OrderService) cancelWithStage(orderID uuid.UUID, forcedStage, notes, role string, by *uuid.UUID, reason string) (*models.Order, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	txDB := &database.DB{Tx: tx}
	orderRepo := repository.NewOrderRepository(txDB)
	inventoryRepo := repository.NewInventoryRepository(txDB)
	paymentRepo := repository.NewBuyerPaymentRepository(txDB)

	order, err := orderRepo.GetByIDForUpdate(orderID)
	if err != nil {
		return nil, mapOrderNotFoundErr(err)
	}
	switch order.Status {
	case models.OrderStatusCancelled, models.OrderStatusRejected, models.OrderStatusDelivered,
		models.OrderStatusReceived, models.OrderStatusCompleted:
		return nil, errors.New("INVALID_STATUS_TRANSITION")
	}
	if parcelHandedOver[order.DeliveryStatus] {
		return nil, ErrOrderAlreadyHandedOver
	}

	payment, err := paymentRepo.GetByOrderIDForUpdate(orderID)
	if err != nil {
		return nil, err
	}
	// A settled mobile payment needs a refund through Finance, which a buyer
	// cannot trigger alone. The courier's forced return still goes through and
	// leaves the payment untouched for Finance to refund.
	settled := false
	if payment != nil {
		switch payment.Status {
		case models.BuyerPaymentStatusPaid, models.BuyerPaymentStatusVerified, models.BuyerPaymentStatusRefunded:
			if forcedStage == "" {
				return nil, errors.New("PAYMENT_ALREADY_SETTLED")
			}
			settled = true
		case models.BuyerPaymentStatusProcessing:
			return nil, errors.New("PAYMENT_IN_PROGRESS")
		}
	}

	withCourier := parcelWithCourier[order.DeliveryStatus]
	stage := forcedStage
	switch {
	case stage != "":
	case withCourier:
		stage = CancelStageInDelivery
	case order.AssignedCourierID != nil:
		stage = CancelStageCourierAssigned
	default:
		stage = CancelStageNotAssigned
	}

	// A parcel still at the shop goes straight back to available stock. One
	// already on the road stays reserved until the seller has it back.
	if !withCourier {
		lines, err := orderRepo.GetLinesByOrderID(orderID)
		if err != nil {
			return nil, err
		}
		for _, line := range lines {
			if _, err := inventoryRepo.ReleaseAtomic(order.ShopID, line.VariantID, line.Quantity); err != nil {
				return nil, err
			}
		}
	}

	if order.BuyerProfileID != nil && order.PointsUsed > 0 {
		if err := s.pointRedemptionSvc.ReleaseReservedPoints(*order.BuyerProfileID, orderID, order.PointsUsed, models.PointTransactionRefRedemptionProduct, txDB); err != nil {
			return nil, err
		}
	}
	if order.BuyerProfileID != nil && order.DeliveryPointsUsed > 0 {
		if err := s.pointRedemptionSvc.ReleaseReservedPoints(*order.BuyerProfileID, orderID, order.DeliveryPointsUsed, models.PointTransactionRefRedemptionDelivery, txDB); err != nil {
			return nil, err
		}
	}
	if payment != nil && !settled {
		changed, err := paymentRepo.CancelUnsettled(payment.ID)
		if err != nil {
			return nil, err
		}
		if !changed {
			return nil, errors.New("PAYMENT_STATE_CHANGED")
		}
	}

	updatedOrder, err := orderRepo.UpdateStatus(orderID, models.OrderStatusCancelled)
	if err != nil {
		return nil, err
	}

	deliveryStatus := sql.NullString{}
	switch {
	case withCourier:
		deliveryStatus = sql.NullString{String: DeliveryStatusReturningToSeller, Valid: true}
	case order.DeliveryStatus != "":
		deliveryStatus = sql.NullString{String: DeliveryStatusCancelled, Valid: true}
	}
	if _, err := tx.Exec(`UPDATE orders SET cancelled_stage = $2,
			delivery_status = COALESCE($3, delivery_status), updated_at = NOW() WHERE id = $1`,
		orderID, stage, deliveryStatus); err != nil {
		return nil, err
	}
	if err := orderRepo.CreateStatusHistory(&models.OrderStatusHistory{
		OrderID: orderID, Status: models.OrderStatusCancelled, ChangedBy: by, Notes: notes,
	}); err != nil {
		return nil, err
	}
	if err := orderRepo.RecordCancellation(orderID, role, by, reason, stage); err != nil {
		return nil, err
	}
	if order.AssignedCourierID != nil && !withCourier {
		if err := releaseCourierIfIdleTx(tx, *order.AssignedCourierID); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	s.voidCommission(orderID, notes)
	s.triggerStatusNotification(orderID, models.OrderStatusCancelled)
	updatedOrder.DeliveryStatus = deliveryStatus.String
	return updatedOrder, nil
}

// ConfirmReturnToSeller closes the return of a parcel collected before the
// buyer cancelled (or could not be found): the seller has it back, so its stock
// is released and the courier is free again. userID nil means a commerce admin
// confirmed it.
func (s *OrderService) ConfirmReturnToSeller(userID *uuid.UUID, orderID uuid.UUID) error {
	order, err := s.orderRepo.GetByID(orderID)
	if err != nil {
		return mapOrderNotFoundErr(err)
	}
	if userID != nil {
		if err := s.RequireShopAccess(*userID, order.ShopID); err != nil {
			return err
		}
	}

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	txDB := &database.DB{Tx: tx}
	orderRepo := repository.NewOrderRepository(txDB)
	inventoryRepo := repository.NewInventoryRepository(txDB)

	locked, err := orderRepo.GetByIDForUpdate(orderID)
	if err != nil {
		return mapOrderNotFoundErr(err)
	}
	if locked.DeliveryStatus != DeliveryStatusReturningToSeller {
		return ErrNotReturningToSeller
	}
	lines, err := orderRepo.GetLinesByOrderID(orderID)
	if err != nil {
		return err
	}
	for _, line := range lines {
		if _, err := inventoryRepo.ReleaseAtomic(locked.ShopID, line.VariantID, line.Quantity); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(`UPDATE orders SET delivery_status = $2, returned_to_seller_at = NOW(), updated_at = NOW()
		WHERE id = $1`, orderID, DeliveryStatusReturnedToSeller); err != nil {
		return err
	}
	if locked.AssignedCourierID != nil {
		if err := releaseCourierIfIdleTx(tx, *locked.AssignedCourierID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// deliveryDay returns today's date where the deliveries happen.
func deliveryDay(now time.Time) time.Time {
	loc, err := time.LoadLocation("Africa/Kinshasa")
	if err != nil {
		loc = time.FixedZone("WAT", 3600)
	}
	y, m, d := now.In(loc).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

var deliverySlots = map[string]bool{"MORNING": true, "AFTERNOON": true, "EVENING": true}

// validateExpectedDelivery accepts a day from today to two weeks ahead and one
// of the three delivery slots.
func validateExpectedDelivery(date, slot string, now time.Time) (time.Time, error) {
	if !deliverySlots[slot] {
		return time.Time{}, ErrInvalidExpectedDelivery
	}
	day, err := time.Parse("2006-01-02", date)
	if err != nil {
		return time.Time{}, ErrInvalidExpectedDelivery
	}
	today := deliveryDay(now)
	if day.Before(today) || day.After(today.AddDate(0, 0, 14)) {
		return time.Time{}, ErrInvalidExpectedDelivery
	}
	return day, nil
}
