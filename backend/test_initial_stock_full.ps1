# BTMI - Item 40: Initial Stock Quantity Test Suite
$ErrorActionPreference = 'Continue'
$BASE = 'http://localhost:8080/api/v1'
$script:PASS = 0
$script:FAIL = 0

function Check {
    param([string]$Name, [string]$Expected, [string]$Actual, $Extra = $null)
    if ($Actual -eq $Expected -or $Actual -match [regex]::Escape($Expected)) {
        Write-Host "  [PASS] $Name" -ForegroundColor Green
        $script:PASS++
    } else {
        Write-Host "  [FAIL] $Name" -ForegroundColor Red
        Write-Host "    Expected: $Expected"
        Write-Host "    Got:      $Actual"
        if ($Extra) {
            Write-Host "    Details:  $($Extra | ConvertTo-Json -Depth 5)"
        }
        $script:FAIL++
    }
}

function Invoke-Api {
    param([string]$Method, [string]$Path, $Body, [string]$Token)
    $headers = @{}
    if ($Token) { $headers['Authorization'] = "Bearer $Token" }
    try {
        $params = @{ Method = $Method; Uri = "$BASE$Path"; Headers = $headers; ContentType = 'application/json'; ErrorAction = 'Stop' }
        if ($null -ne $Body) { $params['Body'] = ($Body | ConvertTo-Json -Depth 10) }
        $resp = Invoke-RestMethod @params
        return @{ status = 200; body = $resp }
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        $errBody = $null
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $errBody = $reader.ReadToEnd() | ConvertFrom-Json
        } catch {}
        return @{ status = $code; body = $errBody }
    }
}

function Sql {
    param([string]$Query)
    $result = docker compose exec -T postgres psql -U btmi_user -d btmi_market -t -A -c $Query 2>$null
    if ($null -eq $result) { return "" }
    return $result.Trim()
}

Write-Host "=========================================="
Write-Host "ITEM 40: INITIAL STOCK QUANTITY TEST SUITE"
Write-Host "=========================================="

# 1. Register and activate clean seller for this test
$uniq = Get-Date -Format 'yyyyMMdd_HHmmss'
$sellerEmail = "seller_stock_$uniq@test.com"
$sellerPass = "SellerPass123!"

$regRes = Invoke-Api -Method Post -Path '/auth/register/seller' -Body @{
    first_name = "Stock"
    last_name = "Tester"
    middle_name = "E2E"
    phone = "+24399$($uniq.Substring(7))0"
    email = $sellerEmail
    password = $sellerPass
    password_confirmation = $sellerPass
}
$sellerUserId = $regRes.body.data.user_id

# Activate user in database
Sql "UPDATE users SET status = 'ACTIVE', email_verified = true WHERE id = '$sellerUserId';"

# Login
$loginRes = Invoke-Api -Method Post -Path '/auth/login' -Body @{ email = $sellerEmail; password = $sellerPass }
$TOKEN = $loginRes.body.access_token
Check "Seller Authentication" "True" ($null -ne $TOKEN -and $TOKEN.Length -gt 10)

# Create Business
$createBiz = Invoke-Api -Method Post -Path '/businesses' -Body @{
    name = "BTMI Fashion Hub $uniq"
    business_type = "RETAIL"
    category = "FASHION"
    phone = "+24399$($uniq.Substring(7))0"
    email = $sellerEmail
    country = "CD"
    city = "Kinshasa"
    default_currency = "FC"
} -Token $TOKEN
$BIZ_ID = $createBiz.body.data.id
Check "Business Created" "True" ($null -ne $BIZ_ID -and $BIZ_ID.Length -gt 0) $createBiz

# Create 2 Shops for this business
$s1 = Invoke-Api -Method Post -Path "/businesses/$BIZ_ID/shops" -Body @{ name = "Main Boutique"; type = "PHYSICAL"; city = "Kinshasa" } -Token $TOKEN
$s2 = Invoke-Api -Method Post -Path "/businesses/$BIZ_ID/shops" -Body @{ name = "Gombe Branch"; type = "PHYSICAL"; city = "Kinshasa" } -Token $TOKEN
$SHOP_1 = $s1.body.data.id
$SHOP_2 = $s2.body.data.id
Check "Shop 1 Exists" "True" ($null -ne $SHOP_1 -and $SHOP_1.Length -gt 0) $s1
Check "Shop 2 Exists" "True" ($null -ne $SHOP_2 -and $SHOP_2.Length -gt 0) $s2

