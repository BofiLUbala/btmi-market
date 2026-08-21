# BTMI E2E test-data cleanup.
# Deletes every record created by e2e_verify.ps1 (namespaced test data only):
#   users   : email LIKE '%@test.com'
#   biz     : name LIKE 'Web Test Biz %' OR email LIKE '%@test.com'
#   shops   : shops of those businesses
# Never touches records outside the test namespace.
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts\e2e_cleanup.ps1 [-ShowCounts]
param([switch]$ShowCounts)

$ErrorActionPreference = 'Stop'

function Invoke-Psql([string]$sql) {
  $out = docker compose --project-name backend exec -T postgres psql -U btmi_user -d btmi_market -t -A -c $sql 2>&1
  if ($LASTEXITCODE -ne 0) { throw "psql failed: $out`nSQL: $sql" }
  return $out
}

# Root sets (test namespace)
$bizSet = "SELECT id FROM businesses WHERE name LIKE 'Web Test Biz %' OR email LIKE '%@test.com'"
$shopSet = "SELECT id FROM shops WHERE business_id IN ($bizSet)"
$prodSet = "SELECT id FROM products WHERE business_id IN ($bizSet)"
$userSet = "SELECT id FROM users WHERE email LIKE '%@test.com'"
$empSet = "SELECT id FROM employees WHERE business_id IN ($bizSet)"
$orderSet = "SELECT id FROM orders WHERE shop_id IN ($shopSet) OR created_by IN ($userSet)"
$buyerProfileSet = "SELECT id FROM buyer_profiles WHERE user_id IN ($userSet)"

$steps = @(
  @("review_history", "DELETE FROM review_history WHERE review_id IN (SELECT id FROM seller_reviews WHERE shop_id IN ($shopSet) OR order_id IN ($orderSet))"),
  @("seller_reviews", "DELETE FROM seller_reviews WHERE shop_id IN ($shopSet) OR order_id IN ($orderSet) OR business_id IN ($bizSet)"),
  @("purchase_confirmations", "DELETE FROM purchase_confirmations WHERE order_id IN ($orderSet) OR buyer_profile_id IN ($buyerProfileSet)"),
  @("verified_transactions", "DELETE FROM verified_transactions WHERE order_id IN ($orderSet) OR shop_id IN ($shopSet) OR buyer_profile_id IN ($buyerProfileSet)"),
  @("buyer_payments", "DELETE FROM buyer_payments WHERE order_id IN ($orderSet) OR shop_id IN ($shopSet)"),
  @("cash_payments", "DELETE FROM cash_payments WHERE shop_id IN ($shopSet) OR business_id IN ($bizSet)"),
  @("order_status_history", "DELETE FROM order_status_history WHERE order_id IN ($orderSet)"),
  @("order_lines", "DELETE FROM order_lines WHERE order_id IN ($orderSet)"),
  @("orders", "DELETE FROM orders WHERE shop_id IN ($shopSet) OR created_by IN ($userSet)"),
  @("stock_movements", "DELETE FROM stock_movements WHERE shop_id IN ($shopSet) OR product_id IN ($prodSet)"),
  @("stock_receipt_lines", "DELETE FROM stock_receipt_lines WHERE receipt_id IN (SELECT id FROM stock_receipts WHERE shop_id IN ($shopSet))"),
  @("stock_receipts", "DELETE FROM stock_receipts WHERE shop_id IN ($shopSet)"),
  @("inventory", "DELETE FROM inventory WHERE shop_id IN ($shopSet) OR product_id IN ($prodSet)"),
  @("product_variants", "DELETE FROM product_variants WHERE product_id IN ($prodSet)"),
  @("products", "DELETE FROM products WHERE business_id IN ($bizSet)"),
  @("shop_review_aggregates", "DELETE FROM shop_review_aggregates WHERE shop_id IN ($shopSet)"),
  @("employee_shop_assignments", "DELETE FROM employee_shop_assignments WHERE shop_id IN ($shopSet) OR employee_id IN ($empSet)"),
  @("cash_sessions", "DELETE FROM cash_sessions WHERE shop_id IN ($shopSet) OR business_id IN ($bizSet)"),
  @("customers", "DELETE FROM customers WHERE business_id IN ($bizSet)"),
  @("employee_invitations", "DELETE FROM employee_invitations WHERE employee_id IN ($empSet)"),
  @("employees", "DELETE FROM employees WHERE business_id IN ($bizSet)"),
  @("seller_trust", "DELETE FROM seller_trust WHERE business_id IN ($bizSet)"),
  @("business_memberships", "DELETE FROM business_memberships WHERE business_id IN ($bizSet)"),
  @("shops", "DELETE FROM shops WHERE business_id IN ($bizSet)"),
  @("point_transactions(buyer)", "DELETE FROM point_transactions WHERE point_account_id IN (SELECT id FROM point_accounts WHERE owner_type='BUYER_PROFILE' AND owner_id IN ($buyerProfileSet))"),
  @("point_accounts(buyer)", "DELETE FROM point_accounts WHERE owner_type='BUYER_PROFILE' AND owner_id IN ($buyerProfileSet)"),
  @("point_transactions(biz)", "DELETE FROM point_transactions WHERE point_account_id IN (SELECT id FROM point_accounts WHERE owner_type='BUSINESS' AND owner_id IN ($bizSet))"),
  @("point_accounts(biz)", "DELETE FROM point_accounts WHERE owner_type='BUSINESS' AND owner_id IN ($bizSet)"),
  @("buyer_profiles", "DELETE FROM buyer_profiles WHERE user_id IN ($userSet)"),
  @("refresh_tokens", "DELETE FROM refresh_tokens WHERE user_id IN ($userSet)"),
  @("account_activation_tokens", "DELETE FROM account_activation_tokens WHERE user_id IN ($userSet)"),
  @("employee_activation_tokens", "DELETE FROM employee_activation_tokens WHERE user_id IN ($userSet)"),
  @("businesses", "DELETE FROM businesses WHERE id IN ($bizSet)"),
  @("users", "DELETE FROM users WHERE email LIKE '%@test.com'")
)

Write-Host "BTMI E2E cleanup - deleting namespaced test data..." -ForegroundColor Cyan
$total = 0
foreach ($step in $steps) {
  $name = $step[0]; $sql = $step[1]
  $countSql = "WITH deleted AS ($sql RETURNING 1) SELECT count(*) FROM deleted"
  $n = [int](Invoke-Psql $countSql)
  $null = Invoke-Psql $sql
  if ($n -gt 0) { Write-Host ("  {0,-28} {1} row(s)" -f $name, $n) }
  $total += $n
}
Write-Host "Cleanup complete - $total row(s) removed." -ForegroundColor Green

if ($ShowCounts) {
  Write-Host "`nRemaining rows in key tables:"
  foreach ($t in @('users','businesses','shops','products','orders')) {
    $c = Invoke-Psql "SELECT count(*) FROM $t"
    Write-Host ("  {0,-12} {1}" -f $t, $c)
  }
}
