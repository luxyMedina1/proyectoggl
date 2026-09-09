# reset-postgres.ps1
# Resetea la contraseña del usuario `postgres` y crea la BD para el backend v2.
# EJECUTAR COMO ADMINISTRADOR (PowerShell con "Ejecutar como administrador").
#
# Qué hace:
#  1. Respalda pg_hba.conf y pone auth = trust (sin contraseña) temporalmente.
#  2. Reinicia el servicio de PostgreSQL 16.
#  3. Pone la contraseña de `postgres` a 'postgres' y crea la BD 'taquillavip'
#     con el schema 'taquillavip'.
#  4. Restaura pg_hba.conf (vuelve a pedir contraseña) y reinicia.

$ErrorActionPreference = 'Stop'

$data    = 'C:\Program Files\PostgreSQL\16\data'
$bin     = 'C:\Program Files\PostgreSQL\16\bin'
$hba     = Join-Path $data 'pg_hba.conf'
$svc     = 'postgresql-x64-16'
$newpass = 'postgres'          # <-- cámbiala aquí si quieres otra
$dbname  = 'taquillavip'
$schema  = 'taquillavip'

function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
}
if (-not (Test-Admin)) {
  Write-Error "Este script necesita PowerShell ABIERTO COMO ADMINISTRADOR."
  exit 1
}

Write-Host "1/4  Respaldo de pg_hba.conf y auth = trust ..." -ForegroundColor Cyan
$bak = "$hba.bak.$([DateTimeOffset]::Now.ToUnixTimeSeconds())"
Copy-Item $hba $bak -Force
Write-Host "     backup: $bak"

$orig = Get-Content $hba
$orig | ForEach-Object {
  if ($_ -notmatch '^\s*#' -and $_ -match '^\s*(local|host)\s+all\s+all\s') {
    $_ -replace '(scram-sha-256|md5|password)\s*$', 'trust'
  } else { $_ }
} | Set-Content $hba -Encoding ascii

Write-Host "2/4  Reiniciando $svc ..." -ForegroundColor Cyan
Restart-Service $svc -Force
Start-Sleep -Seconds 4

try {
  Write-Host "3/4  Reset de contraseña + creación de BD ..." -ForegroundColor Cyan
  $env:PGPASSWORD = ''
  & "$bin\psql.exe" -U postgres -h 127.0.0.1 -v ON_ERROR_STOP=1 -c "ALTER USER postgres PASSWORD '$newpass';"

  $exists = (& "$bin\psql.exe" -U postgres -h 127.0.0.1 -tAc "SELECT 1 FROM pg_database WHERE datname='$dbname'").Trim()
  if ($exists -eq '1') {
    Write-Host "     La BD '$dbname' ya existe, se deja como está."
  } else {
    & "$bin\psql.exe" -U postgres -h 127.0.0.1 -v ON_ERROR_STOP=1 -c "CREATE DATABASE $dbname;"
    Write-Host "     BD '$dbname' creada."
  }
  & "$bin\psql.exe" -U postgres -h 127.0.0.1 -d $dbname -v ON_ERROR_STOP=1 -c "CREATE SCHEMA IF NOT EXISTS $schema AUTHORIZATION postgres;"
  Write-Host "     Schema '$schema' listo."
}
finally {
  Write-Host "4/4  Restaurando pg_hba.conf y reiniciando ..." -ForegroundColor Cyan
  Copy-Item $bak $hba -Force
  Restart-Service $svc -Force
  Start-Sleep -Seconds 3
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "LISTO" -ForegroundColor Green
Write-Host "  Usuario:  postgres"
Write-Host "  Password: $newpass"
Write-Host "  BD:       $dbname"
Write-Host "  Schema:   $schema"
Write-Host "  Host:     localhost   Puerto: 5432"
