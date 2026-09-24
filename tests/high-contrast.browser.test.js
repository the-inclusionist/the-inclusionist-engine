// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of render/high-contrast — Direct Rendering on a REAL canvas (browser project: Chromium/Playwright).
// The pure logic (dcfg/HC_ROLE) is in the .node.test.js; here we cover what needs real getImageData/putImageData/
// drawImage: worldToTextureDirect (repaint by role + background outline), directBgTexture (asynchronous
// desaturation), directSprite{Canvas,Texture} (foreground outline) and the worldTexFor/spriteTexFor cache.
// ZOMBIES + Right-BICEP. See ADR-0011 (visual accessibility).
import { describe, it, expect, beforeAll } from 'vitest';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';
import { roleOfFalso as roleOf } from './fixtures/fake-cartridge.js'; // the tile→role table belongs to the GAME (ADR-0080); the engine RECEIVES it, and the gate proves the colour comes from the ROLE

import { TILE } from '../app/js/core/constants.js';
import {
  dimDesat, worldToTextureDirect, directBgTexture, directSpriteCanvas, directSpriteTexture,
  worldTexFor, spriteTexFor, clearWorldTexCache, clearSpriteTexCache, initHighContrast, HC_ROLE,
} from '../app/js/render/high-contrast.js';

// 4×3 test world (TILE=16): col0=stone(2, structure) · col1=lava(9, hazard) · col2=ladder(4, climb, special case) ·
// col3=water(3, water); the middle row repeats the structure; the bottom row is air(0/1) — giving a real perimeter
// around the middle row to test the background outline.
const W = 4, H = 3;
const WORLD = [
  [2, 9, 4, 3],
  [2, 2, 2, 2],
  [0, 1, 0, 1],
];
/*
 * 🔴 THE GRID BELONGS TO THE CASE, not to an engine module: high contrast RECEIVES the `tileAt` query through a port,
 * so what the case has to give is a two-line function.
 * 📌 Outside the grid it answers STONE (2): a natural wall, so the perimeter outline finds no air where the world ends.
 */
const tileAt = (tx, ty) => (tx < 0 || tx >= W || ty < 0 || ty >= H ? 2 : WORLD[ty][tx]);

function flatCanvas(w, h, css) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); c.fillStyle = css; c.fillRect(0, 0, w, h);
  return cv;
}
const canvasOf = (texture) => texture.baseTexture.resource.source; // real PIXI.Texture
const pixelAt = (cv, x, y) => [...cv.getContext('2d').getImageData(x, y, 1, 1).data];
// a fake srcTex (structural — see DirectTexSource): baseTexture.valid=true → paint() runs SYNCHRONOUSLY.
const fakeTex = (cv) => ({ orig: { width: cv.width, height: cv.height }, baseTexture: { valid: true, resource: { source: cv }, once: () => {} } });

describe('render/high-contrast — dimDesat (dessaturação/escurecimento)', () => {
  it('[Right] escurece proporcionalmente a mul; canal azul recebe o multiplicador extra', () => {
    const cv = flatCanvas(2, 2, 'rgb(200,200,200)'), c = cv.getContext('2d');
    dimDesat(c, 2, 2, 0.5, 1.2, 10); // g = 10 + 200*0.5 = 110
    const [r, g, b] = pixelAt(cv, 0, 0);
    expect(r).toBe(110);
    expect(g).toBe(Math.min(255, 110 * 1.02) | 0);
    expect(b).toBe(Math.min(255, 110 * 1.2) | 0);
  });
  it('[Boundary] satura em 255 mesmo com off/mul altos', () => {
    const cv = flatCanvas(1, 1, 'rgb(255,255,255)'), c = cv.getContext('2d');
    dimDesat(c, 1, 1, 2, 2, 200);
    expect(pixelAt(cv, 0, 0).slice(0, 3)).toEqual([255, 255, 255]);
  });
  it('[Zero] pixel totalmente transparente (alpha<8) não é tocado', () => {
    const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1;
    const c = cv.getContext('2d'); c.clearRect(0, 0, 1, 1); // alpha=0
    dimDesat(c, 1, 1, 0.5, 1.2, 90);
    expect(pixelAt(cv, 0, 0)).toEqual([0, 0, 0, 0]); // still transparent, did not become grey-90
  });
});

