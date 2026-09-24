> Historical plan (2026-07-03): kept as a record; the current state lives in the `game-platformer` repository, which owns the tile table and the level format since ADR-0228 (`tools/map-editor.html` is still in this tree).

# Plan — Text map format (1 glyph/tile) + map editor

The Dev's request on 2026-07-03: maps in **plain text, 1 character per tile**, chosen so that the file,
opened in an editor, **looks like ASCII art**. It replaces the current `CLARITY_MAP` (an array of 1–2-digit numbers —
types 10–14 break the column alignment). Locked decision: **meaningful glyphs** (not alphanumeric
codes). The editor is a dev tool → it lives in `tools/` (outside `app/`).

## 1. References studied (what the established formats do)
- **Roguelike ASCII maps** (NetHack, libtcod, Brogue): 1 char/tile, mnemonic glyphs (`#` wall, `.`
  floor, `+` door, `~` water). It is the proof that "text = readable map" has worked for decades. → our target.
- **PICO-8 / TIC-80**: the map as a grid of indexed tiles; editing through a built-in visual editor. Lesson: **visual
  editor + simple data** is the flow that works for whoever authors levels.
- **Tiled (TMX/CSV format)**: the industry standard; exports CSV of indices or XML. Powerful, but **heavy and
  unreadable as art** (numeric indices). Good for inspiring the *parser*, not the human-reading format.
- **Sokoban level format (.sok/XSB)**: 1 char/tile (`#`,`$`,`.`,`@`) — a de facto standard, readable, versionable.
  It confirms: **a fixed glyph legend + lines of text** is the right format for git diffs and human reading.

Conclusion: adopt the **roguelike/Sokoban model** — a glyph legend + lines of text — and our **own visual
editor** in the PICO-8 style (but in `tools/`, no-build).

## 2. Proposed legend (15 types → 15 glyphs)
Chosen to evoke what they represent and keep the landscape readable (terrain = punctuation/symbols; power-ups =
mnemonic CAPITAL letters, like roguelike items):

| type | meaning | glyph | why |
|---|---|---|---|
| 1 | air (lit) | `.` | empty |
| 0 | dark air / secret region | `:` | "shaded" empty (regions that light up) |
| 2 | stone / solid floor | `#` | standard solid block |
| 6 | hard wall (no bounce) | `=` | another solid, distinct from the floor |
| 3 | water | `~` | wave |
| 4 | ladder | `H` | rungs |
| 5 | trampoline | `^` | upward push |
| 9 | lava / hazard | `x` | spike/damage |
| 10 | gate | `\|` | closed door |
| 11 | key | `*` | shiny item |
| 7 | super-jump power-up | `S` | **S**uper |
| 8 | flight power-up | `F` | **F**ly |
| 12 | super-run power-up | `T` | **T**urbo |
| 13 | ultra-jump power-up | `U` | **U**ltra |
| 14 | suction-cup power-up | `C` | **C**ling |

> Example (the one you approved):
> ```
> ##############
> #............#
> #....HHH.....#
> #....H.......#
> #..*.H..^^...#
> #####H#####xx#
> ~~~~~~~~~~~~~~
> ```

The legend is versioned in a single place (`core/tiles.js` or the file's header), so that the parser and the editor read the
same truth. Future types = a new glyph in the legend (without touching existing maps).

## 3. The `.txt` file format
- One line per map row; one glyph per tile. **Lines may have different lengths** (the current map is
  irregular) → the parser pads on the right with air (`.`) up to the maximum width (which is what `buildWorld` already does with
  `undefined→0`; we will keep it, mapping the "empty on the right" to the default air).
- An optional header in lines starting with `#!` (meta: name, author) — ignored by the grid parser. (Careful:
  `#` is the wall glyph, so the meta marker is `#!` at the **start of the line**, distinguishable.)
- UTF-8 encoding, no BOM, `\n`. Extension `.map.txt` (makes it clear it is text).
- Location: **`app/assets/levels/ludico.map.txt`** (runtime data; goes into the deploy) — a single, readable source,
  diffable in git (your goal).

## 4. Parser in `world.js` (already isolated — drops in cleanly)
- A new `parseLevel(text) → numeric grid` (glyph→type through the legend; empty→air). Replaces the inline `CLARITY_MAP`.
- `buildWorld` now receives the text and calls `parseLevel` + the current `expandNarrowPassages` (unchanged).
- **Loading:** the `.txt` is fetched with `fetch` at boot (asynchronous) and precached in the SW. That makes the
  world's init **asynchronous** — a boot change that the **engine study** (§ boot/asset-loading)
  needs to address; the sync alternative = embed the text in a JS module (`levels/ludico.js` exporting the string),
  but it loses the reading-as-`.txt` that is precisely your goal. **I recommend the `.txt` + async boot.**

## 5. Map editor (`tools/map-editor.html`, standalone, no-build)
- A self-sufficient HTML/JS/CSS page (like the game): **opens and saves the `.map.txt`**.
- A **palette** of the 15 types (icon + glyph + name), a **brush** (click/drag paints), eraser (= air), bucket,
  rectangular selection, grid resize, undo/redo.
- **Live mirror**: a panel showing the glyph text (the "ASCII art") and the rendered preview side by side.
- **Validation**: warns about orphan tiles, a missing spawn, a gate without a key, unreachable regions (reuses the
  connected-components logic of `buildDarkRegions`).
- **I/O**: the File System Access API where available; otherwise, download/upload of the `.txt`. No server, no build.
- Reuses the **same legend** and (ideally) the same `parseLevel`/colour palette as the game, importing from
  `core/` — the editor becomes the first "external consumer" of the modules, validating the engine's boundaries.

## 6. Delivery in steps (each = 1 verified commit)
1. **Legend + `parseLevel`** in `core/` (+ round-trip tests: number↔glyph). Without changing the game yet.
2. **Migrate `CLARITY_MAP` → `ludico.map.txt`** and `world.js` starts parsing (async boot). Verify: identical
   world (same grid, `tileAt` bit-for-bit equal to the current one).
3. **Editor `tools/map-editor.html`**: paint + load/save + validate + preview.
4. **Refinement**: undo/redo, meta header, shortcuts, export a PNG preview.

## 7. Risks
- **Irregular grid** (lines of different lengths) → an explicit right-padding rule (=air), with a
  test comparing the resulting grid with the current `CLARITY_MAP` before switching.
- **Asynchronous boot** (fetch of the `.txt`) → decide in the engine study; I recommend async + a "loading" screen/state.
- **`#` is both wall and comment** → meta only with `#!` at the start of the line; never infer a comment mid-line.
- **Editor×game divergence** → the editor imports the SAME legend/parser from `core/` (a single truth).
