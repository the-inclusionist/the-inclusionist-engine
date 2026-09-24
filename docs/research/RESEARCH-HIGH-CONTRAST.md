Historical study (2026-07-02, engine v4.0.0): kept as a record; the current state lives in `app/js/render/high-contrast.ts`, `app/js/render/viz-modes.ts`, `app/js/render/lq-filter.ts` and ADR-0011 (visual accessibility, in `the-inclusionist-docs`).

# Research — High Contrast modes (v4.0.0)

> Research-first: a study of the techniques + a table of expected results **with sources**, BEFORE coding.
> Motivation: the current `hc1..hc4` modes (tile recolour by group palette + background variation) are
> considered poor and will be replaced. The Dev asked to try: **CLAHE**, **Linear and Quadratic
> Enhancement**, **VCEA** and **Direct Rendering Techniques**.

## 1. What already exists in the game (`VIZ_MODES`, `game.js`)

[Today: `hc1..hc4` are gone; high contrast is the three `hc-direto*` Direct Rendering modes in `app/js/render/viz-modes.ts`, drawn by `app/js/render/high-contrast.ts`.]

| Mode | `kind` | What it does | Assessment |
|------|--------|-----------|-----------|
| `normal` | normal | Raw art | — |
| `bordas` | bordas | Dark outline on character/items/platform edges (preserves the art, WCAG AA target) | **A good base** — it is direct rendering |
| `hc1..hc4` | hc | Recolour of the tiles by the group palette (gradient-map by hue) + 4 progressively darker backgrounds | **Poor** (to be replaced) |
| `sim-*` / `fix-*` | filter | Colour-blindness simulation / correction (linear SVG filter on the GPU) | OK (fix-* redone with Machado 2009) |
| `lv-*` / `blind` | lowvision/blind | Low-vision / blindness simulation (empathy) | OK (they are simulation, not correction) |

The engine renders in **PixiJS/WebGL**, **pixel art 320×180** (NEAREST), and in multiplayer it applies the
filter **per viewport** (RenderTexture). Target hardware: **public-school Positivo/Chromebook** (the pillar).

## 2. The four techniques — origin and what they were made for

### 2.1 CLAHE — Contrast Limited Adaptive Histogram Equalization
- **Source:** K. Zuiderveld, *"Contrast Limited Adaptive Histogram Equalization"*, Graphics Gems IV, Academic Press, 1994.
- **Mechanism:** divides the image into *tiles* (e.g. 8×8), equalises the **local** histogram of each tile with a **clip limit** (limits noise amplification in uniform areas) and does **bilinear interpolation** between tiles.
- **Made for:** **continuous-tone** images with non-uniform lighting (medical, photographic). Enhances local texture/detail.

### 2.2 VCEA — Visual Contrast Enhancement Algorithm (HE-based)
- **Source:** *"Visual Contrast Enhancement Algorithm Based on Histogram Equalization"*, Sensors 2015, 15(7):16981, MDPI (doi:10.3390/s150716981).
- **Mechanism:** a variant of **global histogram equalisation** that **adjusts the gaps between adjacent grey levels** to avoid over-enhancement and loss of detail, aiming at human visual perception.
- **Made for:** improving the contrast of **photographic images** with a more pleasing result than classic HE.

### 2.3 Linear and Quadratic Enhancement (grey-level transformation)
- **Source:** classic image-processing literature (grayscale transformation / contrast stretching); e.g. SPIE *Image Enhancement Processing* (TT92, ch. 9).
- **Mechanism:**
  - **Linear:** `I' = α·(I − μ) + μ` (α = contrast gain, μ = mean) — contrast stretching/compression, **per pixel**.
  - **Quadratic:** a **non-linear** tone curve (enhances shadows/highlights, gamma-like) — **per pixel**.
- **Made for:** global brightness/contrast adjustment. Cheap, but it **does not separate elements** nor create edges.

### 2.4 Direct Rendering Techniques
- **Source / industry practice:** Access-Ability, *"2024: The Year of High Contrast Visuals"* (2024); the PlayStation first-party template (God of War Ragnarök, Spider-Man, Horizon Forbidden West); Saints Row (2022) with a **high-contrast outline + color-blocking**.
- **Mechanism:** draw the high-contrast presentation **directly in the pipeline**: a **bright outline per entity**, **color-blocking by role** (player / enemy-hazard / item / platform, each in a distinct colour), a **greyscale/darkened background** so the foreground pops, all of it **customisable** and **switchable live**.
- **Made for:** exactly **low-vision accessibility in games** — identifying and separating interaction elements, not improving a photo.

## 3. Critical analysis — photographic × game pixel art

The central point: **CLAHE, VCEA and linear/quadratic enhancement are PHOTOGRAPHIC techniques** (continuous tone,
natural lighting). The Inclusionist's art is **flat, hand-authored pixel art, few levels, 320×180,
already high-contrast by design**. Expected consequences of throwing a photographic filter over it:

