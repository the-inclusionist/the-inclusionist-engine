> Historical plan (2026-07-03): kept as a record; the current state lives in [`Art-Bible.md`](Art-Bible.md) and [`plano-arte-procedural.md`](plano-arte-procedural.md), and the level format belongs to `game-platformer` since ADR-0228.

# Study — Compatibility with Tiled (maps) and Aseprite (sprites)

The Dev's request on 2026-07-03: study making the game compatible with **Tiled** and **Aseprite** files before
moving on with the tilemap/engine. Research-first (sources at the end of each section). **No code
changed** — it is a study for a decision.

---

## A. Tiled (map editor) — VERDICT: do not adopt it as the format; keep the glyph text

Adopting Tiled as the format **would reverse** the decision locked today (the map as readable/diffable *ASCII art*) and
**breaks pillars** (no-build/lean/procedural). Details:

- **Formats:** JSON (`.tmj`) is the only one easy to read with no build (native `JSON.parse`); TMX=XML, CSV loses
  tilesets/objects, Lua useless. But all of them store `"data":[2,2,1,10,…]` (or XML) → **unreadable as art and with
  bad diffs** (inserting a column shifts every index). It is the opposite of your goal.
- **Pixi↔Tiled libs** (`@pixi/tilemap`, `pixi-tiledmap`): assume a **bundler + spritesheet + Pixi v8** → they break
  no-build/lean/our v7. If `.tmj` is ever read, the parser is **hand-written** (JSON, `encoding:"csv"`, no compression
  — ~20 lines, masking the flip flags `& ~0xE0000000`).
- **Procedural model:** Tiled is oriented to a *tileset image*; our game is *colour by type* (`TILE_COLOR`).
  Using it would require creating tileset PNGs (even placeholders) + `firstgid`→our type via a "Collection of
  Images" with `inclType` per tile. It duplicates the model. Key/gate/items would fit well in **object layers**.
- **The custom editor does NOT become obsolete** (for this game): the custom one reuses the same `parseLevel`/legend (a single
  truth), validates the **game's** rules (spawn, gate-without-key, unreachable regions) that Tiled does not know, and proves
  the engine's boundaries. Reconsider Tiled only as a **shared editor for the 35+ games**, in the future.
- **Licence:** the Tiled app is GPLv2+, but **exported files do not inherit it** (output ≠ derivative; the TMX spec is
  CC BY-SA). No conflict with our GPL-3.0.
