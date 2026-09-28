package middleware

import (
	"math"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimitPerClient is an in-memory token bucket keyed by client IP. It is
// meant for cheap public endpoints such as search, where one process-local
// limit per API replica is enough to stop a client hammering the database.
// It needs no Redis, so it keeps working when Redis is down. The IP is only
// held in memory for the bucket's lifetime, never stored.
func RateLimitPerClient(ratePerSecond float64, burst int) gin.HandlerFunc {
	type bucket struct {
		tokens float64
		last   time.Time
	}
	var mu sync.Mutex
	buckets := map[string]*bucket{}
	lastSweep := time.Now()

	return func(c *gin.Context) {
		now := time.Now()
		key := c.ClientIP()

		mu.Lock()
		if now.Sub(lastSweep) > time.Minute {
			for k, b := range buckets {
				if now.Sub(b.last) > 5*time.Minute {
					delete(buckets, k)
				}
			}
			lastSweep = now
		}
		b, ok := buckets[key]
		if !ok {
			b = &bucket{tokens: float64(burst), last: now}
			buckets[key] = b
		}
		b.tokens = math.Min(float64(burst), b.tokens+now.Sub(b.last).Seconds()*ratePerSecond)
		b.last = now
		allowed := b.tokens >= 1
		if allowed {
			b.tokens--
		}
		wait := (1 - b.tokens) / ratePerSecond
		mu.Unlock()

		if !allowed {
			c.Header("Retry-After", strconv.Itoa(int(math.Ceil(wait))))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": gin.H{
				"code": "RATE_LIMITED", "message": "Too many searches, please slow down.",
			}})
			return
		}
		c.Next()
	}
}
