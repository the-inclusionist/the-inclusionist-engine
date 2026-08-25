// SPDX-License-Identifier: AGPL-3.0-or-later
// render/wheelchair-sprites — the a11y mobility props (Estágio 4, Tier 2): the white/green cane (blind /
// low-vision), the running cane (item), and the wheelchair. Stateless PIXI drawing (verbatim from game.js):
// each takes a Graphics `g` + the player. The layers (caneLayer/chairLayer) stay in game.js and are passed in.
// `caneColor` (pure) moves here too — it was only used by the cane draws. See docs/5-Refactoring/plano-modularizacao-mapa.md.

import { VIZ_BY_KEY } from './viz-modes.js';
import type { PlayerView } from '../core/entity.js';

/** Minimal PIXI.Graphics surface these draws use (structural → module stays PIXI-free for node tests). */
export interface DrawGraphics {
  lineStyle(width: number, color?: number): unknown;
  moveTo(x: number, y: number): unknown;
  lineTo(x: number, y: number): unknown;
  beginFill(color: number): unknown;
  endFill(): unknown;
  drawCircle(x: number, y: number, r: number): unknown;
}
/** Cadeira e bengala: onde o jogador está, para que lado olha, e em que modo de visão desenhar. */
type DrawablePlayer = PlayerView<'facing' | 'x' | 'y' | 'viz'>;

/** Cane color: green for low-vision, white otherwise (blind). */
export function caneColor(pl: { viz: string }): number {
  const m = (VIZ_BY_KEY as Record<string, { kind?: string }>)[pl.viz];
  return m && m.kind === 'lowvision' ? 0x35d06a : 0xf2f2f2;
}

/** Rigid half-block cane (~8px): front-hand extension, fixed to the body (does not swing on its own). */
export function drawCane(g: DrawGraphics, pl: DrawablePlayer): void {
  const dir = pl.facing < 0 ? -1 : 1, C = caneColor(pl);
  const hx = pl.x + dir * 4, hy = pl.y - 9, tx = pl.x + dir * 8, ty = pl.y - 1; // punho na mão → ponteira no chão à frente
  g.lineStyle(2, C); g.moveTo(hx, hy); g.lineTo(tx, ty); // haste curta (branca=cego / verde=baixa visão)
  g.lineStyle(1, 0xd23b3b); g.moveTo(tx - dir * 2, ty - 2); g.lineTo(tx, ty); // faixa vermelha (ponta)
  g.lineStyle(0); g.beginFill(C); g.drawCircle(tx, ty, 1.3); g.endFill(); // ponteira
}

/** Running cane (item): a wheel at the tip, constant ground contact (high performance). */
export function drawRunCane(g: DrawGraphics, pl: DrawablePlayer): void {
  const dir = pl.facing < 0 ? -1 : 1, C = caneColor(pl);
  const hx = pl.x + dir * 4, hy = pl.y - 9, wx = pl.x + dir * 10, wy = pl.y - 2; // haste até o eixo da roda, à frente
  g.lineStyle(2, C); g.moveTo(hx, hy); g.lineTo(wx, wy - 1);
  g.lineStyle(1.5, C); g.drawCircle(wx, wy, 2.4); // RODA na ponta (contato constante)
  g.lineStyle(1, 0xd23b3b); g.moveTo(wx - 2.4, wy); g.lineTo(wx + 2.4, wy); g.lineStyle(0); // eixo/faixa
}

/** The wheelchair (big spoked wheel + backrest + footrest), drawn under the seated player. */
export function drawChair(g: DrawGraphics, pl: DrawablePlayer): void {
  const cx = pl.x, base = pl.y, f = pl.facing < 0 ? -1 : 1, MET = 0x4a586e, HUB = 0x1c2230;
  g.lineStyle(2, MET); g.drawCircle(cx, base - 6, 7); // roda grande
  g.lineStyle(1, MET); for (let a = 0; a < 6; a++) { const an = a * Math.PI / 3; g.moveTo(cx, base - 6); g.lineTo(cx + Math.cos(an) * 6, base - 6 + Math.sin(an) * 6); } // raios
  g.lineStyle(0); g.beginFill(HUB); g.drawCircle(cx, base - 6, 2); g.endFill(); // cubo
  g.lineStyle(3, MET); g.moveTo(cx - f * 5, base - 6); g.lineTo(cx - f * 5, base - 22); g.lineTo(cx - f * 2, base - 24); // encosto
  g.moveTo(cx + f * 4, base - 4); g.lineTo(cx + f * 9, base - 2); // apoio de pés
  g.lineStyle(0);
}
