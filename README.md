# The Inclusionist

[![ci](https://github.com/the-inclusionist/the-inclusionist-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/the-inclusionist/the-inclusionist-engine/actions/workflows/ci.yml)

An **accessibility-first** engine for educational 2D pixel-art games, in PixiJS, made for Brazilian public
schools and published as the npm package **`@the-inclusionist/engine`**. It is the part every game inherits,
aiming at **WCAG 2.2 (AAA aspirational) + Game Accessibility Guidelines (GAG)**: high contrast,
colour-blindness simulation/correction, low vision, blind mode (audio navigation), TTS narration, wheelchair
mode, one-button play, remappable controls (keyboard/gamepad/touch in real millimetres), Libras (VLibras) and
typography for dyslexia. Games built on it are PWAs that work offline after the first load.

The games themselves are not here: **each game is its own repository** (ADR-0068) — the platformer, with the
literacy and mathematics activities, is `game-platformer`. What stays here is the engine and one demo
cartridge, `app/js/consumer-quiz/`, which exercises the contract from outside (`app/quiz.html`).

**Licences — and there are two, not one.** The **code** is **AGPL-3.0-or-later** (ADR-0064: under the GPL, a
hosted classroom server would owe the source to nobody; section 13 of the AGPL closes that). The **ART IS NOT
AGPL** — a program is what Lei 9.609 defines, art follows Lei 9.610 and belongs to whoever made it. What governs
what is in [`docs/LICENSES.md`](docs/LICENSES.md); the attributions, in [`docs/CREDITS.md`](docs/CREDITS.md).

⚠️ **Notice (2026-09-14): the Piper voices were withdrawn from the engine** over a licence chain we could not show —
see [`docs/notices/2026-09-14-piper-voices-withdrawn.md`](docs/notices/2026-09-14-piper-voices-withdrawn.md).

The platform mechanics were ported from
[Clarity, by Adam Brooks (dissimulate)](https://github.com/dissimulate/Clarity) (MIT); they left this repository with
the platformer and live in `game-platformer` now.

## Repository layout

```
app/            # engine source + the demo page (Vite root)
├─ quiz.html    #   the demo cartridge's page (the only page the build emits)
├─ js/          #   code — ES Modules in TypeScript, in layers (docs/ARCHITECTURE.md §3)
├─ css/         #   the engine stylesheet (shipped in the package)
└─ public/      #   static files served as they are → copied to dist/ at build
   ├─ vendor/   #     fonts (SIL OFL) and fonts.css
   └─ icon.svg · _headers
art/            # imported art and its attribution ledger (empty today)
dist/           # app build output (git-ignored) — no deploy is connected to it (see CD below)
dist-pkg/       # package build output (git-ignored) — what the npm package exports
tests/          # Vitest tests (node + browser) — not published
scripts/ · tools/                    # build, delivery and measurement scripts · dev tools
vite.config.ts · tsconfig.json · tsconfig.pkg.json · package.json    # toolchain (Vite + TypeScript + Vitest)
docs/ · research/                    # documentation (start at docs/ARCHITECTURE.md) · the typography catalogue
```

## Running locally

**Vite + TypeScript** toolchain (`docs/2-Architecture/plan-typescript-vite.md`):

```powershell
npm install        # also builds dist-pkg/ (the `prepare` script)
npm run dev        # dev server with HMR (Vite) → http://localhost:5173/quiz.html
npm run build      # production build → dist/
npm run preview    # serves the built dist/
npm test           # Vitest tests (node + browser via Playwright); npm run test:node = the logic only
```

## Building a game on the engine — the two targets (ADR-0253)

A game is built twice from one source (ADR-0140): the **APP**, its standalone PWA with the engine bundled — the route for
developing, testing, auditing and demonstrating that repository, never for delivering to children — and the **CARTRIDGE**,
what the platform installs, with the engine and the shared render libraries (`pixi.js`, `zdog`) left external. **The engine
builds the cartridge; the game declares it once**, by wrapping the Vite config it already has:

```ts
// vite.config.ts of a game
import { defineGameBuild } from '@the-inclusionist/engine/build';
import { VitePWA } from 'vite-plugin-pwa';

export default defineGameBuild({
  cartridge: 'src/index.ts',            // the entry, relative to the repository root
  config: { root: 'app', plugins: [VitePWA({ /* the game's manifest */ })], build: { outDir: '../dist' } },
});
```

- `vite build` → the **app**: the game's `config`, untouched.
- `vite build --mode cartridge` → **`dist-lib/cartridge.js`** and **`dist-lib/cartridge.d.ts`** (types emitted with the game's
  own `tsconfig.json`, for the entry's import graph only). The game's plugins, `define` and `resolve` still apply; the engine
  lays over them what a cartridge must be: `@the-inclusionist/engine`, `pixi.js` and `zdog` external as prefixes, no `public/`
  (a cartridge declares no delivery, ADR-0117) and no service worker (the PWA plugin is dropped).
- The entry's **default export is the cartridge** of ADR-0139 §2: `{ slug, declaration, hooks, create(ctx) }`. Nothing runs on
  import.
- **`npx inclusionist-check-cartridge`** imports `dist-lib/cartridge.js` in Node and runs on it the refusals `createGame` and
  `mount()` apply at boot (`cartridgeRefusals`), one line per problem.

## CI/CD

- **CI** — **GitHub Actions** (`.github/workflows/ci.yml`), on every push to `main` and on every pull request.
  Six jobs, none decorative:

  | job | what it blocks |
  |---|---|
  | `gate` | `npm audit --omit=dev`, typecheck, Vitest (node + browser), build, precache budget |
  | `adr` | the records' validator — eight checks, among them the bidirectional supersession pointer. The engine's records live here, in `docs/2-Architecture/adr/` (ADR-0242), and are checked on every push; what crosses into `the-inclusionist-docs` is opened only with the `DOCS_READ_TOKEN` secret, and until it exists those steps are a warning, not a pass |
  | `a11y` | axe against the **served** app, not against the source |
  | `dco` | `Signed-off-by` on every PR (ADR-0078); the maintainer's pushes are left out |
  | `secrets` | **gitleaks** over the WHOLE history (`fetch-depth: 0`), with `--redact` |
  | `sast` | **semgrep**, pinned version |

  ⚠️ **The two scanners are open-source ones and not GitHub's native ones, and the reason is price:** *code
  scanning* (CodeQL) and *secret scanning* are free **only on a public repository**; on a private one they require
  GitHub Advanced Security, which is paid — and ADR-0066 §3 keeps everything private until the act. They are pinned
  to an exact version, because a scanner that changes its rules by itself is a gate whose verdict nobody reproduces.

  ⚠️ **The `.gitlab-ci.yml` was REMOVED, not disabled.** The GitLab project is archived (ADR-0066 §5),
  so that file could no longer run — and it described as current two scanners that carried
  `allow_failure: true` and had been red for weeks. The history keeps it; the header of `ci.yml`
  documents the port line by line.

- **CD** — ⚠️ **THERE IS NONE**, today. Reported by the Dev on 2026-09-07: **no Cloudflare Pages project
  is connected to any repository**. The previous caveat — that the connection pointed to GitLab, which is now
  archived — described a disconnected deploy; the current state is simpler and more serious to confuse:
  **a push is not a publication**, and `dist/` only reaches anyone through a manual step.
  The table below stays as the RECIPE for when there is a connection, and not as a description of what exists:

  | Setting | Value |
  |---|---|
  | Framework preset | **None** |
  | Build command | **`npm run test:node && npm run build`** — logic tests block a broken publication |
  | Build output directory | **`dist`** |
  | Root directory | *(repo root)* |

  It publishes on `*.pages.dev` (free HTTPS); branches/PRs generate *preview deployments*. The immutable cache
  of Vite's hashed assets + `dist/_headers` take care of the edge.

## Accessibility — what the engine demonstrates

- **WCAG 2.2 (POUR)** and **GAG** as non-negotiable pillars (see ADR-0010 in `the-inclusionist-docs`, and
  `docs/1-Discovery/NFR.md` for the testable thresholds).
- 100% keyboard operation via `e.code` (ABNT/QWERTY/alternatives), gamepad and touch; remappable.
- Vision: high contrast, colour blindness (Machado 2009 simulation + correction), low vision, blind mode.
- Audio as reinforcement, never a requirement; neural TTS narration that runs offline once downloaded; captions.
- Motor: wheelchair, one-button, easy mode, touch buttons sized in real millimetres.
- Deafness: Libras via VLibras (interim/online; our own engine planned).

## Status

Published as `@the-inclusionist/engine`; what the MVP is has not been decided (ADR-0152). Pending ratifications:
Lighthouse mobile, real target hardware (school tablet/Chromebook), automated audit (axe-core/Lighthouse/WAVE) and
manual audit (NVDA/JAWS/VoiceOver), and testing with children (including children with special educational needs).
**No "complete" conformance is claimed until the MVP is validated.**

## Origin

Preceded by a *tracer bullet* of 102 versions (v1.0.0 → v3.1.100) that ratified the accessible
architecture empirically; the final monolith (`v3.1.100.html`, ~3454 lines) is preserved in the **git
history** (recoverable with `git log --all --oneline -- legacy/v3.1.100.html`). v4 is the rewrite on PixiJS.
