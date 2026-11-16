# Prints a fingerprint of the files that affect the web build, from their
# content. start-sela.ps1 builds again only when this fingerprint changes.
#
# - A committed or staged file counts by the blob id git already stores.
# - A file changed in the working tree (or new and not ignored) counts by a
#   hash of its current content, so saving the same file again is detected.
# - Tests, end-to-end tests, Markdown and docs do not affect the build and are
#   left out, so editing them does not cause a rebuild.
#
# Usage: powershell -File scripts\build-stamp.ps1 [-List]
#   -List  print the inputs (path and hash) instead of the fingerprint
param([switch]$List)

$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {

if (-not (Get-Command git -ErrorAction SilentlyContinue) -or -not (git rev-parse --git-dir 2>$null)) {
  Write-Output 'no-git'
  return
}

# Change "v2" when the rules below change, so every old build is rebuilt once.
$version = 'v2'

$pathspec = @(
  'package.json', 'yarn.lock', '.yarnrc.yml', 'tsconfig.json',
  'packages/desktop-client', 'packages/loot-core', 'packages/component-library',
  'packages/plugins-service', 'packages/crdt', 'packages/vite-plugin-peggy',
  ':(glob,exclude)**/*.test.*',
  ':(glob,exclude)**/*.spec.*',
  ':(glob,exclude)**/__tests__/**',
  ':(glob,exclude)**/__mocks__/**',
  ':(glob,exclude)**/mocks/**',
  ':(glob,exclude)**/e2e/**',
  ':(glob,exclude)**/*.md',
  ':(glob,exclude)**/*-snapshots/**',
  ':(glob,exclude)**/__snapshots__/**',
  ':(glob,exclude)**/playwright.config.*',
  ':(glob,exclude)**/vitest*.config.*'
)

# Committed/staged content: "<mode> <blob> <stage>\t<path>"
$entries = @{}
foreach ($line in (git -c core.quotepath=off ls-files -s -- @pathspec)) {
  $tab = $line.IndexOf("`t")
  $entries[$line.Substring($tab + 1)] = $line.Split(' ')[1]
}

# Working-tree changes and new files: hash their current content.
$changed = @(git -c core.quotepath=off ls-files --modified --others --exclude-standard -- @pathspec | Sort-Object -Unique)
if ($changed.Count -gt 0) {
  $present = @($changed | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf })
  foreach ($path in $changed) { if ($present -notcontains $path) { $entries[$path] = 'deleted' } }
  if ($present.Count -gt 0) {
    # Paths go as arguments, in batches: piping them to git from Windows
    # PowerShell would prefix a byte-order mark to the first path.
    for ($i = 0; $i -lt $present.Count; $i += 100) {
      $batch = @($present[$i..([Math]::Min($i + 99, $present.Count - 1))])
      $hashes = @(git hash-object -- @batch)
      for ($j = 0; $j -lt $batch.Count; $j++) { $entries[$batch[$j]] = $hashes[$j] }
    }
  }
}

$lines = $entries.Keys | Sort-Object | ForEach-Object { "$_ $($entries[$_])" }
if ($List) { $lines; return }

$text = "$version`n" + ($lines -join "`n")
$sha = [Security.Cryptography.SHA1]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($text))
Write-Output ([BitConverter]::ToString($sha).Replace('-', ''))

} finally {
  Pop-Location
}
