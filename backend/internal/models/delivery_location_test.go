package models

import (
	"errors"
	"math"
	"testing"
	"time"

	"github.com/google/uuid"
)

func f(v float64) *float64 { return &v }

func TestReportLocationNormalize(t *testing.T) {
	now := time.Date(2026, 9, 30, 12, 0, 0, 0, time.UTC)
	ok := func() ReportLocationRequest {
		return ReportLocationRequest{Latitude: f(-4.325), Longitude: f(15.322), Accuracy: f(12), Heading: f(90), Speed: f(4.2), CapturedAt: now.Add(-5 * time.Second)}
	}
	cases := []struct {
		name string
		edit func(r *ReportLocationRequest)
		want error
	}{
		{"valid point", func(r *ReportLocationRequest) {}, nil},
		{"latitude above 90", func(r *ReportLocationRequest) { r.Latitude = f(90.0001) }, ErrLocationLatitude},
		{"latitude below -90", func(r *ReportLocationRequest) { r.Latitude = f(-91) }, ErrLocationLatitude},
		{"latitude NaN", func(r *ReportLocationRequest) { r.Latitude = f(math.NaN()) }, ErrLocationLatitude},
		{"latitude missing", func(r *ReportLocationRequest) { r.Latitude = nil }, ErrLocationLatitude},
		{"longitude above 180", func(r *ReportLocationRequest) { r.Longitude = f(180.5) }, ErrLocationLongitude},
		{"longitude below -180", func(r *ReportLocationRequest) { r.Longitude = f(-181) }, ErrLocationLongitude},
		{"accuracy worse than 150 m", func(r *ReportLocationRequest) { r.Accuracy = f(151) }, ErrLocationAccuracy},
		{"accuracy exactly 150 m", func(r *ReportLocationRequest) { r.Accuracy = f(150) }, nil},
		{"captured 2 minutes in the future", func(r *ReportLocationRequest) { r.CapturedAt = now.Add(2 * time.Minute) }, ErrLocationFuture},
		{"captured 30 s in the future (clock drift)", func(r *ReportLocationRequest) { r.CapturedAt = now.Add(30 * time.Second) }, nil},
		{"captured an hour ago", func(r *ReportLocationRequest) { r.CapturedAt = now.Add(-time.Hour) }, ErrLocationTooOld},
		{"no timestamp", func(r *ReportLocationRequest) { r.CapturedAt = time.Time{} }, ErrLocationNoTime},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := ok()
			tc.edit(&r)
			_, err := r.Normalize(now)
			if !errors.Is(err, tc.want) {
				t.Fatalf("got %v, want %v", err, tc.want)
			}
		})
	}
}

// Android reports "not measured" as -1 (or NaN); those become null, and an
// unknown accuracy does not reject the point.
func TestReportLocationNormalizesAndroidUnknowns(t *testing.T) {
	now := time.Now()
	r := ReportLocationRequest{Latitude: f(-4.3), Longitude: f(15.3), Accuracy: f(-1), Heading: f(-1), Speed: f(math.NaN()), CapturedAt: now}
	p, err := r.Normalize(now)
	if err != nil {
		t.Fatal(err)
	}
	if p.AccuracyM != nil || p.HeadingDeg != nil || p.SpeedMps != nil {
		t.Fatalf("unknowns not nulled: %+v", p)
	}
	r.Heading = f(370)
	p, _ = r.Normalize(now)
	if p.HeadingDeg == nil || *p.HeadingDeg != 10 {
		t.Fatalf("heading 370 should wrap to 10, got %v", p.HeadingDeg)
	}
}

func TestLocationFreshness(t *testing.T) {
	for age, want := range map[time.Duration]string{
		0:                 LocationFreshnessLive,
		29 * time.Second:  LocationFreshnessLive,
		30 * time.Second:  LocationFreshnessRecent,
		2 * time.Minute:   LocationFreshnessRecent,
		121 * time.Second: LocationFreshnessStale,
	} {
		if got := LocationFreshness(age); got != want {
			t.Errorf("age %v: got %s, want %s", age, got, want)
		}
	}
}

func TestCourierLocationResponseOnlyWhileInTransit(t *testing.T) {
	now := time.Now()
	row := LiveLocationRow{OrderID: uuid.New(), DeliveryStatus: DeliveryStatusInTransit, HasPoint: true,
		Latitude: -4.3, Longitude: 15.3, CapturedAt: now.Add(-10 * time.Second), ReceivedAt: now.Add(-9 * time.Second)}
	resp := row.ToCourierLocationResponse(now)
	if !resp.LiveTrackingActive || !resp.Available || resp.Location == nil || resp.Freshness != LocationFreshnessLive || resp.IsStale {
		t.Fatalf("in transit with a fresh point: %+v", resp)
	}

	row.DeliveryStatus = "COURIER_ARRIVED"
	resp = row.ToCourierLocationResponse(now)
	if resp.LiveTrackingActive || resp.Available || resp.Location != nil {
		t.Fatalf("arrived must expose no position: %+v", resp)
	}

	// A phone clock running ahead cannot make an old point look live: the
	// age is bounded by when the server received it.
	row.DeliveryStatus = DeliveryStatusInTransit
	row.CapturedAt, row.ReceivedAt = now.Add(time.Minute), now.Add(-3*time.Minute)
	resp = row.ToCourierLocationResponse(now)
	if resp.Freshness != LocationFreshnessStale || !resp.IsStale {
		t.Fatalf("point received 3 min ago must be stale: %+v", resp)
	}

	row.HasPoint = false
	resp = row.ToCourierLocationResponse(now)
	if !resp.LiveTrackingActive || resp.Available || resp.Freshness != LocationFreshnessUnavailable {
		t.Fatalf("in transit with no point yet: %+v", resp)
	}
}

func TestValidDestination(t *testing.T) {
	if lat, lng := ValidDestination(f(-4.3), f(15.3)); lat == nil || lng == nil {
		t.Fatal("valid pair dropped")
	}
	for name, pair := range map[string][2]*float64{
		"missing longitude": {f(-4.3), nil},
		"out of range":      {f(95), f(15)},
		"null island":       {f(0), f(0)},
	} {
		if lat, lng := ValidDestination(pair[0], pair[1]); lat != nil || lng != nil {
			t.Errorf("%s kept", name)
		}
	}
}
