#!/bin/sh
# Runtime checkout test: structured RDC address + Finance-driven payment markup.
# Usage: sh scripts/test_checkout_address_payment.sh
set -u
BASE=${BASE:-http://localhost:8080/api/v1}
SELLER_EMAIL=${SELLER_EMAIL:-seller_rt_1789261221@test.com}
BUYER_EMAIL=${BUYER_EMAIL:-buyer_rt_1789261221@test.com}
PASSWORD=${PASSWORD:-StrongPassword123!}
STAMP=$(date +%s)

PASS=0; FAIL=0
check() { if [ "$2" = "1" ]; then echo "[PASS] $1"; PASS=$((PASS+1)); else echo "[FAIL] $1"; FAIL=$((FAIL+1)); fi; }
# Responses are wrapped as {"message":..,"data":..}; unwrap before reading.
jq_() { python -c "import sys,json;r=json.load(sys.stdin);d=r.get('data',r) if isinstance(r,dict) else r;print($1)" 2>/dev/null; }

api() { # METHOD PATH BODY TOKEN
  if [ "$1" = "GET" ]; then curl -s -H "Authorization: Bearer ${4:-}" "$BASE$2";
  else curl -s -X "$1" -H "Content-Type: application/json" -H "Authorization: Bearer ${4:-}" -d "$3" "$BASE$2"; fi
}

echo "== 0. auth =="
SELLER_TOKEN=$(api POST /auth/login "{\"email\":\"$SELLER_EMAIL\",\"password\":\"$PASSWORD\"}" "" | jq_ "d['access_token']")
BUYER_TOKEN=$(api POST /auth/login "{\"email\":\"$BUYER_EMAIL\",\"password\":\"$PASSWORD\"}" "" | jq_ "d['access_token']")
check "seller + buyer logged in" "$([ -n "$SELLER_TOKEN" ] && [ -n "$BUYER_TOKEN" ] && echo 1 || echo 0)"

echo "== 1. location hierarchy =="
PROVINCES=$(curl -s "$BASE/locations/provinces")
PROV_COUNT=$(echo "$PROVINCES" | jq_ "len(d['items'])")
KIN_ID=$(echo "$PROVINCES" | jq_ "[x['id'] for x in d['items'] if x['name']=='Kinshasa'][0]")
HK_ID=$(echo "$PROVINCES" | jq_ "[x['id'] for x in d['items'] if x['name']=='Haut-Katanga'][0]")
check "provinces from DB (count=$PROV_COUNT, not Kinshasa-only)" "$([ "${PROV_COUNT:-0}" -ge 20 ] && echo 1 || echo 0)"
KIN_CITY=$(curl -s "$BASE/locations/provinces/$KIN_ID/cities" | jq_ "d['items'][0]['id']")
LSHI_CITY=$(curl -s "$BASE/locations/provinces/$HK_ID/cities" | jq_ "[x['id'] for x in d['items'] if x['name']=='Lubumbashi'][0]")
COMMUNES=$(curl -s "$BASE/locations/cities/$KIN_CITY/communes")
GOMBE=$(echo "$COMMUNES" | jq_ "[x['id'] for x in d['items'] if x['name']=='Gombe'][0]")
CCOUNT=$(echo "$COMMUNES" | jq_ "len(d['items'])")
check "cities depend on province, communes depend on city (Kinshasa communes=$CCOUNT)" "$([ "${CCOUNT:-0}" = "24" ] && [ -n "$GOMBE" ] && echo 1 || echo 0)"

echo "== 2. seller catalogue =="
BIZ=$(api GET /businesses "" "$SELLER_TOKEN" | jq_ "d[0]['id']")
SHOP=$(api GET "/businesses/$BIZ/shops" "" "$SELLER_TOKEN" | jq_ "d[0]['id']")
PROD=$(api GET "/businesses/$BIZ/products" "" "$SELLER_TOKEN" | jq_ "d[0]['id']")
VARIANT=$(api GET "/businesses/$BIZ/products/$PROD/variants" "" "$SELLER_TOKEN" | jq_ "d[0]['id']")
api POST "/shops/$SHOP/stock" "{\"variant_id\":\"$VARIANT\",\"quantity\":50,\"notes\":\"runtime\"}" "$SELLER_TOKEN" > /dev/null
check "seller catalogue ready ($SHOP / $VARIANT)" "$([ -n "$SHOP" ] && [ -n "$VARIANT" ] && echo 1 || echo 0)"

new_order() {
  api POST /buyer/orders "{\"shop_id\":\"$SHOP\",\"items\":[{\"product_id\":\"$PROD\",\"variant_id\":\"$VARIANT\",\"quantity\":1}],\"use_points\":false,\"idempotency_key\":\"chk-$STAMP-$1\"}" "$BUYER_TOKEN" | jq_ "d['order']['id']"
}
select_delivery() { # ORDER PROV CITY COMMUNE
  api POST "/buyer/orders/$1/delivery" "{\"method\":\"TBK_STANDARD\",\"use_points_for_delivery\":false,\"contact_name\":\"Runtime Buyer\",\"phone\":\"+243810000001\",\"province_id\":\"$2\",\"city_id\":\"$3\",\"commune_id\":\"$4\",\"street\":\"Avenue des Aviateurs\",\"building_number\":\"25\",\"landmark\":\"Portail bleu, appeler a l arrivee\"}" "$BUYER_TOKEN"
}

echo "== 3. structured address persistence (A) =="
ORDER=$(new_order a)
DSEL=$(select_delivery "$ORDER" "$KIN_ID" "$KIN_CITY" "$GOMBE")
SUM_COMMUNE=$(echo "$DSEL" | jq_ "d['delivery']['commune']")
check "delivery accepted with hierarchy ids (commune=$SUM_COMMUNE)" "$([ "$SUM_COMMUNE" = "Gombe" ] && echo 1 || echo 0)"

echo "== 4. cross-hierarchy address rejected =="
BADORDER=$(new_order bad)
BAD=$(select_delivery "$BADORDER" "$KIN_ID" "$LSHI_CITY" "$GOMBE")
case "$BAD" in *INVALID_DELIVERY_LOCATION*) OK=1;; *) OK=0;; esac
check "commune of another city refused" "$OK"