describe('render/high-contrast — worldToTextureDirect (repintura por papel + contorno de 2º plano)', () => {
  beforeAll(() => {
    initHighContrast({ store: createStorage(memoryBackend()),
      W, H, tileAt, outlineFg: () => 1, outlineBg: () => 1,
      getWorldCanvasNormal: () => flatCanvas(W * TILE, H * TILE, '#888888'),
      getWorldTexNormal: () => 'NORMAL_WORLD_TEX',
      sprites: () => ({ alvo: { canvas: flatCanvas(11, 11, '#ffd23f'), tex: 'TEX_NORMAL' } }), roleOf,
    });
  });

  it('[Interface] textura resultante tem as dimensões do canvas fonte (W*TILE × H*TILE)', () => {
    const cv = canvasOf(worldToTextureDirect(flatCanvas(W * TILE, H * TILE, '#888'), 'hc-direto'));
    expect(cv.width).toBe(W * TILE); expect(cv.height).toBe(H * TILE);
  });

  it('[Right] hazard(9) vira um vermelho/laranja com R dominante (HC_ROLE.hazard = [255,110,45])', () => {
    const cv = canvasOf(worldToTextureDirect(flatCanvas(W * TILE, H * TILE, '#888888'), 'hc-direto'));
    const [r, g, b] = pixelAt(cv, 1 * TILE + 8, 0 * TILE + 8); // centre of tile (col1,row0) = lava
    expect(r).toBeGreaterThan(b); expect(r).toBeGreaterThan(g);
    expect([r, g, b]).not.toEqual([r, r, r]); // not grey (desaturated) — it was repainted
  });

  it('[Right] água(3) vira um azul com B dominante (HC_ROLE.water = [70,140,255])', () => {
    const cv = canvasOf(worldToTextureDirect(flatCanvas(W * TILE, H * TILE, '#888888'), 'hc-direto'));
    const [r, g, b] = pixelAt(cv, 3 * TILE + 8, 0 * TILE + 8); // (col3,row0) = água
    expect(b).toBeGreaterThan(r);
  });

  it('[Boundary] escada(4) é caso especial: quase-preto + trilho ciano na borda (não vira faixa sólida)', () => {
    const cv = canvasOf(worldToTextureDirect(flatCanvas(W * TILE, H * TILE, '#888888'), 'hc-direto'));
    const centro = pixelAt(cv, 2 * TILE + 8, 0 * TILE + 5); // gap between rungs (ry=2 and ry=7 do not cover line 5) = background #0a0e14
    expect(centro.slice(0, 3)).toEqual([0x0a, 0x0e, 0x14]);
    // 🔴 the rail is read on line 5, a gap between rungs (the rungs cover lines 2–3, 7–8, 12–13), where only the rail paints
    // the role's colour. Read on line 8, a RUNG, the case saw the colour with no rail at all — measured by the 2026-09-23 probe.
    const trilho = pixelAt(cv, 2 * TILE + 1, 0 * TILE + 5);
    expect(trilho.slice(0, 3), 'no rail on the ladder').toEqual(HC_ROLE.climb);
    const degrau = pixelAt(cv, 2 * TILE + 8, 0 * TILE + 2);
    expect(degrau.slice(0, 3), 'no rung on the ladder').toEqual(HC_ROLE.climb);
  });

  it('[Right] um papel repinta pelo BRILHO de cada pixel (luma BT.601), e o perigo parte de mais claro (0,58) que os outros (0,44)', () => {
    // The luminance weights and the two floors are the rule: a hazard stays brighter than any other role at the same brightness.
    const cv = canvasOf(worldToTextureDirect(flatCanvas(W * TILE, H * TILE, '#888888'), 'hc-direto'));
    const base = pixelAt(cv, 0 * TILE + 8, 0 * TILE + 8); // the stone: the same base, dimmed and never repainted
    const g = (0.299 * base[0] + 0.587 * base[1] + 0.114 * base[2]) / 255;
    const paint = (rgb, lo) => rgb.map((v) => Math.min(255, v * (lo + (1 - lo) * g)) | 0);
    expect(pixelAt(cv, 1 * TILE + 8, 0 * TILE + 8).slice(0, 3), 'the hazard').toEqual(paint(HC_ROLE.hazard, 0.58));
    expect(pixelAt(cv, 3 * TILE + 8, 0 * TILE + 8).slice(0, 3), 'the water').toEqual(paint(HC_ROLE.water, 0.44));
  });

  it('[Inverse] estrutura (pedra=2) NÃO é repintada por papel — só dessaturada (R≈G; sem o vermelho/azul saturado dos papéis)', () => {
    const cv = canvasOf(worldToTextureDirect(flatCanvas(W * TILE, H * TILE, '#888888'), 'hc-direto'));
    const [r, g, b] = pixelAt(cv, 0 * TILE + 8, 0 * TILE + 8); // (col0,row0) = stone
    expect(Math.abs(r - g)).toBeLessThanOrEqual(3); // dimDesat: R×mul vs G×mul×1.02 — almost equal (no role hue)
    expect(b).toBeGreaterThan(r); // the blue channel gets the extra multiplier (blue=1.22)
  });

  it('[Boundary] contorno de 2º plano só no PERÍMETRO externo (linha do meio faz fronteira com o ar de baixo)', () => {
    // rgba(200,222,255,0.97) composites OVER the already desaturated pixel (123,125,150 for hc-direto) — not pure opaque;
    // 0.97*200+0.03*123≈198 / 0.97*222+0.03*125≈219 / 0.97*255+0.03*150≈252. Checks the composition, not a fixed value.
    const cv = canvasOf(worldToTextureDirect(flatCanvas(W * TILE, H * TILE, '#888888'), 'hc-direto'));
    const bordaInferior = pixelAt(cv, 0 * TILE + 8, 1 * TILE + TILE - 1); // bottom of tile (col0,row1), the neighbour below is air
    expect(bordaInferior[0]).toBeGreaterThan(190); // R jumps from 123 (structure) to ~198 (outline)
    expect(bordaInferior[2]).toBeGreaterThan(245); // B jumps from 150 to ~252
    const meioDoBloco = pixelAt(cv, 0 * TILE + 8, 1 * TILE + 4); // inside the same tile, far from any border with air
    expect(meioDoBloco[0]).toBeLessThan(190); // no outline: stays at the desaturated tone (R≈123)
  });

  it('[Zero] outlineBg=0 → sem contorno de 2º plano (a borda fica só com o tom dessaturado/repintado)', () => {
    initHighContrast({ store: createStorage(memoryBackend()),
      W, H, tileAt, outlineFg: () => 1, outlineBg: () => 0,
      getWorldCanvasNormal: () => flatCanvas(W * TILE, H * TILE, '#888888'),
      getWorldTexNormal: () => 'NORMAL_WORLD_TEX',
      sprites: () => ({ alvo: { canvas: flatCanvas(11, 11, '#ffd23f'), tex: 'TEX_NORMAL' } }), roleOf,
    });
    const cv = canvasOf(worldToTextureDirect(flatCanvas(W * TILE, H * TILE, '#888888'), 'hc-direto'));
    const bordaInferior = pixelAt(cv, 0 * TILE + 8, 1 * TILE + TILE - 1);
    // 🔴 a threshold, not `not.toEqual([200, 222, 255])`: the outline COMPOSITES at 97% (≈198, 219, 252), so that assertion
    // passed with or without an outline (the 2026-09-23 probe: turning off the outline guard stayed green). The threshold
    // is the one of the case above.
    expect(bordaInferior[0], 'the outline was drawn with a thickness of zero').toBeLessThan(190);
  });

  it('[Right] os 3 níveis de contraste (off crescente) produzem estruturas cada vez mais claras', () => {
    initHighContrast({ store: createStorage(memoryBackend()),
      W, H, tileAt, outlineFg: () => 1, outlineBg: () => 1,
      getWorldCanvasNormal: () => flatCanvas(W * TILE, H * TILE, '#888888'),
      getWorldTexNormal: () => 'NORMAL_WORLD_TEX',
      sprites: () => ({ alvo: { canvas: flatCanvas(11, 11, '#ffd23f'), tex: 'TEX_NORMAL' } }), roleOf,
    });
    const lumaEstrutura = (mode) => {
      const cv = canvasOf(worldToTextureDirect(flatCanvas(W * TILE, H * TILE, '#888888'), mode));
      return pixelAt(cv, 0 * TILE + 8, 0 * TILE + 8)[0]; // R da pedra (col0,row0)
    };
    expect(lumaEstrutura('hc-direto-45')).toBeGreaterThan(lumaEstrutura('hc-direto'));
  });
});

