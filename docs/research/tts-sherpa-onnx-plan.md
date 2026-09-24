<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
Historical plan (2026-07-06, superseded 2026-09-09): kept as a record; the current state lives in `app/js/platform/tts.ts` (Web Speech first per ADR-0200, the Kokoro fallback loaded by the engine per ADR-0216).

# Neural TTS on sherpa-onnx-wasm — integration plan

> 🛑 **SUPERSEDED ON 2026-09-09 — DO NOT BUILD FROM THIS.** The runtime is **piper**
> (`@mintplex-labs/piper-tts-web`), owned by the engine — **ADR-0127**, which supersedes ADR-0065 §1 and with
> it the sherpa adoption this plan was written for. [Today: piper is no longer a dependency in `package.json`; the engine speaks with Web Speech first (ADR-0200) and falls back to Kokoro on onnxruntime-web (ADR-0216).]
>
> 🔴 **AND THE PREMISE BELOW WAS MEASURED FALSE.** This document called the alternative «discontinued», and no
> version of `@mintplex-labs/piper-tts-web` carries a `deprecated` field — 1.0.5 shipped on 2026-08-11, after
> ADR-0022 declared it dead, and the installed 1.0.4 carries 118 voices including the four ADR-0110
> guarantees. That single word travelled from here into five other places by being read rather than measured.
>
> 📌 **The research is kept rather than deleted**, because ADR-0127 names what would bring sherpa back: the
> mintplex package actually being deprecated, a locale piper cannot serve, or its hard-wired Hugging Face host
> blocking a school mirror the deployment needs. If any of those happens, this plan is the head start — and
> its numbers will need re-measuring, because they are from July.

Runtime originally decided in **ADR-0022** (now superseded whole by ADR-0065, whose §1 is superseded in part
by ADR-0127): run VITS/Piper `.onnx` in the browser via **sherpa-onnx compiled to WebAssembly** (k2-fsa).

## Target voices (pt-BR, from k2-fsa `tts-models`)

| Voice | Tier | Use | Source |
|---|---|---|---|
| **`vits-piper-pt_BR-miro-high`** | high | primary (words + sentences) | k2-fsa releases `tts-models` |
| **`vits-piper-pt_BR-faber-medium`** | medium | fallback / A-B | idem |
| **`vits-piper-pt_BR-jeff-medium`** | medium | A-B (male voice) | idem |
| ~~`pt_BR-edresson-low`~~ | low | dropped (unusable) | — |
| ~~`pt_BR-dii-high`~~ | high | **pt-PT accent**, not BR | — |

> There is **no `dora-high` for pt-BR** (that name is Kokoro-only). The pt-BR *high* VITS/Piper voice is **`miro-high`**.
> Each bundle (`.tar.bz2`) contains `model.onnx`, `tokens.txt` and an `espeak-ng-data/` dir (phonemization).
> Download: `https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/<name>.tar.bz2`
> Samples to pre-audition: <https://k2-fsa.github.io/sherpa/onnx/tts/all/> (Portuguese).

### High-end tier (better hardware only) — Kokoro multi-lang via sherpa
Sherpa-onnx also runs **Kokoro multilingual** (pt-BR voices `pb_dora` / `pb_alex`). Files:
`kokoro-multi-lang-v1_0.onnx` (**~340 MB**) + `voices.bin` + `tokens.txt` + `dataDir`. Sherpa config key is `kokoro:
{model, voices, tokens, dataDir}` (vs `vits:{…}` for Piper). **Tiered by hardware** (ADR-0022): VITS/Piper is the
baseline for weak school machines; Kokoro is an **opt-in upgrade** for better devices — the universal loader treats it as
just another config row. Whether the target hardware can actually run either is itself pending a device test.

## Two build approaches (Dev's call — needs Node/Emscripten)

**A — `js-tts-wrapper` (`SherpaOnnxWasmTTSClient`), model baked at build time**
- A provided Node script downloads the WASM + one voice and bakes them into `public/sherpaonnx-wasm/{tts.js,.wasm,.data}`.
- Pros: fastest to a working demo; less glue. Cons: **one voice per `.data`** (A-B/high voices = multiple builds or a big `.data`); less runtime flexibility. Docs: <https://github.com/willwade/js-tts-wrapper/blob/main/docs/sherpaonnx-wasm.md>.

**B — raw sherpa-wasm engine + runtime model loading (the "universal loader")** ← matches the Dev's intent
- Build sherpa-onnx-wasm **without a baked model** (engine + `espeak-ng-data` only). At runtime, per chosen voice:
  `fetch(onnxUrl) → ArrayBuffer → Uint8Array → Module.FS.writeFile('/model.onnx', bytes)` (also `tokens.txt`), then
  `new OfflineTts({ model:'/model.onnx', tokens:'/tokens.txt', dataDir:'/espeak-ng-data' })` → `tts.generate(text)`.
