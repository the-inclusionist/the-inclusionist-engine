# Models — what each one does, how the engine uses it, and how to rebuild it

> The engine's voice, recognition and vision models, one section each: **role**, **where it comes from**, **how the engine uses
> it**, **how to rebuild it from zero**, and **how to check it**. Decisions: ADR-0190, ADR-0193, ADR-0194, ADR-0197, ADR-0198,
> ADR-0200, ADR-0201, ADR-0202, ADR-0203, ADR-0207 (all in `docs/2-Architecture/adr/`). Issues: #181, #184, #185, #189, #190, #193.

## The order the engine tries

| task | first | fallback (carried by the engine or the game) |
|---|---|---|
| speaking (TTS) | the browser's Web Speech voice for the language (ADR-0200) | Kokoro through the game's port (ADR-0198; Piper left, ADR-0207) |
| commands and menu names by voice | Web Speech recognition **on the device only** (ADR-0200 erratum) | Vosk small, the game's words as grammar (ADR-0193, ADR-0194) |
| reading assessment (a child reads a text aloud) | Web Speech recognition on the device | Moonshine where it covers the language (en, es), Whisper for pt (ADR-0201) |
| hands, face and eyes | — | MediaPipe Gesture Recognizer and Face Landmarker (ADR-0197, ADR-0199, ADR-0202) |

`platform/speech-recognition` decides the recognition route: Web Speech only when its recognition object knows `processLocally` and
`SpeechRecognition.available({ langs, processLocally: true })` answers `available`. Anything else falls back; a recogniser that would
send the child's voice to a server is never built.

## Where the files live (ADR-0177, ADR-0203)

Every heavy file is in `app/js/platform/heavy-catalogue.ts` with its upstream address and sha256. The **build** fetches it into the
delivery; the page asks for it at `heavy/<host><path>` on its own origin and the service worker answers from the checked cache.

**What goes into a delivery is what the game declared** (ADR-0216 §3), said to the build as flags:

```powershell
npx inclusionist-heavy dist                                # vision + the voice commands in pt, en and es
npx inclusionist-heavy dist --kokoro                       # uses: { neuralVoice: true }  → +372 MiB
npx inclusionist-heavy dist --reading                      # uses: { reading: true }      → the pt, en and es reading models
npx inclusionist-heavy dist --reading pt                   # the reading narrowed to Portuguese
npx inclusionist-heavy dist --commands pt                  # the voice commands narrowed to Portuguese
npx inclusionist-heavy dist --commands none                # no voice commands at all
```

**The reading models are carried in the three languages when the game listens** (ADR-0225 erratum of 2026-09-26, the Dev:
«Negativo, baixar os três. Toda criança vai experimentar as três línguas imediatamente.»). A reading model is per language (pt 378
MiB, en 162, es 310), and a game that declares `uses: { reading: true }` asks, at every device's start, for the models of every
language the page can switch to — the child's whole language first, then each other one whole, so her command model never waits
behind another language's reading. `--reading` alone (or `--reading all`) carries every language the catalogue has a reading
model for. `--reading <language>` repeats and **narrows**, with the same bytes as before; `--reading none`, like no flag, carries
none. A language the catalogue has no reading model for **stops the command with exit 2**, naming it — `--reading fr`, or a
folder written after the flag (`inclusionist-heavy --reading dist`), used to carry nothing in silence. Put the folder first.
⚠️ **What a narrowed delivery costs on the device:** built with `--reading pt`, a game that listens still asks for the en and es
models at its start — two quiet 404s in `onHeavyProgress` — and a child who switches to English or Spanish and reads is told
that reading could not start in this language, and `problems` names the fix: `--reading` alone, or that language in its list.
📏 **Measured on 2026-09-26**, building the engine's `dist` from the local staging tree with `--base`: with `--reading` the
delivery is **1,079,687,568 bytes**; with `--reading pt`, 584,586,876 (so the three cost **495,100,692 bytes**, 472.2 MiB, more);
with no `--reading`, 160,916,123. The three languages' folders are 891,780,140 bytes — the models (891,751,676: pt 396,659,515,
en 169,517,267, es 325,574,894) and their licence files.

