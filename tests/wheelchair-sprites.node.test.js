// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/wheelchair-sprites — cor da bengala (project node). ZOMBIES + Right-BICEP. As draws são
// PIXI (verificadas no boot); aqui testamos o predicado puro caneColor.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, render/wheelchair-sprites).
import { describe, it, expect } from 'vitest';
import { caneColor } from '../app/js/render/wheelchair-sprites.js';
import { VIZ_BY_KEY } from '../app/js/render/viz-modes.js';

describe('caneColor', () => {
  it('baixa visão → bengala VERDE (0x35d06a)', () => {
    const lowKey = Object.keys(VIZ_BY_KEY).find((k) => VIZ_BY_KEY[k].kind === 'lowvision');
    expect(lowKey).toBeTruthy(); // o catálogo tem um modo de baixa visão
    expect(caneColor({ viz: lowKey })).toBe(0x35d06a);
  });
  it('cego / demais → bengala BRANCA (0xf2f2f2)', () => {
    const blindKey = Object.keys(VIZ_BY_KEY).find((k) => VIZ_BY_KEY[k].kind === 'blind');
    if (blindKey) expect(caneColor({ viz: blindKey })).toBe(0xf2f2f2);
    expect(caneColor({ viz: '__inexistente__' })).toBe(0xf2f2f2); // viz desconhecida cai no branco
  });
});
