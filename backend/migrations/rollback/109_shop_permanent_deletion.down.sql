-- PostgreSQL cannot drop an enum value; DELETED shops stay valid rows.
ALTER TABLE product_handover_verifications DROP CONSTRAINT IF EXISTS product_handover_verifications_product_id_fkey;
ALTER TABLE product_handover_verifications DROP CONSTRAINT IF EXISTS product_handover_verifications_variant_id_fkey;
ALTER TABLE product_handover_verifications ADD CONSTRAINT product_handover_verifications_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id);
ALTER TABLE product_handover_verifications ADD CONSTRAINT product_handover_verifications_variant_id_fkey
    FOREIGN KEY (variant_id) REFERENCES product_variants(id);
