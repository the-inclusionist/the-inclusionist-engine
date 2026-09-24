// SPDX-License-Identifier: AGPL-3.0-or-later
// render/viewports — the IMAGE FACTORY of the accessible vision modes: how a MODE becomes a PIXEL.
//
// The pair of render/viz-setters, which holds the POLICY ("which mode counts where": per player, global, overlays,
// panels). Here lives the other half — producing the pixel itself, which the policy consumes:
//   · `pixiFilterFor`  — mode → the viewport's GPU filter (colour blindness, blindness, low vision)
//   · `parallaxTexFor` — background layer i, recoloured (or not) for the mode
//   · `treeTexFor`     — background decoration, likewise
//   · `playerVizTex`   — the player's frame with a dark outline in high contrast
//   · `lvOverlay*` / `renderVpOverlay` — low vision's haze/tunnel/spot INSIDE the viewport's render texture
//
// THE DUPLICATION THIS CURES: the six colour-blindness matrices were once written twice — as `<feColorMatrix>` in a
// page's HTML (the single-screen path) and as a `PIXI.ColorMatrixFilter` (the multi-screen path). They live in
// render/cvd-matrices (a leaf, zero deps); `pixiFilterFor` reads from there and `initViewports` GENERATES the document's
// `<filter>`s from there too. A divergence would be silent and about accessibility: the same colour-blind person would
// see different colours on one screen and on several.
//
// Boundaries this module does NOT reopen:
//  · `parallaxTexNormal` and the tree texture (the RAW textures, the recolour's source) are born in the host — the
//    first filled by the host's scenery loader (a PNG per theme), the second by its procedural drawing. They come in
//    injected. `parallaxTexNormal` is an array whose ELEMENTS the host swaps in place → it comes in by VALUE (the array
//    is the same object); the viewport textures are REASSIGNED whenever the number of screens changes → by GETTER.
//  · The overlay sprite and the renderer are PIXI objects the host creates and come in through a STRUCTURAL
//    interface, so the module runs in the `node` project without importing PIXI.
//
// WHY `getTreeTexNormal`/`getLvOverlaySpr` are GETTERS and not values: BOOT ORDER, not reassignment. A host may call
// `clearParallaxTexCache` while restoring a saved scenery before those objects exist; with getters, `initViewports`
// can be called early enough for that call to work, where a value would be read before it exists — and a scenery
// restore inside a `try/catch` that falls back to a default would lose the chosen scenery silently.
//
// NO I/O on import: no makeCanvas/tex in the module body. `initViewports`'s one effect is generating the SVG `<filter>`s,
// which is precisely the point of curing the duplication.

import { LOGICAL_W, LOGICAL_H } from '../core/constants.js';
import { makeCanvas, tex } from './canvas.js';
import { DIRECT_CFG, directBgTexture, directSpriteTexture } from './high-contrast.js';
import { VIZ_BY_KEY } from './viz-modes.js';
import { drawLowVision } from './low-vision-drawing.js';
import { CVD_MATRIX, installCvdFilters, type CvdKey } from './cvd-matrices.js';
import type { RenderInto } from './port.js';

/* ===================== structural interfaces (PIXI without importing PIXI) ===================== */

/** What `pixiFilterFor` touches of a `PIXI.ColorMatrixFilter` — and only that. */
interface ColorMatrixLike {
  matrix: number[];
  brightness(b: number, multiply: boolean): void;
  contrast(amount: number, multiply: boolean): void;
}
interface ColorMatrixCtor { new (): ColorMatrixLike }
/** `PIXI.BlurFilter` is opaque here: it is only built with a strength and handed to the sprite's `filters`. */
interface BlurCtor { new (strength: number): unknown }

/**
 * The modes a COLOUR MATRIX draws, besides colour vision (which reads the single source, `CVD_MATRIX`). Blindness is
 * brightness 0 NOT multiplied — black, not darkened; the cataract's haze is contrast lowered and THEN a multiplied
 * brightness, and the order is the effect.
 */
const MATRIX_OF: Readonly<Record<string, (c: ColorMatrixLike) => void>> = {
  blind: (c) => { c.brightness(0, false); },
  'lv-haze': (c) => { c.contrast(-0.45, false); c.brightness(1.12, true); },
};

/** The modes a BLUR draws, and how strong. The tunnel and the spots are also drawn as a texture on top (`renderVpOverlay`). */
const BLUR_OF: Readonly<Record<string, number>> = { 'lv-blur': 5, 'lv-tunnel': 1.5, 'lv-diabetic': 2, 'lv-macular': 2 };

