package repository

import (
	"database/sql"
	"fmt"

	"github.com/btmi-ai-market/backend/internal/models"
)

// searchAnalyticsDays is the window of the admin search statistics.
const searchAnalyticsDays = 30

// Rows logged by the relevance search (migration 104) carry a normalized
// query; older rows only have the raw text and are excluded from the detailed
// statistics so rates are not diluted by searches that could not be tracked.
func trackedSearch(alias string) string {
	return fmt.Sprintf(`%[1]s.search_type = 'TEXT' AND %[1]s.normalized_query <> '' AND %[1]s.created_at >= NOW() - make_interval(days => $1)`, alias)
}

// GetSearchAnalytics computes the search dashboard. Every rate that depends
// on data not collected yet is returned as nil.
func (r *AdminCommerceRepository) GetSearchAnalytics() (*models.AdminSearchAnalytics, error) {
	a := &models.AdminSearchAnalytics{Available: true, Message: "Search analytics retrieved", PeriodDays: searchAnalyticsDays}
	days := searchAnalyticsDays

	if err := r.db.QueryRow(`SELECT COUNT(*), COUNT(*) FILTER (WHERE results_count = 0 AND error IS NULL),
		COUNT(*) FILTER (WHERE error IS NOT NULL) FROM search_query_log`).Scan(&a.TotalQueries, &a.ZeroResults, &a.FailedSearches); err != nil {
		return nil, err
	}
	if err := r.db.QueryRow(`SELECT COUNT(*), COUNT(*) FILTER (WHERE is_zero_result),
		COUNT(*) FILTER (WHERE match_mode = 'approximate') FROM search_query_log l WHERE `+trackedSearch("l"), days).
		Scan(&a.Searches, &a.ZeroResultSearches, &a.ApproximateSearches); err != nil {
		return nil, err
	}
	if err := r.db.QueryRow(`SELECT
		EXISTS (SELECT 1 FROM search_query_events WHERE event_type = 'CLICK'),
		EXISTS (SELECT 1 FROM search_query_events WHERE event_type = 'ADD_TO_CART'),
		EXISTS (SELECT 1 FROM search_query_log WHERE client_session IS NOT NULL)`).
		Scan(&a.ClicksCollected, &a.AddToCartCollected, &a.ReformulationsCollected); err != nil {
		return nil, err
	}

	if a.Searches > 0 && (a.ClicksCollected || a.AddToCartCollected) {
		var clicked, carted int
		if err := r.db.QueryRow(`SELECT
			COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM search_query_events e WHERE e.search_log_id = l.id AND e.event_type = 'CLICK')),
			COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM search_query_events e WHERE e.search_log_id = l.id AND e.event_type = 'ADD_TO_CART'))
			FROM search_query_log l WHERE `+trackedSearch("l"), days).Scan(&clicked, &carted); err != nil {
			return nil, err
		}
		if a.ClicksCollected {
			rate := float64(clicked) / float64(a.Searches)
			a.ClickThroughRate = &rate
		}
		if a.AddToCartCollected {
			rate := float64(carted) / float64(a.Searches)
			a.AddToCartRate = &rate
		}
	}

	var err error
	if a.TopQueries, err = r.searchQueryStats(days, false, a.ClicksCollected); err != nil {
		return nil, err
	}
	if a.ZeroResultQueries, err = r.searchQueryStats(days, true, a.ClicksCollected); err != nil {
		return nil, err
	}
	if a.Reformulations, err = r.searchReformulations(days); err != nil {
		return nil, err
	}
	a.LowClickProducts = []models.AdminSearchProductExposure{}
	if a.ClicksCollected {
		if a.LowClickProducts, err = r.searchLowClickProducts(days); err != nil {
			return nil, err
		}
	}
	return a, nil
}

