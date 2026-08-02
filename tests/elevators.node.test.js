// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de game/elevators — geometria de elevador do cadeirante (project node). ZOMBIES + Right-BICEP.
// buildElevators varre o mapa (tile 4=escada / 5=trampolim) via tileAt/surfTop (colisão) → ligamos ambos a
// um mundo FALSO. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, game/elevators).
import { describe, it, expect, beforeEach } from 'vitest';
import * as COL from '../app/js/core/collision.js';
import { buildElevators, elevAt, getElevShafts, initElevators } from '../app/js/game/elevators.js';
import { TILE } from '../app/js/core/constants.js';

// 0=ar, 6=parede sólida, 5=trampolim. Coluna de trampolim (x3, rows 2-3) sobre um chão sólido (row4).
const GRID = [
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 5, 0, 0, 0],
  [0, 0, 0, 5, 0, 0, 0],
  [6, 6, 6, 6, 6, 6, 6],
  [0, 0, 0, 0, 0, 0, 0],
];
function wire(wheelchair) {
  const W = GRID[0].length, H = GRID.length;
  COL.initCollision({
    world: GRID, W, H,
    isWheelchair: () => wheelchair, isModoCego: () => false, caneDiv: () => 1,
    wcSolid: () => new Set(), gateTiles: () => new Set(), gateOpen: () => true,
  });
  initElevators({ W, H, isWheelchair: () => wheelchair });
}

describe('buildElevators', () => {
  beforeEach(() => wire(true));

  it('acha o poço do trampolim (coluna x3) como shaft "wide"', () => {
    buildElevators();
    const tramp = getElevShafts().find((s) => s.xMin === 3 && s.xMax === 3);
    expect(tramp).toBeDefined();
    expect(tramp.kind).toBe('wide'); // trampolim = plataforma larga
    expect(tramp.cols).toEqual([3]);
    expect(tramp.yBottom).toBe(2 * TILE); // trampolim: para EM CIMA (na própria linha)
  });

  it('sempre inclui o fosso só-cadeirante embutido (x53-54)', () => {
    buildElevators();
    expect(getElevShafts().some((s) => s.xMin === 53)).toBe(true);
  });

  it('fora do modo cadeirante não há elevadores', () => {
    wire(false);
    buildElevators();
    expect(getElevShafts()).toEqual([]);
  });
});

describe('elevAt', () => {
  beforeEach(() => { wire(true); buildElevators(); });

  it('detecta o jogador dentro do poço do trampolim', () => {
    const s = elevAt({ x: 3 * TILE + TILE / 2, y: 2 * TILE });
    expect(s).not.toBeNull();
    expect(s.xMin).toBe(3);
  });
  it('retorna null longe de qualquer poço', () => {
    expect(elevAt({ x: 100 * TILE, y: 2 * TILE })).toBeNull();
  });
});
