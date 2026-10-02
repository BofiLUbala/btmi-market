package admin

import (
	"log"
	"net/http"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// SetPurgeService enables bulk permanent deletion of shops.
func (h *CommerceHandler) SetPurgeService(purge *service.ShopPurgeService) {
	h.purgeService = purge
}

func adminPurgeFailure(c *gin.Context, err error) {
	status, code, message := service.ShopPurgeError(err)
	if status == http.StatusInternalServerError {
		log.Printf("admin shop purge failed: %v", err)
	}
	c.JSON(status, models.ErrorResponse{
		Error: struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}{Code: code, Message: message},
	})
}

func adminPurgeActor(c *gin.Context) service.ShopPurgeActor {
	adminID, _ := c.MustGet("admin_id").(uuid.UUID)
	adminRole, _ := c.MustGet("admin_role").(models.AdminRole)
	return service.ShopPurgeActor{AdminID: &adminID, AdminRole: adminRole, IP: c.ClientIP(), UserAgent: c.Request.UserAgent()}
}

// POST /api/v1/admin/commerce/shops/purge/preview  body: {"shop_ids": [...]}
func (h *CommerceHandler) PreviewShopPurge(c *gin.Context) {
	var req models.ShopPurgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		adminPurgeFailure(c, errNoShops)
		return
	}
	preview, err := h.purgeService.Preview(req.ShopIDs, adminPurgeActor(c))
	if err != nil {
		adminPurgeFailure(c, err)
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Purge preview", Data: preview})
}

// POST /api/v1/admin/commerce/shops/purge  body: {"shop_ids": [...], "confirmation": "SUPPRIMER", "reason": "..."}
func (h *CommerceHandler) PurgeShops(c *gin.Context) {
	var req models.ShopPurgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		adminPurgeFailure(c, errNoShops)
		return
	}
	result, err := h.purgeService.Purge(&req, adminPurgeActor(c))
	if err != nil {
		adminPurgeFailure(c, err)
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Shops permanently deleted", Data: result})
}

var errNoShops = errorString("NO_SHOPS_SELECTED")

type errorString string

func (e errorString) Error() string { return string(e) }