# Get Fashion category
$catsRes = Invoke-Api -Method Get -Path '/marketplace/categories'
$cats = $catsRes.body.data
$FASHION_CAT_ID = ""
foreach ($c in @($cats)) {
    if ($c.name -match "Fashion|Mode|Vêtements") {
        $FASHION_CAT_ID = $c.id
        break
    }
}
if (-not $FASHION_CAT_ID -and @($cats).Count -gt 0) {
    $FASHION_CAT_ID = @($cats)[0].id
}
Write-Host "Using Category ID: $FASHION_CAT_ID"

Write-Host "`n--- TEST 1: SIMPLE PRODUCT INITIAL STOCK (25 units) ---"
$simpleProdRes = Invoke-Api -Method Post -Path "/businesses/$BIZ_ID/products" -Body @{
    name = "BTMI Simple Stock Product $uniq"
    sku = "SMPL-STK-01"
    unit = "PCS"
    unit_price = 2500
    category_id = $FASHION_CAT_ID
    publication_status = "PUBLISHED"
} -Token $TOKEN
$SIMPLE_PROD_ID = $simpleProdRes.body.data.id
Check "Simple Product Created" "True" ($null -ne $SIMPLE_PROD_ID)

# Fetch default variant created automatically
$variantsRes = Invoke-Api -Method Get -Path "/businesses/$BIZ_ID/products/$SIMPLE_PROD_ID/variants" -Token $TOKEN
$DEFAULT_VARIANT_ID = @($variantsRes.body.data)[0].id
Check "Default Variant Created" "True" ($null -ne $DEFAULT_VARIANT_ID)

# Add initial stock of 25 to Shop 1
$addStockRes1 = Invoke-Api -Method Post -Path "/shops/$SHOP_1/stock" -Body @{
    variant_id = $DEFAULT_VARIANT_ID
    quantity = 25
    notes = "Initial stock"
} -Token $TOKEN
Check "Stock Added to Shop 1" "25" ($addStockRes1.body.data.quantity.ToString())

# Verify DB inventory record
$dbQty = Sql "SELECT quantity FROM inventory WHERE shop_id = '$SHOP_1' AND variant_id = '$DEFAULT_VARIANT_ID';"
Check "DB Inventory Quantity = 25" "25" $dbQty

# Verify stock_movements has INITIAL
$dbMovement = Sql "SELECT movement_type FROM stock_movements WHERE shop_id = '$SHOP_1' AND variant_id = '$DEFAULT_VARIANT_ID' ORDER BY created_at ASC LIMIT 1;"
Check "First Movement is INITIAL" "INITIAL" $dbMovement

# Add additional stock of 10 to test subsequent movement is STOCK_IN
$addStockRes2 = Invoke-Api -Method Post -Path "/shops/$SHOP_1/stock" -Body @{
    variant_id = $DEFAULT_VARIANT_ID
    quantity = 10
    notes = "Restock"
} -Token $TOKEN
$dbMovement2 = Sql "SELECT movement_type FROM stock_movements WHERE shop_id = '$SHOP_1' AND variant_id = '$DEFAULT_VARIANT_ID' ORDER BY created_at DESC LIMIT 1;"
Check "Subsequent Movement is STOCK_IN" "STOCK_IN" $dbMovement2

# Check Buyer Product Detail for simple product
$buyerProdRes = Invoke-Api -Method Get -Path "/marketplace/products/$SIMPLE_PROD_ID"
$buyerProd = $buyerProdRes.body.data
Check "Buyer Sees Simple Product Available" "AVAILABLE" (@($buyerProd.variants)[0].stock)
Check "Buyer Sees 35 Available Units" "35" (@($buyerProd.variants)[0].stock_quantity.ToString())

Write-Host "`n--- TEST 2: MULTI-VARIANT PRODUCT INITIAL STOCK (Section 40.16) ---"
$multiProdRes = Invoke-Api -Method Post -Path "/businesses/$BIZ_ID/products" -Body @{
    name = "BTMI Stock Test T-Shirt"
    sku = "TSH-STOCK-TEST"
    unit = "PCS"
    unit_price = 15000
    category_id = $FASHION_CAT_ID
    publication_status = "PUBLISHED"
} -Token $TOKEN
$MULTI_PROD_ID = $multiProdRes.body.data.id
Check "Multi-Variant Product Created" "True" ($null -ne $MULTI_PROD_ID) $multiProdRes

# Get default variant to update to Black / M
$multiVars = (Invoke-Api -Method Get -Path "/businesses/$BIZ_ID/products/$MULTI_PROD_ID/variants" -Token $TOKEN).body.data
$VAR1_ID = @($multiVars)[0].id

