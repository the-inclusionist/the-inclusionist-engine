// SPDX-License-Identifier: AGPL-3.0-or-later
// render/lq-filter.ts — the Linear→Quadratic contrast enhancement (low vision, RESEARCH-HIGH-CONTRAST §2.3).
// A PER-PIXEL tone curve over the whole screen, composed through an SVG feComponentTransfer (17 samples, sRGB) in the
// canvas's CSS filter. `lqCurve`/`lqName` are pure (node project); `ensureLqFilter`/`setLq` are the thin shell that
// creates the SVG node and writes to the DOM. Recomposing the final CSS filter (with the colour modes) belongs to the
// host, through the injected `onChange` — this module does not duplicate the other subsystems' caches.

import type { Store } from '../platform/storage.js';
import { KEYS } from '../platform/storage-keys.js';

const FILTER_ID = 'lq-enh';

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/**
 * 17-sample `feFuncR/G/B` table for tableValues, blending contrast-stretch (linear, α=1.3, μ=0.5) with an
 * S-curve (quadratic) by `t`. NOT clamped — callers clamp `t` upstream.
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
 * Continuous `t` -> the i18n KEY of the screen-reader/UI label. NOT clamped (t<=0 and t>=1-ish inputs fall through to
 * the end labels naturally).
 *
 * Returns a key rather than resolved text for two reasons. This module is a render leaf and stays free of the
 * i18n dependency; and its parameter is already called `t`, so importing i18n's `t` here would shadow it — a
 * rename to dodge a name clash is a worse reason to change a signature than the boundary itself.
 */
export function lqName(t: number): string {
  return t <= 0 ? 'lq.off' : t < 0.34 ? 'lq.linear' : t < 0.67 ? 'lq.mixed' : 'lq.quadratic';
}

// ---------- Thin DOM shell ----------

/** Current L→Q amount (0..1), kept under `KEYS.lq` ('incl_lq') in the injected store; 0 until `initLqFilter` reads it.
 *  Module-local state. */
let lqT = 0;
/** Where lqT is kept: the page's store, handed over by `initLqFilter` (ADR-0232, issue #207). */
let lqStore: Pick<Store, 'getNum' | 'set'> | null = null;

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
   * Recomposes the app's CSS filter after lqT changes — composed with the active colour/simulation filter, and with
   * whatever texture-cache invalidation that triggers elsewhere. That composition belongs to other subsystems and
   * stays with the host; this module only owns lqT + the SVG filter node.
   */
  onChange: () => void;
  /**
   * Where the amount is kept — the page's store, built by the root (ADR-0232, issue #207). Required: an enhancement read
   * from nowhere starts OFF at every visit for the child with low vision who turned it on.
   */
  store: Pick<Store, 'getNum' | 'set'>;
}

let onChange: () => void = () => {};

/** Wires the injected recompose callback and READS the stored amount — at init, never at import (ADR-0232). Call once
 *  during the host's boot. */
export function initLqFilter(ctx: LqFilterCtx): void {
  onChange = ctx.onChange;
  lqStore = ctx.store;
  lqT = clamp01(ctx.store.getNum(KEYS.lq, 0));
}

/** Sets lqT (clamped to 0..1), persists it, updates the live SVG table (if the filter is already on-screen),
 * then calls the injected `onChange` to let the host recompose the CSS filter. */
export function setLq(t: number): void {
  lqT = clamp01(t);
  lqStore?.set(KEYS.lq, lqT);
  if (lqT > 0) {
    const f = ensureLqFilter();
    const tv = lqCurve(lqT);
    f.querySelectorAll('feFuncR,feFuncG,feFuncB').forEach((fn) => fn.setAttribute('tableValues', tv));
  }
  onChange();
}
