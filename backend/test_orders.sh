#!/bin/sh
# Order E2E Test Script
API="http://localhost:8080/api/v1"

login() {
    curl -s -X POST "$API/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"gauthier2@test.com","password":"StrongPassword123!"}'
}

register_user() {
    curl -s -X POST "$API/auth/register" \
        -H "Content-Type: application/json" \
        -d '{"first_name":"Test","last_name":"Owner","phone":"+243899999999","email":"testorder'"'"'@test.com","password":"StrongPassword123!","password_confirmation":"StrongPassword123!"}'
}

create_business() {
    curl -s -X POST "$API/businesses" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{"name":"Test Fashion","business_type":"RETAIL","category":"Fashion","phone":"+243810001111","email":"tf@test.com","country":"DRC","city":"Kinshasa","default_currency":"USD"}'
}

create_shop() {
    curl -s -X POST "$API/businesses/$BIZ_ID/shops" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{"name":"Test Shop","type":"PHYSICAL","address":"123 Main St","phone":"+243820001111","city":"Kinshasa"}'
}

create_product() {
    curl -s -X POST "$API/businesses/$BIZ_ID/products" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{"name":"Nike Air Black 40","sku":"NIKE-BLACK-40","description":"Premium shoes","unit_price":150.00,"cost_price":80.00,"unit":"PCS"}'
}

get_variants() {
    curl -s "$API/businesses/$BIZ_ID/products/$PRODUCT_ID/variants" \
        -H "Authorization: Bearer $TOKEN"
}

