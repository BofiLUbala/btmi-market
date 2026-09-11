-- Migration 068: Create category attribute definitions table and seed rules from existing hardcoded system

CREATE TABLE IF NOT EXISTS category_attribute_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    subcategory_id UUID REFERENCES subcategories(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    label_en VARCHAR(150) NOT NULL,
    label_fr VARCHAR(150) NOT NULL,
    required BOOLEAN NOT NULL DEFAULT false,
    variant_attribute BOOLEAN NOT NULL DEFAULT false,
    input_type VARCHAR(50) NOT NULL DEFAULT 'TEXT',
    allowed_values JSONB NOT NULL DEFAULT '[]'::jsonb,
    display_order INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_category_subcategory_attr_key UNIQUE (category_id, subcategory_id, key)
);

CREATE INDEX IF NOT EXISTS idx_cat_attr_defs_lookup 
    ON category_attribute_definitions(category_id, subcategory_id, status);

CREATE INDEX IF NOT EXISTS idx_cat_attr_defs_cat 
    ON category_attribute_definitions(category_id);

CREATE INDEX IF NOT EXISTS idx_cat_attr_defs_subcat 
    ON category_attribute_definitions(subcategory_id);

-- =========================================================================
-- SEED ATTRIBUTE DEFINITIONS EXACTLY MATCHING EXISTING CONFIGURATION
-- =========================================================================

-- 1. Fashion (General)
INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Color', 'Color', 'Couleur', true, true, 'TEXT', 1
FROM categories WHERE slug = 'fashion'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Size', 'Size', 'Taille', true, true, 'TEXT', 2
FROM categories WHERE slug = 'fashion'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Material', 'Material', 'Matière', false, false, 'TEXT', 3
FROM categories WHERE slug = 'fashion'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Fit', 'Fit', 'Coupe', false, false, 'TEXT', 4
FROM categories WHERE slug = 'fashion'
ON CONFLICT DO NOTHING;

-- 2. Fashion -> Shoes (Subcategory Specific Override)
INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT c.id, s.id, 'Color', 'Color', 'Couleur', true, true, 'TEXT', 1
FROM categories c
JOIN subcategories s ON s.category_id = c.id
WHERE c.slug = 'fashion' AND s.slug = 'shoes'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT c.id, s.id, 'Shoe Size', 'Shoe Size', 'Pointure', true, true, 'TEXT', 2
FROM categories c
JOIN subcategories s ON s.category_id = c.id
WHERE c.slug = 'fashion' AND s.slug = 'shoes'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT c.id, s.id, 'Material', 'Material', 'Matière', false, false, 'TEXT', 3
FROM categories c
JOIN subcategories s ON s.category_id = c.id
WHERE c.slug = 'fashion' AND s.slug = 'shoes'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT c.id, s.id, 'Gender', 'Gender', 'Genre', false, false, 'TEXT', 4
FROM categories c
JOIN subcategories s ON s.category_id = c.id
WHERE c.slug = 'fashion' AND s.slug = 'shoes'
ON CONFLICT DO NOTHING;

-- 3. Children
INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Age Range', 'Age Range', 'Tranche d''âge', true, false, 'TEXT', 1
FROM categories WHERE slug = 'children'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Size', 'Size', 'Taille', false, true, 'TEXT', 2
FROM categories WHERE slug = 'children'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Color', 'Color', 'Couleur', false, true, 'TEXT', 3
FROM categories WHERE slug = 'children'
ON CONFLICT DO NOTHING;

-- 4. Electronics
INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Model', 'Model', 'Modèle', true, false, 'TEXT', 1
FROM categories WHERE slug = 'electronics'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Storage', 'Storage', 'Stockage', false, true, 'TEXT', 2
FROM categories WHERE slug = 'electronics'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'RAM', 'RAM', 'Mémoire RAM', false, true, 'TEXT', 3
FROM categories WHERE slug = 'electronics'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Capacity', 'Capacity', 'Capacité', false, true, 'TEXT', 4
FROM categories WHERE slug = 'electronics'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Color', 'Color', 'Couleur', false, true, 'TEXT', 5
FROM categories WHERE slug = 'electronics'
ON CONFLICT DO NOTHING;

-- 5. Home
INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Dimensions', 'Dimensions', 'Dimensions', true, false, 'TEXT', 1
FROM categories WHERE slug = 'home'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Material', 'Material', 'Matériau', true, false, 'TEXT', 2
FROM categories WHERE slug = 'home'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Color', 'Color', 'Couleur', false, true, 'TEXT', 3
FROM categories WHERE slug = 'home'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Capacity', 'Capacity', 'Capacité', false, true, 'TEXT', 4
FROM categories WHERE slug = 'home'
ON CONFLICT DO NOTHING;

-- 6. Beauty
INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Shade', 'Shade', 'Teinte', false, true, 'TEXT', 1
FROM categories WHERE slug = 'beauty'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Volume', 'Volume', 'Volume', false, true, 'TEXT', 2
FROM categories WHERE slug = 'beauty'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Scent', 'Scent', 'Parfum', false, true, 'TEXT', 3
FROM categories WHERE slug = 'beauty'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Skin Type', 'Skin Type', 'Type de peau', false, false, 'TEXT', 4
FROM categories WHERE slug = 'beauty'
ON CONFLICT DO NOTHING;

-- 7. Food
INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Expiration Date', 'Expiration Date', 'Date de péremption', true, false, 'DATE', 1
FROM categories WHERE slug = 'food'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Flavor', 'Flavor', 'Saveur', false, true, 'TEXT', 2
FROM categories WHERE slug = 'food'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Weight', 'Weight', 'Poids', false, true, 'TEXT', 3
FROM categories WHERE slug = 'food'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Volume', 'Volume', 'Volume', false, true, 'TEXT', 4
FROM categories WHERE slug = 'food'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Pack Size', 'Pack Size', 'Format / Lot', false, true, 'TEXT', 5
FROM categories WHERE slug = 'food'
ON CONFLICT DO NOTHING;

-- 8. Sport
INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Size', 'Size', 'Taille', false, true, 'TEXT', 1
FROM categories WHERE slug = 'sport'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Weight', 'Weight', 'Poids', false, false, 'TEXT', 2
FROM categories WHERE slug = 'sport'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Color', 'Color', 'Couleur', false, true, 'TEXT', 3
FROM categories WHERE slug = 'sport'
ON CONFLICT DO NOTHING;

-- 9. Automotive
INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Model', 'Model', 'Modèle', false, false, 'TEXT', 1
FROM categories WHERE slug = 'automotive'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Compatibility', 'Compatibility', 'Compatibilité', false, false, 'TEXT', 2
FROM categories WHERE slug = 'automotive'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Capacity', 'Capacity', 'Capacité', false, true, 'TEXT', 3
FROM categories WHERE slug = 'automotive'
ON CONFLICT DO NOTHING;

INSERT INTO category_attribute_definitions (category_id, subcategory_id, key, label_en, label_fr, required, variant_attribute, input_type, display_order)
SELECT id, NULL, 'Size', 'Size', 'Taille / Diamètre', false, true, 'TEXT', 4
FROM categories WHERE slug = 'automotive'
ON CONFLICT DO NOTHING;
