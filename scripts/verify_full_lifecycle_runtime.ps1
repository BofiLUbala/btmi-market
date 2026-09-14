param([string]$BaseUrl = 'http://127.0.0.1:18080/api/v1')

$ErrorActionPreference = 'Stop'
$runId = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$databaseName = "e2e_full_$runId"
$containerName = "btmi-e2e-$runId"
$superAdminPassword = "Sa!$([guid]::NewGuid().ToString('N'))"

try {
  # Fresh isolated database for this E2E run (never touches the app DB).
  docker exec backend-postgres-1 psql -U btmi_user -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $databaseName" | Out-Null

  docker run -d --name $containerName --network backend_default -p 127.0.0.1:18080:18080 `
    -e APP_ENV=development -e API_PORT=18080 -e DB_HOST=postgres -e DB_PORT=5432 `
    -e DB_NAME=$databaseName -e DB_USER=btmi_user -e DB_PASSWORD=btmi_secret_password `
    -e JWT_SECRET=e2e-full-lifecycle-isolated-secret -e E2E_TEST_MODE=true -e SMTP_HOST= `
    -e FRONTEND_URL=http://localhost:5173 backend-api ./server | Out-Null

  $ready = $false
  foreach ($attempt in 1..180) {
    Start-Sleep -Milliseconds 500
    try {
      $r = [System.Net.WebRequest]::Create('http://localhost:18080/health').GetResponse()
      if ([int]$r.StatusCode -eq 200) { $ready = $true }
      $r.Close()
      if ($ready) { break }
    } catch { }
  }
  if (-not $ready) {
    $tailLogs = (docker logs $containerName 2>&1 | Select-Object -Last 30 | Out-String)
    throw "Isolated API did not become ready.`n$tailLogs"
  }

  # Bootstrap SUPER_ADMIN in the isolated DB (fresh DB makes this safe).
  # Migration 044 seeds a default admin@tbk.market; use --update to set the E2E password.
  docker exec -e SUPER_ADMIN_UPDATE=true -e SUPER_ADMIN_NAME='E2E SuperAdmin' -e SUPER_ADMIN_EMAIL='admin@tbk.market' `
    -e SUPER_ADMIN_PASSWORD=$superAdminPassword $containerName ./create-superadmin | Out-Null

  Write-Output "Isolated stack ready: $BaseUrl (db=$databaseName, container=$containerName)"

  # Temporary files for the node driver
  $env:E2E_API_BASE = $BaseUrl
  $env:E2E_CONTAINER = $containerName
  $env:E2E_SUPER_EMAIL = 'admin@tbk.market'
  $env:E2E_SUPER_PASSWORD = $superAdminPassword
  $env:E2E_PG_DSN = "postgresql://btmi_user:btmi_secret_password@127.0.0.1:5433/$databaseName"

  node "$PSScriptRoot\e2e_full_lifecycle.mjs"
  if ($LASTEXITCODE -ne 0) { throw "E2E lifecycle failed with exit code $LASTEXITCODE" }

  Write-Output 'FULL_LIFECYCLE_E2E=PASS'
} finally {
  docker rm -f $containerName 2>$null | Out-Null
  docker exec backend-postgres-1 psql -U btmi_user -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$databaseName'" 2>$null | Out-Null
  docker exec backend-postgres-1 psql -U btmi_user -d postgres -c "DROP DATABASE IF EXISTS $databaseName" 2>$null | Out-Null
}