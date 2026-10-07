package service

import (
	"testing"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

// Before the background build has run, Current must answer straight away with
// empty spotlights and a short retry, and must not try to rebuild the pools
// itself: that took longer than the apps wait, so the home screen showed
// "Picks unavailable right now" after every deployment.
func TestCurrentBeforeFirstBuildAnswersEmptyAndRetriesSoon(t *testing.T) {
	// No repo on purpose: rebuilding from here would dereference a nil repo.
	s := &SpotlightService{}
	now := time.Date(2026, 10, 7, 8, 0, 3, 0, time.UTC)

	start := time.Now()
	got := s.Current(now)
	if elapsed := time.Since(start); elapsed > 100*time.Millisecond {
		t.Fatalf("Current took %s before the first build; it must return at once", elapsed)
	}

	if got.New != nil || got.Offer != nil || got.Best != nil {
		t.Errorf("want every slot empty before the first build, got new=%v offer=%v best=%v", got.New, got.Offer, got.Best)
	}
	if got.RotateSeconds != SpotlightRotateSeconds {
		t.Errorf("RotateSeconds = %d, want %d", got.RotateSeconds, SpotlightRotateSeconds)
	}
	if want := now.Add(5 * time.Second).UTC(); !got.NextRotationAt.Equal(want) {
		t.Errorf("NextRotationAt = %s, want %s (a short retry)", got.NextRotationAt, want)
	}
}

// Once the pools are built the three slots show three different products.
func TestCurrentAfterBuildGivesThreeDifferentProducts(t *testing.T) {
	product := func(name string) *models.PublicProductResponse {
		return &models.PublicProductResponse{ID: uuid.New(), Name: name}
	}
	newA, newB := product("new A"), product("new B")
	offer := product("offer")
	best := product("best")

	s := &SpotlightService{
		built:  time.Date(2026, 10, 7, 7, 59, 0, 0, time.UTC),
		newest: []*models.PublicProductResponse{newA, newB},
		offers: []*models.PublicProductResponse{offer},
		best:   []*models.PublicProductResponse{best},
	}
	now := time.Date(2026, 10, 7, 8, 0, 3, 0, time.UTC)

	got := s.Current(now)
	if got.New == nil || got.Offer == nil || got.Best == nil {
		t.Fatalf("want all three slots filled, got new=%v offer=%v best=%v", got.New, got.Offer, got.Best)
	}
	ids := map[uuid.UUID]string{got.New.ID: "new", got.Offer.ID: "offer", got.Best.ID: "best"}
	if len(ids) != 3 {
		t.Errorf("the three slots must show three different products, got %v/%v/%v", got.New.Name, got.Offer.Name, got.Best.Name)
	}
	if got.NextRotationAt.Before(now) {
		t.Errorf("NextRotationAt = %s is in the past (now %s)", got.NextRotationAt, now)
	}
}

// A pool the build left empty stays empty rather than borrowing from another.
func TestCurrentKeepsEmptyPoolEmpty(t *testing.T) {
	only := &models.PublicProductResponse{ID: uuid.New(), Name: "the only listing"}
	s := &SpotlightService{
		built:  time.Date(2026, 10, 7, 7, 59, 0, 0, time.UTC),
		newest: []*models.PublicProductResponse{only},
	}

	got := s.Current(time.Date(2026, 10, 7, 8, 0, 3, 0, time.UTC))
	if got.Offer != nil || got.Best != nil {
		t.Errorf("empty pools must stay empty, got offer=%v best=%v", got.Offer, got.Best)
	}
	if got.New == nil || got.New.ID != only.ID {
		t.Errorf("want the one listing in the new slot, got %v", got.New)
	}
}
