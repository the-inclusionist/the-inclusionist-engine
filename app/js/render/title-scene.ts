// SPDX-License-Identifier: AGPL-3.0-or-later
// render/title-scene — title-screen BACKDROP: sky gradient + 4 drifting clouds + dotted grass, drawn into
// `titleG` (v3.1.100 formulas, verbatim). Extracted from game.js's drawTitleScene(). The `titleG` PIXI.Graphics
// layer is CREATED in game.js (`app.stage.addChildAt(titleG, app.stage.getChildIndex(weatherLayer))`) — its
// z-order is soldered into the render-graph assembly there, same precedent as render/scene-sky.ts — and is
// INJECTED here; only the drawing logic moves. cloudWrapX (sub-pixel, whole-body wrap, bug #21) is imported
// straight from render/scene-sky.ts rather than re-implemented — it is already a leaf pure function there.

import { LOGICAL_H } from '../core/constants.js';
import { cloudWrapX } from './scene-sky.js';
import type { Drawing } from './port.js';

// `Gfx` vem de `render/port` desde 2026-08-26: estava escrito cinco vezes na árvore, com quatro
// definições diferentes. Ver o cabeçalho de lá.
type Gfx = Drawing;

export interface TitleSceneCtx {
  /** The PIXI.Graphics layer this scene draws into (created + z-ordered in game.js). */
  titleG: Gfx;
  /** Live screen size (pass `app.screen` — width/height read fresh on every draw()). */
  screen: { width: number; height: number };
  /** Reduced-motion flags; only `.parallax` (reduced parallax/animation) matters here. */
  getRm: () => { parallax?: boolean };
}

export interface TitleScene {
  /** Redraws the title backdrop for the current frame (clears `titleG` first). */
  draw: () => void;
}

// ---------------------------------------------------------------------------------------------
// Pure geometry (no PIXI, testable in node)
// ---------------------------------------------------------------------------------------------

/** The 4 title-screen clouds' logical (unscaled) positions — v3 exact. */
export interface TitleCloudDef { cx: number; cy: number; }
export const TITLE_CLOUDS: readonly TitleCloudDef[] = [
  { cx: 40, cy: 30 }, { cx: 180, cy: 52 }, { cx: 265, cy: 22 }, { cx: 110, cy: 72 },
];

/** Horizon row (sky/grass split), in screen pixels. */
export function titleHorizonY(H: number): number {
  return Math.round(H * 0.735);
}

/** Sky gradient color for scanline `y` (0-indexed from the top), given the horizon row count. RGB
 * interpolation rgb(26→58, 26→76, 58→180) — exact v3 formula, packed as 0xRRGGBB. */
export function titleSkyRowColor(y: number, horizon: number): number {
  const f = y / horizon;
  const r = Math.round(26 + 32 * f), g = Math.round(26 + 50 * f), b = Math.round(58 + 122 * f);
  return (r << 16) | (g << 8) | b;
}

/** This frame's cloud-drift offset: frozen at 0 under reduced motion, else sub-pixel accumulation of the
 * per-draw frame counter (titleT/6) — corrects #21a (no more Math.floor → no "jumps 1px every 6 frames"). */
export function titleCloudDriftOffset(titleT: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : titleT / 6;
}

/** Screen-space x of one title cloud, with whole-body wrap (#21b: the 28px-wide cloud only re-enters once it
 * has left the screen entirely). */
export function titleCloudX(cx: number, k: number, off: number, W: number): number {
  return cloudWrapX(cx * k - off, -28 * k, W + 28 * k);
}

export interface TitleGrassRow { xStart: number; xStep: number; y: number; }

/** The 3 staggered dotted-grass rows below the horizon — v3 exact. */
export function titleGrassRows(k: number, horizon: number): TitleGrassRow[] {
  return [
    { xStart: 0, xStep: 3 * k, y: horizon },
    { xStart: 1 * k, xStep: 4 * k, y: horizon + 3 * k },
    { xStart: 2 * k, xStep: 5 * k, y: horizon + 6 * k },
  ];
}

// ---------------------------------------------------------------------------------------------
// PIXI-facing (thin) — requires the injected `titleG` layer
// ---------------------------------------------------------------------------------------------

export function createTitleScene(ctx: TitleSceneCtx): TitleScene {
  let titleT = 0; // frame counter (module-local state, mirrors the old closure-level `let titleT=0`)

  function drawCloud(g: Gfx, cx: number, cy: number, k: number, off: number, W: number): void {
    const x = titleCloudX(cx, k, off, W), s = k;
    g.beginFill(0xf6f5f0)
      .drawRect(x, cy * s, 28 * s, 6 * s)
      .drawRect(x + 6 * s, (cy - 4) * s, 16 * s, 6 * s)
      .drawRect(x + 2 * s, (cy + 6) * s, 24 * s, 4 * s)
      .endFill();
  }

  function draw(): void {
    const g = ctx.titleG;
    g.clear();
    const W = ctx.screen.width, H = ctx.screen.height, k = H / LOGICAL_H;
    const HOR = titleHorizonY(H);
    for (let y = 0; y < HOR; y++) g.beginFill(titleSkyRowColor(y, HOR)).drawRect(0, y, W, 1).endFill();
    titleT++;
    const off = titleCloudDriftOffset(titleT, !!ctx.getRm().parallax);
    for (const c of TITLE_CLOUDS) drawCloud(g, c.cx, c.cy, k, off, W);
    g.beginFill(0x3f7d20).drawRect(0, HOR, W, H - HOR).endFill();
    g.beginFill(0x2d5b16);
    for (const row of titleGrassRows(k, HOR)) {
      for (let x = row.xStart; x < W; x += row.xStep) g.drawRect(x, row.y, k, k);
    }
    g.endFill();
  }

  return { draw };
}
