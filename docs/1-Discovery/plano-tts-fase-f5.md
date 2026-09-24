> Historical plan (2026-06-30): kept as a record; the Piper voices it chose were withdrawn on 2026-09-14 (ADR-0207, `docs/notices/2026-09-14-piper-voices-withdrawn.md`), and the current voice is Kokoro-82M — see `docs/6-DevOps-SRE/models.md`.

# Phase F5 — Neural TTS (research + integration plan)

Research **before coding** (the Dev). Sources at the end. Conclusions marked ⚠️ must be re-confirmed against the repositories at integration time.

## 🔴 Critical finding: only Piper really has pt-BR
| Engine | pt-BR? | Size (onnx) | Speed on a weak CPU | Licence | Browser lib |
|---|---|---|---|---|---|
| **Piper** | ✅ **Yes** (`pt_BR-faber-medium` male; community: "Razo", "edresson") | low ~20 MB · medium ~60 MB | **Fast** (near real time; built for CPU) | **piper1-gpl = GPLv3** (matches our GPL-3.0); phonemizer **espeak-ng = GPLv3** | `@mintplex-labs/piper-tts-web` / `piper-tts-web` (ONNX Runtime Web + WASM) |
| **Kitten** | ❌ **No** (English only — voices Bella/Jasper/Bruno…) | < 25 MB (15 M params) | Very fast | Apache-2.0 | transformers.js / ONNX (e.g. kitten-tts-web-demo) |
| **Kokoro-82M** | ⚠️ **Doubtful in the browser** (the ONNX build is focused on US/UK English) | q8 ~86 MB · fp32 ~326 MB | **Slow** on weak hardware (runs on an RPi, but slowly) | Apache-2.0 (model) · kokoro-js MIT | `kokoro-js` (transformers.js) |

**Consequence:** for the **game in pt-BR**, **Piper is the only viable engine today**. **Kitten** (English, tiny, fast) and **Kokoro** (quality, slow) only serve the **i18n builds in other languages** (Nordic/English portfolio — the i18n pillar), **not** pt-BR. Your "Piper primary" choice is correct; **Kitten/Kokoro stop being secondary/option for pt-BR** and become options **per language**.

## Integration path (recommended)
1. **Engine:** **`OHF-Voice/piper1-gpl`** (keeps the GPLv3 licence aligned with the game) via **ONNX Runtime Web (WASM)**. The **espeak-ng** phonemizer compiled to WASM (used **only for phonemes** — espeak's robotic audio is **not** used; what generates the voice is Piper's VITS model).
2. **pt-BR voice:** `pt_BR-faber-medium` (check the voice's own licence) or train/adopt a female one (female pt-BR voices are missing — issue open in the repo).
3. **Pipeline:** text → (espeak-ng WASM) phonemes → (Piper ONNX) PCM → `AudioBufferSourceNode` → the mixer's **`tts` category** (F1) → master node. It reuses the whole bus.
4. **Cache/offline:** the model (~20–60 MB) needs to stay **cached** (Cache API/OPFS) after the 1st load.

## Decisions (closed with the Dev)
- **D1 — Hosting:** ✅ **Lazy fetch from a CDN (HuggingFace) on 1st use + cache** (Cache API/OPFS). Accepts the internet **once**; offline afterwards. (Future ideal: mirror it on the school's LAN server so that the 1st use is offline too — leave the URL configurable.)
- **D2 — WASM threads:** ONNX Runtime Web speeds up with **SIMD + multithreading** (which require **COOP/COEP**). If the deploy does not send the headers, it falls back to **single-thread** (slower). Confirm at deploy; start assuming single-thread and switch threads on if available.
- **D3 — Voice:** ✅ **Faber (male) now**; architecture ready to **offer both** (voice selection) when a quality **female pt-BR** voice appears.
- **D4 — i18n:** Kitten/Kokoro stay **only** for builds in other languages; pt-BR = Piper.

## Expected results (to validate on the target hardware)
| Metric | Expectation | How to measure |
|---|---|---|
| 1st load (download + WASM init) | a few seconds (LAN) to tens (CDN/3G) | `performance.now()` at init |
| Latency per utterance (Piper-low, Positivo) | **~real time** to ~1.5× | time between `speak()` and the 1st sound |
| Kokoro latency (if used, other languages) | **seconds** per sentence | same |
| Offline cache | 2nd session with no network speaks normally | test offline |
| RAM | model + runtime fit in the tablet | monitor |

## Next step (once D1–D4 are decided)
F5 becomes: (1) a `tts.speak(texto)` layer with engine selection **per language** (pt-BR→Piper); (2) **lazy** loading of the runtime+model (from the place decided in D1); (3) narration hooks (coins left, events, menu) in the `tts` category; (4) TTS toggle **independent of captions**; (5) **test on a real Positivo**.

## Sources
- Piper browser: [Mintplex-Labs/piper-tts-web](https://github.com/Mintplex-Labs/piper-tts-web) · [npm @mintplex-labs/piper-tts-web](https://www.npmjs.com/package/@mintplex-labs/piper-tts-web) · [piper-tts-web-demo](https://github.com/clowerweb/piper-tts-web-demo) · [rhasspy/piper #352 (browser)](https://github.com/rhasspy/piper/issues/352)
- Piper GPL + voices: [OHF-Voice/piper1-gpl VOICES](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/VOICES.md) · [pt_BR faber (HF)](https://huggingface.co/Trelis/piper-pt-br-faber-medium) · [Razo pt-BR (HF)](https://huggingface.co/Lucasllfs/Razo-piper-voice) · [samples](https://rhasspy.github.io/piper-samples/) · [female pt-BR voice issue](https://github.com/rhasspy/piper/issues/766)
- Kitten: [KittenML/KittenTTS](https://github.com/KittenML/KittenTTS) · [Kitten in the browser (WASM/ONNX)](https://dev.to/soasme/running-kittentts-in-the-browser-a-deep-dive-into-wasm-and-onnx-18hk) · [kitten-tts-web-demo](https://github.com/clowerweb/kitten-tts-web-demo)
- Kokoro: [kokoro-js (Xenova)](https://huggingface.co/posts/Xenova/503648859052804) · [Kokoro-82M-ONNX (sizes/languages)](https://huggingface.co/onnx-community/Kokoro-82M-ONNX) · [Kokoro on a Raspberry Pi (slow)](https://mikeesto.com/posts/kokoro-82m-pi/)