**The voice commands are carried in the three languages by default** (ADR-0225 erratum, the Dev: «A entrega leva as três
línguas.»). No game declares them — saying «menu» is a way into the controller (ADR-0111) — and a child can switch language
mid-game, so the delivery carries every language the catalogue has a Vosk model for, and the start asks for **all of them**,
the child's own first, so a switch the next day, offline, finds its model already kept. `--commands <language>` repeats and
**narrows**: the languages named, and only those — so a school that adds a language to a narrowed delivery names both, since
`--commands es` alone would leave the Portuguese out. `--commands none` carries no command model and no Vosk runtime, which was
the default before. A language the delivery did not carry is still a line of `problems` when the child speaks it, naming this fix.
📏 **Measured on 2026-09-25**, building from the local staging tree with `--base`: the default delivery is **116,455,039 bytes**
(111.1 MiB) larger than one built with `--commands none` — the three models (113,224,199 bytes: pt 32,358,733, en 41,116,539, es
39,748,927), the runtime (3,197,688) and two licence folders with the notice lines (33,152) — and **80,865,466 bytes** (77.1 MiB)
larger than one built with `--commands pt`. The reading models follow the same rule since 2026-09-26 (above), with one
difference that is the game's answer: without `--reading` a delivery carries no reading model, because only a game that listens
needs one.

**Where the build reads from is a choice** (the Dev, 2026-09-21). Unset, it is upstream. With a base, each file comes from a
mirror — the project's Cloudflare, a school's own server, or a folder on the build machine, which needs no network at all:

```powershell
npx inclusionist-heavy dist --base https://lfs-oinclusionista.jrocha.dev.br
$env:INCLUSIONIST_HEAVY_BASE = 'C:\Users\<you>\Claude\the-inclusionist-lfs'   # or a .env beside the build (.env.example)
```

**The licences travel with the files** (`scripts/licences/third-party.mjs`, gated by `tests/heavy-licences.node.test.js`): every
folder of `heavy/` that receives a file also receives its project's `LICENSE` and `NOTICE` — eSpeak NG's folder a `SOURCE` too,
saying where its GPL source is and that the exact revision is unverified — and `heavy/THIRD-PARTY-NOTICES.md` lists each project
with its version, SPDX licence, copyright line (or `UNVERIFIED`) and those paths. The texts ship in the npm package; a catalogue
entry with no licence group there is refused, like a file whose sha256 differs. 📏 The whole catalogue adds 38 such files, about 188 KiB.

The flag beats the environment, and the environment beats the `.env`. The mapping from each upstream address to the folder a
mirror serves it under is `platform/heavy-mirror`, written once. **The sha256 check does not move**: a base that serves other
bytes writes nothing and the build fails naming the address — which is what makes pointing elsewhere safe, and why the base is
not something anyone has to trust. The delivery path never changes, because it is what the child's page asks for.

📏 **Measured on 2026-09-21, against the project's own mirror**: `npx inclusionist-heavy <dir> --base
https://lfs-oinclusionista.jrocha.dev.br` fetched the six vision files — 30.7 MiB — in 5.1 s, every one checked against its
sha256, and wrote them under `heavy/cdn.jsdelivr.net/…` and `heavy/storage.googleapis.com/…`. That is the whole point in one
line: **the bytes came from Cloudflare and the paths are still the upstream ones**, so a page built this way asks for exactly
what a page built from upstream asks for. 📌 It also answers the older plan of «putting the project's addresses in the catalogue
in place of the upstream ones»: nothing in the catalogue has to move, and it should not — the upstream address is the provenance
of the bytes, and the sha256 beside it is what makes any mirror of them safe to use.

Files **the project builds** (the Vosk worker and wasm, the repacked Vosk models, the Spanish Moonshine ONNX) have no upstream: they
are staged in `the-inclusionist-lfs/` (one folder per artefact, laid out as its future Hugging Face repository, with `SHA256SUMS`),
uploaded by the Dev to the project's **Cloudflare**, and move to **Hugging Face** after the city's permission. The catalogue names the
Cloudflare address until then; the sha256 never changes with the move.

