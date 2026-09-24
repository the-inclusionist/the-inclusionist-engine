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
  ⚠️ **Mirrored since 2026-09-22** (issue #192), and the GPL obliges what follows: the project serves the WebAssembly build
  of `espeak-ng` 1.0.2 from its own bucket, under `espeak-ng-1.0.2/`, and the **matching source** is published beside it in
  the same folder (`espeak-ng-1.0.2/source/`). A binary served without its source would breach the licence, and a mirror is
  distribution.
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

> The voice's files are **downloaded once** — by the build into the delivery's `heavy/` folder, and from there into the
> device's cache — and run **100% locally** afterwards: no child's audio leaves the device. See ADR-0216 (the engine loads
> the voice), ADR-0198 and ADR-0207 in `the-inclusionist-docs · docs/2-Architecture/adr/`.

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
