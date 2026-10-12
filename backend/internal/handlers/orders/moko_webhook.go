package orders

import (
	"errors"
	"io"
	"net/http"

	"github.com/btmi-ai-market/backend/internal/service"
	"github.com/gin-gonic/gin"
)

// HandleMokoCallback receives Moko Afrika's transaction callbacks. Like the
// generic payment webhook it is unauthenticated by design: X-Signature over the
// body is the credential. The status codes are the ones Moko expects: 200
// received, 401 bad signature, 400 undecryptable payload.
func (h *Handler) HandleMokoCallback(c *gin.Context) {
	rawBody, err := io.ReadAll(io.LimitReader(c.Request.Body, 1<<20))
	if err != nil {
		h.errResponse(c, http.StatusBadRequest, "INVALID_WEBHOOK_PAYLOAD", "Could not read request body")
		return
	}
	err = h.paymentService.HandleMokoCallback(rawBody, c.GetHeader("X-Signature"))
	switch {
	case err == nil:
		c.JSON(http.StatusOK, gin.H{"status": "Callback received successfully"})
	case errors.Is(err, service.ErrMokoSignature):
		h.errResponse(c, http.StatusUnauthorized, "INVALID_SIGNATURE", "Invalid signature")
	case errors.Is(err, service.ErrMokoPayload):
		h.errResponse(c, http.StatusBadRequest, "INVALID_ENCRYPTION", "Invalid encrypted payload")
	default:
		// A verified callback we could not apply: 500 makes Moko retry.
		h.errResponse(c, http.StatusInternalServerError, "CALLBACK_NOT_APPLIED", err.Error())
	}
}
