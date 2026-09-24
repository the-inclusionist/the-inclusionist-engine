<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# E15 — Layered character + animations (spec)

> 📌 **Where this lives now:** the character, its sprite frames and the code that draws them left this repository with
> the cartridge on 2026-09-07 (#111), and the frame-drawing module left in the F12 move (ADR-0228); they are the
> platformer's, in `game-platformer`. This spec stays here as the design record. `render/draw`, named below, is no
> longer in this tree.

**The Dev's decisions (2026-06-01):**
- **Resolution kept** (320×180, 16px tiles) — 48×48 cancelled (ADHD study pending). **NO FIXED sprite
  SIZE** (amended and RE-MEASURED on 2026-08-25): this document said 16×32 and none of the 80 PNGs delivered has that
  size. The 39 sprite frames cover **13 animations** in **15 distinct sizes**, widths 24–34 and heights
  29–36, plus a forgotten 64×64. And the size **varies within the same animation** (`nadar` 34×29 and 34×32; `pulo`
  26×32 and 28×30) — there is not even a per-animation size to lean on. See the "Sprite size" section of
  [`Art-Bible.md`](Art-Bible.md) for the measurement and the consequences (the atlas cannot assume a uniform grid, neither
  per sheet nor per animation; each sprite carries its own pivot, because `render/draw` anchors the squash &
  stretch AT THE FEET).
- **Orientation:** character in **profile**, facing the **last direction** (E/W). **Always breathing/animating** (idle never static).
- **Procedural layers:** body + hair + clothes as layers (palette-swap by key + overlays) → diversity
  (5 Fitzpatrick tones, various hair/clothes), distinct players in multiplayer. **No embedded PNG** (GPL-clean);
  PixelLab generates only a **design reference**, converted by hand into a procedural sprite.

## Pipeline (validated in the proof)
PixelLab (reference) → extract palette/pose → **procedural sprite** (pixel-data + hex palette) → layer system.
Proof done: side-view `Pip` → palette extracted → faithful procedural render (see `assets-ref/`, not versioned). The
original proof was on a 16×32 frame; the size belonged to the EXPERIMENT, it was not a spec — the art delivered later did not
follow it, and the Dev's decision is that there is no fixed size.

## Animations requested → PixelLab source

| # | Animation (the Dev) | PixelLab source | Type |
|---|---|---|---|
| 1 | **Always breathing** (living idle) | `breathing-idle` | template |
| 2 | Walk | `walking` | template |
| 3 | Run | `running-8-frames` | template |
| 4 | Jump from the ground | `jumping-1` / `two-footed-jump` | template |
| 5 | Jump off the wall (wall-jump) | "pushing off a wall to jump" | v3 custom |
| 6 | Change orientation (turn) | "turning around" | v3 custom |
| 7 | Crouch | `crouching` | template |
| 8 | Crawl | "crawling on belly" | v3 custom |
| 9 | Climb a wall | "climbing a wall" | v3 custom |
| 10 | Move hanging from the ceiling | "moving hand over hand on ceiling" | v3 custom |
| 11 | Climb up/down a ladder | "climbing a ladder" | v3 custom |
| 12 | Climb up/down a vine/rope | "climbing a rope" | v3 custom |
| 13 | Swim forwards/backwards | "swimming horizontally" | v3 custom |
| 14 | Swim down / dive | "diving downward swimming" | v3 custom |
| 15 | Swim up | "swimming upward" | v3 custom |
| 16 | Get out of the water | "climbing out of water" | v3 custom |
| 17 | Fly | "flying with arms out" | v3 custom |
| 18 | "Bottom on fire" jump (lava/fire) | "jumping in panic, bottom on fire" | v3 custom |
| 19 | "Sore bottom" jump (spikes) | "jumping in pain holding bottom" | v3 custom |

**Economy (Tier 1, 2000 generations):** generate only the **east** direction (mirror W in the engine) → 1 generation per animation.
Batch 1 (animation proof): #1 breathing-idle + #2 walking. Validate the conversion → scale to the rest.

## Status
- [x] `Pip` base (side reference) + proof of procedural conversion.
- [ ] Batch 1: breathing-idle + walking (being generated).
- [ ] Conversion of the animations into procedural frames.
- [ ] Layer system (Fitzpatrick skin + hair + clothes) + per-player distinction.
- [ ] Batches 2+: the remaining animations (#3–#19).
