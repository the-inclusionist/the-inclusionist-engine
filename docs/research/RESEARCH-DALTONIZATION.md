# Research — Canonical daltonisation (simulation + correction 🚥)

> Research-first: pin down the canonical values of the colour-blindness filters (simulation `sim-*` and
> correction `fix-*`), replacing the manually derived matrices that were marked as
> adjustable data.

## 1. The canonical correction algorithm (daltonisation)

Daltonisation **is not a single published matrix** — it is an algorithm (Fidaner, Lin & Ozguven 2005,
canonical implementation: daltonize):

```
Sim  = S · I                    (1) simulates how the dichromat sees
E    = I − Sim                  (2) error: the information they lose
C    = I + M_err · E            (3) redistributes the error to channels they can see
```

- **S** (simulation): Machado, Oliveira & Fernandes 2009, *A Physiologically-based Model for
  Simulation of Color Vision Deficiency* (IEEE TVCG 15(6)) — Table 1, severity 1.0.
  Values checked on the authors' official page (UFRGS).
- **M_err** (redistribution, Fidaner et al.): shifts the error from the R channel to G and B —
  `[[0,0,0],[0.7,1,0],[0.7,0,1]]` (checked in the canonical code `daltonize.py`).

Since the three steps are linear, they compose into a single matrix per type:
**C = I + M_err·(I − S)** — that is what the `fix-*` filters apply.

## 2. SIMULATION matrices (Machado 2009, severity 1.0) — canonical

| | R' | G' | B' |
|---|---|---|---|
| **Protanopia** | 0.152286, 1.052583, −0.204868 | 0.114503, 0.786281, 0.099216 | −0.003882, −0.048116, 1.051998 |
| **Deuteranopia** | 0.367322, 0.860646, −0.227968 | 0.280085, 0.672501, 0.047413 | −0.011820, 0.042940, 0.968881 |
| **Tritanopia** | 1.255528, −0.076749, −0.178779 | −0.078411, 0.930809, 0.147602 | 0.004733, 0.691367, 0.303900 |

The previous `sim-*` matrices (0.567/0.433… — the colorjack ones that circulate on the web) **have no
primary source and are considered imprecise** (see the DaltonLens review). Replaced by the
Machado ones in the same pass.

## 3. Composed CORRECTION matrices (C = I + M_err·(I − S))

Each row sums to 1 → **white/greys preserved** (the correction only acts where there is chroma).

| | R row | G row | B row |
|---|---|---|---|
| **fix-protan** | 1, 0, 0 | 0.478897, 0.476911, 0.044192 | 0.597282, −0.688692, 1.091410 |
| **fix-deutan** | 1, 0, 0 | 0.162790, 0.725047, 0.112165 | 0.454695, −0.645392, 1.190697 |
| **fix-tritan** | 1, 0, 0 | −0.100459, 1.122915, −0.022457 | −0.183603, −0.637643, 1.821245 |

Reading: the R row is the identity (the defective channel is not altered — there is no point modulating what the
person cannot distinguish); the error is reinjected into G and B, where the person DOES have discrimination. In tritan the
strong modulation sits in B (1.82) — the tritan error lives in blue.

## 4. Documented decisions

1. **Brettel 1997 for tritan**: it is the exact model, but it is *piecewise* (two half-planes chosen
   per pixel) — **it cannot be expressed in a single `feColorMatrix`** nor in PIXI's ColorMatrixFilter.
   We use Machado's tritan matrix (the best single LINEAR approximation). Future refinement:
   a piecewise Brettel shader. *To override: ask for the shader.*
2. **Colour space**: Machado defines the matrices in **linear RGB** (the canonical daltonize does
   de-gamma first). We apply them in **sRGB on both paths** (SVG with
   `color-interpolation-filters="sRGB"` in single-player; PIXI ColorMatrixFilter in MP, which only operates in
   sRGB) → single-player ≡ multiplayer visually, which is the standard approximation of web implementations.
   A linear-exact variant = future refinement (it would require gamma in the PIXI shader too).
3. **Fidaner's M_err is the same for the 3 types** in the canonical algorithm (it is what daltonize
   does); per-image adaptive alternatives exist in the literature, out of scope.

## 5. Verification (headless, before commit)

Numerical test: for a pair a protanope confuses (red×green), measure ΔE **under protan
simulation** before and after the correction — the correction must INCREASE the distance perceived by the
protanope. The same for deutan and tritan (blue×yellow). + a screenshot of each mode.

## 6. Sources

- [Machado, Oliveira & Fernandes 2009 — official page with Table 1 (UFRGS)](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html) · [IEEE Xplore](https://ieeexplore.ieee.org/document/5290741/)
- [daltonize.py — canonical implementation (Fidaner et al.; M_err matrix)](https://github.com/joergdietrich/daltonize)
- [Daltonize.org — LMS Daltonization Algorithm](http://www.daltonize.org/2010/05/lms-daltonization-algorithm.html)
- [DaltonLens — Review of Open Source CVD Simulations (imprecision of the colorjack matrices)](https://daltonlens.org/opensource-cvd-simulation/)
