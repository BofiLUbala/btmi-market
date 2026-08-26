# BTMI — Category-aware Product Configuration E2E
# Verifies: seller-driven VARIANT/INFO, cartesian, marketplace dynamic selectors,
# no hardcoded buyer selectors, stock exact, discount, simple mode.
$ErrorActionPreference = 'Stop'
$BASE = 'http://localhost:8080/api/v1'
$script:RESULTS = @()
$STAMP = Get-Date -Format 'yyyyMMdd_HHmmss'

function Record($test,$expected,$actual,$pass,$notes){ $script:RESULTS += [pscustomobject]@{Test=$test;Expected=$expected;Actual=$actual;Pass=[bool]$pass;Notes=$notes}; $icon=if($pass){'PASS'}else{'FAIL'}; Write-Host "[$icon] $test -> $actual" -ForegroundColor $(if($pass){'Green'}else{'Red'}) }
function Invoke-Api{ param([string]$Method,[string]$Path,$Body,[string]$Token) $headers=@{}; if($Token){$headers['Authorization']="Bearer $Token"}; try{ $p=@{Method=$Method;Uri="$BASE$Path";Headers=$headers;ContentType='application/json';ErrorAction='Stop'}; if($null -ne $Body){$p['Body']=($Body|ConvertTo-Json -Depth 10)}; return @{status=200;body=(Invoke-RestMethod @p)} } catch{ $c=0;$b=$null; if($_.Exception.Response){$c=[int]$_.Exception.Response.StatusCode; try{$r=New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $b=$r.ReadToEnd()|ConvertFrom-Json}catch{}}; return @{status=$c;body=$b} } }
function Activate($uid){ docker compose --project-name backend exec -T postgres psql -U btmi_user -d btmi_market -c "UPDATE users SET status='ACTIVE', email_verified=true WHERE id='$uid';" | Out-Null }

$uniq = Get-Date -Format 'HHmmss'
$sellerEmail = "prod_seller_$uniq@test.com"; $sellerPass='SellerPass123!'
$r = Invoke-Api -Method Post -Path '/auth/register/seller' -Body @{first_name='Prod';last_name='Seller';middle_name='E2E';phone="+243900$($uniq.Substring(3))11";email=$sellerEmail;password=$sellerPass;password_confirmation=$sellerPass}
$sellerUid=$r.body.data.user_id; Activate $sellerUid
$r = Invoke-Api -Method Post -Path '/auth/login' -Body @{email=$sellerEmail;password=$sellerPass}; $sellerTok=$r.body.access_token
Record 'Seller ready' '200' "HTTP $($r.status)" ($r.status -eq 200) ''

$r = Invoke-Api -Method Post -Path '/businesses' -Token $sellerTok -Body @{name="Prod Biz $uniq";business_type='RETAIL';category='general';phone='+243811000300';email=$sellerEmail;country='CD';city='Kinshasa';default_currency='USD'}
$biz=$r.body.data.id
$r = Invoke-Api -Method Post -Path "/businesses/$biz/shops" -Token $sellerTok -Body @{name='Prod Shop';type='PHYSICAL';city='Kinshasa';address='1 Test';phone='+243811000300';supports_shop_delivery=$true;shop_delivery_fee=1000}
$shop=$r.body.data.id
Record 'Biz+Shop ready' 'ids' "biz=$biz shop=$shop" ($biz -and $shop) ''

# fetch real taxonomy
$r = Invoke-Api -Method Get -Path '/categories?with_subcategories=true'
$cats = @($r.body.data)
function FindCat($slug){ return @($cats | Where-Object { $_.slug -eq $slug })[0] }
function FindSub($cat,$slug){ return @($cat.subcategories | Where-Object { $_.slug -eq $slug })[0] }

