// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/fx — juice (partículas/shake/hit-stop/squash) (project node). ZOMBIES + Right-BICEP.
// Fórmulas verbatim do game.js. O estado do módulo é singleton → drenamos no beforeEach p/ isolar.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, render/fx).
import { describe, it, expect, beforeEach } from 'vitest';
import {
  spawnParticle, getParticles, addShake, shakeAmp, addHitstop, tickHitstop, getHitstopT,
  setSquash, stepFx,
} from '../app/js/render/fx.js';

// Zera hit-stop + shake + partículas para um baseline limpo (estado do módulo persiste entre testes).
function drain() {
  while (tickHitstop(9999)) { /* drena o hit-stop */ }
  stepFx(1e6); // shakeT→0 e envelhece/expulsa as partículas
  getParticles().length = 0;
}
beforeEach(drain);

describe('spawnParticle', () => {
  it('empurra uma partícula com max=life e g padrão 0', () => {
    spawnParticle(10, 20, 1, -2, 30, 0xff0000, 2);
    const p = getParticles().at(-1);
    expect(p).toMatchObject({ x: 10, y: 20, vx: 1, vy: -2, life: 30, max: 30, color: 0xff0000, size: 2, g: 0 });
  });
  it('Boundary: satura em 160 (descarta a mais antiga)', () => {
    for (let i = 0; i < 165; i++) spawnParticle(i, 0, 0, 0, 5, 0, 1);
    expect(getParticles().length).toBe(160);
    expect(getParticles()[0].x).toBe(5); // as 5 primeiras (0..4) foram descartadas
  });
});

describe('hit-stop', () => {
  it('addHitstop guarda o máximo; tickHitstop decai e diz se ainda congelado', () => {
    addHitstop(4);
    addHitstop(2); // menor → mantém 4 (Math.max)
    expect(getHitstopT()).toBe(4);
    expect(tickHitstop(1)).toBe(true); // 4→3, ainda congelado
    expect(getHitstopT()).toBe(3);
    expect(tickHitstop(9)).toBe(true); // 3→0 (clamp), esse tick ainda congela
    expect(tickHitstop(1)).toBe(false); // já em 0 → descongelado
  });
});

describe('shake', () => {
  it('shakeAmp decai linearmente com o tempo restante', () => {
    addShake(6, 10); // mag 6, dur 10
    expect(shakeAmp()).toBeCloseTo(6); // t=10/10
    stepFx(5); // shakeT 10→5
    expect(shakeAmp()).toBeCloseTo(3); // 6*(5/10)
    stepFx(5); // →0
    expect(shakeAmp()).toBe(0);
  });
  it('addShake guarda a maior magnitude', () => {
    addShake(3, 10);
    addShake(8, 10);
    expect(shakeAmp()).toBeCloseTo(8);
  });
});

describe('setSquash', () => {
  it('clampa o squash em [-0.28, 0.2] e arma sqT=8', () => {
    const a = { sq: 0, sqT: 0 };
    setSquash(a, 0.5);
    expect(a.sq).toBe(0.2);
    expect(a.sqT).toBe(8);
    const b = { sq: 0, sqT: 0 };
    setSquash(b, -0.5);
    expect(b.sq).toBe(-0.28);
  });
  it('respeita rmWalk (movimento reduzido do personagem): não deforma', () => {
    const pl = { rmWalk: true, sq: 0, sqT: 0 };
    setSquash(pl, 0.2);
    expect(pl.sqT).toBe(0); // inalterado
  });
});

describe('stepFx (física da partícula)', () => {
  it('aplica gravidade+velocidade e remove ao expirar', () => {
    spawnParticle(0, 0, 2, 0, 10, 0, 1, 0.5); // g=0.5
    stepFx(2); // life 10→8; vy += 0.5*2=1; x += 2*2=4; y += vy(1)*2=2
    const p = getParticles().at(-1);
    expect(p.x).toBeCloseTo(4);
    expect(p.vy).toBeCloseTo(1);
    expect(p.life).toBe(8);
    stepFx(100); // expira → removida
    expect(getParticles().length).toBe(0);
  });
});
