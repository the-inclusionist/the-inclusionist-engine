# Study — controlling a game with the microphone

> Issue #182 (the Dev's list of 2026-09-12, ADR-0151 §2 item 5: «configure microphone control (+ open)»). Written
> 2026-09-13, before any code, because the choice of recogniser is a decision about a child's voice (pillar 4) and about a
> school with no network (pillar 8). It becomes a record when the Dev chooses; nothing is built from it before that.

## What the transport is

The engine already names the voice as a transport (`input/transporte-em-uso`, ADR-0074, ADR-0113): once the camera or the
microphone is enabled, the move and hold latches become the law for every transport, because a spoken command cannot be
«held». The transport itself does not exist: nothing listens.

What «microphone control» has to do is small and closed: **hear one of the words the game names for its positions** —
«pular», «esquerda», «confirmar» — **and raise that position's edge**, in the page's language. It is not dictation. That
shape decides the comparison below: a recogniser restricted to a handful of words is far more accurate than one that
transcribes open speech.

## The constraints

| constraint | source | what it rules |
|---|---|---|
| a child's voice does not leave the device | pillar 4 (LGPD/COPPA), ADR-0103 | no cloud recogniser |
| works after the first day with no network | pillar 8 | the model is a heavy file of the delivery (ADR-0177) |
| school Chromebooks and Positivo laptops | pillar 1 | CPU, no GPU assumed |
| pt-BR, English, Spanish | pillar 3 | a model per language |

## The options, and what to expect of each

| option | runs where | offline | pt / es / en | restricted vocabulary | size | expected on school hardware |
|---|---|---|---|---|---|---|
| **A · Web Speech, cloud** (Chrome's default) | Google's servers | no | yes | no | 0 | ❌ excluded: the child's audio goes to a third party, and a school without network hears nothing |
| **B · Web Speech, on-device** (`processLocally: true`) | the browser | yes, after the browser installs a language pack | «17 languages» in Chrome, list not published in the sources read | not in the shipped API | ~60 MB per language pack, installed by the browser | ⚠️ Windows, Mac, Linux first; **ChromeOS «to follow»**; the pack is the browser's, not the delivery's — a school image may not have it |
| **C · Vosk in WASM** (`vosk-browser`) with a grammar | the page | yes | yes | **yes**: a phrase list; «improves recogniser speed and accuracy» | small models: pt 31 MB · es 39 MB · en 40 MB (Apache 2.0) | ✅ CPU only; ⚠️ small pt model WER 32.6 (Common Voice) and 68.9 (CORAA) for OPEN speech — a closed word list should do far better, not measured; `vosk-browser` last published four years ago |
| D · Whisper / Moonshine through transformers.js | the page | yes | multilingual | no grammar | tens of MB | not studied: transcribes open speech on CPU, slower per command, no closed vocabulary |

## What is not known, and has to be measured before any code

1. Whether `vosk-browser` 0.0.8 still loads in the Chrome the schools run, under the engine's CSP (`wasm-unsafe-eval`, a
   worker from the page's origin).
2. The small pt model's accuracy on a CLOSED list of four to eight Portuguese command words, spoken by children. No
   source measures it; the open-speech WER above is the ceiling of doubt, not the answer.
3. Whether each word the game names is in the model's lexicon: a grammar drops words the model does not know.
4. Whether ChromeOS ships on-device Web Speech, and which of its languages include pt-BR.

## Recommendation, for the Dev to decide

**C as the transport, B left out until ChromeOS ships it and publishes its languages.** C is the only option that keeps the
voice on the device, works offline from the delivery, runs on CPU and restricts recognition to the game's words. Its risk is
a library not maintained for four years and a Portuguese model measured poorly on open speech: the first work is the
measurement in the list above, with a go/no-go before building the transport.

## Sources

- Chrome on-device Web Speech: [explainer](https://github.com/WebAudio/web-speech-api/blob/main/explainers/on-device-speech-recognition.md),
  [Intent to Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/VNOok2dbmHM),
  [MDN `available()`](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static),
  [MDN `install()`](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/install_static)
- Vosk: [models and WER](https://alphacephei.com/vosk/models), [`vosk-browser` on npm](https://www.npmjs.com/package/vosk-browser),
  [model adaptation (grammars)](https://alphacephei.com/vosk/adaptation)
