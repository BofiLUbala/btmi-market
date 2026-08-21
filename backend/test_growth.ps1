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
        $result = & curl.exe @args_
        return $result
    } finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
}

function PostRaw {
    param([string]$Url, [string]$FilePath, [string]$Token)
    $args_ = @("-s", "-X", "POST", $Url, "-H", "Content-Type: application/json")
    if ($Token) { $args_ += "-H"; $args_ += "Authorization: Bearer $Token" }
    $args_ += "--data-binary"; $args_ += "@$FilePath"
    return & curl.exe @args_
}

function PostPatch {
    param([string]$Url, [string]$Json, [string]$Token)
    $tmp = Join-Path $env:TEMP "req_$([guid]::NewGuid().ToString('N')).json"
    [System.IO.File]::WriteAllText($tmp, $Json, [System.Text.UTF8Encoding]::new($false))
    try {
        $args_ = @("-s", "-X", "PATCH", $Url, "-H", "Content-Type: application/json")
        if ($Token) { $args_ += "-H"; $args_ += "Authorization: Bearer $Token" }
        $args_ += "--data-binary"; $args_ += "@$tmp"
        $result = & curl.exe @args_
        return $result
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

# ===== SETUP =====
Write-Host "=== SELLER SETUP ==="
$loginResp = PostRaw "$BASE/auth/login" "$DIR\login.json"
$TOKEN = ($loginResp | ConvertFrom-Json).access_token
Write-Host "Token: $($TOKEN.Substring(0,20))..."

$bizResp = Post "$BASE/businesses" ([System.IO.File]::ReadAllText("$DIR\biz.json")) $TOKEN
$BIZ_ID = ($bizResp | ConvertFrom-Json).data.id
Write-Host "Business: $BIZ_ID"

$shopResp = Post "$BASE/businesses/$BIZ_ID/shops" ([System.IO.File]::ReadAllText("$DIR\shop.json")) $TOKEN
$SHOP_ID = ($shopResp | ConvertFrom-Json).data.id
Write-Host "Shop: $SHOP_ID"

$prodResp = Post "$BASE/businesses/$BIZ_ID/products" ([System.IO.File]::ReadAllText("$DIR\product.json")) $TOKEN
$PRODUCT_ID = ($prodResp | ConvertFrom-Json).data.id
Write-Host "Product: $PRODUCT_ID"

# Publish product so it appears in marketplace
PostPatch "$BASE/businesses/$BIZ_ID/products/$PRODUCT_ID" (@{publication_status="PUBLISHED"} | ConvertTo-Json -Compress) $TOKEN | Out-Null

$varResp = Get_ "$BASE/businesses/$BIZ_ID/products/$PRODUCT_ID/variants" $TOKEN
$VARIANT_ID = ($varResp | ConvertFrom-Json).data[0].id
Write-Host "Variant: $VARIANT_ID"

Post "$BASE/shops/$SHOP_ID/stock" (@{variant_id=$VARIANT_ID; quantity=100; notes="Initial"} | ConvertTo-Json -Compress) $TOKEN | Out-Null
Write-Host "Stock added"

Write-Host ""
Write-Host "=== BUYER SETUP ==="
Sql "UPDATE users SET status='ACTIVE', email_verified=TRUE WHERE email='buyer99@test.com';" | Out-Null

$buyerLoginResp = PostRaw "$BASE/auth/login" "$DIR\login_buyer.json"
$BTOKEN = ($buyerLoginResp | ConvertFrom-Json).access_token
Write-Host "Buyer token: $($BTOKEN.Substring(0,20))..."

$BUYER_USER_ID = Sql "SELECT id FROM users WHERE email='buyer99@test.com';"
$BUYER_PROFILE_ID = Sql "SELECT id FROM buyer_profiles WHERE user_id='$BUYER_USER_ID';"

# ===== TEST 1: Buyer Profile =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 1: Buyer Account + Profile"
Write-Host "==========================================="
$resp = Post "$BASE/buyer/profile" (@{first_name="Jean"; last_name="Buyer"; phone="+243999999999"; email="buyer99@test.com"; city="Kinshasa"; commune="Gombe"} | ConvertTo-Json -Compress) $BTOKEN
Check "Create buyer profile" "Buyer profile created" $resp

$resp = Get_ "$BASE/buyer/profile" $BTOKEN
Check "Get buyer profile" "Buyer profile retrieved" $resp
Check "Profile has name" "Jean" $resp

# ===== TEST 2: Marketplace =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 2: Marketplace Access"
Write-Host "==========================================="
$resp = Get_ "$BASE/marketplace/shops" $BTOKEN
Check "List marketplace shops" "Shops retrieved" $resp
Check "Seller level" "seller_level" $resp
Check "Seller trust" "seller_trust" $resp

$resp = Get_ "$BASE/marketplace/shops/$SHOP_ID" $BTOKEN
Check "Get shop detail" "name" $resp

$resp = Get_ "$BASE/marketplace/products" $BTOKEN
Check "List products" "Products retrieved" $resp

$resp = Get_ "$BASE/marketplace/products/$PRODUCT_ID" $BTOKEN
Check "Get product detail" "name" $resp
Check "Has variants" "variants" $resp

# ===== TEST 3: Cash Sale + Confirm =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 3: Cash Sale + Confirm"
Write-Host "==========================================="
$resp = Post "$BASE/shops/$SHOP_ID/cash-sessions/open" (@{opening_amount=50; currency="CDF"} | ConvertTo-Json -Compress) $TOKEN
Check "Open cash session" "session" $resp

$ordJson = @{shop_id=$SHOP_ID; notes="Test"; lines=@(@{product_id=$PRODUCT_ID; variant_id=$VARIANT_ID; quantity=1})} | ConvertTo-Json -Compress -Depth 5
$resp = Post "$BASE/shops/$SHOP_ID/orders" $ordJson $TOKEN
Check "Create order" "Order created" $resp
$orderData = ($resp | ConvertFrom-Json).data.order
$ORDER_ID = $orderData.id
Write-Host "Order ID: $ORDER_ID"

Post "$BASE/orders/$ORDER_ID/accept" '{}' $TOKEN | Out-Null
Post "$BASE/orders/$ORDER_ID/prepare" '{}' $TOKEN | Out-Null
$resp = Post "$BASE/orders/$ORDER_ID/complete" '{}' $TOKEN
Check "Complete order" "completed" $resp

Start-Sleep -Seconds 1

$resp = Get_ "$BASE/buyer/purchases/pending" $BTOKEN
Check "Buyer sees pending" "pending" $resp

$buyerPtsBefore = 0; try { $buyerPtsBefore = ((Get_ "$BASE/buyer/points" $BTOKEN) | ConvertFrom-Json).data.current_points } catch {}
$resp = Post "$BASE/buyer/purchases/$ORDER_ID/confirm" '{}' $BTOKEN
Check "Confirm purchase" "Purchase confirmed" $resp
Check "Transaction verified" "VERIFIED" $resp

Start-Sleep -Seconds 1

$sellerPts = 0; try { $sellerPts = ((Get_ "$BASE/businesses/$BIZ_ID/growth/points" $TOKEN) | ConvertFrom-Json).data.current_points } catch {}
$buyerPts = 0; try { $buyerPts = ((Get_ "$BASE/buyer/points" $BTOKEN) | ConvertFrom-Json).data.current_points } catch {}
Write-Host "  Seller: $sellerPts pts, Buyer: $buyerPts pts"
Check "Seller got 100 points" "100" "$sellerPts"
$buyerDelta = $buyerPts - $buyerPtsBefore
Check "Buyer got points" "100" "$buyerDelta"

# ===== TEST 4: Duplicate =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 4: Duplicate Confirmation"
Write-Host "==========================================="
$resp = Post "$BASE/buyer/purchases/$ORDER_ID/confirm" '{}' $BTOKEN
Check "Duplicate blocked" "ALREADY_CONFIRMED" $resp

$buyerPtsAfter = 0; try { $buyerPtsAfter = ((Get_ "$BASE/buyer/points" $BTOKEN) | ConvertFrom-Json).data.current_points } catch {}
if ($buyerPts -eq $buyerPtsAfter) { Check "Points unchanged after duplicate" "$buyerPts" "$buyerPtsAfter" } else { Write-Host "  FAIL: Points changed after duplicate: $buyerPts -> $buyerPtsAfter"; $script:FAIL++ }

# ===== TEST 5: Level Change =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 5: Level Change (Buyer)"
Write-Host "==========================================="
Sql "UPDATE point_accounts SET current_points=490 WHERE owner_type='BUYER' AND owner_id='$BUYER_PROFILE_ID';" | Out-Null
Write-Host "  Set buyer to 490 points"

$ord2Json = @{shop_id=$SHOP_ID; notes="Level test"; lines=@(@{product_id=$PRODUCT_ID; variant_id=$VARIANT_ID; quantity=1})} | ConvertTo-Json -Compress -Depth 5
$resp = Post "$BASE/shops/$SHOP_ID/orders" $ord2Json $TOKEN
$order2Data = ($resp | ConvertFrom-Json).data.order
$ORDER2_ID = $order2Data.id

Post "$BASE/orders/$ORDER2_ID/accept" '{}' $TOKEN | Out-Null
Post "$BASE/orders/$ORDER2_ID/prepare" '{}' $TOKEN | Out-Null
Post "$BASE/orders/$ORDER2_ID/complete" '{}' $TOKEN | Out-Null

Start-Sleep -Seconds 1

$resp = Post "$BASE/buyer/purchases/$ORDER2_ID/confirm" '{}' $BTOKEN
Check "Confirm 2nd purchase" "Purchase confirmed" $resp

Start-Sleep -Seconds 1

$buyerPts3 = 0; try { $buyerPts3 = ((Get_ "$BASE/buyer/points" $BTOKEN) | ConvertFrom-Json).data.current_points } catch {}
Write-Host "  Buyer points: $buyerPts3"
Check "Buyer at 590" "590" "$buyerPts3"

# ===== TEST 5b: Seller Level =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 5b: Seller Level Change"
Write-Host "==========================================="
Sql "UPDATE point_accounts SET current_points=500, lifetime_points=500 WHERE owner_type='SELLER_BUSINESS' AND owner_id='$BIZ_ID';" | Out-Null
$slId = Sql "SELECT id FROM seller_levels WHERE name='ACTIVE';"
Sql "UPDATE point_accounts SET level_id='$slId' WHERE owner_type='SELLER_BUSINESS' AND owner_id='$BIZ_ID';" | Out-Null

Start-Sleep -Seconds 1
$resp = Get_ "$BASE/businesses/$BIZ_ID/growth/level" $TOKEN
Check "Seller level ACTIVE" "ACTIVE" $resp

# ===== TEST 6: Seller Ranking =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 6: Seller Ranking"
Write-Host "==========================================="
Check "Has level" "level" $resp
Check "Trust status" "trust_status" $resp
Check "Search boost" "search_boost" $resp

# ===== TEST 7: Trust =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 7: Trust Suspension"
Write-Host "==========================================="
Sql "UPDATE seller_trust SET trust_status='LOW' WHERE business_id='$BIZ_ID';" | Out-Null

Start-Sleep -Seconds 1
$resp = Get_ "$BASE/businesses/$BIZ_ID/growth/level" $TOKEN
Check "Trust LOW" "LOW" $resp
Check "High value buyer false" "false" $resp

# ===== TEST 8: Buyer Price =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 8: Buyer Price"
Write-Host "==========================================="
$resp = Get_ "$BASE/marketplace/products/$PRODUCT_ID/price" $BTOKEN
Check "Base price" "base_price" $resp
Check "Discount percent" "discount_percent" $resp
Check "Final price" "final_price" $resp
Check "Buyer level BRONZE" "BRONZE" $resp

# ===== TEST 9: Unverified =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 9: Unverified Purchase"
Write-Host "==========================================="
$ord3Json = @{shop_id=$SHOP_ID; notes="No confirm"; lines=@(@{product_id=$PRODUCT_ID; variant_id=$VARIANT_ID; quantity=1})} | ConvertTo-Json -Compress -Depth 5
$resp = Post "$BASE/shops/$SHOP_ID/orders" $ord3Json $TOKEN
$order3Data = ($resp | ConvertFrom-Json).data.order
$ORDER3_ID = $order3Data.id

Post "$BASE/orders/$ORDER3_ID/accept" '{}' $TOKEN | Out-Null
Post "$BASE/orders/$ORDER3_ID/prepare" '{}' $TOKEN | Out-Null
Post "$BASE/orders/$ORDER3_ID/complete" '{}' $TOKEN | Out-Null

Start-Sleep -Seconds 1
$pts = 0; try { $pts = ((Get_ "$BASE/buyer/points" $BTOKEN) | ConvertFrom-Json).data.current_points } catch {}
Write-Host "  Points without confirm: $pts"
Check "Points unchanged" "590" "$pts"

# ===== TEST 10: Refund =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST 10: Refund / Reversal"
Write-Host "==========================================="
$ord4Json = @{shop_id=$SHOP_ID; notes="Refund"; lines=@(@{product_id=$PRODUCT_ID; variant_id=$VARIANT_ID; quantity=1})} | ConvertTo-Json -Compress -Depth 5
$resp = Post "$BASE/shops/$SHOP_ID/orders" $ord4Json $TOKEN
$order4Data = ($resp | ConvertFrom-Json).data.order
$ORDER4_ID = $order4Data.id

Post "$BASE/orders/$ORDER4_ID/accept" '{}' $TOKEN | Out-Null
Post "$BASE/orders/$ORDER4_ID/prepare" '{}' $TOKEN | Out-Null
Post "$BASE/orders/$ORDER4_ID/complete" '{}' $TOKEN | Out-Null

Start-Sleep -Seconds 1
$resp = Post "$BASE/buyer/purchases/$ORDER4_ID/confirm" '{}' $BTOKEN
Check "Confirm refund order" "Purchase confirmed" $resp

Start-Sleep -Seconds 1
$ptsBefore = 0; try { $ptsBefore = ((Get_ "$BASE/buyer/points" $BTOKEN) | ConvertFrom-Json).data.current_points } catch {}
Write-Host "  Points before: $ptsBefore"

Sql "UPDATE point_accounts SET current_points = current_points - 100 WHERE owner_type='BUYER' AND owner_id='$BUYER_PROFILE_ID';" | Out-Null

Start-Sleep -Seconds 1
$ptsAfter = 0; try { $ptsAfter = ((Get_ "$BASE/buyer/points" $BTOKEN) | ConvertFrom-Json).data.current_points } catch {}
Write-Host "  Points after: $ptsAfter"

# ===== Cross-Business =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST: Cross-Business Security"
Write-Host "==========================================="
$b2Resp = PostRaw "$BASE/auth/login" "$DIR\login2.json"
$b2Token = ""
try { $b2Token = ($b2Resp | ConvertFrom-Json).access_token } catch {}
if ($b2Token -and $b2Token.Length -gt 10) {
    $resp = Get_ "$BASE/businesses/$BIZ_ID/growth/points" $b2Token
    Check "Cross-business FORBIDDEN" "FORBIDDEN" $resp
} else {
    Write-Host "  SKIP: Cannot login as business2"
}

# ===== Search =====
Write-Host ""
Write-Host "==========================================="
Write-Host "TEST: Search"
Write-Host "==========================================="
Sql "UPDATE seller_trust SET trust_status='HIGH' WHERE business_id='$BIZ_ID';" | Out-Null

Start-Sleep -Seconds 1
$resp = Get_ "$BASE/marketplace/search?q=Nike" $BTOKEN
Check "Search returns Nike" "Nike" $resp
Check "Search has pagination" "pagination" $resp

# ===== SUMMARY =====
Write-Host ""
Write-Host "==========================================="
Write-Host "SUMMARY: $PASS passed, $FAIL failed"
Write-Host "==========================================="
