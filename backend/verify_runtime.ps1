param(
  [string]$TokGenPath = ".\devtools\tokengen\main.go"
)

function Get-Tokens {
  $raw = go run $TokGenPath 2>&1 | Out-String
  $j = $raw | ConvertFrom-Json
  @{ BUYER = $j.BUYER; SELLER = $j.SELLER }
}

function Invoke-Api([string]$token, [string]$method, [string]$path, [string]$body = $null) {
  $h = @{ Authorization = "Bearer $token" }
  try {
    if ($body) {
      Invoke-WebRequest -Uri $path -Method $method -Headers $h -ContentType "application/json" -Body $body -TimeoutSec 25
    } else {
      Invoke-WebRequest -Uri $path -Method $method -Headers $h -TimeoutSec 25
    }
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $stream = $resp.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $content = $reader.ReadToEnd()
      return [pscustomobject]@{ StatusCode = [int]$resp.StatusCode; Content = $content; ERR = $null }
    }
    return [pscustomobject]@{ StatusCode = $null; Content = $null; ERR = $_.Exception.Message }
  }
}

$pass = 0; $fail = 0
function Assert([string]$name, [bool]$ok, [string]$info) {
  if ($ok) { $script:pass++; "PASS  $name  $info" }
  else { $script:fail++; "FAIL  $name  $info" }
}

$toks = Get-Tokens
if (-not $toks.BUYER -or -not $toks.SELLER) { "tokengen failed"; exit 1 }
$B = $toks.BUYER; $S = $toks.SELLER
"tokens ready B=$($B.Length) S=$($S.Length)"

"=== 1. BUYER order DETAIL (order 9bfe4f32): seller_name = gauthier bofi ==="
$det = Invoke-Api $B GET "http://localhost:8080/api/v1/buyer/orders/9bfe4f32-bac3-4835-8db3-5b469e7d643c"
if (-not $det.ERR -and $det.StatusCode -eq 200) {
  $j = $det.Content | ConvertFrom-Json
  $d = $j.data
  Assert "buyer-detail.seller_name" ($d.seller_name -eq "gauthier bofi") "seller=[$($d.seller_name)]"
  Assert "buyer-detail.shop+business" ($d.shop_name -eq "Debolife" -and $d.business_name -eq "Bofi Pharma") "shop=[$($d.shop_name)] biz=[$($d.business_name)]"
  Assert "buyer-detail.lines+history" ($d.lines.Count -ge 1 -and $d.history.Count -ge 1) "lines=$($d.lines.Count) hist=$($d.history.Count)"
} else { Assert "buyer-detail.http" $false "status=$($det.StatusCode) err=$($det.ERR)" }

"=== 2. BUYER order LIST ==="
$lst = Invoke-Api $B GET "http://localhost:8080/api/v1/buyer/orders?page=1&per_page=8"
if (-not $lst.ERR -and $lst.StatusCode -eq 200) {
  $j2 = $lst.Content | ConvertFrom-Json
  $rows = $j2.data
  Assert "buyer-list.rows" ($rows.Count -ge 2) "count=$($rows.Count)"
  $r0 = $rows[0]
  Assert "buyer-list.first.seller" ($r0.seller_name -eq "gauthier bofi") "seller=[$($r0.seller_name)]"
  Assert "buyer-list.has.shop+biz" ($r0.shop_name -eq "Debolife" -and $r0.business_name -eq "Bofi Pharma") "[$($r0.shop_name)|$($r0.business_name)]"
} else { Assert "buyer-list.http" $false "status=$($lst.StatusCode) err=$($lst.ERR)" }

"=== 3. SELLER dashboard (7d) ==="
$sd = Invoke-Api $S GET "http://localhost:8080/api/v1/seller/finances/dashboard?range=7d"
if (-not $sd.ERR -and $sd.StatusCode -eq 200) {
  $j3 = $sd.Content | ConvertFrom-Json
  $d3 = $j3.data
  $inv = [math]::Abs(($d3.gross_amount - $d3.commission_amount) - $d3.seller_net_amount) -lt 0.01
  Assert "seller-dash.gross.positive" ($d3.gross_amount -gt 1000) "gross=$($d3.gross_amount)"
  Assert "seller-dash.comm" ($d3.commission_amount -gt 0) "comm=$($d3.commission_amount)"
  Assert "seller-dash.invariant g-c=n" $inv "g-c=$([math]::Round($d3.gross_amount - $d3.commission_amount,2)) net=$($d3.seller_net_amount)"
  Assert "seller-dash.collected" ($d3.collected_cash -gt 0) "collected=$($d3.collected_cash)"
} else { Assert "seller-dash.http" $false "status=$($sd.StatusCode) err=$($sd.ERR)" }

"=== 4. SELLER breakdown shop + product ==="
$sb = Invoke-Api $S GET "http://localhost:8080/api/v1/seller/finances/breakdown?group=shop"
if (-not $sb.ERR -and $sb.StatusCode -eq 200) {
  $j4 = $sb.Content | ConvertFrom-Json
  Assert "seller-breakdown.shop" ($j4.data.Count -ge 1) "rows=$($j4.data.Count)"
} else { Assert "seller-breakdown.shop.http" $false "status=$($sb.StatusCode) err=$($sb.ERR)" }
$sp = Invoke-Api $S GET "http://localhost:8080/api/v1/seller/finances/breakdown?group=product"
if (-not $sp.ERR -and $sp.StatusCode -eq 200) {
  $j5 = $sp.Content | ConvertFrom-Json
  Assert "seller-breakdown.product" ($j5.data.Count -ge 1) "rows=$($j5.data.Count)"
} else { Assert "seller-breakdown.product.http" $false "status=$($sp.StatusCode) err=$($sp.ERR)" }

"=== 5. NEGATIVE: SELLER on admin route (expect 403) ==="
$neg = Invoke-Api $S GET "http://localhost:8080/api/v1/admin/finance/dashboard"
Assert "neg.admin403" ($neg.StatusCode -eq 403) "status=$($neg.StatusCode)"

"=== 6. NEGATIVE: invalid breakdown group (expect 400) ==="
$neg2 = Invoke-Api $S GET "http://localhost:8080/api/v1/seller/finances/breakdown?group=bogus"
Assert "neg.group400" ($neg2.StatusCode -eq 400) "status=$($neg2.StatusCode)"

""
"== RESULT pass=$pass fail=$fail =="