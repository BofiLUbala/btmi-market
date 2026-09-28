package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/btmi-ai-market/backend/internal/models"
	"github.com/btmi-ai-market/backend/internal/search"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

// Marketplace search SQL. The ranking weights come from package search
// (scoring.go); they are compile-time numeric constants interpolated with %v,
// while every user-supplied value is a bind parameter.

// searchStatementTimeout bounds one search query so a pathological input
// cannot hold a connection.
const searchStatementTimeout = "3s"

// browseCandidates bounds a search without keywords: it ranks the most
// recently created visible products instead of the whole catalog. Clients
// browse the full catalog through the category pages.
const browseCandidates = 500

// Trigram thresholds used only by the approximate (typo-tolerant) pass.
const (
	fuzzyWordSimilarity = 0.45
	fuzzySimilarity     = 0.3
)

type sqlArgs struct{ list []interface{} }

func (a *sqlArgs) add(v interface{}) string {
	a.list = append(a.list, v)
	return fmt.Sprintf("$%d", len(a.list))
}

func containsPatterns(words []string) pq.StringArray {
	out := make(pq.StringArray, 0, len(words))
	for _, w := range words {
		out = append(out, "%"+w+"%")
	}
	return out
}

// wordPatterns matches w as a whole word of a space-padded column, plurals
// included (the document is not stemmed, the query is).
func wordPatterns(words []string) pq.StringArray {
	out := make(pq.StringArray, 0, len(words)*4)
	for _, w := range words {
		out = append(out, "% "+w+" %", "% "+w+"s %", "% "+w+"x %", "% "+w+"es %")
	}
	return out
}

func exactWordPatterns(words []string) pq.StringArray {
	out := make(pq.StringArray, 0, len(words))
	for _, w := range words {
		out = append(out, "% "+w+" %")
	}
	return out
}

// termMatchSQL is the WHERE condition a document must satisfy for one term:
// it contains the word, its singular or a synonym (substring, so "phone"
// matches "smartphone"), or, in the approximate pass, something close to it.
func termMatchSQL(t search.Term, args *sqlArgs, fuzzy bool) (cond, tokenArg string) {
	cond = fmt.Sprintf("d.all_norm LIKE ANY(%s::text[])", args.add(containsPatterns(t.All())))
	if fuzzy && len([]rune(t.Token)) >= 4 {
		tokenArg = args.add(t.Token)
		cond = fmt.Sprintf("(%s OR %s <%% d.all_norm)", cond, tokenArg)
	}
	return cond, tokenArg
}

// productTermSQL returns, for every query term, the WHERE condition and the
// per-term relevance: the best field the term was found in.
func productTermSQL(q search.Query, args *sqlArgs, fuzzy bool) (conds []string, scores []string) {
	for _, t := range q.Terms {
		cond, tok := termMatchSQL(t, args, fuzzy)
		exact := args.add(containsPatterns(t.Exact))
		word := args.add(wordPatterns(t.Exact))
		skuWord := args.add(exactWordPatterns(t.Exact))
		syn := args.add(containsPatterns(t.Synonyms))
		fuzzyScore := "0"
		if tok != "" {
			fuzzyScore = fmt.Sprintf("word_similarity(%s, d.all_norm) * %v", tok, search.FuzzyMax)
		}
		conds = append(conds, cond)
		scores = append(scores, fmt.Sprintf(`GREATEST(
			CASE WHEN d.name_norm LIKE ANY(%[1]s::text[]) THEN %[6]v ELSE 0 END,
			CASE WHEN d.sku_norm LIKE ANY(%[2]s::text[]) THEN %[7]v ELSE 0 END,
			CASE WHEN d.name_norm LIKE ANY(%[3]s::text[]) THEN %[8]v ELSE 0 END,
			CASE WHEN d.attrs_norm LIKE ANY(%[3]s::text[]) THEN %[9]v ELSE 0 END,
			CASE WHEN d.taxonomy_norm LIKE ANY(%[3]s::text[]) THEN %[10]v ELSE 0 END,
			CASE WHEN d.description_norm LIKE ANY(%[3]s::text[]) THEN %[11]v ELSE 0 END,
			CASE WHEN d.all_norm LIKE ANY(%[4]s::text[]) THEN %[12]v ELSE 0 END,
			%[5]s)`,
			word, skuWord, exact, syn, fuzzyScore,
			search.TierNameWords, search.TierSKUExact, search.TierNamePartial, search.TierAttributes,
			search.TierTaxonomy, search.TierDescription, search.TierSynonym))
	}
	return conds, scores
}

