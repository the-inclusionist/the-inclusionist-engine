> Historical plan (2026-07-03): kept as a record; the current state lives in [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

# Plan — Engine architecture (bespoke, lean)

The Dev's request on 2026-07-03: plan an engine for the game. Locked decision: **bespoke for THIS game
now** (not a generic engine for the 35+ games — the common core is extracted later, once we know what repeats).
The engine **is not a rewrite**: it is the **formalised destination of the modularisation** (`../5-Refactoring/plano-modularizacao.md`),
reached incrementally. Inherited pillars: **no-build, offline/PWA, a11y-first, lean**.

## 1. References studied
- **R. Nystrom, "Game Programming Patterns"** (patterns: *Game Loop*, *Update Method*, *Component*, *State*,
  *Service Locator*) — the conceptual basis of the subsystems below.
- **G. Fiedler, "Fix Your Timestep"** — fixed-step (deterministic) loop + interpolated render.
- **PICO-8 / TIC-80** — proof that a **tiny, closed** 2D engine (loop + map + sprites + input +
  audio) is enough for rich games. That is the "bespoke and lean" spirit.
- **ECS (e.g. bitECS) / Phaser** — the path of the **reusable/generic** engine; studied to KNOW what
  NOT to do now (overhead/complexity before validating the 2nd game), and where to migrate IF the 35+ arrive.

## 2. Style decision: system-modules + simple entities (NOT ECS for now)
- **Bespoke** ⇒ **entities as plain objects** (player, coin, powerup, creature) with a minimal contract
  of `update(dt)`; **subsystems** (physics, render, audio…) operate on the state. Light *Update Method* +
  *Component* patterns, **without** an ECS framework.
- **ECS is reserved** for the eventual reusable engine (it only pays off with many games/entities). Noted
  as a migration path, not for now. (It avoids the mistake the Stanford paper itself penalises: complexity and
  coupling with no need.)

## 3. Subsystems (they formalise the modularisation; target of the next extractions)
| Subsystem | Module(s) | Responsibility | State today |
|---|---|---|---|
| **Loop** | `core/loop.js` | fixed step `update(dt)` + `render()`; today it is `app.ticker` | to extract |
| **State/Scene** | `core/state.js` | single source: `phase` (machine), players, coins, entities, event bus | to extract (it was the next step) |
| **Level/Tilemap** | `core/world.js` + `core/tiles.js` + `assets/levels/*.map.txt` | grid, `tileAt`, tile collision, **legend/parser** | `world.js` already isolated; format → `../game-design/plano-editor-mapa.md` |
| **Physics** | `core/physics.js` | `resolveX/Y`, movement, water/ladder/trampoline | to extract |
| **Input** | `input/{keyboard,gamepad,touch}.js` | devices → normalised actions | to extract |
| **Render** | `render/{pixi-app,viewport,parallax,direct-viz}.js` | PIXI façade, viewports, a11y visual modes | to extract |
| **Audio** | `platform/{audio,speech}.js` | WebAudio + TTS + narration | to extract |
| **Entities** | `entities/*.js` | player/coin/powerup/creature (objects + `update`) | to extract |
| **Persistence** | `platform/storage.js` | settings/save (consolidate ~19 keys) | to extract |
| **i18n** | `core/i18n.js` | translations | **DONE** |
| **Constants** | `core/constants.js` | tuning/types | **DONE** |

Boundaries: **dependency injection** (a subsystem receives what it needs — physics receives the tilemap; audio
receives the `AudioContext`), without reaching for globals. `main.js` composes everything and mounts `window.__incl` (test).

## 4. Boot and asset loading (the question the tilemap raises)
Today the boot is **synchronous** (it mounts menus on load). The map in `.txt` (fetch) and assets make the boot
**asynchronous**. Engine decision: **one explicit asynchronous boot** —
`async function boot(){ await loadLevel(); await loadSettings(); start(); }` — with a `loading` state in the
phase machine (simple screen/curtain). It is correct and unlocks external data (levels, future assets). The
default language remains a static import (i18n already solved); only the DATA (level) becomes an await at boot.

## 5. How the map editor fits in
The editor (`tools/map-editor.html`) is the **first external consumer** of the modules: it imports `core/tiles.js`
(legend + colours) and `core/world.js` (`parseLevel`). If the editor can reuse those modules without dragging the
whole game along, the **engine's boundaries are right**. In other words: the editor validates the modularisation in practice.

## 6. Sequence (fits into Phase B of the modularisation, no rewrite)
1. **Tilemap first** (`../game-design/plano-editor-mapa.md`): `core/tiles.js` (legend) + `parseLevel` in `world.js` +
   migration to `.map.txt` + async boot. Closes the Level subsystem and unlocks the editor.
2. **Editor** `tools/map-editor.html` (validates the boundaries).
3. **`core/state.js`** (the mega-barrier) — now with a clear target: it is the engine's State/Scene subsystem;
   migrate the 8 mega-variables one by one.
4. **`core/loop.js`** — formalises the loop (fixed step).
5. The remaining subsystems (physics, input, render, audio, entities, storage) — incremental extractions already with the
   boundaries of the §3 table.
6. `main.js` as the composition root; `game.js` empties out.

## 7. What the engine is NOT (scope discipline)
- It is **not** generic/reusable now (only if the 35+ games materialise — then the common core is extracted).
- It is **not** ECS, nor does it adopt Phaser/a heavy engine (that breaks the lean/offline pillar).
- It is **not** a rewrite: each subsystem is born from a verifiable extraction from the monolith, without changing behaviour.

## 8. Pending decision (the Dev)
Approve (a) the map format + editor (`../game-design/plano-editor-mapa.md`) and (b) this subsystem architecture as
the target of Phase B. With the go-ahead, I start with **Step 1 of the tilemap** (`core/tiles.js` + `parseLevel`, without changing the
game), which is the basis of the editor and of the Level subsystem.
