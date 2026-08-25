// SPDX-License-Identifier: AGPL-3.0-or-later
// render/lq-filter.ts — Realce de contraste Linear→Quadrático (baixa visão, PESQUISA-ALTO-CONTRASTE §2.3).
// Curva de tom POR PIXEL na tela inteira, composta via SVG feComponentTransfer (17 amostras, sRGB) no CSS
// filter do canvas. `lqCurve`/`lqName` são puros (project node); `ensureLqFilter`/`setLq` são a casca fina que
// cria o nó SVG e escreve no DOM. Recompor o CSS filter final (junto com os modos de cor) fica em game.js via
// `onChange` injetado — não duplica _lastSharedViz/_rebakeDirect (outros subsistemas). Extraído verbatim.

import * as store from '../platform/storage.js';

const FILTER_ID = 'lq-enh';

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/**
 * 17-sample `feFuncR/G/B` table for tableValues, blending contrast-stretch (linear, α=1.3, μ=0.5) with an
 * S-curve (quadratic) by `t`. NOT clamped — mirrors game.js's lqCurve verbatim (callers clamp `t` upstream).
 */
export function lqCurve(t: number): string {
  const N = 17, a = 1.3, out: string[] = [];
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1);
    const lin = Math.min(1, Math.max(0, a * (x - 0.5) + 0.5));
    const quad = x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x);
    out.push(((1 - t) * lin + t * quad).toFixed(4));
  }
  return out.join(' ');
}

/**
 * Continuous `t` -> the i18n KEY of the screen-reader/UI label. NOT clamped — mirrors game.js's lqName verbatim
 * (t<=0 and t>=1-ish inputs fall through to the end labels naturally).
 *
 * Returns a key rather than resolved text for two reasons. This module is a render leaf and stays free of the
 * i18n dependency; and its parameter is already called `t`, so importing i18n's `t` here would shadow it — a
 * rename to dodge a name clash is a worse reason to change a signature than the boundary itself.
 */
export function lqName(t: number): string {
  return t <= 0 ? 'lq.off' : t < 0.34 ? 'lq.linear' : t < 0.67 ? 'lq.mixed' : 'lq.quadratic';
}

// ---------- Thin DOM shell ----------

/** Current L→Q amount (0..1), persisted in platform/storage under `KEYS.lq` ('incl_lq'). Module-local state. */
let lqT: number = clamp01(store.getNum(store.KEYS.lq, 0));

/** Reads (or lazily creates) the shared `<filter id="lq-enh">` SVG node, appended once to `document.body`. */
export function ensureLqFilter(): SVGFilterElement {
  const existing = document.getElementById(FILTER_ID);
  if (existing) return existing as unknown as SVGFilterElement;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg') as unknown as SVGSVGElement;
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  const f = document.createElementNS(NS, 'filter') as unknown as SVGFilterElement;
  f.id = FILTER_ID;
  f.setAttribute('color-interpolation-filters', 'sRGB');
  const ct = document.createElementNS(NS, 'feComponentTransfer');
  (['feFuncR', 'feFuncG', 'feFuncB'] as const).forEach((ch) => {
    const fn = document.createElementNS(NS, ch);
    fn.setAttribute('type', 'table');
    fn.setAttribute('tableValues', lqCurve(lqT));
    ct.appendChild(fn);
  });
  f.appendChild(ct);
  svg.appendChild(f);
  document.body.appendChild(svg);
  return f;
}

/** CSS `filter` fragment for the current lqT ('' when off) — ensures the SVG node exists BEFORE returning the
 * `url()` reference (a dangling reference would hide the canvas). Composed by callers with viz-mode filters. */
export function lqFilter(): string {
  if (lqT <= 0) return '';
  ensureLqFilter();
  return `url(#${FILTER_ID})`;
}

/** Current lqT (0..1) — read by the visual-settings panel and the debug/`__incl` surface. */
export function getLqT(): number {
  return lqT;
}

export interface LqFilterCtx {
  /**
   * Recomposes the app's CSS filter after lqT changes. In game.js this is either a full `applyVizGlobal()`
   * re-apply (single-player: also touches viz-mode texture caches, `_lastSharedViz`) or a direct
   * `app.view.style.filter = ...` write composed with the active viz-mode filter (multiplayer). That
   * composition — and the texture-cache invalidation it triggers elsewhere — belongs to other subsystems and
   * stays in game.js; this module only owns lqT + the SVG filter node.
   */
  onChange: () => void;
}

let onChange: () => void = () => {};

/** Wires the injected recompose callback. Call once during game.js boot. */
export function initLqFilter(ctx: LqFilterCtx): void {
  onChange = ctx.onChange;
}

/** Sets lqT (clamped to 0..1), persists it, updates the live SVG table (if the filter is already on-screen),
 * then calls the injected `onChange` to let game.js recompose the CSS filter. Mirrors game.js's setLq. */
export function setLq(t: number): void {
  lqT = clamp01(t);
  store.set(store.KEYS.lq, lqT);
  if (lqT > 0) {
    const f = ensureLqFilter();
    const tv = lqCurve(lqT);
    f.querySelectorAll('feFuncR,feFuncG,feFuncB').forEach((fn) => fn.setAttribute('tableValues', tv));
  }
  onChange();
}
