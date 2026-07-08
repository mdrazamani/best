param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$Cache = (Join-Path $Root 'vendor\npm-cache')
)

$ErrorActionPreference = 'Stop'

$lockFiles = @(
  'apps/api/package-lock.json',
  'apps/dashboard/package-lock.json',
  'apps/android-local/package-lock.json'
) | ForEach-Object { Join-Path $Root $_ }

New-Item -ItemType Directory -Force -Path $Cache | Out-Null

$resolvedUrls = & node -e @'
const fs = require('fs');
const lockFiles = process.argv.slice(1);
const urls = new Set();
for (const lockFile of lockFiles) {
  if (!fs.existsSync(lockFile)) throw new Error(`Missing lockfile: ${lockFile}`);
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  for (const entry of Object.values(lock.packages || {})) {
    const resolved = entry && entry.resolved;
    if (typeof resolved === 'string' && /^https:\/\/registry\.npmjs\.org\//.test(resolved)) {
      urls.add(resolved);
    }
  }
}
for (const url of Array.from(urls).sort()) console.log(url);
'@ @lockFiles

if ($LASTEXITCODE -ne 0) {
  throw 'Failed to read package-lock files with Node.'
}

Write-Host "Caching $($resolvedUrls.Count) npm tarballs into $Cache"

$batchSize = 80
for ($offset = 0; $offset -lt $resolvedUrls.Count; $offset += $batchSize) {
  $end = [Math]::Min($offset + $batchSize - 1, $resolvedUrls.Count - 1)
  $batch = $resolvedUrls[$offset..$end]
  Write-Progress -Activity 'Preparing offline npm cache' -Status "$($end + 1) / $($resolvedUrls.Count)" -PercentComplete ((($end + 1) / $resolvedUrls.Count) * 100)
  npm cache add @batch --cache $Cache --prefer-online | Out-Host
}

npm cache verify --cache $Cache | Out-Host
Write-Host "Offline npm cache is ready: $Cache"