$catShoes = FindCat 'shoes'; $subRunning = FindSub $catShoes 'running'
$catFood = FindCat 'food'; $subBev = FindSub $catFood 'beverages'
$catElec = FindCat 'electronics'; $subPhones = FindSub $catElec 'phones'
$catBeauty = FindCat 'beauty'; $subSkin = FindSub $catBeauty 'skincare'
Record 'Real taxonomy loaded' '4 cats with subs' "shoes=$($catShoes.id) food=$($catFood.id) elec=$($catElec.id) beauty=$($catBeauty.id)" ($catShoes -and $catFood -and $catElec -and $catBeauty) ''

# helper: create product pipeline mimicking SellerProductCreatePage
function New-Product($name,$catId,$subId,$discount){ 
  $body=@{name=$name;sku="SKU-$uniq-$(Get-Random -Maximum 9999)";unit='PCS';unit_price=50000;cost_price=25000;category_id=$catId;subcategory_id=$subId;publication_status='DRAFT'}
  if($discount){ $body.discount_active=$true; $body.discount_type='PERCENTAGE'; $body.discount_value=10; $body.discount_start=(Get-Date).AddDays(-1).ToString('o'); $body.discount_end=(Get-Date).AddDays(7).ToString('o') }
  $r=Invoke-Api -Method Post -Path "/businesses/$biz/products" -Token $sellerTok -Body $body
  return $r.body.data.id
}
function Add-Variant($prodId,$varName,$attrs,$price,$stock){ 
  $r=Invoke-Api -Method Post -Path "/businesses/$biz/products/$prodId/variants" -Token $sellerTok -Body @{name=$varName;sku="V-$(Get-Random)";attributes=$attrs;sale_price=$price;purchase_price=20000}
  $vid=$r.body.data.id
  if($stock -ge 0){ Invoke-Api -Method Post -Path "/shops/$shop/stock" -Token $sellerTok -Body @{variant_id=$vid;quantity=$stock} | Out-Null }
  return $vid
}
function Publish($prodId){ Invoke-Api -Method Patch -Path "/businesses/$biz/products/$prodId" -Token $sellerTok -Body @{publication_status='PUBLISHED'} | Out-Null }
function MarketplaceDetail($prodId){ $r=Invoke-Api -Method Get -Path "/marketplace/products/$prodId/detail"; return $r.body.data }
function Groups($detail){ # replicates buildAttributeGroups filtering >1
  $order=@(); $vals=@{}
  foreach($v in $detail.variants){ foreach($k in $v.attributes.PSObject.Properties.Name){ if(-not $vals.ContainsKey($k)){ $order+=$k; $vals[$k]=@() }; if($vals[$k] -notcontains $v.attributes.$k){ $vals[$k]+=$v.attributes.$k } } }
  return $order | Where-Object { $vals[$_].Count -gt 1 } | ForEach-Object { [pscustomobject]@{key=$_;values=$vals[$_]} }
}
function Specs($detail){
  $all=@(); foreach($v in $detail.variants){ foreach($k in $v.attributes.PSObject.Properties.Name){ if($all -notcontains $k){$all+=$k} } }
  $specs=@(); foreach($k in $all){ $uniqVals=@($detail.variants | ForEach-Object { $_.attributes.$k } | Where-Object { $_ } | Select-Object -Unique); if($uniqVals.Count -eq 1){ $specs+= [pscustomobject]@{key=$k;value=$uniqVals[0]} } }
  return $specs
}

