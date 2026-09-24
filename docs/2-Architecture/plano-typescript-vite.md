> Historical plan (2026-07-04): kept as a record; the current state lives in [`../ARCHITECTURE.md`](../ARCHITECTURE.md) and [`CI-CD.md`](CI-CD.md).

# Migration to TypeScript + Vite

The Dev's decision (2026-07-04): migrate from "raw ESM with no build" to **TypeScript + Vite (with a build)**, NOW (24
modules extracted — cheaper than later). It changes the *preference* "no build step"; the **non-negotiable pillars**
(offline PWA, lean runtime, school hardware) are **preserved/improved** (bundle/minify/tree-shake =
smaller payload; `vite-plugin-pwa` generates the offline SW). See [[project-inclusionist]].

## Principles
- **Incremental, no big-bang.** `allowJs: true` → `.js` and `.ts` coexist; modules are converted one by one. The
  modularisation under way continues, but every new/extracted piece is born as / becomes `.ts` with types + tests.
- **Loose strict at first**, tightening gradually (avoids 1000 errors on day 1).
- **Verification:** the AI does not run Node → the Dev runs `npm run dev`/`build`/`vitest`. The preview (python serving raw files)
  still covers the early stages; after the build/PWA, validation goes through Vite.
- **One stage at a time, each validated before the next.**

## Stages

### Stage 0 — Vite serves the current game (dev) ✅ DONE
Goal: prove the toolchain runs with minimal change (PIXI stays a global from the vendor folder; no TS yet).
- `package.json`: devDeps `vite` + `typescript`; scripts `dev`/`build`/`preview`. Vitest aligned with Vite's major.
- `vite.config.ts`: `root: 'app'` (where index.html is). In DEV Vite serves EVERYTHING under `app/` (js/css/assets/
  vendor) → `fetch('assets/…')` and the `<script vendor/pixi.min.js>` work without moving anything.
- `tsconfig.json`: `allowJs`, `checkJs:false`, `noEmit` (Vite emits; tsc only type-checks), `strict:false`.
- The hand-written SW is **switched off in dev** (avoids a conflict with Vite) — it comes back as a plugin in Stage 1.
- **The Dev validates:** `npm install` → `npm run dev` → the game opens at `localhost:5173` the same as today.

### Stage 0b — `vite build` produces `dist/` ✅ DONE
- Configure copying of the runtime static files (`assets/`, `vendor/`, `manifest`, `icon`, `_headers`) into the build —
  move them to `app/public/` (Vite copies `public/*` into `dist/` at the same URL). index.html almost untouched.
- **The Dev validates:** `npm run build` → `npm run preview` serves a working `dist/`.

### Stage 1 — PWA through `vite-plugin-pwa` ✅ DONE (Workbox SW active, offline verified 2026-07-04)
- Replaces the hand-written `sw.js` + the `INCL_VERSION` bump ritual: the plugin generates the SW with precache by
  **content-hash** (the cache invalidates itself). Offline strategy preserved (precache of the shell + assets).
- Removes `app/sw.js` and the inline registration; the plugin injects the registration.
- **The Dev validates:** build + `preview`, test offline (DevTools → Offline) + update.

### Stage 2 — Vitest aligned with Vite ✅ DONE (Vitest 3.2.6, test.projects, 46 green tests)
- Bump `vitest`/`@vitest/browser` to the major compatible with the installed Vite. The two projects (node/browser) and the
  current tests stay; only the version/config changes. **The Dev validates:** `npx vitest run` green.

### Stage 3 — Convert to `.ts` (incremental) + PIXI via npm ⬅ IN PROGRESS
- Rename `.js`→`.ts` modules and type them, starting with the **pure leaves**. `strict:true` already on (only `.ts` checked).
  Progress in small **batches** (each validated by the Dev: `build` + `vitest run` + `tsc --noEmit`):
  - **Batch 1 (DONE):** `core/constants`, `core/rng`, `core/tiles`.
  - **Batch 2 (DONE):** `core/world`, `input/state`, `platform/storage`.
  - **Batch 3 (DONE):** `input/devices`, `render/viz-modes`, `core/loop`, `ui/fonts`.
  - **Batch 4 (DONE):** `core/i18n`, `input/keyboard`, `platform/audio-mixer`, `platform/speech`.
  - **Batch 4b (DONE):** dictionaries `i18n/{pt,en,es}` → `.ts`. The "raw" dynamic `import()` was replaced by
    `import.meta.glob('../i18n/*.ts')` (native to Vite: matches `.ts` in the build explicitly, without relying on the
    glob "guessed" by Rollup). pt stays a **static** import (synchronous boot); en/es come in as on-demand
    chunks. **Validate the language switch in the preview** (the glob is only exercised in `build` + `preview`).
  - **Batch 5 (DONE):** `ui/dom` (generic `$`/`$$`), `core/state`, `platform/audio` (typed Web Audio graph).
  - **Batch 6a (DONE — PIXI global→npm):** `game.js` + `render/{canvas,sprites}` switch to `import * as PIXI from
    'pixi.js'` (7.4.2); removed the `<script src=vendor/pixi.min.js>` and the file itself (dead weight). The
    HIGHEST-risk step (touches the boot/canvas) → **validate the real boot in the preview (canvas≥1 + `__incl`) after the Dev's build.**
  - **Batch 6b (DONE — render→.ts):** `render/{canvas,props,sprites,sprite-fx}` typed with the pixi.js `@types`.
  - Only **`game.js`** remains as `.js` (the big one) → **Stage 4** (the modularisation continues, each extraction born `.ts`).
- **Render modules** (canvas, props, sprites, sprite-fx): a dedicated batch — replace the global `PIXI` with
  `import * as PIXI from 'pixi.js'` (a real dependency, tree-shakeable, typed). The `$` of ui/dom becomes a **typed** helper (`$<T>()`).
- Each conversion: clean `tsc --noEmit` + green tests.

### Stage 4 — Resume the modularisation in `.ts`
- The rest of the map (`../5-Refactoring/plano-modularizacao-mapa.md`) continues, but each extraction is born typed `.ts`. `game.ts`
  (formerly `game.js`) shrinks until it becomes `main.ts` (composition root).

## Deploy (Cloudflare Pages) — the Dev's action
The Pages project `the-inclusionist` was created in the no-build era (it served raw `app/`) and **was connected to
GitHub**. With the move to GitLab the source has to be redone — a Pages project does not switch repository
in place. **Build settings** (in the dashboard's current UI — do not hard-code menu paths, they change):
- **Root directory:** the repo root (where `package.json` is) — NOT `app/`.
- **Build command:** `npm run build` (or `npm run test:node && npm run build` for a test gate).
- **Build output directory:** `dist`.

`_headers` ends up in `dist/` (via `public/`). Node already exists in the CF build. **Only one delivery path may
be switched on at a time** — either CF connected to GitLab (it builds by itself), or the `pages_deploy` job of
`.gitlab-ci.yml` (direct upload through `wrangler`). Both together deploy the same commit twice.

## Risks / notes
- **Vite/PWA config usually needs 1–2 iterations on the real machine** — I send the config, you run it, paste me the
  error, I adjust (as happened with Vitest's browser mode).
- **Vite↔Vitest version alignment** is the most likely point of friction in `npm install` — we solve it on the 1st run.
- **The AI's preview** loses fidelity after Stage 0b (build/PWA) — validation becomes yours, through Vite. My
  Python graph-check becomes redundant (`tsc` does it better).
- None of this changes the game at runtime for the user other than for the **better** (smaller payload, sturdier SW).
