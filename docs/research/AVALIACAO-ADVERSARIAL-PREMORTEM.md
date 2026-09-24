---
title: Adversarial assessment + premortem — The Inclusionist / EdSP
type: assessment
status: round-2
created: 2026-06-01
method: 3 independent subagents (licences, red-team, premortem)
---

Historical assessment (2026-06-01): kept as a record; the current state lives in `docs/ROADMAP.md` and in ADR-0010 (the non-negotiable pillars, in `the-inclusionist-docs`).

# Adversarial assessment + premortem

Result of an **adversarial attack** and a **premortem (Dec/2026)** carried out by independent
subagents. Converging verdict: **the constitution is excellent as a 10-year north star and
fatal as an MVP requirements list.** Risk no. 1 is not technical — it is **premature
platformisation**: governance of 35 games on top of a one-file prototype never tested on a real
tablet nor with a real child.

## The central reframing (it reconciles everything)

> **Separate the NORTH STAR (non-negotiable, 10 years) from the MVP (minimum viable, 6 months).** The 10 pillars
> remain the **destination**. But the MVP needs **a drastically smaller subset**,
> or nothing ships. This honours the non-negotiables (they remain the goal) and makes the MVP shippable.

## Top 10 threats (red-team)

| # | Threat | Sev | Death condition |
|---|---|---|---|
| 1 | **Solo dev × 35 games, infrastructure-first** | 🔴 | years of platform, nothing shipped, donors vanish |
| 2 | **PixiJS+WebGL/Tauri Mobile untested on the real Positivo/Chromebook** | 🔴 | the mission's device does not run it; found out late |
| 3 | **Contradictory compliance; China out of reach** | 🔴 | China real-name **conflicts** with COPPA/LGPD minimisation; 版号 unfeasible for a solo dev |
| 4 | **Children's telemetry + open data without a research/legal partner** | 🔴 | 1 de-anonymisation = a scandal that kills the brand |
| 5 | **Claiming "WCAG 2.2 AAA + GAG complete" (false today and self-contradictory)** | 🔴 | a Nordic auditor refutes it in 20 min; credibility goes |
| 6 | **No school adoption plan (BNCC/MDM/installation/PNLD)** | 🟠 | a perfect game nobody installs = zero impact |
| 7 | **Rewriting LAN multiplayer/separate screens** | 🟠 | heavy netcode for a scenario schools do not set up |
| 8 | **Funding: donations→slow grants vs. multi-year infrastructure** | 🟠 | no money in the short term; grants require a CNPJ/partner/track record |
| 9 | **Sign language per locale (6 languages) + a zdog engine from scratch** | 🟠 | signing 6 distinct languages is a research programme |
| 10 | **BSL as "open source" + GPL dual-track per module + AI art IP** | 🟠 | the label scares off FOSS funders; segregating modules is an eternal tax |

### Real contradictions between pillars (not just *tensions*)
- **China real-name/anti-addiction (collects MORE PII from minors) × COPPA/LGPD/GDPR-K (collect LESS).**
  *The strictest rule wins* is **self-contradictory** here → it would require **mutually exclusive
  regional builds**, which **breaks** *one PWA codebase, never duplicate logic* (P8).
- **China data localisation (PIPL) × open data (P6c).** Anonymising/aggregating is a way out of
  GDPR, **not** an automatic exemption from the Chinese export regime.
- **AAA × 320×180 × vivid palettes** (CLAUDE.md §2.7 itself says *do not sell AAA wholesale*;
  the README says "AAA + GAG complete" → **the two documents contradict each other**).
- **Libras panel 21:9 (+100px) × real 16:9 screens:** on a 16:9 tablet/Chromebook **there is no
  physical width to *add*** → either the world shrinks (letterbox) or it scrolls. Rethink it as an
  **overlay that reflows inside 16:9** (a corner window at the legal proportion), not +100 physical px.

## Premortem — most likely cause of death

**Death by premature platformisation:** document/governance work crowds out shippable,
validated progress; the teacher-developer's finite hours run out before any external reality
check. **It is already happening** — on 2026-06-01 a constitution + a plan + a
**double reversal** (PNG→data→data) were produced while the **game remains at v3.1.100** and the **only
critical bug (B2)** remains open. The incentive gradient points to docs (`[CLAUDE]`, infinite,
never blocked); the validation that would kill the project early if it is going to die (real hardware,
5 children) is all **`[DEV]`-gated and all open**.

### Warning indicators (ranked)
1. **The *current good build* ages** (>3 weeks without a runnable version while the effort goes elsewhere).
2. **The `[DEV]` validation backlog freezes** (2+ months without closing any of the 5 gates of ADR-001).
3. **Re-litigation of decisions** already *ratified* (PNG↔data is already on its 2nd reversal).
4. **Commit cadence decays** (from ~daily to weekly to monthly).
5. **The repo never goes public** (the tarball still has no GitHub remote).
6. **The doc/code ratio** shoots up (`.md` words/week ≫ game lines/week).
7. **Flagship bugs untouched** (VLibras toast, B2) for several sessions.
8. **Scope grows before the slice closes** (zdog Libras, Nordics, LAN MP built before Lúdico passes the 5 gates).

### Preventive actions NOW (cheap, high impact)
1. **A *validation first* sprint + freeze the architecture.** Run the 5 gates of ADR-001 against the
   **existing v3.1.100** — several do **not** depend on the Dev: axe-core via Playwright + Lighthouse
   (4×CPU/3G) **run today** (`[CLAUDE]`). **One afternoon with 1 real Positivo tablet** validates or kills
   the premise at ~zero cost.
