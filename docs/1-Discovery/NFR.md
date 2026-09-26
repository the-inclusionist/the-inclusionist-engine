# NFR — Non-Functional Requirements

The project's hard, cross-cutting constraints — the **testable layer** of the 10 non-negotiable pillars.
**Accessibility lives here** (not a separate doc). Any trade-off against an NFR (e.g. WCAG level vs. cost) is recorded
as an **ADR**.

> **This is the testable derivation of the constitution.** The 10 pillars are the DECISION
> **[ADR-0010](https://github.com/the-inclusionist/the-inclusionist-docs/blob/main/docs/2-Architecture/adr/ADR-0010-non-negotiable-pillars.yaml)**; the other ratified decisions are their
> own ADRs in `../2-Architecture/adr/` (the engine's) or in `the-inclusionist-docs` (the whole project's, ADR-0242); the legal/compliance analysis is in `../research/compliance-legal.md`. NFR
> carries only the **testable thresholds** (the verifiable form of each pillar).

Where a requirement is machine-verifiable, it carries a **threshold** (the testable part).

| # | NFR | Requirement | Threshold / test |
|---|-----|-------------|------------------|
| 1 | **Hardware** | Runs on weak Brazilian public-school devices (Positivo tablet, Chromebook) | Lighthouse Perf ≥ 90 (Tablet + 3G + 4× CPU); **60 fps** on the scaled 320×180 canvas; small bundle, no heavy framework on the critical path |
| 2 | **Accessibility** | WCAG 2.2 + GAG + stricter norms (**GB/T 37668-2019** CN, **EN 301 549 / EAA** EU); AAA aspirational, AA honest per surface | axe-core = 0 A/AA violations; contrast per surface; touch targets ≥ physical target; **all text/UI in the DOM, never rasterized on the canvas** (P2 × P5); 100% keyboard via `e.code`; **non-text/icon navigation** for pre-readers; sufficient reading time; third-party AT compatible; `prefers-*` honored |
| 3 | **i18n** | UI + math + play localizable; pt base, en/es waves, then nordic | every extracted UI module ships with `t()`/`data-i18n`; no hardcoded strings; `lang`/`dir` correct; fonts cover `å ä ö ø æ` |
| 4 | **Compliance** | LGPD + COPPA + China + Nordic — **local law of the deployment region wins**, others are goals | no child PII to third-party SaaS; **RN-02**: never store the adult's identity — keep at most a consent token/boolean (verification delegated to gov); consent before any personal data; **RN-04**: player telemetry stays in its country of origin (export only if the origin permits); **40-min session lock** (China Youth Mode); **export all progress** (Nordic transparency); behaviour analytics anonymous + out-of-game panel only |
| 5 | **Pixel grid** | 320×180 logical (Libras 420×180, 21:9) | integer real-pixel scaling; scanlines regular at any dpr; **Libras panel ≥ ¼ width × ½ height (ABNT NBR 15290:2005)** — ours = 25% × 100% ✓; **nothing overlays the interpreter window** (the 5px advance is interpreter-over-game, never the reverse) |
| 6 | **Telemetry** | 1EdTech (LTI 1.3) + Caliper + xAPI, child-privacy-strict | store-and-forward, not live cloud (deferred; ADR when adopted); **RN-01**: no open child data — anonymous-only via a vetted-institution partnership, never child PII; no behavioural profiling / ad targeting of children |
| 7 | **Multiplayer** | Separate screens per player (no split-screen), local | independent viewports over one shared in-memory sim; no netcode in MVP |
| 8 | **Offline** | Fully playable offline (PWA now; Tauri / Tauri Mobile later) | works with network disabled after first load; one PWA base wrapped by Tauri per target — never duplicate logic per target |
| 9 | **LAN** | LAN + store-and-forward telemetry | (deferred) queue in IndexedDB + Background Sync; batch on reconnect |
| 10 | **Licensing** | AGPL-3.0 code + non-FOSS art + free + funded | no embedded PNG in-game (art = data); license gate before publish; art protected by trademark (selective), not by GPL |

> These 10 are the non-negotiable pillars **as testable constraints**. Their strategic values, tensions, and the
> ratified decisions/legal analysis behind them live in the constitution index + `adr/` + `research/` (see the note above).
