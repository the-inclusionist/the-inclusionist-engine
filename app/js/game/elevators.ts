// SPDX-License-Identifier: GPL-3.0-or-later
// game/elevators — wheelchair-mode elevator GEOMETRY (Estágio 4, Tier 2). buildElevators scans the tile map
// for shafts (ladders/trampolines become elevators) + adds the chair-only shafts; elevAt tests whether a
// player is riding one. Pure geometry (verbatim from game.js) — the glass-cabin DRAWING (drawElevators)
// stays in game.js. The level dims + wheelchair flag are injected; tileAt/surfTop/BOX are imported.
// See docs/5-Refactoring/plano-modularizacao-mapa.md.

import { tileAt, surfTop } from '../core/collision.js';
import type { PlayerView } from '../core/entity.js';
import { TILE, TILE_TYPES } from '../core/constants.js';
import { BOX } from './player.js';

/** Elevator ride speed (px/frame); the physics ride reads it. */
export const ELEV_SPEED = 2.4;

/** A vertical elevator shaft. `carY` is the persistent cabin position (set while drawing). */
export interface ElevShaft {
  cols: number[];
  xMin: number;
  xMax: number;
  yTop: number;
  yBottom: number;
  kind: 'wide' | 'thin';
  carY?: number;
}
/** Quem pode andar de elevador: só a posição importa. */
type RideablePlayer = PlayerView<'x' | 'y'>;

// Chair-only elevators (no trampoline in normal mode): a pit where the player normally JUMPS.
// D: pit x53-54 — rises from the floor (row45) to the platform (row42), exit to the left (x52).
const WC_ELEVATORS = [{ cols: [53, 54], yTop: 42 * TILE, yBottom: 45 * TILE, kind: 'wide' as const }];

let elevShafts: ElevShaft[] = [];
let W = 0, H = 0;
let isWheelchair: () => boolean = () => false;

/** Inject the level dimensions + the wheelchair-mode flag (from game.js). */
export function initElevators(ctx: { W: number; H: number; isWheelchair: () => boolean }): void {
  W = ctx.W; H = ctx.H; isWheelchair = ctx.isWheelchair;
}

/** The current shafts (mutable ref — the cabin drawing writes `carY`). */
export const getElevShafts = (): ElevShaft[] => elevShafts;

const solidTypeAt = (t: number): boolean => !!(TILE_TYPES as Record<number, { solid?: boolean }>)[t]?.solid;

/** Recompute the elevator shafts from the tile map (ladders/trampolines) + the chair-only pits. */
export function buildElevators(): void {
  elevShafts = [];
  if (!isWheelchair()) return;
  const isE = (x: number, y: number): boolean => { const t = tileAt(x, y); return t === 4 || t === 5; };
  const wall = (x: number, y: number): boolean => { const t = tileAt(x, y); return solidTypeAt(t) && t !== 5; };
  const seen = new Set<string>();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!isE(x, y) || seen.has(x + ',' + y)) continue;
    let x2 = x; while (x2 + 1 < W && isE(x2 + 1, y)) x2++; // largura do poço (run horizontal)
    const cols: number[] = []; for (let cx = x; cx <= x2; cx++) cols.push(cx);
    let yb = y; while (yb + 1 < H && isE(cols[0]!, yb + 1)) yb++; // base do run vertical
    for (const cx of cols) for (let yy = y; yy <= yb; yy++) seen.add(cx + ',' + yy);
    let ytop = y; while (ytop - 1 >= 0 && !cols.some((cx) => wall(cx, ytop - 1))) ytop--; // topo aberto (até um teto sólido)
    const isTramp = tileAt(cols[0]!, y) === 5;
    let fr = yb + 1; while (fr < H && !wall(cols[0]!, fr)) fr++; // 1º chão sólido abaixo (p/ escada)
    const yBottom = isTramp ? y * TILE : fr * TILE; // trampolim = CHÃO sólido (para EM CIMA); escada = desce ao chão de baixo
    const L = cols[0]! - 1, R = cols[cols.length - 1]! + 1;
    let yTop = yBottom; for (let r = ytop; r <= yb; r++) { if (surfTop(L, r) || surfTop(R, r)) { yTop = r * TILE; break; } } // 1ª parada c/ piso ao lado
    elevShafts.push({ cols, xMin: cols[0]!, xMax: cols[cols.length - 1]!, yTop, yBottom, kind: isTramp ? 'wide' : 'thin' });
  }
  for (const e of WC_ELEVATORS) elevShafts.push({ cols: e.cols, xMin: e.cols[0]!, xMax: e.cols[e.cols.length - 1]!, yTop: e.yTop, yBottom: e.yBottom, kind: e.kind }); // fossos só-cadeirante
}

/** The shaft the player is currently in (base tolerance = 1 tile, so ramp-landing still counts), or null. */
export function elevAt(pl: RideablePlayer): ElevShaft | null {
  const l = Math.floor((pl.x - BOX.w / 2) / TILE), r = Math.floor((pl.x + BOX.w / 2 - 0.01) / TILE);
  for (const s of elevShafts) {
    if (r >= s.xMin && l <= s.xMax && pl.y >= s.yTop - 3 && pl.y <= s.yBottom + TILE) return s;
  }
  return null;
}
