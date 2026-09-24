> Historical plan (2026-07-03, amended 2026-09-09): kept as a record; the current state lives in [`Art-Bible.md`](Art-Bible.md).

# Plan — Semantic procedural art (semantic image + palette dictionary)

The Dev's request on 2026-07-03. It replaces the "PNG × procedural" dilemma: art becomes **semantic data** and the colours
live in a **separate palette dictionary**. Locked scope: **unified** — characters **and** tiles/world.
It fulfils the pillar "art = data / GPL-clean". Research-first (sources at the end). A study for a decision; no code.

## 1. Model (confirmed with the Dev)
- **Semantic image** (the asset): per pixel, **(region, luminosity)** — never a colour. `region` = what it is
  (skin, hair, shirt, trousers, metal, stone, water, outline…); `luminosity` = an ordered step shadow→light
  (+ the `outline` role). Nothing is flat: luminosity preserves volume/shading.
- **Palette dictionary** (separate, the game's): per region, a set of selectable **ramps** (e.g. light/medium/dark
  skin; N shirt colours; tile materials). A ramp = a colour per luminosity level.
- **Render**: `colour(pixel) = palette[ region's_chosen_variant ][ luminosity ]`. Same semantic image +
  different palettes → infinite recolour, with correct shading. Compatibility = only ramps of the same region.

