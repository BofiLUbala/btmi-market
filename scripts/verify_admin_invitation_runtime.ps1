param([string]$BaseUrl = 'http://localhost:18080/api/v1')

$ErrorActionPreference = 'Stop'
$runId = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$databaseName = "admin_e2e_$runId"
$containerName = "btmi-admin-e2e-$runId"
$superAdminPassword = "Sa!$([guid]::NewGuid().ToString('N'))"
$inviteePassword = "Op!$([guid]::NewGuid().ToString('N'))"
$roles = @(
  'DIRECTION_ADMIN',
  'COMMERCE_ADMIN',
  'FINANCE_SUPPORT_ADMIN',
  'TECHNICAL_ADMIN'
)
$dashboardPaths = @{
  DIRECTION_ADMIN = '/admin/direction/overview'
  COMMERCE_ADMIN = '/admin/commerce/overview'
  FINANCE_SUPPORT_ADMIN = '/admin/finance/summary'
  TECHNICAL_ADMIN = '/admin/technical/overview'
}

function Invoke-JsonRequest {
  param([string]$Method, [string]$Path, [string]$Token, [object]$Body)
  $headers = @{}
  if ($Token) { $headers.Authorization = "Bearer $Token" }
  $args = @{ Uri = "$BaseUrl$Path"; Method = $Method; Headers = $headers; SkipHttpErrorCheck = $true }
  if ($null -ne $Body) {
    $args.ContentType = 'application/json'
    $args.Body = $Body | ConvertTo-Json -Depth 5
  }
  $response = Invoke-WebRequest @args
  $json = if ($response.Content) { $response.Content | ConvertFrom-Json } else { $null }
  return @{ Status = [int]$response.StatusCode; Json = $json }
}

