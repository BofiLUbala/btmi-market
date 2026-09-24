-- Migration 096: the order number is the one code everyone uses.
-- Date: 2026-09-24
--
-- Buyer, seller, courier and admin all see the order number, the seller prints it on
-- the parcel label, and the courier types it (or scans the label) at the buyer's door
-- to confirm the parcel. A sequential BTMI-1324 is easy to mistype into another real
-- order, so new numbers are BTMI- followed by eight random characters taken from an
-- alphabet without look-alikes (no 0/O, 1/I/L). Existing orders keep their number.

CREATE OR REPLACE FUNCTION tbk_new_order_number() RETURNS text AS $$
DECLARE
    alphabet CONSTANT text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    bytes bytea;
    code text;
BEGIN
    LOOP
        bytes := uuid_send(gen_random_uuid());
        code := 'BTMI-';
        FOR i IN 0..7 LOOP
            code := code || substr(alphabet, 1 + (get_byte(bytes, i) % length(alphabet)), 1);
        END LOOP;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE order_number = code);
    END LOOP;
    RETURN code;
END;
$$ LANGUAGE plpgsql VOLATILE;

