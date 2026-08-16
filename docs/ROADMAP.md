# Roadmap

> **The executable roadmap is the issue board of
> [gitlab.com/jrocha-dev/the-inclusionist](https://gitlab.com/jrocha-dev/the-inclusionist/-/boards).**
> The phases are tracked there as the **Fase 0–6** issues. This document holds only the **stable strategy** — the
> principles and the *why* of the ordering — not the per-phase task lists (those live in the issues).

## Principles (hold in every phase)

- **Incremental, no behavior change:** each step = one atomic commit, verified in the preview, game identical.
- **Don't do work a foundational decision would invalidate** — that's why format/engine come before features.
- **Localize as you go (i18n):** every extracted UI module ships with `t()`/`data-i18n` (see `1-Discovery/plano-i18n.md` §4.2).
- **Pillars:** offline/PWA, lean runtime, a11y-first, GPL-clean.

## Phases and why this order (by dependency)

`0 (deploy, standalone)` → `1 (level format: unlocks the editor + tile materials)` → `2 (engine: unlocks
render/physics/input/art)` → `3 (art: depends on the engine's render/state)` → `4 (editors: consume the finished
subsystems — they validate the boundaries)` → `5 (i18n finalizes what was localized per module)` → `6 (features on a
clean base)`.

Detail per phase (steps + done-criteria) is in the corresponding roadmap issue; the design detail is in the referenced
`plano-*` / `educational/` docs.

## Flexibility point (Dev's call)

The **Fase 6** features could be pulled forward / interleaved for visible value before the whole structure is done —
the cost is touching code that will still be modularized. Recommended: structure-first (Fases 1–4), then Fase 6, as
decided; but items can be pulled into gaps if preferred.

## Current state (2026-07-05)

- **Fase 0** (deploy) — done (public repo + Cloudflare Pages).
- **Fase 2** (engine spine / modularization) — in progress (the current work).
- **Migration to TS + Vite** adopted 2026-07-04 (supersedes the old "no build" preference) — `2-Architecture/plano-typescript-vite.md`.
