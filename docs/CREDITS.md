# Credits and third-party attributions

The code of **The Inclusionist** is AGPL-3.0-or-later. The third-party parts below keep their own licences.

## Clarity — Adam Brooks (dissimulate) — MIT

The **platform mechanics** started from the **Clarity** project, by Adam Brooks (dissimulate), under the
**MIT** licence. The **map** (`clarity.map.txt`, named in its honour) was **heavily adapted** from
Clarity's level — with surgical layout changes and a change of meaning of several tiles — it is not a
copy, but a derived work. The attribution below covers the original portion.

⚠️ **Neither the mechanics nor the map are in this repository any more.** They left with the platformer
(the cartridge's departure, issue #111) and live in `game-platformer`, whose credits carry this attribution;
the engine published from here contains no code derived from Clarity. The credit stays here as the record of
where the project's platform code came from.

- Code: https://github.com/dissimulate/Clarity
- Playable: https://codepen.io/dissimulate/pen/AGYEby

Text of the MIT licence (applicable to the portions derived from Clarity):

```
MIT License

Copyright (c) Adam Brooks (dissimulate)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

> Note: confirm the exact copyright year/line in the `LICENSE` of the Clarity repository and align it here before
> any formal distribution. MIT is compatible with AGPL-3.0 (the MIT portions keep their notice; the whole is AGPL-3.0).

## Neural voice (TTS) — until 2026-09-14: Piper and sherpa-onnx (WITHDRAWN)

🔴 **The Piper voices left the engine on 2026-09-14** (ADR-0207, issue #193) — see the public notice
[`notices/2026-09-14-piper-voices-withdrawn.md`](notices/2026-09-14-piper-voices-withdrawn.md). `pt_BR-faber-medium`,
`en_US-amy-medium` and `en_US-ryan-medium` start from the `lessac` voice («Finetuned from U.S. English lessac voice», in their
`MODEL_CARD`s), trained on the **Blizzard 2013** dataset (CSTR, University of Edinburgh), whose licence limits use to research and
forbids distributing the materials; `es_MX-claude-high` states no starting checkpoint. We could not show a licence for what the project
does with them.

Credit follows what was used. Until that date neural narration relied on:

- **[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)** (Next-gen Kaldi / k2-fsa, **Apache-2.0**) — in the TTS lab; thanks to
  **Fangjun Kuang** ([@csukuangfj](https://github.com/csukuangfj)), who packaged Piper voices in the sherpa format.
- **[Piper](https://github.com/rhasspy/piper)** (Michael Hansen / rhasspy, **MIT**) and the `@mintplex-labs/piper-tts-web` runtime (MIT).
- **[eSpeak NG](https://github.com/espeak-ng/espeak-ng)** (**GPL-3.0**) — the voices' phonemization (`piper_phonemize`).
  ⚠️ **Staged for the mirror on 2026-09-22 and ON HOLD** (issue #192): the WebAssembly build of `espeak-ng` 1.0.2 sits in
  `the-inclusionist-lfs/espeak-ng-1.0.2/`, but the **matching source** the GPL requires beside it (`espeak-ng-1.0.2/source/`)
  has not been staged, so the upload script skips the folder. A binary served without its source would breach the licence,
  and a mirror is distribution. What `source/` needs is written in that folder's `LICENSE.md`.
- **The voices and their dataset licences**, read on 2026-09-14: `pt_BR-faber-medium` (NabuCasa/voice-datasets, CC0),
  `es_MX-claude-high` (HirCoir/Piper-TTS-Spanish, Apache-2.0), `en_US-amy-medium` (MycroftAI/mimic3-voices, «See URL»),
  `en_US-ryan-medium` (roholazandie/ryanspeech, CC BY-NC-SA 4.0). The Dev's answer on Ryan — «nosso projeto não tem fins
  lucrativos» — met its non-commercial clause; the `lessac` chain is what took them out.

## Kokoro-82M — hexgrad — Apache-2.0

The weights are **Apache-2.0** (`huggingface.co/hexgrad/Kokoro-82M`), trained only on permissive audio — among it, **CC BY**
audio: **Koniwa** (CC BY 3.0) and **SIWIS** (CC BY 4.0), credited here. The ONNX export used is `onnx-community/Kokoro-82M-v1.0-ONNX`.

What speaks it, fetched by the engine beside the model: **[eSpeak NG](https://github.com/espeak-ng/espeak-ng)**
(`espeak-ng` 1.0.2, **GPL-3.0-or-later**) turns the sentence into phonemes, and
**[ONNX Runtime Web](https://github.com/microsoft/onnxruntime)** (`onnxruntime-web` 1.27.0, **MIT**, Microsoft) runs the graph.

- **Kokoro-82M** (catalogue `voz:kokoro:*`: the fp32 model, the tokenizer and one style table per voice) — **Apache-2.0**.
  Licence statement and NOTICE: `the-inclusionist-lfs/kokoro-82m-v1.0-onnx/LICENSE.md` and `NOTICE.md`; the Apache-2.0 text
  itself is upstream (`huggingface.co/hexgrad/Kokoro-82M`), not held in that folder.
- **eSpeak NG in WebAssembly** (catalogue `voz:runtime:fonemas*`: `espeak-ng.js` and `espeak-ng.wasm` from the npm package
  `espeak-ng` 1.0.2, built by the `ianmarmour/espeak-ng.js` repository) — **GPL-3.0-or-later**, as its `package.json`
  declares. The package carries the GPL-3.0 text (`LICENSE`) and no copyright line of its own; the eSpeak NG revision the
  build was made from is not stated in the package. The source obligation is the one written under Piper above.
- **ONNX Runtime Web** (catalogue `voz:runtime:onnx*`: `ort.webgpu.bundle.min.mjs` and the `ort-wasm-simd-threaded.jsep` pair)
  — **MIT**. The bundle's own header: «Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT
  License.» Mirror notice: `the-inclusionist-lfs/onnxruntime-web-1.27.0/LICENSE.md`; the MIT text itself is upstream
  (`github.com/microsoft/onnxruntime`), not held in that folder or in the npm package.

> The voice's files are **downloaded once** — by the build into the delivery's `heavy/` folder, and from there into the
> device's cache — and run **100% locally** afterwards: no child's audio leaves the device. See ADR-0216 (the engine loads
> the voice), ADR-0198 and ADR-0207 in `the-inclusionist-docs · docs/2-Architecture/adr/`.

## The other runtimes and models the engine downloads

Every file below is listed in `app/js/platform/heavy-catalogue.ts` with its address and sha256, fetched by the build into the
delivery's `heavy/` folder (or from the project's mirror, `the-inclusionist-lfs/`, with the same bytes) and run on the device.
The published npm package carries none of them. How each one is used and rebuilt: `docs/6-DevOps-SRE/models.md`.

⚠️ **What the licence lines rest on.** Only the Vosk runtime's folder holds the upstream licence text and NOTICE. The other
folders hold a `LICENSE.md` the project wrote from the upstream page it read, not the upstream text: the
licence is stated, and the copyright line an MIT or Apache-2.0 notice carries is, where marked **UNVERIFIED**, not held
anywhere in this project yet.

## MediaPipe tasks-vision and its face, gesture and hand models — Google — Apache-2.0

The eye, face and hand control (`platform/vision`; catalogue `visao:*`): the `@mediapipe/tasks-vision` 1.0.1 runtime
(`vision_bundle.mjs`, `vision_wasm_internal.js`, `vision_wasm_internal.wasm`, from jsDelivr) and the float16 **Face
Landmarker**, **Gesture Recognizer** and **Hand Landmarker** models (`storage.googleapis.com/mediapipe-models`).

- **Licence:** `Apache-2.0`, as stated in `the-inclusionist-lfs/mediapipe-tasks-vision-1.0.1/LICENSE.md` and in ADR-0203's
  erratum (the runtime, and the face model card with its blendshapes).
- **Copyright line: UNVERIFIED.** The runtime files carry no licence header, the `.task` bundles carry no licence file, and the
  package is not installed here. The Apache-2.0 text lives upstream, with the MediaPipe project.
- ⚠️ **The hand and gesture model cards were not read** (the mirror's `LICENSE.md` says so; issue #192). Their terms are
  UNVERIFIED until they are.

## Whisper small — OpenAI — Apache-2.0

The Portuguese reading model (catalogue `reading:pt:*`): `openai/whisper-small`, **exported to ONNX and quantized by this
project** (`scripts/models/export-whisper-small.py`), with the upstream tokenizer, configuration and mel filterbank copied
unchanged. The export was made here because the ready-made `onnx-community/whisper-small` states no licence of its own.

- **Licence:** `Apache-2.0`, as stated in `the-inclusionist-lfs/whisper-small-onnx/LICENSE.md` and in ADR-0203's erratum.
- **Copyright line: UNVERIFIED** — not held locally. The Apache-2.0 text lives upstream (`huggingface.co/openai/whisper-small`).
- The ONNX files are a derivative work (converted and quantized); `whisper-small-onnx/README.md` says what was changed.

## Moonshine streaming small — Useful Sensors / Moonshine AI — MIT

The English and Spanish reading models (catalogue `reading:en:*`, `reading:es:*`):

- **English:** the ONNX export `Workmind/moonshine-streaming-small-ONNX` (base model `UsefulSensors/moonshine-streaming-small`),
  copied unchanged. Licence `MIT`, as the export declares (`license: mit`), read on 2026-09-18 and stated in
  `the-inclusionist-lfs/moonshine-streaming-small-onnx/LICENSE.md`.
- **Spanish:** `moonshine-ai/moonshine-streaming-small-es` at revision `8cb0974f29ca24d6b645518c430efc8c57cd0073`, **exported to
  ONNX by this project** (`scripts/models/export-moonshine-streaming-es.py`; the decoders quantized to q8). Licence `MIT`, as the
  upstream model declares, stated in `the-inclusionist-lfs/moonshine-streaming-small-es-onnx/LICENSE.md`.
- **Copyright line: UNVERIFIED** for both. MIT requires its copyright notice and permission notice to travel with every copy,
  and neither folder holds that text yet; it lives upstream, on each model's Hugging Face page.

## Vosk for the browser — vosk-browser, vosk-api and Kaldi — Apache-2.0

The command runtime (catalogue `commands:runtime*`: `vosk.wasm.js`, `vosk.worker.js`, `vosk.wasm`), **built by this project**
(`scripts/models/build-vosk-browser.ps1`) from `lichess-org/vosk-browser` `50a6347` and `alphacep/vosk-api` `d714dff`, with one
change: the link flag `-s DYNAMIC_EXECUTION=0` (`scripts/models/vosk-browser-dynamic-execution.patch`), so it runs under the
engine's Content-Security-Policy.

- **Licence:** `Apache-2.0`. The full text is `the-inclusionist-lfs/vosk-browser-dynamic-execution-0/LICENSE`, and the attribution
  notices are that folder's `NOTICE`, which opens:

  ```
  Vosk-Browser
  Copyright 2020-2022 Ciaran O'Reilly

  The Initial Developer of the the WASM bindings
  (https://github.com/dtreskunov/tiny-kaldi) for the VOSK API is Denis
  Treskunov (https://github.com/dtreskunov).
  Copyright 2020, Denis Treskunov

  The Developer of the VOSK API (https://github.com/alphacep/vosk-api) is
  Alpha Cephei Inc (https://alphacephei.com/en/).
  Copyright 2019-2022 Alpha Cephei Inc. All Rights Reserved.
  ```

- **What the binary also contains**, each with its notice in the same `NOTICE`: **Kaldi** (Apache-2.0, per-file authors listed
  there), **OpenFst** (Apache-2.0, Copyright 2005-2010 Google, Inc.), **CLAPACK** (BSD-3-Clause, Copyright (c) 1992-2008 The
  University of Tennessee), **clapack-wasm** (Apache-2.0, INRIA), **zlib** (Zlib), **libarchive** (BSD-2-Clause) and
  **Emscripten and musl** (MIT). The `NOTICE` is the full list and its text governs; this page only points at it.

## Vosk small models — Alpha Cephei — Apache-2.0

The command models (catalogue `commands:model:*`): `vosk-model-small-pt-0.3`, `vosk-model-small-en-us-0.15` and
`vosk-model-small-es-0.42`, **repacked unchanged** from alphacephei's zips into the `.tar.gz` vosk-browser loads
(`scripts/models/repack-vosk-models.py`).

- **Licence:** `Apache-2.0`, as stated in `the-inclusionist-lfs/vosk-models/LICENSE.md` (from `alphacephei.com/vosk/models`).
  ⚠️ **The archives themselves state no licence**: their `README`s carry only a copyright line, and the Apache-2.0 text is not
  held locally.
- **Copyright lines, as each archive's `README` states them:** en-us 0.15 «Copyright 2020 Alpha Cephei Inc»; es 0.42
  «Copyright 2022-2050 AC Technologies LLC»; pt 0.3 **none** (its `README` says only what the model is).

## VLibras player — `spbgovbr-vlibras/vlibras-web-browsers` — LGPL-3.0 declared, Unity runtime closed

The avatar deaf mode's interpreter drives (ADR-0234, route A; catalogue `libras:player:*`): `unity-loader.js`,
`playerweb.wasm.framework.unityweb`, `playerweb.wasm.code.unityweb` and `playerweb.data.unityweb` from the repository's
`public/unity/` at commit `9d093f259ac732d755a19e80cd03c8233c70435d`. Fetched by the build only with
`inclusionist-heavy --libras`, and served to the child from the delivery's own origin.

- **Licence:** the repository declares **LGPL-3.0**. The `LICENSE` a delivery writes beside the files is the LGPL-3.0 text
  followed by the GPL-3.0 text it incorporates; the LGPL text was copied from LAViD's `vlibras-translator` 1.3.3 distribution,
  not from this repository, whose own `LICENSE` file was not downloaded.
- ⚠️ **What that licence does not cover, as far as this project knows:** the files are a **Unity 2018 WebGL build**. The wasm,
  the framework JavaScript and the data file contain **Unity Technologies' proprietary runtime**; no corresponding source is
  published, and the terms under which it may be redistributed have **not been determined**. The project carries it as a
  declared, temporary exception until a free player (route B) replaces it.
- **Changed by this project:** `playerweb.framework.noeval.js`, generated at delivery time from the framework file, whose
  sha256 is checked first: decompressed, its one `eval(str)` replaced by a parser of plain calls with JSON arguments, so the
  player runs under a Content-Security-Policy without `'unsafe-eval'` (`scripts/vlibras-player.mjs`).
- **Copyright line: UNVERIFIED** — the four files carry none, and nothing of the repository beyond their metadata and its
  declared licence was read.

## VLibras translator — LAViD-UFPB `vlibras-translator` 1.3.3 — LGPL-3.0 — BUILD TIME ONLY

What turns the Portuguese a child is shown into the Libras glosses the player signs (ADR-0234, route A; plan item 5b):
`inclusionist-heavy --libras` runs it once, on the build machine, over the engine's Portuguese dictionary and the game's
(`scripts/libras-glosses.mjs`, `scripts/libras-glosses/gloss.py`), in its **rule-based mode only** — the neural mode fetches a
model that declares no licence, and is never asked for. Published on test.pypi.org only; pinned with its hashes in
`scripts/libras-glosses/uv.lock`.

- **Licence:** **LGPL-3.0**, the `LICENSE` in its 1.3.3 source distribution (the same text `scripts/licences/LGPL-3.0.txt` holds).
- **Distributed: none of it.** It runs in an environment outside the repository and nothing of it enters a delivery or the npm
  package; what a delivery carries is its OUTPUT, `libras/player/glosses.json`.
- **Copyright line** as its sources state it: «Copyright (c) Laboratório de Aplicações de Vídeo Digital - LAViD».

## VLibras sign bundles — LAViD-UFPB `vlibras-dictionary-sources` — GPL-3.0

The signs the avatar plays (ADR-0234, route A): Unity 2018.3.1 WebGL AssetBundles from the repository's
`FILES/BUNDLES/2018.3.1/WEBGL/BR/` at commit `f8ddb378affd0d6da42f04c9fc888dafe1cc1299`
(`gitlab.lavid.ufpb.br/vlibras-public/vlibras-dictionary/vlibras-dictionary-sources`, the same bytes the dictionary host
`dicionario2.vlibras.gov.br` serves). Only the signs the engine's own glosses use: **632 files, 15,086,780 bytes**, each pinned
by sha256 and byte count in `scripts/libras-signs.json`. Fetched by the build only with `inclusionist-heavy --libras`, a byte
that differs from the pin refused, and served to the child from the delivery's own origin (`libras/signs/`). Downloaded with
the Dev's permission («Autorizo»); none is committed to this repository.

- **Licence:** the repository declares **GPL-3.0**. A delivery writes the GPL-3.0 text (`LICENSE`) and a `NOTICE` naming the
  pinned source beside the signs.
- **Corresponding source:** the `.blend` files of the same repository, at the same commit.
- **Changed by this project:** nothing — the files are carried byte for byte.
- **Copyright line: UNVERIFIED** — the bundles carry none, and the repository's own `LICENSE` and README were not read.

## spaCy and its Portuguese model `pt_core_news_md` 3.8.0 — MIT and CC BY-SA 4.0 — BUILD TIME ONLY

The Portuguese pipeline the translator's rules read (part of speech, morphology, dependencies, entities): spaCy 3.8 (Explosion,
**MIT**) and the model `pt_core_news_md` 3.8.0 (Explosion, **CC BY-SA 4.0**, from the GitHub release of `explosion/spacy-models`),
both pinned in `scripts/libras-glosses/uv.lock` with the other Python packages they pull.

- **Distributed: none of it** — build time only, outside the repository, like the translator.
- ⚠️ **Whether a gloss the model helped produce is a derivative of the model** (and so under CC BY-SA 4.0) is **not determined**;
  this project believes it is not, and that is not a legal opinion. The glosses a delivery writes say what made them
  (`"made"` in `glosses.json`).

## Arrow icons — Lucide, derived from Feather (Cole Bemis) — MIT

The eye control draws four arrows over the game (`app/js/ui/gaze-overlay.ts`): Lucide's `arrow-up`, `arrow-right`, `arrow-down` and
`arrow-left` (lucide.dev). Lucide is ISC, but its LICENSE lists these four among the icons derived from the Feather project, which carry
Feather's MIT notice:

> The MIT License (MIT) (for the icons listed above)
>
> Copyright (c) 2013-present Cole Bemis
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the
> "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish,
> distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to
> the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
> MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR
> ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH
> THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Imported art — through the three doors of ADR-0133

The attribution of art that comes from outside is **per resource**, and so it does not fit on this page as prose: the
authorship of a collection is read resource by resource, and the chain of derivations with it.

**It lives in [`../art/ATTRIBUTION.csv`](../art/ATTRIBUTION.csv)** — path, author, **source URL**, door, licence,
delivery and which resources each one derived from. It is the same shape `LICENSES.md` §4 already uses for the 100
PixelLab generations: a tabular file beside the prose pointer, because a ledger that grows with the catalogue cannot be
kept by hand.

⚠️ **Attribution here is a condition of use, not a credit line.** Most of the admitted licences require it, and a
resource with no known author **does not come in** — *I could not find out* is not a licence. The gate
`tests/art-licences-accepted.node.test.js` fails the empty entry, the orphan entry, the resource with no entry, the source
with no URL, a row with no valid door, and ND and NC, refused by name with the reason for each, which
[`LICENSES.md`](LICENSES.md) §3 and **ADR-0133** explain. A licence name not yet measured is referred, not refused, and
share-alike comes in only through the bridge, converted to `GPL-3.0-only`.

📌 **There is no quarantine, and there was one.** Until 2026-09-09 the Liberated Pixel Cup was to come in under CC BY-SA 3.0
behind a wall (ADR-0107). ADR-0133 replaced the wall with the bridge: art whose copyleft would travel comes in only as an
adaptation under `GPL-3.0-only`, and the bridge stays closed while the modifiable source it requires does not exist.

**Today the ledger is empty** — no resource has ever come in.
