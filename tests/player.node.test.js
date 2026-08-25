// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de game/player — entidade + geometria de colisão (project node). Padrões: ZOMBIES + Right-BICEP.
// As queries leem o mundo via core/collision → inicializamos a colisão com um mundo FALSO e sondamos o jogador
// em coordenadas calculadas (BOX 10×30, TILE 16; pl.y = pés, pl.x = centro). Ver docs/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import * as COL from '../app/js/core/collision.js';
import * as P from '../app/js/game/player.js';
import { TUNE } from '../app/js/core/constants.js';

// ctx mínimo de colisão (modo normal): só o WORLD importa para a geometria do jogador.
const useWorld = (grid) => COL.initCollision({
  world: grid, W: grid[0].length, H: grid.length,
  isWheelchair: () => false, isModoCego: () => false, caneDiv: () => 1,
  wcSolid: () => new Set(), gateTiles: () => new Set(), gateOpen: () => true,
});

describe('game/player — makePlayer (fábrica de estado)', () => {
  it('[Interface] jogador 0 nasce no SPAWN com poder off e sem power-ups', () => {
    const p = P.makePlayer(0);
    expect(p.i).toBe(0);
    expect(p.x).toBe(P.SPAWN_X);
    expect(p.y).toBe(P.SPAWN_Y);
    expect(p.vx).toBe(0); expect(p.vy).toBe(0);
    expect(p.activePower).toBe('off');
    expect(p.owned).toEqual([]);
    expect(p.clingN).toBe(null);
  });
  it('[Many] cada jogador i nasce deslocado 22px à direita (telas/entrada MP)', () => {
    expect(P.makePlayer(1).x).toBe(P.SPAWN_X + 22);
    expect(P.makePlayer(3).x).toBe(P.SPAWN_X + 66);
  });
});

describe('game/player — isBouncyGroundBelow (PEDRA=2 sob os pés dá pique)', () => {
  // jogador em x=40,y=48 → verifica tileAt(2,3) (linha logo abaixo dos pés).
  const at = () => ({ x: 40, y: 48, vx: 0, vy: 0, clingN: null });
  it('[Right] pedra(2) abaixo → true', () => {
    useWorld([[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 2, 0, 0]]);
    expect(P.isBouncyGroundBelow(at())).toBe(true);
  });
  it('[Right/distinção] outro sólido (parede=6) abaixo NÃO dá pique (só pedra)', () => {
    useWorld([[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 6, 0, 0]]);
    expect(P.isBouncyGroundBelow(at())).toBe(false);
  });
  it('[Zero] ar abaixo → false', () => {
    useWorld([[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]);
    expect(P.isBouncyGroundBelow(at())).toBe(false);
  });
});

// Mundo com PAREDE à direita (col3, linhas 1–2). Player flush em x=43,y=48 encosta nela pela direita.
const WALL_R = [[0, 0, 0, 0, 0], [0, 0, 0, 2, 0], [0, 0, 0, 2, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
const OPEN = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2]];

describe('game/player — touchingWall', () => {
  it('[Right] parede sólida encostando à direita → true', () => {
    useWorld(WALL_R);
    expect(P.touchingWall({ x: 43, y: 48, vx: 0, vy: 0, clingN: null })).toBe(true);
  });
  it('[Inverse] espaço aberto → false', () => {
    useWorld(OPEN);
    expect(P.touchingWall({ x: 8, y: 48, vx: 0, vy: 0, clingN: null })).toBe(false);
  });
});

describe('game/player — clingSides / firstClingSide (ventosa aranha)', () => {
  it('[Right] encostado na parede direita → só R; firstClingSide=R', () => {
    useWorld(WALL_R);
    const s = P.clingSides({ x: 43, y: 48, vx: 0, vy: 0, clingN: null });
    expect(s).toEqual({ R: true, L: false, U: false, D: false });
    expect(P.firstClingSide({ x: 43, y: 48, vx: 0, vy: 0, clingN: null })).toBe('R');
  });
  it('[Zero] no aberto → nenhum lado; firstClingSide=null', () => {
    useWorld(OPEN);
    expect(P.clingSides({ x: 8, y: 48, vx: 0, vy: 0, clingN: null })).toEqual({ R: false, L: false, U: false, D: false });
    expect(P.firstClingSide({ x: 8, y: 48, vx: 0, vy: 0, clingN: null })).toBe(null);
  });
});

describe('game/player — spiderReattach (quina CÔNCAVA: parede→teto)', () => {
  it('[Right] grudado na parede (R) subindo, com teto acima → passa a grudar no teto (U), zera vy', () => {
    // col3 rows1-2 = parede (R); (2,1) = teto (U). Player subindo (vy<0) grudado em R.
    useWorld([[0, 0, 0, 0, 0], [0, 0, 2, 2, 0], [0, 0, 0, 2, 0], [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]);
    const pl = { x: 43, y: 48, vx: 0, vy: -1, clingN: 'R' };
    P.spiderReattach(pl, pl.x, pl.y);
    expect(pl.clingN).toBe('U');
    expect(pl.vy).toBe(0);
  });
});

describe('game/player — jumpVel (impulso inicial do pulo)', () => {
  it('[Right] 5 tiles no modo normal = -TUNE.jumpVel (sqrt(5/5)=1)', () => {
    expect(P.jumpVel({ easy: false }, 5)).toBeCloseTo(-TUNE.jumpVel, 10);
  });
  it('[Right/a11y] modo fácil dá empurrão extra (×8/7)', () => {
    expect(P.jumpVel({ easy: true }, 5)).toBeCloseTo(-TUNE.jumpVel * 8 / 7, 10);
  });
  it('[Cross-check] altura ∝ sqrt(tiles): pulo de 20 tiles = 2× a vy do de 5 (sqrt(4)=2)', () => {
    expect(P.jumpVel({ easy: false }, 20) / P.jumpVel({ easy: false }, 5)).toBeCloseTo(2, 10);
  });
  it('[Boundary] vy é NEGATIVA (y cresce para baixo)', () => {
    expect(P.jumpVel({ easy: false }, 5)).toBeLessThan(0);
  });
});
