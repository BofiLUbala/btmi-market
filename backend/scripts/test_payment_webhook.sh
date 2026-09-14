#!/bin/sh
# Runtime test of the online-payment path: only a correctly signed provider
# webhook may settle a payment, and it must be replay-safe and amount-checked.
set -u
BASE=${BASE:-http://localhost:8080/api/v1}
BUYER_EMAIL=${BUYER_EMAIL:-buyer_rt_1789261221@test.com}
SELLER_EMAIL=${SELLER_EMAIL:-seller_rt_1789261221@test.com}
ADMIN_EMAIL=${ADMIN_EMAIL:-finance.runtime@tbk.test}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-FinanceRuntime123!}
PASSWORD=${PASSWORD:-StrongPassword123!}
SECRET=${PAYMENT_WEBHOOK_SECRET:-dev-webhook-secret-change-me}
PROVIDER=${PROVIDER:-TBK_MOBILE_SANDBOX}
STAMP=$(date +%s)

PASS=0; FAIL=0
check() { if [ "$2" = "1" ]; then echo "[PASS] $1"; PASS=$((PASS+1)); else echo "[FAIL] $1"; FAIL=$((FAIL+1)); fi; }
jq_() { python -c "import sys,json;r=json.load(sys.stdin);d=r.get('data',r) if isinstance(r,dict) else r;print($1)" 2>/dev/null; }
api() {
  if [ "$1" = "GET" ]; then curl -s -H "Authorization: Bearer ${4:-}" "$BASE$2";
  else curl -s -X "$1" -H "Content-Type: application/json" -H "Authorization: Bearer ${4:-}" -d "$3" "$BASE$2"; fi
}
# Posts a body to the webhook with an HMAC-SHA256 signature over the exact bytes.
signed_post() { # BODY [SIGNATURE_OVERRIDE]
  python - "$1" "${2:-}" <<'PY'
import hashlib, hmac, json, os, sys, urllib.error, urllib.request
body = sys.argv[1].encode()
override = sys.argv[2]
secret = os.environ.get('SECRET', '').encode()
signature = override or 'sha256=' + hmac.new(secret, body, hashlib.sha256).hexdigest()
req = urllib.request.Request(os.environ['BASE'] + '/webhooks/payments/' + os.environ['PROVIDER'],
                             data=body, method='POST',
                             headers={'Content-Type': 'application/json', 'X-TBK-Signature': signature})
try:
    print(urllib.request.urlopen(req).status)
except urllib.error.HTTPError as e:
    print(f"{e.code} {e.read().decode()[:120]}")
PY
}
export SECRET BASE PROVIDER

ADMIN=$(api POST /admin/auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" "" | jq_ "d['access_token']")
BUYER=$(api POST /auth/login "{\"email\":\"$BUYER_EMAIL\",\"password\":\"$PASSWORD\"}" "" | jq_ "d['access_token']")
SELLER=$(api POST /auth/login "{\"email\":\"$SELLER_EMAIL\",\"password\":\"$PASSWORD\"}" "" | jq_ "d['access_token']")
check "logins" "$([ -n "$ADMIN" ] && [ -n "$BUYER" ] && [ -n "$SELLER" ] && echo 1 || echo 0)"

# Finance turns on pay-now and names the provider that will call the webhook.
ADMIN="$ADMIN" python - <<'PY'
import json, os, urllib.request
base, admin, provider = os.environ['BASE'], os.environ['ADMIN'], os.environ['PROVIDER']
items = json.load(urllib.request.urlopen(urllib.request.Request(base + '/admin/finance/payment-config',
        headers={'Authorization': 'Bearer ' + admin})))
items = (items.get('data', items))['items']
cfg = [m for m in items if m['code'] == 'MOBILE_PAY_NOW'][0]
body = json.dumps({'label': cfg['label'], 'enabled': True, 'markup_type': 'PERCENTAGE',
                   'markup_value': 2, 'provider': provider}).encode()
urllib.request.urlopen(urllib.request.Request(base + '/admin/finance/payment-config/MOBILE_PAY_NOW',
    data=body, method='PATCH',
    headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + admin}))
print('MOBILE_PAY_NOW enabled with provider', provider)
PY

BIZ=$(api GET /businesses "" "$SELLER" | jq_ "d[0]['id']")
SHOP=$(api GET "/businesses/$BIZ/shops" "" "$SELLER" | jq_ "d[0]['id']")
PROD=$(api GET "/businesses/$BIZ/products" "" "$SELLER" | jq_ "d[0]['id']")
VARIANT=$(api GET "/businesses/$BIZ/products/$PROD/variants" "" "$SELLER" | jq_ "d[0]['id']")
api POST "/shops/$SHOP/stock" "{\"variant_id\":\"$VARIANT\",\"quantity\":50,\"notes\":\"runtime\"}" "$SELLER" > /dev/null