# Update default variant to Black / M
Invoke-Api -Method Patch -Path "/variants/$VAR1_ID" -Body @{
    name = "Black / M"
    sku = "TSH-BLK-M"
    sale_price = 15000
} -Token $TOKEN

# Create Variant 2: Black / L
$v2Res = Invoke-Api -Method Post -Path "/businesses/$BIZ_ID/products/$MULTI_PROD_ID/variants" -Body @{
    name = "Black / L"
    sku = "TSH-BLK-L"
    sale_price = 15000
} -Token $TOKEN
$VAR2_ID = $v2Res.body.data.id

# Create Variant 3: White / M
$v3Res = Invoke-Api -Method Post -Path "/businesses/$BIZ_ID/products/$MULTI_PROD_ID/variants" -Body @{
    name = "White / M"
    sku = "TSH-WHT-M"
    sale_price = 16000
} -Token $TOKEN
$VAR3_ID = $v3Res.body.data.id

Check "Variant 1 (Black / M) ID" "True" ($null -ne $VAR1_ID)
Check "Variant 2 (Black / L) ID" "True" ($null -ne $VAR2_ID)
Check "Variant 3 (White / M) ID" "True" ($null -ne $VAR3_ID)

# Add Initial Stock in Shop 1:
# Black / M = 10
# Black / L = 5
# White / M = 3
Invoke-Api -Method Post -Path "/shops/$SHOP_1/stock" -Body @{ variant_id = $VAR1_ID; quantity = 10; notes = "Initial stock" } -Token $TOKEN
Invoke-Api -Method Post -Path "/shops/$SHOP_1/stock" -Body @{ variant_id = $VAR2_ID; quantity = 5; notes = "Initial stock" } -Token $TOKEN
Invoke-Api -Method Post -Path "/shops/$SHOP_1/stock" -Body @{ variant_id = $VAR3_ID; quantity = 3; notes = "Initial stock" } -Token $TOKEN

# Verify DB Inventory quantities
$q1 = Sql "SELECT quantity FROM inventory WHERE shop_id = '$SHOP_1' AND variant_id = '$VAR1_ID';"
$q2 = Sql "SELECT quantity FROM inventory WHERE shop_id = '$SHOP_1' AND variant_id = '$VAR2_ID';"
$q3 = Sql "SELECT quantity FROM inventory WHERE shop_id = '$SHOP_1' AND variant_id = '$VAR3_ID';"
Check "DB Inventory Black/M = 10" "10" $q1
Check "DB Inventory Black/L = 5" "5" $q2
Check "DB Inventory White/M = 3" "3" $q3

# Verify INITIAL movements recorded
$m1 = Sql "SELECT movement_type FROM stock_movements WHERE shop_id = '$SHOP_1' AND variant_id = '$VAR1_ID' LIMIT 1;"
$m2 = Sql "SELECT movement_type FROM stock_movements WHERE shop_id = '$SHOP_1' AND variant_id = '$VAR2_ID' LIMIT 1;"
$m3 = Sql "SELECT movement_type FROM stock_movements WHERE shop_id = '$SHOP_1' AND variant_id = '$VAR3_ID' LIMIT 1;"
Check "Movement 1 INITIAL" "INITIAL" $m1
Check "Movement 2 INITIAL" "INITIAL" $m2
Check "Movement 3 INITIAL" "INITIAL" $m3

# Verify Seller Product List summary
$sellerProdList = (Invoke-Api -Method Get -Path "/businesses/$BIZ_ID/products" -Token $TOKEN).body.data
$foundMulti = (@($sellerProdList) | Where-Object { $_.id -eq $MULTI_PROD_ID })[0]
Check "Seller List Total Quantity = 18" "18" ($foundMulti.total_quantity.ToString())
Check "Seller List Variant Count = 3" "3" ($foundMulti.variant_count.ToString())

# Verify Buyer Marketplace Product Detail
$buyerDetail = (Invoke-Api -Method Get -Path "/marketplace/products/$MULTI_PROD_ID").body.data
Check "Buyer Marketplace Variant Count = 3" "3" (@($buyerDetail.variants).Count.ToString())
$buyerV1 = (@($buyerDetail.variants) | Where-Object { $_.id -eq $VAR1_ID })[0]
$buyerV2 = (@($buyerDetail.variants) | Where-Object { $_.id -eq $VAR2_ID })[0]
$buyerV3 = (@($buyerDetail.variants) | Where-Object { $_.id -eq $VAR3_ID })[0]
Check "Buyer Sees Black/M = 10" "10" ($buyerV1.stock_quantity.ToString())
Check "Buyer Sees Black/L = 5" "5" ($buyerV2.stock_quantity.ToString())
Check "Buyer Sees White/M = 3" "3" ($buyerV3.stock_quantity.ToString())

