// SPDX-License-Identifier: GPL-3.0-or-later
// render/scene-parallax — parallax background TEXTURE generators (Estágio 4, Tier 2). Pure builders: given a
// theme (or a city-placeholder index) they return a PIXI texture. Formulas verbatim from game.js (v3 drawBackdrop
// / drawHillBand). The per-frame scroll (`updateParallax`) stays in game.js — it is render-graph glue (moves the
// TilingSprites + the sky-deco layers). See docs/5-Refactoring/plano-modularizacao-mapa.md.

import { makeCanvas, tex } from './canvas.js';
import { LOGICAL_H } from '../core/constants.js';

/** A scenery theme's parallax colors. */
export interface ParallaxTheme {
  sky: readonly [string, string];
  hills: readonly [string, string];
}

/** Hill silhouette height at column `x` (v3 drawHillBand: double sine). `near` = the front (taller) band. */
export function hillHeight(x: number, near: boolean): number {
  const amp = near ? 9 : 5, freq = near ? 0.013 : 0.018, phase = near ? 0 : 140;
  return Math.sin((x + phase) * freq) * amp + Math.sin((x + phase) * freq * 2.3 + 1.7) * amp * 0.4;
}

/** City placeholder backdrop (the 4 v3 themes have their own sky/hills below). */
export function parallaxPlaceholder(i: number): unknown {
  const w = 320, h = LOGICAL_H, cv = makeCanvas(w, h), c = cv.getContext('2d')!;
  const pal = [['#0a1024', '#1b2350'], ['#13284a', '#22406e'], ['#1d3a52', '#356a86']][i]!;
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, pal[0]!); g.addColorStop(1, pal[1]!); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = pal[1]!;
  for (let x = 0; x < w; x += 44 + i * 14) { const hh = 24 + ((x * 7 + i * 29) % (46 + i * 22)); c.fillRect(x, h - hh, 30 + i * 6, hh); }
  c.fillStyle = 'rgba(255,255,255,.18)'; for (let k = 0; k < 8; k++) c.fillRect((k * 53 + i * 17) % w, (k * 23 + i * 11) % (h - 40), 2, 2);
  return tex(cv);
}

/** Theme sky: pure vertical gradient (v3 drawBackdrop). */
export function themeSkyTexture(T: ParallaxTheme): unknown {
  const w = 64, h = LOGICAL_H, cv = makeCanvas(w, h), c = cv.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, T.sky[0]); g.addColorStop(1, T.sky[1]); c.fillStyle = g; c.fillRect(0, 0, w, h);
  return tex(cv);
}

/** Theme hills band (v3 drawHillBand): double sine, transparent above the silhouette. `near` = front band. */
export function themeHillsTexture(T: ParallaxTheme, near: boolean): unknown {
  const w = 1280, h = LOGICAL_H, cv = makeCanvas(w, h), c = cv.getContext('2d')!;
  const horizon = Math.round(h * 0.5), baseY = horizon + (near ? 16 : 4);
  c.fillStyle = T.hills[near ? 1 : 0];
  for (let x = 0; x < w; x++) { const top = Math.round(baseY - hillHeight(x, near)); c.fillRect(x, top, 1, h - top); }
  return tex(cv);
}
