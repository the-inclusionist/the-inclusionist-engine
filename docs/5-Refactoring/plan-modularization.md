Historical plan (2026-07-03): kept as a record; the current state lives in the code under `app/js/**` and in ADR-0173 (the layer rule, gated by `tests/dependencies-point-downward.node.test.js`).

# Plan — Modularising `game.js` guided by senior good practice

The Dev's request on 2026-07-03, after stabilisation. Basis: arXiv:2409.15152v1 — *Predicting Expert
Evaluations in Software Code Reviews* (Denisov-Blanch et al., Stanford, 2024). Goal: **port to JS the
characteristics that Java seniors associate with good code** and, in applying them, **modularise** `game.js`
(3838 lines, a single file) — **without a bundler** (native ES Modules; it keeps the offline/PWA and the no-build setup).
[Today: `game.js` is gone; the engine is TypeScript under `app/js/**`, built by Vite, with `app/js/boot/create-game.ts` as its entry.]

> The paper's master rule for us: **maximise cohesion, minimise coupling and complexity.** Everything else
> (patterns, IoC, persistence layer, API adapters) is a means to reach those three.

---

## 1. From the paper → practice in JS in this project

| Dimension (Tab. 1–4) | Java | How we apply it here |
|---|---|---|
| **High cohesion** | single-responsibility class | **1 ES module = 1 responsibility** (physics, quiz, audio, render, input, UI…) |
| **Low coupling** | interfaces + DI | end of globals read/written from everywhere → **one state module** + explicit imports |
| **Low complexity** | short methods | break up `update`/`draw`/`pollPads`/`openQuiz`/`keydown`; *guard clauses* |
| **Classes/Interfaces/Methods** | OOP | modules + **JSDoc `@typedef`** as the contract; **composition > inheritance** |
| **Dependency Injection (IoC)** | Spring | pass deps (quiz receives `say()`; audio receives `AudioContext`) instead of reaching for globals |
| **Design patterns** | design patterns | **state machine** (`phase`), **registry** (`ACTIVITIES`), **factory** (quiz), **adapter** (APIs) |
| **Persistence layers** | DAO/repository | consolidate the ~19 `localStorage` keys into a single `storage.js` (keys+defaults in one place) |
| **Consumed APIs** | wrappers | **adapters**: `speech`, `audio`, `gamepad`, `libras`, `dom` — the rest of the code does not touch the platform |
| Data structures / Dependencies | — | already fine (Set/Map where it fits; Pixi/VLibras/Piper versioned at the edge) |

**Not ported:** Java-style class inheritance (JS prefers composition) and the paper's ML/metrics model
(it is *their* tool, not a coding practice).

---

## 2. Current state (a factual map of `game.js`)

- **3838 lines** in 1 file, loaded by `<script src="game.js">`.
- **8 mega-variables** touch almost everything: `phase`, `players[]`, `coins[]`, `numPlayers`, `MODE`,
  `quizLevel`, `vizMode`/`CENARIO`, `wheelchair`. → the biggest friction of the modularisation.
- **Raw platform APIs** scattered around: `speechSynthesis`, `AudioContext`, `localStorage` (~19 keys),
  `getGamepads`, `PIXI`, `document.querySelector` (~200×), VLibras (`window.plugin`), `WebGazer`.
- **Monster functions:** `update(dt)` (~130 L), `draw()` (~150 L), `pollPads()` (~large), `openQuiz()`
  (~100 L), the `keydown` listener (~70 L), direct high-contrast rendering (~150 L).
- **A single export** `window.__incl` with 25+ getters/setters (it is the debug/test API — **preserve it intact**).

---

## 3. Architecture target (native ES Modules, no bundler)

`index.html` becomes `<script type="module" src="main.js">`. `main.js` orchestrates; each folder is one
responsibility. **`window.__incl` keeps existing** (assembled in `main.js` from the modules) so as
not to break tests/preview.

