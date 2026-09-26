# SPDX-License-Identifier: AGPL-3.0-or-later
# Build eSpeak NG for the browser from a pinned commit — the neural voice's phonemizer (ADR-0203 erratum; issue #192).
#
# Writes espeak-ng.js and espeak-ng.wasm into <out>. Needs git and Docker (Linux containers); nothing else is downloaded.
# eSpeak NG is GPL-3.0-or-later: THIS SCRIPT AND THE COMMIT BELOW ARE THE CORRESPONDING SOURCE of what it writes (GPL-3.0 §6),
# so the staged folder's LICENSE.md names both, and changing either one is a new folder with a new name.
#
# Pinned, and why each one:
# · eSpeak NG 530bf0ab (master, 2023-09-27): the npm package the engine used before, espeak-ng@1.0.2, was built on 2023-11-24
#   by `git clone` of master with no revision named (github.com/ianmarmour/espeak-ng.js, README), and 530bf0ab was master's head
#   from 2023-09-27 until 2023-12-11. Built here, it embeds the package's data byte for byte and gives its phonemes (models.md).
# · emscripten/emsdk 3.1.49 by digest: the «latest» Emscripten on the day the package was built, and the image carries the
#   compilers and CMake the build uses — no package is installed inside it.
# · The link flags are the package's (ES module factory `ESpeakNG`, 32 MB of memory, the data embedded at the path the binary
#   looks in) plus three: -O2, the file system exported by name, and -s DYNAMIC_EXECUTION=0, which makes Emscripten refuse to
#   emit `eval` or `new Function` — the engine's Content-Security-Policy has neither.
# · The data is cut to what the engine speaks: the voices of pt, es and en, their dictionaries, and de and fr, the two
#   dictionaries the Portuguese one hands a word to («ß», «Feuerbach», «Louis»). -AllLanguages embeds every language instead.
# · CMake would fetch libsonic from GitHub when it is not installed; the build does not use it (USE_LIBSONIC=OFF), so two
#   placeholder paths stop the fetch.
#
# Usage:  pwsh scripts/models/build-espeak-ng.ps1 -Out <folder> [-AllLanguages]
param([Parameter(Mandatory = $true)][string]$Out, [switch]$AllLanguages)
$ErrorActionPreference = 'Stop'
$commit = '530bf0abf4174dc9ca28dbacc11bd5e9ae6152cd'
$emsdk = 'docker.io/emscripten/emsdk:3.1.49@sha256:b35d43d2927648cc4e026aecbdc05c5ffdc8a2b72d7e085e0a836510ff2e0004'
$voices = 'pt es en'
$dictionaries = if ($AllLanguages) { 'all' } else { 'pt es en de fr' }

# Runs in the image. Written here, and not as a .sh beside this file, so a checkout with CRLF endings cannot break it. It builds
# in the container's own /build — the source is copied in from /io — because CMake copies thousands of data files, and on a
# Windows folder mounted into Linux that alone took minutes. The path is part of the output (the C asserts name their files),
# so it is fixed here like everything else.
$inside = @'
set -euo pipefail
mkdir /build && cp -r /io/src /build/src && cd /build
OPTS=(-DCMAKE_INSTALL_PREFIX=/usr/local -DCMAKE_BUILD_TYPE= -DBUILD_SHARED_LIBS=OFF -DBUILD_TESTING=OFF
      -DUSE_ASYNC=OFF -DUSE_MBROLA=OFF -DUSE_LIBSONIC=OFF -DUSE_LIBPCAUDIO=OFF -DUSE_KLATT=OFF -DUSE_SPEECHPLAYER=OFF
      -DSONIC_LIB=unused -DSONIC_INC=unused)

# 1. A native build compiles the data (phonemes, intonations, dictionaries): the compiler is espeak-ng itself.
cmake -S src -B build/native "${OPTS[@]}" -DCMAKE_C_FLAGS=-O2
cmake --build build/native --target data -j"$(nproc)"

# 2. The data the wasm carries.
D=build/native/espeak-ng-data
S=stage/espeak-ng-data
mkdir -p "$S/voices"
if [ "$DICTIONARIES" = all ]; then
  cp -r "$D/." "$S/"
else
  cp "$D/phondata" "$D/phondata-manifest" "$D/phonindex" "$D/phontab" "$D/intonations" "$S/"
  cp -r "$D/voices/!v" "$S/voices/"
  for d in $DICTIONARIES; do cp "$D/${d}_dict" "$S/"; done
  (cd "$D" && find lang -type f) | while read -r f; do
    b=$(basename "$f"); l=${b%%-*}
    for v in $VOICES; do if [ "$l" = "$v" ]; then mkdir -p "$S/$(dirname "$f")"; cp "$D/$f" "$S/$f"; fi; done
  done
fi

# 3. The command-line program, linked as an ES module factory with the data inside the wasm. The C library's <wchar.h> is
#    read first: eSpeak NG's <wctype.h> maps iswalnum to its own ucd_isalnum, and Emscripten's <wchar.h>, read after that,
#    would declare ucd_isalnum(wint_t) over ucd_isalnum(codepoint_t) and stop the build.
WCHAR="$(em-config CACHE)/sysroot/include/wchar.h"
LINK="-sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=ESpeakNG -sINITIAL_MEMORY=32MB -sEXPORTED_RUNTIME_METHODS=FS"
LINK="$LINK -sDYNAMIC_EXECUTION=0 --embed-file /build/$S@/usr/local/share/espeak-ng-data"
emcmake cmake -S src -B build/wasm "${OPTS[@]}" "-DCMAKE_C_FLAGS=-O2 -include $WCHAR" "-DCMAKE_EXE_LINKER_FLAGS=$LINK"
cmake --build build/wasm --target espeak-ng-bin -j"$(nproc)"
mkdir -p /io/out
cp build/wasm/src/espeak-ng.js build/wasm/src/espeak-ng.wasm /io/out/
'@

$work = Join-Path ([IO.Path]::GetTempPath()) ("espeak-ng-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
try {
  git clone -c core.autocrlf=false https://github.com/espeak-ng/espeak-ng.git "$work/src"
  if ($LASTEXITCODE -ne 0) { throw 'the clone failed' }
  git -C "$work/src" -c advice.detachedHead=false checkout $commit
  if ($LASTEXITCODE -ne 0) { throw "commit $commit is not in the clone" }

  docker run --rm -e "VOICES=$voices" -e "DICTIONARIES=$dictionaries" -v "${work}:/io" -w /io $emsdk bash -c $inside.Replace("`r", '')
  if ($LASTEXITCODE -ne 0) { throw 'the WebAssembly build failed' }

  New-Item -ItemType Directory -Force $Out | Out-Null
  foreach ($f in 'espeak-ng.js', 'espeak-ng.wasm') { Copy-Item "$work/out/$f" (Join-Path $Out $f) -Force }
} finally {
  Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}

$glue = Get-Content (Join-Path $Out 'espeak-ng.js') -Raw
$evaluations = ([regex]::Matches($glue, '\beval\s*\(|new\s+Function\b|\bFunction\s*\(')).Count
if ($evaluations -ne 0) { throw "the glue still evaluates text as code ($evaluations)" }
Get-ChildItem $Out -File -Filter 'espeak-ng.*' | ForEach-Object {
  '{0}  {1}  {2}' -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower(), $_.Name, $_.Length
}
