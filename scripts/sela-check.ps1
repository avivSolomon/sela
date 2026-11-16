# Sela checks by work track. Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File scripts\sela-check.ps1 <Track> [-Fix] [-Base <ref>]
#
#   Fast       while developing (with "start-sela.ps1 -Dev" for live reload):
#              only the unit tests related to the changed files. Seconds.
#   Validate   before a commit: format and lint check of the changed files,
#              typecheck when TypeScript changed, related unit tests, and the
#              translation check when texts changed. About 1-3 minutes.
#   Integrate  before a merge: typecheck, full lint check, all unit tests of
#              the web app, core and components, a build (only if the code
#              changed) and the mortgage end-to-end tests. About 20-30 minutes.
#   (Release has its own script: scripts\sela-release.ps1.)
#
#   -Fix       Validate only: fix format and lint problems, in the changed
#              files only (never in the whole repository).
#   -Base      compare with this commit instead of the last commit (HEAD),
#              e.g. -Base main to check everything on the branch.
#
# Changed files = files that differ from HEAD (or -Base) plus new files that
# git does not ignore. Steps run one after another, never in parallel, to keep
# the computer responsive. The script never changes files unless -Fix is given.
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('Fast', 'Validate', 'Integrate')]
  [string]$Track,
  [switch]$Fix,
  [string]$Base = 'HEAD'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
foreach ($dir in 'C:\Program Files\Git\usr\bin', 'C:\Program Files\Git\bin') {
  if (Test-Path $dir) { $env:Path = "$dir;$env:Path" }
}
$env:VITE_CONFIG_NATIVE_IGNORE_WARNING = 'true'
$yarn = Join-Path $root '.yarn\releases\yarn-4.17.1.cjs'

$results = [System.Collections.Generic.List[object]]::new()
$started = Get-Date

function Invoke-Step([string]$Name, [scriptblock]$Body) {
  Write-Host ""
  Write-Host "== $Name" -ForegroundColor Cyan
  $t0 = Get-Date
  $script:stepNote = ''
  & $Body
  $ok = ($LASTEXITCODE -eq 0 -or $null -eq $LASTEXITCODE)
  $secs = [int]((Get-Date) - $t0).TotalSeconds
  $result = $(if ($ok) { 'passed' } else { 'FAILED' })
  if ($script:stepNote) { $result += " ($script:stepNote)" }
  $results.Add([pscustomobject]@{ Step = $Name; Result = $result; Seconds = $secs })
  $global:LASTEXITCODE = 0
}

# Two core tests fail on Windows only: the test cannot delete a budget file
# that SQLite still holds open (EBUSY). They pass on Linux. A run whose only
# failures are these (with EBUSY in the output) counts as passed, with a note;
# any other failure fails the step.
$knownWindowsFailures = @(
  'src/server/main.test.ts > Budgets > budget is successfully loaded',
  'src/server/main.test.ts > Budgets > budget detects out of sync migrations'
)
function Invoke-Vitest([string]$Workspace, [string]$EnvName, [string[]]$VitestArgs) {
  $old = $env:ENV
  if ($EnvName) { $env:ENV = $EnvName }
  # Vitest writes part of its report to stderr; capture both (Continue: in
  # Windows PowerShell, stderr lines would otherwise stop the script).
  $ErrorActionPreference = 'Continue'
  try {
    node $yarn workspace $Workspace exec vitest @VitestArgs 2>&1 | ForEach-Object { "$_" } | Tee-Object -Variable lines | Write-Host
    $code = $LASTEXITCODE
  } finally { $env:ENV = $old }
  if ($code -ne 0) {
    $failed = @($lines | ForEach-Object { if ($_ -match '^\s*FAIL\s+(.+?)\s*$') { $Matches[1] } } | Sort-Object -Unique)
    $unknown = @($failed | Where-Object { $knownWindowsFailures -notcontains $_ })
    if ($failed.Count -gt 0 -and $unknown.Count -eq 0 -and ($lines -match 'EBUSY')) {
      $script:stepNote = "$($failed.Count) known Windows failure(s): EBUSY in main.test.ts"
      $code = 0
    } elseif ($unknown.Count -gt 0) {
      Write-Host "New failures (not the known Windows ones):" -ForegroundColor Red
      $unknown | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    }
  }
  $global:LASTEXITCODE = $code
}