Write-Host "`n--- TEST 3: MULTI-SHOP STOCK AGGREGATION ---"
# Add 7 units of Black / M to Shop 2
Invoke-Api -Method Post -Path "/shops/$SHOP_2/stock" -Body @{ variant_id = $VAR1_ID; quantity = 7; notes = "Stock for Gombe branch" } -Token $TOKEN

# Verify Seller Product List reflects total across both shops (10 + 7 + 5 + 3 = 25)
$sellerProdList2 = (Invoke-Api -Method Get -Path "/businesses/$BIZ_ID/products" -Token $TOKEN).body.data
$foundMulti2 = (@($sellerProdList2) | Where-Object { $_.id -eq $MULTI_PROD_ID })[0]
Check "Seller List Aggregate Total Stock = 25" "25" ($foundMulti2.total_quantity.ToString())

# Verify Buyer Marketplace returns exactly 3 variant rows (no duplication from JOINs) and Black/M stock = 17
$buyerDetail2 = (Invoke-Api -Method Get -Path "/marketplace/products/$MULTI_PROD_ID").body.data
Check "Buyer Marketplace Variant Count Remains 3 (No Duplicate Rows)" "3" (@($buyerDetail2.variants).Count.ToString())
$buyerV1_multi = (@($buyerDetail2.variants) | Where-Object { $_.id -eq $VAR1_ID })[0]
Check "Buyer Sees Aggregate Black/M = 17" "17" ($buyerV1_multi.stock_quantity.ToString())

Write-Host "`n--- TEST 4: RESERVED VS AVAILABLE STOCK ---"
# Reserve 4 units of Black / M in Shop 1
Invoke-Api -Method Post -Path "/shops/$SHOP_1/reserve" -Body @{ variant_id = $VAR1_ID; quantity = 4 } -Token $TOKEN

# Verify DB has reserved_quantity = 4 in Shop 1
$resQty = Sql "SELECT reserved_quantity FROM inventory WHERE shop_id = '$SHOP_1' AND variant_id = '$VAR1_ID';"
Check "DB Reserved Quantity = 4" "4" $resQty

# Verify Seller Product List reflects Available (21) vs Total (25) vs Reserved (4)
$sellerProdList3 = (Invoke-Api -Method Get -Path "/businesses/$BIZ_ID/products" -Token $TOKEN).body.data
$foundMulti3 = (@($sellerProdList3) | Where-Object { $_.id -eq $MULTI_PROD_ID })[0]
Check "Seller Total Quantity = 25" "25" ($foundMulti3.total_quantity.ToString())
Check "Seller Reserved Quantity = 4" "4" ($foundMulti3.reserved_quantity.ToString())
Check "Seller Available Quantity = 21" "21" ($foundMulti3.available_quantity.ToString())

# Verify Buyer sees Black/M available = 13 (17 total - 4 reserved)
$buyerDetail3 = (Invoke-Api -Method Get -Path "/marketplace/products/$MULTI_PROD_ID").body.data
$buyerV1_res = (@($buyerDetail3.variants) | Where-Object { $_.id -eq $VAR1_ID })[0]
Check "Buyer Available Quantity for Black/M = 13" "13" ($buyerV1_res.stock_quantity.ToString())

Write-Host "`n--- TEST 5: ZERO STOCK PRODUCT ---"
$zeroProdRes = Invoke-Api -Method Post -Path "/businesses/$BIZ_ID/products" -Body @{
    name = "BTMI Zero Stock Product $(Get-Random -Minimum 1000 -Maximum 9999)"
    sku = "ZERO-STK"
    unit = "PCS"
    unit_price = 5000
    publication_status = "PUBLISHED"
} -Token $TOKEN
$ZERO_PROD_ID = $zeroProdRes.body.data.id

$zeroBuyerDetail = (Invoke-Api -Method Get -Path "/marketplace/products/$ZERO_PROD_ID").body.data
Check "Zero Stock Availability is OUT_OF_STOCK" "OUT_OF_STOCK" (@($zeroBuyerDetail.variants)[0].stock)
Check "Zero Stock Variant quantity = 0" "0" (@($zeroBuyerDetail.variants)[0].stock_quantity.ToString())

Write-Host "`n=========================================="
Write-Host "TEST SUITE SUMMARY: PASS=$script:PASS, FAIL=$script:FAIL"
Write-Host "=========================================="
if ($script:FAIL -eq 0) {
    Write-Host "ALL TESTS PASSED PERFECTLY!" -ForegroundColor Green
} else {
    Write-Host "SOME TESTS FAILED." -ForegroundColor Red
}
