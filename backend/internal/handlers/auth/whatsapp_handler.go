package auth

import (
	"net/http"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/gin-gonic/gin"
)

const (
	// Each send costs a WhatsApp message on the shared gateway number, so
	// sends are capped per client and per target phone.
	whatsappSendLimit  = 5
	whatsappSendWindow = 15 * time.Minute
	// Verification attempts are also capped per challenge in the service.
	whatsappVerifyLimit  = 20
	whatsappVerifyWindow = 15 * time.Minute
)

func registeredWithChallenge(userID string, ch *models.WhatsAppChallenge) map[string]interface{} {
	return map[string]interface{}{
		"user_id":      userID,
		"channel":      ch.Channel,
		"challenge_id": ch.ChallengeID,
		"phone_masked": ch.PhoneMasked,
		"expires_in":   ch.ExpiresIn,
	}
}

func (h *Handler) allowWhatsApp(key string, limit int, window time.Duration) bool {
	return h.allowRateLimited(&h.whatsappMu, h.whatsappHits, limit, window, key, time.Now())
}

func (h *Handler) tooManyRequests(c *gin.Context) {
	c.Header("Retry-After", "900")
	h.authError(c, http.StatusTooManyRequests, "RATE_LIMITED", "Too many attempts. Please try again later.")
}

func whatsappErrorStatus(code string) int {
	switch code {
	case "INVALID_CREDENTIALS", "OTP_INCORRECT":
		return http.StatusUnauthorized
	case "ACCOUNT_SUSPENDED":
		return http.StatusForbidden
	case "OTP_INVALID", "USER_NOT_FOUND":
		return http.StatusNotFound
	case "OTP_EXPIRED":
		return http.StatusGone
	case "OTP_ALREADY_USED":
		return http.StatusConflict
	case "OTP_TOO_MANY_ATTEMPTS", "OTP_RESEND_TOO_SOON":
		return http.StatusTooManyRequests
	case "WHATSAPP_UNAVAILABLE":
		return http.StatusServiceUnavailable
	case "WHATSAPP_DELIVERY_FAILED":
		return http.StatusBadGateway
	}
	return http.StatusInternalServerError
}

func whatsappErrorCode(err error) string {
	code := err.Error()
	if whatsappErrorStatus(code) == http.StatusInternalServerError {
		return "INTERNAL_ERROR"
	}
	return code
}

// WhatsAppStatus lets the sign-in and sign-up forms offer the WhatsApp choice
// only when a gateway is configured.
func (h *Handler) WhatsAppStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"enabled": h.authService.WhatsAppAvailable()})
}

// LoginWhatsApp checks phone + password and sends a sign-in code on WhatsApp.
func (h *Handler) LoginWhatsApp(c *gin.Context) {
	var req models.WhatsAppLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.authError(c, http.StatusBadRequest, "INVALID_REQUEST", "Phone and password are required")
		return
	}
	phone := strings.TrimSpace(req.Phone)
	if !h.allowWhatsApp("send|"+c.ClientIP(), whatsappSendLimit*2, whatsappSendWindow) ||
		!h.allowWhatsApp("send-phone|"+phone, whatsappSendLimit, whatsappSendWindow) {
		h.tooManyRequests(c)
		return
	}

	challenge, err := h.authService.LoginWithWhatsApp(phone, req.Password)
	if err != nil {
		code := whatsappErrorCode(err)
		if code == "INVALID_CREDENTIALS" || code == "ACCOUNT_SUSPENDED" {
			if h.loginFailures != nil {
				go h.loginFailures.RecordLoginFailure("user", phone, code, c.ClientIP(), c.Request.UserAgent())
			}
		}
		if code == "WHATSAPP_DELIVERY_FAILED" && challenge != nil {
			c.JSON(http.StatusBadGateway, gin.H{
				"error": gin.H{"code": code, "message": "The WhatsApp code could not be delivered. Try resending it."},
				"data":  challenge,
			})
			return
		}
		h.authError(c, whatsappErrorStatus(code), code, code)
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "A code was sent to your WhatsApp.", Data: challenge})
}

// VerifyWhatsApp completes a WhatsApp sign-up or sign-in with the code.
func (h *Handler) VerifyWhatsApp(c *gin.Context) {
	var req models.WhatsAppVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.authError(c, http.StatusBadRequest, "INVALID_REQUEST", "Challenge and code are required")
		return
	}
	if !h.allowWhatsApp("verify|"+c.ClientIP(), whatsappVerifyLimit, whatsappVerifyWindow) {
		h.tooManyRequests(c)
		return
	}
	session, err := h.authService.VerifyWhatsAppCode(req.ChallengeID, req.Code, c.Request.UserAgent(), c.ClientIP())
	if err != nil {
		code := whatsappErrorCode(err)
		h.authError(c, whatsappErrorStatus(code), code, code)
		return
	}
	c.JSON(http.StatusOK, session)
}

// ResendWhatsApp sends a new code for an open sign-up or sign-in.
func (h *Handler) ResendWhatsApp(c *gin.Context) {
	var req models.WhatsAppResendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.authError(c, http.StatusBadRequest, "INVALID_REQUEST", "Challenge is required")
		return
	}
	if !h.allowWhatsApp("send|"+c.ClientIP(), whatsappSendLimit*2, whatsappSendWindow) ||
		!h.allowWhatsApp("resend|"+req.ChallengeID, whatsappSendLimit, whatsappSendWindow) {
		h.tooManyRequests(c)
		return
	}
	challenge, err := h.authService.ResendWhatsAppCode(req.ChallengeID)
	if err != nil {
		code := whatsappErrorCode(err)
		h.authError(c, whatsappErrorStatus(code), code, code)
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{Message: "A new code was sent to your WhatsApp.", Data: challenge})
}
