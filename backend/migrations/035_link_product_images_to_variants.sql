-- Let a Product image belong to a specific Variant so Buyers can see the
-- actual colour/model they select. Images with a NULL variant_id stay
-- Product-wide (shared across every Variant), which preserves existing rows.
ALTER TABLE product_images
    ADD COLUMN variant_id UUID NULL;

ALTER TABLE product_images
    ADD CONSTRAINT fk_product_images_variant
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;

CREATE INDEX idx_product_images_variant_id ON product_images(variant_id);
