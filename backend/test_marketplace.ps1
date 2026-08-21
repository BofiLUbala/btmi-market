$ErrorActionPreference = "Continue"
$BASE = "http://localhost:8080/api/v1"
$PASS = 0
$FAIL = 0
$DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

function Check {
    param([string]$Name, [string]$Expected, [string]$Actual)
    if ($Actual -match [regex]::Escape($Expected)) {
        Write-Host "  PASS: $Name"; $script:PASS++
    } else {
        Write-Host "  FAIL: $Name"
        $short = if ($Actual.Length -gt 120) { $Actual.Substring(0,120) } else { $Actual }
        Write-Host "    Got: $short"; $script:FAIL++
    }
}

function Post {
    param([string]$Url, [string]$Json, [string]$Token)
    $tmp = Join-Path $env:TEMP "req_$([guid]::NewGuid().ToString('N')).json"
    [System.IO.File]::WriteAllText($tmp, $Json, [System.Text.UTF8Encoding]::new($false))
    try {
        $args_ = @("-s", "-X", "POST", $Url, "-H", "Content-Type: application/json")
        if ($Token) { $args_ += "-H"; $args_ += "Authorization: Bearer $Token" }
        $args_ += "--data-binary"; $args_ += "@$tmp"
        return & curl.exe @args_
    } finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
}

function PostPatch {
    param([string]$Url, [string]$Json, [string]$Token)
    $tmp = Join-Path $env:TEMP "req_$([guid]::NewGuid().ToString('N')).json"
    [System.IO.File]::WriteAllText($tmp, $Json, [System.Text.UTF8Encoding]::new($false))
    try {
        $args_ = @("-s", "-X", "PATCH", $Url, "-H", "Content-Type: application/json")
        if ($Token) { $args_ += "-H"; $args_ += "Authorization: Bearer $Token" }
        $args_ += "--data-binary"; $args_ += "@$tmp"
        return & curl.exe @args_
    } finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
}

function Get_ {
    param([string]$Url, [string]$Token)
    $args_ = @("-s", $Url)
    if ($Token) { $args_ += "-H"; $args_ += "Authorization: Bearer $Token" }
    return & curl.exe @args_
}

function Sql {
    param([string]$Query)
    $result = docker compose exec -T postgres psql -U btmi_user -d btmi_market -t -A -c $Query 2>$null
    if ($null -eq $result) { return "" }
    return $result.Trim()
}

# ===== SETUP: Create Business & Shop =====
Write-Host "=== SETUP ==="
$loginResp = Post "$BASE/auth/login" ([System.IO.File]::ReadAllText("$DIR\login.json"))
$TOKEN = ($loginResp | ConvertFrom-Json).access_token
Write-Host "Seller token OK"

# Clean up previous test data if any
Sql "DELETE FROM products WHERE name LIKE '%Marketplace%';" | Out-Null

$bizBody = [System.IO.File]::ReadAllText("$DIR\biz.json")
$bizResp = Post "$BASE/businesses" $bizBody $TOKEN
$BIZ_ID = ($bizResp | ConvertFrom-Json).data.id
Write-Host "Business: $BIZ_ID"

$shopBody = [System.IO.File]::ReadAllText("$DIR\shop.json")
$shopResp = Post "$BASE/businesses/$BIZ_ID/shops" $shopBody $TOKEN
$SHOP_ID = ($shopResp | ConvertFrom-Json).data.id
Write-Host "Shop: $SHOP_ID"

# ===== TEST 1: Category System =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 1: Category API"
Write-Host "==========================================="
$resp = Get_ "$BASE/categories?with_subcategories=true"
Check "List categories" "Categories retrieved" $resp
Check "Fashion category" "Fashion" $resp
Check "Shoes subcategory" "Shoes" $resp

$resp = Get_ "$BASE/marketplace/categories"
Check "Marketplace categories" "Categories" $resp

$resp = Get_ "$BASE/marketplace/categories/fashion/subcategories"
Check "Marketplace subcategories" "Subcategories" $resp
Check "Shoes in fashion" "Shoes" $resp

