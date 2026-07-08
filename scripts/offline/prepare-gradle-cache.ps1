param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$GradleUserHome = (Join-Path $Root 'vendor\gradle-user-home'),
  [string]$MavenRepo = (Join-Path $Root 'vendor\maven')
)

$ErrorActionPreference = 'Stop'

$androidRoot = Join-Path $Root 'apps\android-local\android'
if (!(Test-Path -LiteralPath (Join-Path $androidRoot 'gradlew.bat'))) {
  throw "Gradle wrapper not found: $androidRoot"
}

New-Item -ItemType Directory -Force -Path $GradleUserHome | Out-Null

$sourceGradleHome = Join-Path $env:USERPROFILE '.gradle'
$sourceWrapper = Join-Path $sourceGradleHome 'wrapper\dists\gradle-8.11.1-all'
$targetWrapper = Join-Path $GradleUserHome 'wrapper\dists\gradle-8.11.1-all'
if ((Test-Path -LiteralPath $sourceWrapper) -and !(Test-Path -LiteralPath $targetWrapper)) {
  $sourceZip = Get-ChildItem -Path $sourceWrapper -Recurse -Filter 'gradle-8.11.1-all.zip' | Select-Object -First 1
  if ($sourceZip) {
    $hashDir = Split-Path -Leaf (Split-Path -Parent $sourceZip.FullName)
    $targetHashDir = Join-Path $targetWrapper $hashDir
    New-Item -ItemType Directory -Force -Path $targetHashDir | Out-Null
    Copy-Item -Force -LiteralPath $sourceZip.FullName -Destination (Join-Path $targetHashDir $sourceZip.Name)
  }
}

$sourceFiles = Join-Path $sourceGradleHome 'caches\modules-2\files-2.1'
if (Test-Path -LiteralPath $sourceFiles) {
  New-Item -ItemType Directory -Force -Path $MavenRepo | Out-Null
  Write-Host "Creating local Maven repository: $MavenRepo"
  foreach ($groupDir in Get-ChildItem -LiteralPath $sourceFiles -Directory) {
    $groupPath = $groupDir.Name -replace '\.', '\'
    foreach ($moduleDir in Get-ChildItem -LiteralPath $groupDir.FullName -Directory) {
      foreach ($versionDir in Get-ChildItem -LiteralPath $moduleDir.FullName -Directory) {
        $targetDir = Join-Path $MavenRepo (Join-Path $groupPath (Join-Path $moduleDir.Name $versionDir.Name))
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
        Get-ChildItem -LiteralPath $versionDir.FullName -Recurse -File |
          Where-Object { $_.Name -notmatch '\.(sha1|md5|lock)$' } |
          ForEach-Object {
            Copy-Item -Force -LiteralPath $_.FullName -Destination (Join-Path $targetDir $_.Name)
          }
      }
    }
  }
}

Push-Location $androidRoot
try {
  .\gradlew.bat --offline -g $GradleUserHome assembleDebug --init-script gradle-mirror.init.gradle | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Gradle offline build failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

Write-Host "Offline Gradle cache is ready: $GradleUserHome"
