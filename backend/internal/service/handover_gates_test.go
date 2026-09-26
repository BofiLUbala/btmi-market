package service

import (
	"testing"

	"github.com/btmi-ai-market/backend/internal/models"
)

// applyHandoverGates is pure: facts in, stage and permission flags out. The
// clients enable buttons from these flags, so the ordering rules asserted here
// are the rules the courier and buyer apps obey.
func TestApplyHandoverGatesOrder(t *testing.T) {
	base := models.HandoverState{Lines: []models.HandoverLine{{}}}

	t.Run("scan locked before products verified", func(t *testing.T) {
		s := base
		s.CourierArrived = true
		s.PaymentVerified = true
		(&QRService{}).applyHandoverGates(&s)
		if s.CourierCanScanDelivery {
			t.Error("courier must not scan the delivery QR before products are verified")
		}
		if s.BlockedReason != "PRODUCT_NOT_VERIFIED" {
			t.Errorf("blocked reason = %q, want PRODUCT_NOT_VERIFIED", s.BlockedReason)
		}
	})

	t.Run("scan locked before payment settled", func(t *testing.T) {
		s := base
		s.CourierArrived = true
		s.AllProductsVerified = true
		(&QRService{}).applyHandoverGates(&s)
		if s.CourierCanScanDelivery {
			t.Error("courier must not scan the delivery QR before payment is settled")
		}
	})

	t.Run("no door QR once verified and paid", func(t *testing.T) {
		s := base
		s.CourierArrived = true
		s.AllProductsVerified = true
		s.PaymentVerified = true
		(&QRService{}).applyHandoverGates(&s)
		if s.CourierCanScanDelivery {
			t.Error("the door QR is retired: nothing to scan once verified and paid")
		}
		if s.Stage != models.HandoverStageAwaitingReceipt {
			t.Errorf("stage = %q, want AWAITING_BUYER_CONFIRMATION", s.Stage)
		}
		if s.BuyerCanConfirmReceipt || s.BlockedReason != "LINES_NOT_ACKNOWLEDGED" {
			t.Errorf("receipt must wait for each line: can=%v reason=%q", s.BuyerCanConfirmReceipt, s.BlockedReason)
		}
	})

	t.Run("receipt open once every step is done", func(t *testing.T) {
		s := base
		s.CourierArrived = true
		s.AllProductsVerified = true
		s.AllLinesAcknowledged = true
		s.PaymentVerified = true
		(&QRService{}).applyHandoverGates(&s)
		if !s.BuyerCanConfirmReceipt {
			t.Error("buyer should confirm receipt once goods, lines and payment are all done")
		}
	})

	t.Run("receipt locked while payment is due", func(t *testing.T) {
		s := base
		s.CourierArrived = true
		s.AllProductsVerified = true
		s.AllLinesAcknowledged = true
		s.PaymentMethod = models.PaymentMethodCashOnDelivery
		(&QRService{}).applyHandoverGates(&s)
		if s.BuyerCanConfirmReceipt || s.BlockedReason != "AWAITING_CASH_CONFIRMATION" {
			t.Errorf("receipt must wait for the cash: can=%v reason=%q", s.BuyerCanConfirmReceipt, s.BlockedReason)
		}
	})

	t.Run("cash still requires verification first", func(t *testing.T) {
		s := base
		s.CourierArrived = true
		s.PaymentMethod = models.PaymentMethodCashOnDelivery
		(&QRService{}).applyHandoverGates(&s)
		if s.CourierCanConfirmCash {
			t.Error("cash must not be confirmable before products are verified")
		}
		if s.BlockedReason != "PRODUCT_NOT_VERIFIED" {
			t.Errorf("blocked reason = %q, want PRODUCT_NOT_VERIFIED", s.BlockedReason)
		}
	})
}