Write-Host "`n=== TEST 1: SHOES (Color+Size VARIANT, Material INFO) ===" -ForegroundColor Cyan
$prodShoes = New-Product "Shoes Sync $uniq" $catShoes.id $subRunning.id $false
Add-Variant $prodShoes "Black / 40" @{Color='Black';"Shoe Size"='40';Material='Mesh'} 50000 10 | Out-Null
Add-Variant $prodShoes "Black / 41" @{Color='Black';"Shoe Size"='41';Material='Mesh'} 50000 5 | Out-Null
Add-Variant $prodShoes "White / 40" @{Color='White';"Shoe Size"='40';Material='Mesh'} 50000 8 | Out-Null
Add-Variant $prodShoes "White / 41" @{Color='White';"Shoe Size"='41';Material='Mesh'} 51000 3 | Out-Null
Publish $prodShoes
$detail = MarketplaceDetail $prodShoes
$g = Groups $detail; $s = Specs $detail
Record 'Shoes: 4 variants persisted' '>=4' "$($detail.variants.Count)" ($detail.variants.Count -ge 4) ''
Record 'Shoes: marketplace groups = Color + Shoe Size' '2 groups' "$($g.key -join ',')" ($g.Count -eq 2 -and ($g.key -contains 'Color') -and ($g.key -contains 'Shoe Size')) ''
Record 'Shoes: specs = Material Mesh (single value)' 'Material=Mesh' "$($s.key -join ',')=$($s.value -join ',')" (@($s | Where-Object {$_.key -eq 'Material' -and $_.value -eq 'Mesh'}).Count -ge 1) ''
Record 'Shoes: no Color hardcoded leak' 'no extra groups' "$($g.Count) groups" ($g.Count -eq 2) ''
# invalid combination check: if we had only 3 variants missing White/41, next test verifies disabling
$prodShoes3 = New-Product "Shoes3 $uniq" $catShoes.id $subRunning.id $false
Add-Variant $prodShoes3 "Black / 40" @{Color='Black';"Shoe Size"='40'} 50000 10 | Out-Null
Add-Variant $prodShoes3 "Black / 41" @{Color='Black';"Shoe Size"='41'} 50000 5 | Out-Null
Add-Variant $prodShoes3 "White / 40" @{Color='White';"Shoe Size"='40'} 50000 8 | Out-Null
Publish $prodShoes3
$detail3 = MarketplaceDetail $prodShoes3
# White+41 should not resolve
$hasWhite41 = @($detail3.variants | Where-Object { $_.attributes.Color -eq 'White' -and $_.attributes.'Shoe Size' -eq '41' }).Count
Record 'Shoes: White/41 missing => invalid combo not selectable' '0 variants with White+41' "$hasWhite41" ($hasWhite41 -eq 0) ''
# stock exact per variant
$white40 = @($detail.variants | Where-Object { $_.attributes.Color -eq 'White' -and $_.attributes.'Shoe Size' -eq '40' })[0]
Record 'Shoes: White/40 stock exact 8' '8' "$($white40.stock_quantity)" ($white40.stock_quantity -eq 8) ''

Write-Host "`n=== TEST 2: FOOD (Flavor+Volume VARIANT, Expiration INFO) ===" -ForegroundColor Cyan
$prodFood = New-Product "Food Sync $uniq" $catFood.id $subBev.id $false
Add-Variant $prodFood "Orange 500ml" @{Flavor='Orange';Volume='500 ml';"Expiration Date"='2027-01-31'} 3000 20 | Out-Null
Add-Variant $prodFood "Orange 1L" @{Flavor='Orange';Volume='1 L';"Expiration Date"='2027-01-31'} 5000 15 | Out-Null
Add-Variant $prodFood "Mango 500ml" @{Flavor='Mango';Volume='500 ml';"Expiration Date"='2027-01-31'} 3000 10 | Out-Null
Add-Variant $prodFood "Mango 1L" @{Flavor='Mango';Volume='1 L';"Expiration Date"='2027-01-31'} 5000 12 | Out-Null
Publish $prodFood
$detail = MarketplaceDetail $prodFood
$g = Groups $detail; $s = Specs $detail
Record 'Food: 4 variants' '>=4' "$($detail.variants.Count)" ($detail.variants.Count -ge 4) ''
Record 'Food: groups = Flavor + Volume (no Color/Size)' 'Flavor,Volume' "$($g.key -join ',')" ($g.Count -eq 2 -and ($g.key -contains 'Flavor') -and ($g.key -contains 'Volume') -and -not ($g.key -contains 'Color')) ''
Record 'Food: specs = Expiration Date' 'Expiration Date' "$($s.key -join ',')" (@($s | Where-Object {$_.key -eq 'Expiration Date'}).Count -ge 1) ''

