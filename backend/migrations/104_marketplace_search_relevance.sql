-- Marketplace search relevance.
--
-- * btmi_normalize_search(): lower case, accents removed, punctuation folded.
--   Mirrors search.Normalize() in backend/internal/search/normalize.go.
-- * search_synonyms: admin-editable synonym groups (no synonyms in SQL code).
-- * product_search_documents: one pre-normalized search document per product,
--   kept current by triggers, with trigram GIN indexes so a query is an index
--   lookup instead of normalizing every catalog row on every search.
-- * search_query_log gains the normalized query, filters, result ids and a
--   random per-tab session id; search_query_events records clicks and
--   add-to-cart coming from a search. No user id, IP or device is stored.
--
-- Rollback: migrations/rollback/104_marketplace_search_relevance.down.sql
-- (kept outside this directory's top level so the runner never applies it).
--
-- Numbered 104 rather than 101: an early draft named 101_marketplace_search_
-- relevance.sql was applied to some local databases, and the runner tracks
-- migrations by file name. Everything below is idempotent, so it applies
-- cleanly with or without that draft.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- unaccent() is STABLE because its dictionary can be swapped. Pinning the
-- dictionary makes the result deterministic, which expression indexes need.
CREATE OR REPLACE FUNCTION public.btmi_unaccent(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, COALESCE(value, '')) $$;

CREATE OR REPLACE FUNCTION public.btmi_normalize_search(value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT trim(regexp_replace(lower(public.btmi_unaccent(COALESCE(value, ''))), '[^[:alnum:]]+', ' ', 'g'));
$$;

-- ---------------------------------------------------------------------------
-- Synonyms: every term belongs to one group named by canonical_term. Terms are
-- stored normalized and singular; the query analyzer folds plurals first.
-- The taxonomy is stored in English, so French words are grouped with the
-- English category words ("telephone" finds the "Phones" subcategory).
CREATE TABLE IF NOT EXISTS search_synonyms (
  term TEXT PRIMARY KEY,
  canonical_term TEXT NOT NULL,
  language_code VARCHAR(12) NOT NULL DEFAULT 'fr',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT search_synonyms_term_normalized CHECK (term <> '' AND term = btmi_normalize_search(term)),
  CONSTRAINT search_synonyms_canonical_normalized CHECK (canonical_term <> '' AND canonical_term = btmi_normalize_search(canonical_term))
);
CREATE INDEX IF NOT EXISTS idx_search_synonyms_canonical ON search_synonyms (canonical_term) WHERE active;

INSERT INTO search_synonyms (term, canonical_term, language_code) VALUES
  ('telephone', 'telephone', 'fr'), ('smartphone', 'telephone', 'fr'), ('portable', 'telephone', 'fr'),
  ('phone', 'telephone', 'en'), ('mobile', 'telephone', 'fr'), ('gsm', 'telephone', 'fr'),
  ('ordinateur', 'ordinateur', 'fr'), ('ordi', 'ordinateur', 'fr'), ('laptop', 'ordinateur', 'en'),
  ('pc', 'ordinateur', 'fr'), ('computer', 'ordinateur', 'en'), ('notebook', 'ordinateur', 'en'),
  ('chaussure', 'chaussure', 'fr'), ('basket', 'chaussure', 'fr'), ('sneaker', 'chaussure', 'en'),
  ('shoe', 'chaussure', 'en'), ('soulier', 'chaussure', 'fr'),
  ('refrigerateur', 'refrigerateur', 'fr'), ('frigo', 'refrigerateur', 'fr'),
  ('frigidaire', 'refrigerateur', 'fr'), ('fridge', 'refrigerateur', 'en'),
  ('television', 'television', 'fr'), ('tv', 'television', 'fr'), ('televiseur', 'television', 'fr'),
  ('tele', 'television', 'fr')
ON CONFLICT (term) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Search documents. Every column is normalized and padded with one space on
-- each side, so " word " and "% word%" patterns express whole-word and
-- word-prefix matches without regular expressions.
--
-- Shop and business names are deliberately NOT in the documents: a shop named
-- "Chez Mama Chaussures" would make every product it sells match "chaussures".
-- The search matches seller names at query time instead (see
-- repository/marketplace_search.go), so no trigger on shops/businesses is needed.
-- Visibility (publication, status, stock, shop and business status) is never
-- stored here; it is always checked live against the source tables.
CREATE TABLE IF NOT EXISTS product_search_documents (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  name_norm TEXT NOT NULL DEFAULT ' ',
  sku_norm TEXT NOT NULL DEFAULT ' ',          -- product SKU, variant SKUs and barcodes
  attrs_norm TEXT NOT NULL DEFAULT ' ',        -- variant names and attribute values
  taxonomy_norm TEXT NOT NULL DEFAULT ' ',     -- category / subcategory names and slugs
  description_norm TEXT NOT NULL DEFAULT ' ',  -- first 2000 characters of the description
  all_norm TEXT NOT NULL DEFAULT ' ',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION btmi_refresh_product_search_document(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_product_id IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product_id) THEN
    DELETE FROM product_search_documents WHERE product_id = p_product_id;
    RETURN;
  END IF;

  INSERT INTO product_search_documents AS d
    (product_id, name_norm, sku_norm, attrs_norm, taxonomy_norm, description_norm, all_norm, updated_at)
  SELECT src.id,
         ' ' || src.name_n || ' ', ' ' || src.sku_n || ' ', ' ' || src.attrs_n || ' ',
         ' ' || src.tax_n || ' ', ' ' || src.desc_n || ' ',
         ' ' || concat_ws(' ', NULLIF(src.name_n, ''), NULLIF(src.sku_n, ''), NULLIF(src.attrs_n, ''),
                          NULLIF(src.tax_n, ''), NULLIF(src.desc_n, '')) || ' ',
         NOW()
  FROM (
    SELECT p.id,
           btmi_normalize_search(p.name) AS name_n,
           btmi_normalize_search(concat_ws(' ', p.sku, v.skus)) AS sku_n,
           btmi_normalize_search(v.attrs) AS attrs_n,
           btmi_normalize_search(concat_ws(' ', c.name, c.slug, sc.name, sc.slug)) AS tax_n,
           btmi_normalize_search(left(p.description, 2000)) AS desc_n
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
    LEFT JOIN LATERAL (
      SELECT string_agg(concat_ws(' ', pv.sku, pv.barcode), ' ') AS skus,
             string_agg(concat_ws(' ', pv.name,
               CASE WHEN jsonb_typeof(pv.attributes) = 'object'
                    THEN (SELECT string_agg(a.value, ' ') FROM jsonb_each_text(pv.attributes) a) END), ' ') AS attrs
      FROM product_variants pv
      WHERE pv.product_id = p.id AND pv.status = 'ACTIVE'
    ) v ON TRUE
    WHERE p.id = p_product_id
  ) src
  ON CONFLICT (product_id) DO UPDATE SET
    name_norm = EXCLUDED.name_norm, sku_norm = EXCLUDED.sku_norm, attrs_norm = EXCLUDED.attrs_norm,
    taxonomy_norm = EXCLUDED.taxonomy_norm,
    description_norm = EXCLUDED.description_norm, all_norm = EXCLUDED.all_norm, updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION btmi_trg_search_doc_products() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM btmi_refresh_product_search_document(NEW.id);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION btmi_trg_search_doc_variants() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM btmi_refresh_product_search_document(OLD.product_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP = 'INSERT' OR NEW.product_id IS DISTINCT FROM OLD.product_id) THEN
    PERFORM btmi_refresh_product_search_document(NEW.product_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION btmi_trg_search_doc_taxonomy() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'categories' THEN
    PERFORM btmi_refresh_product_search_document(p.id) FROM products p WHERE p.category_id = NEW.id;
  ELSE
    PERFORM btmi_refresh_product_search_document(p.id) FROM products p WHERE p.subcategory_id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_search_doc_products ON products;
CREATE TRIGGER trg_search_doc_products
  AFTER INSERT OR UPDATE OF name, sku, description, category_id, subcategory_id, business_id ON products
  FOR EACH ROW EXECUTE FUNCTION btmi_trg_search_doc_products();

DROP TRIGGER IF EXISTS trg_search_doc_variants ON product_variants;
CREATE TRIGGER trg_search_doc_variants
  AFTER INSERT OR UPDATE OF product_id, name, sku, barcode, attributes, status OR DELETE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION btmi_trg_search_doc_variants();

DROP TRIGGER IF EXISTS trg_search_doc_categories ON categories;
CREATE TRIGGER trg_search_doc_categories
  AFTER UPDATE OF name, slug ON categories
  FOR EACH ROW WHEN (OLD.name IS DISTINCT FROM NEW.name OR OLD.slug IS DISTINCT FROM NEW.slug)
  EXECUTE FUNCTION btmi_trg_search_doc_taxonomy();

DROP TRIGGER IF EXISTS trg_search_doc_subcategories ON subcategories;
CREATE TRIGGER trg_search_doc_subcategories
  AFTER UPDATE OF name, slug ON subcategories
  FOR EACH ROW WHEN (OLD.name IS DISTINCT FROM NEW.name OR OLD.slug IS DISTINCT FROM NEW.slug)
  EXECUTE FUNCTION btmi_trg_search_doc_taxonomy();

-- Backfill existing products.
SELECT btmi_refresh_product_search_document(id) FROM products;

CREATE INDEX IF NOT EXISTS idx_product_search_all_trgm ON product_search_documents USING GIN (all_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_product_search_name_trgm ON product_search_documents USING GIN (name_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_product_search_sku_trgm ON product_search_documents USING GIN (sku_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_shops_search_name_trgm ON shops USING GIN (btmi_normalize_search(name) gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Analytics.
ALTER TABLE search_query_log
  ADD COLUMN IF NOT EXISTS normalized_query TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_zero_result BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS match_mode VARCHAR(20),
  ADD COLUMN IF NOT EXISTS result_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS client_session UUID,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

CREATE INDEX IF NOT EXISTS idx_search_query_log_normalized_created ON search_query_log (normalized_query, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_query_log_zero_created ON search_query_log (created_at DESC) WHERE is_zero_result;
CREATE INDEX IF NOT EXISTS idx_search_query_log_session_created ON search_query_log (client_session, created_at) WHERE client_session IS NOT NULL;

CREATE TABLE IF NOT EXISTS search_query_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_log_id UUID NOT NULL REFERENCES search_query_log(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('CLICK', 'ADD_TO_CART')),
  result_type VARCHAR(20) NOT NULL CHECK (result_type IN ('PRODUCT', 'SHOP', 'CATEGORY', 'SUBCATEGORY')),
  result_id UUID NOT NULL,
  position INTEGER CHECK (position IS NULL OR position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (search_log_id, event_type, result_type, result_id)
);
CREATE INDEX IF NOT EXISTS idx_search_query_events_created ON search_query_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_query_events_result ON search_query_events (result_type, result_id);
