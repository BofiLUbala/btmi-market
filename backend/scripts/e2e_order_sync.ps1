# BTMI - Seller <-> Buyer ORDER SYNC E2E (one real order per delivery method)
# Verifies ONE backend order state seen identically by Seller and Buyer,
# real status_history entries, actor permissions, payment sync, auto-completion,
# inventory consumption and review eligibility.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\e2e_order_sync.ps1
$ErrorActionPreference = 'Stop'
$BASE = 'http://localhost:8080/api/v1'
$OUT = Join-Path $PSScriptRoot 'evidence'
New-Item -ItemType Directory -Force -Path $OUT | Out-Null
$script:RESULTS = @()
$STAMP = Get-Date -Format 'yyyyMMdd_HHmmss'

function Record($test, $expected, $actual, $pass, $notes) {
    $script:RESULTS += [pscustomobject]@{ Test = $test; Expected = $expected; Actual = $actual; Pass = [bool]$pass; Notes = $notes }
    $icon = if ($pass) { 'PASS' } else { 'FAIL' }
    Write-Host "[$icon] $test -> $actual" -ForegroundColor $(if ($pass) { 'Green' } else { 'Red' })
}

function Invoke-Api {
    param([string]$Method, [string]$Path, $Body, [string]$Token)
    $headers = @{}
    if ($Token) { $headers['Authorization'] = "Bearer $Token" }
    try {
        $params = @{ Method = $Method; Uri = "$BASE$Path"; Headers = $headers; ContentType = 'application/json'; ErrorAction = 'Stop' }
        if ($null -ne $Body) { $params['Body'] = ($Body | ConvertTo-Json -Depth 10) }
        return @{ status = 200; body = (Invoke-RestMethod @params) }
    } catch {
        $code = 0; $errBody = $null
        if ($_.Exception.Response) {
            $code = [int]$_.Exception.Response.StatusCode
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $errBody = $reader.ReadToEnd() | ConvertFrom-Json
            } catch {}
        }
        return @{ status = $code; body = $errBody }
    }
}

function Activate-UserDirectly([string]$userId) {
    docker compose --project-name backend exec -T postgres psql -U btmi_user -d btmi_market -c "UPDATE users SET status='ACTIVE', email_verified=true WHERE id='$userId';" | Out-Null
}

# ---------- actors ----------
$uniq = Get-Date -Format 'HHmmss'
$sellerEmail = "sync_seller_$uniq@test.com"; $sellerPass = 'SellerPass123!'
$buyerEmail  = "sync_buyer_$uniq@test.com";  $buyerPass  = 'BuyerPass123!'

$r = Invoke-Api -Method Post -Path '/auth/register/seller' -Body @{
    first_name='Sync'; last_name='Seller'; middle_name='E2E'; phone="+243900$($uniq.Substring(3))01"
    email=$sellerEmail; password=$sellerPass; password_confirmation=$sellerPass }
$sellerUserId = $r.body.data.user_id
Activate-UserDirectly $sellerUserId
$r = Invoke-Api -Method Post -Path '/auth/login' -Body @{ email=$sellerEmail; password=$sellerPass }
$sellerTok = $r.body.access_token
Record 'Seller registered+active+login' '200 token' "HTTP $($r.status)" ($r.status -eq 200 -and $sellerTok) ''

$r = Invoke-Api -Method Post -Path '/auth/register' -Body @{
    first_name='Sync'; last_name='Buyer'; phone="+243900$($uniq.Substring(3))02"
    email=$buyerEmail; password=$buyerPass; password_confirmation=$buyerPass }
$buyerUserId = $r.body.data.user_id
if (-not $buyerUserId) { $buyerUserId = $r.body.data.id }
Activate-UserDirectly $buyerUserId
$r = Invoke-Api -Method Post -Path '/auth/login' -Body @{ email=$buyerEmail; password=$buyerPass }
$buyerTok = $r.body.access_token
Record 'Buyer registered+active+login' '200 token' "HTTP $($r.status)" ($r.status -eq 200 -and $buyerTok) ''

# ---------- catalog ----------
$r = Invoke-Api -Method Post -Path '/businesses' -Token $sellerTok -Body @{
    name="Sync Biz $uniq"; business_type='RETAIL'; category='general'; phone='+243811000100'
    email=$sellerEmail; country='CD'; city='Kinshasa'; default_currency='USD'; description='order sync e2e' }
$bizId = $r.body.data.id
$r = Invoke-Api -Method Post -Path "/businesses/$bizId/shops" -Token $sellerTok -Body @{
    name='Gombe Shop'; type='PHYSICAL'; city='Kinshasa'; address='12 Av. Gombe'; phone='+243811000100'
    supports_shop_delivery=$true; shop_delivery_fee=2000 }
