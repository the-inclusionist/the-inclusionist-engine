Historical plan (2026-07-06): kept as a record; the current state lives in ADR-0020 (the canonical z-order, in `docs/2-Architecture/adr/`). [Today: `app/js/core/layers.ts` no longer exists; it left the engine with the tile world on 2026-09-23 (commit `87b6cdbe`).]

# Plan — rewiring the layers to `core/layers.ts` (canonical z-order) · issue !52 · ADR-0020

Convert ALL of the game's layers to the named z-order (`Z` in `app/js/core/layers.ts`). The end of
`addChildAt(camera.getChildIndex(neighbour))` and of the re-add-to-the-top hacks. The **world** (inside the `camera`) switches to
`sortableChildren=true` + `layer.zIndex=Z.*`; the **overlay** (DOM) uses `z-index:Z.*` via a CSS var/class.

> **Method:** one round per band; after each round the **Dev builds and we both test** (title + 4 v3 themes + City +
> menus + HUD + a11y modes). Concrete elements go in as `Z.BAND + a small offset` to **preserve the exact current
> order** (the rewiring is behaviour-neutral; it only swaps the z mechanism).

## Foundation (part of Round 1)
- `camera.sortableChildren = true` and `app.stage.sortableChildren = true`.
- Remove the hacks: the repeated `camera.addChild(fxG/carLayer/themeFxG/fogG)` (game.js:1185,1220) and
  `drawWeather`'s `app.stage.setChildIndex(weatherLayer, …)` (513) — replaced by `zIndex`.

## Inventory + assignment (every element)

### WORLD (inside `camera`, per viewport)
| Element | game.js | current z (hack) | → `Z.*` | Round |
|---|---|---|---|---|
| `parallaxLayers[0]` sky | 606 | addChildAt i=0 | `PARALLAX_4` | R1 |
| `parallaxLayers[1]` far | 606 | addChildAt i=1 | `PARALLAX_3` | R1 |
| `parallaxLayers[2]` near | 606 | addChildAt i=2 | `PARALLAX_2` | R1 |
| `starsG` (stars) | 683 | addChildAt(idx parallax[1]) | `SKY_ANIM` | R1 |
| `skyLayer` (world clouds/birds) | 1125 | addChildAt(idx worldSprite) | `PARALLAX_1+500` | R1 |
| `skyDecoG` (v3 screen clouds/birds) | 684 | addChildAt(idx worldSprite) | `BG_DECOR-500` | R1 |
| `decoLayer` (trees) | 774 | addChild | `BG_DECOR` | R1 |
| `waterFxG` (corals/seaweed/fish) | 1155 | decoLayer.addChild | `BG_DECOR+100` | R1 |
| `abandonG` (ruins, under the darkness) | 1094 | addChildAt(idx darkLayer) | `BG_DECOR+200` | R1 |
| `cityDecoG` (city deco) | 1093 | lifeLayer.addChildAt 0 | `BG_DECOR+300` | R1 |
| `worldSprite` (tiles) | 681 | addChild | `TILES` | R2 |
| `rampLayer` (wheelchair ramp) | 830 | worldSprite+1 | `SCENERY_INTERACT` | R2 |
| `ropeLayer` (rope) | 869 | worldSprite+1 | `SCENERY_INTERACT+10` | R2 |
| `elevLayer` (lift) | 902 | worldSprite+1 | `SCENERY_INTERACT+20` | R2 |
| **`extraLayer`** — gate | 798/803 | addChild | `SCENERY_INTERACT+50` | R2 |
| **`extraLayer`** — power-ups | 798/802 | addChild | `ITEMS+100` | R2 |
| `lavaFxG` (little lava dashes) | 1154 | lifeLayer.addChildAt 0 | `VFX_BACK` | R2 |
| `lifeLayer` (city critters) | 953 | addChild | `FAUNA_BACK` | R1 |
| `grassG` (grass/flowers) | 1138 | lifeLayer.addChildAt 0 | `FLORA_BACK` | R1 |
| `coinContainer` (coins/letters/shapes) | 724 | addChild | `ITEMS` | R2 |
| `playerSprite` / `allPSprites` | 1183/1219 | addChild | `PLAYER` | R2 |
| `caneLayer` (cane) | 926 | addChild | `PLAYER+10` | R2 |
| `chairLayer` (wheelchair) | 941 | addChild | `PLAYER+20` | R2 |
| `easyHitbox` (easy-mode hitbox) | 828 | addChild | `WORLD_A11Y` | R3 |
| `fxG` (particles/juice) | 1195 | addChild + re-add on top | `VFX_FRONT` | R3 |
| `carLayer` (cars) | 1037 | addChild + re-add on top | `VEHICLES` | R3 |
| `themeFxG` (v3 earthworms/fireflies/butterflies, in front) | 1139 | addChild + re-add on top | `FAUNA_FRONT` | R1 |
| `fogG` (fog) | 685 | addChild + re-add on top | `WEATHER-500` | R1 |
| `darkLayer` (blind darkening) | 742 | addChild | `DARK_WORLD` | R1 |