Third-party files the licence lets the project mirror (ADR-0203 erratum, issue #192) are staged the same way, unchanged, with their
licence and notice: `kokoro-82m-v1.0-onnx/` (Apache-2.0, credits the CC BY training audio; the model, tokenizer and all 34 voices) and
`mediapipe-tasks-vision-1.0.1/` (Apache-2.0: the runtime and the face, gesture and hand models). Their sha256 are the catalogue's.
The three **reading** models are staged the same way and are now in the catalogue (`reading:<language>:*`), addressed at the
project's own mirror because neither export has an upstream: `whisper-small-onnx/` (Portuguese, exported here),
`moonshine-streaming-small-onnx/` (English, the Workmind export, MIT) and `moonshine-streaming-small-es-onnx/` (Spanish, exported
here). 📏 Measured on 2026-09-21: a delivery with `--reading en --base <the staging tree>` wrote the 161.7 MiB of the English model
from disk, with no network, each file checked against its sha256.

### What the host that serves a delivery must do with `.tar.gz`

🔴 **The command models must reach the browser as the bytes the catalogue pins, so the host must serve `heavy/**/*.tar.gz` with no
`Content-Encoding`.** A `.tar.gz` is a file whose format is gzip, not a response compressed for transport: served with
`Content-Encoding: gzip`, the browser undoes the gzip before the engine sees a byte, the sha256 of what arrives is the `.tar`'s, and
the checked cache refuses the model — the child's voice commands never start. 📏 **Measured on 2026-09-26** with the engine's `dist`
and `vosk-model-small-pt-0.3.tar.gz`: `vite preview` answers it with `Content-Encoding: gzip` and an empty `Content-Type` (its static
server, `sirv` 3.0.2, maps any name ending in `.gz` to that encoding); a client that decodes as a browser does ends with 53,565,440
bytes instead of the 32,358,733 pinned, and the sha256 no longer matches. The same file from a server that applies
`app/public/_headers` and adds no encoding arrives whole and matches.

⚠️ **`_headers` is not the fix, and no rule for it was added.** `vite preview` never reads `_headers` — the same measurement found
none of its `/*` headers (no COEP, no CSP) on the response —, so no rule there can reach it. On a host that honours `_headers`
(Cloudflare Pages), a detach rule (`! Content-Encoding`) is documented, but whether that host adds the header to a `.tar.gz` at all,
and whether the rule would take it off, **could not be measured from here**: no Pages project is connected, the tree carries no
local emulator of it, and fetching one is out of bounds. A rule written without that measurement would be one the next reader
trusts. So the constraint is on the host, and it is checked on the host:

```powershell
curl.exe -sI -H "Accept-Encoding: gzip, br" https://<the delivery>/heavy/lfs-oinclusionista.jrocha.dev.br/vosk-models/vosk-model-small-pt-0.3.tar.gz
# no `Content-Encoding` line; `Content-Length: 32358733`
```

For a local served run, use a server that applies `_headers` and adds no encoding — never `vite preview`, which also leaves out
the `Cross-Origin-Embedder-Policy` the runtimes' threads need (ADR-0192).

### Uploading the staging tree (the Dev runs it)

```powershell
rclone config create cloudflare-r2-the-inclusionist s3 provider=Cloudflare `
  access_key_id=<R2 access key> secret_access_key=<R2 secret> region=auto `
  endpoint=https://<account id>.eu.r2.cloudflarestorage.com no_check_bucket=true
pwsh <the staging tree>/upload-to-r2.ps1
```

A bucket with a jurisdiction answers only on that jurisdiction's endpoint (`.eu` here). `no_check_bucket` is what rclone's own
documentation asks for with an **Object Read & Write** token: without bucket-level permission, the check before each upload
fails. `acl` is not offered for the Cloudflare provider and is not needed.

The script lives **in the staging tree**, not here: it uploads a folder from a machine to an account, while this repository keeps
the recipes that rebuild a model from zero (ADR-0203 erratum: «receitas moram na ENGINE»). It uploads every staged folder
**except** those whose `LICENSE.md` opens with «🔴 ON HOLD», then fetches each file from the public address and compares it with
the folder's `SHA256SUMS` — the catalogue pins those bytes, so serving anything else would break the delivery. `-VerifyOnly`
runs the second half alone. Credentials live in the rclone remote, never in a repository.

---

## Kokoro — TTS fallback, through the game's port

- **What:** `onnx-community/Kokoro-82M-v1.0-ONNX`, fp32 `onnx/model.onnx` (325 532 232 bytes), `tokenizer.json`, 34 voice tables
  (pt, es, en-US, en-GB). Apache-2.0.
- **Engine use:** `platform/kokoro-runtime` loads the phonemizer (eSpeak NG, the project's own build, below) and onnxruntime-web
  1.27.0 from `heavy/` on the page's own origin, and `platform/kokoro-port` puts them together: `phonemize`, `vocabulary`,
  `voice`, `session` (ADR-0216).
- **Rebuild:** upstream files, pinned by sha256 in `platform/heavy-catalogue.ts`.

## eSpeak NG for the browser — the neural voice's phonemizer (project-built)

- **What:** `espeak-ng.js` (an ES module whose default export is the factory `ESpeakNG`) and `espeak-ng.wasm` — the eSpeak NG
  command-line program in WebAssembly, with its phoneme data and dictionaries inside the wasm. GPL-3.0-or-later. Catalogue ids
  `voz:runtime:fonemas` and `voz:runtime:fonemas:wasm`, folder `espeak-ng-530bf0a/` of the mirror.
- **Why built here:** the npm package the engine used, `espeak-ng@1.0.2`, names no eSpeak NG revision (its binary says only
  «1.52-dev»), so no delivery could name the Corresponding Source the GPL asks for beside the binary. The Dev chose to compile
  it here from a pinned commit (ADR-0203 erratum, 2026-09-26; issue #192).
- **Which commit, and why:** `530bf0abf4174dc9ca28dbacc11bd5e9ae6152cd`, eSpeak NG's master of 2023-09-27. The package's
  repository (`github.com/ianmarmour/espeak-ng.js`) holds only the two built files and a README whose recipe clones master
  with no revision; its commits and the npm publication are all of 2023-11-24, and master's head that day was `530bf0ab` —
  the next commit on master's first-parent line is of 2023-12-11. ⚠️ GitHub's commit list «until 2023-11-24» answers
  `f9976e8f` (2023-10-07) instead: that commit sat on a pull-request branch and reached master only with the 2023-12-11
  merge, and it differs from `530bf0ab` by two lines of `pl_rules`. 📏 The package's own data decides, read through each
  module's file system: of the 355 data files an `-AllLanguages` build of `530bf0ab` embeds, **352 are byte-identical to the
  package's**, `pl_dict` among them — `f9976e8f`'s `pl_dict` is not. The other three are `fa_dict`, `th_dict` and `ur_dict`,
  which this CMake build does not reproduce from the package's autotools build (for `fa`, CMake never copies `fa_extra`;
  `th` and `ur` were not traced); none of the three is in the build the engine ships, whose 126 files are all the package's. The package also
  holds 90 MBROLA voice files, which a build without MBROLA does not make. The 1.52.0 tag (`4870adfa`, 2024-12-12) exists
  but is fourteen months later and does not give the package's phonemes (below), so it is not the closest match.
  ⚠️ `--version` says `1.52.0.1` where the package said `1.52-dev`: that is the CMake build's version number for the same
  tree, not another source.
- **Rebuild from zero** (git and Docker with Linux containers; nothing else is downloaded):

  ```powershell
  pwsh scripts/models/build-espeak-ng.ps1 -Out C:\Users\candi\Claude\the-inclusionist-lfs\espeak-ng-530bf0a
  ```

  The script pins the commit and the toolchain, `emscripten/emsdk:3.1.49` by digest (the «latest» Emscripten on the day the
  package was built; the image carries the compilers and CMake, and nothing is installed in it). In the image it builds
  eSpeak NG natively to compile the data, cuts the data (below), then builds the program with `emcmake` and links it with
  the package's flags — `-sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=ESpeakNG -sINITIAL_MEMORY=32MB` and `--embed-file` at
  `/usr/local/share/espeak-ng-data`, the path the program reads — plus `-O2`, `-sEXPORTED_RUNTIME_METHODS=FS` and
  `-sDYNAMIC_EXECUTION=0`, which makes Emscripten refuse to emit `eval` or `new Function`. It fails if the glue still holds
  either, and prints each file's sha256 and size. Two things the recipe works around, each found by a failed build: CMake
  would fetch libsonic from GitHub (the build does not use it), and Emscripten's `<wchar.h>`, read after eSpeak NG's
  `<wctype.h>`, redeclares `ucd_isalnum` with another type — the C library's header is included first. 📏 Run twice, it wrote
  the same bytes both times.
- **The data it carries:** the voices the engine speaks (`pt`, `pt-BR`, `es`, `es-419`, and the eight `en` voices), their
  dictionaries, and `de` and `fr` — the two dictionaries Portuguese hands a word to («ß», «Feuerbach», «Louis»): 📏 without
  them those words come out spelled letter by letter. `-AllLanguages` embeds every language, as the package did. 📏 Sizes:
  the package 178,386 + 18,485,010 bytes (17.8 MiB); this build 70,951 + 1,493,661 (1.5 MiB); with `-AllLanguages`
  70,952 + 18,330,283. Most of the difference is the data; the rest is `-O2` in place of the package's unoptimised link.
- **Check — the phonemes:** every string of the engine's three dictionaries (`app/js/i18n/{pt,en,es}.ts`, the quiz's questions
  among them) and nine sentences written for the language switches, numbers and punctuation, phonemized as
  `platform/kokoro-port` asks (`-q --ipa --phonout … -v <voice> -f …`) by the package and by this build, in Node, with pt-br,
  es-419, en-us and en-gb: 📏 **2,590 of 2,590 phoneme strings identical, and the Kokoro token ids of all 2,590 identical**
  (tokenizer of `kokoro-82m-v1.0-onnx`). The same comparison against a 1.52.0 build (this recipe with the tag's commit):
  **36 differ**, and their token ids with them — 35 in en-us, where 1.52.0 writes `ɔːɹ` for the package's `oːɹ` («keyboard»,
  «more», «four», «restore», «Kokoro»…), and one in pt-br, where 1.52.0 no longer hands «Louis» to French.
- **Check — the browser:** 📏 2026-09-26, `npm run build` then `inclusionist-heavy dist --base <the staging tree> --kokoro`,
  served with the rules of `_headers` (`script-src 'self' 'wasm-unsafe-eval'`, cross-origin isolated), in headless Chromium
  with no GPU adapter, so on WASM with 4 threads: the quiz with narration turned on and Kokoro chosen imported the build,
  compiled its wasm, phonemized, and played the pt-BR sentence «Voz neural pronta, em … segundos.» (a 117,644-byte WAV)
  6.1 s after the page loaded, with **zero CSP violations** and no page error. The engine's loader called step by step in the
  same page phonemized the quiz's question «Qual animal põe ovos e tem bico?» as `kwˈaʊ ˌænimˈaʊ pˈõj ˈɔvʊz i teɪŋ bˈikʊ`.
  ⚠️ Narration is born off (`platform/audio-mixer`), so a check that does not turn it on hears nothing and proves nothing.
- **The GPL:** the Corresponding Source is the commit plus this recipe. The staged folder carries both in `corresponding-source/` — the
  commit as `espeak-ng-530bf0a.tar.gz` (`git archive`) and `build-espeak-ng.ps1` — with `LICENSE` (GPL-3.0), `NOTICE` and a
  `LICENSE.md` naming them, and every delivery's folder gets a `SOURCE` note saying the same
  (`scripts/licences/third-party.mjs`).

## Whisper small — Portuguese reading fallback (project-exported)

- **What:** `openai/whisper-small` (Apache-2.0) exported to ONNX and quantized here: `onnx/encoder_model_quantized.onnx` (q8),
  `onnx/decoder_model_quantized.onnx` and `onnx/decoder_with_past_model_quantized.onnx` (q8), plus the upstream tokenizer and
  configs. 380 MiB.
- **Why exported here:** the ready-made export the lab measured, `onnx-community/whisper-small`, states no licence of its own
  (read 2026-09-18: only `base_model: openai/whisper-small`), and ADR-0203's erratum mirrors only «se for legal». The weights
  are Apache-2.0, so the project exports them and the mirror carries a licence it can point at.
- **Rebuild from zero** (the same venv as the Moonshine export):

  ```powershell
  .venv\Scripts\python scripts/models/export-whisper-small.py C:\Users\candi\Claude\the-inclusionist-lfs\whisper-small-onnx --check <a Portuguese recording>
  ```

  Two decoders, not a merged one — the shape this project knows how to export; the reader is the engine's own (#185).
- 📏 **Measured on the Dev's reading, 52 words (2026-09-18)**, against the Dev's reference text: PyTorch fp32 1.9 %; this export
  in **fp32 gives PyTorch's text exactly**; in q8, **5.8 %**, against 7.7 % for the third-party export on the same reading.
  Quantizing either half alone costs one word, both cost two, so the smaller files were kept. One reader, one reading.
- ⚠️ `--check` compares the TEXT, not the tokens: q8 parts from PyTorch by two words, and a token comparison would call that a
  failure of the export when it is the quantization. The two suppression lists `generate` applies are in the check.

## Vosk for the browser — commands fallback (project-built)

- **What:** `vosk.worker.js`, `vosk.wasm.js`, `vosk.wasm` — Vosk compiled to WebAssembly **without evaluation of code**. Apache-2.0
  (vosk-browser, vosk-api, Kaldi).
- **Why built here:** `@lichess-org/vosk-browser` 0.0.3 still builds embind invokers with `Function` (measured: `EvalError` under the
  engine's policy). A link with `-s DYNAMIC_EXECUTION=0` removes them.
- **Rebuild from zero** (git, Docker with Linux containers, Node 24):

  ```powershell
  pwsh scripts/models/build-vosk-browser.ps1 -Out C:\Users\candi\Claude\the-inclusionist-lfs\vosk-browser-dynamic-execution-0
  ```

  The script pins `lichess-org/vosk-browser` `50a6347c…`, `alphacep/vosk-api` `d714dff8…`, the builder image
  `schlawg/vosk-wasm-builder@sha256:a23ec9dd…` (Kaldi, OpenFST, CLAPACK and libarchive already compiled to wasm), applies
  `scripts/models/vosk-browser-dynamic-execution.patch` (one link flag), runs `make -C src dist` in the image, bundles the worker with
  esbuild (`lib/build.mjs`) and fails if the worker still contains `newFunc(`. It prints each file's sha256.
- **API** (the fork's head, not npm 0.0.3): `createModel(modelUrl, resolver, logLevel)`; the resolver maps `npm/vosk/vosk.worker.js`
  and `npm/vosk/vosk.wasm` to where the files are served. `new model.KaldiRecognizer(sampleRate, JSON.stringify([...words, '[unk]']))`,
  events `partialresult` and `result`.
- **Check:** served with the engine's CSP (page **and** worker response), zero violations; the Dev's command recordings: pt 7/7, es
  7/7, en 6/7 (2026-09-14, #184).

## Vosk small models — commands fallback (project-repacked)

- **What:** `vosk-model-small-pt-0.3`, `vosk-model-small-es-0.42`, `vosk-model-small-en-us-0.15` as `.tar.gz` (the format vosk-browser
  loads). Apache-2.0 (alphacephei).
- **Rebuild from zero:**

  ```powershell
  python scripts/models/repack-vosk-models.py C:\Users\candi\Claude\the-inclusionist-lfs\vosk-models
  ```

  Downloads the three zips from `alphacephei.com/vosk/models/` and repacks them **deterministically** (sorted entries, mtime 0, gzip
  header mtime 0): the same zip always gives the same sha256 (checked twice, 2026-09-14). No model byte changes.

## Moonshine streaming small, Spanish — reading fallback (project-exported)

- **What:** `moonshine-ai/moonshine-streaming-small-es` (MIT) exported to ONNX: `onnx/encoder_model.onnx` (fp32),
  `onnx/decoder_model_quantized.onnx` and `onnx/decoder_with_past_model_quantized.onnx` (q8), plus the upstream tokenizer and configs.
- **Why built here:** upstream publishes safetensors only; the transformers.js Moonshine path has no `moonshine_streaming` model.
- **Rebuild from zero** (Python 3.12, CPU):

  ```powershell
  uv venv --python 3.12 .venv
  uv pip install --python .venv --index-url https://download.pytorch.org/whl/cpu torch==2.14.0
  uv pip install --python .venv "transformers==5.17.0" onnx onnxscript onnxruntime av numpy
  .venv\Scripts\python scripts/models/export-moonshine-streaming-es.py C:\Users\candi\Claude\the-inclusionist-lfs\moonshine-streaming-small-es-onnx --check <a Spanish recording>
  ```

  Pinned revision `8cb0974f…`. What the script handles, each found by measurement:
  1. the encoder gets the **all-ones attention mask inside the graph** — without it the sliding windows are skipped and decoding loops;
  2. both decoders are exported with `torch.onnx` (dynamo) from examples of batch 2 and length ≥ 2 — `torch.export` specialises any
     dimension it sees as 1; the with-past decoder passes the cross-attention states through;
  3. a cache layer's first update is patched at export time only (the library concatenates onto a rank-1 empty tensor);
  4. **only the decoders are quantized** (q8, MatMul/Gather, per tensor): quantizing the encoder cost 3.6 WER points, per-channel 18.
  `--check` decodes greedily with onnxruntime and must print `"identical": true` against PyTorch's `generate` (with the attention mask).
  ⚠️ The decoder adds positions to the encoder states **in place**: compare against copies.
- **Use:** greedy decoding over two sessions — `decoder_model_quantized` for the first token, `decoder_with_past_model_quantized` after,
  feeding `present.*` back as `past_key_values.*`; pad the audio to a multiple of 80 samples. `optimum`'s `merge_decoders` refuses these
  graphs, so there is no `decoder_model_merged`.
- **Check:** the Dev's Spanish reading, in the browser (onnxruntime-web, engine policy, 4 threads): WER 7.2 %, 37.7 s transcribed in
  7.2 s (2026-09-14, #185).

## Moonshine base and streaming small, English — reading fallback

- **What:** `onnx-community/moonshine-base-ONNX` (MIT, q8) and `Workmind/moonshine-streaming-small-ONNX` (MIT, q8, transformers.js
  layout). Upstream files. **Use:** transformers.js `pipeline('automatic-speech-recognition', …)`, audio padded to 80 samples.
- **Measured** on the Dev's English reading: Moonshine base 16.9 % in 8.3 s; streaming small 19.3 % in 21.3 s.

## Whisper tiny, base, small — reading fallback for Portuguese

- **What:** `onnx-community/whisper-tiny|base|small` q8 (MIT). Upstream files. **Use:** transformers.js pipeline with
  `{ language, task: 'transcribe' }`, **in a worker** (on the main thread a transcription starves the audio thread).
- **Measured:** Portuguese reading — small 7.7 %, base 15.4 %, tiny 42.3 %.

## MediaPipe — hands, face, eyes

- **What:** `@mediapipe/tasks-vision` wasm and `gesture_recognizer.task`, `face_landmarker.task` (Apache-2.0), in the catalogue with
  sha256. **Use:** `platform/vision` loads them; `input/face-signals`, `input/face-map` and `input/hand-map` read their outputs.
- ⚠️ **Measured 2026-09-14:** the library tries to send logs to `odml.pa.googleapis.com`; the engine's `connect-src` blocks every
  attempt. Keep it blocked.

## Staging for upload (`the-inclusionist-lfs`)

```
the-inclusionist-lfs/
  vosk-browser-dynamic-execution-0/   vosk.worker.js  vosk.wasm.js  vosk.wasm  LICENSE  NOTICE  SHA256SUMS
  espeak-ng-530bf0a/                  espeak-ng.js  espeak-ng.wasm  LICENSE  NOTICE  SOURCE  LICENSE.md  SHA256SUMS
                                      corresponding-source/  espeak-ng-530bf0a.tar.gz  build-espeak-ng.ps1
  vosk-models/                        vosk-model-small-{pt-0.3,es-0.42,en-us-0.15}.tar.gz  SHA256SUMS
  moonshine-streaming-small-es-onnx/  onnx/…  config.json  tokenizer.json …  LICENSE  SHA256SUMS
```

Each folder's `README.md` points back here. After upload, the catalogue gets the Cloudflare address and the sha256 from `SHA256SUMS`.
