package service

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

// SetExpectedDelivery records the day and slot the courier commits to once they
// hold the parcel. Buyer, seller and commerce admin read it from the order.
func (s *CourierService) SetExpectedDelivery(userID, orderID uuid.UUID, date, slot string) error {
	if courier, err := s.courierRepo.GetByUserID(userID); err != nil || courier == nil {
		return ErrCourierNotFound
	}
	day, err := validateExpectedDelivery(date, strings.ToUpper(slot), time.Now())
	if err != nil {
		return err
	}
	res, err := s.db.Exec(`UPDATE orders
		SET expected_delivery_date = $3, expected_delivery_slot = $4, expected_delivery_set_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND assigned_courier_id = $2 AND delivery_status IN ('PICKED_UP', 'IN_TRANSIT', 'COURIER_ARRIVED')`,
		orderID, userID, day, strings.ToUpper(slot))
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrInvalidStatusTransition
	}
	return nil
}

func (s *CourierService) hasExpectedDelivery(orderID uuid.UUID) bool {
	var set bool
	_ = s.db.QueryRow(`SELECT expected_delivery_date IS NOT NULL FROM orders WHERE id = $1`, orderID).Scan(&set)
	return set
}

// BuyerNotFoundRequest is the courier's report when nobody takes the parcel.
type BuyerNotFoundRequest struct {
	Reason   string `json:"reason" binding:"required,max=100"`
	Notes    string `json:"notes"`
	NextDate string `json:"next_date"`
	NextSlot string `json:"next_slot"`
}

// BuyerNotFoundResult tells the courier what happens next.
type BuyerNotFoundResult struct {
	Outcome  string `json:"outcome"` // RESCHEDULED or RETURNING_TO_SELLER
	Attempts int    `json:"delivery_attempts"`
}

// ReportBuyerNotFound handles a failed attempt at the door or on the way. The
// first one keeps the parcel with the courier for a new attempt at the day and
// slot they give; the second sends it back to the seller and cancels the order.
func (s *CourierService) ReportBuyerNotFound(userID, orderID uuid.UUID, req BuyerNotFoundRequest) (*BuyerNotFoundResult, error) {
	if courier, err := s.courierRepo.GetByUserID(userID); err != nil || courier == nil {
		return nil, ErrCourierNotFound
	}
	order, err := s.courierRepo.GetOrderByIDForCourier(userID, orderID)
	if err != nil || order == nil {
		return nil, ErrMissionNotFound
	}
	if order.DeliveryStatus != "IN_TRANSIT" && order.DeliveryStatus != "COURIER_ARRIVED" {
		return nil, ErrInvalidStatusTransition
	}

	var attempts int
	if err := s.db.QueryRow(`SELECT delivery_attempts FROM orders WHERE id = $1`, orderID).Scan(&attempts); err != nil {
		return nil, err
	}
	attempts++
	reason := strings.TrimSpace(req.Reason)

	if attempts >= MaxDeliveryAttempts {
		if _, err := s.db.Exec(`UPDATE orders SET delivery_attempts = $2, failed_delivery_reason = $3, failed_delivery_notes = $4,
			updated_at = NOW() WHERE id = $1`, orderID, attempts, reason, req.Notes); err != nil {
			return nil, err
		}
		if s.orderSvc == nil {
			return nil, ErrInvalidStatusTransition
		}
		if _, err := s.orderSvc.cancelWithStage(orderID, CancelStageBuyerNotFound,
			"Buyer not found twice: parcel returning to the seller"); err != nil {
			return nil, err
		}
		s.recordBuyerNotFound(orderID, userID, "Buyer not found again, parcel returning to the seller: "+reason)
		return &BuyerNotFoundResult{Outcome: DeliveryStatusReturningToSeller, Attempts: attempts}, nil
	}

	day, err := validateExpectedDelivery(req.NextDate, strings.ToUpper(req.NextSlot), time.Now())
	if err != nil {
		return nil, err
	}
	res, err := s.db.Exec(`UPDATE orders
		SET delivery_status = 'PICKED_UP', delivery_attempts = $3,
		    expected_delivery_date = $4, expected_delivery_slot = $5, expected_delivery_set_at = NOW(),
		    courier_started_at = NULL, courier_arrived_at = NULL,
		    failed_delivery_reason = $6, failed_delivery_notes = $7, updated_at = NOW()
		WHERE id = $1 AND assigned_courier_id = $2 AND delivery_status IN ('IN_TRANSIT', 'COURIER_ARRIVED')`,
		orderID, userID, attempts, day, strings.ToUpper(req.NextSlot), reason, req.Notes)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, ErrInvalidStatusTransition
	}
	s.recordBuyerNotFound(orderID, userID, "Buyer not found, new attempt planned: "+reason)
	return &BuyerNotFoundResult{Outcome: "RESCHEDULED", Attempts: attempts}, nil
}

func (s *CourierService) recordBuyerNotFound(orderID, userID uuid.UUID, detail string) {
	if s.qrSvc != nil {
		s.qrSvc.RecordHandoverEvent(orderID, userID, "COURIER", "BUYER_NOT_FOUND", "FAILED", detail)
	}
}