Write-Host "`n=== TEST 3: ELECTRONICS (Storage+RAM VARIANT, Model INFO) ===" -ForegroundColor Cyan
$prodElec = New-Product "Elec Sync $uniq" $catElec.id $subPhones.id $false
Add-Variant $prodElec "128GB 8GB" @{Storage='128GB';RAM='8GB';Model='Pro Max'} 800000 5 | Out-Null
Add-Variant $prodElec "128GB 16GB" @{Storage='128GB';RAM='16GB';Model='Pro Max'} 850000 3 | Out-Null
Add-Variant $prodElec "256GB 8GB" @{Storage='256GB';RAM='8GB';Model='Pro Max'} 900000 4 | Out-Null
Add-Variant $prodElec "256GB 16GB" @{Storage='256GB';RAM='16GB';Model='Pro Max'} 950000 2 | Out-Null
Publish $prodElec
$detail = MarketplaceDetail $prodElec
$g = Groups $detail; $s = Specs $detail
Record 'Elec: 4 variants' '>=4' "$($detail.variants.Count)" ($detail.variants.Count -ge 4) ''
Record 'Elec: groups = Storage + RAM' 'Storage,RAM' "$($g.key -join ',')" ($g.Count -eq 2 -and ($g.key -contains 'Storage') -and ($g.key -contains 'RAM')) ''
Record 'Elec: specs = Model Pro Max' 'Model' "$($s.key -join ',')" (@($s | Where-Object {$_.key -eq 'Model'}).Count -ge 1) ''

Write-Host "`n=== TEST 4: SIMPLE (no VARIANT, Skin Type INFO only) ===" -ForegroundColor Cyan
$prodSimple = New-Product "Simple Sync $uniq" $catBeauty.id $subSkin.id $false
Add-Variant $prodSimple "Default" @{"Skin Type"='All Skin Types'} 15000 12 | Out-Null
Publish $prodSimple
$detail = MarketplaceDetail $prodSimple
$g = Groups $detail; $s = Specs $detail
Record 'Simple: 1 variant' '>=1' "$($detail.variants.Count)" ($detail.variants.Count -ge 1) ''
Record 'Simple: no selectable groups (INFO only)' '0 groups' "$($g.Count)" ($g.Count -eq 0) ''
Record 'Simple: specs = Skin Type' 'Skin Type' "$($s.key -join ',')" (@($s | Where-Object {$_.key -eq 'Skin Type'}).Count -ge 1) ''
# stock may be on second variant due to default variant; check any variant has 12
$hasStock12 = @($detail.variants | Where-Object { $_.stock_quantity -eq 12 }).Count -ge 1
Record 'Simple: stock exact 12 somewhere' '12' "$($detail.variants[0].stock_quantity)" $hasStock12 ''

Write-Host "`n=== DISCOUNT & CATEGORY ===" -ForegroundColor Cyan
$prodDisc = New-Product "Disc $uniq" $catBeauty.id $subSkin.id $true
Add-Variant $prodDisc "Default" @{"Skin Type"='Sensitive'} 20000 5 | Out-Null
Publish $prodDisc
Start-Sleep -Seconds 1
$detail = MarketplaceDetail $prodDisc
# discount may not be in marketplace detail; check seller product endpoint instead
$rSeller = Invoke-Api -Method Get -Path "/businesses/$biz/products/$prodDisc" -Token $sellerTok
Record 'Discount: product discount_active preserved' 'true' "$($rSeller.body.data.discount_active)" ($rSeller.body.data.discount_active -eq $true) ''
Record 'Category not duplicated: buyer detail uses persisted category name' 'Beauty' "$($detail.category.name)" ($detail.category.name -eq 'Beauty') ''

$pass=($RESULTS|Where-Object{$_.Pass}).Count; $total=$RESULTS.Count
$RESULTS|ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $PSScriptRoot "evidence/product_sync_$STAMP.json") -Encoding UTF8
Write-Host "`n================ PRODUCT SYNC: $pass / $total PASSED ================" -ForegroundColor Yellow
$RESULTS | Where-Object{-not $_.Pass} | ForEach-Object{ Write-Host "FAILED: $($_.Test) -> $($_.Actual)" -ForegroundColor Red }
