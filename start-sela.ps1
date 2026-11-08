# Sela - one-click start for Windows (PowerShell)
# Usage:  powershell -ExecutionPolicy Bypass -File .\start-sela.ps1

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

# 4. Install dependencies on first run
if (-not (Test-Path 'node_modules\.yarn-state.yml')) {
  Write-Host "First run: installing dependencies (several minutes)..." -ForegroundColor Cyan
  node $yarn install
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Install failed. Common cause on Windows: native modules (bcrypt, argon2, better-sqlite3, sharp)" -ForegroundColor Red
    Write-Host "could not build. Use Node 24 LTS, and if it still fails install the C++ build tools:"
    Write-Host "  winget install Microsoft.VisualStudio.2022.BuildTools --override ""--add Microsoft.VisualStudio.Workload.VCTools --passive"""
    exit 1
  }
}

# 5. Start
Write-Host "Starting Sela - open http://localhost:3001 when the server is ready" -ForegroundColor Green
node $yarn start:browser
