# Models — what each one does, how the engine uses it, and how to rebuild it

> The engine's voice, recognition and vision models, one section each: **role**, **where it comes from**, **how the engine uses
> it**, **how to rebuild it from zero**, and **how to check it**. Decisions: ADR-0190, ADR-0193, ADR-0194, ADR-0197, ADR-0198,
> ADR-0200, ADR-0201, ADR-0202, ADR-0203, ADR-0207 (all in `the-inclusionist-docs`). Issues: #181, #184, #185, #189, #190, #193.

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

Every heavy file is in `app/js/platform/pesados-catalogo.ts` with its upstream address and sha256. The **build** fetches it into the
delivery (`npx inclusionist-pesados dist`, `--kokoro` for a game that fills the Kokoro port); the page asks for it at
`pesados/<host><path>` on its own origin and the service worker answers from the checked cache.

Files **the project builds** (the Vosk worker and wasm, the repacked Vosk models, the Spanish Moonshine ONNX) have no upstream: they
are staged in `the-inclusionist-lfs/` (one folder per artefact, laid out as its future Hugging Face repository, with `SHA256SUMS`),
uploaded by the Dev to the project's **Cloudflare**, and move to **Hugging Face** after the city's permission. The catalogue names the
Cloudflare address until then; the sha256 never changes with the move.

Third-party files the licence lets the project mirror (ADR-0203 erratum, issue #192) are staged the same way, unchanged, with their
licence and notice: `kokoro-82m-v1.0-onnx/` (Apache-2.0, credits the CC BY training audio; ⚠️ 2 of the 34 voices so far) and
`mediapipe-tasks-vision-1.0.1/` (Apache-2.0: the runtime and the face, gesture and hand models). Their sha256 are the catalogue's.

---

## Kokoro — TTS fallback, through the game's port

- **What:** `onnx-community/Kokoro-82M-v1.0-ONNX`, fp32 `onnx/model.onnx` (325 532 232 bytes), `tokenizer.json`, 34 voice tables
  (pt, es, en-US, en-GB). Apache-2.0.
- **Engine use:** `CreateGameOptions.carregarKokoro` returns a `ModuloKokoro` (`fonemizar`, `vocabulario`, `voz`, `sessao`). The quiz
  demo's port: `app/js/consumer-quiz/kokoro-porta.ts` (testable half) and `kokoro-carregar.ts` (espeak-ng 1.0.2, GPL-3.0-or-later;
  onnxruntime-web 1.27.0, whose thread workers are pointed at its own `.mjs` with `env.wasm.wasmPaths`).
- **Rebuild:** upstream files, pinned by sha256 in `platform/kokoro.ts`.

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
