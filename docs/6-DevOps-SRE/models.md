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
- **Engine use:** `CreateGameOptions.carregarKokoro` returns a `ModuloKokoro` (`fonemizar`, `vocabulario`, `voz`, `sessao`). The quiz
  demo's port: `app/js/consumer-quiz/kokoro-porta.ts` (testable half) and `kokoro-carregar.ts` (espeak-ng 1.0.2, GPL-3.0-or-later;
  onnxruntime-web 1.27.0, whose thread workers are pointed at its own `.mjs` with `env.wasm.wasmPaths`).
- **Rebuild:** upstream files, pinned by sha256 in `platform/kokoro.ts`.

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
  vosk-models/                        vosk-model-small-{pt-0.3,es-0.42,en-us-0.15}.tar.gz  SHA256SUMS
  moonshine-streaming-small-es-onnx/  onnx/…  config.json  tokenizer.json …  LICENSE  SHA256SUMS
```

Each folder's `README.md` points back here. After upload, the catalogue gets the Cloudflare address and the sha256 from `SHA256SUMS`.
