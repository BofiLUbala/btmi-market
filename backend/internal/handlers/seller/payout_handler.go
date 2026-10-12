package seller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// SellerPayoutHandler serves a business's mobile money payout numbers and the
// history of the payouts TBK made to it.
type SellerPayoutHandler struct {
	payouts *service.PayoutService
}

func NewSellerPayoutHandler(payouts *service.PayoutService) *SellerPayoutHandler {
	return &SellerPayoutHandler{payouts: payouts}
}

func payoutError(c *gin.Context, status int, code, message string) {
	c.JSON(status, models.ErrorResponse{
		Error: struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}{Code: code, Message: message},
	})
}

// scope reads the caller and the business from the request.
func (h *SellerPayoutHandler) scope(c *gin.Context) (uuid.UUID, uuid.UUID, bool) {
	userIDVal, _ := c.Get("user_id")
	userID, _ := userIDVal.(uuid.UUID)
	businessID, err := uuid.Parse(c.Param("business_id"))
	if err != nil {
		payoutError(c, http.StatusBadRequest, "INVALID_ID", "Invalid business id")
		return uuid.Nil, uuid.Nil, false
	}
	return userID, businessID, true
}

func (h *SellerPayoutHandler) fail(c *gin.Context, err error) {
	code := err.Error()
	switch {
	case code == "FORBIDDEN":
		payoutError(c, http.StatusForbidden, code, "Not allowed for this business")
	case strings.HasPrefix(code, "INVALID_PAYOUT_PHONE"):
		payoutError(c, http.StatusBadRequest, "INVALID_PAYOUT_PHONE", code)
	default:
		payoutError(c, http.StatusInternalServerError, "INTERNAL_ERROR", code)
	}
}

// GET /api/v1/businesses/:business_id/payout-accounts
func (h *SellerPayoutHandler) ListAccounts(c *gin.Context) {
	userID, businessID, ok := h.scope(c)
	if !ok {
		return
	}
	accounts, err := h.payouts.ListAccounts(userID, businessID)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Payout accounts", Data: accounts})
}

// PUT /api/v1/businesses/:business_id/payout-accounts
func (h *SellerPayoutHandler) SaveAccounts(c *gin.Context) {
	userID, businessID, ok := h.scope(c)
	if !ok {
		return
	}
	var req models.SavePayoutAccountsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		payoutError(c, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}
	accounts, err := h.payouts.SaveAccounts(userID, businessID, &req)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Payout accounts saved", Data: accounts})
}

// GET /api/v1/businesses/:business_id/payouts
func (h *SellerPayoutHandler) ListPayouts(c *gin.Context) {
	userID, businessID, ok := h.scope(c)
	if !ok {
		return
	}
	limit, _ := strconv.Atoi(c.Query("limit"))
	payouts, err := h.payouts.ListPayouts(userID, businessID, limit)
	if err != nil {
		h.fail(c, err)
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "Payouts", Data: payouts})
}