/**
 * A mode's viewport filter, or `null` for a mode with none — and for one whose PIXI constructor is missing, which falls back
 * to no filter instead of throwing. High contrast is never here: it is a texture, not a filter.
 */
function filterFor(mode: string, CM: ColorMatrixCtor | null | undefined, BL: BlurCtor | null | undefined): unknown[] | null {
  const cvd = CVD_MATRIX[mode as CvdKey]; // the single source: the SAME numbers that build the HTML `<feColorMatrix>`
  // a COPY of the matrix: holding the module's array, the filter's own calls would rewrite the source every mode reads
  const paint = cvd ? (c: ColorMatrixLike) => { c.matrix = cvd.slice(); } : MATRIX_OF[mode];
  if (paint) return CM ? [matrixWith(CM, paint)] : null;
  const strength = BLUR_OF[mode];
  return strength !== undefined && BL ? [new BL(strength)] : null;
}

function matrixWith(CM: ColorMatrixCtor, paint: (c: ColorMatrixLike) => void): ColorMatrixLike {
  const c = new CM();
  paint(c);
  return c;
}
/** The sprite reused to stamp the low-vision overlay — only its texture is swapped. */
interface TexturedSprite { texture: unknown }
// The renderer comes in as the CAPABILITY `RenderInto`, not the renderer object: PixiJS's `render` asks for an
// `IRenderableObject`, and a parameter declared `unknown` does not fit there by contravariance. See `render/port`'s
// header.

export interface ViewportsCtx {
  /* --- PIXI's filter constructors (they may be missing: then the mode gets no filter instead of throwing) --- */
  ColorMatrixFilter: ColorMatrixCtor | null | undefined; // PIXI.ColorMatrixFilter — colour blindness, blindness, haze
  BlurFilter: BlurCtor | null | undefined;               // PIXI.BlurFilter — blur, tunnel, spot, spots

  /* --- NORMAL textures: the raw source of every high-contrast recolour --- */
  parallaxTexNormal: unknown[];          // the host swaps its ELEMENTS in place → by value
  getTreeTexNormal: () => unknown;       // a GETTER for boot order (see the header)

  /* --- PIXI objects the host creates (z-order and lifecycle welded there) --- */
  getLvOverlaySpr: () => TexturedSprite; // a GETTER likewise; the stamping sprite, never in a container
  renderInto: RenderInto;                // the host's renderer
  getVpTex: () => unknown[];             // a GETTER: the viewport textures are REASSIGNED when the number of screens changes

  /* --- DOM: the host of the generated <filter>s (the cure for the duplicated matrices) --- */
  cvdDefsHost: Element | null;  // an SVG `<defs>`; absent = the six filters are not generated
}

export interface ViewportsApi {
  /** Parallax layer `i` in `mode`: high contrast pushes the background back (desaturates/darkens); else the raw texture. */
  parallaxTexFor(i: number, mode: string): unknown;
  /** Background decoration (tree) in `mode`: the parallax's rule, its own cache. */
  treeTexFor(mode: string): unknown;
  /** The player's frame in `mode`: high contrast gets a dark outline (it jumps off the pushed-back background). */
  playerVizTex(base: unknown, mode: string): unknown;
  /** The viewport's GPU filter for `mode` (an array of filters, or `null` when the mode uses none). */
  pixiFilterFor(mode: string): unknown;
  /** The 320×180 canvas of the low-vision overlay (`haze`/`tunnel`/`macular`/`diabetic`). */
  lvOverlayCanvas(lv: string): HTMLCanvasElement;
  /** The low-vision overlay texture (memoised). `blur` has no overlay — it is a pure filter → `null`. */
  lvOverlayTex(lv: string): unknown;
  /** Stamps player `i`'s low-vision overlay INSIDE the viewport's render texture, over the scene. */
  renderVpOverlay(i: number, mode: string): void;
  /** Invalidates the recoloured parallax cache — the scenery changed, the raw textures are different. */
  clearParallaxTexCache(): void;
  /** Invalidates the cache of outlined player frames (called by `rebakeDirect` in viz-setters). */
  clearPlayerDirectCache(): void;
}

