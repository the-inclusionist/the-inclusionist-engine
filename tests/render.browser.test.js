// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de RENDER/DOM (project browser — Chromium/Playwright; PIXI global via vitest.setup.browser.js).
// Padrões: ZOMBIES + Right-BICEP (rótulos no nome). Ver docs/plano-testes.md. Módulos: canvas, props,
// sprites, sprite-fx, storage. Testes ESTRUTURAIS (dimensões/tipos) — não dependem dos PNGs de asset.
//
// O bloco de `props` SAIU no item 19, junto com o módulo: a arte da moeda, da árvore e dos poderes é do JOGO
// e foi para `game/props` — logo o teste dela foi para `tests/props.browser.test.js`. Não é organização: se
// ele tivesse ficado, este arquivo passaria a importar de `game/` e os OUTROS quatro módulos que ele cobre
// (canvas, sprite-fx, storage, dom) sumiriam da varredura de fixtures, que pula testes de jogo por desenho.
import { describe, it, expect } from 'vitest';
import * as CV from '../app/js/render/canvas.js';
import * as FX from '../app/js/render/sprite-fx.js';
import * as ST from '../app/js/platform/storage.js';
import * as DOM from '../app/js/ui/dom.js';

describe('ui/dom — atalhos de seleção', () => {
  it('[Right] $ delega ao querySelector; $$ devolve Array', () => {
    expect(DOM.$('body')).toBe(document.body);
    expect(Array.isArray(DOM.$$('div'))).toBe(true);
  });
});

describe('render/canvas — primitivas', () => {
  it('[Right] makeCanvas dimensiona o offscreen', () => {
    const c = CV.makeCanvas(7, 5);
    expect([c.width, c.height]).toEqual([7, 5]);
  });
  it('[Right] pixDisc pinta o pixel central opaco', () => {
    const c = CV.makeCanvas(9, 9), x = c.getContext('2d');
    CV.pixDisc(x, 4, 4, 3, '#ff0000');
    const p = x.getImageData(4, 4, 1, 1).data;
    expect([p[0], p[3]]).toEqual([255, 255]);
  });
  it('[Interface] tex usa SCALE_MODES.NEAREST (pixel art)', () => {
    expect(CV.tex(CV.makeCanvas(2, 2)).baseTexture.scaleMode).toBe(PIXI.SCALE_MODES.NEAREST);
  });
  it('[Boundary] pixDisc de raio pequeno não estoura', () => {
    const x = CV.makeCanvas(3, 3).getContext('2d');
    expect(() => CV.pixDisc(x, 1, 1, 0.5, '#0f0')).not.toThrow();
  });
});

describe('render/sprite-fx — ASCII + contorno', () => {
  it('[Right] spriteToCanvas devolve 16×32', () => {
    const c = FX.spriteToCanvas(['SS']);
    expect([c.width, c.height]).toEqual([16, 32]);
  });
  it('[Inverse-ish] outlineCanvas preserva a largura da fonte', () => {
    const s = FX.spriteToCanvas(['SS']);
    expect(FX.outlineCanvas(s, 1).width).toBe(s.width);
  });
});

describe('platform/storage — persistência segura', () => {
  it('[Right] set/get/remove roundtrip', () => {
    ST.set('__t_a', 'abc');
    expect(ST.get('__t_a')).toBe('abc');
    ST.remove('__t_a');
    expect(ST.get('__t_a', 'FB')).toBe('FB');
  });
  it('[One/Interface] bool e num', () => {
    ST.setBool('__t_b', true);
    expect(ST.getBool('__t_b')).toBe(true);
    ST.set('__t_n', '3.5');
    expect(ST.getNum('__t_n')).toBe(3.5);
    ST.remove('__t_b'); ST.remove('__t_n');
  });
  it('[Inverse] setJSON/getJSON', () => {
    const o = { a: 1, b: [2, 3] };
    ST.setJSON('__t_j', o);
    expect(ST.getJSON('__t_j')).toEqual(o);
    ST.remove('__t_j');
  });
  it('[Boundary] getNum de valor não-numérico → fallback', () => {
    ST.set('__t_x', 'abc');
    expect(ST.getNum('__t_x', 7)).toBe(7);
    ST.remove('__t_x');
  });
  it('[Error] getJSON de JSON corrompido → fallback (não lança)', () => {
    ST.set('__t_bad', '{nope');
    expect(ST.getJSON('__t_bad', null)).toBe(null);
    ST.remove('__t_bad');
  });
});