KIN=$(curl -s "$BASE/locations/provinces" | jq_ "[x['id'] for x in d['items'] if x['name']=='Kinshasa'][0]")
CITY=$(curl -s "$BASE/locations/provinces/$KIN/cities" | jq_ "d['items'][0]['id']")
GOMBE=$(curl -s "$BASE/locations/cities/$CITY/communes" | jq_ "[x['id'] for x in d['items'] if x['name']=='Gombe'][0]")

ORDER=$(api POST /buyer/orders "{\"shop_id\":\"$SHOP\",\"items\":[{\"product_id\":\"$PROD\",\"variant_id\":\"$VARIANT\",\"quantity\":1}],\"use_points\":false,\"idempotency_key\":\"wh-$STAMP\"}" "$BUYER" | jq_ "d['order']['id']")
api POST "/buyer/orders/$ORDER/delivery" "{\"method\":\"TBK_STANDARD\",\"use_points_for_delivery\":false,\"contact_name\":\"Runtime Buyer\",\"phone\":\"+243810000001\",\"province_id\":\"$KIN\",\"city_id\":\"$CITY\",\"commune_id\":\"$GOMBE\",\"street\":\"Avenue des Aviateurs\",\"building_number\":\"25\"}" "$BUYER" > /dev/null

PAY=$(api POST "/buyer/orders/$ORDER/payment" "{\"payment_method\":\"MOBILE_PAY_NOW\"}" "$BUYER")
PAYID=$(echo "$PAY" | jq_ "d['id']")
TOTAL=$(echo "$PAY" | jq_ "d['final_total']")
STATUS=$(echo "$PAY" | jq_ "d['status']")
CURRENCY=$(echo "$PAY" | jq_ "d['currency']")
echo "   payment=$PAYID status=$STATUS total=$TOTAL $CURRENCY"
check "pay-now order created UNPAID (17)" "$([ "$STATUS" != "VERIFIED" ] && [ "$STATUS" != "PAID" ] && echo 1 || echo 0)"

echo "== le client ne peut pas se declarer paye =="
BEFORE=$(api GET "/buyer/orders/$ORDER/payment" "" "$BUYER" | jq_ "d['status']")
api POST "/buyer/payments/$PAYID/buyer-confirm" "{}" "$BUYER" > /dev/null
AFTER=$(api GET "/buyer/orders/$ORDER/payment" "" "$BUYER" | jq_ "d['status']")
echo "   avant=$BEFORE apres=$AFTER"
check "buyer confirmation alone never marks VERIFIED" "$([ "$AFTER" != "VERIFIED" ] && echo 1 || echo 0)"

echo "== webhook non signe =="
OUT=$(signed_post "{\"event_id\":\"forged-$STAMP\",\"payment_id\":\"$PAYID\",\"status\":\"SUCCEEDED\",\"amount\":$TOTAL,\"currency\":\"$CURRENCY\"}" "sha256=deadbeef")
echo "   -> $OUT"
check "bad signature refused (401)" "$(echo "$OUT" | grep -q '^401' && echo 1 || echo 0)"

echo "== webhook signe, mauvais montant =="
OUT=$(signed_post "{\"event_id\":\"wrongamount-$STAMP\",\"payment_id\":\"$PAYID\",\"status\":\"SUCCEEDED\",\"amount\":1,\"currency\":\"$CURRENCY\"}")
echo "   -> $OUT"
check "amount mismatch refused" "$(echo "$OUT" | grep -q 'AMOUNT_MISMATCH' && echo 1 || echo 0)"
STILL=$(api GET "/buyer/orders/$ORDER/payment" "" "$BUYER" | jq_ "d['status']")
check "payment untouched after refusals (status=$STILL)" "$([ "$STILL" != "VERIFIED" ] && echo 1 || echo 0)"

echo "== webhook signe et correct =="
BODY="{\"event_id\":\"ok-$STAMP\",\"payment_id\":\"$PAYID\",\"reference\":\"PSP-$STAMP\",\"status\":\"SUCCEEDED\",\"amount\":$TOTAL,\"currency\":\"$CURRENCY\"}"
OUT=$(signed_post "$BODY")
echo "   -> $OUT"
SETTLED=$(api GET "/buyer/orders/$ORDER/payment" "" "$BUYER" | jq_ "d['status']")
REF=$(api GET "/buyer/orders/$ORDER/payment" "" "$BUYER" | jq_ "d['provider_reference']")
echo "   status=$SETTLED reference=$REF"
check "valid signed webhook settles the payment" "$([ "$SETTLED" = "VERIFIED" ] && echo 1 || echo 0)"
check "provider reference stored" "$([ "$REF" = "PSP-$STAMP" ] && echo 1 || echo 0)"

echo "== rejeu du meme evenement =="
OUT=$(signed_post "$BODY")
COUNT=$(api GET "/buyer/orders/$ORDER/payment" "" "$BUYER" | jq_ "d['status']")
echo "   -> $OUT (status toujours $COUNT)"
check "replay is a no-op" "$([ "$OUT" = "200" ] && [ "$COUNT" = "VERIFIED" ] && echo 1 || echo 0)"

echo
echo "ORDER=$ORDER PAYMENT=$PAYID"
echo "PASS=$PASS FAIL=$FAIL"
