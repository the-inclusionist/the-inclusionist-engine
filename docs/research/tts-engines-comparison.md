<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# TTS engine comparison — pt-BR · en · es (research-first table)

**Goal:** pick the neural TTS engine(s) for The Inclusionist's narration, plus the always-available
fallbacks, for the three languages that matter now: **Portuguese (pt-BR), English, Spanish**.

**Method:** this is the *expected-results table* (research-first, per CLAUDE.md §4). The empirical
half — responsiveness (time-to-first-audio) and how each engine handles the five literacy tasks
(phonemes · spelling letters · spelling syllables · isolated words · sentences) — is measured in the
companion **[sherpa-lab](./sherpa-lab.html)** (the CDN-only `tts-engine-lab.html` was removed — YAGNI — once the runtime settled on sherpa-onnx-wasm).

> Sizes are **approximate** and per *quantization/quality tier*; the lab reports the real bytes each
> engine downloads on your machine. Confirm empirically before committing to one.

## Comparison

| Engine | Type | Download | pt-BR voices | en voices | es voices | Offline | Quality | Role |
|---|---|---|---|---|---|---|---|---|
| **Web Speech API** | Native OS voices | **0** | OS-dependent | OS-dependent | OS-dependent | ⚠️ not guaranteed (some browsers synth in the cloud) | Good but **inconsistent per device** | **Fallback** (zero-download) |
| **eSpeak NG** | Formant synth (WASM) | **~2–4 MB** | 1 (formant) | 1 | 1 | ✅ embedded | Robotic but intelligible; **great for isolated phonemes** | **Fallback** (embedded) + phoneme reference |
| **Piper** | Neural VITS (ONNX) | **~20 MB** (low) · **~63 MB** (medium) *per voice* | **2** (`edresson-low`, `faber-medium`) | ~20+ (US/GB) | ~5 (ES/MX) | ✅ after 1st download (OPFS) | Natural, solid | **Primary candidate** (already wired) |
| **Kokoro-82M** | Neural (StyleTTS2-like) | **~80 MB** (q8) | **0 in the browser lib** ⚠️ | many (`a*`/`b*`) | 0 in lib | ✅ after 1st download | Excellent (English) | **OUT for pt/es** — `kokoro-js@1.2.1` ships **English voices only** |
| **KittenTTS** | Neural (tiny) | ~15–25 MB (int8) … ~80 MB | **0** | 8 (4M/4F) | **0** | ✅ | Decent for the size | **English-only today → not usable for pt/es** |

### Reading the table for our case
- **pt-BR is the priority**, and only **Piper** and **Kokoro** ship real neural pt-BR voices.
  **KittenTTS is English-only** — out for pt/es (revisit if a multilingual release lands).
- **Piper** = smallest per-voice footprint and *already integrated* (`@mintplex-labs/piper-tts-web`,
  ADR-0021). Downside: one model file *per voice per language* (~20–63 MB each).
- **Kokoro** = one ~80 MB model covers **all three languages** — better if we want pt+en+es without
  three separate downloads, at the cost of heavier per-utterance compute (WebGPU recommended).
- **eSpeak NG + Web Speech** are the fallbacks: eSpeak is tiny + embedded + fully offline (ideal for
  the *phoneme* drills where robotic clarity actually helps); Web Speech is zero-download but not a
  guaranteed-offline or consistent-quality baseline.

## Empirical findings so far (browser lab, pt-BR)

