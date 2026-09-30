package service

import (
	"errors"
	"testing"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

type fakeLocationStore struct {
	active, accepted bool
	recorded         int
	row              *models.LiveLocationRow
	pointsCutoff     time.Time
}

func (f *fakeLocationStore) RecordCourierLocation(_, _ uuid.UUID, _ *models.LocationPoint) (bool, bool, error) {
	f.recorded++
	return f.active, f.accepted, nil
}
func (f *fakeLocationStore) GetLiveLocation(uuid.UUID) (*models.LiveLocationRow, error) {
	return f.row, nil
}
func (f *fakeLocationStore) DeleteLocationPointsBefore(cutoff time.Time) (int64, error) {
	f.pointsCutoff = cutoff
	return 3, nil
}
func (f *fakeLocationStore) DeleteInactiveLiveLocations() (int64, error) { return 1, nil }

func point(now time.Time) *models.ReportLocationRequest {
	lat, lng, acc := -4.32, 15.31, 10.0
	return &models.ReportLocationRequest{Latitude: &lat, Longitude: &lng, Accuracy: &acc, CapturedAt: now}
}

func TestReportLocationOutcomes(t *testing.T) {
	now := time.Now()
	courier, order := uuid.New(), uuid.New()

	store := &fakeLocationStore{active: true, accepted: true}
	svc := NewCourierLocationService(store)
	if res, err := svc.ReportLocation(courier, order, point(now)); err != nil || !res.Accepted {
		t.Fatalf("assigned courier in transit: %+v %v", res, err)
	}

	store.active, store.accepted = false, false
	if _, err := svc.ReportLocation(courier, order, point(now)); !errors.Is(err, ErrTrackingNotActive) {
		t.Fatalf("guard failed: want TRACKING_NOT_ACTIVE, got %v", err)
	}

	store.active, store.accepted = true, false
	if res, err := svc.ReportLocation(courier, order, point(now)); err != nil || res.Accepted {
		t.Fatalf("an older or too-close point is ignored without error: %+v %v", res, err)
	}

	// A refused point never reaches the database.
	store.recorded = 0
	bad := point(now)
	bad.Accuracy = new(float64)
	*bad.Accuracy = 500
	var invalid *ErrInvalidLocation
	if _, err := svc.ReportLocation(courier, order, bad); !errors.As(err, &invalid) || store.recorded != 0 {
		t.Fatalf("bad accuracy: err=%v recorded=%d", err, store.recorded)
	}
}

func TestCourierLocationReadAccess(t *testing.T) {
	owner, other := uuid.New(), uuid.New()
	store := &fakeLocationStore{row: &models.LiveLocationRow{OrderID: uuid.New(), BuyerProfileID: &owner, DeliveryStatus: "IN_TRANSIT"}}
	svc := NewCourierLocationService(store)

	if _, err := svc.GetForBuyer(owner, store.row.OrderID); err != nil {
		t.Fatalf("owner refused: %v", err)
	}
	if _, err := svc.GetForBuyer(other, store.row.OrderID); !errors.Is(err, ErrLocationForbidden) {
		t.Fatalf("other buyer: want FORBIDDEN, got %v", err)
	}
	if _, err := svc.GetForAdmin(store.row.OrderID); err != nil {
		t.Fatalf("admin refused: %v", err)
	}
	store.row = nil
	if _, err := svc.GetForBuyer(owner, uuid.New()); !errors.Is(err, ErrLocationOrderNotFound) {
		t.Fatalf("missing order: %v", err)
	}
}

func TestLocationRetentionIsThirtyDays(t *testing.T) {
	now := time.Date(2026, 9, 30, 0, 0, 0, 0, time.UTC)
	store := &fakeLocationStore{}
	svc := NewCourierLocationService(store)
	svc.now = func() time.Time { return now }
	res, err := svc.RunRetention()
	if err != nil {
		t.Fatal(err)
	}
	if want := now.AddDate(0, 0, -30); !store.pointsCutoff.Equal(want) {
		t.Fatalf("cutoff %v, want %v", store.pointsCutoff, want)
	}
	if res.PointsDeleted != 3 || res.LiveLocationsDeleted != 1 {
		t.Fatalf("result %+v", res)
	}
}
