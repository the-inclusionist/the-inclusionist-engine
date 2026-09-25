// SPDX-License-Identifier: AGPL-3.0-or-later
// RENDER/DOM tests (browser project — Chromium/Playwright; PIXI global via vitest.setup.browser.js).
// Patterns: ZOMBIES + Right-BICEP (labels in the name). See docs/3-Sprint-Design/plan-unit-tests-at-extraction.md. Modules: render/canvas,
// render/sprite-fx, platform/storage, ui/dom. STRUCTURAL tests (dimensions/types) — they do not depend on asset PNGs.
// The art of a game (coins, trees, power-ups) belongs to the game and is tested in its own repository.
import { describe, it, expect } from 'vitest';
import * as CV from '../app/js/render/canvas.js';
import * as FX from '../app/js/render/sprite-fx.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';

// the storage API over a backend of this file's own (ADR-0232): no key written here reaches another file
const ST = createStorage(memoryBackend());
import * as DOM from '../app/js/ui/dom.js';

describe('ui/dom — atalhos de seleção', () => {
  it('[Right] $ delega ao querySelector; $$ devolve Array', () => {
    expect(DOM.$('body')).toBe(document.body);
    expect(Array.isArray(DOM.$$('div'))).toBe(true);
  });
});

describe('render/canvas — primitivas', () => {
  it('[Right] makeCanvas dimensiona o offscreen', () => {
    const c = CV.makeCanvas(document, 7, 5);
    expect([c.width, c.height]).toEqual([7, 5]);
  });
  it('[Right] pixDisc pinta o pixel central opaco', () => {
    const c = CV.makeCanvas(document, 9, 9), x = c.getContext('2d');
    CV.pixDisc(x, 4, 4, 3, '#ff0000');
    const p = x.getImageData(4, 4, 1, 1).data;
    expect([p[0], p[3]]).toEqual([255, 255]);
  });
  it('[Interface] tex usa SCALE_MODES.NEAREST (pixel art)', () => {
    expect(CV.tex(CV.makeCanvas(document, 2, 2)).baseTexture.scaleMode).toBe(PIXI.SCALE_MODES.NEAREST);
  });
  it('[Boundary] pixDisc de raio pequeno não estoura', () => {
    const x = CV.makeCanvas(document, 3, 3).getContext('2d');
    expect(() => CV.pixDisc(x, 1, 1, 0.5, '#0f0')).not.toThrow();
  });
  it('🔴 [Right] the canvas is made in the document it is HANDED, never the global one (ADR-0232 D4)', () => {
    // A root serving another document (a second root, a test) must get its canvases there: a canvas made in the page's
    // global document would belong to the wrong one.
    const other = document.implementation.createHTMLDocument('other');
    expect(CV.makeCanvas(other, 2, 2).ownerDocument, 'makeCanvas').toBe(other);
    expect(CV.pixelCanvas(other, 2, 2, (px) => px(0, 0, 1, 1, '#f00')).ownerDocument, 'pixelCanvas').toBe(other);
    expect(CV.pixelTexture(other, 2, 2, () => {}).baseTexture.resource.source.ownerDocument, 'pixelTexture').toBe(other);
  });
});

describe('render/sprite-fx — ASCII + contorno', () => {
  it('[Right] spriteToCanvas devolve 16×32', () => {
    const c = FX.spriteToCanvas(document, ['SS']);
    expect([c.width, c.height]).toEqual([16, 32]);
  });
  it('[Inverse-ish] outlineCanvas preserva a largura da fonte', () => {
    const s = FX.spriteToCanvas(document, ['SS']);
    expect(FX.outlineCanvas(s, 1).width).toBe(s.width);
  });
  it('🔴 [Right] the art is painted in the document handed over, and the outline in its SOURCE canvas\'s document (ADR-0232 D4)', () => {
    const other = document.implementation.createHTMLDocument('other');
    const s = FX.spriteToCanvas(other, ['SS']);
    expect(s.ownerDocument, 'spriteToCanvas').toBe(other);
    expect(FX.outlineCanvas(s, 1).ownerDocument, 'outlineCanvas').toBe(other);
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
