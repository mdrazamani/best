param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$Output = (Join-Path $Root 'vendor\docker-images\best-runtime-images.tar')
)

$ErrorActionPreference = 'Stop'

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Output) | Out-Null

Push-Location $Root
try {
  docker compose build | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Docker compose build failed with exit code $LASTEXITCODE"
  }
  docker pull postgres:16-alpine | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Docker pull postgres failed with exit code $LASTEXITCODE"
  }
  docker pull nginx:1.27-alpine | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Docker pull nginx failed with exit code $LASTEXITCODE"
  }
  docker save -o $Output postgres:16-alpine nginx:1.27-alpine best-api:offline best-dashboard:offline | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Docker save failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

Write-Host "Offline Docker image bundle is ready: $Output"
