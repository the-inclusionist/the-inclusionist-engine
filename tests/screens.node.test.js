// SPDX-License-Identifier: GPL-3.0-or-later
// core/screens — a grade de telas, fonte única.
//
// Por que estes testes existem: a conta estava copiada em cinco lugares (layout, CRT, HUD, configureRender e
// fitsN) e UMA das cópias divergia — `cols = n<=2 ? n : 2`, sem a guarda de `n<=1`. Para n>=1 as duas dão o
// mesmo resultado, então a divergência atravessou a vida inteira do arquivo sem sintoma. O caso que a separa
// é n=0: a versão certa devolve 1 coluna, a divergente devolve 0, e dividir a janela em 0 colunas dá NaN em
// toda a geometria. Testar só o que o jogo alcança hoje teria deixado a cópia errada passar de novo.
import { describe, it, expect } from 'vitest';
import { screenGrid, screenBaseSize } from '../app/js/core/screens.js';

describe('core/screens — a grade', () => {
  it('[Right] 1 jogador -> 1x1 · 2 -> 2x1 · 3 e 4 -> 2x2', () => {
    expect(screenGrid(1)).toEqual({ cols: 1, rows: 1 });
    expect(screenGrid(2)).toEqual({ cols: 2, rows: 1 });
    expect(screenGrid(3)).toEqual({ cols: 2, rows: 2 });
    expect(screenGrid(4)).toEqual({ cols: 2, rows: 2 });
  });

  // ESTE é o caso que separa a versão certa da cópia divergente.
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