add_stock() {
    curl -s -X POST "$API/shops/$SHOP_ID/stock" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{\"variant_id\":\"$VARIANT_ID\",\"quantity\":$1,\"notes\":\"Stock\"}"
}

get_inventory() {
    curl -s "$API/shops/$SHOP_ID/inventory" \
        -H "Authorization: Bearer $TOKEN"
}

create_order() {
    curl -s -X POST "$API/shops/$SHOP_ID/orders" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{\"shop_id\":\"$SHOP_ID\",\"notes\":\"Test order\",\"lines\":[{\"product_id\":\"$PRODUCT_ID\",\"variant_id\":\"$VARIANT_ID\",\"quantity\":$1}]}"
}

get_order() {
    curl -s "$API/orders/$1" \
        -H "Authorization: Bearer $TOKEN"
}

accept_order() {
    curl -s -X POST "$API/orders/$1/accept" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{}'
}

reject_order() {
    curl -s -X POST "$API/orders/$1/reject" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{}'
}

prepare_order() {
    curl -s -X POST "$API/orders/$1/prepare" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{}'
}

complete_order() {
    curl -s -X POST "$API/orders/$1/complete" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{}'
}

cancel_order() {
    curl -s -X POST "$API/orders/$1/cancel" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{}'
}

get_movements() {
    curl -s "$API/shops/$SHOP_ID/movements" \
        -H "Authorization: Bearer $TOKEN"
}

echo "=== STEP 1: Login ==="
RESP=$(login)
echo "$RESP"
TOKEN=$(echo "$RESP" | sed 's/.*"access_token":"\([^"]*\)".*/\1/')
echo "TOKEN=$TOKEN"

if [ -z "$TOKEN" ]; then
    echo "FAILED: Could not get token"
    exit 1
fi

echo ""
echo "=== STEP 2: Create Business ==="
RESP=$(create_business)
echo "$RESP"
BIZ_ID=$(echo "$RESP" | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "BIZ_ID=$BIZ_ID"

echo ""
echo "=== STEP 3: Create Shop ==="
RESP=$(create_shop)
echo "$RESP"
SHOP_ID=$(echo "$RESP" | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "SHOP_ID=$SHOP_ID"

echo ""
echo "=== STEP 4: Create Product ==="
RESP=$(create_product)
echo "$RESP"
PRODUCT_ID=$(echo "$RESP" | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "PRODUCT_ID=$PRODUCT_ID"

echo ""
echo "=== STEP 5: Get Variant ==="
RESP=$(get_variants)
echo "$RESP"
VARIANT_ID=$(echo "$RESP" | sed 's/.*"id":"\([^"]*\)".*/\1/')
echo "VARIANT_ID=$VARIANT_ID"

echo ""
echo "=== STEP 6: Add 20 units of stock ==="
RESP=$(add_stock 20)
echo "$RESP"

echo ""
echo "=== STEP 7: Verify initial inventory ==="
RESP=$(get_inventory)
echo "$RESP"

echo ""
echo "=== TEST A: Create Order (3 units) - SHOULD SUCCEED ==="
RESP=$(create_order 3)
echo "$RESP"
ORDER_ID=$(echo "$RESP" | sed 's/.*"data":{"order":{"id":"\([^"]*\)".*/\1/')
echo "ORDER_ID=$ORDER_ID"

echo ""
echo "=== TEST A: Verify reservation (20/3/17) ==="
RESP=$(get_inventory)
echo "$RESP"
echo "Expected: quantity=20, reserved=3, available=17"

echo ""
echo "=== TEST A: Accept Order ==="
RESP=$(accept_order "$ORDER_ID")
echo "$RESP"

echo ""
echo "=== TEST A: Prepare Order ==="
RESP=$(prepare_order "$ORDER_ID")
echo "$RESP"

echo ""
echo "=== TEST A: Complete Order - should deduct stock (17/0/17) ==="
RESP=$(complete_order "$ORDER_ID")
echo "$RESP"

echo ""
echo "=== TEST A: Verify final inventory ==="
RESP=$(get_inventory)
echo "$RESP"
echo "Expected: quantity=17, reserved=0, available=17"

echo ""
echo "=== TEST A: Verify SALE_ONLINE stock movement ==="
RESP=$(get_movements)
echo "$RESP"

echo ""
echo "=== TEST B: Create Order (50 units) - SHOULD FAIL (INSUFFICIENT_STOCK) ==="
RESP=$(create_order 50)
echo "$RESP"

echo ""
echo "=== TEST B: Verify inventory unchanged (17/0/17) ==="
RESP=$(get_inventory)
echo "$RESP"

echo ""
echo "=== TEST C: Create Order (5 units) then REJECT ==="
RESP=$(create_order 5)
echo "$RESP"
ORDER_ID2=$(echo "$RESP" | sed 's/.*"data":{"order":{"id":"\([^"]*\)".*/\1/')
echo "ORDER_ID2=$ORDER_ID2"

echo ""
echo "=== TEST C: Verify reservation (17/5/12) ==="
RESP=$(get_inventory)
echo "$RESP"
echo "Expected: quantity=17, reserved=5, available=12"

echo ""
echo "=== TEST C: Reject Order - should release (17/0/17) ==="
RESP=$(reject_order "$ORDER_ID2")
echo "$RESP"

echo ""
echo "=== TEST C: Verify inventory after reject ==="
RESP=$(get_inventory)
echo "$RESP"
echo "Expected: quantity=17, reserved=0, available=17"

echo ""
echo "=== TEST D: Create Order (17 units) then CANCEL ==="
RESP=$(create_order 17)
echo "$RESP"
ORDER_ID3=$(echo "$RESP" | sed 's/.*"data":{"order":{"id":"\([^"]*\)".*/\1/')
echo "ORDER_ID3=$ORDER_ID3"

echo ""
echo "=== TEST D: Verify reservation (17/17/0) ==="
RESP=$(get_inventory)
echo "$RESP"
echo "Expected: quantity=17, reserved=17, available=0"

echo ""
echo "=== TEST D: Cancel Order - should release (17/0/17) ==="
RESP=$(cancel_order "$ORDER_ID3")
echo "$RESP"

echo ""
echo "=== TEST D: Verify inventory after cancel ==="
RESP=$(get_inventory)
echo "$RESP"
echo "Expected: quantity=17, reserved=0, available=17"

echo ""
echo "=== ALL TESTS COMPLETED ==="
