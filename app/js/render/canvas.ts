// SPDX-License-Identifier: AGPL-3.0-or-later
// render/canvas.ts — leaf drawing primitives: offscreen canvas → PixiJS texture + a crisp pixel-art disc.
// The base of every procedural art a game draws. Depends only on document + PIXI (npm), ZERO game state. NEAREST
// everywhere (pixel art, no anti-aliasing).
import * as PIXI from 'pixi.js'; // 7.4.2 through npm (Vite bundles it)

// An offscreen canvas of the requested size (a procedural texture source).
export const makeCanvas = (w: number, h: number): HTMLCanvasElement => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// Canvas → PIXI.Texture with NEAREST scaling (crisp pixel art).
export const tex = (cv: HTMLCanvasElement): PIXI.Texture => { const t = PIXI.Texture.from(cv); t.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST; return t; };
// A disc of WHOLE pixels (crisp jagged edge, no anti-aliasing of vector arcs). edge = the border colour (optional).
export function pixDisc(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string, edge?: string): void { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= r) { c.fillStyle = (edge && d > r - 1.05) ? edge : col; c.fillRect(x, y, 1, 1); } } }

/* ===================== the rectangle painter (px) ===================== */
// WHY IT EXISTS: the pair `makeCanvas(w,h)` + `getContext('2d')` followed by `fillStyle=…; fillRect(…)` shows up all
// over procedural art, and one game once defined THREE local `mk`/`px` helpers with signatures incompatible with each
// other. Here the signature is ONE: `px(x, y, w, h, colour)`.
// WHY IT RETURNS THE CANVAS (and not the texture): half the uses post-process the bitmap before it becomes a texture
// (`outlineCanvas`, `_silhouette`). Whoever only wants the texture uses `pixelTexture` below — two names instead of a
// boolean flag, because the return type is exactly what changes.
/** A filled-rectangle brush: paints `w×h` at `(x,y)` with `col`. It is the `px` every painter gets. */
export type PixelBrush = (x: number, y: number, w: number, h: number, col: string) => void;
/** The body of a pixel-art painting: it gets the brush and draws. No return, no state of its own. */
export type PixelPainter = (px: PixelBrush) => void;
/** An offscreen `w×h` canvas painted by `paint` — the routine those local helpers duplicated. */
export function pixelCanvas(w: number, h: number, paint: PixelPainter): HTMLCanvasElement {
  const cv = makeCanvas(w, h), c = cv.getContext('2d')!;
  paint((x, y, ww, hh, col) => { c.fillStyle = col; c.fillRect(x, y, ww, hh); });
  return cv;
}
/** `pixelCanvas` + `tex`: a shortcut for whoever wants the NEAREST texture directly (sprite art with no post-processing). */
export const pixelTexture = (w: number, h: number, paint: PixelPainter): PIXI.Texture => tex(pixelCanvas(w, h, paint));