$resp = Get_ "$BASE/categories"
Check "Seller categories" "Categories" $resp

# ===== TEST 2: Product Creation with Category =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 2: Create Product with Category"
Write-Host "==========================================="
$FASHION_ID = Sql "SELECT id FROM categories WHERE slug='fashion';"
$SHOES_ID = Sql "SELECT id FROM subcategories WHERE category_id='$FASHION_ID' AND slug='shoes';"
Write-Host "Fashion: $FASHION_ID, Shoes: $SHOES_ID"

# Create product in DRAFT
$prodBody = (@{name="Marketplace Nike Air"; sku="MP-NIKE-001"; description="Test product for marketplace"; unit_price=120000; cost_price=60000; unit="PCS"; category_id=$FASHION_ID; subcategory_id=$SHOES_ID; publication_status="DRAFT"} | ConvertTo-Json -Compress -Depth 5)
$resp = Post "$BASE/businesses/$BIZ_ID/products" $prodBody $TOKEN
Check "Product created" "Product created" $resp
$MP_PRODUCT_ID = ($resp | ConvertFrom-Json).data.id
Write-Host "Product: $MP_PRODUCT_ID"

# ===== TEST 3: Draft Not Visible =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 3: DRAFT Product Not Visible"
Write-Host "==========================================="
$resp = Get_ "$BASE/marketplace/search?q=Marketplace"
if ($resp -notmatch "Marketplace Nike Air") {
    Check "Draft not visible in search" "NOT FOUND" "NOT FOUND"
} else {
    Check "Draft not visible in search" "NOT FOUND" "STILL VISIBLE"
}

$resp = Get_ "$BASE/marketplace/categories/fashion/products"
if ($resp -match "Marketplace Nike Air") {
    Check "Draft not in category products" "NOT FOUND" "STILL VISIBLE"
} else {
    Check "Draft not in category products" "PASS" "PASS"
}

# ===== TEST 4: Publish Product =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 4: Publish and Verify"
Write-Host "==========================================="
$resp = PostPatch "$BASE/businesses/$BIZ_ID/products/$MP_PRODUCT_ID" (@{publication_status="PUBLISHED"} | ConvertTo-Json -Compress) $TOKEN
Check "Publish product" "Product updated" $resp

Start-Sleep -Seconds 1

$resp = Get_ "$BASE/marketplace/products/$MP_PRODUCT_ID"
Check "Published product visible" "Marketplace Nike Air" $resp
Check "Has category" "category_id" $resp
Check "Has subcategory" "subcategory_id" $resp

$resp = Get_ "$BASE/marketplace/categories/fashion/products"
Check "Visible in category browse" "Marketplace Nike Air" $resp

$resp = Get_ "$BASE/marketplace/search?q=Marketplace"
Check "Visible in search" "Marketplace Nike Air" $resp

# ===== TEST 5: Category Search =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 5: Category-Specific Search"
Write-Host "==========================================="
$resp = Get_ "$BASE/marketplace/search?q=Nike&category=fashion"
Check "Search by category" "Marketplace Nike Air" $resp

# Test invalid category/subcategory combination
$ELEC_ID = Sql "SELECT id FROM categories WHERE slug='electronics';"
$resp = Post "$BASE/businesses/$BIZ_ID/products" (@{name="Invalid Test Product"; sku="MP-INVALID"; unit_price=100000; category_id=$FASHION_ID; subcategory_id="$ELEC_ID-phones"} | ConvertTo-Json -Compress) $TOKEN
# This should fail because we need the actual subcategory ID, not a made-up one

# ===== TEST 6: Invalid Subcategory =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 6: Invalid Subcategory"
Write-Host "==========================================="
$resp = Post "$BASE/businesses/$BIZ_ID/products" (@{name="Invalid Cat Product"; sku="MP-INVALID-001"; unit_price=100000; category_id=$ELEC_ID; subcategory_id=$SHOES_ID; publication_status="PUBLISHED"} | ConvertTo-Json -Compress) $TOKEN
Check "Invalid subcategory rejected" "INVALID_SUBCATEGORY" $resp