$shopA = $r.body.data.id
$r = Invoke-Api -Method Post -Path "/businesses/$bizId/products" -Token $sellerTok -Body @{ name='Nike Test Shoe'; description='sync e2e product'; sku="SYNC-$uniq" }
$prodId = $r.body.data.id
Invoke-Api -Method Patch -Path "/businesses/$bizId/products/$prodId" -Token $sellerTok -Body @{ publication_status='PUBLISHED' } | Out-Null
$r = Invoke-Api -Method Post -Path "/businesses/$bizId/products/$prodId/variants" -Token $sellerTok -Body @{ sku="SYNC-V-$uniq"; name='Black / 40'; attributes=@{Color='Black';Size='40'}; sale_price=50000; purchase_price=25000 }
$varId = $r.body.data.id
Invoke-Api -Method Post -Path "/shops/$shopA/stock" -Token $sellerTok -Body @{ variant_id=$varId; quantity=10 } | Out-Null
Record 'Catalog ready (business/shop/product/variant/stock)' 'ids set' "shop=$shopA prod=$prodId var=$varId" ($shopA -and $prodId -and $varId) ''

$r = Invoke-Api -Method Post -Path '/buyer/profile' -Token $buyerTok -Body @{
    first_name='Sync'; last_name='Buyer'; phone='+243999000111'; email=$buyerEmail; city='Kinshasa'; commune='Gombe' }
Record 'Buyer profile created' '200/201' "HTTP $($r.status)" ($r.status -in 200,201) ''

# ---------- helpers ----------
function New-PickupOrder {
    $idem = [guid]::NewGuid().ToString()
    $r = Invoke-Api -Method Post -Path '/buyer/orders' -Token $buyerTok -Body @{ shop_id=$shopA; items=@(@{ product_id=$prodId; variant_id=$varId; quantity=1 }); use_points=$false; idempotency_key=$idem }
    $orderId = if ($r.body.data.order) { $r.body.data.order.id } else { $r.body.data.id }
    Invoke-Api -Method Post -Path "/buyer/orders/$orderId/delivery" -Token $buyerTok -Body @{ method='PICKUP'; use_points_for_delivery=$false; contact_name='Sync Buyer'; phone='+243999000111'; address='Test addr' } | Out-Null
    return $orderId
}
function New-DeliveryOrder {
    $idem = [guid]::NewGuid().ToString()
    $r = Invoke-Api -Method Post -Path '/buyer/orders' -Token $buyerTok -Body @{ shop_id=$shopA; items=@(@{ product_id=$prodId; variant_id=$varId; quantity=1 }); use_points=$false; idempotency_key=$idem }
    $orderId = if ($r.body.data.order) { $r.body.data.order.id } else { $r.body.data.id }
    Invoke-Api -Method Post -Path "/buyer/orders/$orderId/delivery" -Token $buyerTok -Body @{ method='SHOP_DELIVERY'; use_points_for_delivery=$false; contact_name='Sync Buyer'; phone='+243999000111'; address='24 Av. Kalembelembe' } | Out-Null
    return $orderId
}
function Seller-SeesStatus([string]$orderId) {
    $r = Invoke-Api -Method Get -Path "/orders/$orderId" -Token $sellerTok
    return @{ status = $r.body.data.order.status; ok = ($r.status -eq 200); body = $r.body.data }
}
function Buyer-Tracking([string]$orderId) {
    $r = Invoke-Api -Method Get -Path "/buyer/orders/$orderId/tracking" -Token $buyerTok
    return @{ status = $r.body.data.current_status; history = @($r.body.data.history); ok = ($r.status -eq 200) }
}
function Assert-Synced([string]$label, [string]$orderId, [string]$expected) {
    $s = Seller-SeesStatus $orderId
    $b = Buyer-Tracking $orderId
    $histHas = @($b.history | Where-Object { $_.status -eq $expected }).Count -ge 1
    $sameShopProduct = $true
    if ($s.ok -and $s.body.lines) {
        $line = @($s.body.lines)[0]
        $sameShopProduct = ($s.body.order.shop_id -eq $shopA -and $line.product_name -match 'Nike Test Shoe')
    }
    Record "$label : seller+buyer same backend status + history" "$expected on both + history entry" "seller=$($s.status) buyer=$($b.status) histN=$(@($b.history).Count) hist=$histHas shop/product=$sameShopProduct" ($s.ok -and $b.ok -and $s.status -eq $expected -and $b.status -eq $expected -and $histHas -and $sameShopProduct) ''
}

