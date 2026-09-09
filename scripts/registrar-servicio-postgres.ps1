# registrar-servicio-postgres.ps1
# Vuelve a registrar PostgreSQL 16 como servicio de Windows (arranca solo al prender la PC).
# EJECUTAR COMO ADMINISTRADOR. Es de una sola vez.

$ErrorActionPreference = 'Stop'
$bin  = 'C:\Program Files\PostgreSQL\16\bin'
$data = 'C:\Program Files\PostgreSQL\16\data'
$svc  = 'postgresql-x64-16'

function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
}
if (-not (Test-Admin)) { Write-Error "Abre PowerShell COMO ADMINISTRADOR."; exit 1 }

# 1. Parar la instancia manual si esta corriendo (para liberar el puerto 5432).
Write-Host "1/3  Deteniendo instancia manual (si hay) ..." -ForegroundColor Cyan
& "$bin\pg_ctl.exe" stop -D "$data" -m fast 2>$null
Start-Sleep -Seconds 3

# 2. Registrar el servicio (cuenta NetworkService: Postgres no corre como admin).
Write-Host "2/3  Registrando servicio $svc ..." -ForegroundColor Cyan
if (Get-Service $svc -ErrorAction SilentlyContinue) {
  Write-Host "     Ya existe, se omite el registro."
} else {
  & "$bin\pg_ctl.exe" register -N $svc -U "NT AUTHORITY\NetworkService" -D "$data" -S auto
  Start-Sleep -Seconds 2
}

# 3. Arrancarlo.
Write-Host "3/3  Arrancando servicio ..." -ForegroundColor Cyan
Start-Service $svc
Get-Service $svc | Select-Object Name,Status,StartType | Format-Table -AutoSize

Write-Host ""
Write-Host "LISTO. Postgres arranca solo en cada reinicio." -ForegroundColor Green