# ===== TEST 7: Seller Ranking in Search =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 7: Seller Ranking in Search"
Write-Host "==========================================="
$resp = Get_ "$BASE/marketplace/search?q=Nike&sort=seller_level"
Check "Search with seller ranking" "Marketplace Nike Air" $resp
Check "Has seller level" "seller_level" $resp

# ===== TEST 8: Buyer Price Benefit =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 8: Buyer Price Benefit"
Write-Host "==========================================="
# First add stock so price endpoint works
$STOCK = Get_ "$BASE/businesses/$BIZ_ID/products/$MP_PRODUCT_ID/variants" $TOKEN
$VARIANT_ID = ($STOCK | ConvertFrom-Json).data[0].id
Write-Host "Variant: $VARIANT_ID"

$stockJson = (@{variant_id=$VARIANT_ID; quantity=50; notes="Marketplace stock"} | ConvertTo-Json -Compress)
Post "$BASE/shops/$SHOP_ID/stock" $stockJson $TOKEN | Out-Null
Write-Host "Stock added"

Start-Sleep -Seconds 1

# Anonymous buyer - no token
$resp = Get_ "$BASE/marketplace/products/$MP_PRODUCT_ID/price"
Check "Anonymous base price" "base_price" $resp

# Set buyer to GOLD level for discount test
$loginResp2 = Post "$BASE/auth/login" ([System.IO.File]::ReadAllText("$DIR\login_buyer.json"))
$BTOKEN = ($loginResp2 | ConvertFrom-Json).access_token
Write-Host "Buyer token OK"

Sql "UPDATE point_accounts SET current_points=5000, lifetime_points=5000 WHERE owner_type='BUYER' AND owner_id=(SELECT id FROM buyer_profiles WHERE user_id=(SELECT id FROM users WHERE email='buyer99@test.com'));" | Out-Null

Start-Sleep -Seconds 1

$resp = Get_ "$BASE/marketplace/products/$MP_PRODUCT_ID/price" $BTOKEN
Check "Buyer price with level" "buyer_level" $resp
Check "Final price calculated" "final_price" $resp

# ===== TEST 9: Archive Product =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 9: Archive Product"
Write-Host "==========================================="
$resp = PostPatch "$BASE/businesses/$BIZ_ID/products/$MP_PRODUCT_ID" (@{publication_status="ARCHIVED"} | ConvertTo-Json -Compress) $TOKEN

Start-Sleep -Seconds 1
$resp = Get_ "$BASE/marketplace/products/$MP_PRODUCT_ID"
Check "Archived product not visible" "PRODUCT_NOT_FOUND" $resp

$resp = Get_ "$BASE/marketplace/search?q=Marketplace"
if ($resp -match "Marketplace Nike Air") {
    Check "Archived removed from search" "NOT FOUND" "STILL VISIBLE"
} else {
    Check "Archived removed from search" "PASS" "PASS"
}

# ===== TEST 10: No Internal Data Leakage =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 10: No Internal Data Leakage"
Write-Host "==========================================="
# Re-publish to test
PostPatch "$BASE/businesses/$BIZ_ID/products/$MP_PRODUCT_ID" (@{publication_status="PUBLISHED"} | ConvertTo-Json -Compress) $TOKEN | Out-Null
Start-Sleep -Seconds 1
$resp = Get_ "$BASE/marketplace/products/$MP_PRODUCT_ID"
Check "Product visible" "Marketplace Nike Air" $resp
if ($resp -notmatch "cost_price") {
    Check "No cost_price leaked" "PASS" "PASS"
} else {
    Check "No cost_price leaked" "cost_price should not be present" $resp
}
if ($resp -notmatch "purchase_price") {
    Check "No purchase_price leaked" "PASS" "PASS"
} else {
    Check "No purchase_price leaked" "purchase_price should not be present" $resp
}

# ===== SUMMARY =====
Write-Host ""
Write-Host "==========================================="
Write-Host "SUMMARY: $PASS passed, $FAIL failed"
Write-Host "==========================================="