describe('render/high-contrast — the second-plane outline, on all four sides (probed 2026-09-23)', () => {
  /*
   * 🔴 Only the BOTTOM edge had a case: removing the top, left or right edge — or outlining the air itself — left every file green.
   * A block with air on all four sides: tile 1 on its left (the platformer's other air), tile 0 elsewhere.
   */
  const G = [
    [0, 0, 0],
    [1, 2, 0],
    [0, 0, 0],
  ];
  const at = (tx, ty) => (tx < 0 || tx >= 3 || ty < 0 || ty >= 3 ? 0 : G[ty][tx]);
  const outlined = (px) => px[0] > 190;
  let cv;
  beforeAll(() => {
    initHighContrast({ store: createStorage(memoryBackend()),
      W: 3, H: 3, tileAt: at, outlineFg: () => 1, outlineBg: () => 2,
      getWorldCanvasNormal: () => flatCanvas(3 * TILE, 3 * TILE, '#888888'),
      getWorldTexNormal: () => 'NORMAL_WORLD_TEX', sprites: () => ({}), roleOf,
    });
    cv = canvasOf(worldToTextureDirect(flatCanvas(3 * TILE, 3 * TILE, '#888888'), 'hc-direto'));
  });

  it('every side of a block that faces the air is outlined — tile 1 counts as air too', () => {
    const X = TILE, Y = TILE;
    expect(outlined(pixelAt(cv, X + 8, Y)), 'top').toBe(true);
    expect(outlined(pixelAt(cv, X + 8, Y + TILE - 1)), 'bottom').toBe(true);
    expect(outlined(pixelAt(cv, X, Y + 8)), 'left, facing tile 1').toBe(true);
    expect(outlined(pixelAt(cv, X + TILE - 1, Y + 8)), 'right').toBe(true);
    expect(outlined(pixelAt(cv, X + 8, Y + 8)), 'the inside').toBe(false);
  });

  it('the air itself is never outlined, even where it touches more air', () => {
    expect(outlined(pixelAt(cv, 0 * TILE + 8, 0 * TILE)), 'an air tile\'s edge').toBe(false);
  });
});
// ⚠️ Two decisions of the same probe are EQUIVALENT and have no case: a pixel with alpha under 8 is skipped by the repainting, and a
// canvas cannot keep a colour in a fully transparent pixel anyway — what is read back is [0, 0, 0, 0] either way; and the outline's
// `th > 0` guard, because an outline of thickness zero is a `fillRect` of zero height, which paints nothing.

