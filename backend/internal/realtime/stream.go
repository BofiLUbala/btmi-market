package realtime

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// UserStream serves the orders a signed-in user buys, sells or delivers.
func (h *Hub) UserStream(c *gin.Context) {
	raw, _ := c.Get("user_id")
	userID, ok := raw.(uuid.UUID)
	if !ok {
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}
	h.serve(c, &Subscriber{UserID: userID, BusinessIDs: h.BusinessIDsForUser(userID), C: make(chan Event, 64)})
}

// AdminStream serves every order; the route restricts it to order-handling roles.
func (h *Hub) AdminStream(c *gin.Context) {
	h.serve(c, &Subscriber{Admin: true, C: make(chan Event, 64)})
}

func (h *Hub) serve(c *gin.Context, s *Subscriber) {
	w := c.Writer
	header := w.Header()
	header.Set("Content-Type", "text/event-stream")
	header.Set("Cache-Control", "no-cache, no-transform")
	header.Set("Connection", "keep-alive")
	// Nginx buffers proxied responses unless told otherwise.
	header.Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	h.Subscribe(s)
	defer h.Unsubscribe(s)

	fmt.Fprint(w, "retry: 3000\nevent: ready\ndata: {}\n\n")
	w.Flush()

	// Proxies and mobile networks drop idle connections; a comment line every
	// 20 seconds keeps the stream open without waking the client.
	heartbeat := time.NewTicker(20 * time.Second)
	defer heartbeat.Stop()
	for {
		select {
		case <-c.Request.Context().Done():
			return
		case <-heartbeat.C:
			if _, err := fmt.Fprint(w, ": ping\n\n"); err != nil {
				return
			}
			w.Flush()
		case ev := <-s.C:
			payload, _ := json.Marshal(ev)
			if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Kind, payload); err != nil {
				return
			}
			w.Flush()
		}
	}
}