# Core tests on Windows rewrite some snapshot files with CRLF line endings and
# leave a test budget folder behind. After a test step, restore only what the
# tests changed: snapshot files that were clean before and whose only change
# is line endings (checked with git diff), and the test budget folder if it
# did not exist before.
$testBudget = 'packages/loot-core/src/mocks/files/budgets/test-budget'
function Get-DirtyFiles { @(git -c core.quotepath=off status --porcelain --untracked-files=all | ForEach-Object { $_.Substring(3) }) }
function Restore-TestLeftovers([string[]]$DirtyBefore, [bool]$BudgetExisted) {
  $restored = 0
  # From "git status" and not "git diff --name-only": a change in line endings
  # only is not a content diff, so "git diff" would not list it. Each file is
  # restored by its own name, never by a list that might be empty.
  $snaps = @(git -c core.quotepath=off status --porcelain | Where-Object { $_ -match '^ M (.+\.snap)$' } | ForEach-Object { $_.Substring(3) })
  foreach ($f in $snaps) {
    if (-not $f -or $DirtyBefore -contains $f) { continue }
    git diff --ignore-cr-at-eol --quiet -- $f
    if ($LASTEXITCODE -eq 0) { git checkout -- $f 2>$null; $restored++ }
    else { Write-Host "Snapshot changed by the tests (real change, kept): $f" -ForegroundColor Yellow }
  }
  if (-not $BudgetExisted -and (Test-Path $testBudget)) { Remove-Item $testBudget -Recurse -Force }
  if ($restored) { Write-Host "Restored $restored snapshot file(s) whose only change was line endings." -ForegroundColor DarkGray }
  $global:LASTEXITCODE = 0
}

function Skip-Step([string]$Name, [string]$Why) {
  $results.Add([pscustomobject]@{ Step = $Name; Result = "skipped ($Why)"; Seconds = 0 })
}

function Get-ChangedFiles {
  $tracked = @(git -c core.quotepath=off diff --name-only --diff-filter=d $Base --)
  $new = @(git -c core.quotepath=off ls-files --others --exclude-standard)
  @($tracked + $new | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Sort-Object -Unique)
}

# Runs "vitest related" for the changed files of one workspace.
function Invoke-RelatedTests([string]$Workspace, [string]$Dir, [string[]]$Files, [string]$Config, [string]$EnvName) {
  $mine = @($Files | Where-Object { $_.StartsWith("$Dir/src/") -and $_ -match '\.(ts|tsx|js|jsx|mjs)$' })
  if ($mine.Count -eq 0) { Skip-Step "unit tests $Workspace $EnvName" 'no changed code'; return }
  $abs = @($mine | ForEach-Object { Join-Path $root $_ })
  $vitestArgs = @('related', '--run', '--passWithNoTests')
  if ($Config) { $vitestArgs += @('-c', $Config) }
  $dirty = Get-DirtyFiles
  $budgetExisted = Test-Path $testBudget
  Invoke-Step "unit tests related to $($mine.Count) changed file(s): $Workspace $EnvName" {
    Invoke-Vitest $Workspace $EnvName ($vitestArgs + $abs)
  }
  Restore-TestLeftovers $dirty $budgetExisted
}

function Invoke-TranslationCheck {
  Invoke-Step 'translations: regenerate en.json and compare with he.json' {
    node $yarn workspace '@actual-app/web' exec i18next --silent
    if ($LASTEXITCODE -ne 0) { return }
    node -e @'
const en = require('./packages/desktop-client/locale/en.json');
const he = require('./packages/desktop-client/locale/he.json');
const missing = Object.keys(en).filter(k => !(k in he) || he[k] === '');
const unused = Object.keys(he).filter(k => !(k in en));
console.log(`en.json: ${Object.keys(en).length} keys, he.json: ${Object.keys(he).length} keys`);
console.log(`not translated to Hebrew: ${missing.length}` + (missing.length ? '\n  ' + missing.slice(0, 20).join('\n  ') : ''));
console.log(`in he.json but no longer used: ${unused.length}`);
process.exit(missing.length ? 1 : 0);
'@
  }
}

$changed = @()
if ($Track -ne 'Integrate') {
  $changed = Get-ChangedFiles
  Write-Host "Track $Track - $($changed.Count) changed file(s) compared with $Base" -ForegroundColor Green
  if ($changed.Count -eq 0) {
    Write-Host 'Nothing changed - nothing to check.'
    exit 0
  }
  $changed | Select-Object -First 30 | ForEach-Object { Write-Host "  $_" }
  if ($changed.Count -gt 30) { Write-Host "  ... and $($changed.Count - 30) more" }
}

$code = @($changed | Where-Object { $_ -match '\.(ts|tsx|js|jsx|mjs|cjs)$' -and $_ -notmatch '^packages/component-library/src/icons/' })
$formattable = @($changed | Where-Object { $_ -match '\.(ts|tsx|js|jsx|mjs|cjs|json|md|css|ya?ml)$' -and $_ -notmatch '^packages/component-library/src/icons/' })
$textsChanged = @($changed | Where-Object { $_ -match '^packages/desktop-client/(src/.*\.(ts|tsx)|locale/he\.json)$' }).Count -gt 0
$typesChanged = @($changed | Where-Object { $_ -match '^packages/(desktop-client|loot-core|component-library|crdt)/.*\.(ts|tsx)$' }).Count -gt 0

