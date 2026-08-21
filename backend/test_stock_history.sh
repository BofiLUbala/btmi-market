#!/bin/sh

BASE="http://localhost:8080/api/v1"

echo "=== STEP 1: Login ==="
RESP=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d @/tmp/login.json)
TOKEN=$(echo "$RESP" | sed 's/.*"access_token":"\([^"]*\)".*/\1/')
echo "TOKEN_OK=$(echo "$TOKEN" | head -c 20)..."

AUTH="Authorization: Bearer $TOKEN"

echo ""
echo "=== STEP 2: Create Business ==="
RESP=$(curl -s -X POST "$BASE/businesses" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"name":"Stock History Test","business_type":"RETAIL","category":"Fashion","phone":"+243810009999","email":"stockhistory@test.com","country":"DRC","city":"Kinshasa","default_currency":"USD"}')
BIZ_ID=$(echo "$RESP" | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "BIZ_ID=$BIZ_ID"

echo ""
echo "=== STEP 3: Create Shop ==="
RESP=$(curl -s -X POST "$BASE/businesses/$BIZ_ID/shops" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"name":"Gombe Shop","type":"PHYSICAL","city":"Kinshasa","address":"123 Main St","phone":"+243820009999"}')
SHOP_ID=$(echo "$RESP" | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "SHOP_ID=$SHOP_ID"

echo ""
echo "=== STEP 4: Create Product ==="
RESP=$(curl -s -X POST "$BASE/businesses/$BIZ_ID/products" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"name":"Nike Air","sku":"NIKE-AIR-SH","description":"Premium shoes","unit_price":150,"cost_price":80,"unit":"PCS"}')
PRODUCT_ID=$(echo "$RESP" | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "PRODUCT_ID=$PRODUCT_ID"

echo ""
echo "=== STEP 5: Get Variant ==="
RESP=$(curl -s "$BASE/businesses/$BIZ_ID/products/$PRODUCT_ID/variants" -H "$AUTH")
VARIANT_ID=$(echo "$RESP" | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "VARIANT_ID=$VARIANT_ID"

echo ""
echo "=== STEP 6: Add Stock +20 ==="
RESP=$(curl -s -X POST "$BASE/shops/$SHOP_ID/stock" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d "{\"variant_id\":\"$VARIANT_ID\",\"quantity\":20,\"notes\":\"Initial stock\"}")
echo "RESULT: $(echo "$RESP" | sed 's/.*"message":"\([^"]*\)".*/\1/')"

echo ""
echo "=== STEP 7: Add Stock +30 ==="
RESP=$(curl -s -X POST "$BASE/shops/$SHOP_ID/stock" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d "{\"variant_id\":\"$VARIANT_ID\",\"quantity\":30,\"notes\":\"Restock\"}")
echo "RESULT: $(echo "$RESP" | sed 's/.*"message":"\([^"]*\)".*/\1/')"

echo ""
echo "=== STEP 8: Record Sale -2 ==="
RESP=$(curl -s -X POST "$BASE/shops/$SHOP_ID/sales" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d "{\"variant_id\":\"$VARIANT_ID\",\"quantity\":2,\"sale_type\":\"PHYSICAL\"}")
echo "RESULT: $(echo "$RESP" | sed 's/.*"message":"\([^"]*\)".*/\1/')"

echo ""
echo "=== STEP 9: Record Sale -3 ==="
RESP=$(curl -s -X POST "$BASE/shops/$SHOP_ID/sales" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d "{\"variant_id\":\"$VARIANT_ID\",\"quantity\":3,\"sale_type\":\"ONLINE\"}")
echo "RESULT: $(echo "$RESP" | sed 's/.*"message":"\([^"]*\)".*/\1/')"

echo ""
echo "=== STEP 10: Verify inventory ==="
RESP=$(curl -s "$BASE/shops/$SHOP_ID/inventory" -H "$AUTH")
QTY=$(echo "$RESP" | sed 's/.*"quantity":\([0-9]*\).*/\1/' | head -1)
echo "Quantity: $QTY (expected 45)"

echo ""
echo "========================================="
echo "=== TEST A: Shop Stock History (all) ==="
echo "========================================="
RESP=$(curl -s "$BASE/shops/$SHOP_ID/stock/history" -H "$AUTH")
TOTAL=$(echo "$RESP" | sed 's/.*"total":\([0-9]*\).*/\1/')
P_PAGE=$(echo "$RESP" | sed 's/.*"page":\([0-9]*\).*/\1/' | head -1)
P_LIMIT=$(echo "$RESP" | sed 's/.*"limit":\([0-9]*\).*/\1/' | head -1)
echo "Total records: $TOTAL"
echo "Page: $P_PAGE, Limit: $P_LIMIT"
echo "First 3 movement_types:"
echo "$RESP" | grep -o '"movement_type":"[^"]*"' | head -3

echo ""
echo "=============================================="
echo "=== TEST B: Filter by type=STOCK_IN ==="
echo "=============================================="
RESP=$(curl -s "$BASE/shops/$SHOP_ID/stock/history?type=STOCK_IN" -H "$AUTH")
TOTAL=$(echo "$RESP" | sed 's/.*"total":\([0-9]*\).*/\1/')
STOCK_IN_COUNT=$(echo "$RESP" | grep -o '"movement_type":"STOCK_IN"' | wc -l)
NON_STOCK_IN=$(echo "$RESP" | grep -o '"movement_type":"[^"]*"' | grep -v STOCK_IN | wc -l)
echo "Total: $TOTAL, STOCK_IN records: $STOCK_IN_COUNT, Non-STOCK_IN: $NON_STOCK_IN"

echo ""
echo "=============================================="
echo "=== TEST C: Variant Stock History ==="
echo "=============================================="
RESP=$(curl -s "$BASE/variants/$VARIANT_ID/stock/history" -H "$AUTH")
TOTAL=$(echo "$RESP" | sed 's/.*"total":\([0-9]*\).*/\1/')
echo "Total records: $TOTAL"
echo "Record count: $(echo "$RESP" | grep -o '"movement_type":"[^"]*"' | wc -l)"

echo ""
echo "=============================================="
echo "=== TEST D: Business Stock History ==="
echo "=============================================="
RESP=$(curl -s "$BASE/businesses/$BIZ_ID/stock/history" -H "$AUTH")
TOTAL=$(echo "$RESP" | sed 's/.*"total":\([0-9]*\).*/\1/')
echo "Total records: $TOTAL"

echo ""
echo "=============================================="
echo "=== TEST E: Pagination (limit=2) ==="
echo "=============================================="
RESP=$(curl -s "$BASE/shops/$SHOP_ID/stock/history?page=1&limit=2" -H "$AUTH")
TOTAL=$(echo "$RESP" | sed 's/.*"total":\([0-9]*\).*/\1/')
RECORD_COUNT=$(echo "$RESP" | grep -o '"movement_type":"[^"]*"' | wc -l)
echo "Total: $TOTAL, Records returned: $RECORD_COUNT (expected 2)"

echo ""
echo "=============================================="
echo "=== TEST F: Date Filter (today) ==="
echo "=============================================="
TODAY=$(date -u +%Y-%m-%d)
RESP=$(curl -s "$BASE/shops/$SHOP_ID/stock/history?from=$TODAY&to=$TODAY" -H "$AUTH")
TOTAL=$(echo "$RESP" | sed 's/.*"total":\([0-9]*\).*/\1/')
echo "Total records for today: $TOTAL (expected 4)"

echo ""
echo "=============================================="
echo "=== TEST G: Cross-Business Security ==="
echo "=============================================="
# Use gauthier@test.com user who has their own businesses
RESP_B=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d @/tmp/login2.json)
BIZB_TOKEN=$(echo "$RESP_B" | sed 's/.*"access_token":"\([^"]*\)".*/\1/')
BIZB_AUTH="Authorization: Bearer $BIZB_TOKEN"

echo "Attempt to access SHOP_ID from another business user..."
RESP=$(curl -s "$BASE/shops/$SHOP_ID/stock/history" -H "$BIZB_AUTH")
echo "Response: $RESP"

echo ""
echo "=============================================="
echo "=== TEST H: Sort asc ==="
echo "=============================================="
RESP=$(curl -s "$BASE/shops/$SHOP_ID/stock/history?sort=asc&limit=4" -H "$AUTH")
echo "Record count: $(echo "$RESP" | grep -o '"movement_type":"[^"]*"' | wc -l)"
echo "First movements (asc order):"
echo "$RESP" | grep -o '"movement_type":"[^"]*"'

echo ""
echo "=== Verify Response Structure ==="
echo "Checking nested shop, product, variant, performed_by..."
RESP=$(curl -s "$BASE/shops/$SHOP_ID/stock/history?limit=1" -H "$AUTH")
echo "$RESP" | grep -o '"shop":{[^}]*}' | head -1
echo "$RESP" | grep -o '"product":{[^}]*}' | head -1
echo "$RESP" | grep -o '"variant":{[^}]*}' | head -1

echo ""
echo "=============================================="
echo "=== ALL TESTS COMPLETED ==="
echo "=============================================="