describe('render/high-contrast — directBgTexture (fundo/decoração: só dessaturação, sem repintura por papel)', () => {
  it('[Right] pinta de forma síncrona quando baseTexture.valid=true (paint roda na hora)', () => {
    const src = flatCanvas(8, 8, 'rgb(200,200,200)');
    const dst = directBgTexture(fakeTex(src), 'hc-direto');
    const cv = canvasOf(dst);
    const [r] = pixelAt(cv, 0, 0);
    // directBgTexture calls dimDesat WITHOUT `off` (only cfg.bgMul=0.30 for hc-direto) — the background does not get the
    // "off" lightening the world's structure gets; it only darkens/recedes. Its grey is g = 0 + 200*0.30 = 60, and the RED
    // channel is the one that takes g unscaled (green is g*1.02, blue g*blue), which is why red is the channel read.
    expect(r).toBe(200 * 0.30);
  });
  it('[Interface] não usa outlineFg/outlineBg (funciona mesmo sem initHighContrast novo — não lança)', () => {
    expect(() => directBgTexture(fakeTex(flatCanvas(4, 4, '#000')), 'hc-direto-7')).not.toThrow();
  });
});

describe('render/high-contrast — directSpriteCanvas/directSpriteTexture (1º plano: contorno escuro)', () => {
  it('[Zero] outlineFg=0 → devolve o MESMO canvas (sem contorno, sem cópia)', () => {
    initHighContrast({ store: createStorage(memoryBackend()),
      W, H, outlineFg: () => 0, outlineBg: () => 1,
      getWorldCanvasNormal: () => flatCanvas(W * TILE, H * TILE, '#888'),
      getWorldTexNormal: () => 'N', sprites: () => ({ alvo: { canvas: flatCanvas(11, 11, '#ffd23f'), tex: 'N' } }), roleOf,
    });
    const src = flatCanvas(11, 11, '#ffd23f');
    expect(directSpriteCanvas(src, 'hc-direto')).toBe(src);
  });
  it('[Right] outlineFg>0 → devolve um canvas NOVO (contornado), mesmas dimensões', () => {
    initHighContrast({ store: createStorage(memoryBackend()),
      W, H, tileAt, outlineFg: () => 1, outlineBg: () => 1,
      getWorldCanvasNormal: () => flatCanvas(W * TILE, H * TILE, '#888'),
      getWorldTexNormal: () => 'N', sprites: () => ({ alvo: { canvas: flatCanvas(11, 11, '#ffd23f'), tex: 'N' } }), roleOf,
    });
    const src = flatCanvas(11, 11, '#ffd23f');
    const out = directSpriteCanvas(src, 'hc-direto');
    expect(out).not.toBe(src);
    expect(out.width).toBe(11); expect(out.height).toBe(11);
  });
  it('[Right] directSpriteTexture com outlineFg=0 devolve a MESMA srcTex (sem construir canvas novo)', () => {
    initHighContrast({ store: createStorage(memoryBackend()),
      W, H, outlineFg: () => 0, outlineBg: () => 1,
      getWorldCanvasNormal: () => flatCanvas(W * TILE, H * TILE, '#888'),
      getWorldTexNormal: () => 'N', sprites: () => ({ alvo: { canvas: flatCanvas(11, 11, '#ffd23f'), tex: 'N' } }), roleOf,
    });
    const srcTex = fakeTex(flatCanvas(11, 11, '#ffd23f'));
    expect(directSpriteTexture(srcTex, 'hc-direto')).toBe(srcTex);
  });
  it('[Right] directSpriteTexture com outlineFg>0 desenha o contorno numa textura nova', () => {
    initHighContrast({ store: createStorage(memoryBackend()),
      W, H, outlineFg: () => 2, outlineBg: () => 1,
      getWorldCanvasNormal: () => flatCanvas(W * TILE, H * TILE, '#888'),
      getWorldTexNormal: () => 'N', sprites: () => ({ alvo: { canvas: flatCanvas(11, 11, '#ffd23f'), tex: 'N' } }), roleOf,
    });
    const src = flatCanvas(11, 11, '#ffd23f');
    const dst = directSpriteTexture(fakeTex(src), 'hc-direto');
    expect(dst).not.toBe(src);
    const cv = canvasOf(dst);
    expect(cv.width).toBe(11); expect(cv.height).toBe(11);
  });
});

