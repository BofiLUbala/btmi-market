package auth

import (
	"net/http"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/gin-gonic/gin"
)

const (
	// Firebase sends the SMS, so these caps do not protect a message budget —
	// they bound how often a client may trade tokens for sessions or reset
	// tokens here.
	firebaseVerifyLimit  = 20
	firebaseVerifyWindow = 15 * time.Minute
)

// FirebaseTokenRequest carries the ID token Firebase issues on the device once
// the SMS code has been entered. The names are used only when the number turns
// out to be new and an account has to be created for it.
type FirebaseTokenRequest struct {
	IDToken   string `json:"id_token" binding:"required"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

func firebaseErrorStatus(code string) int {
	switch code {
	case "FIREBASE_TOKEN_INVALID", "FIREBASE_PHONE_MISSING":
		return http.StatusUnauthorized
	case "ACCOUNT_SUSPENDED":
		return http.StatusForbidden
	case "INVALID_PHONE":
		return http.StatusBadRequest
	case "SMS_UNAVAILABLE":
		return http.StatusServiceUnavailable
	}
	return http.StatusInternalServerError
}

func firebaseErrorCode(err error) string {
	code := err.Error()
	if firebaseErrorStatus(code) == http.StatusInternalServerError {
		return "INTERNAL_ERROR"
	}
	return code
}

// SMSStatus lets the sign-in, sign-up and password forms offer the SMS choice
// only when a Firebase project is configured.
func (h *Handler) SMSStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"enabled": h.authService.FirebaseAvailable()})
}

// SignInWithSMS opens a session from a number Firebase has just verified.
// Sign-in and sign-up are the same request: a number nobody holds gets an
// account, so the reply says nothing about whether one already existed.
func (h *Handler) SignInWithSMS(c *gin.Context) {
	var req FirebaseTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.authError(c, http.StatusBadRequest, "INVALID_REQUEST", "A Firebase ID token is required")
		return
	}
	if !h.allowWhatsApp("firebase-verify|"+c.ClientIP(), firebaseVerifyLimit, firebaseVerifyWindow) {
		h.tooManyRequests(c)
		return
	}

	session, err := h.authService.SignInWithFirebasePhone(req.IDToken, req.FirstName, req.LastName, c.Request.UserAgent(), c.ClientIP())
	if err != nil {
		code := firebaseErrorCode(err)
		if code == "FIREBASE_TOKEN_INVALID" || code == "ACCOUNT_SUSPENDED" {
			if h.loginFailures != nil {
				go h.loginFailures.RecordLoginFailure("user", "", code, c.ClientIP(), c.Request.UserAgent())
			}
		}
		h.authError(c, firebaseErrorStatus(code), code, code)
		return
	}
	c.JSON(http.StatusOK, session)
}

// ForgotPasswordSMS is "forgot my password" by phone. The SMS code has already
// proved the number, so the reply carries a short-lived reset token that the
// ordinary reset-password endpoint accepts.
//
// A number with no account gets the same 200 and an empty token, so this
// cannot be used to discover which numbers are registered.
func (h *Handler) ForgotPasswordSMS(c *gin.Context) {
	var req FirebaseTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.authError(c, http.StatusBadRequest, "INVALID_REQUEST", "A Firebase ID token is required")
		return
	}
	if !h.allowWhatsApp("firebase-reset|"+c.ClientIP(), firebaseVerifyLimit, firebaseVerifyWindow) {
		h.tooManyRequests(c)
		return
	}

	token, err := h.authService.StartFirebasePasswordReset(req.IDToken)
	if err != nil {
		code := firebaseErrorCode(err)
		h.authError(c, firebaseErrorStatus(code), code, code)
		return
	}
	c.JSON(http.StatusOK, models.SuccessResponse{
		Message: "If an account exists for this number, a reset was started.",
		Data:    gin.H{"reset_token": token},
	})
}