switch ($Track) {
  'Fast' {
    Invoke-RelatedTests '@actual-app/web' 'packages/desktop-client' $changed '' ''
    Invoke-RelatedTests '@actual-app/core' 'packages/loot-core' $changed '' 'node'
    Invoke-RelatedTests '@actual-app/components' 'packages/component-library' $changed 'vitest.web.config.ts' 'web'
  }

  'Validate' {
    if ($formattable.Count -gt 0) {
      if ($Fix) {
        Invoke-Step "format $($formattable.Count) changed file(s)" { node $yarn oxfmt @formattable }
      } else {
        Invoke-Step "format check of $($formattable.Count) changed file(s)" { node (Join-Path $PSScriptRoot 'format-check-lf.mjs') @formattable }
      }
    } else { Skip-Step 'format check' 'no formattable files' }

    if ($code.Count -gt 0) {
      if ($Fix) {
        Invoke-Step "lint fix of $($code.Count) changed file(s)" { node $yarn oxlint --fix --type-aware --quiet @code }
      } else {
        Invoke-Step "lint of $($code.Count) changed file(s)" { node $yarn oxlint --type-aware --quiet @code }
      }
    } else { Skip-Step 'lint' 'no changed code' }

    if ($typesChanged) {
      Invoke-Step 'typecheck (web app, with core and components)' { node $yarn workspace '@actual-app/web' run typecheck }
    } else { Skip-Step 'typecheck' 'no TypeScript changed' }

    Invoke-RelatedTests '@actual-app/web' 'packages/desktop-client' $changed '' ''
    Invoke-RelatedTests '@actual-app/core' 'packages/loot-core' $changed '' 'node'
    Invoke-RelatedTests '@actual-app/components' 'packages/component-library' $changed 'vitest.web.config.ts' 'web'

    if ($textsChanged) { Invoke-TranslationCheck } else { Skip-Step 'translations' 'no texts changed' }
  }

  'Integrate' {
    Write-Host 'Track Integrate - full checks (about 20-30 minutes; steps run one at a time)' -ForegroundColor Green
    Invoke-Step 'typecheck (web app, with core and components)' { node $yarn workspace '@actual-app/web' run typecheck }
    Invoke-Step 'format check of the whole repository (line endings ignored, no changes)' { node (Join-Path $PSScriptRoot 'format-check-lf.mjs') }
    Invoke-Step 'lint of the whole repository (no changes)' { node $yarn oxlint --type-aware --quiet }
    Invoke-TranslationCheck
    $dirty = Get-DirtyFiles
    $budgetExisted = Test-Path $testBudget
    Invoke-Step 'unit tests: web app' { Invoke-Vitest '@actual-app/web' '' @('--run') }
    Invoke-Step 'unit tests: core (node)' { Invoke-Vitest '@actual-app/core' 'node' @('--run') }
    Invoke-Step 'unit tests: core (web)' { Invoke-Vitest '@actual-app/core' 'web' @('--run', '-c', 'vitest.web.config.ts') }
    Invoke-Step 'unit tests: components' { Invoke-Vitest '@actual-app/components' 'web' @('--run', '-c', 'vitest.web.config.ts') }
    Restore-TestLeftovers $dirty $budgetExisted
    Invoke-Step 'build (only if the code changed) and serve on port 3001' {
      $existing = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
      if ($existing) {
        Write-Host 'Port 3001 is in use: stop the running Sela first (Ctrl+C in its window).' -ForegroundColor Red
        $global:LASTEXITCODE = 1
        return
      }
      $proc = Start-Process powershell -PassThru -WindowStyle Hidden -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $root 'start-sela.ps1'), '-NoBrowser')
      Set-Content (Join-Path $env:TEMP 'sela-check-server.pid') $proc.Id
      $deadline = (Get-Date).AddMinutes(15)
      do {
        Start-Sleep -Seconds 5
        try { $ok = (Invoke-WebRequest 'http://localhost:3001/' -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200 } catch { $ok = $false }
      } until ($ok -or $proc.HasExited -or (Get-Date) -gt $deadline)
      $global:LASTEXITCODE = $(if ($ok) { 0 } else { 1 })
    }
    if ($results[-1].Result -eq 'passed') {
      Invoke-Step 'end-to-end: mortgage (Chrome, against the build)' {
        $env:E2E_START_URL = 'http://localhost:3001'
        $env:E2E_CHANNEL = 'chrome'
        try { node $yarn workspace '@actual-app/web' exec playwright test e2e/mortgage.test.ts --reporter=list }
        finally { $env:E2E_START_URL = $null; $env:E2E_CHANNEL = $null }
      }
      $pidFile = Join-Path $env:TEMP 'sela-check-server.pid'
      if (Test-Path $pidFile) {
        $serverPid = [int](Get-Content $pidFile)
        Get-CimInstance Win32_Process -Filter "ParentProcessId=$serverPid" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        Stop-Process -Id $serverPid -Force -ErrorAction SilentlyContinue
        Remove-Item $pidFile
      }
    } else { Skip-Step 'end-to-end: mortgage' 'no running build' }
  }
}

Write-Host ""
Write-Host "== Summary: track $Track, $([int]((Get-Date) - $started).TotalSeconds) s" -ForegroundColor Cyan
$results | Format-Table -AutoSize | Out-String | Write-Host
$failed = @($results | Where-Object { $_.Result -eq 'FAILED' }).Count
if ($failed -gt 0) { Write-Host "$failed step(s) failed." -ForegroundColor Red; exit 1 }
Write-Host 'All steps passed.' -ForegroundColor Green
exit 0
