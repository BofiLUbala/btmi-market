package shops

import (
	"log"
	"net/http"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// SetPurgeService enables permanent deletion of archived shops.
func (h *Handler) SetPurgeService(purge *service.ShopPurgeService) {
	h.purgeService = purge
}

func purgeFailure(c *gin.Context, err error) {
	status, code, message := service.ShopPurgeError(err)
	if status == http.StatusInternalServerError {
		log.Printf("shop purge failed: %v", err)
	}
	c.JSON(status, models.ErrorResponse{
		Error: struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}{Code: code, Message: message},
	})
}

func (h *Handler) purgeTarget(c *gin.Context) (uuid.UUID, service.ShopPurgeActor, bool) {
	userID, ok := c.Get("user_id")
	if !ok {
		purgeFailure(c, errForbidden)
		return uuid.Nil, service.ShopPurgeActor{}, false
	}
	shopID, err := uuid.Parse(c.Param("shop_id"))
	if err != nil {
		purgeFailure(c, errShopNotFound)
		return uuid.Nil, service.ShopPurgeActor{}, false
	}
	uid := userID.(uuid.UUID)
	return shopID, service.ShopPurgeActor{UserID: &uid, IP: c.ClientIP(), UserAgent: c.Request.UserAgent()}, true
}

// GET /api/v1/shops/:shop_id/purge-preview
func (h *Handler) PurgePreview(c *gin.Context) {
	shopID, actor, ok := h.purgeTarget(c)
	if !ok {
		return
	}
	preview, err := h.purgeService.Preview([]uuid.UUID{shopID}, actor)
	if err != nil {
		purgeFailure(c, err)
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Purge preview", Data: preview})
}

// DELETE /api/v1/shops/:shop_id/permanent  body: {"confirmation": "SUPPRIMER"}
func (h *Handler) PurgeShop(c *gin.Context) {
	shopID, actor, ok := h.purgeTarget(c)
	if !ok {
		return
	}
	var body struct {
		Confirmation string `json:"confirmation"`
	}
	_ = c.ShouldBindJSON(&body)
	result, err := h.purgeService.Purge(&models.ShopPurgeRequest{ShopIDs: []uuid.UUID{shopID}, Confirmation: body.Confirmation}, actor)
	if err != nil {
		purgeFailure(c, err)
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Shop permanently deleted", Data: result})
}
