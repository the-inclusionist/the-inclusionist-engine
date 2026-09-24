> Historical plan (2026-07-04, with a section added 2026-08-26): kept as a record; the current state lives in [`Test-Plan.md`](Test-Plan.md), `vite.config.ts` (the two Vitest projects) and [`../2-Architecture/CI-CD.md`](../2-Architecture/CI-CD.md).

# Test Plan — The Inclusionist

Unit tests of the modules, written **as each module is extracted** (the Dev's decision, 2026-07-04; see
`../5-Refactoring/plano-modularizacao.md` §8). Patterns adopted: **ZOMBIES** (didactic) + **Right-BICEP** (mandatory rigour).

## 1. Why test at extraction (and with redundancy)
The moment of extraction is when the module's contract is clearest → the test is cheapest to write, and it is a safety
net for the large/coupled extractions that come later. Verification is **redundant on purpose** (the Dev's
decision) — two independent paths catch more:

| Layer | Who runs it | What |
|---|---|---|
| **Static graph** | AI (Python script) | does every `import {..}` match an `export`? Immune to caching. |
| **Real boot** | AI (preview) | `canvasCount≥1` + `window.__incl` — does the whole game come up? See [[feedback-verify-game-actually-boots]]. |
| **Vitest** | **the Dev** (`npx vitest`) | real unit tests: node (logic) + Chromium/Playwright (render). CI-ready. |

**Browser harness RETIRED (2026-07-04, Stage 0b of the TS+Vite migration):** `app/tests/` was removed — after Vite it was awkward to serve and the double maintenance did not pay off. **Vitest (the Dev) is the single** test path; the AI's per-extraction verification becomes **graph + boot** (serving the built `dist/`) + ad-hoc pre-validation of the expectations in the preview.

## 2. The two patterns

### ZOMBIES (James Grenning) — a heuristic of ORDER and coverage (didactic, for TDD)
It orders the thinking behind a test, from trivial to complex — great for a beginner contributor reading the suite and
understanding *how one thinks* a test:
- **Z**ero — the empty/none case first (empty string, empty list, nothing pressed).
- **O**ne — one element.
- **M**any — several (and the interaction between them).
- **B**oundary behaviors — edges.
- **I**nterface definition — the shape of the API (types, counts, enums).
- **E**xercise exceptional behavior — force the error/exception path.
- **S**imple scenarios, simple solutions — keep it simple.

### Right-BICEP (Hunt & Thomas, *Pragmatic Unit Testing*) — MANDATORY rigour
No module "closes" without covering **Right + B + I + C + E** (P when it makes sense):
- **Right** — is the result right on the happy path?
- **B**oundary — edge conditions. Sub-checklist **CORRECT**: **C**onformance (format), **O**rdering (order),
  **R**ange (range), **R**eference (external dependencies/state), **E**xistence (null/empty/absent),
  **C**ardinality (0/1/N — matches ZOMBIES), **T**ime (ordering/timing/concurrency).
- **I**nverse — inverse relation (e.g. `parseLevel` ↔ `gridToGlyphs` = identity).
- **C**ross-check — validate by ANOTHER path (e.g. `tiles.selfTest()` proves the bijection independently).
- **E**rror conditions — force errors (invalid input, unknown glyph, corrupted JSON).
- **P**erformance — performance characteristics (rare here; use it if a module has a relevant cost).

**Writing convention:** each test carries a label in its name — `[Zero]`, `[One]`, `[Many]`, `[Boundary]`,
`[Interface]`, `[Inverse]`, `[Cross-check]`, `[Error]`, `[Right]` — so the suite explains itself.

### A DECISION gate is not a USE gate

A rule learned the hard way, and twice within a few slices (2026-08-26): extracting the decision into a pure module and
testing it there **does not prove it is wired in**. The two cases:

