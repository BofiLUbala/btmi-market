-- Reverses migrations/104_marketplace_search_relevance.sql, and also removes
-- what the unreleased draft 101_marketplace_search_relevance.sql created on
-- the local databases where it was applied.
--
-- Run manually, then remove the bookkeeping row so the forward migration can be
-- re-applied later:
--   psql ... -f migrations/rollback/104_marketplace_search_relevance.down.sql
--
-- The application code that queries product_search_documents must be rolled
-- back first (or at the same time), otherwise search requests fail.
-- The unaccent / pg_trgm extensions are left installed: they are harmless and
-- other objects may depend on them.

BEGIN;

DROP TABLE IF EXISTS search_query_events;
-- Leftovers of the draft 101 (no-ops where it never ran).
DROP INDEX IF EXISTS idx_products_search_name_trgm;
DROP INDEX IF EXISTS idx_products_search_sku_trgm;
DROP INDEX IF EXISTS idx_products_marketplace_visibility;
DROP INDEX IF EXISTS idx_variants_search_name_trgm;
DROP INDEX IF EXISTS idx_variants_search_sku_trgm;
DROP INDEX IF EXISTS idx_inventory_search_offer;
DROP INDEX IF EXISTS idx_businesses_search_name_trgm;
DROP INDEX IF EXISTS idx_categories_search_name_trgm;
DROP INDEX IF EXISTS idx_subcategories_search_name_trgm;
ALTER TABLE search_query_log
  DROP COLUMN IF EXISTS converted_at,
  DROP COLUMN IF EXISTS clicked_at,
  DROP COLUMN IF EXISTS selected_result_id,
  DROP COLUMN IF EXISTS selected_result_type;

DROP INDEX IF EXISTS idx_search_query_log_session_created;
DROP INDEX IF EXISTS idx_search_query_log_zero_created;
DROP INDEX IF EXISTS idx_search_query_log_normalized_created;
ALTER TABLE search_query_log
  DROP COLUMN IF EXISTS duration_ms,
  DROP COLUMN IF EXISTS client_session,
  DROP COLUMN IF EXISTS result_ids,
  DROP COLUMN IF EXISTS match_mode,
  DROP COLUMN IF EXISTS is_zero_result,
  DROP COLUMN IF EXISTS filters,
  DROP COLUMN IF EXISTS normalized_query;

DROP INDEX IF EXISTS idx_shops_search_name_trgm;

DROP TRIGGER IF EXISTS trg_search_doc_subcategories ON subcategories;
DROP TRIGGER IF EXISTS trg_search_doc_categories ON categories;
DROP TRIGGER IF EXISTS trg_search_doc_variants ON product_variants;
DROP TRIGGER IF EXISTS trg_search_doc_products ON products;
DROP FUNCTION IF EXISTS btmi_trg_search_doc_taxonomy();
DROP FUNCTION IF EXISTS btmi_trg_search_doc_variants();
DROP FUNCTION IF EXISTS btmi_trg_search_doc_products();
DROP FUNCTION IF EXISTS btmi_refresh_product_search_document(UUID);
DROP TABLE IF EXISTS product_search_documents;

DROP TABLE IF EXISTS search_synonyms;
DROP FUNCTION IF EXISTS btmi_normalize_search(TEXT);
DROP FUNCTION IF EXISTS btmi_unaccent(TEXT);

DO $$
BEGIN
  IF to_regclass('schema_migrations') IS NOT NULL THEN
    DELETE FROM schema_migrations
    WHERE version IN ('104_marketplace_search_relevance.sql', '101_marketplace_search_relevance.sql');
  END IF;
END $$;

COMMIT;