echo "== 5. quote per payment method (B/C/D) =="
QUOTE=$(api GET "/buyer/orders/$ORDER/checkout-quote" "" "$BUYER_TOKEN")
echo "$QUOTE" | python -c "import sys,json;d=json.load(sys.stdin)['data'];[print('   ',m['code'],m['markup_type'],m['markup_value'],'-> markup',m['markup_amount'],'total',m['quoted_total']) for m in d['payment_methods']];print('    subtotal',d['subtotal'],'delivery',d['delivery_fee'],'final',d['final_total'])"
METHODS=$(echo "$QUOTE" | jq_ "len(d['payment_methods'])")
check "quote lists DB-driven enabled methods (count=$METHODS)" "$([ "${METHODS:-0}" -ge 1 ] && echo 1 || echo 0)"

for CODE in CASH_ON_DELIVERY MOBILE_PAY_NOW MOBILE_AT_DELIVERY; do
  Q=$(api GET "/buyer/orders/$ORDER/checkout-quote?payment_method=$CODE" "" "$BUYER_TOKEN")
  SEL=$(echo "$Q" | jq_ "d['selected_payment_method']")
  MK=$(echo "$Q" | jq_ "d['payment_markup']")
  TOT=$(echo "$Q" | jq_ "d['final_total']")
  if [ "$SEL" = "$CODE" ]; then echo "   $CODE -> markup=$MK total=$TOT"; fi
done

echo "== 6. Finance configures markups =="
echo "(configured out-of-band by the caller before this script for full coverage)"

echo "== 7. create payment snapshot (B) =="
PAY=$(api POST "/buyer/orders/$ORDER/payment" "{\"payment_method\":\"CASH_ON_DELIVERY\"}" "$BUYER_TOKEN")
PSTATUS=$(echo "$PAY" | jq_ "d['status']")
PMK=$(echo "$PAY" | jq_ "d['payment_markup']")
PMT=$(echo "$PAY" | jq_ "d['payment_markup_type']")
PMV=$(echo "$PAY" | jq_ "d['payment_markup_value']")
PFT=$(echo "$PAY" | jq_ "d['final_total']")
echo "   status=$PSTATUS markup=$PMK type=$PMT value=$PMV final=$PFT"
check "cash on delivery is NOT paid (status=$PSTATUS)" "$([ "$PSTATUS" = "DUE" ] && echo 1 || echo 0)"
check "markup rule snapshotted on the payment (type=$PMT value=$PMV)" "$([ -n "$PMT" ] && echo 1 || echo 0)"

echo
echo "ORDER_ID=$ORDER"
echo "PASS=$PASS FAIL=$FAIL"
