package auth

import (
	"testing"
	"time"
)

func TestRegistrationReinitializationRateLimit(t *testing.T) {
	h := &Handler{reinitializeHits: make(map[string][]time.Time)}
	now := time.Now()
	for i := 0; i < reinitializeLimit; i++ {
		if !h.allowRegistrationReinitialization("ip|user@example.com", now) {
			t.Fatalf("attempt %d should be allowed", i+1)
		}
	}
	if h.allowRegistrationReinitialization("ip|user@example.com", now) {
		t.Fatal("attempt above limit should be rejected")
	}
	if !h.allowRegistrationReinitialization("ip|user@example.com", now.Add(reinitializeWindow+time.Second)) {
		t.Fatal("attempt after the window should be allowed")
	}
}
