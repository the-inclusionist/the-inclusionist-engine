> Historical plan (2026-06-30): kept as a record; the current state lives in the `game-platformer` repository, which owns the city scenery since the scenery left the engine (ADR-0228).

# Scenery plan — CITY (16×16 tilemap + ambient life)

> Goal: replace the "horrible blocks" with a coherent vertical city.
> Cost rule: **everything 1-direction (sidescroller)**, never 8 directions. Estimated budget ~46 generations for the whole city.

## 1. Concept: a VERTICAL city
The map (56×62 tiles) is read in height bands:

| Zone | Band (Y, to calibrate) | Floor/structure | Life | Decoration |
|---|---|---|---|---|
| **Rooftop** (high) | top | slab + parapet | only **cats + pigeons** | water tanks, signs/billboards, antennas, **hanging lamps**, air conditioners — **no trees** |
| **Building** (middle) | middle | façade/wall | almost none | windows, pipes, fire escape |
| **Street** (low) | base | **pavement + kerb** | adults, dogs, cats, **pigeons** | street trees, lamp posts, **traffic signs**, shop awnings/stalls, hydrant, bin, bench |
| **Secret** (`darkRegions`) | dark pockets | **interior of an abandoned building** | none | rubble, exposed beam, broken pipe, broken lamp, graffiti |

- **Water = the inside of a water tank**: tank walls (metal/concrete) + waterline. Coherence: the water tanks sit **on the rooftops** — you swim inside them.
- **Signs and lamps = decoration** with a soft glow.

## 2. Mapping to the layers (already existing + 1 new)
1. **C1 gameplay** (`worldToTexture`): tiles by zone (pavement/wall/slab/tank/abandoned).
2. **decoLayer** (behind the player, no collision): props by zone.
3. **NEW "life" layer** (between deco and player, no collision): animated creatures.
4. **C2/C3/C4 parallax**: shops+signs / mid-rise buildings / skyline.
5. **darkLayer** (the darkness of the secret areas) — already exists.

## 3. 16×16 tilesets to generate (`create_sidescroller_tileset`, chained base for consistency)
1. **Pavement** — light concrete + kerb (top = pavement edge).
2. **Building façade** — structural wall (middle).
3. **Slab/rooftop** — surface + parapet at the edge.
4. **Water tank** — the tank's inner wall + waterline (reskin of the water tile, type 3).
5. **Abandoned interior** — cracked concrete/exposed brick/rubble (secret zones).
- **Gameplay reskins** keep a recognisable shape/contrast (AAA legibility): ladder→metal fire escape; coin, hazard, trampoline, gate, key **unchanged in how they read**.

## 4. Props (`create_1_direction_object`, sidescroller view, 1 dir, mirrorable)
- **Street**: street tree, lamp post, traffic sign (crossing/stop/traffic light), shop awning/stall, hydrant, bin, bench.
- **Rooftop**: water tank (large prop), sign/billboard, antenna, hanging lamp, air conditioner.
- **Abandoned**: rubble, beam, broken pipe, broken lamp.
- Lamps/signs: **steady glow** (no blinking — WCAG 2.3.1, < 3 Hz).

## 5. Ambient life (creatures) — behaviours
- **Street**: pigeons (walk/peck; **fly off when approached** and land further on), cats (walk), dogs (walk), adults (walk in the background, set back/desaturated).
- **Rooftop**: **only cats + pigeons**.
- **Pigeon (juice)**: a proximity radius around the player → they scatter upwards and settle again. **Purely cosmetic**: no collision, no damage, **distinct from the hazard "scare" (E3)**.
- 1-direction sprites, 2 frames, mirrored by heading.

