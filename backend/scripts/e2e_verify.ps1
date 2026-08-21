# BTMI Seller Web - API E2E verification against Docker stack (host port 8080)
# Usage: powershell -ExecutionPolicy Bypass -File scripts\e2e_verify.ps1
$ErrorActionPreference = 'Stop'
$BASE = 'http://localhost:8080/api/v1'
$OUT = Join-Path $PSScriptRoot 'evidence'
New-Item -ItemType Directory -Force -Path $OUT | Out-Null
$script:RESULTS = @()
$STAMP = Get-Date -Format 'yyyyMMdd_HHmmss'

function Record($test, $expected, $actual, $pass, $notes) {
    $script:RESULTS += [pscustomobject]@{
        Test = $test; Expected = $expected; Actual = $actual
        Pass = [bool]$pass; Notes = $notes
    }
    $icon = if ($pass) { 'PASS' } else { 'FAIL' }
    Write-Host "[$icon] $test -> $actual" -ForegroundColor $(if ($pass) { 'Green' } else { 'Red' })
}

function Get-Count($arr) { if ($null -eq $arr) { 0 } else { @($arr).Count } }

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

function Get-ActivationTokenFromLogs([string]$email) {
    $logs = docker compose --project-name backend logs api --tail 300 2>&1
    $line = $logs | Select-String -Pattern "token=([A-Za-z0-9_-]+)" | Select-Object -Last 20
    foreach ($l in ($line | ForEach-Object { $_.ToString() })) {
        if ($l -match [regex]::Escape($email)) {
            if ($l -match "token=([A-Za-z0-9_-]+)") { return $Matches[1] }
        }
    }
    # fallback: match last token line mentioning any email
    foreach ($l in ($line | ForEach-Object { $_.ToString() })) {
        if ($l -match "token=([A-Za-z0-9_-]+)") { return $Matches[1] }
    }
    return $null
}

function Get-SellerLogin([string]$email, [string]$password) {
    $r = Invoke-Api -Method Post -Path '/auth/login' -Body @{ email = $email; password = $password }
    return $r
}

$uniq = Get-Date -Format 'HHmmss'
$sellerEmail = "seller_web_$uniq@test.com"
$sellerPass = 'SellerPass123!'
$buyerEmail = "buyer_web_$uniq@test.com"
$employeeEmail = "emp_web_$uniq@test.com"

Write-Host "`n========== SECTION 1: SELLER AUTH ==========" -ForegroundColor Cyan

# 1.1 Seller registration
$r = Invoke-Api -Method Post -Path '/auth/register/seller' -Body @{
    first_name = 'Web'; last_name = 'Test'; middle_name = 'E2E'
    phone = "+243900$($uniq.Substring(3))00"; email = $sellerEmail
    password = $sellerPass; password_confirmation = $sellerPass
}
Record 'Seller register' '200/201 + user_id' "HTTP $($r.status)" ($r.status -in 200,201) (($r.body | ConvertTo-Json -Depth 5))
$sellerUserId = $r.body.data.user_id

# 1.2 password stored as hash only
Start-Sleep -Seconds 1
$dbUser = docker compose --project-name backend exec -T postgres psql -U btmi_user -d btmi_market -t -A -c "SELECT account_type || '|' || status || '|' || (password_hash LIKE '`$2a`$%' OR password_hash LIKE '`$2b`$%') FROM users WHERE id='$sellerUserId';"
Record 'Seller DB row' 'SELLER|PENDING_VERIFICATION|hash=True' $dbUser ($dbUser -match '^SELLER\|PENDING_VERIFICATION\|(True|true)') ''

# 1.3 activation with invalid token
$r = Invoke-Api -Method Get -Path '/auth/activate?token=invalidtoken123'
Record 'Activate invalid token' '404 ACTIVATION_LINK_INVALID' "HTTP $($r.status)" ($r.status -eq 404) ($r.body.error.code)

# 1.4 valid activation
$token = Get-ActivationTokenFromLogs $sellerEmail
if (-not $token) { throw "Could not extract activation token from api logs for $sellerEmail" }
$r = Invoke-Api -Method Get -Path "/auth/activate?token=$token"
Record 'Activate valid token' '200' "HTTP $($r.status)" ($r.status -eq 200) ''
$dbState = docker compose --project-name backend exec -T postgres psql -U btmi_user -d btmi_market -t -A -c "SELECT status || '|' || email_verified FROM users WHERE id='$sellerUserId';"
Record 'Activated DB state' 'ACTIVE|true' $dbState ($dbState -eq 'ACTIVE|t' -or $dbState -eq 'ACTIVE|true') ''

# 1.5 reuse token
$r = Invoke-Api -Method Get -Path "/auth/activate?token=$token"
Record 'Reuse used token' '409 ALREADY_USED' "HTTP $($r.status)" ($r.status -eq 409) ($r.body.error.code)

# 1.6 login
$r = Invoke-Api -Method Post -Path '/auth/login' -Body @{ email = $sellerEmail; password = $sellerPass }
$acctType = $r.body.user.account_type
Record 'Seller login response' '200 + account_type=SELLER + expires_in' "HTTP $($r.status) type=$acctType exp=$($r.body.expires_in)" ($r.status -eq 200 -and $acctType -eq 'SELLER' -and $r.body.expires_in -gt 0) ''
$sellerTok = $r.body.access_token
$sellerRefresh = $r.body.refresh_token

# 1.7 wrong password
$r = Invoke-Api -Method Post -Path '/auth/login' -Body @{ email = $sellerEmail; password = 'WrongPass999!' }
Record 'Login wrong password' '401 INVALID_CREDENTIALS' "HTTP $($r.status)" ($r.status -eq 401) ($r.body.error.code)

# 1.8 /auth/me
$r = Invoke-Api -Method Get -Path '/auth/me' -Token $sellerTok
Record 'GET /auth/me' '200 account_type=SELLER' "HTTP $($r.status) type=$($r.body.data.account_type)" ($r.status -eq 200 -and $r.body.data.account_type -eq 'SELLER') ''

