# Roadmap

> 🔴 **THIS FILE IS THE ROADMAP. It stopped pointing at the issue tracker on 2026-09-09 (ADR-0126).**
> It used to open with «the executable roadmap is the issue tracker … the phases are tracked there as the
> **Fase 0–6** issues», and that line is what put seven phases into a tracker whose job is buildable work.
> A phase is a CONTAINER, not a problem with a fix — nothing a commit does closes it, which is why one of them
> was once closed by editing a document. The per-phase steps and done-criteria that lived in those issues are
> below, where they can be read in one place and where changing one is an edit rather than a ticket.
>
> Issues remain the tracker for **problems solvable by code**. A phase's work still becomes issues — one per
> problem, as it becomes real.

## Principles (hold in every phase)

- **Incremental, no behavior change:** each step = one atomic commit, verified in the preview, game identical.
- **Don't do work a foundational decision would invalidate** — that's why format/engine come before features.
- **Localize as you go (i18n):** every extracted UI module ships with `t()`/`data-i18n` (see `1-Discovery/plano-i18n.md` §4.2).
- **Pillars:** offline/PWA, lean runtime, a11y-first, AGPL-clean.

## Phases and why this order (by dependency)

`0 (deploy, standalone)` → `1 (level format: unlocks the editor + tile materials)` → `2 (engine: unlocks
render/physics/input/art)` → `3 (art: depends on the engine's render/state)` → `4 (editors: consume the finished
subsystems — they validate the boundaries)` → `5 (i18n finalizes what was localized per module)` → `6 (features on a
clean base)`.

### Fase 0 — Publish (deploy)

Push public GitHub + connect Cloudflare Pages (output `app/`).
**Done when:** `*.pages.dev` is live and every push auto-deploys.

⚠️ **NOT done, and the issue said it was.** It read «done (repo public + CF Pages connected)», true when written
on 2026-07-05. Measured since: the Dev stated on 2026-09-07 that **no Cloudflare Pages project is connected to
any repository**, and the organisation is private (ADR-0066 — now superseded by **ADR-0125**, which decides it
goes public). What Fase 0 did deliver, and still delivers, is the **published package** on npmjs
(`@the-inclusionist/engine`, ADR-0072); the page deploy did not happen.

### Fase 1 — Level subsystem: glyph map format + editor

`core/tiles` (glyph legend) + `parseLevel` + bit-exact round-trip test vs `CLARITY_MAP`; explicit async boot;
migrate `CLARITY_MAP` → `assets/levels/ludico.map.txt`; `tools/map-editor.html`.
**Done when:** the game loads the `.map.txt` (world identical) and a map can be edited and validated.
Detail: `plano-editor-mapa`, `plano-engine`.

📌 The `CLARITY_MAP` migration is now the **cartridge's**, not the engine's — the whole game left for
`game-platformer` in `b55b88e` (issue #111).

### Fase 2 — Engine spine (modularization) — **DONE (2026-09-07)**

Its own criterion was «`game.js` dissolved into clean-boundary subsystems, game identical, `__incl` preserved,
all green». Measured: `game.js`, `main.js` and `main.ts` no longer exist in `app/`; the composition root is
`app/js/boot/create-game.ts`; the top-level state moved into the instance the root owns (`createRunState`,
ADR-0038); node and browser suites and `tsc` are green.

⚠️ **And the boundary ended up being BETWEEN REPOSITORIES**, which is not what the phase asked for: the whole
cartridge left for `game-platformer` (`b55b88e`, −15 943 lines, issue #111). That is stronger than
«clean-boundary subsystems», and it is why Fases 3–6 are no longer gated by this one.

### Fase 3 — Art subsystem (semantic procedural)

`art/semantic` + palettes + recolor; high-contrast becomes a palette; migrate characters and tiles to the
semantic system (PNG = authoring only).
**Done when:** a recolorable character (skin/clothes/hair) and high-contrast through the new engine, with no
visual regression. Detail: `plano-arte-procedural`.

### Fase 4 — Art editor + importers

`tools/art-editor.html` (png → annotate colour → `(region, luminosity)` → preview → save semantic image);
Aseprite/Libresprite import; Tiled/LDtk import.
**Done when:** external art can be imported, annotated and used in-game.
Detail: `plano-arte-procedural`, `plano-tiled-aseprite`.

### Fase 5 — i18n: complete en/es

Per-locale voice, 🌐 selector, browser default + persistence; en and es complete (UI + Math + Lúdico); literacy
stays pt-BR, because curriculum is per-language and is REWRITTEN rather than translated (pillar 3).
**Done when:** switching language changes all UI + Math/Lúdico + voice, offline, with no reload.
Detail: `plano-i18n`.

### Fase 6 — Pedagogical features + audit

Literacy games (grapheme-phoneme, Braille grid, writing, VLibras deaf mode); webcam (MediaPipe) + voice;
refinements; final WCAG 2.2 / GAG audit.
**Done when:** the six literacy games are complete and the a11y audit has passed.
Detail: `docs/educational/plano-alfabetizacao`. Related issues: #11 (webcam), #12 (refinements), #13 (audit).

📌 **The webcam provider is decided**: MediaPipe, not WebGazer (**ADR-0124**) — and the swap is not a port.
MediaPipe returns iris LANDMARKS; WebGazer returned a gaze POINT, so the regression and its calibration are
this project's to build.

## Flexibility point (Dev's call)

The **Fase 6** features could be pulled forward or interleaved for visible value before the whole structure is
done — the cost is touching code that will still be modularized. Recommended: structure-first (Fases 1–4), then
Fase 6, as decided; but items can be pulled into gaps if preferred.

## Other standing facts

- **Migration to TS + Vite** adopted 2026-07-04 (supersedes the old «no build» preference) —
  `2-Architecture/plano-typescript-vite.md`.
- ⚠️ **Issue numbers survived the 2026-09-06 migration**: the 101 issues were recreated in ascending order in a
  repository with a zeroed counter, so `#1`–`#101` still point at the same things. Every `#N` written before
  that date remains valid. The GitLab board this file used to name is archived.
