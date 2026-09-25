// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of render/high-contrast (node project: no canvas/DOM — the WORLD_TEX/DIRECT/SPRITE paths that draw on a canvas
// live in the .browser.test.js). Here: the PURE logic (the 3 contrast levels, the persisted role palette) + the "normal"
// bypass of worldTexFor/spriteTexFor (touches no canvas), each on an instance `createHighContrast` builds (ADR-0232 D4:
// the palette and the caches are per world, never module state). ZOMBIES + Right-BICEP. See ADR-0011.
import { describe, it, expect } from 'vitest';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';
import { roleOfFalso as roleOf } from './fixtures/fake-cartridge.js'; // the tile→role table belongs to the GAME (ADR-0080); the engine RECEIVES it, and the gate proves the colour comes from the ROLE
import { DIRECT_CFG, dcfg, HC_ROLE_DEF, createHighContrast } from '../app/js/render/high-contrast.js';

/** A world's high contrast over `store`; the document is never touched on these paths, so a stub stands for it. */
const hcOver = (store, over = {}) => createHighContrast({
  doc: { createElement: () => { throw new Error('no canvas on the node paths'); } },
  store, W: 1, H: 1, outlineFg: () => 0, outlineBg: () => 0,
  getWorldCanvasNormal: () => null, getWorldTexNormal: () => null, sprites: () => ({}), roleOf, ...over,
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

describe('render/high-contrast — role palette / HC_ROLE_DEF (paleta do color-blocking)', () => {
  it('[Right] HC_ROLE_DEF tem os 4 papéis (hazard/climb/water/gate) com RGB 0..255', () => {
    for (const k of ['hazard', 'climb', 'water', 'gate']) {
      const rgb = HC_ROLE_DEF[k];
      expect(rgb).toHaveLength(3);
      for (const n of rgb) { expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(255); }
    }
  });
  it('[Right] sem cor guardada, `role` nasce igual a HC_ROLE_DEF — mas é uma cópia independente', () => {
    const hc = hcOver(createStorage(memoryBackend()));
    expect(hc.role).toEqual(HC_ROLE_DEF);
    expect(hc.role).not.toBe(HC_ROLE_DEF);
    hc.role.hazard = [1, 2, 3];
    expect(HC_ROLE_DEF.hazard, 'mutating a palette leaked into the default').not.toEqual([1, 2, 3]);
  });
  it('🔴 [Right] createHighContrast READS the child\'s colours from the store it receives, and saveRole keeps them there (ADR-0232)', () => {
    const backend = memoryBackend([['incl_hcrole', JSON.stringify({ hazard: [10, 20, 300], water: [1, 2] })]]);
    const hc = hcOver(createStorage(backend));
    expect(hc.role.hazard, 'the stored colour did not come back, or came back unclamped').toEqual([10, 20, 255]);
    expect(hc.role.water, 'a malformed entry must keep its default').toEqual(HC_ROLE_DEF.water);
    hc.role.gate = [7, 7, 7];
    hc.saveRole();
    expect(JSON.parse(backend.getItem('incl_hcrole')).gate, 'the change was not kept in the injected store').toEqual([7, 7, 7]);
  });
  it('🔴 [Right] TWO worlds share no palette (ADR-0232 D4, ADR-0142): a colour one child changes stays in its own world', () => {
    // The palette was a module-level object: a second world on the page read and wrote the first one's colours.
    const a = hcOver(createStorage(memoryBackend()));
    const b = hcOver(createStorage(memoryBackend()));
    a.role.hazard = [9, 9, 9];
    expect(b.role.hazard, 'the second world sees the first world\'s colour').toEqual(HC_ROLE_DEF.hazard);
  });
});

describe('render/high-contrast — worldTexFor/spriteTexFor (desvio "normal": não toca canvas)', () => {
  it('[Right] modo "normal" devolve a textura NORMAL injetada, sem passar por DIRECT_CFG/worldToTextureDirect', () => {
    const worldTexNormal = { tag: 'world-normal' }, texDeclarada = { tag: 'sprite-normal' };
    const hc = hcOver(createStorage(memoryBackend()), {
      W: 4, H: 4,
      outlineFg: () => 1, outlineBg: () => 1,
      getWorldCanvasNormal: () => { throw new Error('não deveria construir canvas em modo normal'); },
      getWorldTexNormal: () => worldTexNormal,
      sprites: () => ({ alvo: { canvas: null, tex: texDeclarada } }),
    });
    expect(hc.worldTexFor('normal')).toBe(worldTexNormal);
    expect(hc.spriteTexFor('alvo', 'normal')).toBe(texDeclarada);
    // and an id the game did NOT declare returns `undefined` instead of throwing: a missing sprite is drawn as "no
    // texture", and bringing the whole frame down over one item would be worse.
    expect(hc.spriteTexFor('nao-declarado', 'normal')).toBeUndefined();
  });
  it('[Boundary] "normal" nunca está em DIRECT_CFG (senão o desvio acima nem seria exercitado)', () => {
    expect(DIRECT_CFG['normal']).toBeUndefined();
  });
});
