package middleware

import (
	"database/sql"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
)

// maintenanceSnapshot is the platform_maintenance row as the middleware needs it.
type maintenanceSnapshot struct {
	status   string
	message  string
	startsAt sql.NullTime
	endsAt   sql.NullTime
	clients  []string
}

func (m maintenanceSnapshot) activeAt(now time.Time) bool {
	if m.status == "" || m.status == "OFF" {
		return false
	}
	if m.startsAt.Valid && now.Before(m.startsAt.Time) {
		return false
	}
	if m.endsAt.Valid && !now.Before(m.endsAt.Time) {
		return false
	}
	return true
}

// appliesTo reports whether a client identified by the X-Client-Platform /
// X-Client-App headers is covered. No list, or an unidentified client, means
// everyone is covered.
func (m maintenanceSnapshot) appliesTo(c *gin.Context) bool {
	if len(m.clients) == 0 {
		return true
	}
	ids := []string{strings.ToUpper(c.GetHeader("X-Client-Platform")), strings.ToUpper(c.GetHeader("X-Client-App"))}
	if ids[0] == "" && ids[1] == "" {
		return true
	}
	for _, want := range m.clients {
		for _, have := range ids {
			if have != "" && strings.EqualFold(want, have) {
				return true
			}
		}
	}
	return false
}

// Paths that keep working during maintenance: the Control Center itself (so
// it can end the maintenance), the public state the apps poll to show the
// banner, sign-in, health checks, and payment provider callbacks.
var maintenanceExempt = []string{
	"/health",
	"/api/v1/admin/",
	"/api/v1/config/",
	"/api/v1/auth/login",
	"/api/v1/auth/refresh",
	"/api/v1/auth/logout",
	"/api/v1/webhooks/",
	"/uploads/",
}

// Maintenance enforces the mode set on the Advanced Management screen:
// PARTIAL keeps the platform readable but refuses every write, FULL refuses
// every request. The state is re-read at most every 5 seconds.
func Maintenance(db *sql.DB) gin.HandlerFunc {
	var mu sync.Mutex
	var cached maintenanceSnapshot
	var loadedAt time.Time

	load := func() maintenanceSnapshot {
		mu.Lock()
		defer mu.Unlock()
		if time.Since(loadedAt) < 5*time.Second {
			return cached
		}
		var snap maintenanceSnapshot
		var clients pq.StringArray
		err := db.QueryRow(`SELECT status, COALESCE(message, ''), starts_at, ends_at, affected_clients FROM platform_maintenance WHERE id = TRUE`).
			Scan(&snap.status, &snap.message, &snap.startsAt, &snap.endsAt, &clients)
		if err == nil {
			snap.clients = []string(clients)
			cached = snap
		}
		loadedAt = time.Now()
		return cached
	}

	return func(c *gin.Context) {
		path := c.Request.URL.Path
		for _, p := range maintenanceExempt {
			if strings.HasPrefix(path, p) {
				c.Next()
				return
			}
		}
		m := load()
		if !m.activeAt(time.Now()) || !m.appliesTo(c) {
			c.Next()
			return
		}
		write := c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead && c.Request.Method != http.MethodOptions
		if m.status == "FULL" || (m.status == "PARTIAL" && write) {
			msg := m.message
			if msg == "" {
				msg = "The platform is under maintenance. Please try again shortly."
			}
			c.Header("Retry-After", "300")
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"error":       gin.H{"code": "MAINTENANCE_" + m.status, "message": msg},
				"maintenance": gin.H{"status": m.status, "message": msg},
			})
			return
		}
		c.Next()
	}
}
