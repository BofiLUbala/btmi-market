#!/bin/sh
# Runtime buyer-checkout + payment-journey test (Req 38-58 + 60). Run INSIDE the api container.
# Uses the seeded activated accounts (seller=gauthier2@test.com, buyer=buyer99@test.com).
set -u
BASE=http://localhost:8080/api/v1
STAMP=$(date +%s%N)

PASS=0; FAIL=0
check() {
  if [ "$2" = "1" ]; then echo "[PASS] $1"; PASS=$((PASS+1));
  else echo "[FAIL] $1"; FAIL=$((FAIL+1)); fi
}
jstr() { echo "$1" | sed -n 's/.*"'"$2"'":"\{0,1\}\([^",}]*\)"\{0,1\}.*/\1/p' | head -1; }
jorder() { echo "$1" | sed -n 's/.*"order":{"id":"\([^"]*\)".*/\1/p' | head -1; }
jbool() { echo "$1" | sed -n 's/.*"'"$2"'":\(true\|false\).*/\1/p' | head -1; }
jnum() { echo "$1" | sed -n 's/.*"'"$2"'":\([0-9.]*\).*/\1/p' | head -1; }

api() {
  local url="$BASE$2"
  if [ "$1" = "POST" ]; then
    if [ -n "${4:-}" ]; then
      curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $4" -d "$3" "$url"
    else
      curl -s -X POST -H "Content-Type: application/json" -d "$3" "$url"
    fi
  else
    if [ -n "${4:-}" ]; then
      curl -s -H "Authorization: Bearer $4" "$url"
    else
      curl -s "$url"
    fi
  fi
}

echo "== BUYER_CHECKOUT JOURNEY (Req 38-58 + 60) =="

# --- 1. seller login (activated) ---
RESP=$(api POST /auth/login "{\"email\":\"${SELLER_EMAIL}\",\"password\":\"StrongPassword123!\"}" "")
SELLER_TOKEN=$(jstr "$RESP" access_token)
check "seller login (fresh activated account)" "$([ -n "$SELLER_TOKEN" ] && echo 1 || echo 0)"

# --- 2. seller business/shop/product/variant/stock (reuse seeded if present) ---
RESP=$(api GET /businesses "" "$SELLER_TOKEN")
BIZ=$(jstr "$RESP" id)
if [ -z "$BIZ" ]; then
  RESP=$(api POST /businesses "{\"name\":\"Runtime Biz\",\"business_type\":\"RETAIL\",\"category\":\"Fashion\",\"phone\":\"+243810009001\",\"email\":\"${SELLER_EMAIL}\",\"country\":\"DRC\",\"city\":\"Kinshasa\",\"default_currency\":\"USD\"}" "$SELLER_TOKEN")
  BIZ=$(jstr "$RESP" id)
fi
RESP=$(api GET "/businesses/${BIZ}/shops" "" "$SELLER_TOKEN")
SHOP=$(jstr "$RESP" id)
if [ -z "$SHOP" ]; then
  RESP=$(api POST "/businesses/${BIZ}/shops" "{\"name\":\"Runtime Shop\",\"type\":\"PHYSICAL\",\"city\":\"Kinshasa\",\"address\":\"123 Main\",\"phone\":\"+243820009001\",\"supports_shop_delivery\":true,\"supports_partner_delivery\":false}" "$SELLER_TOKEN")
  SHOP=$(jstr "$RESP" id)
fi
RESP=$(api GET "/businesses/${BIZ}/products" "" "$SELLER_TOKEN")
PROD=$(jstr "$RESP" id)
if [ -z "$PROD" ]; then
  RESP=$(api POST "/businesses/${BIZ}/products" "{\"name\":\"RT Shoes ${STAMP}\",\"sku\":\"RT-${STAMP}\",\"description\":\"t\",\"unit_price\":100.00,\"cost_price\":50.00,\"unit\":\"PCS\",\"self_rating\":5}" "$SELLER_TOKEN")
  echo "DBG create product -> $RESP"
  PROD=$(jstr "$RESP" id)