- **Kokoro-js & KittenTTS are English-only in the browser** → both out for pt-BR. (Kokoro's error listed only `af_*/am_*/bf_*/bm_*` voices.)
- **Piper (`@mintplex-labs/piper-tts-web`) knows exactly 2 pt-BR voices** — `edresson-low`, `faber-medium` (+ `pt_PT-tugão`). Its `PATH_MAP` is fixed and `HF_BASE` (rhasspy/piper-voices) is hardcoded, so community voices such as `dii-high` / `miro-high` (csukuangfj re-hosts) **cannot** be loaded by this lib.
  - `edresson-low`: unusable — **dropped**.
  - `faber-medium`: standard-BR accent on **sentences** (good); a slightly "Angolan" accent on isolated letters/syllables/words.
  - `pt_PT-tugão-medium`: European Portuguese + audible hiss — wrong accent for BR.
- **eSpeak**: the npm `mespeak` ships only CommonJS source (no browser bundle) → must be imported via **esm.sh** to run in the browser.

**Tightened recommendation:** isolated **phonemes/letters/syllables → eSpeak**; **words + sentences → Piper `faber-medium`** (its weak spot is exactly the isolated-token layers we hand to eSpeak). Higher-quality pt-BR voices (`dii-high` / `miro-high`) would need a different runtime — see the open question at the end.

## Phoneme input — can each engine speak a *sound* (/k/, /f/, /a/) instead of a letter name?

This is the crux for **alfabetização**: the "phonemes" drill must speak the *sound*, not the letter
name. From the docs:

| Engine | Phoneme input? | How |
|---|---|---|
| **Web Speech** | ❌ **No** | The API takes **plain text only**; SSML/`<phoneme>` is not in the spec — Chrome strips it or reads the tags literally. Best you can do is pseudo-spelling. |
| **eSpeak NG** | ✅ **Yes (native)** | Phonemes in **`[[…]]`** using **Kirshenbaum** ASCII-IPA, e.g. `[[k]]`, `[[h@'loU]]`; stressed syllable marked with `'`. **This is the engine for the phoneme drill.** |
| **Piper** | ⚠️ Indirect only | Phonemizes text via espeak-ng internally, but `@mintplex-labs/piper-tts-web` exposes only `predict(text)` — no raw-phoneme entry. Reads isolated letters/phonemes poorly (it is sentence-trained). |
| **Kokoro** | ❌ Not via the JS lib | `kokoro-js` documents **text input only**; no phoneme option. |

**Implication (matches the playtest):** the neural engines (Piper/Kokoro) are for **words and
sentences**, where they sound natural — they are the *wrong* tool for isolated phonemes and even for
spelling letters/syllables (Web Speech said "bê-á" for *ba*, "i" for *ê*; Piper read letters with a
strange low-volume accent). The **phoneme + spell-letter + spell-syllable** layers should be
**eSpeak** (tiny, offline, deterministic, real phoneme input). Reserve neural TTS for words/sentences.

> The lab's "Fonemas" row now holds **Kirshenbaum** tokens in `[[…]]`; eSpeak speaks them as true
> phonemes, while the other engines get the brackets stripped and read the tokens as text — which is
> exactly the limitation, made visible.

## Sources
- Phoneme input: [MDN SpeechSynthesisUtterance.text](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/text),
  [MDN compat #15663 (SSML not universal)](https://github.com/mdn/browser-compat-data/issues/15663),
  [espeak-ng Kirshenbaum phonemes](https://github.com/espeak-ng/espeak-ng/blob/master/docs/phonemes/kirshenbaum.md),
  [espeak phonemes reference](https://espeak.sourceforge.net/phonemes.html), [kokoro-js (npm)](https://www.npmjs.com/package/kokoro-js).
- KittenTTS — size (<25 MB), 8 voices, English focus: [KittenML/KittenTTS (GitHub)](https://github.com/KittenML/KittenTTS),
  [kitten-tts-nano-0.1 (Hugging Face)](https://huggingface.co/KittenML/kitten-tts-nano-0.1),
  [Show HN: Kitten TTS – 25MB CPU-Only](https://news.ycombinator.com/item?id=44807868).
- On-device TTS landscape: [The 6 Best On-Device TTS Models — GetStream](https://getstream.io/blog/best-on-device-tts-models/).
- Piper voice IDs (pt/en/es) — from the installed lib's type surface (`@mintplex-labs/piper-tts-web`)
  and the upstream [piper voices catalog](https://huggingface.co/rhasspy/piper-voices).
- Kokoro — model card & voice list: [onnx-community/Kokoro-82M-v1.0-ONNX (Hugging Face)](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX).

*(Web search was partially unavailable during this pass; Piper/Kokoro sizes and voice counts are from
the installed lib + model cards + prior knowledge and are marked approximate. The lab confirms them.)*