## 2. References studied
- **Palette swap / indexed colour ramps** (NES/SNES; Slynyrd tutorials; Aseprite's indexed mode): recolouring
  by swapping the palette while keeping the indices — the classic basis of this.
- **Recolour by LUT/ramp in modern games** (e.g. *Dead Cells* — colour swap by HSV ramps; *Rain World* —
  procedural colour): separating **shape/shading** from **colour** is an established technique.
- **The seed in the repo itself:** `game.js` already has an indexed path — `PIP_PAL` (a 10-colour palette),
  `indexedToCanvas()` (index→canvas) and `silhouetteCanvasIdx()` (flat silhouette for high contrast). **This
  plan generalises that code** from "fixed palette" to "semantic (region+luminosity) + palette
  dictionary". It is not from scratch.

## 3. Format of the semantic data (the "semantic image")
Per asset, two channels per pixel: **regionId** (which region) + **lumLevel** (level on the ramp; a special value
= `outline`). Proposal:
- ~~**Readable/diffable storage**: a text grid where each cell is `region×luminosity`~~ —
  **the proposal of 03/07 fell on 09/09, and it fell by measurement.** It justified itself with the condition
  *«preferir texto/JSON indexado **enquanto os sprites são pequenos (24×32)**»* (prefer indexed text/JSON while the
  sprites are small), and that condition died on the day LPC came in through ADR-0133's bridge.
- **Animations**: several semantic images (frames) + tags (reuses Aseprite's `frameTags` on import).
- **Metadata**: size, anchor/feet (slice), list of regions used.

### 📏 THE MEASUREMENT OF 2026-09-09, and it decided three things at once

The real LPC sheets decoded (`sprite/character/Body/Base/Human_androgynous/Coffee/`), with a
dependency-free PNG reader:

| sheet | dimensions | bytes | opaque pixels | **unique colours** |
|---|---|---|---|---|
| `walk.png` | 576×256 | 30 724 | 41 923 | **11** |
| `thrust.png` | 576×256 | 28 785 | 41 700 | **14** |
| `hurt.png` | 448×64 | 21 528 | 8 621 | **10** |
| **the three together** | — | 81 037 | 92 244 | **15** |

**① The text grid is unworkable and the number is large.** 576×256 = 147 456 pixels; at two characters per
pixel, one sheet becomes **~295 KB of text** — almost ten times the 30 KB RGBA PNG it describes. And it is one
body's sheet, before hair, clothes and the other animations. 📌 What the grid protected was
**readability**, and nobody reads 147 thousand cells: readability is now provided by the editor, which draws, and
by a **text export for debugging** small assets.

**② 🎯 THE ANNOTATION IS A FIFTEEN-ROW TABLE.** Three whole sheets have fifteen unique colours between them — the
person does not paint pixels, they decide fifteen times. That is what makes the annotator viable, and it is the number that was
missing to know whether it was worth it.

**③ Zero partial alpha: all 92 244 opaque pixels have alpha of exactly 255.** The format's hard mask
stops being a restriction we impose and becomes what the source already is. ⚠️ And it is what keeps the browser's
**premultiplication** from corrupting the R and G channels, which is the form of corruption that fails silently.

📌 **And sorting by luminance works on this art**: the six most frequent colours go down 80 → 64 → 47 →
35 → 21 → 6, which is a clean body ramp. The automatic suggestion of §7 is not a hope.

### The format decided on 2026-09-09

**Two files per asset, one shared per game.**

- **`<name>.semantic.png`** — `R` = `regionId` (0 = nothing), `G` = `lumLevel` (one reserved value = `outline`),
  `B` = 0 reserved, `A` = **0 or 255 and nothing else**.
  ⚠️ **No colour management** (an `iCCP`/`gAMA` makes the browser transform the values and the indices stop being
  indices), **no partial alpha**, and **never resized or recompressed**. 📌 `tools/png-write.mjs` already
  writes exactly this — a dependency-free RGBA encoder, filter 0, no colour chunks. Reuse it.
- **`<name>.semantic.json`** — `regioes`, `niveis`, `quadros` (`{nome,x,y,w,h,pivo,duracaoMs}`), `animacoes`,
  `mapaDeCores` (the fifteen-row table the person decided) and `origem` — 🎯 the last with **the same fields
  as the `art/ATTRIBUTION.csv` row**, so that the ledger is GENERATED instead of written by hand.
- **`paletas.json`** — §4 below, unchanged: the game's and not the asset's.

⚠️ **The pivot lives in the JSON and not in a naming convention**, because ADR-0027 measured **fifteen distinct sizes**
of sprite and concluded that the atlas cannot assume a uniform grid. The measurement above confirms it on LPC's side:
`walk` is 576×256 and `hurt` is 448×64 — **the grid changes between sheets of the same character.**

## 4. Palette dictionary (separate)
- Structure: `region → { variants: { name: ramp[] } }`, where `ramp[lumLevel] = colour`. E.g.:
  `skin → { light:[…], medium:[…], dark:[…] }`, `shirt → { red:[…], blue:[…] }`,
  `stone → { grey:[…], moss:[…] }`.
- **Compatibility rules** built into the structure (a variant is only swapped WITHIN its region; fixed levels).
- **Outline** can be global (one colour) or per region (skin outline ≠ metal outline) — to decide.
- Lives as **game data** (not in the asset): `app/js/art/palettes.js` (or `.json`), precached.

## 5. Render engine (combining semantics + palette)
- **Compose a canvas** per (asset, palette combination) once and cache the `PIXI.Texture` (NEAREST) — as
  the current `indexedToCanvas` already does, except the source is the semantic image + the chosen variants. Recolour =
  recompose the canvas (cheap for small sprites) or, in the future, a **shader/LUT** (map (region,lum)→colour on the
  GPU) if many need to be swapped in real time.
- **Correct shading** comes for free: `lumLevel` indexes the ramp's step.
- **Perf (weak hardware = a pillar):** cache per combination; recompose only when the choice changes.

## 6. Import (the editor reads; the game does not)
Reuses the research of `plano-tiled-aseprite.md` — now as **import parsers**, not runtime:
- **png/jpg**: extracts the unique colours → a list for the human to annotate (colour→(region,luminosity)).
- **Aseprite / Libresprite** (Libresprite = a GPL fork, great for the pillar): reads PNG+JSON → frames + `frameTags`
  (animations) + the **indexed palette** (in indexed mode, the colour order already comes along — speeds up annotation).
- **Tiled / LDtk** (both JSON): imports the **tileset** (image) + the grid, to annotate tiles by material.
- The import produces the **semantic image** + suggestions (group by luminosity via HSV sorting of the colours).

## 7. Editor (`tools/`, standalone, no-build)
- Open a bitmap/animation (formats above) → **detected palette**.
- For each colour: choose the **region** (a dropdown of materials) + **luminosity** (a step, or "outline").
  Auto-suggestion: sort by luminance and propose levels; group similar colours.
- **Live preview**: apply dictionary variants (swap skin/clothes/material) and see the shading.
- **Save**: semantic image (+ frames/tags) in the §3 format. Validate: every colour annotated, coherent levels,
  outline present.
- Reuses `art/palettes.js` and the game's render engine (a single truth; it validates the engine's boundaries).

## 8. Fit into the engine (`../2-Architecture/plano-engine.md`)
- A new **Art/Material** subsystem (`art/`): `semantic.js` (format+parse), `palettes.js` (dictionary),
  `recolor.js` (composition engine). The **Render** subsystem consumes already-composed textures; the **Entities**
  ask for "character with skin=X, shirt=Y". **Tiles** likewise (material per type).
- **High contrast** = a special palette (flat + outline) applied by the same `recolor` → the
  duplicated path the Aseprite research pointed out disappears.
- Fits into the **async boot** (loads the dictionary + semantic images).

## 9. Delivery in steps (each one verifiable)
1. **Format + recolour engine** (`art/semantic.js` + `art/palettes.js` + `art/recolor.js`), proved on a
   small asset (e.g. the boy), producing the recoloured texture — no editor yet. Generalises `PIP_/indexedToCanvas`.
2. **High contrast via palette** (migrates `silhouetteCanvasIdx` to the new engine).
3. **Editor** `tools/`: import png/jpg + annotate + preview + save.
4. **Aseprite/Libresprite import** (frames+tags+indexed palette).
5. **Tiled/LDtk import** (tileset → tile materials) — joins with the glyph tilemap.
6. **Migrate the game's characters and tiles** to the semantic system; PNGs become authoring sources only.

## 10. Risks
- **Large scope (unified)** → deliver in the §9 steps; start with 1 character before generalising to tiles.
- **Laborious annotation** → auto-suggestion by luminance + importing Aseprite's indexed palette reduce the effort.
- **Recolour perf** → cache per combination; shader/LUT only if necessary.
- **Readability of the format** vs compactness → decide text/JSON vs data-PNG in the detailing (prefer
  readable while the sprites are small).
- **a11y must not regress** → high contrast becomes a palette; test early (step 2).

*Sources:* Aseprite (indexed mode / colour ramps; CLI docs, dacap's gists) · palette-swap/LUT techniques in
pixel art (Slynyrd ramps; palette-swap gamedev) · Libresprite (GPL fork of Aseprite) · LDtk/Tiled (JSON) ·
`plano-tiled-aseprite.md` (import parsers) · the seed in the repo (`PIP_PAL`/`indexedToCanvas`/`silhouetteCanvasIdx`).

---

## 11. Backlog of scenery themes — PAUSED until step 3 (was issue #14)

~20 scenery themes need art (Cave, Desert, Factory, Castle, …). 🛑 **Do not start a new theme** while
this plan's procedural pipeline is not ready: every theme drawn by hand before then is art that step
6 («migrar personagens e tiles para o sistema semântico») will have to redo.

⚠️ **This came from the issue tracker on 2026-09-09 (ADR-0126), and the issue's body said why without noticing:**
*«Tracked so it isn't lost»* — a thing tracked so it is not lost is a NOTE, not a problem. There was no
fix waiting; there was a wait. An issue with no fix has no commit to close it, and one nobody can
close teaches people to ignore the whole board.

📌 **What unlocks it is step 1 of this plan** (the recolour engine), and that is why it lives here and
not in the roadmap: whoever opens this file to build the pipeline is exactly who needs to know that there are
twenty themes waiting for them. **Each theme becomes an issue when it is buildable**, one per theme, with the palette and the
semantic image already decided.
⚠️ **Corrected on 2026-09-09:** this line said «etapa 3» (step 3) and called it «o motor de recolorização» (the recolour
engine). Per §9 the engine is **step 1**; step 3 is the editor. A wrong number here postponed twenty themes by two whole steps.
