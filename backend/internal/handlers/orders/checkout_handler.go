package orders

import (
	"net/http"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
)

// SetCheckoutService wires the multi-shop cart. It is set separately from the
// constructor because the checkout service is built on top of the order service
// this handler already holds.
func (h *Handler) SetCheckoutService(checkoutService *service.CheckoutService) {
	h.checkoutService = checkoutService
}

// POST /api/v1/buyer/cart/preview
//
// Prices the whole cart across every shop in it and reports each problem against
// the line that caused it. A cart with a bad line is still a 200: the buyer needs
// to see the good lines and the named problem together, not an error page.
func (h *Handler) PreviewCart(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}
	if h.checkoutService == nil {
		h.errResponse(c, http.StatusServiceUnavailable, "CHECKOUT_UNAVAILABLE", "Checkout is not available.")
		return
	}

	var req models.CartPreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	preview, err := h.checkoutService.PreviewCart(buyerProfileID, &req)
	if err != nil {
		status := http.StatusInternalServerError
		if err.Error() == "CART_EMPTY" {
			status = http.StatusBadRequest
		}
		h.errResponse(c, status, err.Error(), err.Error())
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Cart priced successfully", Data: preview})
}

// POST /api/v1/buyer/checkout
//
// Turns the cart into one order per shop, tied together by a checkout group.
func (h *Handler) CreateCheckout(c *gin.Context) {
	buyerProfileID, ok := h.extractBuyerProfileID(c)
	if !ok {
		return
	}
	if h.checkoutService == nil {
		h.errResponse(c, http.StatusServiceUnavailable, "CHECKOUT_UNAVAILABLE", "Checkout is not available.")
		return
	}

	var req models.CheckoutCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	result, err := h.checkoutService.CreateCheckout(buyerProfileID, &req)
	if err != nil {
		status := http.StatusInternalServerError
		switch err.Error() {
		case "CART_EMPTY", "INVALID_LINE", "VARIANT_NOT_PRODUCT", "SHOP_NOT_ACTIVE", "BUYER_PROFILE_INCOMPLETE":
			status = http.StatusBadRequest
		case "SHOP_NOT_FOUND", "PRODUCT_NOT_FOUND", "VARIANT_NOT_FOUND", "INVENTORY_NOT_FOUND", "BUYER_PROFILE_NOT_FOUND":
			status = http.StatusNotFound
		case "INSUFFICIENT_STOCK", "OUT_OF_STOCK", "DUPLICATE_ORDER":
			status = http.StatusConflict
		}
		h.errResponse(c, status, err.Error(), err.Error())
		return
	}

	c.JSON(http.StatusCreated, models.SuccessResponse{Message: "Checkout created successfully", Data: result})
}