2. **Freeze the constitution; a *no re-litigation* rule.** New conflicts go to `OPEN-QUESTIONS.md`,
   reviewed **monthly**, never in the middle of the build. It kills the *round 2/3* churn.
3. **Postpone the PixiJS rewrite until performance is MEASURED as insufficient.** Do not rewrite a
   build that works and has already won its a11y on the basis of an unmeasured hypothesis. (⚠️ revisits the
   *That is why PixiJS* decision — see below.)
4. **Publish the repo this week** (BSL-1.1). It creates surface for the Mom Test, contributors, legitimacy.
5. **Close B2** (remap persistence) in the next session (~30 min) — an *alive and shipping* signal.
6. **Time-box the IP research to 1 week** (default already decided: art as data/code).
7. **One external commitment** (a real date with the ~5 children the Dev already teaches, or 1 call-for-funding deadline).

## Realistic 6-month scope (what must be TRUE in Dec/2026)

- **The Inclusionist in ONE mode (Lúdico)** runs and is **verified** on ≥1 real Positivo tablet and ≥1
  real government Chromebook.
- **The 5 gates of ADR-001 CLOSED** with numbers: Lighthouse ≥90 (4×CPU/3G), axe 0, 1 run on
  real hardware, 1 screen-reader pass (NVDA *or* ChromeVox), **Mom Test with ~5 children
  (1 with SEN)**. *(This is the whole game of a tracer bullet.)*
- **Public repo** (BSL-1.1) with a README a stranger can run.
- **v3.1.100 stays canonical and improving** (B2 fixed; C1 SFX captions; touch buttons). No
  abandoned half-rewrite.
- **Honest a11y statement published:** AAA where achieved, AA where not, with audit evidence.

### Cut/postpone from the MVP (they stay in the NORTH STAR)
| Vision item | MVP | Why |
|---|---|---|
| 35-game platform / EdSP governance | **postpone** (freeze the constitution) | 1 validated game first |
| PixiJS rewrite (v4.0.0) | **postpone until measured** | do not rewrite an a11y-ratified build on a hypothesis |
| zdog Libras 21:9 + Nordic languages | **cut from the MVP** | a 2nd engine before auditing the 1st; Libras-only later |
| Nordic i18n | **postpone** (keep strings externalised) | zero ROI before the BR launch |
| Separate-screen multiplayer + LAN | **cut from the MVP** | a netcode rewrite for a coin slice |
| Tauri + Tauri Mobile | **postpone** (PWA only) | PWA covers Chromebook (1st class) and Positivo |
| China (版号/PIPL/anti-addiction) | **cut from the MVP** | needs a local partner that does not exist |
| 1EdTech LTI + Caliper + xAPI | **postpone** (local-first, no telemetry) | the largest privacy surface; nothing to measure without players |
| Open data (RN-01) | **postpone** | there is no data yet; it is a policy for a future |
| Grants (Rouanet/Ancine/FAPESP/Nordics) | **pick ONE, submit ONE** | a forcing function, not researching nine |

## Suggested improvements to the pillars (not silent — you decide)
- **P2/README:** replace "AAA + GAG complete" with **"WCAG 2.2 AA conformant; AAA where feasible,
  documented per criterion; GAG: N/M"**. Fix the README × CLAUDE.md contradiction.
- **P4:** demote **China from a pillar to *Phase N, requires a local partner***; make **LGPD+COPPA the
  real spine**. Keep only the portable parts (pluggable residency, content trail).
- **P5:** rethink the geometry of the Libras panel (an overlay that reflows in 16:9); confirm the NBR 15290 metric.
- **P6:** **no personal telemetry in the MVP**; LTI/xAPI/Caliper + open data only with a **university
  partner** that holds the IRB/ethics + differential privacy.
- **P7/P9:** demote separate-screen/LAN multiplayer to a **future R&D track**; keep the current local 2P.
- **P8:** **PWA-first** confirmed; Tauri/Tauri Mobile postponed.
- **P10:** consider **a single licence** (GPL-3.0 right now maximises FOSS eligibility and removes the
  dual-track tax); BSL adds ~zero to a free game nobody resells.
- **Art:** **use the Dev's own Nanobanana art** (IP-clean) as reference → eliminates the generators' IP risk.

## The Dev's answers (round 4)
- **PixiJS:** **postponement DENIED** — a new version using PixiJS is the request. *Agreed mitigation:*
  validate performance **early** on the **2 real tablets** the Dev already has (1 low-cost + 1 from the government/pandemic).
- **Licence:** **GPL-3.0 right now** (no BSL/dual-track). ✅ [Today: the code licence is AGPL-3.0-or-later (`package.json`), changed on 2026-08-25 per ADR-0010 pillar 10.]
- **Tauri / multiplayer / China / Nordics:** **out of the MVP** (they stay in the North Star). ✅
- **35-game infrastructure-first scope:** accepted — focus on 1 game first. ✅
- **Hardware:** **2 tablets acquired** → the *test on a real Positivo* gate stops being a blocker. ✅
- **Compliance:** **priority = the local law of the region**; the rest = a goal as far as possible. Identity of the
  **adult** via gov (.gov BR; RNV only in China) → **does not contradict LGPD/COPPA** (guardian's consent). ✅
- **Telemetry/data:** **no open data**; only **anonymous data via a reputable partnership**. ✅
- **a11y:** **remove "complete"** now; put it back only with the MVP ready and validated. ✅
