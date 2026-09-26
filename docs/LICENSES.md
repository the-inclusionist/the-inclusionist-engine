# What governs what

This project has **two licences and a third regime**, and confusing them would be claiming a right one does not
have. This file says only **which rule reaches which thing**. The attributions are in
[`CREDITS.md`](CREDITS.md); the reasons, in the records cited on each line.

| what | regime | where it is decided |
|---|---|---|
| **Code** | **AGPL-3.0-or-later** | ADR-0064 · full text in [`../LICENSE`](../LICENSE) |
| **Own art** | **NOT FOSS** — the author's copyright, restricted use | ADR-0010 pillar 10 · `research/LICENSES-IMAGE-GENERATION.md` |
| **Third-party content** | the licence its author chose, preserved | the filing, request `g` |

---

## 1 · The code is AGPL-3.0-or-later

Every program in this repository. The `-or-later` is deliberate.

**Why AGPL and not GPL:** the GPL binds whoever **conveys**, and running a service is not conveying — section 0 of
the GPL itself separates `propagate` from `convey`. A supplier who took this code, improved it and hosted
the classroom as a service **would owe the source to nobody**. Section 13 of the AGPL closes exactly that, and it is
the argument the filing makes to the Município in item `e`. See **ADR-0064**.

⚠️ **Patrimonial ownership: the MUNICÍPIO, not the developer.** Software produced in the exercise of one's
duties belongs to the employer (Lei nº 9.609/1998, art. 4º), and that is why publication under the AGPL is
the object of a **request** in the filing — an act of the Executive Branch — and not a decision of whoever wrote the code.

⚠️ **And it is HERE that this ownership is stated, not in the package name.** The scope was `@pm-monte` to
carry that fact (ADR-0036); it became **`@the-inclusionist`** (**ADR-0071**), because a name is read by
people who will not open the repository, and a scope bearing the City Hall's name published by a civil servant **before the
act** is a public claim to someone else's name. The rule is the same as **ADR-0066 §2**: ownership is declared
INSIDE — in this file, in the `LICENSE` and in the records —, where whoever intends to use it reads.

## 2 · The art is NOT AGPL, and that is a decision, not an omission

A program is what **Lei nº 9.609/1998** defines. **Art follows Lei nº 9.610/1998** and belongs to whoever made it.
Extending the AGPL to the art would give more than the law asks **and** would dispose of someone else's right.

⚠️ **And there is a product reason, not only a legal one:** the requirement is that the characters **not** be free to
use — not appear in an adult product, for example. That is **incompatible with FOSS by construction**:
a free licence cannot restrict the field of use (freedom 0; criterion 6 of the OSI, "no discrimination against fields
of endeavor"). There is no art that is at the same time free and of restricted use. The choice was made with the
trade-off written down: **FOSS code + non-FOSS art**.

**The protection is a stack of three, from strongest to weakest** (`research/LICENSES-IMAGE-GENERATION.md`):

1. **Registered trademark** of the characters — name and signature design. It is the mainstay, because it bars use that causes
   confusion or dilution **regardless of copyright**. Selective: not every character is registered.
2. **Own art licence**, non-FOSS, over the art data and the composition algorithms.
3. **Human authorship in the procedural algorithm** — the more the human creates, selects and modifies (instead of
   just asking a generator), the stronger the copyright, and the more enforceable the licence (2).

⚠️ **And the caveat that orders the stack:** AI-derived art **may be uncopyrightable** — the US Copyright
Office has said so —, which can make licence (2) **unenforceable on its own**. That is why the trademark is
indispensable, and not an optional reinforcement. Written here because it is the point where the protection fails in
silence if nobody knows.

## 3 · Third-party content keeps the licence of whoever made it

Not everything here is ours, and what is not **does not change licence by being in this repository**. That is what
request `g` of the filing asks to be put on record: the itemized list of those elements and their licences.

- **Third-party code** — eSpeak NG (GPL-3.0). Clarity (MIT) left this repository with the platformer, and its
  credit travels with `game-platformer`; Piper and sherpa-onnx left (ADR-0207). Detail and attribution in
  [`CREDITS.md`](CREDITS.md).
  The engine itself loads the neural voice's runtime (ADR-0216): `espeak-ng` 1.0.2 (eSpeak NG in WebAssembly,
  **GPL-3.0-or-later**, compatible with the AGPL-3.0-or-later) and `onnxruntime-web` 1.27.0 (**MIT**) are catalogued
  heavy files (`app/js/platform/heavy-catalogue.ts`), fetched by the build into the delivery's `heavy/` folder and read
  from the page's own origin — only for a game that declares `uses: { neuralVoice: true }`. The published npm package
  carries neither. The other runtimes and models in the same catalogue, each credited in `CREDITS.md`:
  - **vision** — MediaPipe `@mediapipe/tasks-vision` 1.0.1 and its face, gesture and hand models: **Apache-2.0**;
  - **reading** — Whisper small (pt, exported here): **Apache-2.0**; Moonshine streaming small (en, and es exported
    here): **MIT**;
  - **commands** — the Vosk browser runtime built here from vosk-browser, vosk-api and Kaldi: **Apache-2.0**, with the
    BSD, Zlib and MIT parts its `NOTICE` lists; the Vosk small models (pt, en-us, es): **Apache-2.0**.
  - **Libras** — the Libras player deaf mode signs with (ADR-0234, route B), only in a delivery built with
    `inclusionist-heavy --libras`: one avatar and one clip per sign, which `scripts/libras-export.mjs` exports from LAViD's
    `vlibras-dictionary-sources` `.blend` files (**GPL-3.0**, pinned in `scripts/libras-export/sources.json`) — **GPL-3.0
    derivatives** whose Corresponding Source is those `.blend` files plus the two export scripts. The delivery carries them
    (`libras/avatar/`, pinned in `scripts/libras-avatar.json`) with the GPL-3.0 text and a NOTICE naming that source; the npm
    package carries none. **Nothing closed and nothing patched is served**: the VLibras Unity player of route A — Unity
    Technologies' proprietary runtime, with its `eval` rewritten at delivery time — was a declared, temporary exception, and
    it left the engine and the delivery in phase B3.
    The Libras **glosses** that delivery carries (`libras/avatar/glosses.json`) are made at build time by LAViD's
    `vlibras-translator` 1.3.3 (**LGPL-3.0**, rule-based mode only) over spaCy (**MIT**) and its Portuguese model
    `pt_core_news_md` 3.8.0 (**CC BY-SA 4.0**) — tools the build machine runs, **none of which is distributed**
    (`scripts/libras-glosses/`). Whether a gloss is a derivative of the model is **not determined**; the project believes it
    is not, which is not a legal opinion. See `CREDITS.md`.
    The player that draws the avatar runs on **three.js** 0.186.1 (**MIT**), the engine's one run-time npm `dependency`,
    pinned exactly and reached only by a dynamic `import()` at the first sign in deaf mode (ADR-0234 errata); the built chunk
    that carries it keeps three.js's `@license` headers (`CREDITS.md`).

  ⚠️ For most of these the project holds a statement of the licence, not its upstream text, and several copyright
  lines are marked **UNVERIFIED** in `CREDITS.md`, which says what each line rests on.
