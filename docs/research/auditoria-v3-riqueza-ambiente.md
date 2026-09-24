Historical study (2026-06-30, v3→v4 migration): kept as a record; the current state lives in `docs/game-design/plano-arte-procedural.md` and `docs/game-design/plano-cenario-cidade.md`.

# Audit — environment richness of v3 (`legacy/v3.1.100.html`)

> Annex to the credits audit. A catalogue of the v3 material (tilemap + animations per scene),
> to **reuse techniques** in v4 instead of regenerating images.

## Central finding
v3 produced all its visual richness **procedurally in `<canvas>` — ZERO image generation (0 PixelLab credits).**
Tiles and environment are drawn by code, per theme. This matches the *leaner runtime* pillar
and is the right cost reference: **the whole of v3, with 4 animated scenes, cost 0 generations.**

## Themes/scenes (each with its own quirks)
| Theme | Sky | Cloud | Mountains | Ambient decoration | Cave (inverted secret) |
|---|---|---|---|---|---|
| **Dia no Campo** (`campo`) | blue→light green | white | green | clouds, birds, **butterflies**, grass+flowers in the wind | brown rock, golden vein |
| **Amanhecer no Campo** (`cemiterio`) | purple→lilac | lilac | grey-green | clouds, birds, sparkles, **earthworms**, **fog** | purplish rock, amethyst vein |
| **Noite no Campo** (`espaco`) | near black→blue | dark grey | dark blue | clouds, sparkles, **fireflies** | bluish rock, cyan crystal |
| **Floresta** (`floresta`) | dark green→green | light green | dark green | clouds, birds, **butterflies**, grass+flowers | earthy rock, amber vein |

Structures: `THEMES` (sky/cloud/mountain/decor), `THEME_FLORA` (grass/flower per theme), `CAVE_PAL` (mine revealed on inversion), `SCENE_THEMES` (random draw).

## Ambient animation systems (all procedural)
| System | Technique | Anchor |
|---|---|---|
| **Grass+flowers in the wind** (`drawSurfaceGrass`) | a tuft per column, the tip leans with `sin(frame)`; the flower sways more than the grass; **deterministic per column (no flicker)** | world (on top of the ground) |
| **Clouds** (`drawClouds`) | 3 "puff" clouds drifting slowly, colour per theme | screen |
| **Birds** (`drawBirds`) | 3 "V" silhouettes flapping their wings, crossing the screen | screen |
| **Sparkles/stars** (`drawSparkles`) | 22 softly blinking points, behind the mountains | screen |
| **Fireflies** (`drawFireflies`) | grid of world cells (~1/3), they wander and pulse, **only in the air**, halo+core | world |
| **Butterflies** (`drawButterflies`) | anchored to ~1/5 of the ground columns (near the flora), flutter up and back, wings flapping | world |
| **Fog** (`drawFog`) | 3 low layers, a wavy top that drifts, **low opacity (does not hide the player)** | screen |
| **Earthworms** (`drawMinhocas`) | ~1/4 of the columns, on the ground, segments undulating | world |
| **Mountains** (`drawHills`) | layers of hills per theme (background parallax) | screen/parallax |
| **Fireworks** (victory) | particles; **respects reduced-motion** | screen |

## Accessibility (v3 already did what I proposed for v4)
- `viewDecor` — turns decorative animation on/off **per player**; **auto-off** under `prefers-reduced-motion` (`opt-decor` unticks itself).
- `viewHC` — high contrast **hides the decoration** (clarity).
- **Nothing flashes hard** (< 3 Hz; WCAG 2.3.1/2.3.3) — stated in v3's own report.
- Determinism by column/cell *hash* → **no flicker** between frames.
- World-anchored (scrolls with the scene) vs screen-anchored (sky), well separated.

## Implication for v4 (city)
**Port the v3 procedural systems instead of generating sprites** for the environment:
- **Flying pigeons ≈ `drawButterflies`** (same ground anchor + flutter; change the shape/motion to a flock taking off when approached).
- **Signs/lamps with a glow ≈ `drawFireflies`/sparkles** (soft pulse, no flashing).
- **Fog/dust in the abandoned interior ≈ `drawFog`**.
- **Clouds** reusable as they are (the city's sky layer).
- **`viewDecor` + `prefers-reduced-motion` + `viewHC`** → reuse the same gate (it is already the *Life & animation* toggle I proposed).

→ Generate images only where procedural does not solve it: **tileset (5)** + **a few *hero* props/creatures** (water tank, cat, dog, adult, sign). The estimate drops from ~46 to **~20–25 generations**, with a richer and 100% accessible environment.