## 6. Accessibility & performance (my improvements)
- **Toggle "Background life & animation"** + respect for `prefers-reduced-motion`: turns off the pigeons' flight and reduces ambient animations (autism/ADHD/vestibular). On by default only if there is no reduce-motion.
- **No flashes**: signs/lamps with constant brightness.
- **Contrast/reading**: creatures and decoration **set back and behind the player**, a palette separate from coin (yellow)/hazard (red)/player; never mistakable for a platform.
- **Performance** (school hardware): a creature pool, **spawn only near the camera**, a per-screen limit, 2 frames; all cosmetic → can be cut without affecting the game (graceful degradation by FPS).
- **Not collidable**: no prop/creature accidentally becomes "floor" or "enemy".

## 7. Corrections to the original ideas
- **A traffic sign on the rooftop makes no sense** → up high I use **signs/billboards/antennas** (building signage); traffic signs stay **on the street**. (You had already separated street=traffic / high=signage; here it is settled.)
- **A flying pigeon = cosmetic**, never the hazard scare (no damage/respawn).
- **Water tanks on the rooftops** ties "water = the inside of a water tank" to the verticality.

## 8. Generation budget (1-direction)
| Item | Qty | ~Generations |
|---|---|---|
| Tilesets | 5 | ~15 |
| Props | ~16 | ~16 |
| Creatures | ~6 (×~2 frames) | ~12 |
| Parallax (refining shops/signs) | 3 | ~3 |
| **Total** | | **~46** |

Comparison: the 8-directional character wasted ~540. Here, **the whole rich city ≈ 46**.

## 9. Order of execution (rounds, with visual sign-off between each)
- **A** — Tilesets (pavement/façade/slab/tank/abandoned) + wiring by zone.
- **B** — Props by zone (decoLayer).
- **C** — Creatures + the ambient-life system + the accessibility toggle.
- **D** — Parallax refinement (shops with signs on the near layer).

---

# FINAL REVISION (agreed) — replaces the points above where they diverge

## Philosophy: procedural-first as a reduction of cognitive load
A PixelLab sprite = **scaffolding** to create with. The Dev corrects/adapts each image and the abstraction is
**turned into procedural generation** afterwards. Generate an image only when procedural does not solve it.

## The map's REAL vertical (corrected — there is NO rooftop)
- **Base = street** (pavement, shops/signs in the parallax, street life).
- **Water tank**: the body of water is at the **base**, but the **entrance is up high** (a tall wall after the trampoline). Water tiles = the inside of a tank.
- **Above the height of the water tank's entrance = the inside of a building.**
- **Secret areas (`darkRegions`) = the inside of an abandoned building.**
- **Lava**: does not fit; left untouched for now (the Dev will solve it later).

## Tilesets (4, Round A — generated): pavement · building interior · water tank · abandoned interior
(The earlier generic "concrete" is retired.)

## Layers (updated) — now with a FRONT
1. Background parallax: C4 sky · C3 mid-rise buildings · C2 shops+signs **+ adults in silhouette**.
2. C1 gameplay: tileset by zone + items + player + **life on the plane (adults/dogs/cats/pigeons) behind the player**.
3. **NEW FRONT layer (in front of the player): CARS** passing every now and then.
4. **Weather** (rain) overlay, below the HUD.

## New mechanics (all procedural, 0 credits)
- **Cars**: appear sporadically, cross the street on the front layer; **stop at the red traffic light**, go on green.
- **Working traffic light**: green→amber→red cycle; it governs the cars.
- **Adults**: silhouettes in the parallax **and** pedestrians walking on the plane (behind the player).
- **Pigeons**: walk/peck; **fly off when approached** (cosmetic, no damage).
- **Rain (routine)**: starts at **30s**; cycle `drizzle 5s → rain 5s → drizzle 5s → fair 45s` (60s) in a loop. Respects `prefers-reduced-motion`/the toggle.

## Revised budget
- **Round A: 4 tilesets ≈ 12 generations** (the only generation in this stage).
- Hero props/creatures (water tank, cat, dog, adult, sign, car): few, 1-direction.
- Ambience (pigeons, mist, clouds, rain, traffic light, cars) = **procedural, 0 credits**.
- City total ≈ **20–25 generations**.
