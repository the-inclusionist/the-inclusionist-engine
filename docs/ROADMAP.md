# Roadmap

> **The executable roadmap is the issue tracker of
> [the-inclusionist/the-inclusionist-engine](https://github.com/the-inclusionist/the-inclusionist-engine/issues).**
> The phases are tracked there as the **Fase 0–6** issues.
> ⚠️ **Migrado em 2026-09-06 e os NÚMEROS sobreviveram**: as 101 issues foram recriadas em ordem crescente num repositório de contador zerado, então `#1`–`#101` apontam para as mesmas coisas. Todo `#N` escrito antes dessa data continua válido. The GitLab board it used to name is archived. This document holds only the **stable strategy** — the
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

- **Fase 0** (deploy) — ⚠️ **NÃO está done, e a linha dizia que estava.** Ela lia «done (public repo +
  Cloudflare Pages)», escrita em 2026-07-05, quando era verdade. Em 2026-09-07 o Dev informou que **nenhum
  projeto do Cloudflare Pages está conectado a repositório nenhum**. O repositório também não é público (a
  organização é privada até o ato — ADR-0066). O que a Fase 0 de facto entregou e continua entregue é o
  **pacote publicado** no npmjs (`@the-inclusionist/engine@7.0.1`, ADR-0072); o deploy da página não.
- **Fase 2** (engine spine / modularization) — **DONE (2026-09-07)**, and it delivered more than it promised.
  Its own criterion was "game.js dissolved into clean-boundary subsystems, game identical, `__incl` preserved,
  all green". Measured: `game.js`, `main.js` and `main.ts` no longer exist in `app/`; the composition root is
  `app/js/boot/create-game.ts`; the top-level state moved into the instance the root owns (`createRunState`,
  ADR-0038); node and browser suites and `tsc` are green.
  ⚠️ **And the boundary ended up being BETWEEN REPOSITORIES**, which was not what the phase asked for: the
  whole cartridge left for `game-platformer` (`b55b88e`, −15 943 lines, issue #111). That is stronger than
  "clean-boundary subsystems", and it is why Fases 3–6 are no longer gated by this one.
- **Migration to TS + Vite** adopted 2026-07-04 (supersedes the old "no build" preference) — `2-Architecture/plano-typescript-vite.md`.
