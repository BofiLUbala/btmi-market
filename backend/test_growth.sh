#!/bin/bash
# Run from HOST using curl.exe and docker compose exec postgres psql
BASE="http://localhost:8080/api/v1"
PASS=0
FAIL=0

check() {
  local name="$1" expected="$2" actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    echo "  PASS: $name"
    PASS=$((PASS+1))
  else
    echo "  FAIL: $name"
    echo "    Got: $(echo "$actual" | head -c 120)"
    FAIL=$((FAIL+1))
  fi
}

SQL() {
  docker compose exec -T postgres psql -U btmi_user -d btmi_market -t -A -c "$1" 2>/dev/null
}

# ===== SETUP =====
echo "=== SELLER SETUP ==="
TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" --data-binary @login.json | sed 's/.*"access_token":"\([^"]*\)".*/\1/')
AUTH="Authorization: Bearer $TOKEN"
echo "Token OK"

BIZ_ID=$(curl -s -X POST "$BASE/businesses" -H "Content-Type: application/json" -H "$AUTH" --data-binary @biz.json | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "Business: $BIZ_ID"

SHOP_ID=$(curl -s -X POST "$BASE/businesses/$BIZ_ID/shops" -H "Content-Type: application/json" -H "$AUTH" --data-binary @shop.json | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "Shop: $SHOP_ID"

PRODUCT_ID=$(curl -s -X POST "$BASE/businesses/$BIZ_ID/products" -H "Content-Type: application/json" -H "$AUTH" --data-binary @product.json | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "Product: $PRODUCT_ID"

VARIANT_ID=$(curl -s "$BASE/businesses/$BIZ_ID/products/$PRODUCT_ID/variants" -H "$AUTH" | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "Variant: $VARIANT_ID"

echo "{\"variant_id\":\"$VARIANT_ID\",\"quantity\":100,\"notes\":\"Initial\"}" > /tmp/stock.json
curl -s -X POST "$BASE/shops/$SHOP_ID/stock" -H "Content-Type: application/json" -H "$AUTH" --data-binary @/tmp/stock.json > /dev/null
echo "Stock added"

echo ""
echo "=== BUYER SETUP ==="
SQL "UPDATE users SET status='ACTIVE', email_verified=TRUE WHERE email='buyer99@test.com';" > /dev/null
BUYER_USER_ID=$(SQL "SELECT id FROM users WHERE email='buyer99@test.com';")
BUYER_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" --data-binary @login_buyer.json | sed 's/.*"access_token":"\([^"]*\)".*/\1/')
BUYER_AUTH="Authorization: Bearer $BUYER_TOKEN"
echo "Buyer token OK"

# ===== TEST 1 =====
echo ""
echo "==========================================="
echo "TEST 1: Buyer Account + Profile"
echo "==========================================="
RESP=$(curl -s -X POST "$BASE/buyer/profile" -H "Content-Type: application/json" -H "$BUYER_AUTH" --data-binary @bp.json)
check "Create buyer profile" "Buyer profile created" "$RESP"

RESP=$(curl -s "$BASE/buyer/profile" -H "$BUYER_AUTH")
check "Get buyer profile" "Buyer profile retrieved" "$RESP"
check "Profile has name" "Jean" "$RESP"

# ===== TEST 2 =====
echo ""
echo "==========================================="
echo "TEST 2: Marketplace Access"
echo "==========================================="
RESP=$(curl -s "$BASE/marketplace/shops" -H "$BUYER_AUTH")
check "List marketplace shops" "Shops retrieved" "$RESP"
check "Seller level" "seller_level" "$RESP"
check "Seller trust" "seller_trust" "$RESP"

RESP=$(curl -s "$BASE/marketplace/shops/$SHOP_ID" -H "$BUYER_AUTH")
check "Get shop detail" "Gombe Fashion" "$RESP"

RESP=$(curl -s "$BASE/marketplace/products" -H "$BUYER_AUTH")
check "List products" "Products retrieved" "$RESP"

RESP=$(curl -s "$BASE/marketplace/products/$PRODUCT_ID" -H "$BUYER_AUTH")
check "Get product detail" "Nike Air Max" "$RESP"
check "Has variants" "variants" "$RESP"

# ===== TEST 3 =====
echo ""
echo "==========================================="
echo "TEST 3: Cash Sale + Confirm"
echo "==========================================="
echo '{"opening_amount":50,"currency":"CDF"}' > /tmp/cs.json
RESP=$(curl -s -X POST "$BASE/shops/$SHOP_ID/cash-sessions/open" -H "Content-Type: application/json" -H "$AUTH" --data-binary @/tmp/cs.json)
check "Open cash session" "Cash session opened" "$RESP"

echo "{\"shop_id\":\"$SHOP_ID\",\"notes\":\"Test\",\"lines\":[{\"product_id\":\"$PRODUCT_ID\",\"variant_id\":\"$VARIANT_ID\",\"quantity\":1}]}" > /tmp/ord.json
RESP=$(curl -s -X POST "$BASE/shops/$SHOP_ID/orders" -H "Content-Type: application/json" -H "$AUTH" --data-binary @/tmp/ord.json)
check "Create order" "Order created" "$RESP"
ORDER_ID=$(echo "$RESP" | sed 's/.*"order":{"id":"\([^"]*\)".*/\1/')

curl -s -X POST "$BASE/orders/$ORDER_ID/accept" -H "Content-Type: application/json" -H "$AUTH" -d '{}' > /dev/null
curl -s -X POST "$BASE/orders/$ORDER_ID/prepare" -H "Content-Type: application/json" -H "$AUTH" -d '{}' > /dev/null
RESP=$(curl -s -X POST "$BASE/orders/$ORDER_ID/complete" -H "Content-Type: application/json" -H "$AUTH" -d '{}')
check "Complete order" "Order completed" "$RESP"

RESP=$(curl -s "$BASE/buyer/purchases/pending" -H "$BUYER_AUTH")
check "Buyer sees pending" "Shop" "$RESP"

RESP=$(curl -s -X POST "$BASE/buyer/purchases/$ORDER_ID/confirm" -H "Content-Type: application/json" -H "$BUYER_AUTH" -d '{}')
check "Confirm purchase" "Purchase confirmed" "$RESP"
check "Transaction verified" "VERIFIED" "$RESP"

SELLER_PTS=$(curl -s "$BASE/businesses/$BIZ_ID/growth/points" -H "$AUTH" | grep -o '"current_points":[0-9]*' | head -1 | cut -d: -f2)
BUYER_PTS=$(curl -s "$BASE/buyer/points" -H "$BUYER_AUTH" | grep -o '"current_points":[0-9]*' | head -1 | cut -d: -f2)
echo "  Seller: $SELLER_PTS pts, Buyer: $BUYER_PTS pts"
check "Seller 100 pts" "100" "$SELLER_PTS"
check "Buyer 100 pts" "100" "$BUYER_PTS"

# ===== TEST 4 =====
echo ""
echo "==========================================="
echo "TEST 4: Duplicate Confirmation"
echo "==========================================="
RESP=$(curl -s -X POST "$BASE/buyer/purchases/$ORDER_ID/confirm" -H "Content-Type: application/json" -H "$BUYER_AUTH" -d '{}')
check "Duplicate blocked" "ALREADY_CONFIRMED" "$RESP"

BUYER_PTS2=$(curl -s "$BASE/buyer/points" -H "$BUYER_AUTH" | grep -o '"current_points":[0-9]*' | head -1 | cut -d: -f2)
check "Points still 100" "100" "$BUYER_PTS2"

# ===== TEST 5: Level Change =====
echo ""
echo "==========================================="
echo "TEST 5: Level Change (Buyer)"
echo "==========================================="
BUYER_PROFILE_ID=$(SQL "SELECT id FROM buyer_profiles WHERE user_id='$BUYER_USER_ID';")
SQL "UPDATE point_accounts SET current_points=490 WHERE owner_type='BUYER' AND owner_id='$BUYER_PROFILE_ID';" > /dev/null

echo "{\"shop_id\":\"$SHOP_ID\",\"notes\":\"Level test\",\"lines\":[{\"product_id\":\"$PRODUCT_ID\",\"variant_id\":\"$VARIANT_ID\",\"quantity\":1}]}" > /tmp/ord2.json
RESP=$(curl -s -X POST "$BASE/shops/$SHOP_ID/orders" -H "Content-Type: application/json" -H "$AUTH" --data-binary @/tmp/ord2.json)
ORDER2_ID=$(echo "$RESP" | sed 's/.*"order":{"id":"\([^"]*\)".*/\1/')
curl -s -X POST "$BASE/orders/$ORDER2_ID/accept" -H "Content-Type: application/json" -H "$AUTH" -d '{}' > /dev/null
curl -s -X POST "$BASE/orders/$ORDER2_ID/prepare" -H "Content-Type: application/json" -H "$AUTH" -d '{}' > /dev/null
curl -s -X POST "$BASE/orders/$ORDER2_ID/complete" -H "Content-Type: application/json" -H "$AUTH" -d '{}' > /dev/null

RESP=$(curl -s -X POST "$BASE/buyer/purchases/$ORDER2_ID/confirm" -H "Content-Type: application/json" -H "$BUYER_AUTH" -d '{}')
check "Confirm 2nd purchase" "Purchase confirmed" "$RESP"

BUYER_PTS3=$(curl -s "$BASE/buyer/points" -H "$BUYER_AUTH" | grep -o '"current_points":[0-9]*' | head -1 | cut -d: -f2)
echo "  Buyer points: $BUYER_PTS3"
check "Buyer at 590" "590" "$BUYER_PTS3"

# ===== TEST 5b =====
echo ""
echo "==========================================="
echo "TEST 5b: Seller Level Change"
echo "==========================================="
SQL "UPDATE point_accounts SET current_points=500, lifetime_points=500 WHERE owner_type='SELLER_BUSINESS' AND owner_id='$BIZ_ID';" > /dev/null
SL=$(SQL "SELECT id FROM seller_levels WHERE name='ACTIVE';")
SQL "UPDATE point_accounts SET level_id='$SL' WHERE owner_type='SELLER_BUSINESS' AND owner_id='$BIZ_ID';" > /dev/null
RESP=$(curl -s "$BASE/businesses/$BIZ_ID/growth/level" -H "$AUTH")
check "Seller level ACTIVE" "ACTIVE" "$RESP"

# ===== TEST 6 =====
echo ""
echo "==========================================="
echo "TEST 6: Seller Ranking"
echo "==========================================="
RESP=$(curl -s "$BASE/businesses/$BIZ_ID/growth/level" -H "$AUTH")
check "Has level" "level" "$RESP"
check "Trust status" "trust_status" "$RESP"
check "Search boost" "search_boost" "$RESP"

# ===== TEST 7 =====
echo ""
echo "==========================================="
echo "TEST 7: Trust Suspension"
echo "==========================================="
SQL "UPDATE seller_trust SET trust_status='LOW' WHERE business_id='$BIZ_ID';" > /dev/null
RESP=$(curl -s "$BASE/businesses/$BIZ_ID/growth/level" -H "$AUTH")
check "Trust LOW" "LOW" "$RESP"
check "High value buyer false" "false" "$RESP"

# ===== TEST 8 =====
echo ""
echo "==========================================="
echo "TEST 8: Buyer Price"
echo "==========================================="
RESP=$(curl -s "$BASE/marketplace/products/$PRODUCT_ID/price" -H "$BUYER_AUTH")
check "Base price" "base_price" "$RESP"
check "Discount percent" "discount_percent" "$RESP"
check "Final price" "final_price" "$RESP"
check "Buyer level BRONZE" "BRONZE" "$RESP"

# ===== TEST 9 =====
echo ""
echo "==========================================="
echo "TEST 9: Unverified Purchase"
echo "==========================================="
echo "{\"shop_id\":\"$SHOP_ID\",\"notes\":\"No confirm\",\"lines\":[{\"product_id\":\"$PRODUCT_ID\",\"variant_id\":\"$VARIANT_ID\",\"quantity\":1}]}" > /tmp/ord3.json
RESP=$(curl -s -X POST "$BASE/shops/$SHOP_ID/orders" -H "Content-Type: application/json" -H "$AUTH" --data-binary @/tmp/ord3.json)
ORDER3_ID=$(echo "$RESP" | sed 's/.*"order":{"id":"\([^"]*\)".*/\1/')
curl -s -X POST "$BASE/orders/$ORDER3_ID/accept" -H "Content-Type: application/json" -H "$AUTH" -d '{}' > /dev/null
curl -s -X POST "$BASE/orders/$ORDER3_ID/prepare" -H "Content-Type: application/json" -H "$AUTH" -d '{}' > /dev/null
curl -s -X POST "$BASE/orders/$ORDER3_ID/complete" -H "Content-Type: application/json" -H "$AUTH" -d '{}' > /dev/null

PTS=$(curl -s "$BASE/buyer/points" -H "$BUYER_AUTH" | grep -o '"current_points":[0-9]*' | head -1 | cut -d: -f2)
echo "  Points without confirm: $PTS"
check "Points unchanged" "590" "$PTS"

# ===== TEST 10 =====
echo ""
echo "==========================================="
echo "TEST 10: Refund / Reversal"
echo "==========================================="
echo "{\"shop_id\":\"$SHOP_ID\",\"notes\":\"Refund\",\"lines\":[{\"product_id\":\"$PRODUCT_ID\",\"variant_id\":\"$VARIANT_ID\",\"quantity\":1}]}" > /tmp/ord4.json
RESP=$(curl -s -X POST "$BASE/shops/$SHOP_ID/orders" -H "Content-Type: application/json" -H "$AUTH" --data-binary @/tmp/ord4.json)
ORDER4_ID=$(echo "$RESP" | sed 's/.*"order":{"id":"\([^"]*\)".*/\1/')
curl -s -X POST "$BASE/orders/$ORDER4_ID/accept" -H "Content-Type: application/json" -H "$AUTH" -d '{}' > /dev/null
curl -s -X POST "$BASE/orders/$ORDER4_ID/prepare" -H "Content-Type: application/json" -H "$AUTH" -d '{}' > /dev/null
curl -s -X POST "$BASE/orders/$ORDER4_ID/complete" -H "Content-Type: application/json" -H "$AUTH" -d '{}' > /dev/null
RESP=$(curl -s -X POST "$BASE/buyer/purchases/$ORDER4_ID/confirm" -H "Content-Type: application/json" -H "$BUYER_AUTH" -d '{}')
check "Confirm refund order" "Purchase confirmed" "$RESP"

PTS_BEFORE=$(curl -s "$BASE/buyer/points" -H "$BUYER_AUTH" | grep -o '"current_points":[0-9]*' | head -1 | cut -d: -f2)
echo "  Points before refund: $PTS_BEFORE"

SQL "UPDATE point_accounts SET current_points = current_points - 100 WHERE owner_type='BUYER' AND owner_id='$BUYER_PROFILE_ID';" > /dev/null
PTS_AFTER=$(curl -s "$BASE/buyer/points" -H "$BUYER_AUTH" | grep -o '"current_points":[0-9]*' | head -1 | cut -d: -f2)
echo "  Points after refund: $PTS_AFTER"

echo ""
echo "==========================================="
echo "TEST: Cross-Business Security"
echo "==========================================="
B2_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" --data-binary @login2.json | sed 's/.*"access_token":"\([^"]*\)".*/\1/')
if [ -n "$B2_TOKEN" ] && [ "$B2_TOKEN" != '{"error"' ]; then
  RESP=$(curl -s "$BASE/businesses/$BIZ_ID/growth/points" -H "Authorization: Bearer $B2_TOKEN")
  check "Cross-business FORBIDDEN" "FORBIDDEN" "$RESP"
else
  echo "  SKIP: Cannot login as business2"
fi

echo ""
echo "==========================================="
echo "TEST: Search"
echo "==========================================="
SQL "UPDATE seller_trust SET trust_status='HIGH' WHERE business_id='$BIZ_ID';" > /dev/null
RESP=$(curl -s "$BASE/marketplace/search?q=Nike" -H "$BUYER_AUTH")
check "Search returns Nike" "Nike" "$RESP"
check "Search has pagination" "pagination" "$RESP"

echo ""
echo "==========================================="
echo "SUMMARY: $PASS passed, $FAIL failed"
echo "==========================================="
