// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of render/lq-filter — the Linear→Quadratic enhancement curve and the low-vision label (node project).
// `lqCurve`/`lqName` are pure, deterministic maths — the module's best test target (ZOMBIES + Right-BICEP): the 0/1
// edges, the label's three thresholds, and out-of-range values (not clamped, verbatim).
// The DOM shell (ensureLqFilter/lqFilter/setLq) stays out of here — it needs `document` (browser project).
import { describe, it, expect } from 'vitest';
import pt from '../app/js/i18n/pt.js';
import { lqCurve, lqName } from '../app/js/render/lq-filter.js';

// Reference reimplementation of the formula (RESEARCH-HIGH-CONTRAST §2.3) to check lqCurve point by point without
// copying the module's expression — an independent cross-check of the implementation.
function refSample(t, x) {
  const lin = Math.min(1, Math.max(0, 1.3 * (x - 0.5) + 0.5));
  const quad = x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x);
  return ((1 - t) * lin + t * quad).toFixed(4);
}

describe('lqCurve', () => {
  it('[Right] devolve 17 amostras separadas por espaço', () => {
    const parts = lqCurve(0.5).split(' ');
    expect(parts).toHaveLength(17);
    parts.forEach((p) => expect(p).toMatch(/^-?\d+\.\d{4}$/));
  });

  it('[Boundary] t=0 → curva puramente linear (contrast-stretch α=1.3, μ=0.5)', () => {
    const parts = lqCurve(0).split(' ');
    for (let i = 0; i < 17; i++) {
      const x = i / 16;
      expect(parts[i]).toBe(refSample(0, x));
    }
    // the contrast-stretch ends saturate at 0 and 1 (lin's internal clamp)
    expect(parts[0]).toBe('0.0000');
    expect(parts[16]).toBe('1.0000');
  });

  it('[Boundary] t=1 → curva puramente quadrática (S-curve por partes)', () => {
    const parts = lqCurve(1).split(' ');
    for (let i = 0; i < 17; i++) {
      const x = i / 16;
      expect(parts[i]).toBe(refSample(1, x));
    }
    expect(parts[0]).toBe('0.0000');
    expect(parts[8]).toBe('0.5000'); // x=0.5 is where the S-curve's two branches meet
    expect(parts[16]).toBe('1.0000');
  });

  it('[Right] t=0.5 → mistura linear/quadrática ponto a ponto (verbatim da fórmula)', () => {
    const parts = lqCurve(0.5).split(' ');
    for (let i = 0; i < 17; i++) {
      const x = i / 16;
      expect(parts[i]).toBe(refSample(0.5, x));
    }
  });

  it('[Boundary] a curva é monotonicamente não-decrescente para t em [0,1] (é uma curva de tom válida)', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const vals = lqCurve(t).split(' ').map(Number);
      for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeGreaterThanOrEqual(vals[i - 1] - 1e-9);
    }
  });

  it('[Range] lqCurve does not clamp values outside [0,1] — setLq clamps, not lqCurve', () => {
    const under = lqCurve(-0.5).split(' ');
    const over = lqCurve(1.5).split(' ');
    for (let i = 0; i < 17; i++) {
      const x = i / 16;
      expect(under[i]).toBe(refSample(-0.5, x));
      expect(over[i]).toBe(refSample(1.5, x));
    }
  });
});

// lqName returns the i18n KEY (see the note in the module: the parameter is already called `t`). The assertions go
// through the pt dictionary — so they state what the label reads ("t=0 is off") and still catch an invented key, which
// would come out `undefined` here instead of showing raw on screen.
describe('lqName', () => {
  it('[Boundary] t=0 → desligado', () => {
    expect(pt[lqName(0)]).toBe('desligado');
  });
  it('[Boundary] t=1 → quadrático', () => {
    expect(pt[lqName(1)]).toBe('quadrático');
  });
  it('[Right] limiar 0.34: logo abaixo é linear, no limiar e logo acima é misto', () => {
    expect(pt[lqName(0.33)]).toBe('linear');
    expect(pt[lqName(0.339999)]).toBe('linear');
    expect(pt[lqName(0.34)]).toBe('misto');
    expect(pt[lqName(0.341)]).toBe('misto');
  });
  it('[Right] limiar 0.67: logo abaixo é misto, no limiar e logo acima é quadrático', () => {
    expect(pt[lqName(0.66)]).toBe('misto');
    expect(pt[lqName(0.669999)]).toBe('misto');
    expect(pt[lqName(0.67)]).toBe('quadrático');
    expect(pt[lqName(0.671)]).toBe('quadrático');
  });
  it('[Right] meio de cada faixa: 0.1 linear · 0.5 misto · 0.9 quadrático', () => {
    expect(pt[lqName(0.1)]).toBe('linear');
    expect(pt[lqName(0.5)]).toBe('misto');
    expect(pt[lqName(0.9)]).toBe('quadrático');
  });
  it('[Range] valores fora de [0,1] não são clampados — negativo cai em desligado, >1 cai em quadrático', () => {
    expect(pt[lqName(-1)]).toBe('desligado');
    expect(pt[lqName(-0.01)]).toBe('desligado');
    expect(pt[lqName(1.5)]).toBe('quadrático');
    expect(pt[lqName(100)]).toBe('quadrático');
  });
});