# 1.9 refresh rotation
$r = Invoke-Api -Method Post -Path '/auth/refresh' -Body @{ refresh_token = $sellerRefresh }
$newRefreshOk = ($null -ne $r.body.refresh_token -and $r.body.refresh_token -ne $sellerRefresh)
Record 'Refresh token rotation' '200 + new refresh != old' "HTTP $($r.status) rotated=$newRefreshOk" ($r.status -eq 200 -and $newRefreshOk) ''
# old refresh must now be revoked
$r2 = Invoke-Api -Method Post -Path '/auth/refresh' -Body @{ refresh_token = $sellerRefresh }
Record 'Old refresh revoked' '401 REFRESH_TOKEN_REVOKED' "HTTP $($r2.status)" ($r2.status -eq 401) ($r2.body.error.code)

Write-Host "`n========== SECTION 2: BUSINESS & SHOP ==========" -ForegroundColor Cyan

# 2.1 businesses empty
$r = Invoke-Api -Method Get -Path '/businesses' -Token $sellerTok
Record 'List businesses (empty)' '200 []' "HTTP $($r.status) count=$(Get-Count $r.body.data)" ($r.status -eq 200 -and (Get-Count $r.body.data) -eq 0) ''

# 2.2 create business (all required fields per CreateBusinessRequest)
$r = Invoke-Api -Method Post -Path '/businesses' -Token $sellerTok -Body @{
    name = "Web Test Biz $uniq"; business_type = 'RETAIL'; category = 'general'
    phone = '+243811000100'; email = $sellerEmail; country = 'CD'; city = 'Kinshasa'
    default_currency = 'USD'; description = 'E2E verification business'
}
Record 'Create business' '200/201' "HTTP $($r.status)" ($r.status -in 200,201) (($r.body | ConvertTo-Json -Depth 4))
$bizId = $r.body.data.id

# 2.3 membership OWNER auto-created (verified in DB below; list shows business)
$r = Invoke-Api -Method Get -Path '/businesses' -Token $sellerTok
$mem = @($r.body.data) | Where-Object { $_.id -eq $bizId }
Record 'Business listed for owner' 'business visible' "found=$($null -ne $mem)" ($null -ne $mem) ''
$dbMem = docker compose --project-name backend exec -T postgres psql -U btmi_user -d btmi_market -t -A -c "SELECT role FROM business_memberships WHERE business_id='$bizId' AND user_id='$sellerUserId';"
Record 'OWNER membership in DB' 'OWNER' $dbMem ($dbMem -eq 'OWNER') ''

# 2.4 create shop A
$r = Invoke-Api -Method Post -Path "/businesses/$bizId/shops" -Token $sellerTok -Body @{
    name = "Shop A $uniq"; type = 'PHYSICAL'; city = 'Kinshasa'; address = '12 Av. Market'; phone = '+243811000001'
    supports_shop_delivery = $true; shop_delivery_fee = 2000
}
Record 'Create Shop A' '200/201' "HTTP $($r.status)" ($r.status -in 200,201) ''
$shopA = $r.body.data.id

# 2.5 create shop B
$r = Invoke-Api -Method Post -Path "/businesses/$bizId/shops" -Token $sellerTok -Body @{
    name = "Shop B $uniq"; type = 'PHYSICAL'; city = 'Lubumbashi'; address = '5 Rd. Commerce'; phone = '+243811000002'
}
Record 'Create Shop B' '200/201' "HTTP $($r.status)" ($r.status -in 200,201) ''
$shopB = $r.body.data.id

# 2.6 shop persistence
$r = Invoke-Api -Method Get -Path "/shops/$shopA" -Token $sellerTok
Record 'Shop A persisted (GET)' '200 correct business_id' "HTTP $($r.status) biz=$($r.body.data.business_id -eq $bizId)" ($r.status -eq 200 -and $r.body.data.business_id -eq $bizId) ''

Write-Host "`n========== SECTION 3: PRODUCTS / VARIANTS / STOCK ==========" -ForegroundColor Cyan

# categories for real data
$cats = Invoke-Api -Method Get -Path '/categories'
$catId = $null; $subId = $null
if ($cats.status -eq 200 -and @($cats.body.data).Count -gt 0) {
    $catId = @($cats.body.data)[0].id
    $subs = Invoke-Api -Method Get -Path "/categories/$catId/subcategories"
    if ($subs.status -eq 200 -and @($subs.body.data).Count -gt 0) { $subId = @($subs.body.data)[0].id }
}
Record 'Categories available' '>=1 category' "cat=$(if($catId){$catId}else{'none'})" ($null -ne $catId) ''

# 3.1 create product
$r = Invoke-Api -Method Post -Path "/businesses/$bizId/products" -Token $sellerTok -Body @{
    name = 'E2E T-Shirt'; description = 'Cotton t-shirt for testing'; sku = "SKU-$uniq"
    category_id = $catId; subcategory_id = $subId
}
Record 'Create product' '200/201 DRAFT' "HTTP $($r.status) pub=$($r.body.data.publication_status)" ($r.status -in 200,201 -and $r.body.data.publication_status -eq 'DRAFT') ''
$prodId = $r.body.data.id

# 3.2 update/publish product
$r = Invoke-Api -Method Patch -Path "/businesses/$bizId/products/$prodId" -Token $sellerTok -Body @{ publication_status = 'PUBLISHED' }
Record 'Publish product' '200 PUBLISHED' "HTTP $($r.status) pub=$($r.body.data.publication_status)" ($r.status -eq 200 -and $r.body.data.publication_status -eq 'PUBLISHED') ''

# 3.3 create variant
$r = Invoke-Api -Method Post -Path "/businesses/$bizId/products/$prodId/variants" -Token $sellerTok -Body @{
    sku = "VAR-$uniq"; name = 'Black / 42'; attributes = @{ Color = 'Black'; Size = '42' }
    sale_price = 15000; purchase_price = 9000; barcode = "BC$uniq"
}
Record 'Create variant' '200/201' "HTTP $($r.status)" ($r.status -in 200,201) ''
$varId = $r.body.data.id

# 3.4 add stock (+10)
$r = Invoke-Api -Method Post -Path "/shops/$shopA/stock" -Token $sellerTok -Body @{ variant_id = $varId; quantity = 10 }
Record 'Add stock +10' '200 available=10' "HTTP $($r.status) avail=$($r.body.data.available)" ($r.status -eq 200 -and [int]$r.body.data.available -eq 10) ''

