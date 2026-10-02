-- Migration 109: permanent shop deletion.
-- Date: 2026-10-01
--
-- A permanently deleted shop that still carries order or payment history
-- cannot lose its row (orders.shop_id cascades, payments/commissions/
-- verified transactions reference it for legal retention). It becomes a
-- DELETED tombstone: no products, stock, staff or contact data, hidden from
-- every seller and admin list, kept only so past orders stay readable.
ALTER TYPE shop_status ADD VALUE IF NOT EXISTS 'DELETED';

-- Handover verifications are order history: like order_lines (migration 081)
-- they must survive the deletion of the product they describe.
ALTER TABLE product_handover_verifications DROP CONSTRAINT IF EXISTS product_handover_verifications_product_id_fkey;
ALTER TABLE product_handover_verifications DROP CONSTRAINT IF EXISTS product_handover_verifications_variant_id_fkey;
ALTER TABLE product_handover_verifications ADD CONSTRAINT product_handover_verifications_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE product_handover_verifications ADD CONSTRAINT product_handover_verifications_variant_id_fkey
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;

