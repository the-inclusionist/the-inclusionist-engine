# SPDX-License-Identifier: AGPL-3.0-or-later
# Rebuild Vosk for the browser without evaluation of code (ADR-0193 and its errata, ADR-0203; issue #184).
#
# Writes vosk.worker.js, vosk.wasm.js and vosk.wasm into <out>. Needs git, Docker (Linux containers) and Node 24.
# Pinned: lichess-org/vosk-browser 50a6347, alphacep/vosk-api d714dff, the fork's builder image by digest. The only change to the
# fork is one link flag, -s DYNAMIC_EXECUTION=0 (vosk-browser-dynamic-execution.patch), which removes embind's invokers built with
# `Function` — the engine's Content-Security-Policy has no 'unsafe-eval'.
#
# Usage:  pwsh scripts/models/build-vosk-browser.ps1 -Out <folder>
param([Parameter(Mandatory = $true)][string]$Out)
$ErrorActionPreference = 'Stop'
$fork = '50a6347c5167f95c458ffde0fd064569ae108ddf'
$vosk = 'd714dff8d34e1aac6492e25b6610228c5c397116'
$builder = 'docker.io/schlawg/vosk-wasm-builder@sha256:a23ec9dd4344e19583c51e3515c0233d26a646f2d1c3af5b148a033a6a24b1af'
$patch = Join-Path $PSScriptRoot 'vosk-browser-dynamic-execution.patch'

$work = Join-Path ([IO.Path]::GetTempPath()) ("vosk-browser-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
git clone https://github.com/lichess-org/vosk-browser.git $work
git -C $work checkout $fork
git -C $work submodule update --init vosk
git -C "$work/vosk" checkout $vosk
git -C $work apply $patch

docker run --rm -v "${work}:/io" -w /io $builder make -C src dist
if ($LASTEXITCODE -ne 0) { throw 'the WebAssembly build failed' }

New-Item -ItemType Directory -Force "$work/lib/src/gen", "$work/lib/dist" | Out-Null
Copy-Item "$work/build/release/vosk.js" "$work/lib/src/gen/vosk.js"
Copy-Item "$work/src/vosk.d.ts" "$work/lib/src/gen/vosk.d.ts"
Copy-Item "$work/build/release/vosk.wasm" "$work/lib/dist/vosk.wasm"
Push-Location "$work/lib"
try { npm install --no-audit --no-fund; node build.mjs; if ($LASTEXITCODE -ne 0) { throw 'the worker bundle failed' } } finally { Pop-Location }

New-Item -ItemType Directory -Force $Out | Out-Null
foreach ($f in 'vosk.worker.js', 'vosk.wasm.js', 'vosk.wasm') { Copy-Item "$work/lib/dist/$f" (Join-Path $Out $f) -Force }
$avaliacoes = ([regex]::Matches((Get-Content (Join-Path $Out 'vosk.worker.js') -Raw), 'newFunc\(')).Count
if ($avaliacoes -ne 0) { throw "the worker still builds functions from text ($avaliacoes)" }
Get-ChildItem $Out -File | ForEach-Object { '{0}  {1}' -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower(), $_.Name }
