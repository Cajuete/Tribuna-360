param(
    [ValidateSet("all", "backend", "frontend")]
    [string]$Target = "all",

    [switch]$NoCache
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "Proyecto: $root" -ForegroundColor Cyan

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Docker no esta en el PATH. Abre Docker Desktop y vuelve a intentar." -ForegroundColor Red
    exit 1
}

$buildArgs = @("compose", "build")
if ($NoCache) { $buildArgs += "--no-cache" }

switch ($Target) {
    "backend"  { $buildArgs += "backend" }
    "frontend" { $buildArgs += "frontend" }
    default    { }
}

Write-Host "Construyendo: $Target $(if ($NoCache) { '(sin cache)' })" -ForegroundColor Yellow
& docker @buildArgs
if ($LASTEXITCODE -ne 0) { throw "Fallo en docker compose build" }

$upArgs = @("compose", "up", "-d")
if ($Target -ne "all") { $upArgs += $Target }

Write-Host "Levantando contenedores..." -ForegroundColor Yellow
& docker @upArgs
if ($LASTEXITCODE -ne 0) { throw "Fallo en docker compose up" }

Write-Host ""
Write-Host "Listo. Servicios:" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:3000"
Write-Host "  Frontend: http://localhost:5173"
Write-Host ""
Write-Host "Logs:"
Write-Host "  docker compose logs -f backend"
Write-Host "  docker compose logs -f frontend"