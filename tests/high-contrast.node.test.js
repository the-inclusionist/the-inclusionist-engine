// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de render/high-contrast (project node: sem canvas/DOM — WORLD_TEX/DIRECT/SPRITE que desenham em canvas
// ficam no .browser.test.js). Aqui: a lógica PURA (mapa tile→papel, os 3 níveis de contraste, a paleta HC_ROLE
// persistida) + a guarda de DI de initHighContrast + o desvio "normal" de worldTexFor/coinTexFor (não toca
// canvas). ZOMBIES + Right-BICEP. Ver docs/2-Architecture/adr/ADR-0011-visual-accessibility.yaml.
import { describe, it, expect } from 'vitest';
import {
  DIRECT_CFG, dcfg, roleOf, HC_ROLE_DEF, HC_ROLE, saveHcRole,
  initHighContrast, worldTexFor, coinTexFor,
} from '../app/js/render/high-contrast.js';

describe('render/high-contrast — DI (initHighContrast ainda não chamado)', () => {
  it('[Error] worldTexFor/coinTexFor lançam antes de initHighContrast', () => {
    expect(() => worldTexFor('normal')).toThrow(/initHighContrast/);
    expect(() => coinTexFor('normal')).toThrow(/initHighContrast/);
  });
});

describe('render/high-contrast — dcfg (3 níveis de contraste)', () => {
  it('[Right] hc-direto/hc-direto-45/hc-direto-7 têm off/mul/bgMul próprios', () => {
    expect(dcfg('hc-direto')).toEqual({ off: 55, mul: 0.5, bgMul: 0.30 });
    expect(dcfg('hc-direto-45')).toEqual({ off: 66, mul: 0.5, bgMul: 0.28 });
    expect(dcfg('hc-direto-7')).toEqual({ off: 100, mul: 0.48, bgMul: 0.13 });
  });
  it('[Boundary] mais off + mais escuro em bgMul a cada nível (contraste crescente 3:1→4,5:1→7:1)', () => {
    const a = dcfg('hc-direto'), b = dcfg('hc-direto-45'), c = dcfg('hc-direto-7');
    expect(b.off).toBeGreaterThan(a.off);
    expect(c.off).toBeGreaterThan(b.off);
    expect(c.bgMul).toBeLessThan(b.bgMul);
    expect(b.bgMul).toBeLessThan(a.bgMul);
  });
  it('[Error] modo desconhecido (normal, filtro, string vazia) cai no default hc-direto', () => {
    expect(dcfg('normal')).toBe(DIRECT_CFG['hc-direto']);
    expect(dcfg('sim-deuter')).toBe(DIRECT_CFG['hc-direto']);
    expect(dcfg('')).toBe(DIRECT_CFG['hc-direto']);
  });
});

describe('render/high-contrast — roleOf (tile → papel semântico)', () => {
  it('[Right] lava(9)=hazard · escada(4)/trampolim(5)=climb · água(3)=water', () => {
    expect(roleOf(9)).toBe('hazard');
    expect(roleOf(4)).toBe('climb');
    expect(roleOf(5)).toBe('climb');
    expect(roleOf(3)).toBe('water');
  });
  it('[Boundary] portão (10) também mapeia climb — branch verbatim do original (na prática nunca chega aqui: o boot remove o tile 10 do grid)', () => {
    expect(roleOf(10)).toBe('climb');
  });
  it('[Inverse] estrutura/ar (0,1,2,6) não tem papel → null (fica no cinza-azulado dessaturado)', () => {
    for (const t of [0, 1, 2, 6]) expect(roleOf(t)).toBeNull();
  });
});

describe('render/high-contrast — HC_ROLE / HC_ROLE_DEF (paleta do color-blocking)', () => {
  it('[Right] HC_ROLE_DEF tem os 4 papéis (hazard/climb/water/gate) com RGB 0..255', () => {
    for (const k of ['hazard', 'climb', 'water', 'gate']) {
      const rgb = HC_ROLE_DEF[k];
      expect(rgb).toHaveLength(3);
      for (const n of rgb) { expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(255); }
    }
  });
  it('[Right] sem override persistido (Node não tem localStorage), HC_ROLE nasce igual a HC_ROLE_DEF — mas é uma cópia independente', () => {
    expect(HC_ROLE).toEqual(HC_ROLE_DEF);
    expect(HC_ROLE).not.toBe(HC_ROLE_DEF);
    HC_ROLE.hazard = [1, 2, 3];
    expect(HC_ROLE_DEF.hazard).not.toEqual([1, 2, 3]); // mutar HC_ROLE não vaza pro default
    HC_ROLE.hazard = HC_ROLE_DEF.hazard.slice(); // devolve o estado do módulo (singleton) limpo p/ os próximos testes
  });
  it('[Error] saveHcRole() não lança mesmo sem localStorage disponível (store.ts engole a exceção)', () => {
    expect(() => saveHcRole()).not.toThrow();
  });
});

describe('render/high-contrast — worldTexFor/coinTexFor (desvio "normal": não toca canvas)', () => {
  it('[Right] modo "normal" devolve a textura NORMAL injetada, sem passar por DIRECT_CFG/worldToTextureDirect', () => {
    const worldTexNormal = { tag: 'world-normal' }, coinTexNormal = { tag: 'coin-normal' };
    initHighContrast({
      W: 4, H: 4,
      outlineFg: () => 1, outlineBg: () => 1,
      getWorldCanvasNormal: () => { throw new Error('não deveria construir canvas em modo normal'); },
      getWorldTexNormal: () => worldTexNormal,
      coinCanvasNormal: /** @type {any} */ (null),
      coinTexNormal,
    });
    expect(worldTexFor('normal')).toBe(worldTexNormal);
    expect(coinTexFor('normal')).toBe(coinTexNormal);
  });
  it('[Boundary] "normal" nunca está em DIRECT_CFG (senão o desvio acima nem seria exercitado)', () => {
    expect(DIRECT_CFG['normal']).toBeUndefined();
  });
});
