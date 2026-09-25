// SPDX-License-Identifier: AGPL-3.0-or-later
// render/lq-filter.ts — the Linear→Quadratic contrast enhancement (low vision, RESEARCH-HIGH-CONTRAST §2.3).
// A PER-PIXEL tone curve over the whole screen, composed through an SVG feComponentTransfer (17 samples, sRGB) in the
// canvas's CSS filter. `lqCurve`/`lqName` are pure (node project); `createLqFilter` is the thin shell that keeps the amount,
// creates the SVG node in the document it is HANDED and writes to it (ADR-0232 D4, issue #207: one per root, the root
// builds it). Recomposing the final CSS filter (with the colour modes) belongs to the host, through the injected
// `onChange` — this module does not duplicate the other subsystems' caches.

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

/** The document the `<filter>` node lives in — only what the shell touches. */
export type LqDoc = Pick<Document, 'getElementById' | 'createElementNS' | 'body'>;

export interface LqFilterCtx {
  /** The document the SVG `<filter>` is created in and looked up from — passed, never the global one (ADR-0232). */
  doc: LqDoc;
  /**
   * Recomposes the app's CSS filter after the amount changes — composed with the active colour/simulation filter, and
   * with whatever texture-cache invalidation that triggers elsewhere. That composition belongs to other subsystems and
   * stays with the host; this module only owns the amount + the SVG filter node.
   */
  onChange: () => void;
  /**
   * Where the amount is kept — the page's store, built by the root (ADR-0232, issue #207). Required: an enhancement read
   * from nowhere starts OFF at every visit for the child with low vision who turned it on.
   */
  store: Pick<Store, 'getNum' | 'set'>;
}

/** One root's L→Q enhancement. */
export interface LqFilter {
  /** CSS `filter` fragment for the current amount ('' when off) — ensures the SVG node exists BEFORE returning the
   *  `url()` reference (a dangling reference would hide the canvas). Composed by callers with viz-mode filters. */
  filter(): string;
  /** The current amount (0..1) — read by the visual-settings panel and the debug/`__incl` surface. */
  t(): number;
  /** Sets the amount (clamped to 0..1), persists it, updates the live SVG table (if the filter is already on-screen),
   *  then calls the injected `onChange` to let the host recompose the CSS filter. */
  set(t: number): void;
}

/**
 * Builds the enhancement and READS the stored amount — at build, never at import (ADR-0232). The amount lives in this
 * closure: two roots on one page each keep their own.
 */
export function createLqFilter(ctx: LqFilterCtx): LqFilter {
  const { doc, store, onChange } = ctx;
  let amount = clamp01(store.getNum(KEYS.lq, 0));

  /** Reads (or lazily creates) the `<filter id="lq-enh">` SVG node, appended once to the document's body. */
  function ensureNode(): SVGFilterElement {
    const existing = doc.getElementById(FILTER_ID);
    if (existing) return existing as unknown as SVGFilterElement;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = doc.createElementNS(NS, 'svg') as unknown as SVGSVGElement;
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    const f = doc.createElementNS(NS, 'filter') as unknown as SVGFilterElement;
    f.id = FILTER_ID;
    f.setAttribute('color-interpolation-filters', 'sRGB');
    const ct = doc.createElementNS(NS, 'feComponentTransfer');
    (['feFuncR', 'feFuncG', 'feFuncB'] as const).forEach((ch) => {
      const fn = doc.createElementNS(NS, ch);
      fn.setAttribute('type', 'table');
      fn.setAttribute('tableValues', lqCurve(amount));
      ct.appendChild(fn);
    });
    f.appendChild(ct);
    svg.appendChild(f);
    doc.body.appendChild(svg);
    return f;
  }

  function filter(): string {
    if (amount <= 0) return '';
    ensureNode();
    return `url(#${FILTER_ID})`;
  }

  function set(t: number): void {
    amount = clamp01(t);
    store.set(KEYS.lq, amount);
    if (amount > 0) {
      const f = ensureNode();
      const tv = lqCurve(amount);
      f.querySelectorAll('feFuncR,feFuncG,feFuncB').forEach((fn) => fn.setAttribute('tableValues', tv));
    }
    onChange();
  }

  return { filter, t: () => amount, set };
}
