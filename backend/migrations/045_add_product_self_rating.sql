-- Seller-declared "self rating" for a Product, distinct from the buyer-review
-- aggregate in product_review_aggregates. Sellers must pick this when creating
-- a Product; buyers see it labeled as the seller's own claim so it is never
-- confused with a verified review score.
ALTER TABLE products
    ADD COLUMN self_rating SMALLINT
        CHECK (self_rating IS NULL OR self_rating BETWEEN 1 AND 5);

-- Existing products predate this requirement and have no self-declared value.
COMMENT ON COLUMN products.self_rating IS
    'Seller-declared 1-5 star self-rating set at product creation. NULL for products created before this field existed. Not a buyer review — see product_review_aggregates for verified ratings.';