# 3.5 inventory shows on_hand/reserved/available
$r = Invoke-Api -Method Get -Path "/shops/$shopA/inventory" -Token $sellerTok
$allInv = @($r.body.data)
$item = $null
foreach ($row in $allInv) {
    $vid = if ($row.inventory) { $row.inventory.variant_id } else { $row.variant_id }
    if ($vid -eq $varId) { $item = $row; break }
}
$invQty = if ($item -and $item.inventory) { $item.inventory.quantity } else { $item.quantity }
Record 'Inventory fields' 'on_hand/reserved/available present' "rows=$(Get-Count $allInv) qty=$invQty" ($null -ne $item -and [int]$invQty -eq 10) ''

# 3.6 record physical sale qty 2
$r = Invoke-Api -Method Post -Path "/shops/$shopA/sales" -Token $sellerTok -Body @{ variant_id = $varId; quantity = 2; sale_type = 'PHYSICAL' }
Record 'Record sale qty 2' '200/201 success' "HTTP $($r.status)" ($r.status -eq 200 -or $r.status -eq 201) ($r.body | ConvertTo-Json -Depth 3)
$r = Invoke-Api -Method Get -Path "/variants/$varId/inventory" -Token $sellerTok
$invA = @($r.body.data) | Where-Object { $_.shop_id -eq $shopA }
Record 'Stock after sale = 8' 'available=8' "avail=$($invA.available)" ($null -ne $invA -and [int]$invA.available -eq 8) ''

# 3.7 stock movement SALE recorded
$r = Invoke-Api -Method Get -Path "/shops/$shopA/movements" -Token $sellerTok
$allMv = @(); if ($r.body.data) { $allMv = @($r.body.data) }
$movements = @($allMv | Where-Object { $_.variant_id -eq $varId -and $_.movement_type -like 'SALE*' })
$mvtOk = $false; $mvtDetail = ''
if ($movements.Count -ge 1) {
    $m = $movements[0]
    $diff = [int]$m.previous_quantity - [int]$m.new_quantity
    $mvtOk = ($diff -eq 2)
    $mvtDetail = "type=$($m.movement_type) prev=$($m.previous_quantity) new=$($m.new_quantity)"
}
Record 'SALE movement created' 'SALE movement with delta=2' "HTTP $($r.status) total=$($allMv.Count) saleCount=$($movements.Count) $mvtDetail" ($mvtOk) (($r.body | ConvertTo-Json -Depth 3))

# 3.8 insufficient stock rejection
$r = Invoke-Api -Method Post -Path "/shops/$shopA/sales" -Token $sellerTok -Body @{ variant_id = $varId; quantity = 100; sale_type = 'PHYSICAL' }
Record 'Insufficient stock rejected' '400/409 no negative stock' "HTTP $($r.status) code=$($r.body.error.code)" ($r.status -ge 400 -and $r.status -lt 500) ''

# 3.9 concurrent oversell protection: fresh variant with exactly 1 unit, race two sales
$r = Invoke-Api -Method Post -Path "/businesses/$bizId/products/$prodId/variants" -Token $sellerTok -Body @{
    sku = "VAR-RACE-$uniq"; name = 'Race Variant'; sale_price = 5000
}
$raceVarId = $r.body.data.id
Record 'Create race variant' 'created' "HTTP $($r.status) id=$raceVarId" ($r.status -in 200,201 -and $raceVarId) (($r.body | ConvertTo-Json -Depth 3))
$r = Invoke-Api -Method Post -Path "/shops/$shopA/stock" -Token $sellerTok -Body @{ variant_id = $raceVarId; quantity = 1 }
Record 'Stock race variant = 1' '200' "HTTP $($r.status)" ($r.status -eq 200) (($r.body | ConvertTo-Json -Depth 3))
$job1 = Start-Job -ScriptBlock { param($b,$t,$s,$v) try { Invoke-RestMethod -Method Post -Uri "$b/shops/$s/sales" -Headers @{Authorization="Bearer $t"} -ContentType 'application/json' -Body (@{variant_id=$v;quantity=1;sale_type='PHYSICAL'}|ConvertTo-Json); 'OK' } catch { "ERR:$($_.Exception.Response.StatusCode.value__)" } } -ArgumentList $BASE,$sellerTok,$shopA,$raceVarId
$job2 = Start-Job -ScriptBlock { param($b,$t,$s,$v) try { Invoke-RestMethod -Method Post -Uri "$b/shops/$s/sales" -Headers @{Authorization="Bearer $t"} -ContentType 'application/json' -Body (@{variant_id=$v;quantity=1;sale_type='PHYSICAL'}|ConvertTo-Json); 'OK' } catch { "ERR:$($_.Exception.Response.StatusCode.value__)" } } -ArgumentList $BASE,$sellerTok,$shopA,$raceVarId
Start-Sleep -Seconds 6
$j1 = Receive-Job $job1 -ErrorAction SilentlyContinue; $j2 = Receive-Job $job2 -ErrorAction SilentlyContinue
Remove-Job $job1,$job2 -Force -ErrorAction SilentlyContinue
$r = Invoke-Api -Method Get -Path "/variants/$raceVarId/inventory" -Token $sellerTok
$invB = @($r.body.data) | Where-Object { $_.shop_id -eq $shopA }
$oneFailed = ("$j1$j2" -match 'ERR')
$soldBoth = ($null -ne $invB -and [int]$invB.available -eq 0 -and [int]$invB.quantity -ge 0 -and $oneFailed)
Record 'Concurrent oversell blocked' 'exactly one sale wins, final stock >= 0' "j1=$j1 j2=$j2 avail=$($invB.available)" ($soldBoth) ''

Write-Host "`n========== SECTION 4: CUSTOMERS / CASH ==========" -ForegroundColor Cyan

