$BASE_URL = "http://localhost:8080/api/v1"

Write-Host "=== STEP 1: Register User ==="
$regBody = '{"first_name":"Test","last_name":"Owner","phone":"+243899999999","email":"testorder@test.com","password":"StrongPassword123!","password_confirmation":"StrongPassword123!"}'
$regResponse = docker compose exec -T api wget -q -O- --post-data=$regBody --header='Content-Type: application/json' "http://localhost:8080/api/v1/auth/register" 2>&1
Write-Host $regResponse

Write-Host "`n=== STEP 2: Login ==="
$loginBody = '{"email":"testorder@test.com","password":"StrongPassword123!"}'
$loginResponse = docker compose exec -T api wget -q -O- --post-data=$loginBody --header='Content-Type: application/json' "http://localhost:8080/api/v1/auth/login" 2>&1
Write-Host $loginResponse

$token = ($loginResponse | ConvertFrom-Json).data.access_token
Write-Host "`nToken: $token"

if (-not $token) {
    Write-Host "FAILED: Could not get token"
    exit 1
}

Write-Host "`n=== STEP 3: Create Business ==="
$bizBody = '{"name":"Test Fashion Business","business_type":"RETAIL","category":"Fashion","phone":"+243810001111","email":"testfashion@test.com","country":"DRC","city":"Kinshasa","default_currency":"USD"}'
$bizResponse = docker compose exec -T api wget -q -O- --post-data=$bizBody --header='Content-Type: application/json' --header="Authorization: Bearer $token" "http://localhost:8080/api/v1/businesses" 2>&1
Write-Host $bizResponse

$bizId = ($bizResponse | ConvertFrom-Json).data.id
Write-Host "`nBusiness ID: $bizId"

Write-Host "`n=== STEP 4: Create Shop ==="
$shopBody = '{"name":"Gombe Shop","address":"123 Main St","phone":"+243820001111","email":"gombe@test.com","city":"Kinshasa"}'
$shopResponse = docker compose exec -T api wget -q -O- --post-data=$shopBody --header='Content-Type: application/json' --header="Authorization: Bearer $token" "http://localhost:8080/api/v1/businesses/$bizId/shops" 2>&1
Write-Host $shopResponse

$shopId = ($shopResponse | ConvertFrom-Json).data.id
Write-Host "`nShop ID: $shopId"

Write-Host "`n=== STEP 5: Create Product ==="
$productBody = '{"name":"Nike Air Black 40","sku":"NIKE-BLACK-40","description":"Premium running shoes","unit_price":150.00,"cost_price":80.00,"unit":"PCS"}'
$productResponse = docker compose exec -T api wget -q -O- --post-data=$productBody --header='Content-Type: application/json' --header="Authorization: Bearer $token" "http://localhost:8080/api/v1/businesses/$bizId/products" 2>&1
Write-Host $productResponse

$productId = ($productResponse | ConvertFrom-Json).data.id
Write-Host "`nProduct ID: $productId"

Write-Host "`n=== STEP 6: Get Variant ==="
$variantsResponse = docker compose exec -T api wget -q -O- --header="Authorization: Bearer $token" "http://localhost:8080/api/v1/businesses/$bizId/products/$productId/variants" 2>&1
Write-Host $variantsResponse

$variantId = ($variantsResponse | ConvertFrom-Json).data[0].id
Write-Host "`nVariant ID: $variantId"

Write-Host "`n=== STEP 7: Add Stock (20 units) ==="
$stockBody = "{\"variant_id\":\"$variantId\",\"quantity\":20,\"notes\":\"Initial stock\"}"
$stockResponse = docker compose exec -T api wget -q -O- --post-data=$stockBody --header='Content-Type: application/json' --header="Authorization: Bearer $token" "http://localhost:8080/api/v1/shops/$shopId/stock" 2>&1
Write-Host $stockResponse

Write-Host "`n=== STEP 8: Verify Initial Stock ==="
$invResponse = docker compose exec -T api wget -q -O- --header="Authorization: Bearer $token" "http://localhost:8080/api/v1/shops/$shopId/inventory" 2>&1
Write-Host $invResponse

Write-Host "`n=== STEP 9: Create Order (3 units - SUFFICIENT STOCK) ==="
$orderBody = "{\"shop_id\":\"$shopId\",\"notes\":\"Test order\",\"lines\":[{\"product_id\":\"$productId\",\"variant_id\":\"$variantId\",\"quantity\":3}]}"
$orderResponse = docker compose exec -T api wget -q -O- --post-data=$orderBody --header='Content-Type: application/json' --header="Authorization: Bearer $token" "http://localhost:8080/api/v1/shops/$shopId/orders" 2>&1
Write-Host $orderResponse

$orderId = ($orderResponse | ConvertFrom-Json).data.order.id
Write-Host "`nOrder ID: $orderId"

Write-Host "`n=== STEP 10: Verify Stock After Reservation ==="
$invAfterOrder = docker compose exec -T api wget -q -O- --header="Authorization: Bearer $token" "http://localhost:8080/api/v1/shops/$shopId/inventory" 2>&1
Write-Host $invAfterOrder

Write-Host "`nExpected: on_hand=20, reserved=3, available=17"

Write-Host "`n=== STEP 11: Accept Order ==="
$acceptResponse = docker compose exec -T api wget -q -O- --post-data='' --header='Content-Type: application/json' --header="Authorization: Bearer $token" "http://localhost:8080/api/v1/orders/$orderId/accept" 2>&1
Write-Host $acceptResponse

Write-Host "`n=== STEP 12: Verify Stock After Accept (should be same) ==="
$invAfterAccept = docker compose exec -T api wget -q -O- --header="Authorization: Bearer $token" "http://localhost:8080/api/v1/shops/$shopId/inventory" 2>&1
Write-Host $invAfterAccept

Write-Host "`n=== STEP 13: Prepare Order ==="
$prepareResponse = docker compose exec -T api wget -q -O- --post-data='' --header='Content-Type: application/json' --header="Authorization: Bearer $token" "http://localhost:8080/api/v1/orders/$orderId/prepare" 2>&1
Write-Host $prepareResponse

Write-Host "`n=== STEP 14: Complete Order ==="
$completeResponse = docker compose exec -T api wget -q -O- --post-data='' --header='Content-Type: application/json' --header="Authorization: Bearer $token" "http://localhost:8080/api/v1/orders/$orderId/complete" 2>&1
Write-Host $completeResponse

Write-Host "`n=== STEP 15: Verify Final Stock (should be on_hand=17, reserved=0, available=17) ==="
$invFinal = docker compose exec -T api wget -q -O- --header="Authorization: Bearer $token" "http://localhost:8080/api/v1/shops/$shopId/inventory" 2>&1
Write-Host $invFinal

Write-Host "`n=== STEP 16: Check Stock Movement (should have SALE_ONLINE) ==="
$movements = docker compose exec -T api wget -q -O- --header="Authorization: Bearer $token" "http://localhost:8080/api/v1/shops/$shopId/movements" 2>&1
Write-Host $movements

Write-Host "`n=== ALL TESTS COMPLETED ==="
