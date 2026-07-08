param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$Cache = (Join-Path $Root 'vendor\npm-cache')
)

$ErrorActionPreference = 'Stop'

if (!(Test-Path -LiteralPath $Cache)) {
  throw "Offline npm cache not found: $Cache. Run scripts/offline/prepare-npm-cache.ps1 while internet is available."
}

$previousPuppeteerSkipDownload = $env:PUPPETEER_SKIP_DOWNLOAD
$env:PUPPETEER_SKIP_DOWNLOAD = 'true'

try {
  foreach ($app in @('apps/api', 'apps/dashboard', 'apps/android-local')) {
    $appPath = Join-Path $Root $app
    Write-Host "Installing $app from offline npm cache"
    npm ci --offline --cache $Cache --prefer-offline --no-audit --fund=false --prefix $appPath | Out-Host
  }
} finally {
  $env:PUPPETEER_SKIP_DOWNLOAD = $previousPuppeteerSkipDownload
}
