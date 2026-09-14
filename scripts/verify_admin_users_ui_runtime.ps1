param(
  [string]$WebHost = 'http://localhost:5174',
  [string]$ApiBase = 'http://127.0.0.1:18080/api/v1'
)

$ErrorActionPreference = 'Stop'
$runId = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$databaseName = "admui_$runId"
$containerName = "admui-e2e-$runId"
$superAdminEmail = 'admin@tbk.market'
$superAdminPassword = "Ui!$([guid]::NewGuid().ToString('N'))"
$webProc = $null

try {
  docker exec backend-postgres-1 psql -U btmi_user -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $databaseName" | Out-Null | Out-Null

  docker run -d --name $containerName --network backend_default -p 127.0.0.1:18080:18080 `
    -e APP_ENV=development -e API_PORT=18080 -e DB_HOST=postgres -e DB_PORT=5432 `
    -e DB_NAME=$databaseName -e DB_USER=btmi_user -e DB_PASSWORD=btmi_secret_password `
    -e JWT_SECRET=admui-e2e-isolated-secret -e E2E_TEST_MODE=true -e SMTP_HOST= `
    -e FRONTEND_URL=http://localhost:5174 backend-api ./server | Out-Null

  $ready = $false
  foreach ($attempt in 1..180) {
    Start-Sleep -Milliseconds 500
    try {
      $r = [System.Net.WebRequest]::Create('http://127.0.0.1:18080/health').GetResponse()
      if ([int]$r.StatusCode -eq 200) { $ready = $true }
      $r.Close()
      if ($ready) { break }
    } catch { }
  }
  if (-not $ready) {
    $tailLogs = (docker logs $containerName 2>&1 | Select-Object -Last 30 | Out-String)
    throw "Isolated API did not become ready.`n$tailLogs"
  }

  docker exec -e SUPER_ADMIN_UPDATE=true -e SUPER_ADMIN_NAME='E2E SuperAdmin' -e SUPER_ADMIN_EMAIL=$superAdminEmail `
    -e SUPER_ADMIN_PASSWORD=$superAdminPassword $containerName ./create-superadmin | Out-Null

  Write-Output "AdminUI stack ready: $ApiBase (db=$databaseName, container=$containerName)"

  $env:E2E_API_BASE = $ApiBase
  $env:E2E_CONTAINER = $containerName
  $env:E2E_SUPER_EMAIL = $superAdminEmail
  $env:E2E_SUPER_PASSWORD = $superAdminPassword
  $env:ADM_UI_WEB_HOST = $WebHost

  # Seed a second admin that will be kept SUSPENDED so the page shows both statuses.
  $env:ADM_UI_SUSPENDED_EMAIL = "e2e.suspended.$runId@tbk.test"

  # Start the web dev server pointed at the isolated API (bypasses 8080 proxy).
  $env:VITE_API_BASE = $ApiBase
  $webProc = Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList @(
    'node_modules\vite\bin\vite.js', '--port', '5174', '--strictPort'
  ) -WorkingDirectory "$PSScriptRoot\..\web-app" -PassThru -WindowStyle Hidden

  $webReady = $false
  foreach ($attempt in 1..40) {
    Start-Sleep -Milliseconds 500
    try {
      $r = [System.Net.WebRequest]::Create("$WebHost/").GetResponse()
      if ([int]$r.StatusCode -eq 200) { $webReady = $true }
      $r.Close()
      if ($webReady) { break }
    } catch { }
  }
  if (-not $webReady) { throw "Web dev server did not become ready on $WebHost" }

  node "$PSScriptRoot\admin_users_ui.mjs"
  if ($LASTEXITCODE -ne 0) { throw "Admin Users UI verification failed with exit code $LASTEXITCODE" }

  Write-Output 'ADMIN_USERS_UI=PASS'
} finally {
  if ($webProc -and -not $webProc.HasExited) { Stop-Process -Id $webProc.Id -Force -ErrorAction SilentlyContinue }
  docker rm -f $containerName 2>$null | Out-Null
  docker exec backend-postgres-1 psql -U btmi_user -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$databaseName'" 2>$null | Out-Null
  docker exec backend-postgres-1 psql -U btmi_user -d postgres -c "DROP DATABASE IF EXISTS $databaseName" 2>$null | Out-Null
}