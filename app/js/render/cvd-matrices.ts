// SPDX-License-Identifier: AGPL-3.0-or-later
// render/cvd-matrices — the SIX colour-blindness matrices (3 SIMULATIONS, Machado 2009 severity 1.0 + 3 CORRECTIONS
// C = I + M_err·(I − Sim), M_err from Fidaner et al.), in one place. A leaf module: ZERO dependencies.
//
// THE DUPLICATION THIS MODULE CURES. The same 120 numbers were once written TWICE, in different languages: as
// `<feColorMatrix values="…">` in a page's HTML — the SINGLE-SCREEN path (`filter: url(#cvd-…)` on the <canvas>) — and
// as a `PIXI.ColorMatrixFilter` — the MULTI-SCREEN path (a GPU filter per viewport, one mode per player). Nothing tied
// the two copies. Had they drifted, the symptom would be SILENT and about ACCESSIBILITY — the SAME colour-blind person
// would see different colours on one screen and on several, with no error, no log, no red test. Now both paths read
// from here: `render/viewports` builds the ColorMatrixFilter from these arrays, and `installCvdFilters()` GENERATES the
// six `<filter>`s at boot from the same arrays, into the empty host the root is given (`host.cvdHost`).
//
// A leaf module on purpose (the same shape as render/hc-role-data): a data file with no dependency can be read both by
// the render pipeline and by the document's boot without dragging PixiJS into the HTML or the DOM into the renderer.
//
// LAYOUT: 20 numbers = 4 rows of 5 (R, G, B, A), in row order. It is EXACTLY the same layout at both destinations —
// `feColorMatrix type="matrix"` and `PIXI.ColorMatrixFilter#matrix` — so the array serves both with no conversion.
// Applied in sRGB on both paths (the web's standard approximation; see the research's decision 2). Primary source and
// the value-by-value check: docs/research/RESEARCH-DALTONIZATION.md.

/** The six colour-blindness mode keys — the SAME keys as `VIZ_MODES` in render/viz-modes. */
export type CvdKey = 'sim-protan' | 'sim-deuter' | 'sim-tritan' | 'fix-protan' | 'fix-deuter' | 'fix-tritan';

/**
 * Canonical order: the three simulations (what the person sees) before the three corrections (what helps them see).
 * It is also THE list of colour-vision modes the rest of the engine asks about — `onlyColourVision` (render/viz-axes)
 * reads it for the scanline that stays under them (ADR-0241).
 */
export const CVD_KEYS: readonly CvdKey[] = ['sim-protan', 'sim-deuter', 'sim-tritan', 'fix-protan', 'fix-deuter', 'fix-tritan'];

/**
 * The matrices, 4×5 in row order. Row A = `0 0 0 1 0` in all of them: none of the six modes touches alpha.
 *
 * SIMULATION (Machado, Oliveira & Fernandes 2009, severity 1.0 — values checked on the authors' page, UFRGS).
 * CORRECTION (canonical daltonisation): the R row is identity — there is no point modulating the channel the person
 * cannot tell apart — and the error is reinjected into G and B, where there is discrimination; each row sums to 1, so
 * white and greys are preserved.
 */
export const CVD_MATRIX: Record<CvdKey, readonly number[]> = {
  'sim-protan': [0.152286, 1.052583, -0.204868, 0, 0, 0.114503, 0.786281, 0.099216, 0, 0, -0.003882, -0.048116, 1.051998, 0, 0, 0, 0, 0, 1, 0],
  'sim-deuter': [0.367322, 0.860646, -0.227968, 0, 0, 0.280085, 0.672501, 0.047413, 0, 0, -0.011820, 0.042940, 0.968881, 0, 0, 0, 0, 0, 1, 0],
  'sim-tritan': [1.255528, -0.076749, -0.178779, 0, 0, -0.078411, 0.930809, 0.147602, 0, 0, 0.004733, 0.691367, 0.303900, 0, 0, 0, 0, 0, 1, 0],
  'fix-protan': [1, 0, 0, 0, 0, 0.478897, 0.476911, 0.044192, 0, 0, 0.597282, -0.688692, 1.091410, 0, 0, 0, 0, 0, 1, 0],
  'fix-deuter': [1, 0, 0, 0, 0, 0.162790, 0.725047, 0.112165, 0, 0, 0.454695, -0.645392, 1.190697, 0, 0, 0, 0, 0, 1, 0],
  'fix-tritan': [1, 0, 0, 0, 0, -0.100459, 1.122915, -0.022457, 0, 0, -0.183603, -0.637643, 1.821245, 0, 0, 0, 0, 0, 1, 0],
};

/**
 * Mode → the SVG `<filter>` id. The ids are this module's PUBLIC API: `VIZ_FILTER` (render/viz-modes) asks for the
 * filter by `url(#…)`, and this map is what promises the filter with that id will exist in the document. Renaming an id
 * here without renaming it there blanks the canvas (a reference to a missing filter does not render).
 */
export const CVD_SVG_ID: Record<CvdKey, string> = {
  'sim-protan': 'cvd-protan', 'sim-deuter': 'cvd-deuter', 'sim-tritan': 'cvd-tritan',
  'fix-protan': 'cvd-fix-protan', 'fix-deuter': 'cvd-fix-deuter', 'fix-tritan': 'cvd-fix-tritan',
};

/** A `<feColorMatrix>`'s `values` attribute: the 4 rows separated by a double space (readability). PURE. */
export function cvdMatrixValues(k: CvdKey): string {
  const m = CVD_MATRIX[k];
  return [0, 5, 10, 15].map((i) => m.slice(i, i + 5).join(' ')).join('  ');
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Generates the six `<filter>`s INSIDE the given host (an SVG `<defs>`), from `CVD_MATRIX`.
 *
 * Why at boot and not written by hand in the HTML: that was exactly the second copy of the numbers. Built with
 * `createElementNS` (and not `innerHTML`) because `<filter>`/`<feColorMatrix>` only work in the SVG namespace — with
 * innerHTML the result depends on the browser's fragment algorithm.
 *
 * Idempotent: it empties the host before filling it, so calling twice does not duplicate ids (a duplicated id would make
 * the browser pick the first — a silent failure again).
 *
 * @returns how many filters were installed (0 = no host; the caller decides whether that is fatal).
 */
export function installCvdFilters(host: Element | null | undefined): number {
  if (!host) return 0;
  const doc = host.ownerDocument;
  if (!doc) return 0;
  while (host.firstChild) host.removeChild(host.firstChild);
  let n = 0;
  for (const k of CVD_KEYS) {
    const f = doc.createElementNS(SVG_NS, 'filter');
    f.setAttribute('id', CVD_SVG_ID[k]);
    f.setAttribute('color-interpolation-filters', 'sRGB'); // as PIXI does: both paths work in sRGB
    const fe = doc.createElementNS(SVG_NS, 'feColorMatrix');
    fe.setAttribute('type', 'matrix');
    fe.setAttribute('values', cvdMatrixValues(k));
    f.appendChild(fe);
    host.appendChild(f);
    n++;
  }
  return n;
}
