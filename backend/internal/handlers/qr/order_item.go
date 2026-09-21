package qr

import (
	"net/http"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// OrderItemQR serves the seller-side ORDER_ITEM QR identity (one QR per ordered
// item). The seller must own the order's shop; the caller only ever receives the
// signed opaque reference, never order or buyer data.
func (h *Handler) OrderItemQR(c *gin.Context) {
	u, ok := user(c)
	if !ok {
		return
	}
	o, ok := id(c, "order_id")
	if !ok {
		return
	}
	it, ok := id(c, "item_id")
	if !ok {
		return
	}
	v, e := h.svc.SellerOrderItemQR(u, o, it)
	if e != nil {
		fail(c, e)
		return
	}
	v.LabelURL = "/api/v1/orders/" + o.String() + "/items/" + it.String() + "/qr/image"
	c.JSON(http.StatusOK, gin.H{"data": v})
}

func (h *Handler) OrderItemQRImage(c *gin.Context) {
	u, ok := user(c)
	if !ok {
		return
	}
	o, ok := id(c, "order_id")
	if !ok {
		return
	}
	it, ok := id(c, "item_id")
	if !ok {
		return
	}
	v, e := h.svc.SellerOrderItemQR(u, o, it)
	if e != nil {
		fail(c, e)
		return
	}
	h.png(c, v.Token, "tbk-order-item-"+v.Reference+".png")
}

// BuyerOrderItemQR serves the buyer-side ORDER_ITEM QR identity for one of their
// own ordered items.
func (h *Handler) BuyerOrderItemQR(c *gin.Context) {
	u, ok := user(c)
	if !ok {
		return
	}
	o, ok := id(c, "order_id")
	if !ok {
		return
	}
	it, ok := id(c, "item_id")
	if !ok {
		return
	}
	v, e := h.svc.BuyerOrderItemQR(u, o, it)
	if e != nil {
		fail(c, e)
		return
	}
	v.LabelURL = "/api/v1/buyer/orders/" + o.String() + "/items/" + it.String() + "/qr/image"
	c.JSON(http.StatusOK, gin.H{"data": v})
}

func (h *Handler) BuyerOrderItemQRImage(c *gin.Context) {
	u, ok := user(c)
	if !ok {
		return
	}
	o, ok := id(c, "order_id")
	if !ok {
		return
	}
	it, ok := id(c, "item_id")
	if !ok {
		return
	}
	v, e := h.svc.BuyerOrderItemQR(u, o, it)
	if e != nil {
		fail(c, e)
		return
	}
	h.png(c, v.Token, "")
}

// ResolveOrderItemQR handles POST /qr/resolve. It is the scan path for ORDER_ITEM
// QR codes: validate the signed token, authenticate the caller, resolve the role
// (BUYER / SELLER / COURIER) and return only what that role may see. It never
// mutates order state and never returns data the role may not access.
func (h *Handler) ResolveOrderItemQR(c *gin.Context) {
	u, ok := user(c)
	if !ok {
		return
	}
	var req models.ResolveOrderItemQRRequest
	if e := c.ShouldBindJSON(&req); e != nil || strings.TrimSpace(req.Token) == "" {
		fail(c, service.ErrQRInvalid)
		return
	}
	out, e := h.svc.ResolveOrderItemQR(u, "", req.Token)
	if e != nil {
		fail(c, e)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": out})
}

// AdminResolveOrderItemQR handles POST /admin/qr/resolve, the admin console path to
// the same resolution with the FULL operational context. Only an active admin (the
// AdminAuthMiddleware already checked that) may reach it.
func (h *Handler) AdminResolveOrderItemQR(c *gin.Context) {
	rawRole, exists := c.Get("admin_role")
	if !exists {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": gin.H{"code": "UNAUTHORIZED", "message": "Admin authentication required"}})
		return
	}
	role, ok := rawRole.(string)
	if !ok || models.QRRole(role) != models.QRRoleAdmin {
		fail(c, service.ErrQRForbidden)
		return
	}
	var req models.ResolveOrderItemQRRequest
	if e := c.ShouldBindJSON(&req); e != nil || strings.TrimSpace(req.Token) == "" {
		fail(c, service.ErrQRInvalid)
		return
	}
	out, e := h.svc.ResolveOrderItemQR(uuid.Nil, models.QRRoleAdmin, req.Token)
	if e != nil {
		fail(c, e)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": out})
}