# 4.1 customer CRUD
$r = Invoke-Api -Method Post -Path "/businesses/$bizId/customers" -Token $sellerTok -Body @{ first_name='Jean'; last_name='Client'; phone='+243822000111'; email='jean.client@test.com' }
Record 'Create customer' '200/201' "HTTP $($r.status)" ($r.status -in 200,201) ''
$custId = $r.body.data.id
$r = Invoke-Api -Method Patch -Path "/customers/$custId" -Token $sellerTok -Body @{ phone = '+243822000999' }
Record 'Update customer' '200' "HTTP $($r.status)" ($r.status -eq 200) ''
$r = Invoke-Api -Method Get -Path "/customers/$custId" -Token $sellerTok
$custPhone = if ($r.body.data.customer) { $r.body.data.customer.phone } else { $r.body.data.phone }
Record 'Customer update persisted' 'phone=+243822000999' "HTTP $($r.status) phone=$custPhone" ($r.status -eq 200 -and $custPhone -eq '+243822000999') ''

# 4.2 cash session open
$r = Invoke-Api -Method Post -Path "/shops/$shopA/cash-sessions/open" -Token $sellerTok -Body @{ opening_amount = 10000; currency = 'USD' }
Record 'Open cash session' '201 OPEN' "HTTP $($r.status) status=$($r.body.data.status)" ($r.status -in 200,201 -and $r.body.data.status -eq 'OPEN') ''
$sessionId = $r.body.data.id
# duplicate open should conflict
$r = Invoke-Api -Method Post -Path "/shops/$shopA/cash-sessions/open" -Token $sellerTok -Body @{ opening_amount = 5000 }
Record 'Duplicate open session rejected' '400/409' "HTTP $($r.status)" ($r.status -eq 409 -or $r.status -eq 400) ($r.body.error.code)
# close with declared amount
$r = Invoke-Api -Method Post -Path "/cash-sessions/$sessionId/close" -Token $sellerTok -Body @{ declared_closing_amount = 10000 }
Record 'Close cash session' '200 CLOSED' "HTTP $($r.status) status=$($r.body.data.status)" ($r.status -eq 200 -and $r.body.data.status -in @('CLOSED','RECONCILED')) ''
# reconcile
$r = Invoke-Api -Method Post -Path "/cash-sessions/$sessionId/reconcile" -Token $sellerTok -Body @{}
Record 'Reconcile session' '200 RECONCILED' "HTTP $($r.status) status=$($r.body.data.status)" ($r.status -eq 200 -and $r.body.data.status -eq 'RECONCILED') ''
# summary
$r = Invoke-Api -Method Get -Path "/businesses/$bizId/cash-summary" -Token $sellerTok
Record 'Business cash summary' '200 total_cash_sales present' "HTTP $($r.status) sales=$($r.body.data.total_cash_sales)" ($r.status -eq 200 -and $null -ne $r.body.data.total_cash_sales) ''

Write-Host "`n========== SECTION 5: GROWTH ==========" -ForegroundColor Cyan
$r = Invoke-Api -Method Get -Path "/businesses/$bizId/growth/points" -Token $sellerTok
$ptsCode = $r.body.error.code
Record 'Growth points endpoint' '200 or 404 pre-transaction (lazy account)' "HTTP $($r.status) code=$ptsCode pts=$($r.body.data.current_points)" ($r.status -eq 200 -or $r.status -eq 404) ''
$r = Invoke-Api -Method Get -Path "/businesses/$bizId/growth/level" -Token $sellerTok
Record 'Growth level+trust' '200 level/trust data' "HTTP $($r.status) level=$($r.body.data.level.name) trust=$($r.body.data.trust.status)" ($r.status -eq 200 -and $null -ne $r.body.data.level) ''
$r = Invoke-Api -Method Get -Path "/businesses/$bizId/growth/benefits" -Token $sellerTok
Record 'Growth benefits' '200 benefits array' "HTTP $($r.status)" ($r.status -eq 200) ''
$r = Invoke-Api -Method Get -Path "/businesses/$bizId/growth/history" -Token $sellerTok
Record 'Growth history' '200 transactions' "HTTP $($r.status)" ($r.status -eq 200) ''

Write-Host "`n========== SECTION 6: SELLER ORDERS ==========" -ForegroundColor Cyan
# seller-created walk-in order
$r = Invoke-Api -Method Post -Path "/shops/$shopA/orders" -Token $sellerTok -Body @{
    shop_id = $shopA; customer_id = $custId; lines = @(@{ product_id = $prodId; variant_id = $varId; quantity = 1 }); notes = 'walk-in sale'
}
Record 'Seller creates order' '200/201' "HTTP $($r.status)" ($r.status -in 200,201) ($r.body | ConvertTo-Json -Depth 3)
$orderId = if ($r.body.data.order) { $r.body.data.order.id } else { $r.body.data.id }
if ($orderId) {
    $r = Invoke-Api -Method Post -Path "/orders/$orderId/accept" -Token $sellerTok -Body @{}
    Record 'Order accept' '200 ACCEPTED' "HTTP $($r.status) st=$($r.body.data.status)" ($r.status -eq 200 -and $r.body.data.status -eq 'ACCEPTED') ''
    $r = Invoke-Api -Method Post -Path "/orders/$orderId/accept" -Token $sellerTok -Body @{}
    Record 'Invalid transition (accept twice)' '400/409 rejected' "HTTP $($r.status)" ($r.status -ge 400) ($r.body.error.code)
    $r = Invoke-Api -Method Post -Path "/orders/$orderId/prepare" -Token $sellerTok -Body @{}
    Record 'Order prepare' '200 PREPARING' "HTTP $($r.status) st=$($r.body.data.status)" ($r.status -eq 200 -and $r.body.data.status -eq 'PREPARING') ''
    $r = Invoke-Api -Method Post -Path "/orders/$orderId/complete" -Token $sellerTok -Body @{}
    Record 'Order complete' '200 COMPLETED' "HTTP $($r.status) st=$($r.body.data.status)" ($r.status -eq 200 -and $r.body.data.status -eq 'COMPLETED') ''
}

Write-Host "`n========== SECTION 7: EMPLOYEE FLOW ==========" -ForegroundColor Cyan

# 7.1 create employee
$r = Invoke-Api -Method Post -Path "/businesses/$bizId/employees" -Token $sellerTok -Body @{
    first_name = 'Emp'; last_name = 'One'; phone = "+243833$($uniq.Substring(3))01"; email = $employeeEmail; job_title = 'Sales Clerk'
}
Record 'Create employee' '200/201' "HTTP $($r.status)" ($r.status -in 200,201) ''
$empId = $r.body.data.id

