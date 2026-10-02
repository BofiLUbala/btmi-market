package maps

import (
	"math"
	"testing"
)

func near(t *testing.T, name string, got, want, tol float64) {
	t.Helper()
	if math.Abs(got-want) > tol {
		t.Errorf("%s = %.2f, want %.2f ± %.2f", name, got, want, tol)
	}
}

// A straight 1 km east-west street at Kinshasa's latitude, then 500 m north.
var lShape = []LngLat{{15.3000, -4.3100}, {15.30901, -4.3100}, {15.30901, -4.30548}}

func TestDistanceAndLength(t *testing.T) {
	near(t, "1 km east", DistanceM(lShape[0], lShape[1]), 1000, 5)
	near(t, "500 m north", DistanceM(lShape[1], lShape[2]), 500, 5)
	near(t, "length", LengthM(lShape), 1500, 8)
}

func TestBearing(t *testing.T) {
	near(t, "east", BearingDeg(lShape[0], lShape[1]), 90, 0.5)
	near(t, "north", BearingDeg(lShape[1], lShape[2]), 0, 0.5)
}

func TestProjectOnRoute(t *testing.T) {
	// 300 m along the first street, 20 m south of it.
	p := LngLat{15.3027, -4.31018}
	pr := Project(lShape, p)
	near(t, "offset", pr.OffsetM, 300, 5)
	near(t, "away", pr.AwayM, 20, 2)
	near(t, "remaining", pr.LineLenM-pr.OffsetM, 1200, 10)
	if pr.Segment != 0 {
		t.Errorf("segment = %d, want 0", pr.Segment)
	}
	// On the second street: the courier turned north.
	pr = Project(lShape, LngLat{15.30901, -4.3082})
	near(t, "offset after the turn", pr.OffsetM, 1200, 8)
	near(t, "on route", pr.AwayM, 0, 1)
}

func TestProjectBeforeStartClampsToStart(t *testing.T) {
	pr := Project(lShape, LngLat{15.2990, -4.3100})
	near(t, "offset", pr.OffsetM, 0, 0.01)
	near(t, "away", pr.AwayM, 111, 3)
}

func TestArrowsFollowTheTravelDirection(t *testing.T) {
	arrows := Arrows(lShape, 400, 30)
	if len(arrows) != 4 { // at 200, 600, 1000(turn), 1400 m
		t.Fatalf("got %d arrows, want 4: %+v", len(arrows), arrows)
	}
	if arrows[0].Bearing != 90 || arrows[3].Bearing != 0 {
		t.Errorf("bearings = %v / %v, want 90 east then 0 north", arrows[0].Bearing, arrows[3].Bearing)
	}
	// The cap widens the spacing instead of cutting the route short.
	capped := Arrows(lShape, 10, 5)
	if len(capped) != 5 || capped[4].Bearing != 0 {
		t.Errorf("capped arrows must still reach the end of the route: %+v", capped)
	}
}

func TestTravelledIgnoresNoiseAndJumps(t *testing.T) {
	trail := []LngLat{
		{15.3000, -4.3100},
		{15.30001, -4.3100}, // ~1 m drift, ignored
		{15.30090, -4.3100}, // 100 m
		{15.40000, -4.3100}, // 11 km GPS jump, not counted
		{15.30180, -4.3100}, // back on track: 100 m from the last kept point
	}
	near(t, "travelled", TravelledM(trail, 8, 3000), 200, 5)
}

func TestSimplifyKeepsEnds(t *testing.T) {
	line := make([]LngLat, 1000)
	for i := range line {
		line[i] = LngLat{float64(i), 0}
	}
	s := Simplify(line, 10)
	if len(s) != 10 || s[0] != line[0] || s[9] != line[999] {
		t.Errorf("simplify lost the ends: %v", s)
	}
}

func TestTravelModeFor(t *testing.T) {
	for in, want := range map[string]string{"MOTO": "motorcycle", "MOTORCYCLE": "motorcycle", "MOTORBIKE": "motorcycle", "BICYCLE": "bicycle", "FOOT": "pedestrian", "CAR": "car", "": "car"} {
		if got := TravelModeFor(in); got != want {
			t.Errorf("TravelModeFor(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestValidPoint(t *testing.T) {
	if ValidPoint(0, 0) || ValidPoint(91, 0) || ValidPoint(0, 181) || !ValidPoint(-4.3, 15.3) {
		t.Error("ValidPoint")
	}
}
