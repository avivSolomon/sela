# Sela Production launcher - no Node.js, no installs, no downloads.
# Usage:  powershell -ExecutionPolicy Bypass -File .\start-sela-prod.ps1 [-NoBrowser]
# Serves the prebuilt app in .\app on http://localhost:3001 using the static
# server from the Sela source (scripts\serve-static.ps1, unchanged). Stop with Ctrl+C.
param([switch]$NoBrowser)

$server = Join-Path $PSScriptRoot 'scripts\serve-static.ps1'
$app    = Join-Path $PSScriptRoot 'app'
if (-not (Test-Path $server) -or -not (Test-Path (Join-Path $app 'index.html'))) {
  Write-Host "ERROR: files are missing. Extract the whole ZIP and run this script from the extracted folder." -ForegroundColor Red
  exit 1
}
& $server -Root $app -NoBrowser:$NoBrowser
exit $LASTEXITCODE
