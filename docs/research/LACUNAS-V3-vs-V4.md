<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
---
title: Gap analysis — v3.1.100 (monolith) → v4.0.0 (PixiJS)
date: 2026-06-01
method: 4 subagents in parallel (shell/UX · environments/themes · character · mechanics/systems)
sources: v3.1.100.html (~3454 lines) · v4.0.0/{game.js,index.html,style.css}
---

Historical study (2026-06-01): kept as a record; the current state lives in `docs/ROADMAP.md` and the issue board; the open character-diversity items are in `docs/game-design/plano-arte-procedural.md` and `docs/game-design/character-animation.md`.

# What v3 had and v4 still lacks

> v4.0.0 was a **validation-first rewrite** in PixiJS: it ported the **Clarity world**, the **base
> physics**, the **3 modes** (Lúdico/Soma-Sub/Sílabas) and ADDED a lot that is new (multiplayer 1–4,
> Braille, touch, minimap, PWA, VLibras, persistence). But, being a skeleton, it left out
> a large part of the **presentation layer** (screens/menus), the **environment system** and the
> **character diversity**. This document consolidates the survey of the 4 agents.

## 🔴 HIGH impact — structural regressions (essential parity)

| # | Gap | v3 (ref) | Why it matters |
|---|---|---|---|
| A1 | **Navigation shell missing** — no splash/title, no entry menu, no flow between screens | `gamePhase: title→modeselect→playing` (l.3108), `drawTitleScene` (l.3115), menu (l.338) | v4 boots straight into the game; there is no entry point, byline/version, nor *back* [Today: the title screen and menus exist, e.g. `app/js/ui/title.ts`, `app/js/ui/shell.ts`.] |
| A2 | **PAUSE screen non-existent** | `#pause-overlay` Back/Menu/Quit + Esc + focus trap (l.319-328, 3194) | **GAG/a11y regression** — pausing is a requirement; v4 does not pause in any way [Today: the pause exists, one list of options per ADR-0044, in `app/js/ui/pause-icons.ts`.] |
| A3 | **Character diversity lost** — 1 fixed character | `randomAppearance` + `SKIN_TONES` (5 Fitzpatrick), `HAIR/SHIRT/PANTS_COLORS`, `hairStyle`, `gender` (l.1295-1309) | **Violates the inclusion/representation pillar** (racial and gender). v4 tells players apart only by a uniform `tint` |
| A4 | **`drawGenderOverlay`/`drawHairOverlay`** (long hair+skirt; hairstyles) | l.2744-2758 | Female gender representation; lost in v4 |
| A5 | **The whole theme system** — only 1 fixed environment | `THEMES` (campo/cemitério/espaço/floresta/clássico), `SCENE_THEMES`, random draw, selection UI (l.1025-1043, 462-467) | It is the game's visual identity; without it there is a single dead scene |
| A6 | **Sky gradient (`drawBackdrop`)** | l.2867-2875 | The cheapest/most immediate visual change; v4 uses the solid colour `0x05070f` |
| A7 | **Full darkness inversion** + **`drawCaveRock`/`CAVE_PAL`** | bidirectional crossfade with hysteresis (l.2139-2151); mine rock per theme (l.1405-1425, 1036-1041) | v4 only reveals permanently (one-way), without the mine aesthetic — the *visual prize* of entering the dark |
| A8 | **Bunny-hop / jump chain** `[0,5,8,9][jumpChain]` | scales the jump when running over stone (l.2335-2353) | The heart of the platforming; v4 has a single fixed jump |
| A9 | **Flight (tile 8)** and **Wallcling/Spider (tile 14)** — whole mechanics | l.2257-2266 / 2272-2306 | Tiles 8/14 are inert in v4 |
| A10 | **Power-ups as map tiles** (7/12/13/14 via `applyItemPlacements`) | data-driven in `CLARITY_MAP` | v4 made 7/12/13/14 inert and made power-ups a dynamic spawn/bonus — diverges from the design |
| A11 | **Per-player HUD in MP** (P2-P4 scoreboard, finishing order) + **power-up inventory** | `#score-p2`, `finishOrder`, `updatePowerupsHUD` (l.308, 1844) | v4 supports 4 screens but the HUD only reflects the active player; the player does not see the active power-up |

## 🟡 MEDIUM impact — settings, feedback and a11y