// buildProductSearchSQL generates the ranked product query and its bind
// arguments. Stages:
//
//	docs    documents matching the text (trigram index), plus - when the query
//	        is the beginning of a shop or business name - that seller's catalog
//	cand    visible products only (published, active, with a valid offer in an
//	        active shop of an active business, filters applied) and their
//	        cheap sort key; COUNT(*) here is the exact total
//	kept    only the candidates that can still reach the requested page, so
//	        offers and bonuses are computed for a few rows, not the catalog
//	scored  best offer per product (no duplicates) and capped bonuses
func buildProductSearchSQL(q search.Query, p *models.MarketplaceSearchParams, fuzzy bool) (string, []interface{}) {
	args := &sqlArgs{}
	docs := "SELECT d.* FROM product_search_documents d"
	sellers := "SELECT '{}'::uuid[] AS ids"
	relevance := "0::float8"
	baseLimit := fmt.Sprintf("ORDER BY p.created_at DESC, p.id LIMIT %d", browseCandidates)
	if !q.Empty() {
		qn := args.add(q.Normalized)
		baseLimit = ""
		conds, scores := productTermSQL(q, args, fuzzy)
		match := strings.Join(conds, " AND ")
		if fuzzy {
			match = fmt.Sprintf("((%s) OR d.name_norm %% %s)", match, qn)
		}
		docs = "SELECT d.* FROM product_search_documents d WHERE " + match
		// Seller names are deliberately not part of the product documents: a
		// shop called "Chez Mama Chaussures" would otherwise make every
		// product it sells match "chaussures". A seller's catalog is included
		// only when the query is the start of its shop or business name.
		if len([]rune(q.Normalized)) >= 3 {
			sellers = fmt.Sprintf(`SELECT COALESCE(array_agg(DISTINCT b.id), '{}') AS ids
				FROM businesses b
				LEFT JOIN shops s ON s.business_id = b.id AND s.status = 'ACTIVE'
				WHERE b.status = 'ACTIVE'
				  AND (btmi_normalize_search(b.name) LIKE %[1]s || '%%' OR btmi_normalize_search(s.name) LIKE %[1]s || '%%')`, qn)
			docs += `
				UNION
				SELECT d.* FROM product_search_documents d
				JOIN products ps ON ps.id = d.product_id
				WHERE ps.business_id = ANY((SELECT ids FROM sellers)::uuid[])`
		}
		termScore := "0"
		if len(scores) == 1 {
			termScore = scores[0]
		} else if len(scores) > 1 {
			termScore = "LEAST(" + strings.Join(scores, ", ") + ")"
		}
		wholeFuzzy := "0"
		if fuzzy {
			wholeFuzzy = fmt.Sprintf("similarity(d.name_norm, %s) * %v", qn, search.FuzzyMax)
		}
		relevance = fmt.Sprintf(`(GREATEST(
			CASE WHEN d.name_norm = ' ' || %[1]s || ' ' THEN %[2]v ELSE 0 END,
			CASE WHEN d.name_norm LIKE ' ' || %[1]s || '%%' THEN %[3]v ELSE 0 END,
			CASE WHEN d.sku_norm LIKE '%% ' || %[1]s || ' %%' THEN %[4]v ELSE 0 END,
			CASE WHEN p.business_id = ANY((SELECT ids FROM sellers)::uuid[]) THEN %[5]v ELSE 0 END,
			%[6]s, %[7]s)
			+ LEAST(floor(similarity(d.name_norm, %[1]s) * %[8]v), %[9]v) * %[10]v)::float8`,
			qn, search.TierExactName, search.TierNamePrefix, search.TierSKUExact, search.TierSeller,
			termScore, wholeFuzzy, search.ClosenessBuckets, search.MaxClosenessBucket, search.ClosenessStep)
	}

	where := []string{"p.publication_status = 'PUBLISHED'", "p.status = 'ACTIVE'"}
	if p.CategorySlug != "" {
		where = append(where, fmt.Sprintf("EXISTS (SELECT 1 FROM categories cf WHERE cf.id = p.category_id AND cf.slug = %s)", args.add(p.CategorySlug)))
	}
	if p.SubcategorySlug != "" {
		where = append(where, fmt.Sprintf("EXISTS (SELECT 1 FROM subcategories sf WHERE sf.id = p.subcategory_id AND sf.slug = %s)", args.add(p.SubcategorySlug)))
	}
	if p.BusinessID != "" {
		where = append(where, fmt.Sprintf("p.business_id = %s::uuid", args.add(p.BusinessID)))
	}
	if p.MinRating > 0 {
		where = append(where, fmt.Sprintf(`EXISTS (SELECT 1 FROM product_review_aggregates pr2
			WHERE pr2.product_id = p.id AND pr2.total_reviews > 0 AND pr2.average_rating >= %s)`, args.add(p.MinRating)))
	}
	if p.MinPrice > 0 || p.MaxPrice > 0 {
		priceCond := []string{"pvp.product_id = p.id", "pvp.status = 'ACTIVE'"}
		if p.MinPrice > 0 {
			priceCond = append(priceCond, "pvp.sale_price >= "+args.add(p.MinPrice))
		}
		if p.MaxPrice > 0 {
			priceCond = append(priceCond, "pvp.sale_price <= "+args.add(p.MaxPrice))
		}
		where = append(where, "EXISTS (SELECT 1 FROM product_variants pvp WHERE "+strings.Join(priceCond, " AND ")+")")
	}

	// An offer is an active Shop of an active Business holding inventory for
	// one of the product's active variants. Without one, the product is not
	// sold anywhere and never appears.
	offerWhere := []string{"s.status = 'ACTIVE'", "b.status = 'ACTIVE'"}
	if p.ShopID != "" {
		offerWhere = append(offerWhere, fmt.Sprintf("s.id = %s::uuid", args.add(p.ShopID)))
	}
	if p.City != "" {
		offerWhere = append(offerWhere, fmt.Sprintf("btmi_normalize_search(s.city) LIKE '%%' || %s || '%%'", args.add(p.City)))
	}
	// Uncorrelated on purpose: PostgreSQL can hash-join it once instead of
	// probing inventory for every candidate.
	offerExists := `(c.product_id, c.business_id) IN (SELECT v.product_id, b.id FROM product_variants v
			JOIN inventory i ON i.variant_id = v.id
			JOIN shops s ON s.id = i.shop_id
			JOIN businesses b ON b.id = s.business_id
			WHERE v.status = 'ACTIVE' AND ` + strings.Join(offerWhere, " AND ") + ")"
	nearCity := "FALSE"
	if p.NearCity != "" {
		nearCity = fmt.Sprintf("(btmi_normalize_search(s.city) = %s)", args.add(p.NearCity))
	}

	unitPrice := "COALESCE((SELECT MIN(vp.sale_price) FROM product_variants vp WHERE vp.product_id = p.id AND vp.status = 'ACTIVE'), p.unit_price, 0)::float8"
	levelBonus := fmt.Sprintf("(LEAST(GREATEST(COALESCE((SELECT sl.search_boost FROM point_accounts pa JOIN seller_levels sl ON sl.id = pa.level_id WHERE pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = p.business_id), 0), 0), 1) * %v)::float8", search.BonusSellerLevelMax)

	// Pruning: the page only needs rows whose primary sort key can still beat
	// the key of the last row of the page. For relevance, a lower row can
	// climb at most MaxBonus and a higher one drop at most the trust penalty.
	sortKey, keep, orderBy := "relevance", ">= (SELECT key FROM cut) - "+fmt.Sprint(search.MaxBonus()-search.PenaltySuspendedTrust), "final_score DESC, id ASC"
	cutOrder := "DESC"
	switch p.Sort {
	case "price_asc":
		sortKey, keep, orderBy, cutOrder = unitPrice, "<= (SELECT key FROM cut)", "unit_price ASC, final_score DESC, id ASC", "ASC"
	case "price_desc":
		sortKey, keep, orderBy = unitPrice, ">= (SELECT key FROM cut)", "unit_price DESC, final_score DESC, id ASC"
	case "seller_level":
		sortKey, keep, orderBy = levelBonus, ">= (SELECT key FROM cut)", "level_bonus DESC, final_score DESC, id ASC"
	}

	lastRowOffset := args.add(p.Page*p.Limit - 1)
	limitArg := args.add(p.Limit)
	offsetArg := args.add((p.Page - 1) * p.Limit)

	query := fmt.Sprintf(`
		WITH sellers AS (%[1]s),
		docs AS MATERIALIZED (%[2]s),
		-- MATERIALIZED keeps the planner from checking offers for the whole
		-- catalog before joining the (few) matching documents.
		base AS MATERIALIZED (
			SELECT d.product_id, p.business_id, %[3]s AS relevance
			FROM docs d
			JOIN products p ON p.id = d.product_id
			WHERE %[4]s
			%[27]s
		), cand AS (
			SELECT c.product_id, c.relevance FROM base c WHERE %[26]s
		), keyed AS (
			SELECT c.product_id, c.relevance, %[5]s AS key
			FROM cand c JOIN products p ON p.id = c.product_id
		), subset AS MATERIALIZED (
			-- The same deterministic subset for every page, so pages never
			-- overlap even when a huge group of results ties on relevance.
			SELECT * FROM keyed ORDER BY key %[6]s, product_id LIMIT %[28]d
		), cut AS (
			SELECT key FROM subset ORDER BY key %[6]s, product_id OFFSET %[7]s LIMIT 1
		), kept AS (
			SELECT * FROM subset WHERE NOT EXISTS (SELECT 1 FROM cut) OR key %[8]s
		), offers AS (
			SELECT k.product_id, s.id AS shop_id, s.name AS shop_name,
			       SUM(GREATEST(i.quantity - i.reserved_quantity, 0)) AS available,
			       %[9]s AS near_city
			FROM kept k
			JOIN products p ON p.id = k.product_id
			JOIN product_variants v ON v.product_id = p.id AND v.status = 'ACTIVE'
			JOIN inventory i ON i.variant_id = v.id
			JOIN shops s ON s.id = i.shop_id
			JOIN businesses b ON b.id = s.business_id AND b.id = p.business_id
			WHERE %[10]s
			GROUP BY k.product_id, s.id, s.name
		), best AS (
			SELECT DISTINCT ON (product_id) *
			FROM offers
			ORDER BY product_id, (available > 0) DESC, near_city DESC, available DESC, shop_id
		), sales AS (
			SELECT ol.product_id, SUM(ol.quantity) AS units
			FROM order_lines ol
			JOIN orders o ON o.id = ol.order_id
			WHERE ol.product_id IN (SELECT product_id FROM kept)
			  AND o.status IN ('DELIVERED', 'COMPLETED')
			  AND o.created_at >= CURRENT_DATE - INTERVAL '90 days'
			GROUP BY ol.product_id
		), scored AS (
			SELECT p.id, bo.shop_id, bo.shop_name, p.business_id, b.name AS business_name,
			       p.name, p.sku, p.description, p.unit,
			       %[11]s AS unit_price,
			       COALESCE(NULLIF(p.currency, ''), 'USD') AS currency,
			       p.category_id, COALESCE(c.name, '') AS category_name, COALESCE(c.slug, '') AS category_slug,
			       p.subcategory_id, COALESCE(sc.name, '') AS subcategory_name, COALESCE(sc.slug, '') AS subcategory_slug,
			       COALESCE(sl.name, 'STARTER') AS seller_level,
			       COALESCE(st.trust_status, 'NORMAL') AS seller_trust,
			       CASE WHEN bo.available > COALESCE((SELECT gc.value::int FROM global_configs gc WHERE gc.key = 'LOW_STOCK_THRESHOLD'), 5) THEN 'AVAILABLE'
			            WHEN bo.available > 0 THEN 'LOW_STOCK'
			            ELSE 'OUT_OF_STOCK' END AS availability,
			       p.discount_active, p.discount_type, p.discount_value, p.discount_start, p.discount_end,
			       p.created_at,
			       k.relevance,
			       (LEAST(GREATEST(COALESCE(sl.search_boost, 0), 0), 1) * %[12]v)::float8 AS level_bonus,
			       (CASE WHEN bo.available > 0 THEN %[13]v ELSE 0 END
			        + CASE WHEN EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = p.id) THEN 6 ELSE 0 END
			        + CASE WHEN length(COALESCE(p.description, '')) >= 40 THEN 4 ELSE 0 END
			        + CASE WHEN p.category_id IS NOT NULL AND p.subcategory_id IS NOT NULL THEN 2 ELSE 0 END
			        + LEAST(GREATEST(
			            ((COALESCE(pra.average_rating, 0) * COALESCE(pra.total_reviews, 0) + %[14]v * %[15]v)
			              / (COALESCE(pra.total_reviews, 0) + %[15]v) - %[14]v) / (5 - %[14]v), 0), 1) * %[16]v
			        + CASE COALESCE(st.trust_status, 'NORMAL') WHEN 'TRUSTED' THEN %[17]v WHEN 'LOW' THEN %[18]v WHEN 'SUSPENDED' THEN %[19]v ELSE 0 END
			        + CASE WHEN bo.near_city THEN %[20]v ELSE 0 END
			        + LEAST(GREATEST(COALESCE(sl.search_boost, 0), 0), 1) * %[12]v
			        + LEAST(ln(1 + COALESCE(sa.units, 0)) * 2.5, %[21]v)
			        + CASE WHEN p.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN %[22]v ELSE 0 END
			       )::float8 AS bonus
			FROM best bo
			JOIN kept k ON k.product_id = bo.product_id
			JOIN products p ON p.id = bo.product_id
			JOIN businesses b ON b.id = p.business_id
			LEFT JOIN categories c ON c.id = p.category_id
			LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
			LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = b.id
			LEFT JOIN seller_levels sl ON sl.id = pa.level_id
			LEFT JOIN seller_trust st ON st.business_id = b.id
			LEFT JOIN product_review_aggregates pra ON pra.product_id = p.id
			LEFT JOIN sales sa ON sa.product_id = p.id
		)
		SELECT id, shop_id, shop_name, business_id, business_name, name, sku, description, unit,
		       unit_price, currency, category_id, category_name, category_slug, subcategory_id,
		       subcategory_name, subcategory_slug, seller_level, seller_trust, availability,
		       discount_active, discount_type, discount_value, discount_start, discount_end,
		       created_at, relevance, bonus, relevance + bonus AS final_score,
		       (SELECT COUNT(*) FROM cand) AS total_count
		FROM scored
		ORDER BY %[23]s
		LIMIT %[24]s OFFSET %[25]s`,
		sellers, docs, relevance, strings.Join(where, " AND "),
		sortKey, cutOrder, lastRowOffset, keep,
		nearCity, strings.Join(offerWhere, " AND "), unitPrice,
		search.BonusSellerLevelMax, search.BonusAvailable,
		search.RatingPriorMean, search.RatingPriorWeight, search.BonusRatingMax,
		search.BonusTrusted, search.PenaltyLowTrust, search.PenaltySuspendedTrust,
		search.BonusNearCity, search.BonusSalesMax, search.BonusRecent,
		orderBy, limitArg, offsetArg, offerExists, baseLimit, search.MaxResultDepth)

	return query, args.list
}

