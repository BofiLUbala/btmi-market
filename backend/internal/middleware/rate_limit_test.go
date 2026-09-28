package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRateLimitPerClient(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/search", RateLimitPerClient(0.001, 3), func(c *gin.Context) { c.Status(http.StatusOK) })

	call := func(ip string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/search", nil)
		req.RemoteAddr = ip + ":1234"
		r.ServeHTTP(w, req)
		return w
	}
	for i := 0; i < 3; i++ {
		if w := call("10.0.0.1"); w.Code != http.StatusOK {
			t.Fatalf("request %d within burst got %d", i, w.Code)
		}
	}
	w := call("10.0.0.1")
	if w.Code != http.StatusTooManyRequests || w.Header().Get("Retry-After") == "" {
		t.Fatalf("expected 429 with Retry-After, got %d", w.Code)
	}
	if w := call("10.0.0.2"); w.Code != http.StatusOK {
		t.Fatalf("another client must not be throttled, got %d", w.Code)
	}
}
