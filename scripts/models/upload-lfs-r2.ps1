# SPDX-License-Identifier: AGPL-3.0-or-later
<#
.SYNOPSIS
  Uploads the staged model folders of `the-inclusionist-lfs` to the project's Cloudflare R2 bucket, then checks what the
  public address serves against each folder's SHA256SUMS.

.DESCRIPTION
  The engine's heavy-file catalogue (`app/js/platform/pesados-catalogo.ts`) pins every file by sha256, so a mirror is only
  useful if the public address serves exactly those bytes. This script does the two halves: `rclone copy` per folder, and a
  verification that fetches each file over HTTPS and hashes it.

  A folder whose LICENSE.md opens with «🔴 ON HOLD» is skipped: it is staged but not cleared for upload (ADR-0203 erratum,
  «se for legal»). Nothing here holds a credential — the rclone remote is configured by the Dev, once, with their own keys.

.EXAMPLE
  pwsh scripts/models/upload-lfs-r2.ps1
  pwsh scripts/models/upload-lfs-r2.ps1 -VerifyOnly
#>
[CmdletBinding()]
param(
  # The rclone remote the Dev configured for R2 (see models.md).
  [string]$Remote = 'cloudflare-r2-the-inclusionist',
  [string]$Bucket = 'the-inclusionist-lfs',
  # Where the public domain serves the bucket from.
  [string]$PublicBase = 'https://lfs-oinclusionista.jrocha.dev.br',
  [string]$Lfs = "$HOME\Claude\the-inclusionist-lfs",
  # Skip the upload and only check what the public address already serves.
  [switch]$VerifyOnly
)

$ErrorActionPreference = 'Stop'
if (-not (Get-Command rclone -ErrorAction SilentlyContinue)) { throw 'rclone is not on PATH' }
if (-not (Test-Path $Lfs)) { throw "no staging tree at $Lfs" }

$folders = Get-ChildItem $Lfs -Directory | Sort-Object Name
$onHold = @()
$todo = @()
foreach ($f in $folders) {
  $lic = Join-Path $f.FullName 'LICENSE.md'
  if ((Test-Path $lic) -and ((Get-Content $lic -TotalCount 1 -Encoding utf8) -match 'ON HOLD')) { $onHold += $f.Name; continue }
  if (-not (Test-Path (Join-Path $f.FullName 'SHA256SUMS'))) { throw "$($f.Name) has no SHA256SUMS — stage it first" }
  $todo += $f
}
Write-Host "folders to upload: $($todo.Name -join ', ')"
if ($onHold) { Write-Host "ON HOLD, not uploaded: $($onHold -join ', ')" -ForegroundColor Yellow }

if (-not $VerifyOnly) {
  foreach ($f in $todo) {
    Write-Host "`n=== $($f.Name)" -ForegroundColor Cyan
    # --checksum: compare by hash, not by timestamp, so a re-run uploads only what differs
    & rclone copy $f.FullName "${Remote}:${Bucket}/$($f.Name)" --checksum --transfers 4 --progress
    if ($LASTEXITCODE -ne 0) { throw "rclone copy failed for $($f.Name)" }
  }
}

# --- verification: what the PUBLIC address serves, hashed --------------------------------------
$bad = @()
$checked = 0
foreach ($f in $todo) {
  foreach ($line in Get-Content (Join-Path $f.FullName 'SHA256SUMS') -Encoding utf8) {
    if (-not $line.Trim()) { continue }
    $sha, $rel = $line -split '\s+', 2
    $url = "$PublicBase/$($f.Name)/$($rel.Trim())"
    $tmp = New-TemporaryFile
    try {
      Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing
      $got = (Get-FileHash $tmp -Algorithm SHA256).Hash.ToLower()
      if ($got -ne $sha) { $bad += "$url`n  expected $sha`n  served   $got" }
    } catch {
      $bad += "$url`n  did not download: $($_.Exception.Message)"
    } finally { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
    $checked++
  }
}
Write-Host "`nchecked $checked files from $PublicBase" -ForegroundColor Cyan
if ($bad) {
  Write-Host "MISMATCH in $($bad.Count) file(s):" -ForegroundColor Red
  $bad | ForEach-Object { Write-Host $_ -ForegroundColor Red }
  exit 1
}
Write-Host 'every file served matches its SHA256SUMS' -ForegroundColor Green