# ============================================================
# FLOW A: PICKUP
# ============================================================
Write-Host "`n========== FLOW A: PICKUP ==========" -ForegroundColor Cyan

$orderA = New-PickupOrder
$s = Seller-SeesStatus $orderA
$b = Buyer-Tracking $orderA
Record 'ONE order id: seller sees buyer order (PENDING)' 'PENDING/PENDING' "seller=$($s.status) buyer=$($b.status)" ($s.ok -and $b.ok -and $s.status -eq 'PENDING' -and $b.status -eq 'PENDING') ''

# invalid action: buyer cannot drive seller transitions
$r = Invoke-Api -Method Post -Path "/orders/$orderA/tracking/status" -Token $buyerTok -Body @{ status='ACCEPTED' }
Record 'Buyer cannot Accept Order' '403' "HTTP $($r.status) $($r.body.error.code)" ($r.status -in 403,400) ''

Invoke-Api -Method Post -Path "/orders/$orderA/accept" -Token $sellerTok -Body @{} | Out-Null
Assert-Synced 'Seller Accept -> Buyer Tracking' $orderA 'ACCEPTED'

# payment prepared while order is still in ACCEPTED window (business rule)
$r = Invoke-Api -Method Post -Path "/buyer/orders/$orderA/payment" -Token $buyerTok -Body @{}
$payA = $r.body.data.id
Record 'Buyer prepares cash payment' '201 created' "HTTP $($r.status)" ($r.status -in 200,201) (($r.body | ConvertTo-Json -Depth 3))
$r = Invoke-Api -Method Post -Path "/buyer/payments/$payA/buyer-confirm" -Token $buyerTok -Body @{}
Record 'BUYER I Have Paid -> CONFIRMED' 'CONFIRMED' "HTTP $($r.status) st=$($r.body.data.status)" ($r.status -eq 200 -and $r.body.data.status -eq 'CONFIRMED') ''

Invoke-Api -Method Post -Path "/orders/$orderA/prepare" -Token $sellerTok -Body @{} | Out-Null
Assert-Synced 'Seller Start Preparing -> Buyer Tracking' $orderA 'PREPARING'

Invoke-Api -Method Post -Path "/orders/$orderA/tracking/status" -Token $sellerTok -Body @{ status='READY_FOR_PICKUP' } | Out-Null
Assert-Synced 'Seller Ready For Pickup -> Buyer Tracking' $orderA 'READY_FOR_PICKUP'

# invalid action: seller cannot confirm receipt on buyer's behalf
$r = Invoke-Api -Method Post -Path "/orders/$orderA/tracking/status" -Token $sellerTok -Body @{ status='RECEIVED' }
Record 'Seller cannot mark RECEIVED for buyer' '403' "HTTP $($r.status) $($r.body.error.code)" ($r.status -in 403,400) ''

# reservation exists while active
$reservedActive = docker compose --project-name backend exec -T postgres psql -U btmi_user -d btmi_market -t -A -c "SELECT reserved_quantity FROM inventory WHERE shop_id='$shopA' AND variant_id='$varId';"
Record 'Stock reserved while order active' 'reserved>=1' "reserved=$reservedActive" ([int]$reservedActive -ge 1) ''

$r = Invoke-Api -Method Post -Path "/buyer/orders/$orderA/received" -Token $buyerTok -Body @{}
$recvSt = if ($r.body.data.order) { $r.body.data.order.status } else { $r.body.data.status }
Assert-Synced 'BUYER Confirm Received' $orderA $recvSt

$r = Invoke-Api -Method Post -Path "/payments/$payA/seller-confirm" -Token $sellerTok -Body @{}
Record 'SELLER Confirm Cash Received -> VERIFIED' 'VERIFIED' "HTTP $($r.status) st=$($r.body.data.status)" ($r.status -eq 200 -and $r.body.data.status -eq 'VERIFIED') ''

Start-Sleep -Seconds 3
Assert-Synced 'Auto-COMPLETED (receipt + payment verified)' $orderA 'COMPLETED'

# review eligibility derives from same order state
$r = Invoke-Api -Method Get -Path "/buyer/orders/$orderA/review-eligibility" -Token $buyerTok
Record 'Review eligible after COMPLETED' 'eligible=true' "HTTP $($r.status) eligible=$($r.body.data.eligible)" ($r.status -eq 200 -and $r.body.data.eligible -eq $true) ''

# full history present
$b = Buyer-Tracking $orderA
$expectedHist = @('PENDING','ACCEPTED','PREPARING','READY_FOR_PICKUP','RECEIVED','COMPLETED')
$missing = @(); foreach ($st in $expectedHist) { if (@($b.history | Where-Object { $_.status -eq $st }).Count -lt 1) { $missing += $st } }
Record 'Real status history complete (no fake entries)' 'all stages recorded' "missing=$($missing -join ',')" ($missing.Count -eq 0) ''

