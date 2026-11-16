# Sela release: clean install, full build, checks and the two ZIP packages,
# all from one committed version.
#
#   powershell -ExecutionPolicy Bypass -File scripts\sela-release.ps1 -OutDir <new folder> [-SkipChecks] [-Node <folder>]
#
#   -OutDir      a new or empty folder for the packages. Existing packages are
#                never overwritten: the script stops if the folder has files.
#   -SkipChecks  skip the Integrate track (typecheck, lint, unit and mortgage
#                end-to-end tests) when it already passed for this commit.
#   -Node        folder with the Node.js version from .nvmrc (node.exe), if the
#                installed Node is a different version.
#
# Steps:
#   1. The working tree must be clean: the packages hold exactly one commit.
#   2. Integrate checks on the repository (unless -SkipChecks).
#   3. Sela-Source.zip = "git archive" of the commit (only tracked files).
#   4. Extract it to a new temporary folder, install only what the web build
#      needs (immutable lockfile), and build there - nothing from this
#      computer's working folder gets into the build.
#   5. Sela-Production.zip = the built app without source maps, the static
#      server and the launchers from packaging\production.
#   6. Smoke test: serve the extracted production package and load the page.
#   7. VERSION.txt and SHA256 of both packages in RELEASE-SUMMARY.txt.
param(
  [Parameter(Mandatory = $true)][string]$OutDir,
  [switch]$SkipChecks,
  [string]$Node
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
foreach ($dir in 'C:\Program Files\Git\usr\bin', 'C:\Program Files\Git\bin') {
  if (Test-Path $dir) { $env:Path = "$dir;$env:Path" }
}
if ($Node) { $env:Path = "$Node;$env:Path" }

function Step([string]$Text) { Write-Host ""; Write-Host "== $Text" -ForegroundColor Cyan }
function Fail([string]$Text) { Write-Host $Text -ForegroundColor Red; exit 1 }

# 1. Clean tree, one commit
Step 'version'
if (git status --porcelain) { Fail 'The working tree has uncommitted changes. Commit or stash them first.' }
$commit = (git rev-parse HEAD).Trim()
$short = $commit.Substring(0, 7)
$wantedNode = (Get-Content (Join-Path $root '.nvmrc') -Raw).Trim().TrimStart('v')
$actualNode = (node -v).Trim().TrimStart('v')
Write-Host "commit $commit, Node $actualNode (.nvmrc: $wantedNode)"
if ($actualNode -ne $wantedNode) { Fail "Node $actualNode is not the version in .nvmrc ($wantedNode). Pass -Node <folder with node.exe $wantedNode>." }

$OutDir = [IO.Path]::GetFullPath($OutDir)
if ((Test-Path $OutDir) -and (Get-ChildItem $OutDir -Force | Select-Object -First 1)) {
  Fail "$OutDir is not empty. Use a new folder: existing packages are never overwritten."
}
New-Item -ItemType Directory -Force $OutDir | Out-Null
$work = Join-Path ([IO.Path]::GetTempPath()) "sela-release-$short-$(Get-Date -Format yyyyMMddHHmmss)"
New-Item -ItemType Directory $work | Out-Null
$log = Join-Path $OutDir 'release.log'
Write-Host "work folder $work, log $log"

# 2. Checks
if ($SkipChecks) {
  Write-Host 'Integrate checks skipped (-SkipChecks).' -ForegroundColor Yellow
} else {
  Step 'Integrate checks (20-30 minutes)'
  powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'sela-check.ps1') Integrate *>> $log
  $checksExit = $LASTEXITCODE
  if ($checksExit -eq 1 -or ($checksExit -ne 0 -and $checksExit -ne 2)) { Fail "Integrate checks failed - see $log" }
  if ($checksExit -eq 2) {
    Write-Host 'Integrate: no new failures, but known failures (FAILED-KNOWN) - recorded in the summary.' -ForegroundColor Yellow
  }
}

# 3. Source package
Step 'Sela-Source.zip'
$sourceZip = Join-Path $OutDir 'Sela-Source.zip'
git archive --format=zip --prefix=sela/ -o $sourceZip $commit
if ($LASTEXITCODE -ne 0) { Fail 'git archive failed.' }

