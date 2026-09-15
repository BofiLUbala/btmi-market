package qr

import (
	"net/http"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
)

// CourierVerifyProduct handles POST /courier/missions/:id/verify-product.
//
// A rejected scan is a 200 carrying a verdict, not an error: the courier app has to show
// "ce produit ne correspond pas à cette commande" and stay on the screen. Only a caller
// who has no business here at all — wrong courier, wrong state — gets an error status.
func (h *Handler) CourierVerifyProduct(c *gin.Context) {
	u, ok := user(c)
	if !ok {
		return
	}
	o, ok := id(c, "id")
	if !ok {
		return
	}
	var req models.ProductVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil ||
		(strings.TrimSpace(req.Token) == "" && strings.TrimSpace(req.ProductNumber) == "") {
		fail(c, service.ErrQRInvalid)
		return
	}
	result, err := h.svc.CourierVerifyProduct(u, o, req)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// CourierConfirmCash handles POST /courier/missions/:id/confirm-cash.
func (h *Handler) CourierConfirmCash(c *gin.Context) {
	u, ok := user(c)
	if !ok {
		return
	}
	o, ok := id(c, "id")
	if !ok {
		return
	}
	var req models.ConfirmCashRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, service.ErrQRInvalid)
		return
	}
	result, err := h.svc.CourierConfirmCash(u, o, req)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": result})
}

// CourierHandoverState handles GET /courier/missions/:id/handover.
func (h *Handler) CourierHandoverState(c *gin.Context) {
	h.handoverState(c, "id", "COURIER")
}

// BuyerHandoverState handles GET /buyer/orders/:order_id/handover.
func (h *Handler) BuyerHandoverState(c *gin.Context) {
	h.handoverState(c, "order_id", "BUYER")
}

func (h *Handler) handoverState(c *gin.Context, param, role string) {
	u, ok := user(c)
	if !ok {
		return
	}
	o, ok := id(c, param)
	if !ok {
		return
	}
	state, err := h.svc.HandoverState(o, u, role)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": state})
}

// AcknowledgeHandoverLines handles POST /buyer/orders/:order_id/handover/acknowledge,
// the buyer's per-line "I have this item, it is what I ordered, the quantity is right".
func (h *Handler) AcknowledgeHandoverLines(c *gin.Context) {
	u, ok := user(c)
	if !ok {
		return
	}
	o, ok := id(c, "order_id")
	if !ok {
		return
	}
	var req models.AcknowledgeHandoverRequest
	if err := c.ShouldBindJSON(&req); err != nil || len(req.Lines) == 0 {
		fail(c, service.ErrQRInvalid)
		return
	}
	state, err := h.svc.AcknowledgeHandoverLines(u, o, req)
	if err != nil {
		fail(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": state})
}
