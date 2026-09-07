// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/high-contrast (project node: sem canvas/DOM — WORLD_TEX/DIRECT/SPRITE que desenham em canvas
// ficam no .browser.test.js). Aqui: a lógica PURA (mapa tile→papel, os 3 níveis de contraste, a paleta HC_ROLE
// persistida) + a guarda de DI de initHighContrast + o desvio "normal" de worldTexFor/spriteTexFor (não toca
// canvas). ZOMBIES + Right-BICEP. Ver docs/2-Architecture/adr/ADR-0011-visual-accessibility.yaml.
import { describe, it, expect } from 'vitest';
import { roleOfFalso as roleOf } from './fixtures/cartucho-falso.js'; // a tabela tile→papel é do JOGO (ADR-0080); a engine a RECEBE, e o gate prova que a cor sai do PAPEL
import {
  DIRECT_CFG, dcfg, HC_ROLE_DEF, HC_ROLE, saveHcRole,
  initHighContrast, worldTexFor, spriteTexFor,
} from '../app/js/render/high-contrast.js';

describe('render/high-contrast — DI (initHighContrast ainda não chamado)', () => {
  it('[Error] worldTexFor/spriteTexFor lançam antes de initHighContrast', () => {
    expect(() => worldTexFor('normal')).toThrow(/initHighContrast/);
    // ⚠️ `'sprite-x'` e não `'coin'`: o gate `engine-boundary` reprova vocabulário de JOGO num fixture de
    // engine, e uma moeda é do platformer. O que este caso prova é que a função estoura ANTES de inicializar,
    // e para isso o nome do sprite é irrelevante — que é exatamente o argumento de o trocar.
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
    expect(HC_ROLE_DEF.hazard).not.toEqual([1, 2, 3]); // mutar HC_ROLE não vaza pro default
    HC_ROLE.hazard = HC_ROLE_DEF.hazard.slice(); // devolve o estado do módulo (singleton) limpo p/ os próximos testes
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
    // e um id que o jogo NÃO declarou devolve `undefined` em vez de lançar: um sprite ausente vira "sem
    // textura" no desenho, e derrubar o quadro inteiro por causa de um item seria pior.
    expect(spriteTexFor('nao-declarado', 'normal')).toBeUndefined();
  });
  it('[Boundary] "normal" nunca está em DIRECT_CFG (senão o desvio acima nem seria exercitado)', () => {
    expect(DIRECT_CFG['normal']).toBeUndefined();
  });
});
