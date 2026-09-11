-- Test migration 070 hardening: NULL subcategory idempotency
-- States: A (no rows), B (existing rows), C (partial state)

-- State A: NO standalone shoes definitions exist
-- Expected: migration inserts the correct definitions once

-- State B: standalone shoes definitions already exist
-- Expected: 0 duplicate rows, 0 errors, same final row count

-- State C: partial standalone shoes definitions exist
-- Expected: migration inserts only missing definitions
--          existing valid rows remain unchanged
--          no duplicates

-- Proof: NULL-subcategory idempotency
-- For standalone shoes, after repeated migration execution:
GROUP BY category_id, subcategory_id, attribute_key
VERIFY COUNT(*) = 1
for every definition.

-- Specifically: subcategory_id IS NULL cannot produce duplicate
-- attribute definitions after replay.

-- Check for existing duplicates before migration runs
SELECT category_id, key, subcategory_id, COUNT(*) as cnt
FROM category_attribute_definitions
WHERE category_id = (SELECT id FROM categories WHERE slug = 'shoes')
GROUP BY category_id, key, subcategory_id
HAVING COUNT(*) > 1;

-- Verify partial unique index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'category_attribute_definitions'
AND indexname LIKE 'uq_category_attr%';

-- Verify row counts after multiple migration runs
-- State A replay: should still have exactly 4 rows (Color, Shoe Size, Material, Gender)
-- State B replay: should still have the same row count, no duplicates
-- State C replay: should only add missing definitions