| # | Gap | v3 |
|---|---|---|
| M1 | **Visual a11y options:** high contrast, colour-blind-safe palette, decorative animation (reduce-motion) | WCAG Visual panels (l.369, 423-434) |
| M2 | **High contrast of the character (`viewHC`)** — flat silhouette | l.2730, 2825 — a11y regression |
| M3 | **`drawHills`** (parallax hills) + **flora per theme** (`drawBgBush`, `THEME_FLORA`) + **surface grass** (`drawSurfaceGrass`) | l.2859, 2916-2955, 2615-2640 (R1 requested by the Dev) |
| M4 | **Truly distinct appearances per player** (not just `tint`) | P1≠P2 guarantee loop (l.1786-1797) |
| M5 | **`drawPlayerSwimming`** (rotated sprite in the water) + **red scare tint** | l.2734-2742, 2769 (v4 uses a blinking alpha) |
| M6 | **Timer** + time shown on victory | l.491, 2562-2566 |
| M7 | **Gamepad (Xbox)** + **P2+ remap** + **"PRESS START" drop-in** | `pollGamepads` (l.3331), `buildRemapUI` P1+P2 (l.3248) [Today: the gamepad is supported, in `app/js/input/gamepad.ts`.] |
| M8 | **Explicit difficulty** (`DIFF_PROFILES` easy/normal) + *toggle movement* | l.1668 |
| M9 | **Voice TTS (`speechSynthesis`)** | v3 speaks; v4 only uses `aria-live` [Today: the engine speaks, in `app/js/platform/tts.ts`.] |
| M10 | **Incremental trampoline chain** (`trampLevel` 5→8) + **turbo jump (jump15)** | l.2045-2053, 2345 |
| M11 | **On-demand LIBRAS toggle** (opt-in) + **fullscreen button** + **skip challenge** | l.3290, 365, 1914 |

## 🟢 LOW impact — polish / extras

| # | Gap | v3 |
|---|---|---|
| B1 | Signature decorations per theme: **clouds, birds, stars, fireflies, butterflies, earthworms, fog** | l.2877-3060 |
| B2 | **`?debug=true` panel** with TUNE knobs editable live | l.3385-3419 (the `TUNE` object already exists in v4) [Today: the panel exists, in `app/js/ui/debug-panel.ts`.] |
| B3 | Documentation tabs (Game/Design/Accessibility), generic toast, portrait-orientation warning, dynamic controls legend | l.278, 1897, 290, 1204 |

## ⚪ PROJECT pending items — missing from BOTH (not regressions)

- **1EdTech/xAPI/Caliper telemetry** (pillar P6) — never implemented in code.
- **i18n / Nordic languages** (pillar P3) — both 100% hardcoded pt-BR. [Today: the engine ships pt, en and es dictionaries, in `app/js/i18n/`.]
- **Mii-like customisation UI** + appearance persistence (backlog §6).
- **Trees of the Brazilian Forest** (species catalogue — backlog §7).

## ✅ Where v4 SURPASSES v3 (gains of the rewrite — not to be confused with gaps)

Persistence of controls in localStorage (the project's B2) · multiplayer **1–4 screens** (render-to-texture)
· **touch controls** (digital joystick) · fog-of-war **minimap** · **PWA/offline** · **VLibras**
integration · **Braille** mode · **assist** mode · **SFX captions** · upper/lower case mode ·
FPS HUD · skip-link/landmarks · axe audit (0 violations).

## ✅ Map audit — RESOLVED (2026-06-01): IDENTICAL map

Byte-by-byte audit of `CLARITY_MAP` (Node script): **v3 and v4 are identical** — both **62 rows**,
width 13–56, **0 different cells**, equal tile histograms. The supposed *divergence* was a
**mistake by the agent** (it read the outdated comment `// 58`; the real array has 62 rows in both).
There is no map error and no re-port needed.

**However:** the map contains tiles **7 (turbo jump ×1), 8 (flight ×1), 10 (gate ×7), 11 (key ×1)** that
v4 **does not use** as a mechanic (it treats 7/8 as inert; E12's gate/key are separate dynamic
spawns, not the map tiles). That is the physics/items gap (A8–A10/E18), not a map defect.

---

## Proposed parity roadmap (E14+) — suggested order

> One cohesive change per step, with a commit. The Dev defines/reorders.

1. **E14 — Navigation shell:** title/splash + menu + **pause** (A1, A2). *Unblocks the whole UX.*
2. **E15 — Character diversity:** `randomAppearance` + Fitzpatrick tones + hair/gender overlays + distinct appearances per player + character HC (A3, A4, M2, M4). *Inclusion pillar.*
3. **E16 — Theme system + sky + hills:** `THEMES` + `drawBackdrop` + `drawHills` + selection/random draw (A5, A6, M3-partial).
4. **E17 — Darkness inversion + mine rock:** bidirectional crossfade + `drawCaveRock`/`CAVE_PAL` (A7).
5. **E18 — Advanced physics:** bunny-hop/jumpChain + flight + wallcling + power-ups as map tiles + incremental trampoline (A8-A10, M10). *Before: audit `CLARITY_MAP`.*
6. **E19 — Full HUD/MP + timer + visual a11y options:** per-player scoreboard, power-up inventory, time, high contrast/CB-safe/reduce-motion (A11, M1, M6).
7. **E20 — Gamepad + P2+ remap + difficulty + TTS** (M7, M8, M9).
8. **E21 — Signature decoration per theme** (clouds/birds/fireflies/etc.) + flora/grass (B1, M3-rest).
9. **E22 — Extras:** debug panel, fullscreen, skip challenge, LIBRAS opt-in, tabs/doc (B2, B3, M11).
10. **(Project, outside parity):** telemetry, i18n, Mii-like, Brazilian Forest.
