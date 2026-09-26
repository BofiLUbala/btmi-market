package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

// FlagReader is the feature_flags table as the Control Center edits it.
type FlagReader interface {
	IsEnabled(ctx context.Context, key string) (enabled bool, found bool, err error)
}

func featureDisabled(c *gin.Context, message string) {
	c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
		"error": gin.H{"code": "FEATURE_DISABLED", "message": message},
	})
}

// disabled is true only when the flag exists and is switched off, so a
// missing row never takes a feature down.
func disabled(c *gin.Context, flags FlagReader, key string) bool {
	enabled, found, err := flags.IsEnabled(c.Request.Context(), key)
	return err == nil && found && !enabled
}

// RequireFeature refuses the route while any of the given flags is off.
func RequireFeature(flags FlagReader, message string, keys ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		for _, key := range keys {
			if disabled(c, flags, key) {
				featureDisabled(c, message)
				return
			}
		}
		c.Next()
	}
}

// RejectBodyFlagWhenDisabled refuses a write whose JSON body turns on one of
// `fields` (e.g. use_points, discount_active) while `key` is off. Requests that
// do not use the feature pass untouched, and the body is restored for the
// handler.
func RejectBodyFlagWhenDisabled(flags FlagReader, key, message string, fields ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodGet || c.Request.Body == nil || !disabled(c, flags, key) {
			c.Next()
			return
		}
		raw, err := io.ReadAll(io.LimitReader(c.Request.Body, 8<<20))
		if err != nil {
			c.Next()
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewReader(raw))
		var body map[string]interface{}
		if json.Unmarshal(raw, &body) == nil && usesFlag(body, fields) {
			featureDisabled(c, message)
			return
		}
		c.Next()
	}
}

// usesFlag looks for a truthy field anywhere in the body (checkout bodies
// nest per-shop groups).
func usesFlag(body map[string]interface{}, fields []string) bool {
	for _, f := range fields {
		if v, ok := body[f].(bool); ok && v {
			return true
		}
	}
	for _, v := range body {
		switch nested := v.(type) {
		case map[string]interface{}:
			if usesFlag(nested, fields) {
				return true
			}
		case []interface{}:
			for _, item := range nested {
				if m, ok := item.(map[string]interface{}); ok && usesFlag(m, fields) {
					return true
				}
			}
		}
	}
	return false
}
