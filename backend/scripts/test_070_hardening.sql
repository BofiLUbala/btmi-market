-- Test migration 070 hardening: NULL subcategory idempotency.
-- Run manually against PostgreSQL, NOT auto-applied (a verification script,
-- not a migration, so it must never live in backend/migrations/).
--
-- States: A (no rows), B (existing rows), C (partial state).

-- State A: NO standalone shoes definitions exist
-- Expected: migration inserts the correct definitions once.

-- State B: standalone shoes definitions already exist
-- Expected: 0 duplicate rows, 0 errors, same final row count.

-- State C: partial standalone shoes definitions exist
-- Expected: migration inserts only missing definitions, existing valid rows
-- remain unchanged, no duplicates.

-- Proof: NULL-subcategory idempotency.
-- For standalone shoes, after repeated migration execution, every
-- (category_id, subcategory_id IS NULL, key) group must have COUNT(*) = 1.

-- 1. Existing duplicates (before migration) — report, do not modify.
SELECT category_id, key, subcategory_id, COUNT(*) AS cnt
FROM category_attribute_definitions
WHERE category_id = (SELECT id FROM categories WHERE slug = 'shoes')
GROUP BY category_id, key, subcategory_id
HAVING COUNT(*) > 1;

-- 2. Partial unique index must exist after migration 070.
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'category_attribute_definitions'
  AND indexname = 'uq_category_attr_key_no_subcategory';

-- 3. Idempotency after replay: every NULL-subcategory (category_id, key) has
-- exactly one row.
SELECT category_id, key, subcategory_id, COUNT(*) AS cnt
FROM category_attribute_definitions
WHERE category_id = (SELECT id FROM categories WHERE slug = 'shoes')
  AND subcategory_id IS NULL
GROUP BY category_id, key, subcategory_id
HAVING COUNT(*) <> 1;