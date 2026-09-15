package repository

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/btmi-ai-market/backend/internal/database"
	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/google/uuid"
)

var ErrLocationNotFound = errors.New("LOCATION_NOT_FOUND")

type LocationRepository struct{ db *database.DB }

func NewLocationRepository(db *database.DB) *LocationRepository {
	return &LocationRepository{db: db}
}

func (r *LocationRepository) ListProvinces() ([]models.Province, error) {
	rows, err := r.db.Query(`SELECT id, code, name, active FROM provinces WHERE active = TRUE ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.Province, 0)
	for rows.Next() {
		var item models.Province
		if err := rows.Scan(&item.ID, &item.Code, &item.Name, &item.Active); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *LocationRepository) ListCities(provinceID uuid.UUID) ([]models.City, error) {
	rows, err := r.db.Query(`SELECT id, province_id, code, name, active FROM cities WHERE province_id = $1 AND active = TRUE ORDER BY name`, provinceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.City, 0)
	for rows.Next() {
		var item models.City
		if err := rows.Scan(&item.ID, &item.ProvinceID, &item.Code, &item.Name, &item.Active); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// ListAllCities backs the single-city pickers (shop delivery zone), which have
// no province step to filter on.
func (r *LocationRepository) ListAllCities() ([]models.City, error) {
	rows, err := r.db.Query(`SELECT id, province_id, code, name, active FROM cities WHERE active = TRUE ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.City, 0)
	for rows.Next() {
		var item models.City
		if err := rows.Scan(&item.ID, &item.ProvinceID, &item.Code, &item.Name, &item.Active); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *LocationRepository) ListCommunes(cityID uuid.UUID) ([]models.Commune, error) {
	rows, err := r.db.Query(`SELECT id, city_id, code, name, active FROM communes WHERE city_id = $1 AND active = TRUE ORDER BY name`, cityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]models.Commune, 0)
	for rows.Next() {
		var item models.Commune
		if err := rows.Scan(&item.ID, &item.CityID, &item.Code, &item.Name, &item.Active); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// Resolve loads the three rows in one query and fails unless they really form a
// province -> city -> commune chain, so a caller cannot mix a Gombe commune
// with a Lubumbashi city.
func (r *LocationRepository) Resolve(provinceID, cityID, communeID uuid.UUID) (*models.ResolvedAddress, error) {
	resolved := &models.ResolvedAddress{}
	err := r.db.QueryRow(`
		SELECT p.id, p.code, p.name, p.active,
		       c.id, c.province_id, c.code, c.name, c.active,
		       m.id, m.city_id, m.code, m.name, m.active
		FROM communes m
		JOIN cities c ON c.id = m.city_id
		JOIN provinces p ON p.id = c.province_id
		WHERE m.id = $3 AND c.id = $2 AND p.id = $1
		  AND m.active AND c.active AND p.active
	`, provinceID, cityID, communeID).Scan(
		&resolved.Province.ID, &resolved.Province.Code, &resolved.Province.Name, &resolved.Province.Active,
		&resolved.City.ID, &resolved.City.ProvinceID, &resolved.City.Code, &resolved.City.Name, &resolved.City.Active,
		&resolved.Commune.ID, &resolved.Commune.CityID, &resolved.Commune.Code, &resolved.Commune.Name, &resolved.Commune.Active,
	)
	if err == sql.ErrNoRows {
		return nil, ErrLocationNotFound
	}
	if err != nil {
		return nil, err
	}
	return resolved, nil
}

// ResolveByNames maps free-text addresses onto the hierarchy so an older
// buyer profile can still pre-fill the structured selects and a light client
// that sends labels instead of ids keeps working. Matching is case- and
// accent-insensitive with prefix support ("Bandal" resolves to "Bandalungwa");
// an exact commune+city pair is always preferred over a fuzzy one. The whole
// hierarchy (~200 rows) is loaded and matched in memory so the Go-side and
// SQL-side normalisation can never disagree about accents or separators.
func (r *LocationRepository) ResolveByNames(province, city, commune string) (*models.ResolvedAddress, error) {
	normalize := func(value string) string {
		replacer := strings.NewReplacer(
			"é", "e", "è", "e", "ê", "e", "ë", "e",
			"à", "a", "â", "a", "ä", "a",
			"î", "i", "ï", "i",
			"ô", "o", "ö", "o",
			"ù", "u", "û", "u", "ü", "u",
			"ç", "c",
			"'", " ", "’", " ", "-", " ", "_", " ",
			".", " ", ",", " ", "  ", " ",
		)
		return strings.TrimSpace(replacer.Replace(strings.ToLower(value)))
	}
	province, city, commune = normalize(province), normalize(city), normalize(commune)

	rows, err := r.db.Query(`
		SELECT p.id, p.code, p.name, p.active,
		       c.id, c.province_id, c.code, c.name, c.active,
		       m.id, m.city_id, m.code, m.name, m.active
		FROM communes m
		JOIN cities c ON c.id = m.city_id
		JOIN provinces p ON p.id = c.province_id
		WHERE m.active AND c.active AND p.active
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type candidate struct {
		resolved models.ResolvedAddress
		normProv string
		normCity string
		normComm string
	}
	var candidates []candidate
	for rows.Next() {
		var item candidate
		if err := rows.Scan(
			&item.resolved.Province.ID, &item.resolved.Province.Code, &item.resolved.Province.Name, &item.resolved.Province.Active,
			&item.resolved.City.ID, &item.resolved.City.ProvinceID, &item.resolved.City.Code, &item.resolved.City.Name, &item.resolved.City.Active,
			&item.resolved.Commune.ID, &item.resolved.Commune.CityID, &item.resolved.Commune.Code, &item.resolved.Commune.Name, &item.resolved.Commune.Active,
		); err != nil {
			return nil, err
		}
		item.normProv = normalize(item.resolved.Province.Name)
		item.normCity = normalize(item.resolved.City.Name)
		item.normComm = normalize(item.resolved.Commune.Name)
		candidates = append(candidates, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	var best *candidate
	bestScore := -1
	pick := func(item *candidate, score int) {
		if best == nil || score > bestScore || (score == bestScore && len(item.normComm) < len(best.normComm)) {
			best, bestScore = item, score
		}
	}
	for i := range candidates {
		item := &candidates[i]
		// Province is optional (legacy clients), city + commune are required.
		provOK := province == "" || strings.HasPrefix(item.normProv, province)
		cityOK := strings.HasPrefix(item.normCity, city)
		commOK := strings.HasPrefix(item.normComm, commune)
		if !provOK || !cityOK || !commOK {
			continue
		}
		score := 0
		if item.normCity == city {
			score++
		}
		if item.normComm == commune {
			score++
		}
		if item.normProv == province && province != "" {
			score++
		}
		pick(item, score)
	}
	if best == nil {
		return nil, ErrLocationNotFound
	}
	resolved := best.resolved
	return &resolved, nil
}