func (r *AdminCommerceRepository) searchQueryStats(days int, zeroOnly, withClicks bool) ([]models.AdminSearchQueryStat, error) {
	filter := ""
	if zeroOnly {
		filter = " AND l.is_zero_result"
	}
	rows, err := r.db.Query(`
		SELECT l.normalized_query, COUNT(*), AVG(l.results_count)::float8,
		       COUNT(*) FILTER (WHERE l.is_zero_result),
		       COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM search_query_events e WHERE e.search_log_id = l.id AND e.event_type = 'CLICK'))
		FROM search_query_log l
		WHERE `+trackedSearch("l")+filter+`
		GROUP BY l.normalized_query
		ORDER BY COUNT(*) DESC, l.normalized_query
		LIMIT 20`, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.AdminSearchQueryStat{}
	for rows.Next() {
		var s models.AdminSearchQueryStat
		if err := rows.Scan(&s.Query, &s.Searches, &s.AvgResults, &s.ZeroResults, &s.Clicks); err != nil {
			return nil, err
		}
		if withClicks && s.Searches > 0 {
			ctr := float64(s.Clicks) / float64(s.Searches)
			s.CTR = &ctr
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// searchReformulations finds queries followed within two minutes, in the same
// anonymous client session, by a different query, without any click on the
// first one's results.
func (r *AdminCommerceRepository) searchReformulations(days int) ([]models.AdminSearchReformulation, error) {
	rows, err := r.db.Query(`
		SELECT a.normalized_query, nxt.normalized_query, COUNT(*)
		FROM search_query_log a
		JOIN LATERAL (
			SELECT b.normalized_query FROM search_query_log b
			WHERE b.client_session = a.client_session AND b.search_type = 'TEXT'
			  AND b.created_at > a.created_at AND b.created_at <= a.created_at + INTERVAL '2 minutes'
			ORDER BY b.created_at LIMIT 1
		) nxt ON TRUE
		WHERE a.client_session IS NOT NULL AND `+trackedSearch("a")+`
		  AND nxt.normalized_query <> a.normalized_query AND nxt.normalized_query <> ''
		  AND NOT EXISTS (SELECT 1 FROM search_query_events e WHERE e.search_log_id = a.id AND e.event_type = 'CLICK')
		GROUP BY 1, 2
		ORDER BY 3 DESC, 1, 2
		LIMIT 20`, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.AdminSearchReformulation{}
	for rows.Next() {
		var s models.AdminSearchReformulation
		if err := rows.Scan(&s.FromQuery, &s.ToQuery, &s.Count); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// searchLowClickProducts lists products often shown on a first result page
// but rarely opened (at least 20 impressions).
func (r *AdminCommerceRepository) searchLowClickProducts(days int) ([]models.AdminSearchProductExposure, error) {
	rows, err := r.db.Query(`
		WITH impressions AS (
			SELECT pid, COUNT(*) AS n
			FROM search_query_log l, unnest(l.result_ids) AS pid
			WHERE `+trackedSearch("l")+`
			GROUP BY pid
			HAVING COUNT(*) >= 20
		), clicks AS (
			SELECT e.result_id AS pid, COUNT(*) AS n
			FROM search_query_events e
			JOIN search_query_log l ON l.id = e.search_log_id
			WHERE e.event_type = 'CLICK' AND e.result_type = 'PRODUCT' AND `+trackedSearch("l")+`
			GROUP BY e.result_id
		)
		SELECT i.pid::text, COALESCE(p.name, ''), i.n, COALESCE(c.n, 0), COALESCE(c.n, 0)::float8 / i.n AS ctr
		FROM impressions i
		LEFT JOIN clicks c ON c.pid = i.pid
		LEFT JOIN products p ON p.id = i.pid
		ORDER BY ctr ASC, i.n DESC, i.pid
		LIMIT 20`, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.AdminSearchProductExposure{}
	for rows.Next() {
		var s models.AdminSearchProductExposure
		if err := rows.Scan(&s.ProductID, &s.Name, &s.Impressions, &s.Clicks, &s.CTR); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *AdminCommerceRepository) ListSearchQueries(limit, offset int) ([]*models.AdminSearchQueryLog, int, error) {
	if limit <= 0 || limit > 200 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	rows, err := r.db.Query(`
		SELECT l.query, l.normalized_query, l.results_count, l.search_type, COALESCE(l.match_mode, ''),
		       (SELECT COUNT(*) FROM search_query_events e WHERE e.search_log_id = l.id AND e.event_type = 'CLICK'),
		       l.created_at
		FROM search_query_log l
		ORDER BY l.created_at DESC, l.id
		LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	logs := make([]*models.AdminSearchQueryLog, 0)
	for rows.Next() {
		l := &models.AdminSearchQueryLog{}
		if err := rows.Scan(&l.Query, &l.NormalizedQuery, &l.ResultsCount, &l.SearchType, &l.MatchMode, &l.Clicks, &l.CreatedAt); err != nil {
			return nil, 0, err
		}
		logs = append(logs, l)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	var total int
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM search_query_log`).Scan(&total); err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}

func (r *AdminCommerceRepository) ListSearchSynonyms() ([]models.AdminSearchSynonym, error) {
	rows, err := r.db.Query(`SELECT term, canonical_term, language_code, active, updated_at
		FROM search_synonyms ORDER BY canonical_term, term`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.AdminSearchSynonym{}
	for rows.Next() {
		var s models.AdminSearchSynonym
		if err := rows.Scan(&s.Term, &s.CanonicalTerm, &s.LanguageCode, &s.Active, &s.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// UpsertSearchSynonym stores a normalized synonym and returns the previous row
// (nil when the term is new) for the audit log.
func (r *AdminCommerceRepository) UpsertSearchSynonym(s models.AdminSearchSynonym) (*models.AdminSearchSynonym, error) {
	var prev models.AdminSearchSynonym
	err := r.db.QueryRow(`SELECT term, canonical_term, language_code, active, updated_at FROM search_synonyms WHERE term = $1`, s.Term).
		Scan(&prev.Term, &prev.CanonicalTerm, &prev.LanguageCode, &prev.Active, &prev.UpdatedAt)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	if _, err := r.db.Exec(`INSERT INTO search_synonyms (term, canonical_term, language_code, active)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (term) DO UPDATE SET canonical_term = EXCLUDED.canonical_term,
		  language_code = EXCLUDED.language_code, active = EXCLUDED.active, updated_at = NOW()`,
		s.Term, s.CanonicalTerm, s.LanguageCode, s.Active); err != nil {
		return nil, err
	}
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &prev, nil
}

func (r *AdminCommerceRepository) DeleteSearchSynonym(term string) (bool, error) {
	res, err := r.db.Exec(`DELETE FROM search_synonyms WHERE term = $1`, term)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}