describe('render/high-contrast — worldTexFor/spriteTexFor (cache preguiçoso por modo)', () => {
  beforeAll(() => {
    initHighContrast({ store: createStorage(memoryBackend()),
      W, H, tileAt, outlineFg: () => 1, outlineBg: () => 1,
      getWorldCanvasNormal: () => flatCanvas(W * TILE, H * TILE, '#888'),
      getWorldTexNormal: () => 'NORMAL_WORLD_TEX',
      sprites: () => ({ alvo: { canvas: flatCanvas(11, 11, '#ffd23f'), tex: 'TEX_NORMAL' } }), roleOf,
    });
  });
  it('[Right] "normal" devolve a textura NORMAL injetada (identidade, sem tocar canvas)', () => {
    expect(worldTexFor('normal')).toBe('NORMAL_WORLD_TEX');
    expect(spriteTexFor('alvo', 'normal')).toBe('TEX_NORMAL');
  });
  it('[Right] modo hc-* é CACHEADO: duas chamadas com o mesmo modo devolvem a MESMA textura', () => {
    const a = worldTexFor('hc-direto'), b = worldTexFor('hc-direto');
    expect(a).toBe(b);
    const ca = spriteTexFor('alvo', 'hc-direto'), cb = spriteTexFor('alvo', 'hc-direto');
    expect(ca).toBe(cb);
  });
  it('[Right] modos diferentes NÃO compartilham cache (7:1 ≠ 3:1)', () => {
    expect(worldTexFor('hc-direto')).not.toBe(worldTexFor('hc-direto-7'));
  });
  it('[Boundary] clearWorldTexCache/clearSpriteTexCache força reconstrução (nova referência)', () => {
    const before = worldTexFor('hc-direto');
    clearWorldTexCache();
    const after = worldTexFor('hc-direto');
    expect(after).not.toBe(before);
    const coinBefore = spriteTexFor('alvo', 'hc-direto');
    clearSpriteTexCache();
    const coinAfter = spriteTexFor('alvo', 'hc-direto');
    expect(coinAfter).not.toBe(coinBefore);
  });
});