| what was gated | what slipped through | how it showed up |
|---|---|---|
| `fracNotsHtml` (the initial markup of the fraction notations) | the click *handler*, which kept writing the old attributes | in the browser: clicking moved no mark at all |
| `botaoDeCorrerEngatado` (the decision of the cane's probing) | the call in `stepSounds` | only when attempting the mutation: returning `held(pl,'run')` left everything green |

In both, the decision's test stayed green with the wiring undone — that is, it measured the function and not the
behaviour. A gate like that gives the feeling of coverage without the coverage, and the cost falls on whoever depends on the
behaviour: in the first case, whoever cannot see the highlight's colour; in the second, the blind child losing the
cane's probing.

**The practice that closes this** is the one mutation already asked for, applied at two levels:

1. Test the DECISION where it is pure (fast, exhaustive, cheap).
2. Test the USE where it happens — the exported function the product really calls (`stepSounds`,
   `screenPauseMarkup`, the click *handler*). ONE case is enough, and it is the one the wiring mutation knocks down.
3. **Mutate the wiring, not only the decision.** If swapping the call back to how it was leaves the suite green, the use
   gate does not exist — and that is where it is discovered, not on the child's screen.

## 3. Architecture — Vitest with two "projects"
The design rule this imposes (and it is a good one): **maximise pure logic** (testable in node, fast) and **minimise
the browser-only surface** (render). When extracting, keep logic modules from importing PIXI/`document`.

- **`node`** — pure logic, no `PIXI`/`document`/`localStorage`: `core/constants`, `core/tiles`, `core/world`,
  `input/state`, and **physics** once it is extracted. Files `tests/*.node.test.js`. Fast, no browser.
- **`browser`** — needs the real environment (Chromium via Playwright): `render/canvas`, `render/props`,
  `render/sprites`, `render/sprite-fx` (PIXI/canvas/WebGL) and `platform/storage` (localStorage). Files
  `tests/*.browser.test.js`. `vitest.setup.browser.js` exposes `globalThis.PIXI` (pixi.js **7.4.2**, the SAME
  major as `vendor/pixi.min.js`) for the modules that read a global `PIXI`, just like the game.

Everything is **DEV-ONLY**: `package.json`/`node_modules`/`tests/` stay at the repo ROOT. The Cloudflare deploy is the
`app/` folder, so **none of this goes into the game** — which remains **with no build/bundler** (the lightness pillar).

## 4. How to run it (the Dev)
```bash
npm install                     # installs vitest + @vitest/browser + playwright + pixi.js (dev)
npx playwright install chromium # downloads Playwright's Chromium (1st time)
npx vitest run                  # runs everything (node + browser), once
npx vitest                      # watch mode
npm run test:node               # logic only (fast)
npm run test:browser            # render only (Chromium)
```
> Honest note: **I (the AI) do not run Node in this environment** — I write the tests and the config, but whoever runs
> Vitest is you. The *browser mode* config may vary with the installed Vitest version; if something complains,
> send me the output and I adjust it. Meanwhile, I keep the graph + boot (dist/) verification on every round.

## 5. Coverage and roadmap
- **Covered (leaf modules already extracted):** constants, tiles, world, input/state (node); canvas, props, sprites,
  sprite-fx, storage (browser). See `tests/logic.node.test.js` and `tests/render.browser.test.js`.
- **Each next extraction** adds its tests to the right project's file, covering Right+B+I+C+E.
- **Physics** (when extracted from `game.js`): a priority target for node tests (jump, gravity, water, trampoline,
  collision) — deterministic, high value. It is the suite's biggest gain.
- **CI:** ✅ GitHub Actions (`.github/workflows/ci.yml`) runs the suite on pushes to `main` and on pull requests — it blocks regressions.

## 6. (Retired) Browser harness
`app/tests/` (index.html + suite.js) was REMOVED in Stage 0b of the TS+Vite migration (2026-07-04). Reason: after
Vite it was awkward to serve and the double maintenance with Vitest did not pay off (Vitest covers the same). The
test path becomes ONLY Vitest; the AI verifies each extraction by graph (Python) + boot on the built `dist/`
+ pre-validation of the expectations in the preview.
