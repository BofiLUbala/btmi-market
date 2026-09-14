#!/bin/sh
# Finance-owned payment markup: configure each method, verify the checkout quote
# follows PostgreSQL, and verify an existing order keeps its own snapshot.
set -u
BASE=${BASE:-http://localhost:8080/api/v1}
ADMIN_EMAIL=${ADMIN_EMAIL:-finance.runtime@tbk.test}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-FinanceRuntime123!}
BUYER_EMAIL=${BUYER_EMAIL:-buyer_rt_1789261221@test.com}
SELLER_EMAIL=${SELLER_EMAIL:-seller_rt_1789261221@test.com}
PASSWORD=${PASSWORD:-StrongPassword123!}
STAMP=$(date +%s)

PASS=0; FAIL=0
num_eq() { python -c "print(1 if abs(float('$1')-float('$2'))<0.01 else 0)"; }
check() { if [ "$2" = "1" ]; then echo "[PASS] $1"; PASS=$((PASS+1)); else echo "[FAIL] $1"; FAIL=$((FAIL+1)); fi; }
jq_() { python -c "import sys,json;r=json.load(sys.stdin);d=r.get('data',r) if isinstance(r,dict) else r;print($1)" 2>/dev/null; }
api() {
  if [ "$1" = "GET" ]; then curl -s -H "Authorization: Bearer ${4:-}" "$BASE$2";
  else curl -s -X "$1" -H "Content-Type: application/json" -H "Authorization: Bearer ${4:-}" -d "$3" "$BASE$2"; fi
}