# 7.2 assign to Shop A
$r = Invoke-Api -Method Post -Path "/employees/$empId/shops" -Token $sellerTok -Body @{ shop_id = $shopA }
Record 'Assign employee to Shop A' '200/201' "HTTP $($r.status)" ($r.status -in 200,201) ''
# duplicate assignment
$r = Invoke-Api -Method Post -Path "/employees/$empId/shops" -Token $sellerTok -Body @{ shop_id = $shopA }
Record 'Duplicate assignment rejected' '409 ALREADY_ASSIGNED' "HTTP $($r.status)" ($r.status -eq 409) ($r.body.error.code)
# cross-business shop assignment attempt (create second owner context later; here use random uuid shop)
$r = Invoke-Api -Method Post -Path "/employees/$empId/shops" -Token $sellerTok -Body @{ shop_id = '00000000-0000-0000-0000-000000000001' }
Record 'Assignment to unknown shop fails' '404 SHOP_NOT_FOUND' "HTTP $($r.status)" ($r.status -eq 404) ($r.body.error.code)

# 7.3 send invitation
$r = Invoke-Api -Method Post -Path "/employees/$empId/invite" -Token $sellerTok -Body @{ employee_id = $empId }
Record 'Send invitation' '200/201 PENDING' "HTTP $($r.status) st=$($r.body.data.status)" ($r.status -in 200,201 -and $r.body.data.status -eq 'PENDING') ''
$expHours = if ($r.body.data.expires_at) { ((Get-Date $r.body.data.expires_at) - (Get-Date)).TotalHours } else { 0 }
Record 'Invitation expiry ~7 days' 'between 167-169h' "$([math]::Round($expHours,1))h" ($expHours -gt 166 -and $expHours -lt 170) ''
# token hash only in DB
$tokRow = docker compose --project-name backend exec -T postgres psql -U btmi_user -d btmi_market -t -A -c "SELECT count(*) FROM employee_invitations WHERE employee_id='$empId' AND length(token_hash)=64;"
Record 'Invitation stores 64-char hash only' '1 row, hash len 64' $tokRow ($tokRow -eq '1') ''
# duplicate pending invite
$r = Invoke-Api -Method Post -Path "/employees/$empId/invite" -Token $sellerTok -Body @{ employee_id = $empId }
Record 'Duplicate pending invite rejected' '409 INVITATION_ALREADY_PENDING' "HTTP $($r.status)" ($r.status -eq 409) ($r.body.error.code)

# 7.4 extract invitation token from logs and accept
$invToken = Get-ActivationTokenFromLogs $employeeEmail
if (-not $invToken) { throw "Could not extract invitation token from api logs" }
$r = Invoke-Api -Method Post -Path '/auth/employee/invite/accept' -Body @{
    token = $invToken; password = 'EmpPass123!'; password_confirmation = 'EmpPass123!'
}
Record 'Accept invitation' '200 + user_id' "HTTP $($r.status)" ($r.status -eq 200) ''
$empUserId = $r.body.data.user_id
$dbEmp = docker compose --project-name backend exec -T postgres psql -U btmi_user -d btmi_market -t -A -c "SELECT u.account_type FROM users u JOIN employees e ON e.linked_user_id=u.id WHERE e.id='$empId';"
Record 'Employee user linked + EMPLOYEE type' 'EMPLOYEE' $dbEmp ($dbEmp -eq 'EMPLOYEE') ''
# token single-use
$r = Invoke-Api -Method Post -Path '/auth/employee/invite/accept' -Body @{
    token = $invToken; password = 'OtherPass123!'; password_confirmation = 'OtherPass123!'
}
Record 'Invitation token single-use' '400/404/409 rejected' "HTTP $($r.status)" ($r.status -in 400,404,409,410) ($r.body.error.code)

# 7.5 employee login
$r = Invoke-Api -Method Post -Path '/auth/login' -Body @{ email = $employeeEmail; password = 'EmpPass123!' }
Record 'Employee login' '200 EMPLOYEE' "HTTP $($r.status) type=$($r.body.user.account_type)" ($r.status -eq 200 -and $r.body.user.account_type -eq 'EMPLOYEE') ''
$empTok = $r.body.access_token

# 7.6 employees/me workspace resolution
$r = Invoke-Api -Method Get -Path '/employees/me' -Token $empTok
$meShops = @($r.body.data.shops) | ForEach-Object { $_.id }
Record 'GET /employees/me' '200 employee + Shop A only' "HTTP $($r.status) shops=$($meShops -join ',')" ($r.status -eq 200 -and $meShops -contains $shopA -and $meShops -notcontains $shopB) ''

# 7.7 shop security: authorized action on Shop A
$r = Invoke-Api -Method Get -Path "/shops/$shopA/inventory" -Token $empTok
Record 'Employee reads Shop A inventory' '200' "HTTP $($r.status)" ($r.status -eq 200) ''
# unauthorized action on Shop B
$r = Invoke-Api -Method Get -Path "/shops/$shopB/inventory" -Token $empTok
Record 'Employee reads Shop B inventory' '403' "HTTP $($r.status)" ($r.status -eq 403) ($r.body.error.code)
$r = Invoke-Api -Method Post -Path "/shops/$shopB/stock" -Token $empTok -Body @{ variant_id = $varId; quantity = 5 }
Record 'Employee adds stock to Shop B' '403' "HTTP $($r.status)" ($r.status -eq 403) ($r.body.error.code)
$r = Invoke-Api -Method Get -Path "/shops/$shopB/orders" -Token $empTok
Record 'Employee lists Shop B orders' '403' "HTTP $($r.status)" ($r.status -eq 403) ($r.body.error.code)

# 7.8 employee cannot self-assign shop / escalate
$r = Invoke-Api -Method Post -Path "/employees/$empId/shops" -Token $empTok -Body @{ shop_id = $shopB }
Record 'Employee self-assign shop blocked' '403' "HTTP $($r.status)" ($r.status -eq 403) ($r.body.error.code)
$r = Invoke-Api -Method Patch -Path "/employees/$empId" -Token $empTok -Body @{ job_title = 'Owner' }
Record 'Employee self-update blocked' '403' "HTTP $($r.status)" ($r.status -eq 403) ($r.body.error.code)
$r = Invoke-Api -Method Post -Path "/employees/$empId/invite" -Token $empTok -Body @{ employee_id = $empId }
Record 'Employee self-invite blocked' '403' "HTTP $($r.status)" ($r.status -eq 403) ($r.body.error.code)