```
v4.0.0/
├─ index.html            # <script type="module" src="main.js">  (+ import map for pixi)
├─ main.js               # composition root: creates adapters, injects deps, assembles the loop and __incl
├─ core/
│  ├─ constants.js       # TUNE, TILE, TILE_TYPES, EASY, LOGICAL_W/H  (pure, zero deps)
│  ├─ state.js           # players, phase, coins, numPlayers, MODE, quizLevel… + events
│  ├─ world.js           # CLARITY_MAP, buildWorld, tileAt, solidAt, surfTop, rampSurfaceY (pure)
│  └─ physics.js         # makePlayer, resolveX/Y, movement update (receives state+world)
├─ render/
│  ├─ pixi-app.js        # adapter PIXI: app, camera, containers, ticker
│  ├─ viewport.js        # drawViewport (1 screen); draw() becomes the orchestrator of N viewports
│  ├─ direct-viz.js      # high contrast / colour blindness (CVD/filters)
│  └─ parallax.js        # updateParallax, scenery, themes
├─ gameplay/
│  ├─ quiz.js            # quiz factory (somasub/silabas/frações) + render/move/confirm/erase
│  ├─ coleta.js          # takeCoin/takePu, victory, respawn
│  ├─ powerups.js        # powers, setupExtras, lifts/ramps (wheelchair)
│  └─ vida.js            # spawnCreature/car, stepLife
├─ a11y/
│  ├─ viz-modes.js       # setPlayerViz, applyViz, VIZ_MODES
│  ├─ adaptive.js        # oneButton, wheelchair, modoCego, reduced motion
│  └─ narracao.js        # gameSay + narrate (uses the speech adapter)
├─ input/
│  ├─ keyboard.js        # keydown/keyup, KB_SCHEMES, remap
│  ├─ gamepad.js         # pollPads, padWiz  (split into poll/map/apply)
│  └─ touch.js           # virtual joystick, D-pad, remap
├─ ui/
│  ├─ menus.js           # buildTitleMenus, navigation, ACTIVITIES (registry)
│  └─ pause.js           # pause menu, a11y dialogues
└─ platform/             # ADAPTERS of external APIs (the paper's layer)
   ├─ storage.js         # the ONLY access to localStorage: keys+defaults+validation
   ├─ speech.js          # Web Speech / Piper TTS (ptbrVoice, queue)
   ├─ audio.js           # AudioContext (osc/gain/filter/pan), SFX, ambience
   ├─ gamepad-api.js     # navigator.getGamepads
   ├─ libras.js          # VLibras (window.plugin.translate, gloss:end, CSS in/out)
   └─ dom.js             # centralised $()/$$ (the end of the 200 loose querySelectors)
```

**Dependency injection (IoC) in practice:** domain modules **do not import** the platform adapters
directly; they receive what they need as parameters. E.g. `quiz.js` exports `createQuiz({ say, sfx, storage })`.
`main.js` creates the adapters once and injects them. This makes each module testable in isolation and brings coupling down.

**Shared state (the mega-barrier):** `core/state.js` becomes the **single source**. It exports the state
object + mutator functions (`setPhase`, `addCoin`…) + a **minimal event bus** (`on('phase', cb)`) for the
few cases that today read the global from afar. No framework: a `Map<string, Set<fn>>` of ~15 lines.

---

## 4. Migration strategy — incremental, **with no change in behaviour**

Principle: the game has to **keep running and pass verification at every commit**. No big bang.
Each stage extracts a piece, the old file starts importing from it, it is checked in the Preview, committed.

**Localise ALONG THE WAY (i18n):** each module with UI extracted here comes out with its literals already replaced by
`t()`/`data-i18n` and the keys in `pt.js` — modularise and localise in the SAME pass (it avoids mining the monolith and
touching the code again). See `../1-Discovery/plan-i18n.md` §4.2. The i18n foundation (`core/i18n.js`) is already done.

**Stage 0 — Scaffolding (low risk).** Switch `index.html` to `type="module"`; create a `main.js` that only
does `import './game.js'` (still the monolith) and add an `import map` for Pixi. Bump `sw.js`, including the new
files in the SHELL. *Check: identical game.* → 1 commit.

**Stage 1 — Pure leaves first (zero coupling).** Extract `core/constants.js` and `core/world.js`
(pure functions, no global state). `game.js` imports them back. *Check.* → 1 commit per module.

