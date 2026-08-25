// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/world-tex (project node). ZOMBIES + Right-BICEP. O builder worldCanvas usa canvas/PIXI
// (verificado no boot: a textura do nível inteiro); aqui testamos o predicado puro isGroundType.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, render/world-tex).
import { describe, it, expect } from 'vitest';
import { isGroundType } from '../app/js/render/world-tex.js';

describe('isGroundType', () => {
  it('pedra (2) e parede (6) recebem o tileset do tema', () => {
    expect(isGroundType(2)).toBe(true);
    expect(isGroundType(6)).toBe(true);
  });
  it('ar/interior/escada/trampolim/água/lava NÃO são "chão de tileset"', () => {
    for (const t of [0, 1, 3, 4, 5, 9]) expect(isGroundType(t)).toBe(false);
  });
});
