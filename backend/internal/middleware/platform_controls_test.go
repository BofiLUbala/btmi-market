package middleware

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

type fakeFlags map[string]bool

func (f fakeFlags) IsEnabled(_ context.Context, key string) (bool, bool, error) {
	v, ok := f[key]
	return v, ok, nil
}

func runFlag(t *testing.T, h gin.HandlerFunc, method, body string) int {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Handle(method, "/x", h, func(c *gin.Context) { c.Status(http.StatusOK) })
	w := httptest.NewRecorder()
	req := httptest.NewRequest(method, "/x", strings.NewReader(body))
	r.ServeHTTP(w, req)
	return w.Code
}

func TestRequireFeature(t *testing.T) {
	if got := runFlag(t, RequireFeature(fakeFlags{"A": false}, "off", "A"), http.MethodPost, ""); got != http.StatusServiceUnavailable {
		t.Fatalf("disabled flag: got %d", got)
	}
	if got := runFlag(t, RequireFeature(fakeFlags{"A": true}, "off", "A"), http.MethodPost, ""); got != http.StatusOK {
		t.Fatalf("enabled flag: got %d", got)
	}
	// A flag missing from the table never takes a feature down.
	if got := runFlag(t, RequireFeature(fakeFlags{}, "off", "A"), http.MethodPost, ""); got != http.StatusOK {
		t.Fatalf("missing flag: got %d", got)
	}
}

func TestRejectBodyFlagWhenDisabled(t *testing.T) {
	h := RejectBodyFlagWhenDisabled(fakeFlags{"POINTS": false}, "POINTS", "off", "use_points")
	cases := map[string]int{
		`{"use_points":true}`:                     http.StatusServiceUnavailable,
		`{"use_points":false}`:                    http.StatusOK,
		`{"groups":[{"use_points":true}]}`:        http.StatusServiceUnavailable,
		`{"shop":{"nested":{"use_points":true}}}`: http.StatusServiceUnavailable, // nesting is searched recursively
		`not json`: http.StatusOK,
	}
	for body, want := range cases {
		if got := runFlag(t, h, http.MethodPost, body); got != want {
			t.Errorf("%s: got %d want %d", body, got, want)
		}
	}
	on := RejectBodyFlagWhenDisabled(fakeFlags{"POINTS": true}, "POINTS", "off", "use_points")
	if got := runFlag(t, on, http.MethodPost, `{"use_points":true}`); got != http.StatusOK {
		t.Fatalf("enabled flag must pass: got %d", got)
	}
}

func TestMaintenanceWindowAndClients(t *testing.T) {
	now := time.Now()
	past := sql.NullTime{Time: now.Add(-time.Hour), Valid: true}
	future := sql.NullTime{Time: now.Add(time.Hour), Valid: true}

	if (maintenanceSnapshot{status: "OFF"}).activeAt(now) {
		t.Fatal("OFF must be inactive")
	}
	if !(maintenanceSnapshot{status: "PARTIAL"}).activeAt(now) {
		t.Fatal("PARTIAL without window must be active")
	}
	if (maintenanceSnapshot{status: "FULL", startsAt: future}).activeAt(now) {
		t.Fatal("not started yet")
	}
	if (maintenanceSnapshot{status: "FULL", endsAt: past}).activeAt(now) {
		t.Fatal("already ended")
	}

	gin.SetMode(gin.TestMode)
	ctx := func(platform string) *gin.Context {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
		if platform != "" {
			c.Request.Header.Set("X-Client-Platform", platform)
		}
		return c
	}
	m := maintenanceSnapshot{status: "FULL", clients: []string{"ANDROID"}}
	if !m.appliesTo(ctx("android")) {
		t.Fatal("listed client must be covered")
	}
	if m.appliesTo(ctx("WEB")) {
		t.Fatal("unlisted client must not be covered")
	}
	if !m.appliesTo(ctx("")) {
		t.Fatal("unidentified client must be covered")
	}
}
