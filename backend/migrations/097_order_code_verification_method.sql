-- Migration 097: record order-code verifications as their own method.
-- Date: 2026-09-24

-- Typing the order number is its own verification method in the audit trail.
ALTER TABLE product_handover_verifications
    DROP CONSTRAINT IF EXISTS product_handover_verifications_verification_method_check;
ALTER TABLE product_handover_verifications
    ADD CONSTRAINT product_handover_verifications_verification_method_check
    CHECK (verification_method IN ('QR_SCAN', 'MANUAL_PRODUCT_NUMBER', 'MANUAL_ORDER_CODE'));
