// SPDX-License-Identifier: AGPL-3.0-or-later
// core/world.ts — Mundo/nível — constrói o grid a partir do TEXTO-GLIFO (assets/levels/clarity.map.txt). Depende
// só de tiles.ts. O WORLD instanciado + tileAt/wcSolid/gate/rampas ficam no game.js até core/state.js existir.
import { parseLevel } from './tiles.js';

const STRUCTURAL_SOLID = new Set<number>([2, 5, 6, 10]);
const CONVERTIBLE_SOLID = new Set<number>([2, 6]);
const NEEDS_2H = new Set<number>([1, 3, 4, 7, 8, 10, 11]);

function expandNarrowPassages(world: number[][]): void {
  const H = world.length; if (!H) return; const W = world[0].length;
  const orig = world.map((r) => [...r]); const isAir = (t: number) => NEEDS_2H.has(t);
  const walk = Array.from({ length: H }, () => new Array<boolean>(W).fill(false));
  for (let ty = 0; ty < H - 1; ty++) for (let tx = 0; tx < W; tx++)
    if (isAir(orig[ty][tx]) && STRUCTURAL_SOLID.has(orig[ty + 1][tx])) walk[ty][tx] = true;
  let changed = true, guard = 0;
  while (changed && guard++ < W + 4) { changed = false;
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      if (walk[ty][tx] || !isAir(orig[ty][tx])) continue;
      if ((tx > 0 && walk[ty][tx - 1]) || (tx < W - 1 && walk[ty][tx + 1])) { walk[ty][tx] = true; changed = true; }
    }
  }
  for (let ty = 1; ty < H; ty++) for (let tx = 0; tx < W; tx++)
    if (walk[ty][tx] && CONVERTIBLE_SOLID.has(orig[ty - 1][tx])) world[ty - 1][tx] = (orig[ty][tx] === 3) ? 3 : 1;
}

function buildWorld(rawGrid: number[][]): number[][] {
  const W = Math.max(...rawGrid.map((r) => r.length)), H = rawGrid.length;
  const world: number[][] = [];
  for (let cy = 0; cy < H; cy++) { const src = rawGrid[cy], row = new Array<number>(W);
    for (let cx = 0; cx < W; cx++) row[cx] = src[cx] ?? 0; world.push(row); } // vazio à direita → ar escuro (0)
  expandNarrowPassages(world);
  if (world[42]?.[53] !== undefined) world[42][53] = 1; // playability fix
  // E18: itens injetados (fiel à v3 ITEM_PLACEMENTS): 12=super-corrida, 13=ultra-pulo, 14=ventosa
  for (const [x, y, to] of [[13, 8, 12], [55, 37, 13], [13, 26, 14]]) if (world[y]?.[x] !== undefined) world[y][x] = to;
  return world;
}

// Constrói o mundo a partir do texto-glifo (parseLevel -> buildWorld: expand + injeção de itens).
export function buildWorldFromText(text: string): number[][] { return buildWorld(parseLevel(text)); }
export { buildWorld };