fi
RESP=$(api GET "/businesses/${BIZ}/products/${PROD}/variants" "" "$SELLER_TOKEN")
VARIANT=$(jstr "$RESP" id)
if [ -z "$VARIANT" ]; then
  RESP=$(api POST "/businesses/${BIZ}/products/${PROD}/variants" "{\"name\":\"Default\",\"attribute_values\":{},\"additional_price\":0.00}" "$SELLER_TOKEN")
  VARIANT=$(jstr "$RESP" id)
fi
RESP=$(api POST "/shops/${SHOP}/stock" "{\"variant_id\":\"${VARIANT}\",\"quantity\":50,\"notes\":\"runtime\"}" "$SELLER_TOKEN")
check "seller has business/shop/product/variant/stock ($BIZ/$SHOP/$PROD/$VARIANT)" "$([ -n "$SHOP" ] && [ -n "$VARIANT" ] && echo 1 || echo 0)"

# --- 3. buyer login (activated) ---
RESP=$(api POST /auth/login "{\"email\":\"${BUYER_EMAIL}\",\"password\":\"StrongPassword123!\"}" "")
BUYER_TOKEN=$(jstr "$RESP" access_token)
check "buyer login (fresh activated account)" "$([ -n "$BUYER_TOKEN" ] && echo 1 || echo 0)"

# --- 4. buyer order create (idempotency, Req44) ---
IDEM="rt-${STAMP}-1"
BODY="{\"shop_id\":\"${SHOP}\",\"items\":[{\"product_id\":\"${PROD}\",\"variant_id\":\"${VARIANT}\",\"quantity\":2}],\"use_points\":false,\"idempotency_key\":\"${IDEM}\"}"
RESP=$(api POST /buyer/orders "$BODY" "$BUYER_TOKEN")
ORDER=$(jorder "$RESP")
RESP2=$(api POST /buyer/orders "$BODY" "$BUYER_TOKEN")
case "$RESP2" in *DUPLICATE_ORDER*) DUP=1;; *) DUP=0;; esac
check "order created, idempotent no-duplicate (Req44): $ORDER" "$([ -n "$ORDER" ] && [ "$DUP" = "1" ] && echo 1 || echo 0)"

# --- 5. delivery options + select PICKUP ---
OPTS=$(api GET "/buyer/orders/${ORDER}/delivery-options" "" "$BUYER_TOKEN")
check "delivery-options OK" "$(echo "$OPTS" | grep -q 'options' && echo 1 || echo 0)"
RESP=$(api POST "/buyer/orders/${ORDER}/delivery" "{\"method\":\"PICKUP\",\"use_points_for_delivery\":false}" "$BUYER_TOKEN")
DETAIL=$(api GET "/buyer/orders/${ORDER}" "" "$BUYER_TOKEN")
DM=$(jstr "$DETAIL" delivery_method)
check "delivery PICKUP selected" "$([ "$DM" = "PICKUP" ] && echo 1 || echo 0)"

# --- 6. buyer list + detail (Req50 filters source) ---
LIST=$(api GET /buyer/orders "" "$BUYER_TOKEN")
check "orders list contains new order" "$([ -n "$ORDER" ] && echo "$LIST" | grep -q "$ORDER" && echo 1 || echo 0)"
STATUS=$(jstr "$DETAIL" status)
check "order detail PENDING (fits A-payer tab)" "$([ "$STATUS" = "PENDING" ] && echo 1 || echo 0)"
LINES=$(echo "$DETAIL" | grep -o 'final_unit_price' | wc -l)
check "order detail has lines" "$([ "$LINES" -ge 1 ] && echo 1 || echo 0)"

