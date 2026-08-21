#!/bin/sh

BASE="http://localhost:8080/api/v1"

echo "=== STEP 1: Login ==="
RESP=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d @/tmp/login.json)
TOKEN=$(echo "$RESP" | sed 's/.*"access_token":"\([^"]*\)".*/\1/')
echo "TOKEN_OK=$(echo "$TOKEN" | head -c 20)..."
AUTH="Authorization: Bearer $TOKEN"

echo ""
echo "=== STEP 2: Create Business ==="
RESP=$(curl -s -X POST "$BASE/businesses" -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"name":"Customer Test Fashion","business_type":"RETAIL","category":"Fashion","phone":"+243810007777","email":"ctf@test.com","country":"DRC","city":"Kinshasa","default_currency":"USD"}')
BIZ_ID=$(echo "$RESP" | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "BIZ_ID=$BIZ_ID"

echo ""
echo "=== STEP 3: Create Shops ==="
RESP=$(curl -s -X POST "$BASE/businesses/$BIZ_ID/shops" -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"name":"Gombe Shop","type":"PHYSICAL","city":"Kinshasa","address":"123 Main St","phone":"+243820007771"}')
SHOP_A=$(echo "$RESP" | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "SHOP_A (Gombe)=$SHOP_A"

RESP=$(curl -s -X POST "$BASE/businesses/$BIZ_ID/shops" -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"name":"Limete Shop","type":"PHYSICAL","city":"Kinshasa","address":"456 Second St","phone":"+243820007772"}')
SHOP_B=$(echo "$RESP" | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "SHOP_B (Limete)=$SHOP_B"

echo ""
echo "=== STEP 4: Create Product & Variant ==="
RESP=$(curl -s -X POST "$BASE/businesses/$BIZ_ID/products" -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"name":"Nike Air","sku":"NIKE-AIR-CT","description":"Premium shoes","unit_price":150,"cost_price":80,"unit":"PCS"}')
PRODUCT_ID=$(echo "$RESP" | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "PRODUCT_ID=$PRODUCT_ID"

RESP=$(curl -s "$BASE/businesses/$BIZ_ID/products/$PRODUCT_ID/variants" -H "$AUTH")
VARIANT_ID=$(echo "$RESP" | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "VARIANT_ID=$VARIANT_ID"

echo ""
echo "=== STEP 5: Add Stock to both shops ==="
curl -s -X POST "$BASE/shops/$SHOP_A/stock" -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"variant_id\":\"$VARIANT_ID\",\"quantity\":50,\"notes\":\"Initial stock\"}" > /dev/null
curl -s -X POST "$BASE/shops/$SHOP_B/stock" -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"variant_id\":\"$VARIANT_ID\",\"quantity\":50,\"notes\":\"Initial stock\"}" > /dev/null
echo "Stock added to both shops"

echo ""
echo "========================================="
echo "=== TEST 1: Create Customer ==="
echo "========================================="
RESP=$(curl -s -X POST "$BASE/businesses/$BIZ_ID/customers" -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"first_name":"Marie","last_name":"Kabila","phone":"+243999123456","email":"marie@test.com"}')
CUST_ID=$(echo "$RESP" | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "CUST_ID=$CUST_ID"
echo "Response: $(echo "$RESP" | sed 's/.*"message":"\([^"]*\)".*/\1/')"

echo ""
echo "========================================="
echo "=== TEST 2: Duplicate Phone Prevention ==="
echo "========================================="
RESP=$(curl -s -X POST "$BASE/businesses/$BIZ_ID/customers" -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"first_name":"Marie","last_name":"Duplicate","phone":"+243999123456"}')
echo "Response: $RESP" | sed 's/.*"code":"\([^"]*\)".*/Error: \1/'

echo ""
echo "========================================="
echo "=== TEST 3: Create Order 1 (Gombe) with Customer ==="
echo "========================================="
RESP=$(curl -s -X POST "$BASE/shops/$SHOP_A/orders" -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"shop_id\":\"$SHOP_A\",\"customer_id\":\"$CUST_ID\",\"notes\":\"First order\",\"lines\":[{\"product_id\":\"$PRODUCT_ID\",\"variant_id\":\"$VARIANT_ID\",\"quantity\":2}]}")
ORDER1_ID=$(echo "$RESP" | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "ORDER1_ID=$ORDER1_ID"
echo "Customer ID in response: $(echo "$RESP" | grep -o '"customer_id":"[^"]*"' | head -1)"

echo ""
echo "========================================="
echo "=== TEST 4: Create Order 2 (Limete) same Customer ==="
echo "========================================="
RESP=$(curl -s -X POST "$BASE/shops/$SHOP_B/orders" -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"shop_id\":\"$SHOP_B\",\"customer_id\":\"$CUST_ID\",\"notes\":\"Second order\",\"lines\":[{\"product_id\":\"$PRODUCT_ID\",\"variant_id\":\"$VARIANT_ID\",\"quantity\":1}]}")
ORDER2_ID=$(echo "$RESP" | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "ORDER2_ID=$ORDER2_ID"

echo ""
echo "========================================="
echo "=== TEST 5: Verify Customer Count (still 1) ==="
echo "========================================="
RESP=$(curl -s "$BASE/businesses/$BIZ_ID/customers" -H "$AUTH")
TOTAL=$(echo "$RESP" | sed 's/.*"total":\([0-9]*\).*/\1/')
echo "Total customers: $TOTAL (expected 1)"

echo ""
echo "========================================="
echo "=== TEST 6: Get Customer Summary ==="
echo "========================================="
RESP=$(curl -s "$BASE/customers/$CUST_ID" -H "$AUTH")
echo "$RESP" | sed 's/.*"data"://' | head -c 800
echo ""

echo ""
echo "========================================="
echo "=== TEST 7: Get Customer Orders ==="
echo "========================================="
RESP=$(curl -s "$BASE/customers/$CUST_ID/orders" -H "$AUTH")
ORDER_COUNT=$(echo "$RESP" | grep -o '"id":' | wc -l)
echo "Order count: $ORDER_COUNT (expected 2)"
echo "Pagination: $(echo "$RESP" | sed 's/.*"pagination":{\([^}]*\)}.*/\1/')"

echo ""
echo "========================================="
echo "=== TEST 8: Filter Customer Orders by Shop ==="
echo "========================================="
RESP=$(curl -s "$BASE/customers/$CUST_ID/orders?shop_id=$SHOP_A" -H "$AUTH")
ORDER_COUNT=$(echo "$RESP" | grep -o '"id":' | wc -l)
echo "Orders from Gombe: $ORDER_COUNT (expected 1)"

echo ""
echo "========================================="
echo "=== TEST 9: Update Customer ==="
echo "========================================="
RESP=$(curl -s -X PATCH "$BASE/customers/$CUST_ID" -H "Content-Type: application/json" -H "$AUTH" \
  -d '{"first_name":"Marie Updated","phone":"+243999123457"}')
echo "Response: $(echo "$RESP" | sed 's/.*"message":"\([^"]*\)".*/\1/')"
echo "New first_name: $(echo "$RESP" | grep -o '"first_name":"[^"]*"' | head -1)"

echo ""
echo "========================================="
echo "=== TEST 10: Search Customers ==="
echo "========================================="
RESP=$(curl -s "$BASE/businesses/$BIZ_ID/customers?search=marie" -H "$AUTH")
SEARCH_TOTAL=$(echo "$RESP" | sed 's/.*"total":\([0-9]*\).*/\1/')
echo "Search 'marie' total: $SEARCH_TOTAL (expected 1)"

echo ""
echo "========================================="
echo "=== TEST 11: Cross-Business Security ==="
echo "========================================="
RESP_B=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d @/tmp/login2.json)
BIZB_TOKEN=$(echo "$RESP_B" | sed 's/.*"access_token":"\([^"]*\)".*/\1/')
BIZB_AUTH="Authorization: Bearer $BIZB_TOKEN"

echo "Attempt to access Customer from Business B..."
RESP=$(curl -s "$BASE/customers/$CUST_ID" -H "$BIZB_AUTH")
echo "Response: $(echo "$RESP" | sed 's/.*"code":"\([^"]*\)".*/Error: \1/')"

echo ""
echo "========================================="
echo "=== TEST 12: Complete Order + Verify Stock ==="
echo "========================================="
# Accept, Prepare, Complete order 1
curl -s -X POST "$BASE/orders/$ORDER1_ID/accept" -H "Content-Type: application/json" -H "$AUTH" > /dev/null
curl -s -X POST "$BASE/orders/$ORDER1_ID/prepare" -H "Content-Type: application/json" -H "$AUTH" > /dev/null
curl -s -X POST "$BASE/orders/$ORDER1_ID/complete" -H "Content-Type: application/json" -H "$AUTH" > /dev/null
echo "Order 1 completed"

# Verify inventory decreased
RESP=$(curl -s "$BASE/shops/$SHOP_A/inventory" -H "$AUTH")
QTY_A=$(echo "$RESP" | sed 's/.*"quantity":\([0-9]*\).*/\1/' | head -1)
echo "Shop A inventory: $QTY_A (expected 48)"

echo ""
echo "========================================="
echo "=== TEST 13: Verify Customer Summary After Completion ==="
echo "========================================="
RESP=$(curl -s "$BASE/customers/$CUST_ID" -H "$AUTH")
echo "Total orders: $(echo "$RESP" | grep -o '"total_orders":[0-9]*' | head -1)"
echo "Total purchased: $(echo "$RESP" | grep -o '"total_purchased":[0-9.]*' | head -1)"
echo "Shops used: $(echo "$RESP" | grep -o '"shops_used":\[[^]]*\]' | head -1)"

echo ""
echo "========================================="
echo "=== TEST 14: Create Order with Auto-Create Customer ==="
echo "========================================="
RESP=$(curl -s -X POST "$BASE/shops/$SHOP_A/orders" -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"shop_id\":\"$SHOP_A\",\"customer_phone\":\"+243888777666\",\"customer_name\":\"Patrick Test\",\"notes\":\"Auto customer\",\"lines\":[{\"product_id\":\"$PRODUCT_ID\",\"variant_id\":\"$VARIANT_ID\",\"quantity\":1}]}")
echo "Response: $(echo "$RESP" | sed 's/.*"message":"\([^"]*\)".*/\1/')"
CUST2_ID=$(echo "$RESP" | grep -o '"customer_id":"[^"]*"' | sed 's/"customer_id":"\([^"]*\)"/\1/')
echo "Auto-created customer_id: $CUST2_ID"

echo ""
echo "========================================="
echo "=== TEST 15: Verify 2 Customers Now ==="
echo "========================================="
RESP=$(curl -s "$BASE/businesses/$BIZ_ID/customers" -H "$AUTH")
TOTAL=$(echo "$RESP" | sed 's/.*"total":\([0-9]*\).*/\1/')
echo "Total customers: $TOTAL (expected 2)"

echo ""
echo "========================================="
echo "=== ALL TESTS COMPLETED ==="
echo "========================================="
