// SPDX-License-Identifier: AGPL-3.0-or-later
// render/world-tex — the NORMAL world tile texture builder (Estágio 4, Tier 2). Draws the whole level to a
// canvas (theme tileset on ground, else the v3 per-tile art). Verbatim from game.js. The loaded level grid is
// runtime state (fetched at boot) → injected via initWorldTex, like core/coins. The high-contrast variant
// (worldToTextureDirect) + the viz selector (worldTexFor) + animated water/lava (stepTileFx) stay in game.js.
// See docs/5-Refactoring/plano-modularizacao-mapa.md.

import { makeCanvas, tex } from './canvas.js';
import { TILE, TILE_COLOR } from '../core/constants.js';
import { isSolidType } from '../core/collision.js';

let WORLD: number[][] = [];
let W = 0, H = 0, PXW = 0, PXH = 0;

/** Inject the loaded level grid + dimensions (from game.js, after the map fetch). */
export function initWorldTex(ctx: { world: number[][]; W: number; H: number }): void {
  WORLD = ctx.world; W = ctx.W; H = ctx.H; PXW = W * TILE; PXH = H * TILE;
}

/** Ground/platform tiles that receive the theme tileset. */
export const isGroundType = (t: number): boolean => t === 2 || t === 6;

/** Optional theme tileset: `fill` (interior) + `surface` (top). */
export interface Tileset { fill: CanvasImageSource; surface: CanvasImageSource }

/** Build the NORMAL world canvas: theme tileset on ground (if given), else the v3 per-tile drawings. */
export function worldCanvas(tiles?: Tileset | null): HTMLCanvasElement {
  const cv = makeCanvas(PXW, PXH), c = cv.getContext('2d')!;
  const solidAt = (x: number, y: number): boolean => y >= 0 && y < H && x >= 0 && x < W && isSolidType(WORLD[y]![x]!);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = WORLD[y]![x]!;
    if (t === 0 || t === 1) continue; // ar/interior: transparente → o parallax aparece pela área jogável
    if (tiles && isGroundType(t)) { // tileset: superfície (topo claro) se há ar acima, senão preenchimento
      c.drawImage(solidAt(x, y - 1) ? tiles.fill : tiles.surface, x * TILE, y * TILE); continue;
    }
    // DESENHOS DA V3 (drawTile); água/lava animadas ficam no stepTileFx (game.js)
    const X = x * TILE, Y = y * TILE;
    if (t === 2) { c.fillStyle = '#555'; c.fillRect(X, Y, TILE, TILE); // pedra + pontos escuros
      c.fillStyle = '#3a3a3a'; c.fillRect(X + 2, Y + 3, 1, 1); c.fillRect(X + 9, Y + 5, 1, 1); c.fillRect(X + 5, Y + 11, 1, 1); c.fillRect(X + 12, Y + 9, 1, 1); }
    else if (t === 6) { c.fillStyle = '#666'; c.fillRect(X, Y, TILE, TILE); // parede dura + linhas
      c.fillStyle = '#444'; c.fillRect(X, Y, TILE, 1); c.fillRect(X, Y + TILE - 1, TILE, 1); }
    else if (t === 4) { c.fillStyle = '#777'; // escada VAZADA: trilhos + degraus
      c.fillRect(X + 3, Y, 2, TILE); c.fillRect(X + 11, Y, 2, TILE);
      c.fillRect(X + 3, Y + 2, 10, 2); c.fillRect(X + 3, Y + 8, 10, 2); c.fillRect(X + 3, Y + 14, 10, 2); }
    else if (t === 5) { c.fillStyle = '#E373FA'; c.fillRect(X, Y, TILE, TILE); // trampolim SÓLIDO (bloco inteiro)
      c.fillStyle = '#fff'; c.fillRect(X + 1, Y + 2, TILE - 2, 1);
      c.fillStyle = '#9a3fb0'; c.fillRect(X, Y + TILE - 2, TILE, 2); }
    else if (t === 3) { c.fillStyle = 'rgba(121,220,242,0.4)'; c.fillRect(X, Y, TILE, TILE); } // água translúcida
    else if (t === 9) { c.fillStyle = '#C93232'; c.fillRect(X, Y, TILE, TILE); } // lava (tracinhos no stepTileFx)
    else { c.fillStyle = (TILE_COLOR as Record<number, string>)[t] || '#202'; c.fillRect(X, Y, TILE, TILE); }
  }
  return cv;
}

/** The NORMAL world texture (PIXI) from the current level. */
export function worldToTexture(tiles?: Tileset | null): unknown {
  return tex(worldCanvas(tiles));
}
