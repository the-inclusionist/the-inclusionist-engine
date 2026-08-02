// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de render/scene-parallax — matemática pura do relevo (project node). ZOMBIES + Right-BICEP.
// Os geradores de textura usam canvas/PIXI (verificados no boot); aqui testamos o helper puro hillHeight.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, render/scene-parallax).
import { describe, it, expect } from 'vitest';
import { hillHeight } from '../app/js/render/scene-parallax.js';

// Réplica da fórmula (v3 drawHillBand) para validar o valor exato num ponto.
const ref = (x, near) => {
  const amp = near ? 9 : 5, freq = near ? 0.013 : 0.018, phase = near ? 0 : 140;
  return Math.sin((x + phase) * freq) * amp + Math.sin((x + phase) * freq * 2.3 + 1.7) * amp * 0.4;
};

describe('hillHeight', () => {
  it('bate com a fórmula v3 em pontos concretos', () => {
    for (const x of [0, 37, 200, 999]) {
      expect(hillHeight(x, true)).toBeCloseTo(ref(x, true), 10);
      expect(hillHeight(x, false)).toBeCloseTo(ref(x, false), 10);
    }
  });
  it('é determinístico (mesmo x → mesmo valor)', () => {
    expect(hillHeight(123, true)).toBe(hillHeight(123, true));
  });
  it('Boundary: limitado por amp*1.4 (banda perto=9→12.6, longe=5→7)', () => {
    for (let x = 0; x < 1280; x++) {
      expect(Math.abs(hillHeight(x, true))).toBeLessThanOrEqual(12.6 + 1e-9);
      expect(Math.abs(hillHeight(x, false))).toBeLessThanOrEqual(7 + 1e-9);
    }
  });
  it('a banda da FRENTE (near) oscila mais que a do fundo', () => {
    let mNear = 0, mFar = 0;
    for (let x = 0; x < 1280; x++) { mNear = Math.max(mNear, Math.abs(hillHeight(x, true))); mFar = Math.max(mFar, Math.abs(hillHeight(x, false))); }
    expect(mNear).toBeGreaterThan(mFar);
  });
});
