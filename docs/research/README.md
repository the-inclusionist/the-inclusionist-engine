# research/ — studies that back decisions

Cross-cutting **research-first** studies (with sources) that justify a decision but aren't themselves a phase artifact.
A study here is the evidence an ADR or plan points back to.

**Migration target:** the existing `../PESQUISA-*.md`, `../ESTUDO-FONTES*.md`, and similar study docs move here during
the docs consolidation (issue #1).

## Contents

- **`AUDIT-E13-axe.md`** — axe-core a11y audit (2026-06-01, v4.0.0): 0 WCAG A/AA violations in our app;
  the 5 ADR-001 validation gates (hardware/screen-reader/children) → tracked as issues #12–#14, #19. Evidence for the
  a11y claims; the reproduction snippet lives here.

Migration round 2 (2026-07-05) — studies relocated intact (their findings feed the canonical docs noted):

| Study | Backs (feeds into) |
|---|---|
| `RESEARCH-HIGH-CONTRAST.md` | future high-contrast redo (CLAHE/VCEA) → NFR/Design |
| `RESEARCH-DALTONIZATION.md` | canonical colorblind sim/fix matrices → Design |
| `RESEARCH-FONTS-CONDITIONS-LITERACY.md` · `STUDY-FONTS.md` | typography/legibility choices → Design (issue #2) |
| `LICENSES-IMAGE-GENERATION.md` | AI-image-gen licensing vs GPL (draft, validate w/ legal) → art pipeline |
| `ADVERSARIAL-ASSESSMENT-PREMORTEM.md` | risk/red-team assessment → NFR + roadmap |
| `audit-v3-environment-richness.md` · `pixellab-credits-audit.csv` | evidence for the procedural-art pillar |

- **`compliance-legal.md`** — legal/compliance analysis extracted from PILARES (P4/P5/P6/P10): region regimes
  (LGPD/COPPA/PIPL/GDPR), the local-law-wins model, RN-01..04, ABNT NBR 15290 (Libras), funding × licensing. Feeds
  NFR (testable rules) + adr (decisions). *Engineering summaries, not legal advice.*
- **`GAPS-V3-vs-V4.md`** — v3→v4 gap analysis (2026-06-01, 4 subagents). Mostly closed since; the open
  character-diversity items → `game-design/plan-procedural-art.md` + `character-animation.md`.
- **`internet-multiplayer-security.md`** (#29) — threat model for the deferred internet-MP tier (ADR-0008): the
  "no stranger contact / adult-mediated closed sessions / no open chat" rule + STRIDE + child-safety. Feeds a future ADR.