# 4. Clean install and build from the source package
Step 'clean install and build (several minutes)'
Expand-Archive $sourceZip $work
$src = Join-Path $work 'sela'
Push-Location $src
try {
  $yarn = Join-Path $src '.yarn\releases\yarn-4.17.1.cjs'
  # Packages come from this computer's yarn cache when present (no download).
  $env:YARN_CACHE_FOLDER = Join-Path $root '.yarn\cache'
  $env:YARN_ENABLE_IMMUTABLE_INSTALLS = '1'
  $env:VITE_CONFIG_NATIVE_IGNORE_WARNING = 'true'
  $env:SELA_LOCAL_BUILD = '1'
  $t0 = Get-Date
  node $yarn workspaces focus '@actual-app/web' *>> $log
  if ($LASTEXITCODE -ne 0) { Fail "Install failed - see $log" }
  $installSecs = [int]((Get-Date) - $t0).TotalSeconds
  $t0 = Get-Date
  node $yarn workspace plugins-service build *>> $log
  if ($LASTEXITCODE -ne 0) { Fail "Build failed (plugins-service) - see $log" }
  node $yarn workspace '@actual-app/web' build:browser *>> $log
  if ($LASTEXITCODE -ne 0) { Fail "Build failed (web app) - see $log" }
  $buildSecs = [int]((Get-Date) - $t0).TotalSeconds
  Write-Host "install $installSecs s, build $buildSecs s"
} finally {
  Pop-Location
}

# 5. Production package
Step 'Sela-Production.zip'
$date = Get-Date -Format 'dd.MM.yyyy'
$prod = Join-Path $work 'sela-prod'
New-Item -ItemType Directory (Join-Path $prod 'scripts') -Force | Out-Null
Copy-Item (Join-Path $src 'packages\desktop-client\build') (Join-Path $prod 'app') -Recurse
Get-ChildItem (Join-Path $prod 'app') -Recurse -File -Filter '*.map' | Remove-Item
Remove-Item (Join-Path $prod 'app\.sela-build-stamp') -ErrorAction SilentlyContinue
Copy-Item (Join-Path $src 'scripts\serve-static.ps1') (Join-Path $prod 'scripts')
Copy-Item (Join-Path $src 'packaging\production\start-sela-prod.ps1'), (Join-Path $src 'packaging\production\start-sela-prod.cmd') $prod
Copy-Item (Join-Path $src 'LICENSE.txt') $prod
$readme = [IO.File]::ReadAllText((Join-Path $src 'packaging\production\README-HE.md'))
$readme = $readme.Replace('{{COMMIT}}', $short).Replace('{{DATE}}', $date).Replace('{{NODE}}', $actualNode)
[IO.File]::WriteAllText((Join-Path $prod 'README-HE.md'), $readme, (New-Object Text.UTF8Encoding $false))
@"
Sela Production package
Source commit     : $commit
Built from        : Sela-Source.zip (git archive of the same commit), extracted to a new folder
Node.js           : v$actualNode
Yarn              : 4.17.1 (from the repository), install: workspaces focus @actual-app/web, immutable lockfile
Build commands    : yarn workspace plugins-service build ; yarn workspace @actual-app/web build:browser (SELA_LOCAL_BUILD=1)
Excluded          : source maps (*.map), build stamp, node_modules, development dependencies
Build date        : $date
"@ | Set-Content (Join-Path $prod 'VERSION.txt') -Encoding utf8
$prodZip = Join-Path $OutDir 'Sela-Production.zip'
Compress-Archive -Path (Join-Path $prod '*') -DestinationPath $prodZip

# 6. Smoke test of the extracted production package
Step 'smoke test'
if (Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue) {
  Write-Host 'Port 3001 is in use - smoke test skipped. Stop the running Sela and test the package by hand.' -ForegroundColor Yellow
  $smoke = 'skipped (port 3001 in use)'
} else {
  $check = Join-Path $work 'smoke'
  Expand-Archive $prodZip $check
  $server = Start-Process powershell -PassThru -WindowStyle Hidden -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $check 'start-sela-prod.ps1'), '-NoBrowser')
  $smoke = 'FAILED'
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 2
    try {
      $page = Invoke-WebRequest 'http://localhost:3001/' -UseBasicParsing -TimeoutSec 5
      if ($page.StatusCode -eq 200 -and $page.Content -match '<div id="root"') { $smoke = 'passed (page served from the extracted package)'; break }
    } catch {}
  }
  Get-CimInstance Win32_Process -Filter "ParentProcessId=$($server.Id)" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  if ($smoke -eq 'FAILED') { Fail 'Smoke test failed: the extracted package did not serve the page.' }
}

# 7. Summary
Step 'summary'
$lines = @(
  "Sela release - commit $commit - $date",
  "Node v$actualNode; checks: $(if ($SkipChecks) { 'skipped (-SkipChecks)' } elseif ($checksExit -eq 2) { 'Integrate: no new failures; known failures only (FAILED-KNOWN, see release.log)' } else { 'Integrate passed' }); smoke test: $smoke",
  ''
)
foreach ($zip in $sourceZip, $prodZip) {
  $item = Get-Item $zip
  $lines += '{0}  {1:N0} bytes  SHA256 {2}' -f $item.Name, $item.Length, (Get-FileHash $zip -Algorithm SHA256).Hash
}
$lines | Set-Content (Join-Path $OutDir 'RELEASE-SUMMARY.txt') -Encoding utf8
$lines | ForEach-Object { Write-Host $_ }
Write-Host "Temporary build folder (can be deleted): $work"
