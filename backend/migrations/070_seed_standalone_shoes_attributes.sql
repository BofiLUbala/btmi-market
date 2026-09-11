-- The current taxonomy exposes Shoes as a top-level category. Migration 068
-- only seeded the legacy Fashion -> Shoes subcategory, leaving the active
-- category without authoritative requirements.

-- The table-level unique constraint from migration 068 includes
-- subcategory_id. PostgreSQL treats NULL values as distinct, so that
-- constraint alone does not prevent duplicate category-level definitions.
CREATE UNIQUE INDEX IF NOT EXISTS uq_category_attr_key_no_subcategory
    ON category_attribute_definitions(category_id, key)
    WHERE subcategory_id IS NULL;

INSERT INTO category_attribute_definitions
    (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Color', 'Color', 'Couleur', true, true, 'TEXT', 1
FROM categories
WHERE slug = 'shoes'
ON CONFLICT (category_id, key) WHERE subcategory_id IS NULL DO NOTHING;

INSERT INTO category_attribute_definitions
    (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Shoe Size', 'Shoe Size', 'Pointure', true, true, 'TEXT', 2
FROM categories
WHERE slug = 'shoes'
ON CONFLICT (category_id, key) WHERE subcategory_id IS NULL DO NOTHING;

INSERT INTO category_attribute_definitions
    (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Material', 'Material', 'Matière', false, false, 'TEXT', 3
FROM categories
WHERE slug = 'shoes'
ON CONFLICT (category_id, key) WHERE subcategory_id IS NULL DO NOTHING;

INSERT INTO category_attribute_definitions
    (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Gender', 'Gender', 'Genre', false, false, 'TEXT', 4
FROM categories
WHERE slug = 'shoes'
ON CONFLICT (category_id, key) WHERE subcategory_id IS NULL DO NOTHING;
