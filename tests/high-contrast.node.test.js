// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of render/high-contrast (node project: no canvas/DOM — the WORLD_TEX/DIRECT/SPRITE paths that draw on a canvas
// live in the .browser.test.js). Here: the PURE logic (the 3 contrast levels, the persisted HC_ROLE palette) + the DI
// guard of initHighContrast + the "normal" bypass of worldTexFor/spriteTexFor (touches no canvas). ZOMBIES +
// Right-BICEP. See ADR-0011 (visual accessibility).
import { describe, it, expect } from 'vitest';
import { roleOfFalso as roleOf } from './fixtures/fake-cartridge.js'; // the tile→role table belongs to the GAME (ADR-0080); the engine RECEIVES it, and the gate proves the colour comes from the ROLE
import {
  DIRECT_CFG, dcfg, HC_ROLE_DEF, HC_ROLE, saveHcRole,
  initHighContrast, worldTexFor, spriteTexFor,
} from '../app/js/render/high-contrast.js';

describe('render/high-contrast — DI (initHighContrast ainda não chamado)', () => {
  it('[Error] worldTexFor/spriteTexFor lançam antes de initHighContrast', () => {
    expect(() => worldTexFor('normal')).toThrow(/initHighContrast/);
    // ⚠️ `'sprite-x'` and not `'coin'`: the `engine-boundary` gate fails GAME vocabulary in an engine fixture, and a
    // coin belongs to the platformer. What this case proves is that the function throws BEFORE initialisation, and for
    // that the sprite's name is irrelevant — which is exactly the argument for changing it.
    expect(() => spriteTexFor('sprite-x', 'normal')).toThrow(/initHighContrast/);
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
    expect(HC_ROLE_DEF.hazard).not.toEqual([1, 2, 3]); // mutating HC_ROLE does not leak into the default
    HC_ROLE.hazard = HC_ROLE_DEF.hazard.slice(); // hands the module's (singleton) state back clean for the next tests
  });
  it('[Error] saveHcRole() não lança mesmo sem localStorage disponível (store.ts engole a exceção)', () => {
    expect(() => saveHcRole()).not.toThrow();
  });
});

describe('render/high-contrast — worldTexFor/spriteTexFor (desvio "normal": não toca canvas)', () => {
  it('[Right] modo "normal" devolve a textura NORMAL injetada, sem passar por DIRECT_CFG/worldToTextureDirect', () => {
    const worldTexNormal = { tag: 'world-normal' }, texDeclarada = { tag: 'sprite-normal' };
    initHighContrast({
      W: 4, H: 4,
      outlineFg: () => 1, outlineBg: () => 1,
      getWorldCanvasNormal: () => { throw new Error('não deveria construir canvas em modo normal'); },
      getWorldTexNormal: () => worldTexNormal,
      sprites: () => ({}),
      sprites: () => ({ alvo: { canvas: null, tex: texDeclarada } }), roleOf,
    });
    expect(worldTexFor('normal')).toBe(worldTexNormal);
    expect(spriteTexFor('alvo', 'normal')).toBe(texDeclarada);
    // and an id the game did NOT declare returns `undefined` instead of throwing: a missing sprite is drawn as "no
    // texture", and bringing the whole frame down over one item would be worse.
    expect(spriteTexFor('nao-declarado', 'normal')).toBeUndefined();
  });
  it('[Boundary] "normal" nunca está em DIRECT_CFG (senão o desvio acima nem seria exercitado)', () => {
    expect(DIRECT_CFG['normal']).toBeUndefined();
  });
});
