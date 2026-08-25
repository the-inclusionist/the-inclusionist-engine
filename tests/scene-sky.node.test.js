// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/scene-sky.cloudWrapX (project NODE: função pura). Contrato (#21): x float (sub-pixel) no intervalo
// [enterAt, enterAt+span); periódico em span; com enterAt=-w e span=telaW+w a nuvem entra/sai INTEIRA (sem meia-borda).
// Serve os dois sentidos de deriva. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (#43).
import { describe, it, expect } from 'vitest';
import { cloudWrapX } from '../app/js/render/scene-sky.js';

describe('render/scene-sky · cloudWrapX', () => {
  it('[Zero] phase 0 → enterAt', () => {
    expect(cloudWrapX(0, -24, 100)).toBe(-24);
  });

  it('[Boundary] periódico em span: phase=span e 2·span voltam ao início', () => {
    expect(cloudWrapX(100, -24, 100)).toBeCloseTo(-24);
    expect(cloudWrapX(200, -24, 100)).toBeCloseTo(-24);
  });

  it('[SubPixel] NÃO arredonda — deriva a <1px/frame avança de fato (corrige #21a)', () => {
    expect(cloudWrapX(0.05, 0, 100)).toBeCloseTo(0.05);
    expect(cloudWrapX(0.11, 0, 100)).toBeCloseTo(0.11);
    expect(cloudWrapX(0.05, 0, 100)).not.toBe(0); // não colapsa p/ inteiro
  });

  it('[Range] x sempre em [enterAt, enterAt+span) p/ qualquer phase', () => {
    const enterAt = -24, span = 100;
    for (let p = -500; p <= 500; p += 7.3) {
      const x = cloudWrapX(p, enterAt, span);
      expect(x).toBeGreaterThanOrEqual(enterAt);
      expect(x).toBeLessThan(enterAt + span);
    }
  });

  it('[Interface] corpo inteiro (corrige #21b): enterAt=-w, span=telaW+w → entra fully-off-left, some fully-off-right', () => {
    const w = 24, telaW = 320, span = telaW + w;
    // extremo esquerdo do intervalo: nuvem totalmente fora à esquerda (x = -w → borda direita da nuvem em 0)
    expect(cloudWrapX(0, -w, span)).toBe(-w);
    // nunca alcança telaW: no supremo, a nuvem já saiu quase inteira à direita e faz o wrap (sem meia-nuvem)
    for (let p = 0; p < span; p += 3.1) {
      expect(cloudWrapX(p, -w, span)).toBeLessThan(telaW);
    }
  });

  it('[Right-BICEP:Direction] deriva p/ ESQUERDA (phase decrescente) também fica no intervalo e faz wrap', () => {
    const enterAt = -28, span = 348;
    const a = cloudWrapX(-1, enterAt, span), b = cloudWrapX(-1 - span, enterAt, span);
    expect(a).toBeCloseTo(b); // −1 e −1−span coincidem (periódico nos negativos)
    expect(a).toBeGreaterThanOrEqual(enterAt);
    expect(a).toBeLessThan(enterAt + span);
  });
});
