$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot

if (-not (Test-Path '.env')) {
  Copy-Item '.env.production.example' '.env'
  Write-Host 'Created .env from .env.production.example'
}
else {
  $envContent = Get-Content '.env' -Raw
  if ($envContent -match 'REPLACE_WITH_') {
    Copy-Item '.env.production.example' '.env' -Force
    Write-Host 'Replaced placeholder .env values from .env.production.example'
  }
}

if (-not (Test-Path 'apps/api/.env')) {
  Copy-Item 'apps/api/.env.example' 'apps/api/.env'
  Write-Host 'Created apps/api/.env from .env.example'
}

if (-not (Test-Path 'apps/dashboard/.env')) {
  Copy-Item 'apps/dashboard/.env.example' 'apps/dashboard/.env'
  Write-Host 'Created apps/dashboard/.env from .env.example'
}

docker compose up -d --build
docker compose ps