# inventory consumed exactly once (10 initial, 2 orders total planned -> check after flow B)

# ============================================================
# FLOW B: SHOP_DELIVERY
# ============================================================
Write-Host "`n========== FLOW B: SHOP_DELIVERY ==========" -ForegroundColor Cyan

$orderB = New-DeliveryOrder
$s = Seller-SeesStatus $orderB; $b = Buyer-Tracking $orderB
Record 'Delivery order created (PENDING both)' 'PENDING/PENDING' "seller=$($s.status) buyer=$($b.status)" ($s.ok -and $b.status -eq 'PENDING' -and $s.status -eq 'PENDING') ''

foreach ($step in @(@('ACCEPTED', $null), @('PREPARING', $null))) {
    if ($step[0] -eq 'ACCEPTED') {
        Invoke-Api -Method Post -Path "/orders/$orderB/accept" -Token $sellerTok -Body @{} | Out-Null
        # payment prepared while order is still ACCEPTED (business rule)
        $r = Invoke-Api -Method Post -Path "/buyer/orders/$orderB/payment" -Token $buyerTok -Body @{}
        $payB = $r.body.data.id
        Invoke-Api -Method Post -Path "/buyer/payments/$payB/buyer-confirm" -Token $buyerTok -Body @{} | Out-Null
        Invoke-Api -Method Post -Path "/payments/$payB/seller-confirm" -Token $sellerTok -Body @{} | Out-Null
    }
    else { Invoke-Api -Method Post -Path "/orders/$orderB/prepare" -Token $sellerTok -Body @{} | Out-Null }
    Assert-Synced "Seller -> $($step[0])" $orderB $step[0]
}
Invoke-Api -Method Post -Path "/orders/$orderB/tracking/status" -Token $sellerTok -Body @{ status='READY' } | Out-Null
Assert-Synced 'Seller Mark Ready' $orderB 'READY'
Invoke-Api -Method Post -Path "/orders/$orderB/tracking/status" -Token $sellerTok -Body @{ status='OUT_FOR_DELIVERY' } | Out-Null
Assert-Synced 'Seller Dispatch (OUT_FOR_DELIVERY)' $orderB 'OUT_FOR_DELIVERY'
Invoke-Api -Method Post -Path "/orders/$orderB/tracking/status" -Token $sellerTok -Body @{ status='DELIVERED' } | Out-Null
Assert-Synced 'Seller Mark Delivered' $orderB 'DELIVERED'

$r = Invoke-Api -Method Post -Path "/buyer/orders/$orderB/received" -Token $buyerTok -Body @{}
$recvB = if ($r.body.data.order) { $r.body.data.order.status } else { $r.body.data.status }
Assert-Synced 'BUYER Confirm Received (payment already verified)' $orderB $recvB
Start-Sleep -Seconds 3
Assert-Synced 'Auto-COMPLETED delivery order' $orderB 'COMPLETED'

# ---------- inventory consumed ----------
Start-Sleep -Seconds 2
$inv = docker compose --project-name backend exec -T postgres psql -U btmi_user -d btmi_market -t -A -c "SELECT quantity || '|' || reserved_quantity FROM inventory WHERE shop_id='$shopA' AND variant_id='$varId';"
Record 'Inventory synced: reservations consumed on final sale' 'quantity=8|reserved=0' "inventory=$inv" ($inv -eq '8|0') ''

# refresh persistence: state comes from backend only (re-fetch proves it)
$b = Buyer-Tracking $orderA
$s = Seller-SeesStatus $orderA
Record 'Refresh persistence: statuses still correct from backend' 'COMPLETED both' "seller=$($s.status) buyer=$($b.status)" ($s.status -eq 'COMPLETED' -and $b.status -eq 'COMPLETED') ''

# ---- save results ----
$passCount = ($RESULTS | Where-Object { $_.Pass }).Count
$total = $RESULTS.Count
$jsonPath = Join-Path $OUT "order_sync_$STAMP.json"
$RESULTS | ConvertTo-Json -Depth 5 | Set-Content -Path $jsonPath -Encoding UTF8
Write-Host "`n================ ORDER SYNC RESULTS: $passCount / $total PASSED ================" -ForegroundColor Yellow
Write-Host "Evidence saved: $jsonPath"
$RESULTS | Where-Object { -not $_.Pass } | ForEach-Object { Write-Host "FAILED: $($_.Test) -> $($_.Actual)" -ForegroundColor Red }
