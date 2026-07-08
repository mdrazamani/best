param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$InputArchive = (Join-Path $Root 'vendor\docker-images\best-runtime-images.tar')
)

$ErrorActionPreference = 'Stop'

if (!(Test-Path -LiteralPath $InputArchive)) {
  throw "Offline Docker image bundle not found: $InputArchive. Run scripts/offline/prepare-docker-images.ps1 while internet is available."
}

docker load -i $InputArchive | Out-Host