- Pros: **any voice from any CORS URL**, switch at runtime, no rebuild to add a voice. Cons: more glue; must host the
  raw `.onnx`+`.json`+`tokens.txt` un-tarred (a build step un-packs the `.tar.bz2` once and hosts the files with
  `Access-Control-Allow-Origin: *`).

**Recommendation:** start with **B** for the *engine* (so voice/host stay free — the whole point), but reuse
`js-tts-wrapper` if its client already exposes runtime `mergedModelsUrl`/URL loading (it hints at it) to save glue.

## How it lands in the game (Vite + Dev build + PWA)

1. **Assets:** the sherpa `tts.js`/`.wasm`/`.data` (+ `espeak-ng-data`) live under `app/` (served by Vite, emitted to
   `dist/`). The Dev runs the build script once; the artifacts are committed or generated in CI (decide in impl).
2. **Models:** un-tarred `.onnx`+`tokens.txt`(+`voices.bin`/`dataDir` for Kokoro) hosted on **Cloudflare R2** (CORS `*`) —
   **not HF** (HF lacks raw-file bandwidth). **Lazy-fetch** (nothing bundled): eSpeak/Web Speech talk during the download,
   then cache in **OPFS/Cache API** → offline afterwards. Weights fetch once, then 100% local; disclosed to schools.