- **Voices** — only **Kokoro-82M** (Apache-2.0 weights trained on permissive audio; `CREDITS.md`). A voice enters when its licence
  AND its starting point's (the model it was fine-tuned from, and that model's data) have been read — that chain took the Piper
  voices out (ADR-0207, [`notices/2026-09-14-piper-voices-withdrawn.md`](notices/2026-09-14-piper-voices-withdrawn.md)).
- **Pictograms** — **none is used** (**ADR-0233**, replacing ADR-0028's roster): the only candidates are
  **ARASAAC** and **PCS**, each only once a licence is obtained, and no licence exists today. Both appear in the menu
  **locked, with the reason «no licence»**; a set with no recorded licence can never be selected
  (`tests/aac-sets.node.test.js`).
- **Typefaces** — roster and restrictions in **ADR-0012**. ⚠️ Ronde and the alternatives OPTIFrench-Script and
  Merveille are **free for personal use only and CANNOT be packaged**: a download is offered, and the
  option stays disabled when none of them is present.
- **Third-party art — THREE DOORS, and what decides is compatibility with the project** (**ADR-0133**), not the
  family a name belongs to. Four questions: may we **derive**? may it be used **commercially**?
  may we **convey** the file in what we publish? does anything **travel** from the source to our output?
  - **Door `licenca`** — a public licence already measured: **CC0 1.0**, **CC BY 3.0/4.0**, **OGA-BY 3.0/4.0**,
    and the permissive software licences (**MIT**, **Apache-2.0**) when the art carries one. ⚠️ OGA-BY **is not
    Creative Commons** — CC itself declares that it does not endorse it — and it is CC BY *minus* the restriction on
    technical measures, so strictly more permissive. 📌 A new name is not refused: it is **referred**, and
    comes in as soon as a record answers the four questions for it.
  - **Door `concessao`** — the author wrote the permission, with no known licence name. The ledger row
    keeps the **URL where the grant is written**, because a permission nobody can open is
    memory and not permission.
  - **Door `ponte`** — copyleft **CC BY-SA** comes in converted into **`GPL-3.0-only`** in our output. The
    mechanism is public and has three steps: CC BY-SA 3.0 §4(b)(ii) lets an **adaptation** go out as 4.0;
    Creative Commons declared GPLv3 one-way compatible on 2015-10-08; and **§13 of the GPLv3** allows
    combining a GPLv3 work with an AGPLv3 work into a single work. ⚠️ It requires a **modifiable source** — the semantic
    image plus the palette dictionary —, it is **one-way and permanent**, and it only opens for
    **adaptation**: no CC BY-SA file comes in as it is.
    🔴 **And that modifiable source DOES NOT EXIST YET.** The previous version of this line said it was something
    this project already maintains, and it was false: there is no `app/js/art/`, there is no semantic format and there is no editor. **As long as
    there is not, this door is described and not open** — the LPC does not come in. See `game-design/plan-procedural-art.md`.
  🔴 **And what has no door at all: ND** (forbids deriving, and recolouring is already deriving) and **NC** (it would make the
  art narrower than the CODE — the AGPL allows commercial use, and whoever it invites would be blocked by a
  sprite; and the NC boundary is undefined, with a municipal deployment sitting on it).
  📌 **There is no quarantine, and there was one.** ADR-0107 put the Liberated Pixel Cup behind a wall; the bridge
  replaces it, because the art that crosses it **stops being share-alike on our side** instead of staying
  walled off from the rest.
- **Third-party art — the admitted sources** (the Dev's decision, 2026-09-09; detail in
  [`../art/README.md`](../art/README.md)). They come in **before any of the project's own art**:
  **Kenney** (`kenney.nl/assets`, CC0 1.0, confirmed in three places) · **ansimuz** (`ansimuz.itch.io`,
  CC0 1.0 **per pack** — the profile grants nothing) · **Tiny Swords** (`pixelfrog-assets.itch.io`), which
  comes in **through both doors**: the file `TS_old version_CC0 Licensed` is CC0, and the **current pack** comes in
  through the author's **grant**, whose terms allow personal and commercial use and modification at will without
  requiring credit · and the **Liberated Pixel Cup** (`OpenGameArt/LiberatedPixelCup`), through the **bridge**, as an
  adaptation under `GPL-3.0-only`.
  **Which resources come in, and for which games, is art direction** and is not decided here.
  ⚠️ **Attribution is a condition of use, per resource**, and the **source is kept as a URL**: a licence declared
  by whoever hands us the file is a clue, not an authority, and without the recorded origin there is nothing to
  check it against. A resource with no known author **does not come in** — *I could not find out* is not a licence.

---

## 4 · Art inventory — for now, only the PixelLab art

ADR-0066 §3 puts this inventory among the conditions for any repository to become public, and §2 of this
page said it did not exist yet. It exists now, **with the scope the Dev gave it: only the art generated
in PixelLab.**

### What was generated, and where it is recorded

**100 generations**, from 2026-06-01 onwards, with date, tool, estimated cost and **the prompt of each one**:
[`research/pixellab-credits-audit.csv`](research/pixellab-credits-audit.csv). The prompt is there on
purpose — it is what lets someone from outside ask again *"where did this image come from?"* without depending on
anyone's memory.

### The regime, and the restriction that travels with it

According to the licence research (`research/LICENSES-IMAGE-GENERATION.md`), PixelLab.ai is the generator with the
cleanest terms of the survey: **the image belongs to whoever generated it**, commercial use is
allowed — to use, modify and distribute … for any purpose —, and **there is no attribution requirement**.

⚠️ **And there is ONE restriction, which is not ours and so we cannot waive it: the images may not be used
to TRAIN A MODEL.** That matters here for two concrete reasons:

1. This project's art **is not FOSS** (§2), so the own art licence is ours to write — and it
   has to **carry this restriction forward**, or we would grant third parties more than we received.
2. The declared target is **semantic procedural art** (`game-design/plan-procedural-art.md`): semantic image + palettes.
   If one day that generation goes through a model trained on the assets themselves, this line is the one that says it
   may not.

### What this inventory does NOT cover, and why

**OWN ART DOES NOT EXIST.** It is not that it is outside the inventory — there is none to inventory, and that is
why this section covers only PixelLab.

The Dev starts producing it **after the Município accepts the whole arrangement**: the code under **AGPL-3.0** and the
art under **a suitable CC licence**. As long as that acceptance is not documented, there is no own art and
nothing to license.

⚠️ **And art does not go to the AGPL — it goes to CC.** The AGPL is a licence for a PROGRAM (Lei 9.609); art is a work under Lei
9.610 and its usual instrument is Creative Commons. It is written here because the previous version of this
paragraph raised, as if it were an open question, the hypothesis of own art becoming AGPL. It was not a
question: it was an error, about something that does not exist yet.

**Which CC** is a choice for when there is art to license, and not before. §2 of this page stands as
it is: it describes the regime of the art that EXISTS today.

---

## What this file does NOT do

- **It is not a legal opinion.** It is the scope statement a reader needs so as not to assume that the root AGPL
  reaches everything. Where there is an intellectual-property doubt, the source is the Procuradoria (the municipal attorney's office) — which the filing
  calls on in request `c`.
- **It does not replace `CREDITS.md`**, which is where attribution lives. A duplicated fact rots.
- **It does not list the own art piece by piece** — and now that is SCOPE and not omission: §4 inventories the
  PixelLab art and says, in the same section, why the own art has not come in yet.