# 7.9 employee performs sale on assigned shop (audit actor)
$r = Invoke-Api -Method Post -Path "/shops/$shopA/stock" -Token $empTok -Body @{ variant_id = $varId; quantity = 3 }
Record 'Employee adds stock Shop A' '200' "HTTP $($r.status)" ($r.status -eq 200) ''
$r = Invoke-Api -Method Post -Path "/shops/$shopA/sales" -Token $empTok -Body @{ variant_id = $varId; quantity = 1; sale_type = 'PHYSICAL'; employee_id = $empId }
Record 'Employee records sale Shop A' '200/201' "HTTP $($r.status)" ($r.status -in 200,201) ''
$mv = docker compose --project-name backend exec -T postgres psql -U btmi_user -d btmi_market -t -A -c "SELECT performed_by IS NOT NULL FROM stock_movements WHERE shop_id='$shopA' AND movement_type::text LIKE 'SALE%' ORDER BY created_at DESC LIMIT 1;"
Record 'Sale movement keeps actor identity' 'performed_by NOT NULL' $mv ($mv -eq 't' -or $mv -eq 'true') ''

Write-Host "`n========== SECTION 8: CROSS-BUSINESS SECURITY ==========" -ForegroundColor Cyan

# second seller (Owner B)
$r = Invoke-Api -Method Post -Path '/auth/register/seller' -Body @{
    first_name = 'Owner'; last_name = 'B'; phone = "+243944$($uniq.Substring(3))00"; email = "ownerb_$uniq@test.com"
    password = $sellerPass; password_confirmation = $sellerPass
}
$ownerBTok = $null
$t2 = Get-ActivationTokenFromLogs "ownerb_$uniq@test.com"
Invoke-Api -Method Get -Path "/auth/activate?token=$t2" | Out-Null
$r = Invoke-Api -Method Post -Path '/auth/login' -Body @{ email = "ownerb_$uniq@test.com"; password = $sellerPass }
$ownerBTok = $r.body.access_token
$r = Invoke-Api -Method Post -Path '/businesses' -Token $ownerBTok -Body @{
    name = "Biz B $uniq"; business_type = 'RETAIL'; category = 'general'; phone = '+243811000200'
    email = "ownerb_$uniq@test.com"; country = 'CD'; city = 'Goma'; default_currency = 'USD'
}
$bizB = $r.body.data.id
$r = Invoke-Api -Method Post -Path "/businesses/$bizB/shops" -Token $ownerBTok -Body @{ name = "BizB Shop $uniq"; type='PHYSICAL'; city='Goma'; address='1 St'; phone='+243855000001' }
$shopBizB = $r.body.data.id
Record 'Setup Business B + shop' 'created' "biz=$bizB shop=$shopBizB" ($null -ne $bizB -and $null -ne $shopBizB) ''

# Owner A accessing Business B resources
foreach ($case in @(
    @{ n='Owner A gets Business B detail'; m='Get'; p="/businesses/$bizB" },
    @{ n='Owner A lists Business B shops'; m='Get'; p="/businesses/$bizB/shops" },
    @{ n='Owner A lists Business B employees'; m='Get'; p="/businesses/$bizB/employees" },
    @{ n='Owner A lists Business B products'; m='Get'; p="/businesses/$bizB/products" },
    @{ n='Owner A lists Business B orders'; m='Get'; p="/businesses/$bizB/orders" },
    @{ n='Owner A lists Business B customers'; m='Get'; p="/businesses/$bizB/customers" },
    @{ n='Owner A gets Business B cash summary'; m='Get'; p="/businesses/$bizB/cash-summary" },
    @{ n='Owner A creates shop in Business B'; m='Post'; p="/businesses/$bizB/shops" },
    @{ n='Owner A creates employee in Business B'; m='Post'; p="/businesses/$bizB/employees" }
)) {
    $rr = Invoke-Api -Method $case.m -Path $case.p -Token $sellerTok -Body $(if ($case.m -eq 'Post') { @{ name='x'; type='PHYSICAL'; first_name='x'; last_name='x'; business_type='RETAIL'; category='general'; phone='x'; email='x@test.com'; country='CD'; city='x'; default_currency='USD' } })
    $blocked = ($rr.status -eq 403 -or $rr.status -eq 404)
    Record $case.n '403/404 no leakage' "HTTP $($rr.status)" $blocked ($rr.body.error.code)
}

# Employee A accessing Business B shop
$r = Invoke-Api -Method Get -Path "/shops/$shopBizB/inventory" -Token $empTok
Record 'Employee A reads Business B shop inventory' '403' "HTTP $($r.status)" ($r.status -eq 403) ($r.body.error.code)

# Buyer portal boundary: buyer cannot access seller endpoints
$r = Invoke-Api -Method Post -Path '/auth/register' -Body @{
    first_name='Buyer'; last_name='T'; phone="+243977$($uniq.Substring(3))00"; email=$buyerEmail
    password=$sellerPass; password_confirmation=$sellerPass
}
$bt = Get-ActivationTokenFromLogs $buyerEmail
Invoke-Api -Method Get -Path "/auth/activate?token=$bt" | Out-Null
$r = Invoke-Api -Method Post -Path '/auth/login' -Body @{ email = $buyerEmail; password = $sellerPass }
$buyerTok = $r.body.access_token
Record 'Buyer register+activate+login' '200 BUYER' "type=$($r.body.user.account_type)" ($r.body.user.account_type -eq 'BUYER') ''
$r = Invoke-Api -Method Post -Path '/businesses' -Token $buyerTok -Body @{
    name = 'Sneaky Biz'; business_type = 'RETAIL'; category = 'general'; phone = '+243811000300'
    email = $buyerEmail; country = 'CD'; city = 'Kinshasa'; default_currency = 'USD'
}
Record 'BUYER cannot create business' '403' "HTTP $($r.status)" ($r.status -eq 403) ($r.body.error.code)
$r = Invoke-Api -Method Get -Path '/businesses' -Token $buyerTok
Record 'BUYER sees no businesses' '200 empty/null' "HTTP $($r.status) count=$(Get-Count $r.body.data)" ($r.status -eq 200 -and (Get-Count $r.body.data) -eq 0) ''