> `FLORA_FRONT` stays **reserved** (foliage that covers the player) — no element today; it comes in when there is a foreground plant.

### GLOBAL / OVERLAY (on the PIXI `app.stage` or in the DOM)
| Element | where | current z | → `Z.*` | Round |
|---|---|---|---|---|
| `camera` (the world) | app.stage | addChild / addChildAt 0 | base (zIndex 0) | R1 |
| `weatherLayer` (on-screen rain/flash) | app.stage | setChildIndex top | `WEATHER` | R3 |
| `titleG` (title scene) | app.stage | addChildAt(idx weather) | `MENU` (it is the menu screen) | R4 |
| `vpSpr`/`vpFrames`/`vpDots` (MP viewports) | app.stage | addChild | `HUD` (frames/dots) | R4 |
| `_minimap` | render/minimap | stage.addChild | `HUD+100` | R4 |
| `#game-hud` | CSS z-4 | 4 | `HUD` | R4 |
| `.touch` / `.touch-start` | CSS z-14/15 | 14/15 | `TOUCH_CONTROLS` | R4 |
| `#viz-overlay` / `#viz-indicator` | CSS z-8/20 | 8/20 | `WORLD_A11Y`/`HUD` | R4 |
| `.quiz` (activity) | CSS z-12 | 12 | `DIALOGUE` | R4 |
| `.pause-incanvas`/`.screen-pause` | CSS z-6 | 6 | `GAME_MSG` | R4 |
| `#game-region .overlay` (a11y modals) | CSS z-60 (+`_ovZ` JS) | 60 | `MENU` (range) | R4 |
| `.overlay` (global modal) | CSS z-50 | 50 | `MENU` | R4 |
| `.skip-link` | CSS z-100 | 100 | `CAPTIONS-? (a11y nav)` | R4 |
| **CRT vignette** `::before` | CSS z-5 | 5 | **POST_FX** (covers everything) | R5 |
| **CRT scanlines** `::after` | CSS z-500 | 500 | **POST_FX** (covers everything) | R5 |
| a11y filters (HC / CB / empathy) | (on the canvas today) | — | **POST_FX** (last; covers the menu) | R5 |

## Rounds (the Dev's build + test between each)
> **Correction (sortableChildren is all-or-nothing per container):** a child without a `zIndex` becomes 0 and collapses to the back. So the
> WHOLE world (the `camera`) migrates **in a single round** — every child gets its `zIndex` at once, reproducing the current
> order (**visual no-op**). The back/core/front cannot be sliced without breaking in the middle → the ~24 WORLD rows are **R1**.

- **R1 — the WHOLE WORLD (atomic):** `camera.sortableChildren=true` + `zIndex=Z.*` on ALL of the camera's children (sky →
  world-a11y), removing the `addChildAt(getChildIndex)` calls and the re-adds to the top. Target = **visual no-op**. *Test:* 4 v3 themes
  + City + blind/wheelchair — nothing changes order; items behind the player; gate; cars/fog in front.
- **R2 — OVERLAY (global stage + DOM):** `app.stage.sortableChildren` for `camera`(base)/`weatherLayer`/`titleG`/viewports;
  `z-index:Z.*` in the CSS for HUD/minimap/touch/quiz/pause/modals/menus. *Test:* menu over the HUD; modals stack; title; MP.
- **R3 — POST-FX (behaviour fix):** CRT + a11y filters covering **everything, including the menu**; `A11Y_CORRECTION` last;
  a11y **suppresses** the decorative CRT; the overlay switches to the **CB-safe palette**. *Test:* colour blindness/high contrast **on the menu**.

## Points the rewiring already fixes (bonus)
- **`extraLayer` mixed** the gate (scenery) + power-ups (items) → separated into `SCENERY_INTERACT` vs `ITEMS`.
- **Hacks that raise to the top again** (`fxG`/`carLayer`/`themeFxG`/`fogG` re-added at 1185/1220; `weatherLayer` at 513) → they become a declarative `zIndex`.
- **CRT/a11y did not cover the menu** (a reported bug) → solved in R5 (post-fx over the composed frame).
