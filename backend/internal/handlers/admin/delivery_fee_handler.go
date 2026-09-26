package admin

import (
	"net/http"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// DeliveryFeeHandler exposes the Finance-owned TBK delivery tariff.
type DeliveryFeeHandler struct {
	svc *service.DeliveryFeeService
}

func NewDeliveryFeeHandler(svc *service.DeliveryFeeService) *DeliveryFeeHandler {
	return &DeliveryFeeHandler{svc: svc}
}

func deliveryFeeFail(c *gin.Context, err error) {
	msg := err.Error()
	status := http.StatusBadRequest
	switch {
	case strings.HasPrefix(msg, "not found"):
		status = http.StatusNotFound
	case strings.Contains(msg, "sql") || strings.Contains(msg, "pq:"):
		status = http.StatusInternalServerError
	}
	c.JSON(status, gin.H{"error": gin.H{"code": "DELIVERY_FEE_ERROR", "message": msg}})
}

func deliveryFeeActor(c *gin.Context) (uuid.UUID, models.AdminRole) {
	id, _ := c.MustGet("admin_id").(uuid.UUID)
	role, _ := c.MustGet("admin_role").(models.AdminRole)
	return id, role
}

// GET /api/v1/admin/finance/delivery-fees
func (h *DeliveryFeeHandler) Get(c *gin.Context) {
	cfg, err := h.svc.Config(c.Request.Context(), true)
	if err != nil {
		deliveryFeeFail(c, err)
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Delivery fees retrieved", Data: cfg})
}

// PATCH /api/v1/admin/finance/delivery-fees
func (h *DeliveryFeeHandler) UpdateSettings(c *gin.Context) {
	var req struct {
		DefaultFee            *float64 `json:"default_fee"`
		FreeDeliveryThreshold *float64 `json:"free_delivery_threshold"`
		ClearThreshold        bool     `json:"clear_threshold"`
		Reason                string   `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		deliveryFeeFail(c, err)
		return
	}
	id, role := deliveryFeeActor(c)
	if err := h.svc.UpdateSettings(c.Request.Context(), id, role, req.DefaultFee, req.FreeDeliveryThreshold, req.ClearThreshold, req.Reason); err != nil {
		deliveryFeeFail(c, err)
		return
	}
	h.Get(c)
}

// PUT /api/v1/admin/finance/delivery-fees/zones/:city_id
func (h *DeliveryFeeHandler) UpsertZone(c *gin.Context) {
	cityID, err := uuid.Parse(c.Param("city_id"))
	if err != nil {
		deliveryFeeFail(c, err)
		return
	}
	var req struct {
		Fee    *float64 `json:"fee"`
		Active *bool    `json:"active"`
		Reason string   `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Fee == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"code": "DELIVERY_FEE_ERROR", "message": "fee is required"}})
		return
	}
	active := true
	if req.Active != nil {
		active = *req.Active
	}
	id, role := deliveryFeeActor(c)
	if err := h.svc.UpsertZone(c.Request.Context(), id, role, cityID, *req.Fee, active, req.Reason); err != nil {
		deliveryFeeFail(c, err)
		return
	}
	h.Get(c)
}

// DELETE /api/v1/admin/finance/delivery-fees/zones/:city_id
func (h *DeliveryFeeHandler) DeleteZone(c *gin.Context) {
	cityID, err := uuid.Parse(c.Param("city_id"))
	if err != nil {
		deliveryFeeFail(c, err)
		return
	}
	var req struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)
	id, role := deliveryFeeActor(c)
	if err := h.svc.DeleteZone(c.Request.Context(), id, role, cityID, req.Reason); err != nil {
		deliveryFeeFail(c, err)
		return
	}
	h.Get(c)
}

// GET /api/v1/admin/finance/delivery-fees/ledger?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
func (h *DeliveryFeeHandler) Ledger(c *gin.Context) {
	from, to, err := parseDayRange(c.Query("date_from"), c.Query("date_to"))
	if err != nil {
		deliveryFeeFail(c, err)
		return
	}
	l, err := h.svc.Ledger(c.Request.Context(), from, to)
	if err != nil {
		deliveryFeeFail(c, err)
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Delivery fee ledger", Data: l})
}

// GET /api/v1/config/delivery-fees — the public tariff, for checkout and the
// seller workspace. History and admin names are not exposed.
func (h *DeliveryFeeHandler) Public(c *gin.Context) {
	cfg, err := h.svc.Config(c.Request.Context(), false)
	if err != nil {
		deliveryFeeFail(c, err)
		return
	}
	zones := make([]service.DeliveryFeeZone, 0, len(cfg.Zones))
	for _, z := range cfg.Zones {
		if z.Active {
			zones = append(zones, z)
		}
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Delivery fees", Data: gin.H{
		"default_fee": cfg.DefaultFee, "currency": cfg.Currency,
		"free_delivery_threshold": cfg.FreeDeliveryThreshold, "zones": zones, "updated_at": cfg.UpdatedAt,
	}})
}

// parseDayRange reads inclusive calendar days; `to` becomes the next midnight.
func parseDayRange(fromRaw, toRaw string) (*time.Time, *time.Time, error) {
	var from, to *time.Time
	if fromRaw != "" {
		d, err := time.Parse("2006-01-02", fromRaw)
		if err != nil {
			return nil, nil, err
		}
		from = &d
	}
	if toRaw != "" {
		d, err := time.Parse("2006-01-02", toRaw)
		if err != nil {
			return nil, nil, err
		}
		next := d.AddDate(0, 0, 1)
		to = &next
	}
	return from, to, nil
}