Write-Host "`n========== SECTION 9: BUYER ORDER -> SELLER + PAYMENT ==========" -ForegroundColor Cyan

# buyer profile required before ordering
$r = Invoke-Api -Method Post -Path '/buyer/profile' -Token $buyerTok -Body @{
    first_name = 'Buyer'; last_name = 'T'; phone = '+243999000111'; email = $buyerEmail; city = 'Kinshasa'; commune = 'Gombe'
}
Record 'Buyer creates profile' '200/201' "HTTP $($r.status)" ($r.status -in 200,201) (($r.body | ConvertTo-Json -Depth 4))

# ensure stock for buyer order
Invoke-Api -Method Post -Path "/shops/$shopA/stock" -Token $sellerTok -Body @{ variant_id = $varId; quantity = 20 } | Out-Null
# marketplace visibility check
$r = Invoke-Api -Method Get -Path "/marketplace/products/$prodId/detail"
Record 'Product visible in marketplace' '200 published' "HTTP $($r.status)" ($r.status -eq 200) ''
# buyer preview + create order
$r = Invoke-Api -Method Post -Path '/buyer/orders/preview' -Token $buyerTok -Body @{ shop_id = $shopA; items = @(@{ product_id = $prodId; variant_id = $varId; quantity = 1 }); use_points = $false }
Record 'Buyer order preview' '200' "HTTP $($r.status)" ($r.status -eq 200) ''
$idem = [guid]::NewGuid().ToString()
$r = Invoke-Api -Method Post -Path '/buyer/orders' -Token $buyerTok -Body @{ shop_id = $shopA; items = @(@{ product_id = $prodId; variant_id = $varId; quantity = 1 }); use_points = $false; idempotency_key = $idem }
Record 'Buyer creates order' '200/201 PENDING' "HTTP $($r.status) st=$($r.body.data.order.status)" ($r.status -in 200,201 -and $r.body.data.order.status -eq 'PENDING') ($r.body | ConvertTo-Json -Depth 4)
$buyerOrderId = if ($r.body.data.order) { $r.body.data.order.id } else { $r.body.data.id }
# seller sees the order in shop scope
$r = Invoke-Api -Method Get -Path "/shops/$shopA/orders" -Token $sellerTok
$found = @($r.body.data) | Where-Object { $_.id -eq $buyerOrderId }
if ($null -eq $found -and $r.body.data.orders) { $found = @($r.body.data.orders) | Where-Object { $_.id -eq $buyerOrderId } }
Record 'Seller sees buyer order in Shop A' 'order listed' "found=$($null -ne $found)" ($null -ne $found) ''
# seller accepts
$r = Invoke-Api -Method Post -Path "/orders/$buyerOrderId/accept" -Token $sellerTok -Body @{}
Record 'Seller accepts buyer order' '200 ACCEPTED' "HTTP $($r.status)" ($r.status -eq 200) ''
# delivery selection
$r = Invoke-Api -Method Get -Path "/buyer/orders/$buyerOrderId/delivery-options" -Token $buyerTok
$optCount = Get-Count $r.body.data.options
Record 'Buyer delivery options' '200' "HTTP $($r.status) opts=$optCount" ($r.status -eq 200) ''
$r = Invoke-Api -Method Post -Path "/buyer/orders/$buyerOrderId/delivery" -Token $buyerTok -Body @{ method = 'PICKUP'; use_points_for_delivery = $false; contact_name='Buyer T'; phone='+243999000000'; address='Test addr' }
Record 'Buyer selects delivery' '200' "HTTP $($r.status)" ($r.status -eq 200) ''
# payment create + buyer confirm
$r = Invoke-Api -Method Post -Path "/buyer/orders/$buyerOrderId/payment" -Token $buyerTok -Body @{}
Record 'Buyer creates payment' '200/201 PENDING' "HTTP $($r.status) st=$($r.body.data.status)" ($r.status -in 200,201 -and $r.body.data.status -eq 'PENDING') ($r.body | ConvertTo-Json -Depth 4)
$payId = $r.body.data.id
$r = Invoke-Api -Method Post -Path "/buyer/payments/$payId/buyer-confirm" -Token $buyerTok -Body @{}
$stAfterBuyer = $r.body.data.status
Record 'Buyer confirms paid -> CONFIRMED (not VERIFIED)' 'CONFIRMED' "HTTP $($r.status) st=$stAfterBuyer" ($r.status -eq 200 -and $stAfterBuyer -eq 'CONFIRMED') ''
# seller confirms cash received
$r = Invoke-Api -Method Post -Path "/payments/$payId/seller-confirm" -Token $sellerTok -Body @{}
$stAfterSeller = $r.body.data.status
Record 'Seller confirms cash -> VERIFIED' 'VERIFIED' "HTTP $($r.status) st=$stAfterSeller" ($r.status -eq 200 -and $stAfterSeller -eq 'VERIFIED') ''

Write-Host "`n========== SECTION 10: WORKER BACKGROUND JOBS ==========" -ForegroundColor Cyan
Start-Sleep -Seconds 5
$wlogs = docker compose --project-name backend logs worker --tail 60 2>&1 | Select-String -Pattern "processed|error|fail|panic" | Select-Object -Last 15
$wlogText = ($wlogs | ForEach-Object { $_.ToString() }) -join "`n"
$hasFail = $wlogText -match '(error|fail|panic)'
Record 'Worker processed jobs without errors' 'no errors in recent worker log' "$(if($hasFail){'ERRORS FOUND'}else{'clean'})" (-not $hasFail) $wlogText
$vt = docker compose --project-name backend exec -T postgres psql -U btmi_user -d btmi_market -t -A -c "SELECT count(*) FROM verified_transactions WHERE order_id='$buyerOrderId';"
Record 'Verified transaction recorded' '>=1' $vt ([int]$vt -ge 1) ''