# --- 7. create payment (idempotent, Req54) ---
RESP=$(api POST "/buyer/orders/${ORDER}/payment" "{}" "$BUYER_TOKEN")
PAYID=$(jstr "$RESP" id)
PAYID2=$(jstr "$(api POST "/buyer/orders/${ORDER}/payment" "{}" "$BUYER_TOKEN")" id)
check "payment create idempotent (Req54)" "$([ -n "$PAYID" ] && [ "$PAYID" = "$PAYID2" ] && echo 1 || echo 0)"
METHOD=$(jstr "$RESP" payment_method)
check "payment method CASH" "$([ "$METHOD" = "CASH" ] && echo 1 || echo 0)"
PSTATUS=$(jstr "$RESP" status)
check "payment PENDING initially" "$([ "$PSTATUS" = "PENDING" ] && echo 1 || echo 0)"
TOTAL=$(jnum "$RESP" products_final_total); DUE=$(jnum "$RESP" cash_due); CURR=$(jstr "$RESP" currency)
OKP=$([ -n "$TOTAL" ] && [ -n "$DUE" ] && [ -n "$CURR" ] && echo 1 || echo 0); OKP=${OKP:-0}
check "payment pricing fields present (Req40)" "$OKP"
if [ -n "$DUE" ]; then
  AUX=$(awk -v d="$DUE" 'BEGIN{print (d>0 && d<100000)?"1":"0"}')
else AUX=0; fi
check "positive cash_due amount (cash_due=$DUE $CURR)" "$AUX"

# --- 8. get payment has dates (Req45/46) ---
RESP=$(api GET "/buyer/orders/${ORDER}/payment" "" "$BUYER_TOKEN")
CREATED=$(jstr "$RESP" created_at); UPDATED=$(jstr "$RESP" updated_at); PREFS=$(jstr "$RESP" id)
check "GET payment has created_at + updated_at (Req46) [$PREFS]" "$([ -n "$CREATED" ] && [ -n "$UPDATED" ] && echo 1 || echo 0)"

# --- 9. buyer confirm -> CONFIRMED ---
RESP=$(api POST "/buyer/payments/${PAYID}/buyer-confirm" "{}" "$BUYER_TOKEN")
PSTATUS=$(jstr "$RESP" status); BCONF=$(jbool "$RESP" buyer_confirmed); BCAT=$(jstr "$RESP" buyer_confirmed_at)
check "buyer-confirm -> CONFIRMED + buyer_confirmed_at (Req42/47)" "$([ "$PSTATUS" = "CONFIRMED" ] && [ "$BCONF" = "true" ] && [ -n "$BCAT" ] && echo 1 || echo 0)"
RESP=$(api GET "/buyer/orders/${ORDER}/payment" "" "$BUYER_TOKEN")
check "payment status from GET = CONFIRMED (Req47 server authority)" "$([ "$(jstr "$RESP" status)" = "CONFIRMED" ] && echo 1 || echo 0)"

# --- 10. seller confirm -> VERIFIED ---
RESP=$(api POST "/payments/${PAYID}/seller-confirm" "{}" "$SELLER_TOKEN")
PSTATUS=$(jstr "$RESP" status); SCONF=$(jbool "$RESP" seller_confirmed); SCAT=$(jstr "$RESP" seller_confirmed_at); VAT=$(jstr "$RESP" verified_at)
check "seller-confirm -> VERIFIED + timestamps (Req45)" "$([ "$PSTATUS" = "VERIFIED" ] && [ "$SCONF" = "true" ] && [ -n "$SCAT" ] && [ -n "$VAT" ] && echo 1 || echo 0)"

# --- 11. final payment attempt-dates (Req45 timeline) ---
RESP=$(api GET "/buyer/orders/${ORDER}/payment" "" "$BUYER_TOKEN")
BCAT=$(jstr "$RESP" buyer_confirmed_at); SCAT=$(jstr "$RESP" seller_confirmed_at); VAT=$(jstr "$RESP" verified_at)
check "all attempt timestamps present (Req45)" "$([ -n "$BCAT" ] && [ -n "$SCAT" ] && [ -n "$VAT" ] && echo 1 || echo 0)"

# --- 12. security (Req57) ---
RESP=$(api GET "/buyer/orders/${ORDER}" "" "$SELLER_TOKEN")
if [ -z "$RESP" ]; then SEC=1; else case "$RESP" in *'"error"'*) SEC=1;; *) SEC=0;; esac; fi
check "3rd-party token cannot read buyer order (403)" "$SEC"

echo ""
echo "== SUMMARY: ${PASS} PASS / ${FAIL} FAIL =="
[ "$FAIL" = "0" ]