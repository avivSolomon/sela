# Sela - one-click start for Windows (PowerShell)
# Usage:  powershell -ExecutionPolicy Bypass -File .\start-sela.ps1 [-Rebuild] [-NoBrowser] [-Dev]
#   (default)   build once, then serve the built app: fast start and fast loading
#   -Rebuild    force a new build
#   -NoBrowser  do not open the browser automatically
#   -Dev        development server (live reload, slow first load, full install)
param(
  [switch]$Dev,
  [switch]$Rebuild,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# 1. Path must be plain ASCII - Hebrew/space characters break native builds
if ($PSScriptRoot -match '[^\x00-\x7F]') {
  Write-Host "The project folder path contains non-English characters:" -ForegroundColor Red
  Write-Host "  $PSScriptRoot"
  Write-Host "Move the folder to a path like C:\sela and run this script again."
  exit 1
}

# 2. Node version check (needs 22.18+, 24 LTS recommended)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is not installed. Run:  winget install OpenJS.NodeJS.LTS" -ForegroundColor Red
  exit 1
}
$nodeVersion = [version](node -v).TrimStart('v')
if ($nodeVersion -lt [version]'22.18.0') {
  Write-Host "Node $nodeVersion is too old. Install Node 24 LTS and open a new terminal." -ForegroundColor Red
  exit 1
}
if ($nodeVersion.Major -gt 24) {
  Write-Host "Warning: Node $nodeVersion is newer than the tested version (24). If install fails, use Node 24 LTS." -ForegroundColor Yellow
}

# 3. Git's sh.exe is needed by the project scripts
foreach ($dir in 'C:\Program Files\Git\usr\bin', 'C:\Program Files\Git\bin') {
  if (Test-Path $dir) { $env:Path = "$dir;$env:Path" }
}
if (-not (Get-Command sh -ErrorAction SilentlyContinue)) {
  Write-Host "Git for Windows is required (it provides 'sh'). Run:  winget install Git.Git" -ForegroundColor Red
  exit 1
}

$yarn = Join-Path $PSScriptRoot '.yarn\releases\yarn-4.17.1.cjs'

function Stop-WithInstallHelp {
  Write-Host "Install failed. Common cause on Windows: native modules could not build." -ForegroundColor Red
  Write-Host "Use Node 24 LTS, and if it still fails install the C++ build tools:"
  Write-Host "  winget install Microsoft.VisualStudio.2022.BuildTools --override ""--add Microsoft.VisualStudio.Workload.VCTools --passive"""
  exit 1
}

# 4. Install dependencies on first run.
#    Normal mode only needs what builds the browser app (no Electron, no mobile,
#    no native database modules). -Dev installs everything.
if (-not (Test-Path 'node_modules\.yarn-state.yml')) {
  if ($Dev) {
    Write-Host "First run: installing all dependencies (several minutes)..." -ForegroundColor Cyan
    node $yarn install
  } else {
    Write-Host "First run: installing the dependencies needed to build Sela (a few minutes)..." -ForegroundColor Cyan
    node $yarn workspaces focus '@actual-app/web'
  }
  if ($LASTEXITCODE -ne 0) { Stop-WithInstallHelp }
}

# 5a. Development server (slow first load, live reload) - only with -Dev
if ($Dev) {
  Write-Host "Starting Sela in development mode - open http://localhost:3001 when the server is ready" -ForegroundColor Green
  node $yarn start:browser
  exit $LASTEXITCODE
}

# 5b. Build once, then serve the built app (fast start, fast load)
$buildDir = Join-Path $PSScriptRoot 'packages\desktop-client\build'
$stamp    = Join-Path $buildDir '.sela-build-stamp'

# The stamp changes when the commit or the working tree changes, so a build is
# repeated only after "git pull" or local edits (or with -Rebuild).
$currentStamp = 'no-git'
if (Get-Command git -ErrorAction SilentlyContinue) {
  $head = (git rev-parse HEAD 2>$null)
  $dirty = (git status --porcelain 2>$null | Out-String)
  if ($head) {
    $bytes = [Text.Encoding]::UTF8.GetBytes("$head|$dirty")
    $currentStamp = [BitConverter]::ToString([Security.Cryptography.SHA1]::Create().ComputeHash($bytes)).Replace('-', '')
  }
}
$builtStamp = if (Test-Path $stamp) { (Get-Content $stamp -Raw).Trim() } else { '' }
$needsBuild = $Rebuild -or -not (Test-Path (Join-Path $buildDir 'index.html')) -or ($currentStamp -eq 'no-git' -and -not $builtStamp) -or ($currentStamp -ne 'no-git' -and $builtStamp -ne $currentStamp)

if ($needsBuild) {
  Write-Host "Building Sela (about 2-3 minutes, only when the code changed)..." -ForegroundColor Cyan
  node $yarn workspace plugins-service build
  if ($LASTEXITCODE -ne 0) { Write-Host "Build failed (plugins-service)." -ForegroundColor Red; exit 1 }
  node $yarn workspace '@actual-app/web' build:browser
  if ($LASTEXITCODE -ne 0) { Write-Host "Build failed (web app). Try again with -Dev to see the error." -ForegroundColor Red; exit 1 }
  Set-Content -Path $stamp -Value $currentStamp -Encoding ascii
}

Write-Host "Starting Sela..." -ForegroundColor Green
$serveArgs = @{ Root = $buildDir }
if ($NoBrowser) { $serveArgs.NoBrowser = $true }
& (Join-Path $PSScriptRoot 'scripts\serve-static.ps1') @serveArgs