// ExplainProductSearch returns EXPLAIN (ANALYZE, BUFFERS) for one search, to
// check index use on a real catalog. Diagnostic only.
func (r *MarketplaceRepository) ExplainProductSearch(ctx context.Context, q search.Query, p *models.MarketplaceSearchParams, fuzzy, analyze bool) (string, error) {
	query, args := buildProductSearchSQL(q, p, fuzzy)
	var lines []string
	err := r.withSearchTx(ctx, fuzzy, func(tx *sql.Tx) error {
		prefix := "EXPLAIN "
		if analyze {
			prefix = "EXPLAIN (ANALYZE, BUFFERS) "
			// Diagnose slow plans instead of timing out on them.
			if _, err := tx.ExecContext(ctx, "SET LOCAL statement_timeout = '60s'"); err != nil {
				return err
			}
		}
		rows, err := tx.QueryContext(ctx, prefix+query, args...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var line string
			if err := rows.Scan(&line); err != nil {
				return err
			}
			lines = append(lines, line)
		}
		return rows.Err()
	})
	return strings.Join(lines, "\n"), err
}

// SearchProductsRanked runs one pass of the product search. fuzzy enables the
// typo-tolerant conditions; the service only asks for it when the exact pass
// found nothing.
func (r *MarketplaceRepository) SearchProductsRanked(ctx context.Context, q search.Query, p *models.MarketplaceSearchParams, fuzzy bool) (*models.MarketplaceSearchResult, error) {
	query, queryArgs := buildProductSearchSQL(q, p, fuzzy)
	var products []*models.PublicProductResponse
	total := 0
	err := r.withSearchTx(ctx, fuzzy, func(tx *sql.Tx) error {
		rows, err := tx.QueryContext(ctx, query, queryArgs...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			pr := &models.PublicProductResponse{}
			rank := &models.SearchRank{}
			var discountStart, discountEnd sql.NullTime
			if err := rows.Scan(
				&pr.ID, &pr.ShopID, &pr.ShopName, &pr.BusinessID, &pr.BusinessName,
				&pr.Name, &pr.SKU, &pr.Description, &pr.Unit, &pr.BasePrice, &pr.Currency,
				&pr.CategoryID, &pr.CategoryName, &pr.CategorySlug,
				&pr.SubcategoryID, &pr.SubcategoryName, &pr.SubcategorySlug,
				&pr.SellerLevel, &pr.SellerTrust, &pr.Availability,
				&pr.DiscountActive, &pr.DiscountType, &pr.DiscountValue, &discountStart, &discountEnd,
				&pr.CreatedAt, &rank.Relevance, &rank.Bonus, &rank.Score, &total,
			); err != nil {
				return err
			}
			if discountStart.Valid {
				pr.DiscountStart = &discountStart.Time
			}
			if discountEnd.Valid {
				pr.DiscountEnd = &discountEnd.Time
			}
			pr.SellerSalePrice = models.Promotion{
				Active: pr.DiscountActive, Type: pr.DiscountType, Value: pr.DiscountValue,
				Start: pr.DiscountStart, End: pr.DiscountEnd,
			}.EffectivePrice(pr.BasePrice, time.Now())
			rank.Relevance, rank.Bonus, rank.Score = round2(rank.Relevance), round2(rank.Bonus), round2(rank.Score)
			rank.Tier = search.TierName(rank.Relevance)
			pr.SearchRank = rank
			products = append(products, pr)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, err
	}
	if err := r.attachProductRatings(products); err != nil {
		return nil, err
	}
	if products == nil {
		products = []*models.PublicProductResponse{}
	}
	mode := "exact"
	if fuzzy {
		mode = "approximate"
	}
	return &models.MarketplaceSearchResult{
		Products: products,
		Pagination: models.PaginationInfo{
			Page: p.Page, Limit: p.Limit, Total: total,
			HasMore: p.Page*p.Limit < total && p.Page*p.Limit < search.MaxResultDepth,
		},
		MatchMode:       mode,
		NormalizedQuery: q.Normalized,
	}, nil
}

// withSearchTx runs fn in a read-only transaction with a statement timeout
// and, for the approximate pass, looser trigram thresholds.
func (r *MarketplaceRepository) withSearchTx(ctx context.Context, fuzzy bool, fn func(tx *sql.Tx) error) error {
	tx, err := r.db.DB.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck // read-only; rollback after commit is a no-op
	// JIT compilation costs seconds on these wide queries (their estimated
	// cost is high) while execution itself takes milliseconds.
	settings := []string{"SET LOCAL statement_timeout = '" + searchStatementTimeout + "'", "SET LOCAL jit = off"}
	if fuzzy {
		settings = append(settings,
			fmt.Sprintf("SET LOCAL pg_trgm.word_similarity_threshold = %v", fuzzyWordSimilarity),
			fmt.Sprintf("SET LOCAL pg_trgm.similarity_threshold = %v", fuzzySimilarity))
	}
	for _, s := range settings {
		if _, err := tx.ExecContext(ctx, s); err != nil {
			return err
		}
	}
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit()
}

func round2(v float64) float64 { return math.Round(v*100) / 100 }

// SearchShopsRanked ranks shops for a query. Relevance comes from the shop
// name, the business name, the city and the number of in-stock products
// matching the query; commercial signals are capped bonuses.
func (r *MarketplaceRepository) SearchShopsRanked(ctx context.Context, q search.Query, city, nearCity string, page, limit int) ([]*models.PublicShopResponse, int, error) {
	args := &sqlArgs{}
	where := []string{"s.status = 'ACTIVE'", "b.status = 'ACTIVE'"}
	if city != "" {
		where = append(where, fmt.Sprintf("btmi_normalize_search(s.city) LIKE '%%' || %s || '%%'", args.add(city)))
	}
	near := "FALSE"
	if nearCity != "" {
		near = fmt.Sprintf("(btmi_normalize_search(s.city) = %s)", args.add(nearCity))
	}

	matchedCTE := "SELECT NULL::uuid AS shop_id, 0 AS n WHERE FALSE"
	relevance := "0::float8"
	if !q.Empty() {
		qn := args.add(q.Normalized)
		var conds []string
		for _, t := range q.Terms {
			cond, _ := termMatchSQL(t, args, false)
			conds = append(conds, cond)
		}
		matchedCTE = fmt.Sprintf(`
			SELECT i.shop_id, COUNT(DISTINCT p.id) AS n
			FROM product_search_documents d
			JOIN products p ON p.id = d.product_id
			JOIN product_variants v ON v.product_id = p.id AND v.status = 'ACTIVE'
			JOIN inventory i ON i.variant_id = v.id AND i.quantity - i.reserved_quantity > 0
			JOIN shops s2 ON s2.id = i.shop_id AND s2.business_id = p.business_id
			WHERE p.publication_status = 'PUBLISHED' AND p.status = 'ACTIVE' AND %s
			GROUP BY i.shop_id`, strings.Join(conds, " AND "))

		var nameWords, nameAny, bizAny, cityAny []string
		for _, t := range q.Terms {
			w := args.add(wordPatterns(t.Exact))
			a := args.add(containsPatterns(t.All()))
			nameWords = append(nameWords, fmt.Sprintf("sn.name LIKE ANY(%s::text[])", w))
			nameAny = append(nameAny, fmt.Sprintf("sn.name LIKE ANY(%s::text[])", a))
			bizAny = append(bizAny, fmt.Sprintf("sn.biz LIKE ANY(%s::text[])", a))
			cityAny = append(cityAny, fmt.Sprintf("sn.city LIKE ANY(%s::text[])", a))
		}
		relevance = fmt.Sprintf(`GREATEST(
			CASE WHEN sn.name = ' ' || %[1]s || ' ' THEN %[2]v ELSE 0 END,
			CASE WHEN sn.name LIKE ' ' || %[1]s || '%%' THEN %[3]v ELSE 0 END,
			CASE WHEN %[4]s THEN %[5]v ELSE 0 END,
			CASE WHEN %[6]s THEN %[7]v ELSE 0 END,
			CASE WHEN %[8]s THEN %[9]v ELSE 0 END,
			CASE WHEN %[10]s THEN %[11]v ELSE 0 END,
			CASE WHEN COALESCE(m.n, 0) > 0 THEN %[12]v + LEAST(ln(1 + m.n) * 10, %[13]v) ELSE 0 END,
			CASE WHEN sn.name %% %[1]s THEN similarity(sn.name, %[1]s) * %[14]v ELSE 0 END
		)::float8`,
			qn, search.ShopTierExactName, search.ShopTierNamePrefix,
			strings.Join(nameWords, " AND "), search.ShopTierNameWords,
			strings.Join(nameAny, " AND "), search.ShopTierNamePartial,
			strings.Join(bizAny, " AND "), search.ShopTierBusinessName,
			strings.Join(cityAny, " AND "), search.ShopTierCity,
			search.ShopTierProducts, search.ShopProductsSpread, search.ShopFuzzyMax)
	}

	limitArg := args.add(limit)
	offsetArg := args.add((page - 1) * limit)
	query := fmt.Sprintf(`
		WITH matched AS (%[1]s),
		base AS (
			SELECT s.id, s.business_id, b.name AS business_name, s.name, s.type, s.city, s.address, s.phone, s.status,
			       COALESCE(sl.name, 'STARTER') AS seller_level,
			       COALESCE(st.trust_status, 'NORMAL') AS seller_trust,
			       s.created_at, COALESCE(m.n, 0) AS matching,
			       %[2]s AS relevance,
			       sl.search_boost, st.cancellation_rate, sra.average_rating, sra.total_reviews,
			       %[3]s AS near_city
			FROM shops s
			JOIN businesses b ON b.id = s.business_id
			CROSS JOIN LATERAL (SELECT ' ' || btmi_normalize_search(s.name) || ' ' AS name,
			                           ' ' || btmi_normalize_search(b.name) || ' ' AS biz,
			                           ' ' || btmi_normalize_search(s.city) || ' ' AS city) sn
			LEFT JOIN matched m ON m.shop_id = s.id
			LEFT JOIN point_accounts pa ON pa.owner_type = 'SELLER_BUSINESS' AND pa.owner_id = s.business_id
			LEFT JOIN seller_levels sl ON sl.id = pa.level_id
			LEFT JOIN seller_trust st ON st.business_id = s.business_id
			LEFT JOIN shop_review_aggregates sra ON sra.shop_id = s.id
			WHERE %[4]s
		), visible AS (
			SELECT * FROM base WHERE %[5]s
		), catalog AS (
			SELECT i.shop_id, COUNT(DISTINCT p.id) AS available_products,
			       COUNT(DISTINCT p.id) FILTER (WHERE EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id = p.id)) AS with_images
			FROM inventory i
			JOIN product_variants v ON v.id = i.variant_id AND v.status = 'ACTIVE'
			JOIN products p ON p.id = v.product_id AND p.publication_status = 'PUBLISHED' AND p.status = 'ACTIVE'
			WHERE i.shop_id IN (SELECT id FROM visible)
			GROUP BY i.shop_id
		), scored AS (
			SELECT v.*, COALESCE(c.available_products, 0) AS product_count,
			       (LEAST(GREATEST(
			           ((COALESCE(v.average_rating, 0) * COALESCE(v.total_reviews, 0) + %[6]v * %[7]v)
			             / (COALESCE(v.total_reviews, 0) + %[7]v) - %[6]v) / (5 - %[6]v), 0), 1) * %[8]v
			        + CASE v.seller_trust WHEN 'TRUSTED' THEN %[9]v WHEN 'LOW' THEN %[10]v WHEN 'SUSPENDED' THEN %[11]v ELSE 0 END
			        + GREATEST(LEAST(COALESCE(v.cancellation_rate, 0), 100) / 100.0 * %[12]v * 2, %[12]v)
			        + LEAST(ln(1 + COALESCE(c.available_products, 0)) * 3
			                + CASE WHEN COALESCE(c.available_products, 0) > 0 THEN c.with_images::float8 / c.available_products * 5 ELSE 0 END, %[13]v)
			        + CASE WHEN v.near_city THEN %[14]v ELSE 0 END
			        + LEAST(GREATEST(COALESCE(v.search_boost, 0), 0), 1) * %[15]v
			       )::float8 AS bonus
			FROM visible v
			LEFT JOIN catalog c ON c.shop_id = v.id
		)
		SELECT id, business_id, business_name, name, type, city, address, phone, status,
		       seller_level, seller_trust, product_count, created_at, matching,
		       relevance, bonus, relevance + bonus AS final_score, COUNT(*) OVER () AS total_count
		FROM scored
		ORDER BY final_score DESC, name ASC, id ASC
		LIMIT %[16]s OFFSET %[17]s`,
		matchedCTE, relevance, near, strings.Join(where, " AND "),
		map[bool]string{true: "TRUE", false: "relevance > 0"}[q.Empty()],
		search.RatingPriorMean, search.RatingPriorWeight, search.ShopBonusRatingMax,
		search.BonusTrusted, search.PenaltyLowTrust, search.PenaltySuspendedTrust,
		search.ShopPenaltyCancelMax, search.ShopBonusCatalogMax, search.BonusNearCity, search.BonusSellerLevelMax,
		limitArg, offsetArg)

	var shops []*models.PublicShopResponse
	total := 0
	err := r.withSearchTx(ctx, false, func(tx *sql.Tx) error {
		rows, err := tx.QueryContext(ctx, query, args.list...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			s := &models.PublicShopResponse{}
			rank := &models.SearchRank{}
			var city, address, phone sql.NullString
			if err := rows.Scan(
				&s.ID, &s.BusinessID, &s.BusinessName, &s.Name, &s.Type, &city, &address, &phone, &s.Status,
				&s.SellerLevel, &s.SellerTrust, &s.ProductCount, &s.CreatedAt, &s.MatchingProducts,
				&rank.Relevance, &rank.Bonus, &rank.Score, &total,
			); err != nil {
				return err
			}
			s.City, s.Address, s.Phone = city.String, address.String, phone.String
			rank.Relevance, rank.Bonus, rank.Score = round2(rank.Relevance), round2(rank.Bonus), round2(rank.Score)
			rank.Tier = search.ShopTierName(rank.Relevance)
			s.SearchRank = rank
			shops = append(shops, s)
		}
		return rows.Err()
	})
	if err != nil {
		return nil, 0, err
	}
	if shops == nil {
		shops = []*models.PublicShopResponse{}
	}
	return shops, total, nil
}

// SuggestTaxonomy returns active categories and subcategories whose name or
// slug matches every query term (synonyms included).
func (r *MarketplaceRepository) SuggestTaxonomy(ctx context.Context, q search.Query, limit int) ([]*models.TaxonomySuggestion, []*models.TaxonomySuggestion, error) {
	if q.Empty() || len(q.Terms) == 0 {
		return []*models.TaxonomySuggestion{}, []*models.TaxonomySuggestion{}, nil
	}
	args := &sqlArgs{}
	var conds []string
	for _, t := range q.Terms {
		conds = append(conds, fmt.Sprintf("x.doc LIKE ANY(%s::text[])", args.add(containsPatterns(t.All()))))
	}
	match := strings.Join(conds, " AND ")
	limitArg := args.add(limit)
	query := fmt.Sprintf(`
		SELECT kind, id, name, slug, category_id, category_name, category_slug FROM (
			SELECT 'category' AS kind, c.id, c.name, c.slug, NULL::uuid AS category_id, '' AS category_name, '' AS category_slug,
			       c.sort_order AS ord, ' ' || btmi_normalize_search(c.name || ' ' || c.slug) || ' ' AS doc
			FROM categories c WHERE COALESCE(c.status, 'ACTIVE') = 'ACTIVE'
			UNION ALL
			SELECT 'subcategory', sc.id, sc.name, sc.slug, c.id, c.name, c.slug,
			       c.sort_order * 1000 + sc.sort_order, ' ' || btmi_normalize_search(sc.name || ' ' || sc.slug) || ' '
			FROM subcategories sc JOIN categories c ON c.id = sc.category_id
			WHERE COALESCE(sc.status, 'ACTIVE') = 'ACTIVE' AND COALESCE(c.status, 'ACTIVE') = 'ACTIVE'
		) x
		WHERE %s
		ORDER BY kind, ord, name, id
		LIMIT %s * 2`, match, limitArg)

	cats := []*models.TaxonomySuggestion{}
	subs := []*models.TaxonomySuggestion{}
	err := r.withSearchTx(ctx, false, func(tx *sql.Tx) error {
		rows, err := tx.QueryContext(ctx, query, args.list...)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var kind string
			s := &models.TaxonomySuggestion{}
			if err := rows.Scan(&kind, &s.ID, &s.Name, &s.Slug, &s.CategoryID, &s.CategoryName, &s.CategorySlug); err != nil {
				return err
			}
			if kind == "category" && len(cats) < limit {
				cats = append(cats, s)
			} else if kind == "subcategory" && len(subs) < limit {
				subs = append(subs, s)
			}
		}
		return rows.Err()
	})
	return cats, subs, err
}

// LoadSearchSynonyms reads the active synonym table.
func (r *MarketplaceRepository) LoadSearchSynonyms() ([]search.SynonymEntry, error) {
	rows, err := r.db.Query(`SELECT term, canonical_term FROM search_synonyms WHERE active`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []search.SynonymEntry
	for rows.Next() {
		var e search.SynonymEntry
		if err := rows.Scan(&e.Term, &e.Canonical); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// SearchLogEntry is one row of search_query_log. It holds no user identity:
// Session is a random id generated by the client per tab/app session.
type SearchLogEntry struct {
	Query           string
	NormalizedQuery string
	SearchType      string
	ResultsCount    int
	MatchMode       string
	ResultIDs       []uuid.UUID
	Filters         map[string]interface{}
	Session         *uuid.UUID
	Duration        time.Duration
	Err             error
}

// LogSearch stores a search and returns its id (uuid.Nil if logging failed;
// logging never fails the search itself).
func (r *MarketplaceRepository) LogSearch(e SearchLogEntry) uuid.UUID {
	var errText interface{}
	if e.Err != nil {
		errText = e.Err.Error()
	}
	filters, _ := json.Marshal(e.Filters)
	if e.Filters == nil {
		filters = []byte("{}")
	}
	var mode interface{}
	if e.MatchMode != "" {
		mode = e.MatchMode
	}
	ids := e.ResultIDs
	if ids == nil {
		ids = []uuid.UUID{}
	}
	var id uuid.UUID
	err := r.db.QueryRow(`INSERT INTO search_query_log
		(query, normalized_query, results_count, search_type, filters, is_zero_result, match_mode,
		 result_ids, client_session, duration_ms, error, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
		RETURNING id`,
		e.Query, e.NormalizedQuery, e.ResultsCount, e.SearchType, filters,
		e.ResultsCount == 0 && e.Err == nil, mode, pq.Array(ids), e.Session,
		int(e.Duration/time.Millisecond), errText).Scan(&id)
	if err != nil {
		return uuid.Nil
	}
	return id
}

// RecordSearchEvent stores a click / add-to-cart for a logged search.
// Duplicates are ignored, and only searches from the last 24 hours accept
// events, which bounds what a replayed id can inflate.
func (r *MarketplaceRepository) RecordSearchEvent(searchID uuid.UUID, eventType, resultType string, resultID uuid.UUID, position *int) (bool, error) {
	res, err := r.db.Exec(`
		INSERT INTO search_query_events (search_log_id, event_type, result_type, result_id, position)
		SELECT id, $2, $3, $4, $5 FROM search_query_log
		WHERE id = $1 AND created_at >= NOW() - INTERVAL '24 hours'
		ON CONFLICT (search_log_id, event_type, result_type, result_id) DO NOTHING`,
		searchID, eventType, resultType, resultID, position)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}
