// SPDX-License-Identifier: AGPL-3.0-or-later
// core/screens — the screen grid, single source.
//
// Why these tests exist: the sum was once copied in five places (layout, CRT, HUD, configureRender and fitsN) and ONE
// copy diverged — `cols = n<=2 ? n : 2`, without the `n<=1` guard. For n>=1 both give the same result, so the
// divergence went unnoticed with no symptom. The case that separates them is n=0: the right version returns 1 column,
// the divergent one returns 0, and dividing the window into 0 columns gives NaN in all the geometry. Testing only what
// the game reaches today would let a wrong copy pass again.
import { describe, it, expect } from 'vitest';
import { screenGrid, screenBaseSize } from '../app/js/core/screens.js';

describe('core/screens — a grade', () => {
  it('[Right] 1 jogador -> 1x1 · 2 -> 2x1 · 3 e 4 -> 2x2', () => {
    expect(screenGrid(1)).toEqual({ cols: 1, rows: 1 });
    expect(screenGrid(2)).toEqual({ cols: 2, rows: 1 });
    expect(screenGrid(3)).toEqual({ cols: 2, rows: 2 });
    expect(screenGrid(4)).toEqual({ cols: 2, rows: 2 });
  });

  // THIS is the case that separates the right version from the divergent copy.
  it('[Zero] nenhuma tela ainda devolve UMA coluna — nunca zero', () => {
    expect(screenGrid(0).cols).toBe(1);
    expect(screenGrid(-1).cols).toBe(1);
  });

  it('[Boundary] a grade sempre comporta todo mundo, de 0 a 4', () => {
    for (let n = 0; n <= 4; n++) {
      const { cols, rows } = screenGrid(n);
      expect(cols * rows).toBeGreaterThanOrEqual(Math.max(1, n));
    }
  });

  it('[Right] nenhuma dimensão é zero, para nenhuma entrada', () => {
    for (let n = -2; n <= 6; n++) {
      const { cols, rows } = screenGrid(n);
      expect(cols).toBeGreaterThan(0);
      expect(rows).toBeGreaterThan(0);
    }
  });
});

describe('core/screens — o tamanho em pixels de arte', () => {
  it('[Right] cada tela vale 320x180 (o pixel canônico do ADR-0010)', () => {
    expect(screenBaseSize(1)).toEqual({ w: 320, h: 180 });
    expect(screenBaseSize(2)).toEqual({ w: 640, h: 180 });
    expect(screenBaseSize(4)).toEqual({ w: 640, h: 360 });
  });

  it('[Interface] o tamanho deriva da grade — as duas contas não podem discordar', () => {
    for (let n = 0; n <= 4; n++) {
      const { cols, rows } = screenGrid(n);
      expect(screenBaseSize(n)).toEqual({ w: 320 * cols, h: 180 * rows });
    }
  });
});
