# Art Bible — visual system

The visual style guide (ADR-0009 "art bible"). This is the **index** of the visual system; detail lives in the linked
docs. **Much is already implemented** — the concrete decisions + commits are in ADR-0018; this
bible states the enduring rules.

## Core rule — art is data (GPL-clean)

**All art** (character, tiles, decoration) obeys **one unified palette-mother + one light direction + one outline
style**. No embedded PNG in-game: the target is **procedural art** (semantic image `(region, luminosity)` + palette
dictionary → recolor by colour-key + layers). PixelLab/Aseprite/Tiled are **design reference only**, converted by hand
to procedural. Active pipeline plans: [`plano-arte-procedural.md`](plano-arte-procedural.md),
[`plano-tiled-aseprite.md`](plano-tiled-aseprite.md).

## Character & animation

320×180 canvas, 16px tiles, **no fixed sprite size** (48×48 cancelled — TDAH concern; see below). In **profile**, facing the last
direction; **always breathing** (idle never static). **Layered** (Fitzpatrick skin + hair + clothes via colour-key +
overlays) for diversity and per-player distinction. Full spec + the animation list →
[`character-animation.md`](character-animation.md).

### Sprite size: there is none, and the docs said otherwise

**AMENDED 2026-08-25.** This file and `character-animation.md` both declared a **16×32 sprite**. Measured against
the 83 PNGs actually shipped, **not one of them is 16×32.**

The 77 character frames span **14 animation states** and **14 distinct sizes**: widths 24–34 px, heights 29–36 px.
The most common single size is 25×34 (the 16 walk frames); `parede` is 31×36, `nadar` is 34×32 and 34×29,
`teto` is 25×36.

The Dev's decision is that **there is no fixed size** — multiples of 16 px are preferred, other sizes are
explicitly welcome because they make the art richer (ADR-0027, `machine-spec.sprite-size`). So the docs were
wrong, not the art.

Two consequences that follow from the measurement rather than from taste:

- **The atlas cannot assume a uniform grid**, and **every sprite carries its own pivot**. Heights vary by 7 px
  across states, so a feet anchor derived from a fixed frame height would make the character sink or float
  whenever the state changed — and `render/draw` anchors squash & stretch AT THE FEET.
- **48×48 stays cancelled**, and the reason is unchanged: it was a TDAH concern, not a size-arithmetic one.
  Recorded here so the cancellation is not read as a consequence of this amendment.

One file does not belong: `sprites/menino/teto/3-noroeste-candidato.png` is **64×64** while its eight siblings
are 25×36. The name says candidate; it is not a size decision, it is a leftover.

**`ADR-0016` was NOT amended, and that is deliberate.** It says "adults = 16×32 silhouettes" about the CITY
BACKGROUND, and `render/city-tex.ts` really does draw six 16×32 adult silhouettes procedurally. Different asset
class, still true. Changing it would have put an error into a record that was right.

## Typography

The canonical font system (roster by role, evidence-based, licences) →
[`typography.md`](typography.md). a11y text-spacing thresholds are in `../1-Discovery/NFR.md`; the evidence is in
`../research/` (ESTUDO-FONTES, PESQUISA-FONTES).

## Scene & rendering

- **Four parallax layers:** sky/distant · medium trees + larger animals · near foliage (wind) + clouds + near animals ·
  game region (solid tiles + player, no parallax).
- **Tileset:** borders/corners/slopes/transitions via **autotiling**.

## Game feel

Juice (dust, collect-glow, squash&stretch, hit-stop, screenshake, tile shimmer, camera easing) — **each an independent
debug toggle**, plus a "low-performance" profile that turns all off. CRT scanlines + vignette as toggleable CSS
overlays. Dedicated doc: **`Game-Feel.md`** *(to create — absorbs ADR-0018 + `../1-Discovery/plano-audio-fase-f.md`)*.

## Colour & accessibility

Colour roles + high-contrast + colour-blind-safe (Okabe-Ito) are **a11y**, driven by `../1-Discovery/NFR.md` and the
studies in `../research/` (PESQUISA-ALTO-CONTRASTE, PESQUISA-DALTONIZACAO). Concrete ramps are code (palette dictionary).