try {
  docker exec backend-postgres-1 psql -U btmi_user -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $databaseName" | Out-Null
  docker run -d --name $containerName --network backend_default -p 127.0.0.1:18080:18080 `
    -e APP_ENV=development -e API_PORT=18080 -e DB_HOST=postgres -e DB_PORT=5432 `
    -e DB_NAME=$databaseName -e DB_USER=btmi_user -e DB_PASSWORD=btmi_secret_password `
    -e JWT_SECRET=admin-e2e-isolated-secret -e E2E_TEST_MODE=true -e SMTP_HOST= `
    -e FRONTEND_URL=http://localhost:5173 backend-api ./server | Out-Null

  $ready = $false
  foreach ($attempt in 1..30) {
    Start-Sleep -Milliseconds 500
    try {
      $health = Invoke-WebRequest -Uri 'http://localhost:18080/health' -SkipHttpErrorCheck
      if ($health.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
  }
  if (-not $ready) { throw 'Isolated API did not become ready' }

  docker exec -e SUPER_ADMIN_NAME='Runtime SuperAdmin' -e SUPER_ADMIN_EMAIL='superadmin@admin-e2e.invalid' `
    -e SUPER_ADMIN_PASSWORD=$superAdminPassword $containerName ./create-superadmin -update | Out-Null

  $superLogin = Invoke-JsonRequest POST '/admin/auth/login' '' @{
    email = 'superadmin@admin-e2e.invalid'
    password = $superAdminPassword
  }
  if ($superLogin.Status -ne 200 -or $superLogin.Json.data.admin.role -ne 'SUPER_ADMIN') {
    throw "SUPER_ADMIN login failed: HTTP $($superLogin.Status)"
  }
  $superToken = $superLogin.Json.data.access_token
  Write-Output 'SUPER_ADMIN_LOGIN=PASS'

$forbiddenSuperInvite = Invoke-JsonRequest POST '/admin/admin-users/invite' $superToken @{
  first_name = 'Forbidden'
  last_name = 'SuperAdmin'
  email = "admin-e2e-super-$runId@example.invalid"
  role = 'SUPER_ADMIN'
}
Write-Output "SUPER_ADMIN_UI_API_BLOCK=$($forbiddenSuperInvite.Status -eq 400) HTTP=$($forbiddenSuperInvite.Status)"

$created = @()
foreach ($role in $roles) {
  $email = "admin-e2e-$($role.ToLower())-$runId@example.invalid"
  $invite = Invoke-JsonRequest POST '/admin/admin-users/invite' $superToken @{
    first_name = 'Runtime'
    last_name = $role
    email = $email
    role = $role
  }
  if ($invite.Status -ne 201) { throw "Invite failed for $role`: HTTP $($invite.Status)" }

  $adminId = $invite.Json.data.id
  $pendingList = Invoke-JsonRequest GET "/admin/admin-users?search=$email" $superToken $null
  $pendingRow = @($pendingList.Json.data.admins | Where-Object { $_.email -eq $email }) | Select-Object -First 1
  if (-not $pendingRow -or $pendingRow.invitation_status -ne 'PENDING') {
    throw "Pending invitation status missing for $role"
  }

  $resend = Invoke-JsonRequest POST "/admin/admin-users/$adminId/resend-invitation" $superToken $null
  if ($resend.Status -ne 200) { throw "Resend failed for $role`: HTTP $($resend.Status)" }

  Start-Sleep -Milliseconds 150
  $logs = docker logs $containerName 2>&1 | Out-String
  $emailPattern = [regex]::Escape($email)
  $match = [regex]::Matches($logs, "$emailPattern[^\r\n]*[?&]token=([0-9a-f]+)") | Select-Object -Last 1
  if (-not $match) { throw "Activation token was not found in E2E logs for $role" }
  $activationToken = $match.Groups[1].Value

  $verify = Invoke-JsonRequest GET "/admin/invitations/verify?token=$activationToken" '' $null
  if ($verify.Status -ne 200 -or $verify.Json.data.role -ne $role) { throw "Verify failed for $role" }

  $activate = Invoke-JsonRequest POST '/admin/invitations/activate' '' @{
    token = $activationToken
    password = $inviteePassword
    password_confirmation = $inviteePassword
  }
  if ($activate.Status -ne 200) { throw "Activation failed for $role`: HTTP $($activate.Status)" }

  $login = Invoke-JsonRequest POST '/admin/auth/login' '' @{ email = $email; password = $inviteePassword }
  if ($login.Status -ne 200) { throw "Login failed for $role`: HTTP $($login.Status)" }
  $token = $login.Json.data.access_token
  $refreshToken = $login.Json.data.refresh_token

  foreach ($candidateRole in $roles) {
    $dashboard = Invoke-JsonRequest GET $dashboardPaths[$candidateRole] $token $null
    $expected = if ($candidateRole -eq $role) { 200 } else { 403 }
    if ($dashboard.Status -ne $expected) {
      throw "$role -> $candidateRole expected HTTP $expected, got $($dashboard.Status)"
    }
  }
  $management = Invoke-JsonRequest GET '/admin/admin-users' $token $null
  if ($management.Status -ne 403) { throw "$role accessed SUPER_ADMIN management: HTTP $($management.Status)" }

  if ($role -eq 'DIRECTION_ADMIN') {
    $changed = Invoke-JsonRequest POST "/admin/admin-users/$adminId/change-role" $superToken @{
      role = 'COMMERCE_ADMIN'; reason = 'Runtime RBAC role-change verification'
    }
    if ($changed.Status -ne 200) { throw 'Operational role change failed' }
    if ((Invoke-JsonRequest GET $dashboardPaths.COMMERCE_ADMIN $token $null).Status -ne 200 -or
        (Invoke-JsonRequest GET $dashboardPaths.DIRECTION_ADMIN $token $null).Status -ne 403) {
      throw 'Role change was not enforced immediately against an existing access token'
    }
    $restored = Invoke-JsonRequest POST "/admin/admin-users/$adminId/change-role" $superToken @{
      role = 'DIRECTION_ADMIN'; reason = 'Restore role after runtime verification'
    }
    if ($restored.Status -ne 200) { throw 'Operational role restore failed' }
  }

  $suspended = Invoke-JsonRequest POST "/admin/admin-users/$adminId/suspend" $superToken @{ reason = 'Runtime suspension verification' }
  if ($suspended.Status -ne 200 -or (Invoke-JsonRequest GET $dashboardPaths[$role] $token $null).Status -ne 401) {
    throw "Suspension was not enforced for $role"
  }
  $reactivated = Invoke-JsonRequest POST "/admin/admin-users/$adminId/reactivate" $superToken @{ reason = 'Runtime reactivation verification' }
  if ($reactivated.Status -ne 200 -or (Invoke-JsonRequest GET $dashboardPaths[$role] $token $null).Status -ne 200) {
    throw "Reactivation failed for $role"
  }

  $forced = Invoke-JsonRequest POST "/admin/admin-users/$adminId/force-logout" $superToken @{ reason = 'Runtime force logout verification' }
  $accessAfterForce = Invoke-JsonRequest GET $dashboardPaths[$role] $token $null
  $refreshAfterForce = Invoke-JsonRequest POST '/admin/auth/refresh' '' @{ refresh_token = $refreshToken }
  if ($forced.Status -ne 200 -or $accessAfterForce.Status -ne 401 -or $refreshAfterForce.Status -ne 401) {
    throw "Force logout did not revoke both token types for $role"
  }

  $created += $email
  Write-Output "$role=PASS"
}

$list = Invoke-JsonRequest GET "/admin/admin-users?search=admin-e2e-&limit=20" $superToken $null
if ($list.Status -ne 200) { throw "Admin list failed: HTTP $($list.Status)" }
$testedRows = @($list.Json.data.admins | Where-Object { $_.email -in $created })
if ($testedRows.Count -ne 4 -or @($testedRows | Where-Object { $_.invitation_status -ne 'ACCEPTED' }).Count -ne 0) {
  throw 'Admin list did not expose ACCEPTED invitation status for all activated test admins'
}
Write-Output 'INVITATION_STATUS_LIST=PASS'
} finally {
  docker rm -f $containerName 2>$null | Out-Null
  docker exec backend-postgres-1 psql -U btmi_user -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$databaseName'" 2>$null | Out-Null
  docker exec backend-postgres-1 psql -U btmi_user -d postgres -c "DROP DATABASE IF EXISTS $databaseName" 2>$null | Out-Null
}
