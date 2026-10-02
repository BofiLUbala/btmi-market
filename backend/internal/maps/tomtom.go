package maps

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ErrNotConfigured: no TomTom key, so no geocoding and no road route.
var ErrNotConfigured = errors.New("MAPS_NOT_CONFIGURED")

// ErrNoRoute: TomTom found no road between the two points.
var ErrNoRoute = errors.New("NO_ROUTE")

// Client calls TomTom Search (geocoding) and Routing. The key stays on the
// server: clients ask the API, never TomTom directly, for these two.
type Client struct {
	key  string
	base string
	http *http.Client
}

func NewClient(key string) *Client {
	return &Client{key: strings.TrimSpace(key), base: "https://api.tomtom.com", http: &http.Client{Timeout: 8 * time.Second}}
}

func (c *Client) Configured() bool { return c != nil && c.key != "" }

// Candidate is one geocoding answer. Confident is set only for a match good
// enough to offer first; every candidate still has to be confirmed on the map.
type Candidate struct {
	Label     string  `json:"label"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Score     float64 `json:"score"`
	Kind      string  `json:"kind"`
	Confident bool    `json:"confident"`
}

// MinConfidentScore: below it TomTom has matched another street (an unknown
// "Rue X" in Masina comes back as "Rue Kinshasa" with ~0.5).
const MinConfidentScore = 0.8

// Geocode looks an address up in DR Congo. TomTom knows Kinshasa at street
// level: a house number is not located, and the same street name may exist in
// several communes, hence candidates, never a single silent answer.
func (c *Client) Geocode(ctx context.Context, query string) ([]Candidate, error) {
	if !c.Configured() {
		return nil, ErrNotConfigured
	}
	q := url.Values{"key": {c.key}, "countrySet": {"CD"}, "limit": {"5"}, "language": {"fr-FR"}}
	u := fmt.Sprintf("%s/search/2/geocode/%s.json?%s", c.base, url.PathEscape(strings.TrimSpace(query)), q.Encode())
	var body struct {
		Results []struct {
			Type            string `json:"type"`
			MatchConfidence struct {
				Score float64 `json:"score"`
			} `json:"matchConfidence"`
			Address struct {
				FreeformAddress    string `json:"freeformAddress"`
				MunicipalitySubdiv string `json:"municipalitySubdivision"`
			} `json:"address"`
			Position struct {
				Lat float64 `json:"lat"`
				Lon float64 `json:"lon"`
			} `json:"position"`
		} `json:"results"`
	}
	if err := c.get(ctx, u, &body); err != nil {
		return nil, err
	}
	out := make([]Candidate, 0, len(body.Results))
	for _, r := range body.Results {
		label := r.Address.FreeformAddress
		if r.Address.MunicipalitySubdiv != "" && !strings.Contains(label, r.Address.MunicipalitySubdiv) {
			label = r.Address.MunicipalitySubdiv + ", " + label
		}
		out = append(out, Candidate{
			Label: label, Latitude: r.Position.Lat, Longitude: r.Position.Lon,
			Score: r.MatchConfidence.Score, Kind: r.Type,
			Confident: r.MatchConfidence.Score >= MinConfidentScore,
		})
	}
	return out, nil
}

// Instruction is one navigation step, located by its distance from the start.
type Instruction struct {
	Message  string  `json:"message"`
	Maneuver string  `json:"maneuver"`
	OffsetM  float64 `json:"offset_m"`
}

// Route is a road route between two points.
type Route struct {
	Geometry     []LngLat      `json:"geometry"`
	LengthM      float64       `json:"length_m"`
	DurationS    float64       `json:"duration_s"`
	Instructions []Instruction `json:"instructions"`
}

// TravelModeFor maps the courier's transport to a TomTom travel mode.
func TravelModeFor(transport string) string {
	switch strings.ToUpper(strings.TrimSpace(transport)) {
	case "MOTO", "MOTORCYCLE", "MOTORBIKE", "SCOOTER":
		return "motorcycle"
	case "BICYCLE", "BIKE", "VELO":
		return "bicycle"
	case "FOOT", "WALK", "PEDESTRIAN", "A_PIED":
		return "pedestrian"
	case "VAN":
		return "van"
	case "TRUCK", "CAMION":
		return "truck"
	default:
		return "car"
	}
}

// Route asks for the fastest road route for the travel mode, with French
// turn-by-turn instructions.
func (c *Client) Route(ctx context.Context, from, to LngLat, travelMode string) (*Route, error) {
	if !c.Configured() {
		return nil, ErrNotConfigured
	}
	q := url.Values{"key": {c.key}, "travelMode": {travelMode}, "instructionsType": {"text"}, "language": {"fr-FR"},
		"routeRepresentation": {"polyline"}, "traffic": {"true"}}
	u := fmt.Sprintf("%s/routing/1/calculateRoute/%f,%f:%f,%f/json?%s", c.base, from[1], from[0], to[1], to[0], q.Encode())
	var body struct {
		Routes []struct {
			Summary struct {
				LengthInMeters      float64 `json:"lengthInMeters"`
				TravelTimeInSeconds float64 `json:"travelTimeInSeconds"`
			} `json:"summary"`
			Legs []struct {
				Points []struct {
					Latitude  float64 `json:"latitude"`
					Longitude float64 `json:"longitude"`
				} `json:"points"`
			} `json:"legs"`
			Guidance struct {
				Instructions []struct {
					Message             string  `json:"message"`
					Maneuver            string  `json:"maneuver"`
					RouteOffsetInMeters float64 `json:"routeOffsetInMeters"`
				} `json:"instructions"`
			} `json:"guidance"`
		} `json:"routes"`
	}
	if err := c.get(ctx, u, &body); err != nil {
		return nil, err
	}
	if len(body.Routes) == 0 {
		return nil, ErrNoRoute
	}
	r := body.Routes[0]
	route := &Route{LengthM: r.Summary.LengthInMeters, DurationS: r.Summary.TravelTimeInSeconds}
	for _, leg := range r.Legs {
		for _, p := range leg.Points {
			route.Geometry = append(route.Geometry, LngLat{p.Longitude, p.Latitude})
		}
	}
	for _, in := range r.Guidance.Instructions {
		route.Instructions = append(route.Instructions, Instruction{Message: in.Message, Maneuver: in.Maneuver, OffsetM: in.RouteOffsetInMeters})
	}
	if len(route.Geometry) < 2 {
		return nil, ErrNoRoute
	}
	return route, nil
}

func (c *Client) get(ctx context.Context, u string, into any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return err
	}
	res, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("tomtom: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusBadRequest {
		// TomTom answers 400 for points it cannot route between (sea, off-road).
		return ErrNoRoute
	}
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("tomtom: HTTP %d", res.StatusCode)
	}
	return json.NewDecoder(res.Body).Decode(into)
}