export function initViewports(ctx: ViewportsCtx): ViewportsApi {
  // Generates the document's six colour-blindness <filter>s from render/cvd-matrices — the SAME source pixiFilterFor
  // reads just below. That is why one screen and several can no longer diverge.
  installCvdFilters(ctx.cvdDefsHost);

  /* ===================== background: parallax and decoration ===================== */

  const _parallaxTexHC: Record<string, unknown[]> = {}; // {mode: [tex,tex,tex]}
  function parallaxTexFor(i: number, mode: string): unknown {
    if (DIRECT_CFG[mode]) {
      (_parallaxTexHC[mode] = _parallaxTexHC[mode] || []);
      if (!_parallaxTexHC[mode][i]) _parallaxTexHC[mode][i] = directBgTexture(ctx.parallaxTexNormal[i] as never, mode);
      return _parallaxTexHC[mode][i]; // direct: the background steps back
    }
    return ctx.parallaxTexNormal[i];
  }
  function clearParallaxTexCache(): void { for (const k in _parallaxTexHC) delete _parallaxTexHC[k]; }

  const _treeTexHC: Record<string, unknown> = {};
  function treeTexFor(mode: string): unknown {
    if (DIRECT_CFG[mode]) {
      if (!_treeTexHC[mode]) _treeTexHC[mode] = directBgTexture(ctx.getTreeTexNormal() as never, mode);
      return _treeTexHC[mode]; // direct: the decoration steps back
    }
    return ctx.getTreeTexNormal();
  }

  /* ===================== foreground: the player ===================== */

  // {mode: Map<baseTexture, outlinedTexture>} — keyed by the SOURCE texture because the player changes frame every tick;
  // a Map per mode avoids outlining the same frame again on every loop of the animation.
  let _playerDirect: Record<string, Map<unknown, unknown>> = {};
  function playerVizTex(base: unknown, mode: string): unknown {
    if (!base) return base;
    if (DIRECT_CFG[mode]) {
      const mm = (_playerDirect[mode] = _playerDirect[mode] || new Map());
      if (!mm.has(base)) mm.set(base, directSpriteTexture(base as never, mode));
      return mm.get(base); // direct: the player with a dark outline → it jumps out
    }
    return base;
  }
  function clearPlayerDirectCache(): void { _playerDirect = {}; }

  /* ===================== the viewport's filter ===================== */

  // Cached per MODE and by identity: the same filter array always comes back, so switching viewport does not rebuild the
  // filter (nor invalidate PIXI's shader). It keeps `null` too — `mode in cache` and not `cache[mode]` — so a mode with
  // no filter (normal, hc-*) is not reprocessed every frame.
  const _vpFilterCache: Record<string, unknown> = {};
  function pixiFilterFor(mode: string): unknown {
    if (mode in _vpFilterCache) return _vpFilterCache[mode];
    return _vpFilterCache[mode] = filterFor(mode, ctx.ColorMatrixFilter, ctx.BlurFilter);
  }

  /* ===================== low vision: the overlay as a texture ===================== */

  // What the GPU filter cannot do: a cataract's haze, glaucoma's tunnel, macular degeneration's central spot and
  // retinopathy's scattered spots. They are drawing, not a colour transform — they come as a texture.
  function lvOverlayCanvas(lv: string): HTMLCanvasElement {
    const W = LOGICAL_W, H = LOGICAL_H, cv = makeCanvas(W, H), c = cv.getContext('2d')!;
    drawLowVision(c, lv, W, H); // one drawing for the viewports and for the world `createGame` declares (issue #182)
    return cv;
  }

  const _lvOverlayTex: Record<string, unknown> = {};
  function lvOverlayTex(lv: string): unknown {
    if (lv === 'blur') return null; // blur is a pure filter, there is nothing to stamp
    if (!_lvOverlayTex[lv]) _lvOverlayTex[lv] = tex(lvOverlayCanvas(lv));
    return _lvOverlayTex[lv];
  }

  // The overlay INSIDE the render texture (the viewport's indicator dot sits on top, OUTSIDE the filter — which is why
  // it stays visible in blindness mode; see updateVpDots in render/viz-setters).
  function renderVpOverlay(i: number, mode: string): void {
    const m = VIZ_BY_KEY[mode];
    if (!m || m.kind !== 'lowvision') return;
    const t = lvOverlayTex(m.lv as string);
    if (t) { const spr = ctx.getLvOverlaySpr(); spr.texture = t; ctx.renderInto(spr, ctx.getVpTex()[i], false); }
  }

  return {
    parallaxTexFor, treeTexFor, playerVizTex, pixiFilterFor,
    lvOverlayCanvas, lvOverlayTex, renderVpOverlay,
    clearParallaxTexCache, clearPlayerDirectCache,
  };
}
