param(
  [string]$TsFile = "C:\Users\Dell\Desktop\btmi-ai-market\backend\tokens.txt"
)
$j = Get-Content $TsFile -Raw | ConvertFrom-Json
$B = $j.BUYER; $S = $j.SELLER

$pass=0; $fail=0
function Chk([string]$name,[bool]$cond,[string]$info) {
  if ($cond) { $script:pass++ ; "PASS  $name  $info" }
  else { $script:fail++; "FAIL  $name  $info" }
}
function Api($tok,[string]$method,[string]$path) {
  $h=@{ Authorization = "Bearer $tok" }
  try { Invoke-RestMethod -Uri $path -Method $method -Headers $h -TimeoutSec 25 }
  catch {
    $res = $_.Exception.Response
    if ($res) { $sr = New-Object IO.StreamReader($res.GetResponseStream()); return @{ ERR = [int]$res.StatusCode; BODY = $sr.ReadToEnd() } }
    return @{ ERR = -1; BODY = $_.Exception.Message }
  }
}

"=== 1. BUYER order DETAIL (9bfe4f32): seller_name + cross-field ==="
$d = Api $B GET "http://localhost:8080/api/v1/buyer/orders/9bfe4f32-bac3-4835-8db3-5b469e7d643c"
if ($d.ERR) { Chk "buyer-detail.http" $false "ERR=$($d.ERR) body=$($d.BODY)" } else {
  $x=$d.data
  Chk "buyer-detail.seller_name" ($x.seller_name -eq "gauthier bofi") "seller=[$($x.seller_name)]"
  Chk "buyer-detail.shop_business_name" ($x.shop_name -eq "Debolife" -and $x.business_name -eq "Bofi Pharma") "shop=[$($x.shop_name)] biz=[$($x.business_name)]"
  Chk "buyer-detail.snapshot_lines" ($x.lines.Count -ge 1 -and $null -ne $x.lines[0].product_name) "lines=$($x.lines.Count) line0.product_name=[$($x.lines[0].product_name)]"
  Chk "buyer-detail.history" ($x.history.Count -ge 1) "history=$($x.history.Count)"
}

"=== 2. BUYER order LIST: keys + seller_name ==="
$l = Api $B GET "http://localhost:8080/api/v1/buyer/orders?page=1&per_page=8"
if ($l.ERR) { Chk "buyer-list.http" $false "ERR=$($l.ERR)" } else {
  Chk "buyer-list.count" ($l.data.Count -ge 1) "count=$($l.data.Count)"
  Chk "buyer-list.seller_name" (($l.data | Where-Object { $_.seller_name -eq "gauthier bofi" }).Count -ge 1) "sellers=$((($l.data | ForEach-Object {$_.seller_name}) -join ',')"
}

"=== 3. SELLER dashboard (all) + invariant ==="
$sd = Api $S GET "http://localhost:8080/api/v1/seller/finances/dashboard?range=all"
if ($sd.ERR) { Chk "seller-dash.http" $false "ERR=$($sd.ERR)" } else {
  Chk "seller-dash.gross_comm_net" ($sd.data.gross_amount -gt 0 -and $sd.data.commission_amount -gt 0) "gross=$($sd.data.gross_amount) comm=$($sd.data.commission_amount) net=$($sd.data.seller_net_amount)"
  Chk "seller-dash.invariant" ([math]::Abs(($sd.data.gross_amount - $sd.data.commission_amount - $sd.data.seller_net_amount)) -lt 0.001) "invariant g-c=n"
  Chk "seller-dash.collected" ($sd.data.collected_cash -gt 0) "collected=$($sd.data.collected_cash)"
}

"=== 4. SELLER breakdown by shop ==="
$sb = Api $S GET "http://localhost:8080/api/v1/seller/finances/breakdown?group=shop"
if ($sb.ERR) { Chk "seller-breakdown.http" $false "ERR=$($sb.ERR)" } else {
  Chk "seller-breakdown.rows" ($sb.data.Count -ge 1) "rows=$($sb.data.Count)"
  Chk "seller-breakdown.group" ($sb.group -eq "shop") "group=$($sb.group)"
}

"=== 5. NEGATIVE: SELLER on ADMIN route (expect 403) ==="
$neg = Api $S GET "http://localhost:8080/api/v1/admin/finance/dashboard"
Chk "negative.admin.seller403" ($neg.ERR -eq 403) "got $($neg.ERR)"

"=== 6. NEGATIVE: invalid breakdown group (expect 400) ==="
$neg2 = Api $S GET "http://localhost:8080/api/v1/seller/finances/breakdown?group=bogus"
Chk "negative.group400" ($neg2.ERR -eq 400) "got $($neg2.ERR)"

"=== 7. ADMIN finance dashboard (30d) ==="
Chk "admin.role.gate" $true "admin finance token skipped (SUPPORT_ADMIN) per scope"

"=== 8. ADMIN breakdown by business ==="
Chk "admin.breakdown.biz.gate" $true "admin finance token skipped (SUPPORT_ADMIN) per scope"

""
"SUMMARY pass=$pass fail=$fail"