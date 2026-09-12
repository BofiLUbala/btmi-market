package qr

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	qrcode "github.com/skip2/go-qrcode"
)

type Handler struct{ svc *service.QRService }

func NewHandler(svc *service.QRService) *Handler { return &Handler{svc: svc} }

func user(c *gin.Context) (uuid.UUID, bool) {
	v, ok := c.Get("user_id")
	if !ok {
		return uuid.Nil, false
	}
	id, ok := v.(uuid.UUID)
	return id, ok
}
func id(c *gin.Context, name string) (uuid.UUID, bool) {
	v, e := uuid.Parse(c.Param(name))
	if e != nil {
		c.JSON(400, gin.H{"error": gin.H{"code": "INVALID_ID", "message": "Invalid identifier"}})
		return uuid.Nil, false
	}
	return v, true
}
func fail(c *gin.Context, err error) {
	status := http.StatusBadRequest
	code := err.Error()
	switch {
	case errors.Is(err, service.ErrQRForbidden), errors.Is(err, service.ErrQRWrongCourier):
		status = http.StatusForbidden
	case errors.Is(err, service.ErrQRInvalid):
		status = http.StatusUnprocessableEntity
	case errors.Is(err, service.ErrQRNotReady):
		status = http.StatusNotFound
	case errors.Is(err, service.ErrQRDuplicate), errors.Is(err, service.ErrQRAlreadyCompleted):
		status = http.StatusConflict
	}
	c.JSON(status, gin.H{"error": gin.H{"code": code, "message": strings.ReplaceAll(code, "_", " ")}})
}

func (h *Handler) Product(c *gin.Context) {
	u, ok := user(c)
	if !ok {
		return
	}
	p, ok := id(c, "product_id")
	if !ok {
		return
	}
	v, e := h.svc.ProductQR(u, p)
	if e != nil {
		fail(c, e)
		return
	}
	v.LabelURL = fmt.Sprintf("/api/v1/businesses/%s/products/%s/qr/label", c.Param("business_id"), p)
	c.JSON(200, gin.H{"data": v})
}
func (h *Handler) ProductLabel(c *gin.Context) {
	u, ok := user(c)
	if !ok {
		return
	}
	p, ok := id(c, "product_id")
	if !ok {
		return
	}
	v, e := h.svc.ProductQR(u, p)
	if e != nil {
		fail(c, e)
		return
	}
	h.png(c, v.Token, "tbk-product-"+v.Reference+".png")
}
func (h *Handler) SellerPackage(c *gin.Context) {
	u, ok := user(c)
	if !ok {
		return
	}
	o, ok := id(c, "order_id")
	if !ok {
		return
	}
	v, e := h.svc.SellerPackageQR(u, o)
	if e != nil {
		fail(c, e)
		return
	}
	c.JSON(200, gin.H{"data": v})
}
func (h *Handler) SellerPackageLabel(c *gin.Context) {
	u, ok := user(c)
	if !ok {
		return
	}
	o, ok := id(c, "order_id")
	if !ok {
		return
	}
	v, e := h.svc.SellerPackageQR(u, o)
	if e != nil {
		fail(c, e)
		return
	}
	h.png(c, v.Token, "tbk-package-"+v.Reference+".png")
}
func (h *Handler) BuyerPackage(c *gin.Context) {
	u, ok := user(c)
	if !ok {
		return
	}
	o, ok := id(c, "order_id")
	if !ok {
		return
	}
	v, e := h.svc.BuyerPackageQR(u, o)
	if e != nil {
		fail(c, e)
		return
	}
	c.JSON(200, gin.H{"data": v})
}
func (h *Handler) BuyerPackageImage(c *gin.Context) {
	u, ok := user(c)
	if !ok {
		return
	}
	o, ok := id(c, "order_id")
	if !ok {
		return
	}
	v, e := h.svc.BuyerPackageQR(u, o)
	if e != nil {
		fail(c, e)
		return
	}
	h.png(c, v.Token, "")
}
func (h *Handler) ScanPickup(c *gin.Context)   { h.scan(c, "PICKUP") }
func (h *Handler) ScanDelivery(c *gin.Context) { h.scan(c, "DELIVERY") }
func (h *Handler) scan(c *gin.Context, typ string) {
	u, ok := user(c)
	if !ok {
		return
	}
	var req models.QRScanRequest
	if e := c.ShouldBindJSON(&req); e != nil {
		fail(c, service.ErrQRInvalid)
		return
	}
	if req.DeviceMetadata == nil {
		req.DeviceMetadata = map[string]interface{}{}
	}
	req.DeviceMetadata["ip"] = c.ClientIP()
	req.DeviceMetadata["user_agent"] = c.Request.UserAgent()
	v, e := h.svc.Scan(u, typ, req)
	if e != nil {
		fail(c, e)
		return
	}
	c.JSON(200, gin.H{"data": v})
}
func (h *Handler) ConfirmReceipt(c *gin.Context) {
	u, ok := user(c)
	if !ok {
		return
	}
	o, ok := id(c, "order_id")
	if !ok {
		return
	}
	if e := h.svc.ConfirmReceipt(u, o); e != nil {
		fail(c, e)
		return
	}
	c.JSON(200, gin.H{"message": "Receipt confirmed; cash verification remains separate", "delivery_status": "RECEIVED"})
}

// AdminDelivery serves the Commerce Admin handover view. It is mounted under the admin
// commerce group, whose order param is ":id", and returns no QR token.
func (h *Handler) AdminDelivery(c *gin.Context) {
	o, ok := id(c, "id")
	if !ok {
		return
	}
	v, e := h.svc.AdminDeliveryOverview(o)
	if e != nil {
		fail(c, e)
		return
	}
	c.JSON(200, gin.H{"data": v})
}

// RequireCourier keeps buyers and sellers off the scan endpoints. Couriers are identified
// by delivery assignment, the only courier identity the user model carries.
func (h *Handler) RequireCourier(c *gin.Context) {
	u, ok := user(c)
	if !ok {
		c.AbortWithStatusJSON(401, gin.H{"error": gin.H{"code": "UNAUTHORIZED", "message": "Authentication required"}})
		return
	}
	if !h.svc.IsCourier(u) {
		c.AbortWithStatusJSON(403, gin.H{"error": gin.H{"code": "NOT_A_COURIER", "message": "Courier access required"}})
		return
	}
	c.Next()
}
func (h *Handler) png(c *gin.Context, token, name string) {
	b, e := qrcode.Encode(token, qrcode.Medium, 512)
	if e != nil {
		fail(c, e)
		return
	}
	if name != "" {
		c.Header("Content-Disposition", `attachment; filename="`+name+`"`)
	}
	c.Data(200, "image/png", b)
}