**Stage 2 — Platform layer (adapters).** `platform/storage.js` (consolidate the ~19 keys),
`platform/dom.js`, `platform/speech.js`, `platform/audio.js`, `platform/gamepad-api.js`,
`platform/libras.js`. They are well-defined edges; the rest of the code starts calling them. *Check each one.*
→ ~6 commits.

**Stage 3 — Single state.** Create `core/state.js` and migrate the 8 mega-variables there **one at a time**
(start with `phase`, then `quizLevel`, `MODE`, `wheelchair`… leave `players[]` for last, being the most
scattered). Event bus where needed. *Check at each variable.* → ~8 commits.

**Stage 4 — Domains.** Extract `physics.js`, `render/*`, `gameplay/*`, `a11y/*`, `input/*`, `ui/*`,
receiving `state` + adapters by injection. This is where the monster functions fall: `update`→`updateInput/Movement/
Collisions/Logic`; `draw`→orchestrates `drawViewport`; `pollPads`→`poll/map/apply`; `openQuiz`→factory.
*Check at each extraction.* → several small commits.

**Stage 5 — Closing.** `game.js` empties; `main.js` becomes the composition root that assembles `window.__incl`
from the modules. Remove `game.js`. Run the full verification suite (every mode: MP, wheelchair,
high contrast, quiz, literacy). Update the ADR. → 1 commit + ADR.

---

## 5. Risks and mitigation

- **`window.__incl` (tests/preview) breaking** → assemble it in `main.js` with exactly the same 25+ members;
  a parity checklist before removing `game.js`.
- **Load order / import cycles** → a layered graph (`platform` → `core` → domains → `ui`/`main`);
  no circular imports (the event bus breaks the few that would appear).
- **SW/cache serving a mix of files** → at each stage **bump the `CACHE`** + all modules in the `SHELL`
  (it is already network-first; keep it). It is the old enemy, the stale build in the cache.
- **Sensory regression (scale/scanline)** → those calculations stay intact in `layout()`; migrated only in
  Stage 4 and checked with a dedicated screenshot (misalignment = sensory overload).
- **Refactoring without a net** → since there are no automated tests, the net is the **check in the Preview at each
  commit** + the a11y counters of `__incl`. If any mode diverges, the isolated commit is reverted.

## 6. What does NOT change

- Zero change in **behaviour/art/pedagogy** — it is pure structural reorganisation.
- No bundler, no build step, 100% offline/PWA preserved.
- Literacy (stages 6–9) and the other features come **afterwards**, already on the modular base (easier).

---

## 7. Pending decision (the Dev)

Approve the target (§3) and the incremental order (§4). I suggest **interleaving**: do the modularisation in blocks and,
between blocks, return to the literacy features — that way the overhaul does not stall the pedagogical roadmap.

## 8. Tests per extraction (the Dev's decision, 2026-07-04)

Each module extraction (Phase 2.x) **adds the tests of the module's contract** to `app/tests/suite.js` — it is not
left for the end. Reason: the moment of extraction is when the contract is clearest (the cheapest test) and it gives a
safety net for the large, coupled extractions that come later.

- **Harness:** `app/tests/` runs in the BROWSER (the real PIXI/canvas/localStorage environment) — no Node/bundler, which
  we do not have here. `suite.js` exports `runAll()`; `index.html` shows green/red and exposes `window.__testResults`
  (drivable via the preview). **Dev-only:** it does not enter the `sw.js` SHELL nor is it linked by the game → touching only
  tests does **not** require a version bump. [Today: the tests run in Vitest (a node project and a browser project) under `tests/`; `app/tests/` no longer exists.]
- **Verification of each extraction** = (a) a consistent imports×exports graph (a Python script, immune to cache) +
  (b) a real boot in the preview (canvasCount≥1 + `__incl`) + (c) the module's tests green. See [[feedback-verify-game-actually-boots]].
- **Initial coverage (Phase 2.23):** 23 tests of the 9 leaf modules already extracted (constants, tiles, world,
  input/state, canvas, props, sprites, sprite-fx, storage). The harness already caught a wrong guess (AIR=1, not 0).