# growth reflects verified activity
$r = Invoke-Api -Method Get -Path "/businesses/$bizId/growth/points" -Token $sellerTok
Record 'Seller growth points after verified sale' 'current_points > 0' "HTTP $($r.status) pts=$($r.body.data.current_points)" ($r.status -eq 200 -and [int]$r.body.data.current_points -gt 0) ''

Write-Host "`n========== SECTION 11: REVIEWS (READ-ONLY FOR SELLER) ==========" -ForegroundColor Cyan
# buyer order is PICKUP: accept(done) -> prepare -> READY_FOR_PICKUP -> received -> COMPLETED -> review
$r = Invoke-Api -Method Post -Path "/orders/$buyerOrderId/prepare" -Token $sellerTok -Body @{}
Record 'Seller prepares order' '200 PREPARING' "HTTP $($r.status)" ($r.status -eq 200) (($r.body | ConvertTo-Json -Depth 3))
$r = Invoke-Api -Method Post -Path "/orders/$buyerOrderId/tracking/status" -Token $sellerTok -Body @{ status = 'READY_FOR_PICKUP' }
Record 'Seller marks READY_FOR_PICKUP' '200' "HTTP $($r.status)" ($r.status -eq 200) (($r.body | ConvertTo-Json -Depth 3))
$r = Invoke-Api -Method Post -Path "/buyer/orders/$buyerOrderId/received" -Token $buyerTok -Body @{}
$recvStatus = if ($r.body.data.order) { $r.body.data.order.status } else { $r.body.data.status }
Record 'Buyer confirms received' '200 COMPLETED (auto)' "HTTP $($r.status) st=$recvStatus" ($r.status -eq 200 -and $recvStatus -eq 'COMPLETED') (($r.body | ConvertTo-Json -Depth 3))
# PICKUP orders auto-complete on buyer receipt; a further transition must be rejected
$r = Invoke-Api -Method Post -Path "/orders/$buyerOrderId/tracking/status" -Token $sellerTok -Body @{ status = 'COMPLETED' }
Record 'Terminal order rejects transition' '400' "HTTP $($r.status)" ($r.status -eq 400) ''
$r = Invoke-Api -Method Get -Path "/buyer/orders/$buyerOrderId/review-eligibility" -Token $buyerTok
Record 'Review eligibility' 'eligible=true' "HTTP $($r.status) eligible=$($r.body.data.eligible) reason=$($r.body.data.reason)" ($r.status -eq 200 -and $r.body.data.eligible -eq $true) ''
$r = Invoke-Api -Method Post -Path "/buyer/orders/$buyerOrderId/review" -Token $buyerTok -Body @{ rating = 5; comment = 'Great service, fast pickup!' }
Record 'Buyer creates review' '200/201' "HTTP $($r.status)" ($r.status -in 200,201) ($r.body | ConvertTo-Json -Depth 3)
$reviewId = $r.body.data.id
# seller reads reviews via marketplace endpoint; aggregate is refreshed by the worker asynchronously
$aggTotal = 0
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    $r = Invoke-Api -Method Get -Path "/marketplace/shops/$shopA/reviews"
    if ($r.status -eq 200 -and $r.body.data.summary.total_reviews) { $aggTotal = [int]$r.body.data.summary.total_reviews }
    if ($aggTotal -ge 1) { break }
}
Record 'Seller reads shop reviews' '200 with review' "HTTP $($r.status) total=$aggTotal" ($r.status -eq 200 -and $aggTotal -ge 1) ''
# seller cannot edit/delete buyer review (denied: 401/403/404 all block mutation)
$r = Invoke-Api -Method Patch -Path "/buyer/reviews/$reviewId" -Token $sellerTok -Body @{ rating = 1; comment = 'hacked' }
Record 'Seller cannot edit buyer review' '401/403/404' "HTTP $($r.status)" ($r.status -in 401,403,404) ($r.body.error.code)
$r = Invoke-Api -Method Delete -Path "/buyer/reviews/$reviewId" -Token $sellerTok
Record 'Seller cannot delete buyer review' '401/403/404' "HTTP $($r.status)" ($r.status -in 401,403,404) ($r.body.error.code)

Write-Host "`n========== SECTION 12: BUYER REGRESSION CORE ==========" -ForegroundColor Cyan
$r = Invoke-Api -Method Get -Path '/marketplace/products'
Record 'Marketplace products list' '200' "HTTP $($r.status) count=$(Get-Count $r.body.data.products)" ($r.status -eq 200) ''
$r = Invoke-Api -Method Get -Path '/marketplace/search?q=T-Shirt'
Record 'Marketplace search' '200' "HTTP $($r.status)" ($r.status -eq 200) ''
$r = Invoke-Api -Method Get -Path '/marketplace/categories'
Record 'Marketplace categories' '200' "HTTP $($r.status)" ($r.status -eq 200) ''
$r = Invoke-Api -Method Get -Path '/buyer/points' -Token $buyerTok
Record 'Buyer points endpoint' '200' "HTTP $($r.status)" ($r.status -eq 200) ''
$r = Invoke-Api -Method Get -Path '/buyer/orders' -Token $buyerTok
$buyerOrders = @()
if ($r.body.data -and $r.body.data.orders) { $buyerOrders = @($r.body.data.orders) }
elseif ($r.body.data) { $buyerOrders = @($r.body.data) }
Record 'Buyer orders list' '200 includes order' "HTTP $($r.status) count=$($buyerOrders.Count)" ($r.status -eq 200 -and $buyerOrders.Count -ge 1) (($r.body | ConvertTo-Json -Depth 3))

# ---- Save results ----
$passCount = ($RESULTS | Where-Object { $_.Pass }).Count
$total = $RESULTS.Count
$jsonPath = Join-Path $OUT "e2e_results_$STAMP.json"
$RESULTS | ConvertTo-Json -Depth 5 | Set-Content -Path $jsonPath -Encoding UTF8
Write-Host "`n================ RESULTS: $passCount / $total PASSED ================" -ForegroundColor Yellow
Write-Host "Evidence saved: $jsonPath"
$RESULTS | Where-Object { -not $_.Pass } | ForEach-Object { Write-Host "FAILED: $($_.Test) -> $($_.Actual)" -ForegroundColor Red }




