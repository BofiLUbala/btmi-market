$ErrorActionPreference = "Continue"
$BASE = "http://localhost:8080/api/v1"
$tmpj = Join-Path $env:TEMP "_api_body.json"

function Ck([string]$n, [bool]$ok, [string]$i) {
  if ($ok) { $script:pass++; "PASS  $n  $i" } else { $script:fail++; "FAIL  $n  $i" }
}
function MintPair {
  $tg = go run .\devtools\tokengen\main.go 2>&1 | Out-String
  $j  = $tg.Substring($tg.IndexOf('{')) | ConvertFrom-Json -ErrorAction Stop
  return ,@($j.BUYER, $j.SELLER)
}
function Hit([string]$tok, [string]$meth, [string]$url, [string]$qr = "") {
  $exe = "curl.exe"
  if ($qr) { $u = "$url`?$qr" } else { $u = $url }
  $code = & $exe -s -o $tmpj -w "%{http_code}" -X $meth -H "Authorization: Bearer $tok" $u 2>$null
  $txt = ""
  if (Test-Path $tmpj) { $txt = [IO.File]::ReadAllText($tmpj) }
  if ($txt) { $j = try { $txt | ConvertFrom-Json } catch { $null } } else { $j = $null }
  [pscustomobject]@{ Code = [int]$code; Json = $j; Raw = $txt }
}

$b,$s = MintPair
"BUYER len=$($b.Length)  SELLER len=$($s.Length)"

"`n=== 1. BUYER order DETAIL 9bfe4f32...643c (owner-fallback seller) ==="
$r = Hit $b GET "$BASE/buyer/orders/9bfe4f32-bac3-4835-8db3-5b469e7d643c"
if ($r.Code -eq 200 -and $r.Json) {
  $x = $r.Json.data
  Ck "r1.seller" ($x.seller_name -eq "gauthier bofi") "seller=[$($x.seller_name)]"
  Ck "r1.shop"   ($x.shop_name -eq "Debolife") "shop=[$($x.shop_name)]"
  Ck "r1.biz"    ($x.business_name -eq "Bofi Pharma") "biz=[$($x.business_name)]"
  Ck "r1.lines"  ($x.lines.Count -ge 1 -and $x.history.Count -ge 1) "lines=$($x.lines.Count) hist=$($x.history.Count)"
} else { Ck "r1.http" $false "code=$($r.Code) raw=$($r.Raw.Substring(0,[Math]::Min(120,$r.Raw.Length)))" }

"`n=== 2. BUYER order LIST enriched ==="
$r2 = Hit $b GET "$BASE/buyer/orders" "page=1&per_page=8"
if ($r2.Code -eq 200 -and $r2.Json) {
  $rows = $r2.Json.data
  Ck "r2.count" ($rows.Count -ge 2) "count=$($rows.Count)"
  if ($rows.Count -ge 1) {
    Ck "r2.seller" ($rows[0].seller_name -eq "gauthier bofi") "seller=[$($rows[0].seller_name)]"
    Ck "r2.shop"   ($rows[0].shop_name -eq "Debolife") "shop=[$($rows[0].shop_name)]"
    Ck "r2.biz"    ($rows[0].business_name -eq "Bofi Pharma") "biz=[$($rows[0].business_name)]"
  }
} else { Ck "r2.http" $false "code=$($r2.Code)" }

"`n=== 3. SELLER dashboard 7d: invariant gross-comm=net + collected ==="
$r3 = Hit $s GET "$BASE/seller/finances/dashboard" "range=7d"
if ($r3.Code -eq 200 -and $r3.Json) {
  $x3 = $r3.Json.data
  Ck "r3.gross" ($x3.gross_amount -eq 12600) "gross=$($x3.gross_amount)"
  Ck "r3.comm"  ($x3.commission_amount -gt 0) "comm=$($x3.commission_amount)"
  $gcn = $x3.gross_amount - $x3.commission_amount
  Ck "r3.invariant" ([Math]::Abs($gcn - $x3.seller_net_amount) -lt 0.01) "g-c=$gcn net=$($x3.seller_net_amount)"
  Ck "r3.collected" ($x3.collected_cash -gt 0) "collected=$($x3.collected_cash)"
} else { Ck "r3.http" $false "code=$($r3.Code)" }

"`n=== 4. SELLER breakdown shop + product ==="
$b1 = Hit $s GET "$BASE/seller/finances/breakdown" "group=shop"
if ($b1.Code -eq 200 -and $b1.Json) { Ck "r4.shop" (($b1.Json.data).Count -ge 1) "rows=$($b1.Json.data.Count)" } else { Ck "r4.shop.http" $false "code=$($b1.Code)" }
$b2 = Hit $s GET "$BASE/seller/finances/breakdown" "group=product"
if ($b2.Code -eq 200 -and $b2.Json) { Ck "r4.prod" (($b2.Json.data).Count -ge 1) "rows=$($b2.Json.data.Count)" } else { Ck "r4.prod.http" $false "code=$($b2.Code)" }

"`n=== 5. NEGATIVE: SELLER on ADMIN route (expect 403) ==="
$n1 = Hit $s GET "$BASE/admin/finance/dashboard"
Ck "r5.admin403" ($n1.Code -eq 403) "code=$($n1.Code)"

"`n=== 6. NEGATIVE: invalid group (expect 400) ==="
$n2 = Hit $s GET "$BASE/seller/finances/breakdown" "group=bogus"
Ck "r6.group400" ($n2.Code -eq 400) "code=$($n2.Code)"

"`n`nRESULT  pass=$pass  fail=$fail"
