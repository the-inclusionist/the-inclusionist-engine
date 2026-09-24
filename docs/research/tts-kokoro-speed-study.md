<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
Historical study (2026-07-07): kept as a record; the current state lives in `app/js/platform/tts.ts`, `app/js/platform/kokoro.ts` and ADR-0216 (the engine loads Kokoro on onnxruntime-web).

# Study — speeding up Kokoro fp32 in the browser (goal: RTF < 1)

**Motivation:** in the Dev's assessment, **Kokoro fp32 pt-BR (`pf_dora`/`pm_alex`/`pm_santa`) = 4.5/5**, the best sound — but
**RTF ~2.5** single-thread (slow). Piper faber-medium is 4/5 and RTF ~0.3 (fast). The project is **a11y-first** → do not lower the
quality bar; make Kokoro **fit** (RTF < 1). A study in rounds.

## Round 1 — the map of the options (done)

- **sherpa-onnx-wasm is CPU-only** — the build uses `-DSHERPA_ONNX_ENABLE_GPU=OFF` and the static ORT-wasm lib (CPU). So,
  **via sherpa** the only accelerators are **multi-thread (`numThreads`)** and **SIMD** (already on). No WebGPU.
- **WebGPU (onnxruntime-web) is the biggest gain** — Kokoro-82M on WebGPU runs at **RTF << 1** on any laptop with a GPU from the
  last ~5 years ([bench](https://quick-tts.com/blog/kokoro-webgpu-benchmarks.html)). But WebGPU is **not** in sherpa;
  it would be via `onnxruntime-web` (JSEP) + **our own pt-BR phonemisation** (ORT only runs the `.onnx`; we
  prepare the phoneme tokens — via espeak-ng, which we already have, or Misaki).
- **Multi-thread (sherpa CPU)** = a modest gain: `numThreads=4` should take RTF 2.5 → ~1 on a CPU with 4+ cores (to be measured).
  It needs `crossOriginIsolated` (COOP/COEP) + the **pthread** build (we already have it in `sherpa-wasm/tts/`).

## Avenues, ranked

| # | Approach | Expected gain | Cost | Target hardware (weak school machine) |
|---|---|---|---|---|
| **1** | **Pre-synthesis + cache** of the FINITE set of narration (phonemes, letters, syllables, common words, UI strings) — generate once (on 1st use/build), play from the cache | **RTF irrelevant** (instant playback), quality 4.5/5 | authoring/cache; only new text needs live synthesis | ✅ works on **any** hardware |
| **2** | **WebGPU** via onnxruntime-web (outside sherpa) + our own espeak phonemisation | **RTF << 1** (0.1–0.3) | port Kokoro's *frontend* (espeak→tokens); WebGPU only on Chrome 113+ with a GPU | ⚠️ an old Chromebook/Positivo may **not** have WebGPU |
| **3** | **Multi-thread** sherpa CPU (`numThreads=4` + pthread + COOP/COEP) | RTF 2.5 → ~1 (to be measured) | we already have the build; measure now | ⚠️ a weak CPU (2 cores) gains little |
| 4 | **fp16** model | marginal on WASM-CPU; helps on WebGPU | swap the model | — |

## Strategic reading (it matches ADR-0022 — tiered by hardware)

- **Baseline (weak hardware):** **Piper faber-medium** (RTF ~0.3 on the CPU, runs on everything). Already validated at 4/5.
- **Maximum quality:** **Kokoro fp32** — via **pre-synthesis** (option 1, works on everything) and/or **WebGPU** (option 2, good
  hardware). Pre-synthesis may make the speed problem **irrelevant** for literacy, whose vocabulary is
  **finite and small** (≈34 phonemes + letters + syllables + keywords).

## Round 2 — multi-thread (sherpa CPU) MEASURED = dead

`?engine=tts&threads=4` + `crossOriginIsolated=true` → Kokoro fp32 **RTF ~2.2** (it was ~2.5 single-thread). **Gain ~zero.**
sherpa-wasm-CPU does not parallelise Kokoro. **Avenue 3 discarded.** (Piper on the same machine: RTF ~0.25 — fast.)

## DECISION (Dev)

**Kokoro → `onnxruntime-web` (WebGPU); Piper stays on sherpa.** Priority: **make Kokoro fast first** (goal < 2 s,
ideal < 1 s); the **pt-BR phonemisation is a LATER step** (do not record phonemes, no pre-synthesis — that was cut). Also weighing
against Piper: **unpredictable** quality across models + **1 download per voice** (pt/en/es = ~3 GB), unfeasible.

## Round 3 — prove the speed on WebGPU (being tested)

`docs/research/kokoro-webgpu-lab.html`: runs Kokoro-82M via **kokoro-js (onnxruntime-web + WebGPU)** with an EN voice only to
**measure the RTF** (the language does not change the speed; pt-BR g2p comes later). If RTF < 1 → path proven.

## Next rounds

- **Round 2 (measure):** run `?engine=tts&threads=4` (sherpa CPU multi-thread) and note Kokoro fp32's real RTF —
  it decides whether option 3 alone gets close to 1.
- **Round 3 (WebGPU):** study/prototype Kokoro via `onnxruntime-web` + WebGPU + espeak phonemisation (option 2) — the biggest
  leap; check the token format the `model.onnx` expects (inputs `tokens`, `style`, `speed`) and how sherpa
  assembles the phonemes (source: `offline-tts-kokoro-*`).
- **Round 4 (pre-synthesis):** design the pre-generation + cache pipeline for the finite vocabulary (option 1) — the likely
  winner for the game.

Sources: [sherpa build (GPU OFF)](https://github.com/k2-fsa/sherpa-onnx/blob/master/build-wasm-simd-tts.sh) ·
[Kokoro WebGPU bench](https://quick-tts.com/blog/kokoro-webgpu-benchmarks.html) ·
[ORT-web WebGPU](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html) ·
[ORT-web numThreads](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html).
