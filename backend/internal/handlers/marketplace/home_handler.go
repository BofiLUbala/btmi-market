package marketplace

import (
	"net/http"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
)

type HomeHandler struct {
	homeService *service.HomeFeedService
}

func NewHomeHandler(homeService *service.HomeFeedService) *HomeHandler {
	return &HomeHandler{
		homeService: homeService,
	}
}

// GET /api/v1/marketplace/home-feed
// Returns a curated homepage feed with 4 sections:
// - recommended (16 products by relevance/seller_level)
// - popular (8 products by rating)
// - newest (8 products from last 30 days)
// - promoted (8 discounted products)
//
// Optimized: Single query, no COUNT, primary images only, cached 5 minutes.
func (h *HomeHandler) GetHomeFeed(c *gin.Context) {
	feed, err := h.homeService.GetHomeFeed(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{
				Code:    "HOME_FEED_UNAVAILABLE",
				Message: "Homepage feed is temporarily unavailable.",
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "Homepage feed retrieved successfully",
		Data:    feed,
	})
}
