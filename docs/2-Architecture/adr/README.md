# Architecture Decision Records (YADR)

One file per deliberate architectural decision, in **YADR** format — the YAML sibling of MADR
([adr/yadr](https://github.com/adr/yadr)). Pure YAML so records are **machine-readable** (filter/index by
`metadata.status`, generate the table below, lint against a schema later).

- **Format:** `templates/yadr-template-full.yaml` from the upstream repo. Keys, in order: `metadata`
  (`status`, `date`, `decision-makers`, `consulted`, `informed`) → `title` → `context-and-problem-statement` →
  `decision-drivers` → `considered-options` → `pros-and-cons-of-the-options` → `decision-outcome`
  (`chosen-option{link,justification}`, `consequences{positive,neutral,negative}`, `confirmation`) → `more-information`.
- **Naming:** `ADR-NNNN-short-slug.yaml`, 4-digit zero-padded, monotonic.
- **Immutable:** to change a decision, write a **new** ADR and set the old one's `metadata.status` to
  `"superseded by ADR-NNNN"`. Never edit an accepted decision — refactors **supersede**, they don't pile up.
- **Big design docs that *are* a decision** (e.g. the modularization plan, `../../5-Refactoring/plano-modularizacao.md`, built on
  arXiv:2409.15152) act as ADRs too — link them from the table rather than duplicating.
- **Upgrade path:** if LGPD/compliance needs an audited, CI-validated decision log, adopt **Structured MADR**
  ([smadr.dev](https://smadr.dev/)) — our YAML frontmatter is already close.

## Records

| ADR | Decision | Status |
|---|---|---|
| [ADR-0001](ADR-0001-integer-real-pixel-canvas-scale.yaml) | Lock canvas scale to integer real pixels | accepted |
| [ADR-0002](ADR-0002-dom-activities-ui-light-dom-web-components.yaml) | DOM activities UI: light-DOM Web Components + Atomic Design; no Shadow DOM | accepted |
| [ADR-0003](ADR-0003-tiered-sdd-documentation-subset.yaml) | Tier-2 lean subset of the SDD doc schema (adopt/defer/reject matrix) | accepted |
| [ADR-0004](ADR-0004-educational-documentation-subset.yaml) | Educational-software doc subset (learning artifacts + e-learning interop) | accepted |
| [ADR-0005](ADR-0005-no-login-access-teacher-activity-code.yaml) | Access: no login, teacher activity-code, icon-based non-text nav | accepted |
| [ADR-0006](ADR-0006-ethical-engagement-wellbeing.yaml) | Ethical engagement: no dark patterns, cooperative, play-based, session limit | accepted |
| [ADR-0007](ADR-0007-ai-content-human-curation.yaml) | AI content gated by human curation (human accountable) | accepted |
| [ADR-0008](ADR-0008-multiplayer-scaling.yaml) | Multiplayer scaling: 4/screen → classroom LAN → internet after study | accepted |
| [ADR-0009](ADR-0009-game-documentation-subset.yaml) | Game-dev doc subset (LM-GM + light per-game; defer networking; reject MMO/economy/live-ops) | accepted |
| [ADR-0010](ADR-0010-non-negotiable-pillars.yaml) | The 10 non-negotiable pillars (constitution) — was PILARES-INEGOCIAVEIS | accepted |
| [ADR-0011](ADR-0011-visual-accessibility.yaml) | Visual accessibility (high-contrast, colour-blind, low-vision, TEA) | accepted |
| [ADR-0012](ADR-0012-typography.yaml) | Typography (font roster, spacing) | accepted |
| [ADR-0013](ADR-0013-motor-input-accessibility.yaml) | Motor & input accessibility (touch, gamepad, keyboard, easy mode, wheelchair) | accepted |
| [ADR-0014](ADR-0014-auditory-accessibility.yaml) | Auditory accessibility (mixer, blind mode, TTS) | accepted |
| [ADR-0015](ADR-0015-pedagogy-and-game-modes.yaml) | Pedagogy & game modes (quiz levels, per-player, reduce-motion) | accepted |
| [ADR-0016](ADR-0016-city-scenario-and-themes.yaml) | City scenario & theme decisions | accepted |
| [ADR-0017](ADR-0017-compliance-and-data-governance.yaml) | Compliance & data governance (local-law-wins, RN-01..04) | accepted |
| [ADR-0018](ADR-0018-art-and-visual-design.yaml) | Art & visual design (art=data, juice, CRT, CB-safe) | accepted |
| [ADR-0019](ADR-0019-adopt-typescript-vite.yaml) | Adopt TypeScript + Vite (supersedes "no build") | accepted |
| [ADR-0020](ADR-0020-canonical-z-order-and-post-fx.yaml) | Canonical Z-order registry (world/overlay, PIXI+DOM) + post-FX filter chain | accepted |
| [ADR-0021](ADR-0021-tts-npm-lib-and-r2-model.yaml) | Neural TTS: npm-bundled lib; voice model stays on HuggingFace, OPFS-cached (R2 rejected; supersedes lazy-CDN) | ~~superseded by 0022~~ |
| [ADR-0022](ADR-0022-tts-sherpa-onnx-wasm-runtime.yaml) | Neural TTS runtime = sherpa-onnx-wasm (any VITS/Piper .onnx, any CORS host, offline); pt-BR miro-high/faber/jeff; eSpeak keeps phonemes | accepted |
| [ADR-0023](ADR-0023-research-labs-are-first-class-apps.yaml) | Research labs (TTS lab et al.) are first-class TS/Vite/DI/tested apps (ports/adapters), not throwaway spikes; staged migration | accepted |
| [ADR-0024](ADR-0024-multi-repo-versioned-shared-packages.yaml) | Multi-repo + versioned shared packages (`@jrocha-io/*`); no CDN; scoped COOP/COEP | accepted (topology amended by 0025; registry/host superseded by 0026) |
| [ADR-0025](ADR-0025-inclusionist-lab-hub-repo.yaml) | One `inclusionist-lab` hub repo (labs as subpages of a multi-page app); `the-inclusionist` = game only (amends 0024) | accepted (host addresses superseded by 0026) |
| [ADR-0026](ADR-0026-move-hosting-to-gitlab.yaml) | All hosting on GitLab — code, backlog, CI and the npm registry (supersedes the GitHub half of 0024) | accepted |

> ADRs 0011–0019 replaced the informal `REGISTRO-DE-DECISOES.md` log (a decision is an ADR). The exhaustive per-row
> detail of the old log is in git history; these ADRs carry the decisions + rationale.