- **Optional bridge (if you want Tiled's visual editing one day):** converters `text→.tmj` (opens in Tiled) and
  `.tmj→text` (rewrites the canonical one). The game **never** reads `.tmj`; the `.txt` stays the source in git. It is a
  disciplined variant of "Option A", not adoption of Tiled as the format.

**Recommendation A:** keep the **canonical glyph text** (`plano-editor-mapa.md`) and the **custom editor**. Tiled only
as an optional authoring converter, if and when wanted.

*Sources:* doc.mapeditor.org (JSON Map Format, Global Tile IDs, TMX, Editing Tilesets) · npm @pixi/tilemap ·
github riebel/pixi-tiledmap · gnu.org GPL-FAQ (output≠derivative).

---

## B. Aseprite (sprites/animation) — VERDICT: technically a great pipeline, BUT there is a pillar decision

The **PNG atlas + JSON** path is clean and advantageous, and the repo **already uses PNGs** (`game.js`: `SPR=`, `pngTex`,
`A('andar',8)` → ~40+ individual PNGs per character). Technically solved:

- **Export:** `aseprite -b menino.aseprite --sheet menino.png --data menino.json --format json-array
  --list-tags --filename-format '{tag}-{tagframe}'` (no `--trim` in v1 = keeps "feet on the line").
- **JSON:** `frames[]` (`frame{x,y,w,h}`, `duration` in **ms**, `spriteSourceSize`, `sourceSize`) +
  `meta.frameTags` (`name`,`from`,`to`,`direction`) = the animations + `meta.slices` (pivot/hitbox) +
  `meta.layers`.
- **PixiJS v7 loader (offline, no build):** the only non-native step is converting **`frameTags`→`animations`**
  (a `name→[keys]` dict, ~15 lines); `PIXI.Spritesheet` already understands the rest of the JSON. `BaseTexture` with
  `SCALE_MODES.NEAREST` **before** `parse()` (keeps pixel art). That is **2 files** (png+json) per character,
  cached in the SW.
- **Gains (they matter on weak target hardware = inclusion):** ~40 requests → **2**; N base textures → **1** →
  **WebGL batching** (fewer texture swaps); a simpler PWA cache.
- **Cadence:** keep the current `ANIM.*Hold` (holds in ticks) and only swap the textures' **source** — **zero
  regression** in timing, the `?debug` panel intact. Moving to per-frame durations (Aseprite's ms) is for
  later, inside the engine's animation subsystem.
- **Slices** → **feet pivot** (removes manual alignment); **layers** → **shape** variations (e.g. a
  **wheelchair** as a layer on top, synchronised by tag) — matches "shape=layer, colour=palette-swap".
- **Licence:** Aseprite is paid (EULA: just do not redistribute the *app*), but **the exported assets are yours** and the
  **format is open** → **no** implication for GPL-3.0 (we only read our own PNG+JSON; do not parse native `.aseprite`
  at runtime).
- **Fit into the engine:** a loader in `render/aseprite-loader.js`, called at the **async boot** already planned; the
  **entity** receives `{animations, anchor}` already parsed — it does not know it came from Aseprite (a change of source in
  the future does not affect it).

### ⚠️ The DECISION this forces (a CLAUDE.md pillar)
`CLAUDE.md` states **"art = data/algorithm; no embedded PNG (GPL-clean)"** and **parametric ASCII** as
the official direction of the art. But the game **already loads PNGs** (PixelLab, "current phase"), and the Aseprite atlas **consolidates the
PNG path** — contradicting the pillar. **"Adopting Aseprite" cannot happen without the Dev deciding consciously:**
does the PNG atlas become the **official source** (revising the pillar), or is Aseprite only an **authoring tool** while
the game moves towards art-as-data?

### a11y constraint (independent of the decision)
**High contrast** today generates a silhouette from the **ASCII/indexed** path (`silhouetteCanvasIdx`). The colour atlas
does **not** produce a silhouette on its own. So, whether or not Aseprite is adopted, the **ASCII/indexed path must be
preserved** as (a) the source of high contrast and (b) a fallback — or the silhouette is generated from the atlas's alpha at
load time. (a11y pillar, AAA — it must not regress.)

*Sources:* aseprite.org/docs/cli · dacap's gists (json-hash/array) · pixijs.com guides Spritesheets v7 ·
community.aseprite.org (frameTags→animations middleware; slices/pivot) · aseprite.org/faq + EULA (use of assets).

---

## C. Impact on earlier decisions
- **`plano-editor-mapa.md`:** confirmed — glyph text + custom editor stay. Tiled changes nothing (at most an
  optional future converter).
- **`../2-Architecture/plano-engine.md`:** the **Render** subsystem gains an `aseprite-loader.js` (if decision B is "adopt");
  the **Entities** subsystem consumes `animations`. **High contrast** ties down the ASCII/indexed path — the
  engine must keep it as a living subsystem, not a disposable one.
- **Public repo (GPL):** a side warning — the **provenance/licence of the current PNGs** (PixelLab) must be
  confirmed clean for the public repository, regardless of Aseprite. (Check before the 1st push.)

## D. Pending decisions (the Dev)
1. **Tiled:** confirm Recommendation A (canonical glyph text; Tiled only as an optional converter).
2. **Aseprite / direction of the art:** PNG atlas as the official source (revising the pillar) × authoring only (procedural direction)
   × postpone. (Independently: preserve the ASCII/indexed path of high contrast.)
