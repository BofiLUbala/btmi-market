// Package maps holds the delivery route geometry and the TomTom client.
//
// Coordinates are always [longitude, latitude] pairs in route geometry, the
// GeoJSON order every map client reads directly.
package maps

import "math"

const earthRadiusM = 6371008.8

// LngLat is one geometry vertex: [longitude, latitude].
type LngLat [2]float64

func rad(d float64) float64 { return d * math.Pi / 180 }
func deg(r float64) float64 { return r * 180 / math.Pi }

// DistanceM is the great-circle distance between two points, in metres.
func DistanceM(a, b LngLat) float64 {
	lat1, lat2 := rad(a[1]), rad(b[1])
	dLat := lat2 - lat1
	dLng := rad(b[0] - a[0])
	h := math.Sin(dLat/2)*math.Sin(dLat/2) + math.Cos(lat1)*math.Cos(lat2)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * earthRadiusM * math.Asin(math.Min(1, math.Sqrt(h)))
}

// BearingDeg is the initial bearing from a to b, 0 = north, clockwise.
func BearingDeg(a, b LngLat) float64 {
	lat1, lat2 := rad(a[1]), rad(b[1])
	dLng := rad(b[0] - a[0])
	y := math.Sin(dLng) * math.Cos(lat2)
	x := math.Cos(lat1)*math.Sin(lat2) - math.Sin(lat1)*math.Cos(lat2)*math.Cos(dLng)
	return math.Mod(deg(math.Atan2(y, x))+360, 360)
}

// LengthM is the length of a polyline.
func LengthM(line []LngLat) float64 {
	total := 0.0
	for i := 1; i < len(line); i++ {
		total += DistanceM(line[i-1], line[i])
	}
	return total
}

// Projection is where a point falls on a polyline.
type Projection struct {
	Point    LngLat  // closest point on the line
	OffsetM  float64 // distance along the line from its start to Point
	AwayM    float64 // distance from the original point to Point
	Segment  int     // index of the segment's first vertex
	LineLenM float64 // full line length
}

// Project finds the closest point of the line to p. Segments are a few
// hundred metres at most, so a local flat projection per segment is exact
// enough for metres-level progress.
func Project(line []LngLat, p LngLat) Projection {
	best := Projection{AwayM: math.Inf(1)}
	if len(line) == 0 {
		return best
	}
	if len(line) == 1 {
		return Projection{Point: line[0], AwayM: DistanceM(line[0], p)}
	}
	walked := 0.0
	for i := 1; i < len(line); i++ {
		a, b := line[i-1], line[i]
		segLen := DistanceM(a, b)
		// Local metric frame centred on a.
		kx := math.Cos(rad(a[1])) * earthRadiusM * math.Pi / 180
		ky := earthRadiusM * math.Pi / 180
		bx, by := (b[0]-a[0])*kx, (b[1]-a[1])*ky
		px, py := (p[0]-a[0])*kx, (p[1]-a[1])*ky
		t := 0.0
		if l2 := bx*bx + by*by; l2 > 0 {
			t = math.Max(0, math.Min(1, (px*bx+py*by)/l2))
		}
		q := LngLat{a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t}
		if away := DistanceM(q, p); away < best.AwayM {
			best = Projection{Point: q, OffsetM: walked + segLen*t, AwayM: away, Segment: i - 1}
		}
		walked += segLen
	}
	best.LineLenM = walked
	return best
}

// Arrow marks the travel direction at one point of the route.
type Arrow struct {
	Longitude float64 `json:"longitude"`
	Latitude  float64 `json:"latitude"`
	Bearing   float64 `json:"bearing"`
}

// Arrows places direction marks every spacingM along the line, starting half
// a spacing in, at most max of them (the spacing grows to respect max).
func Arrows(line []LngLat, spacingM float64, max int) []Arrow {
	total := LengthM(line)
	if total == 0 || max <= 0 {
		return nil
	}
	if total/spacingM > float64(max) {
		spacingM = total / float64(max)
	}
	out := []Arrow{}
	next := spacingM / 2
	walked := 0.0
	for i := 1; i < len(line) && len(out) < max; i++ {
		a, b := line[i-1], line[i]
		segLen := DistanceM(a, b)
		for segLen > 0 && next <= walked+segLen && len(out) < max {
			t := (next - walked) / segLen
			out = append(out, Arrow{
				Longitude: a[0] + (b[0]-a[0])*t,
				Latitude:  a[1] + (b[1]-a[1])*t,
				Bearing:   math.Round(BearingDeg(a, b)),
			})
			next += spacingM
		}
		walked += segLen
	}
	return out
}

// TravelledM sums a GPS trail, ignoring hops shorter than the noise floor
// (a phone standing still drifts a few metres) and isolated impossible jumps:
// a point far from both its neighbours is a bad fix; a far point the next
// ones stay close to is a real move after a gap, kept but not counted.
func TravelledM(trail []LngLat, noiseM, maxHopM float64) float64 {
	total := 0.0
	if len(trail) < 2 {
		return 0
	}
	last := trail[0]
	var pending *LngLat
	for i := 1; i < len(trail); i++ {
		p := trail[i]
		if pending != nil {
			if DistanceM(*pending, p) <= maxHopM && DistanceM(last, p) > maxHopM {
				last = *pending
			}
			pending = nil
		}
		d := DistanceM(last, p)
		if d < noiseM {
			continue
		}
		if d > maxHopM {
			pending = &trail[i]
			continue
		}
		total += d
		last = p
	}
	return total
}

// Simplify keeps at most max points of a trail, evenly picked, always with
// the first and the last.
func Simplify(line []LngLat, max int) []LngLat {
	if len(line) <= max || max < 2 {
		return line
	}
	out := make([]LngLat, 0, max)
	step := float64(len(line)-1) / float64(max-1)
	for i := 0; i < max; i++ {
		out = append(out, line[int(math.Round(float64(i)*step))])
	}
	return out
}

// ValidPoint refuses out-of-range pairs and 0,0 (the "no fix" placeholder).
func ValidPoint(lat, lng float64) bool {
	return !math.IsNaN(lat) && !math.IsNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat == 0 && lng == 0)
}
