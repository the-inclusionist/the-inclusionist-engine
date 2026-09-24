> Historical plan (2026-06-30): kept as a record; the current state lives in ADR-0011 (visual) and ADR-0013 (motor) in `the-inclusionist-docs`, and in the panels `app/js/ui/settings-visual.ts`, `settings-motion.ts` and `settings-mobility.ts`.

# Accessibility Plan — The Inclusionist (v4)

Decisions closed with the Dev. Implementation in phases (A→B→C→E→F).

## Colour strategy (revised with the Dev)
**Groups by importance** (not by luminance): **G1** character/HUD/items/special NPC · **G2** platform/ground I stand on/ladder/door/secondary · **G3** background.
**WCAG 2.2 AA conformance through OUTLINE** (preserves the art, does not repaint): outline **G1↔background 7:1**, **G2↔background 4.5:1**, path guidance **3:1**, **text↔background 7:1** (HUD in the DOM). **Two-colour** outline (light+dark) → visible over any background. The 4 dark repaint variations were **removed** (repainting is not a WCAG requirement); the 13 palettes + the hue engine stay for the colour modes below.

## Colour modes — "Visual accessibility" menu (radio, immediate effect, 11 options)
1. **Normal colours** — raw art.
2. **Outline (Normal AA)** — ✅ dark outline on player/items/power-ups/door and platform edges (preserves the art).
3. **High contrast ×4** (light/medium/dark/night) — ✅ recolour by **group palette** (dark coloured background P10–P13; player P(n−9), items P(n−7)). **Provisional** — some low-vision levels benefit from it; the Dev will do better in Aseprite.
4. **Simulate colour blindness ×3** (Protanopia/Deuteranopia/Tritanopia) — ✅ **`feColorMatrix`** filters on the `<canvas>` (audit + demo). It is **simulation**, not correction (daltonization is left for later, if wanted).
5. **Simulate low vision** — ✅ blur (filter) + haze + spots/scotomas (overlay). **Green dot** in the corner; tap/click **2×** returns to normal.
6. **Simulate total blindness (amaurosis)** — ✅ black screen (`brightness(0)`), HUD and controls hidden (touch/sound feedback only — Phase F). **White dot** in the corner; **2×** returns to normal.
- (to do) **Normal AA · Colours** (slight shift) and **daltonization** (real correction).
- (Discarded: "CB-safe" recolour to 20 Okabe–Ito colours — it posterized the art.)

**Palette roles (the Dev's):** P1 direct light · P2 very light · P3 light · P4–P5 washed · P6 vivid/saturated · P7 warm vivid + muted · P8 vivid blue/pink/red + the rest muted · P9–P10 dark · P11–P13 very dark. Use: light outline from P1/P2 (over a dark background) or dark from P12/P13 (over a light one); vivid interiors from P6; washed background from P4/P5. Base groups for the Colours mode: **P1×P6×P11**, **P2×P7×P12**, **P3×P8×P13** (adjacent ~3:1).

## Per player (multiplayer) — ✅ done
Each player has their own settings (tabs P1–P4 in the panels, like the controls):
- **Visual a11y (colour):** fully per screen — in MP each viewport renders in its player's mode (swap of shared textures before each render + PIXI filter per viewport; dot on top, outside the filter).
- **Motor a11y:** Easy (physics/hitbox/edge/hazard immunity/controls) and toggle movement per player. The only **world** effect that stays global: **coins on the ground** (on if ANY player uses Easy — there is only one world).
- **Animation:** **character** (walking/breathing/idle antics) per player; **scene** (parallax/decoration/items/particles) global (shared background).
- Persisted per player (`incl_*_pN`). ⚠️ FPS in MP drops with per-viewport filters — optimize later.

## Easy Mode (motor disability)
- Gravity **×2/3**; jump **×8/7**; walk/ladder/swim **×0.7** (fine tuning later).
- Pickup hitbox **+4px** per side, drawn as a **translucent rectangle**.
- **Coins lowered to the ground** (only in Easy; they revert when it is switched off).
- **No hazards** (inherited from the old "Assistance", which becomes "Easy").
- **Trampoline = fixed soft bounce** (no charge chain); holding = float down slowly.
- **Edge protection:** walking does not drop you into a pit; you only fall by pressing **down**.
- **Lean controls:** **interact = any jump button** (not only Space); Ctrl=special; Shift=swap power; no running.

## Toggle movement (1 finger / sequential access) — ✅ DONE (toggle in the Movement panel)
- Tap a direction → walks **continuously** that way (~1/3 of the speed); hold → ~2/3.
- **The jump is momentary and does NOT interrupt the walk** (press jump near the obstacle, jump forward and keep walking).
- Coupled to **Easy** (inherits edge protection + lower gravity + coyote time → forgiving pit jump). GAG-OK (does not require hold+move at the same time). Sequential multi-button is enough (no scanning needed).

## Reduced animation (WCAG 2.3.3) + Pause/Stop/Hide (2.2.2)
> Terminology: **Movement** = how the player moves (GAG, toggle). **Animation** = motion on screen (WCAG, reduction). The "Mov./Anim." panel separates the two sections.
- Reduced motion **on by default** (respects `prefers-reduced-motion`).
- 7 toggles: **parallax · decorative background (clouds/grass) · items (coins) · character in motion · breathing · idle antics · particles/twinkling**.
  - **Character in motion** freezes ALL locomotion on a single frame: walking/running, wall climbing (suction), ladder climbing, swimming and jumping.
  - **Breathing** and **idle antics** are separate toggles (some people are bothered by the antics and want them off without freezing the breathing).
- **1 master button** (Pause/Stop/Hide) freezes them all.
- Acting today: parallax, character in motion, breathing/antics. Decoration/items/particles are ready and switch on when the City animates.

## Audio Mode (Phase F) — detailed spec
The audio button **opens a menu** with a **toggle + volume bar** for each group:
- **Music**
- **Ambient sounds:** water, street conversations, traffic, leaves in the wind, rain
- **Effects of interaction with the environment:** footsteps per surface (grass/floor/stone/sand), doors (wood/iron), ladder (wood)/wall climbing
- **Earcons** (symbolic sounds of the actions: jump, coin pickup, damage, etc.)
- **Other sound effects**
- **TTS** (narration)
- **Sonar** (interaction button + in the menu) — a sweep that announces the nearest coin/target (direction + distance)
- **Audible edge guard** (warning on reaching a pit/edge)
- **Looping cue / navigation trail / audio guide** (a loop that points the way)
- Spatial cues: L/R panning by direction; tone/pitch by distance.
- **Danger sound** (pit fall, lava) and **barrier/wall sound**.
- ⚠️ Validate with the **blind community** (AudioGames.net, associations) before settling details.

## Already done
- **8-bit victory** sound (jingle + 4 fireworks).
