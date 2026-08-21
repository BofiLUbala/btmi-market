-- Migration 019: Add controlled category system and product publication state

-- Create categories table (controlled taxonomy)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_status ON categories(status);
CREATE INDEX idx_categories_sort ON categories(sort_order);

-- Create subcategories table
CREATE TABLE subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_subcategory_per_category UNIQUE (category_id, slug)
);

CREATE INDEX idx_subcategories_category_id ON subcategories(category_id);
CREATE INDEX idx_subcategories_slug ON subcategories(slug);
CREATE INDEX idx_subcategories_status ON subcategories(status);

-- Add publication_status to products (instead of using inventory status)
-- Use a separate column to avoid breaking existing data
ALTER TABLE products ADD COLUMN publication_status VARCHAR(20) DEFAULT 'PUBLISHED';
CREATE INDEX idx_products_publication_status ON products(publication_status);

-- Add category_id and subcategory_id to products
ALTER TABLE products ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL;
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_subcategory_id ON products(subcategory_id);

-- Seed initial categories
INSERT INTO categories (name, slug, sort_order) VALUES
    ('Fashion', 'fashion', 1),
    ('Children', 'children', 2),
    ('Electronics', 'electronics', 3),
    ('Home', 'home', 4),
    ('Beauty', 'beauty', 5),
    ('Food', 'food', 6),
    ('Sport', 'sport', 7),
    ('Automotive', 'automotive', 8),
    ('Services', 'services', 9);

-- Seed subcategories for Fashion
INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
    ((SELECT id FROM categories WHERE slug = 'fashion'), 'Shoes', 'shoes', 1),
    ((SELECT id FROM categories WHERE slug = 'fashion'), 'Clothing', 'clothing', 2),
    ((SELECT id FROM categories WHERE slug = 'fashion'), 'Bags', 'bags', 3),
    ((SELECT id FROM categories WHERE slug = 'fashion'), 'Accessories', 'accessories', 4);

-- Seed subcategories for Electronics
INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
    ((SELECT id FROM categories WHERE slug = 'electronics'), 'Phones', 'phones', 1),
    ((SELECT id FROM categories WHERE slug = 'electronics'), 'Computers', 'computers', 2),
    ((SELECT id FROM categories WHERE slug = 'electronics'), 'TVs', 'tvs', 3),
    ((SELECT id FROM categories WHERE slug = 'electronics'), 'Accessories', 'accessories', 4);

-- Seed subcategories for Home
INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
    ((SELECT id FROM categories WHERE slug = 'home'), 'Furniture', 'furniture', 1),
    ((SELECT id FROM categories WHERE slug = 'home'), 'Kitchen', 'kitchen', 2),
    ((SELECT id FROM categories WHERE slug = 'home'), 'Decoration', 'decoration', 3);

-- Seed subcategories for Children
INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
    ((SELECT id FROM categories WHERE slug = 'children'), 'Clothing', 'clothing', 1),
    ((SELECT id FROM categories WHERE slug = 'children'), 'Toys', 'toys', 2),
    ((SELECT id FROM categories WHERE slug = 'children'), 'School', 'school', 3),
    ((SELECT id FROM categories WHERE slug = 'children'), 'Baby Products', 'baby-products', 4);

-- Seed subcategories for Sport
INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
    ((SELECT id FROM categories WHERE slug = 'sport'), 'Fitness', 'fitness', 1),
    ((SELECT id FROM categories WHERE slug = 'sport'), 'Outdoor', 'outdoor', 2),
    ((SELECT id FROM categories WHERE slug = 'sport'), 'Team Sports', 'team-sports', 3);

-- Seed subcategories for Beauty
INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
    ((SELECT id FROM categories WHERE slug = 'beauty'), 'Skincare', 'skincare', 1),
    ((SELECT id FROM categories WHERE slug = 'beauty'), 'Makeup', 'makeup', 2),
    ((SELECT id FROM categories WHERE slug = 'beauty'), 'Haircare', 'haircare', 3);

-- Seed subcategories for Food
INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
    ((SELECT id FROM categories WHERE slug = 'food'), 'Beverages', 'beverages', 1),
    ((SELECT id FROM categories WHERE slug = 'food'), 'Snacks', 'snacks', 2),
    ((SELECT id FROM categories WHERE slug = 'food'), 'Bakery', 'bakery', 3);

-- Seed subcategories for Automotive
INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
    ((SELECT id FROM categories WHERE slug = 'automotive'), 'Parts', 'parts', 1),
    ((SELECT id FROM categories WHERE slug = 'automotive'), 'Tires', 'tires', 2),
    ((SELECT id FROM categories WHERE slug = 'automotive'), 'Accessories', 'accessories', 3);

-- Seed subcategories for Services
INSERT INTO subcategories (category_id, name, slug, sort_order) VALUES
    ((SELECT id FROM categories WHERE slug = 'services'), 'Repair', 'repair', 1),
    ((SELECT id FROM categories WHERE slug = 'services'), 'Consulting', 'consulting', 2),
    ((SELECT id FROM categories WHERE slug = 'services'), 'Delivery', 'delivery', 3);
