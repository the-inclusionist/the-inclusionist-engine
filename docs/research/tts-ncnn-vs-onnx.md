<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
Historical study (2026-07-06): kept as a record; the current state lives in `app/js/platform/tts.ts` (Web Speech first per ADR-0200, the Kokoro fallback on onnxruntime-web per ADR-0216).

# Why ONNX and not NCNN for the neural TTS (study)

It justifies the choice of the **ONNX** runtime (via sherpa-onnx-wasm) instead of **NCNN** (via sherpa-ncnn), decided in
**[ADR-0022](https://github.com/the-inclusionist/the-inclusionist-docs/blob/main/docs/2-Architecture/adr/ADR-0022-tts-sherpa-onnx-wasm-runtime.yaml)**.

## What the study confirmed

The hypothesis was: **NCNN is more focused on STT/ASR and has less variety in high fidelity.** The study **confirms** it.
A technical detail worth recording (so as not to get future decisions wrong): **sherpa-ncnn** *technically* also runs
vits-piper TTS and WASM ([repo](https://github.com/k2-fsa/sherpa-ncnn)) — that is, it does TTS —, but NCNN's **project
focus** is lean inference on ARM/embedded, and the **TTS ecosystem** there is much smaller. So the decision for ONNX
rests on variety + fidelity + WASM maturity (below), exactly along the lines of what you pointed out.

## Why ONNX anyway (the reasons that count)

| Criterion | ONNX (sherpa-onnx) | NCNN (sherpa-ncnn) | Wins |
|---|---|---|---|
| **Voice ecosystem** | **7 TTS families** (VITS/Piper, Matcha, **Kokoro**, Kitten, ZipVoice, PocketTTS, Supertonic), 80+ languages; csukuangfj publishes **~50 vits-piper voices** + multi-language Kokoro **already in ONNX** | A **much smaller** TTS zoo; few voices pre-converted to NCNN — we would have to **convert and host** each one | **ONNX** |
| **Fidelity / expressiveness** | fp32/fp16, good fidelity; compute to spare in the browser | Optimised for **low-power ARM** (Android/iOS/Raspberry Pi), aggressive quantisation → focus on size/latency, not on high fidelity | **ONNX** |
| **WASM maturity** | **ONNX Runtime Web** (Microsoft) is mature; sherpa-onnx-wasm TTS is documented, with HF Spaces + already **validated in our lab** | WASM exists, but the TTS-in-WASM path is **less proven/documented** | **ONNX** |
| **The runtime's design target** | generic (server, desktop, browser) | shines on **native embedded/mobile** (tiny binary, ARM SIMD, no deps) — an advantage that **does not translate** to the browser, where the model download + the WASM runtime dominate | **ONNX** (for the browser) |

## Conclusion

Our target is **the client's browser (WASM)**, and the metric that matters is the **variety + fidelity of the voices**
available **ready-made**. The voices we want (all of Kuang's pt/en/es vits-piper + multi-language Kokoro) exist **in
ONNX**; in NCNN it would be conversion/hosting work to gain, in the browser, an advantage (a lean ARM binary) that
is not our bottleneck. NCNN's real advantage — running on very weak hardware (ARM/RPi) — can be reassessed **if and
when** the target is a native embedded app; for the PWA in the browser, **ONNX wins**.

Sources: [sherpa-ncnn (repo)](https://github.com/k2-fsa/sherpa-ncnn) · [sherpa-onnx TTS (DeepWiki)](https://deepwiki.com/k2-fsa/sherpa-onnx/3.2-text-to-speech-(tts)) · [voice catalogue](https://k2-fsa.github.io/sherpa/onnx/tts/all/).
