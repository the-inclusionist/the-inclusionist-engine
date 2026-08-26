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

**AMENDED 2026-08-25, and RE-MEASURED the same day** — the first amendment fixed the 16×32 and got three of its
own counts wrong, which is the same error at a smaller size. The numbers below are read out of the PNG headers,
not summarised from memory; the script is in the commit that added this paragraph.

This file and `character-animation.md` both declared a **16×32 sprite**. Of the **39 PNGs** in `app/` — all of
them sprite frames — **not one is 16×32.**

It was 80 until 2026-08-25, then 77, and 39 since 2026-08-26 — the 38 `_hc` silhouettes were deleted (see the
bullet below). The three city parallax backdrops left when ADR-0042 replaced them with a
generated skyline: measuring them showed they needed 11,382 uniform-colour rectangles to reproduce as data,
so they were REDRAWN by rule instead. What decided it was not the byte count but high contrast — the city
backdrop is the largest surface on screen, and while it was a PNG it was the one thing the mode could never
repaint.

The 39 sprite frames cover **13 animations** and come in **15 distinct sizes**: widths 24–34 px, heights 29–36 px,
plus one 64×64 leftover. Deleting the 38 `_hc` changed NONE of those three numbers — measured, not assumed:
every animation had colour frames, and every size the silhouettes used also occurs among the colour frames. The most common size is 25×34 (the walk cycle); `parede` is 31×36, `teto` 25×36.

Two things the first count missed, and they are the ones that matter:

- **All 39 are frames the game draws** — since 2026-08-26. Until then there were 77, and 38 of them were `_hc`
  high-contrast silhouettes that NOTHING loaded: high contrast recolours the colour frame in real time, and the
  silhouettes were left over from an earlier approach. They shipped anyway — into `dist/` and into the PWA
  precache, 8.9 KB of first-visit bandwidth for files no one opens, on the school machines that pillar 1 is
  about. Deleted in the commit that closes issue #71.
- **The size varies INSIDE an animation.** `nadar` is 34×29 and 34×32; `nadar-parado` is 26×35 and 28×35;
  `pulo` is 26×32 and 28×30. So there is not even a per-animation size to fall back on — which is a stronger
  statement than "no fixed sprite size", and it is the one that binds the atlas.

The Dev's decision is that **there is no fixed size** — multiples of 16 px are preferred, other sizes are
explicitly welcome because they make the art richer (ADR-0027, `machine-spec.sprite-size`). So the docs were
wrong, not the art.

Two consequences that follow from the measurement rather than from taste:

- **The atlas cannot assume a uniform grid** — not per sheet and not per animation — and **every sprite carries
  its own pivot**. Heights vary by 7 px across states and by up to 3 px WITHIN one state, so a feet anchor
  derived from a fixed frame height would make the character sink or float whenever the frame changed — and
  `render/draw` anchors squash & stretch AT THE FEET.
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