3. **`platform/tts.ts` rewrite:** replace the `@mintplex-labs` dynamic import with the sherpa client. Keep the closure-DI
   shape, the mixer gate, and the Web Speech immediate fallback. **Route by content type** (the layered decision):
   - phoneme → **pre-recorded/spliced human clips** (~34 pt-BR) — NOT eSpeak (rejected: robotic) and NOT live TTS
     (Piper/sherpa can't voice isolated phonemes; SSML `<phoneme>` is stripped; only a `lexicon.txt` hack exists). Duolingo
     does audio-splicing (speak a word, cut the target sound). Authoring-time.
   - spell-letter · spell-syllable · words · sentences → **sherpa** (Piper faber/miro; reads letters/syllables fine),
   - not-yet-loaded / failure → **Web Speech**.
4. **PWA:** `vite-plugin-pwa` must cache the WASM + `espeak-ng-data` (precache) and the model (runtime cache) so the 2nd
   launch is offline. Add a size budget note (WASM+data+model ≈ tens of MB).

## Decisions locked (Dev, this round)
- **Approach = B** (universal loader): engine build sans baked model; voices become a config/JSON table (add a voice = a
  data change). "The game engine becomes a generic audio player."
- **Hosting = Cloudflare R2** (CORS `*`) — HF can't serve raw files at bandwidth.
- **Default = lazy-fetch**, no bundled voice; eSpeak (+ Web Speech) cover the download gap, then per-device we see whether
  Piper/Kokoro actually runs on the target hardware.
- **Keep** the standalone lab AND keep eSpeak + Web Speech as fallbacks (browser-inconsistent/dated, but zero-download
  and occasionally the only thing that works).

## MVP voice scope (Dev)
- **MVP:** get **Piper faber + miro** and **Kokoro pb_alex + pb_dora** all working in `sherpa-lab.html`.
- **Post-MVP:** the **10 Piper + 10 Kokoro** custom-timbre track (train new voices — fills the pt-BR female gap).

## Testing status (`sherpa-lab.html`)
- The Dev **self-built** the WASM (mock 0-byte trick → light engine-only `.data`). Artifacts are ES modules — the page
  imports the factory + `createOfflineTts`.
- **SINGLE-THREAD decided.** The first pthread build needed COOP/COEP (`crossOriginIsolated`) for `SharedArrayBuffer` —
  and that isolation **broke cross-origin caching of the weights in the Service Worker** (offline dead + "failed to fetch"
  on voice-switch). Fix = build **single-threaded** (drop `-pthread`/`-sPTHREAD_POOL_SIZE`), which removes COOP/COEP
  entirely; also the right call for the game (site-wide COEP would break other cross-origin resources). `serve.json`
  deleted. Trade-off: slightly higher RTF single-threaded — measure in the lab (weak-hardware target may have few cores anyway).
- **PWA persistence:** the lab uses a Service Worker (`sw.js`) cache-first on engine + weights — the same mechanism the
  game will use (vite-plugin-pwa). Weights carry a download timestamp (localStorage) so the lab shows "já em cache há X".
- **Playtest findings (TTS ≠ text reader):** models hallucinate on non-text. `ff`→"éfe éfe" (ok); **`/f/` (slashes) →
  the PHONEME /f/** (useful!) but too fast for a child; alphabet with commas → rushed/garbled; without commas → correct.
  ⇒ prosody/speed matter a lot; the phoneme layer wants `/x/`-style input at a slow `lengthScale`, or recorded/spliced clips.
- The CDN-only `tts-engine-lab.html` was **deleted** (YAGNI). Neural A-B now lives in `sherpa-lab.html` (~50 vits-piper
  voices, split into **medium / high** blocks so the user picks by hardware; RTF per synthesis).
- **RTF measured (Dev hardware, single-thread):** **Piper faber-medium ≈ 0.28–0.34** (sub-second — the winner: fast,
  good, 63 MB); miro/dii-high ≈ 0.30 (miro-high had audible hiss once). **Kokoro fp32 ≈ 2.5**, **int8 ≈ 5.6**.
  ⇒ Piper leads decisively on speed; Kokoro is ~8× slower single-thread and its quality edge is **not yet confirmed**.
- **Kokoro int8 = dead end (removed).** Root cause confirmed: it's an **onnxruntime-web (WASM) limitation**, not our bug —
  in the WASM backend int8 quantized models produce **silent/wrong output** AND run **~3× slower than fp32** (matches the
  measured int8 RTF 5.6 > fp32 2.5). So "fixing" it is pointless (no speed win). Use **fp32**; speed comes from
  **multi-thread**, not int8. Refs: [ONNX quantization docs](https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html),
  [Adrian Lyjak — quantizing Kokoro to ONNX](https://www.adrianlyjak.com/p/onnx/).
- **"Green but no sound" fixed:** the ~10 s synchronous Kokoro synth staled the click gesture → a freshly-created
  AudioContext was autoplay-blocked. Use one persistent AudioContext, warmed on the click.
- **Two AI mis-attributions corrected:** (1) the earlier "Piper ≈ 0.78, that's the single-thread price" was WRONG — that
  was a **cold first-inference** (ORT graph-opt + arena warmup on a model's first synth); single-thread Piper's steady
  state is ~0.3. The genuinely slow one is Kokoro (8× heavier). (2) the sudden "high-model hiss / AM-radio" was **my
  volume normalization** (peak-gain up to 4×) amplifying the models' noise floor — capped it to 1.4×.
- **`tts/` is the ready multi-thread build** (not the old faber build): `.data` = 18 MB mock+espeak, `Module["FS"]`
  exported, has the pthread `.worker.js`. So multi-thread needs **no rebuild** — serve + open `?engine=tts&threads=4`.
- **Multi-thread IS viable (earlier COEP blame was wrong):** MDN — cross-origin **CORS** fetches are NOT blocked by COEP
  (HF sends `ACAO:*`), and `COEP: credentialless` (Chrome) gives `crossOriginIsolated` without CORP. Lever = **pthread
  build + `numThreads>1` + COOP/COEP** (I had `numThreads:1`). Lab now takes `?engine=tts-multi-thread&threads=4`.
  Production: host models same-origin/R2 → `require-corp` works; Safari lacks credentialless.
- **Kokoro phoneme input = Misaki G2P** (not espeak `[[...]]`): forcing phonemes uses Misaki syntax / `[brackets]`
  (hexgrad/misaki, jaggzh/kokoro-tts `--phonemes`, `kokoro-phonemize`). BUT sherpa's Kokoro uses **espeak** (`has_espeak=1`,
  our `lang`), not Misaki — so the Misaki `[bracket]` trick may not apply through sherpa; revisit if Kokoro is chosen.
- **Nothing validated until a passing user test.**

## Still open
- How the sherpa WASM + `espeak-ng-data` ship in Vite/`dist` and get precached for PWA/offline (+ single-thread vs COOP/COEP).
- **Kokoro in the lab (working setup, hard-won):** use the **int8** repo `csukuangfj/kokoro-int8-multi-lang-v1_0`
  (`model.int8.onnx` ~114 MB + `voices.bin` ~28 MB + `tokens.txt`); reuse the build's baked `espeak-ng-data` as `dataDir`.
  - A **multi-lang** Kokoro (version ≥ 2) **ABORTS with `exit(-1)`** unless you pass `--kokoro-lang` OR `--kokoro-lexicon`
    (source: `offline-tts-kokoro-impl.h::InitFrontend`). For pt-BR set `lang: 'pt-br'` (the espeak-ng code — verified: the
    Piper pt_BR configs use `"espeak":{"voice":"pt-br"}`); es → `'es'`, en → `'en-us'`. `lang` bakes into the session, so
    **one OfflineTts per language**; switching sid within a language reuses it.
  - Real speaker **sids** (from the model's own `id2speaker`, NOT the earlier wrong 38/39): pt-BR **`pf_dora`=42 (F)**,
    **`pm_alex`=43 (M)**, **`pm_santa`=44 (M)**; es **`ef_dora`=28**, **`em_alex`=29**; en `af_heart`=3, `am_adam`=11 (…53 total).
  - Debugging tip that unlocked this: sherpa logs the abort reason via **`console.error`** (not Emscripten `printErr`);
    the lab now mirrors `console.*` into its on-page Log.
- **FS must be exported** in the wasm build (`EXPORTED_RUNTIME_METHODS` += `FS`) — the default build omits it (models are
  meant to be baked in `.data`), which is why runtime `FS.writeFile` (Approach B) failed with `Module.FS undefined`.
