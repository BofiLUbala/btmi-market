package service

import (
	"testing"

	"github.com/btmi-ai-market/backend/internal/models"
)

// applyHandoverGates is pure: facts in, stage and permission flags out. The
// clients enable buttons from these flags, so the ordering rules asserted here
// are the rules the courier and buyer apps obey.
func TestApplyHandoverGatesScanDelivery(t *testing.T) {
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

	t.Run("scan open once verified and paid", func(t *testing.T) {
		s := base
		s.CourierArrived = true
		s.AllProductsVerified = true
		s.PaymentVerified = true
		(&QRService{}).applyHandoverGates(&s)
		if !s.CourierCanScanDelivery {
			t.Error("courier should be able to scan the delivery QR once verified and paid")
		}
		if s.Stage != models.HandoverStagePaymentVerified {
			t.Errorf("stage = %q, want PAYMENT_VERIFIED", s.Stage)
		}
	})

	t.Run("scan closed after scan", func(t *testing.T) {
		s := base
		s.CourierArrived = true
		s.AllProductsVerified = true
		s.PaymentVerified = true
		s.DeliveryScanned = true
		(&QRService{}).applyHandoverGates(&s)
		if s.CourierCanScanDelivery {
			t.Error("delivery QR must be scanned exactly once")
		}
		if s.Stage != models.HandoverStageAwaitingReceipt {
			t.Errorf("stage = %q, want AWAITING_BUYER_CONFIRMATION", s.Stage)
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
