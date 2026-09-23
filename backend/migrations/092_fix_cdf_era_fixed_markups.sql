-- Migration 092: repair fixed payment markups entered as CDF amounts
-- Date: 2026-09-23
--
-- Migration 080 switched the platform to USD and labelled every payment-method
-- markup as USD while leaving the amounts untouched. Fixed markups that Finance
-- had typed in francs (7000 for cash on delivery, 1500 for mobile at delivery)
-- were from then on charged as dollars: a $10 order paid in cash came to $7,010.
--
-- Only FIXED markups of $100 or more are touched. No payment fee is meant to be
-- that large, so such a value can only be a franc amount; a markup Finance has
-- already set to a real dollar value is left exactly as it is. Percentage
-- markups are currency-free and are not affected.

UPDATE payment_method_configs
SET markup_value = CASE code
        WHEN 'CASH_ON_DELIVERY' THEN 1.00
        WHEN 'MOBILE_AT_DELIVERY' THEN 0.50
    END,
    markup_currency = 'USD',
    updated_at = NOW()
WHERE markup_type = 'FIXED'
  AND markup_value >= 100
  AND code IN ('CASH_ON_DELIVERY', 'MOBILE_AT_DELIVERY');