- **Histogram equalisation (CLAHE/VCEA)** over a flat palette → **remaps/posterises the palette**, shifts
  hues, enhances *dithering*/aliasing, and **does not distinguish roles** (player vs. enemy vs. item remain
  equal to someone with low vision — the filter does not know what is important).
- **Cost:** a histogram per frame (CLAHE also per *tile* + interpolation) × up to 4 viewports × 60fps is **expensive
  on the Positivo/Chromebook** — it clashes with the hardware pillar. It needs multiple shader passes.
- **Linear/Quadratic:** cheap and trivial on the GPU (ColorMatrix/shader), but the art already spans the whole range →
  **small gain**; they create neither edges nor role separation. At most they serve as a **personal
  brightness/contrast slider**.

In contrast, **Direct Rendering** tackles the real low-vision need (distinguishing and separating
elements), **meets WCAG by construction** (the colours/outlines are chosen for ≥7:1), is **cheap** on the
target hardware, and is what **the industry and the accessibility field adopt**. The game is already halfway there with the
`bordas` mode.

## 4. Table of expected results

| Technique | Where it runs | Cost (Positivo/Chromebook, 4 viewports) | Expected effect on the pixel art | Separates roles? | WCAG AAA (7:1) | Artefact/risk | Verdict for this game |
|---------|-----------|------------------------------------------|------------------------------|----------------|----------------|----------------|------------------------|
| **CLAHE** | Post-proc, multi-pass GPU | **High** (histogram/tile + interp × viewport) | Posterises the palette, enhances aliasing, *photographic* local contrast | ❌ | Not guaranteed | Hue shift, noise, over-enhance | ❌ Mismatch + expensive |
| **VCEA** | Post-proc, global HE | Medium (histogram/frame × viewport) | Remaps the global palette, colour shift | ❌ | Not guaranteed | Feature loss, altered colour | ❌ Mismatch |
| **Linear** | Per-pixel shader | **Low** | Stretches contrast (little — already saturated) | ❌ | Not by itself | Clipping of highs/lows | ⚠️ Only as a personal slider |
| **Quadratic** | Per-pixel shader | **Low** | Tone curve (deepens shadow/light) | ❌ | Not by itself | Loses detail at the ends | ⚠️ Only as a personal slider |
| **Direct Rendering** | In the pipeline (outline + palette-swap by role + desaturated background) | **Low** | Thick outline + color-blocking by role; background faded | ✅ | **Yes, by construction** | Needs good palette design | ✅ **Recommended** |

## 5. Recommendation

**Redo high contrast as Direct Rendering**, evolving the existing `bordas` into a real low-vision
accessibility mode, with:

1. **A configurable outline** (thickness in logical px) around the character, items, hazards and platform
   edges — the enhancement the industry uses.
2. **Color-blocking by role** (a high-contrast, colour-blind-safe palette): player / item / hazard /
   platform / background, each in a distinct colour and with contrast ≥7:1 between important neighbours.
3. **A desaturated/darkened background** (not noisily recoloured like hc1-4) so the foreground
   pops.
4. **Presets + fine tuning**: 2–3 presets (light/dark/night) + toggles; and — if the Dev wants — a
   **Linear/Quadratic** brightness-contrast **slider** as a **secondary personal** control (cheap, optional),
   since those two are the only ones of the four that make sense in real time here.
5. **CLAHE/VCEA**: keep them **out of the core**. If the Dev wants to experiment anyway, a shader can be
   prototyped and compared side by side — but the expectation (table above) is high cost and low/negative gain
   on flat art. Their decision.

## 6. Expected output and where to evaluate (before expensive tests)

- **Expected output:** in each preset, measure the **real contrast** (WCAG luminance ratio) between
  character×background, item×background and hazard×background — target **≥7:1** (AAA) for the critical pairs; outline visible
  at 640×360 (minimum viewport).
- **Where to evaluate:** headless Claude_Preview — a screenshot per preset + colour sampling via `eval`
  (compute the contrast ratio of the pairs). No testing on target hardware for now (project rule).
- **Colour-blind-safe:** validate the color-blocking palette by passing it through the existing `sim-*` (deuter/protan/tritan)
  — the roles must remain distinguishable.

## 7. Sources

- [CLAHE — Zuiderveld 1994 (via ImageMagick CLAHE docs)](https://imagemagick.org/clahe/)
- [VCEA — Sensors 2015, MDPI (doi:10.3390/s150716981)](https://doi.org/10.3390/s150716981) · [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4541917/)
- [Grey-level enhancement — SPIE, Image Enhancement Processing (TT92, ch. 9)](https://spie.org/samples/TT92.pdf)
- [Game practice — Access-Ability, "2024: The Year of High Contrast Visuals"](https://access-ability.uk/2024/01/26/2024-the-year-of-high-contrast-visuals/)
- [High Tech Aids Low Vision: A Review of Image Processing for the Visually Impaired — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC4539202/)
- [Embedded system for contrast enhancement in low-vision (CLAHE + bio-inspired retina) — ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S1383762112001002)