ADMIN=$(api POST /admin/auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" "" | jq_ "d['access_token']")
BUYER=$(api POST /auth/login "{\"email\":\"$BUYER_EMAIL\",\"password\":\"$PASSWORD\"}" "" | jq_ "d['access_token']")
SELLER=$(api POST /auth/login "{\"email\":\"$SELLER_EMAIL\",\"password\":\"$PASSWORD\"}" "" | jq_ "d['access_token']")
check "finance admin + buyer logged in" "$([ -n "$ADMIN" ] && [ -n "$BUYER" ] && echo 1 || echo 0)"

# Keeps the stored label untouched: the label is accented French and a shell
# round-trip would mangle it. Only the markup rule is under test here.
set_markup() { # CODE ENABLED TYPE VALUE PROVIDER
  api GET /admin/finance/payment-config "" "$ADMIN" | python -c "
import sys,json,urllib.request
r=json.load(sys.stdin); items=(r.get('data',r))['items']
cfg=[m for m in items if m['code']=='$1'][0]
body=json.dumps({'label':cfg['label'],'enabled':'$2'=='true','markup_type':'$3','markup_value':$4,'provider':'$5'}).encode()
req=urllib.request.Request('$BASE/admin/finance/payment-config/$1', data=body, method='PATCH',
  headers={'Content-Type':'application/json','Authorization':'Bearer $ADMIN'})
urllib.request.urlopen(req).read()
"
}

echo "== Finance configures the three methods =="
set_markup CASH_ON_DELIVERY true FIXED 3000 ""
set_markup MOBILE_AT_DELIVERY true FIXED 1500 ""
set_markup MOBILE_PAY_NOW true PERCENTAGE 2 "TBK_MOBILE_SANDBOX"
api GET /admin/finance/payment-config "" "$ADMIN" | python -c "import sys,json;[print('   ',m['code'],m['enabled'],m['markup_type'],m['markup_value']) for m in (lambda r: r.get('data',r))(json.load(sys.stdin))['items']]"

BIZ=$(api GET /businesses "" "$SELLER" | jq_ "d[0]['id']")
SHOP=$(api GET "/businesses/$BIZ/shops" "" "$SELLER" | jq_ "d[0]['id']")
PROD=$(api GET "/businesses/$BIZ/products" "" "$SELLER" | jq_ "d[0]['id']")
VARIANT=$(api GET "/businesses/$BIZ/products/$PROD/variants" "" "$SELLER" | jq_ "d[0]['id']")
api POST "/shops/$SHOP/stock" "{\"variant_id\":\"$VARIANT\",\"quantity\":50,\"notes\":\"runtime\"}" "$SELLER" > /dev/null

PROVINCES=$(curl -s "$BASE/locations/provinces")
KIN=$(echo "$PROVINCES" | jq_ "[x['id'] for x in d['items'] if x['name']=='Kinshasa'][0]")
CITY=$(curl -s "$BASE/locations/provinces/$KIN/cities" | jq_ "d['items'][0]['id']")
GOMBE=$(curl -s "$BASE/locations/cities/$CITY/communes" | jq_ "[x['id'] for x in d['items'] if x['name']=='Gombe'][0]")

mk_order() {
  OID=$(api POST /buyer/orders "{\"shop_id\":\"$SHOP\",\"items\":[{\"product_id\":\"$PROD\",\"variant_id\":\"$VARIANT\",\"quantity\":1}],\"use_points\":false,\"idempotency_key\":\"fin-$STAMP-$1\"}" "$BUYER" | jq_ "d['order']['id']")
  api POST "/buyer/orders/$OID/delivery" "{\"method\":\"TBK_STANDARD\",\"use_points_for_delivery\":false,\"contact_name\":\"Runtime Buyer\",\"phone\":\"+243810000001\",\"province_id\":\"$KIN\",\"city_id\":\"$CITY\",\"commune_id\":\"$GOMBE\",\"street\":\"Avenue des Aviateurs\",\"building_number\":\"25\",\"landmark\":\"Portail bleu\"}" "$BUYER" > /dev/null
  echo "$OID"
}

echo "== Server quote per method (C/D/E) =="
ORDER=$(mk_order 1)
for CODE in CASH_ON_DELIVERY MOBILE_AT_DELIVERY MOBILE_PAY_NOW; do
  Q=$(api GET "/buyer/orders/$ORDER/checkout-quote?payment_method=$CODE" "" "$BUYER")
  eval "$(echo "$Q" | python -c "import sys,json;d=json.load(sys.stdin)['data'];print('SEL=%s;MK=%s;TOT=%s;SUB=%s;DEL=%s'%(d['selected_payment_method'],d['payment_markup'],d['final_total'],d['subtotal'],d['delivery_fee']))")"
  echo "   $CODE -> subtotal=$SUB delivery=$DEL markup=$MK total=$TOT"
  eval "MK_$CODE=$MK; TOT_$CODE=$TOT"
done
check "cash markup = Finance value 3000" "$(num_eq "$MK_CASH_ON_DELIVERY" 3000)"
check "mobile-at-delivery has its OWN markup 1500" "$(num_eq "$MK_MOBILE_AT_DELIVERY" 1500)"
check "pay-now markup is 2% of base (=$MK_MOBILE_PAY_NOW)" "$(python -c "print(1 if abs($MK_MOBILE_PAY_NOW-0.02*($TOT_MOBILE_PAY_NOW-$MK_MOBILE_PAY_NOW))<0.01 else 0)")"
check "totals differ per method (E: switching refreshes the total)" "$([ "$TOT_CASH_ON_DELIVERY" != "$TOT_MOBILE_AT_DELIVERY" ] && [ "$TOT_MOBILE_AT_DELIVERY" != "$TOT_MOBILE_PAY_NOW" ] && echo 1 || echo 0)"

echo "== Order snapshot (14) =="
PAY=$(api POST "/buyer/orders/$ORDER/payment" "{\"payment_method\":\"CASH_ON_DELIVERY\"}" "$BUYER")
eval "$(echo "$PAY" | python -c "import sys,json;d=json.load(sys.stdin)['data'];print('PST=%s;PMK=%s;PMT=%s;PMV=%s;PFT=%s'%(d['status'],d['payment_markup'],d['payment_markup_type'],d['payment_markup_value'],d['final_total']))")"
echo "   status=$PST markup=$PMK type=$PMT value=$PMV total=$PFT"
check "CASH_ON_DELIVERY order is DUE, not PAID (15)" "$([ "$PST" = "DUE" ] && echo 1 || echo 0)"
check "snapshot keeps FIXED/3000 (14)" "$([ "$PMT" = "FIXED" ] && [ "$(num_eq "$PMV" 3000)" = "1" ] && [ "$(num_eq "$PMK" 3000)" = "1" ] && echo 1 || echo 0)"

echo "== Finance changes the markup afterwards (22) =="
set_markup CASH_ON_DELIVERY true FIXED 7000 ""
NEWORDER=$(mk_order 2)
NEWMK=$(api GET "/buyer/orders/$NEWORDER/checkout-quote?payment_method=CASH_ON_DELIVERY" "" "$BUYER" | jq_ "d['payment_markup']")
OLDMK=$(api GET "/buyer/orders/$ORDER/payment" "" "$BUYER" | jq_ "d['payment_markup']")
echo "   new checkout markup=$NEWMK / existing order snapshot=$OLDMK"
check "new checkout uses the NEW value 7000" "$(num_eq "$NEWMK" 7000)"
check "existing order keeps the OLD snapshot 3000" "$(num_eq "$OLDMK" 3000)"

echo "== MOBILE_PAY_NOW cannot fake a success (17) =="
PAYNOW_ORDER=$(mk_order 3)
RES=$(api POST "/buyer/orders/$PAYNOW_ORDER/payment" "{\"payment_method\":\"MOBILE_PAY_NOW\"}" "$BUYER")
PNST=$(echo "$RES" | jq_ "d['status']")
echo "   pay-now payment status=$PNST"
check "pay-now order is created unpaid, never PAID/VERIFIED" "$([ "$PNST" != "VERIFIED" ] && [ "$PNST" != "PAID" ] && echo 1 || echo 0)"

echo
echo "ORDER=$ORDER NEWORDER=$NEWORDER"
echo "PASS=$PASS FAIL=$FAIL"
