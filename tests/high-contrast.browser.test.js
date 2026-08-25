// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de render/high-contrast — Renderização Direta em canvas REAL (project browser: Chromium/Playwright).
// A lógica pura (dcfg/roleOf/HC_ROLE) já está no .node.test.js; aqui cobrimos o que exige getImageData/
// putImageData/drawImage de verdade: worldToTextureDirect (repintura por papel + contorno de 2º plano),
// directBgTexture (dessaturação assíncrona), directSprite{Canvas,Texture} (contorno de 1º plano) e o cache
// de worldTexFor/coinTexFor. ZOMBIES + Right-BICEP. Ver ADR-0011-visual-accessibility.yaml.
import { describe, it, expect, beforeAll } from 'vitest';
import { roleOf } from '../app/js/game/tile-roles.js'; // a tabela tile→papel é do JOGO; a engine a RECEBE
import { initCollision } from '../app/js/core/collision.js';
import { TILE } from '../app/js/core/constants.js';
import {
  dimDesat, worldToTextureDirect, directBgTexture, directSpriteCanvas, directSpriteTexture,
  worldTexFor, coinTexFor, clearWorldTexCache, clearCoinTexCache, initHighContrast, HC_ROLE,
} from '../app/js/render/high-contrast.js';

// Mundo de teste 4×3 (TILE=16): col0=pedra(2, estrutura) · col1=lava(9, hazard) · col2=escada(4, climb,
// caso especial) · col3=água(3, water); linha do meio replica a estrutura; linha de baixo é ar(0/1) — dá
// perímetro real ao redor da linha do meio p/ testar o contorno de 2º plano.
const W = 4, H = 3;
const WORLD = [
  [2, 9, 4, 3],
  [2, 2, 2, 2],
  [0, 1, 0, 1],
];
initCollision({
  world: WORLD, W, H,
  isWheelchair: () => false, isModoCego: () => false, caneDiv: () => 1,
  wcSolid: () => new Set(), gateTiles: () => new Set(), gateOpen: () => true,
});

function flatCanvas(w, h, css) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); c.fillStyle = css; c.fillRect(0, 0, w, h);
  return cv;
}
const canvasOf = (texture) => texture.baseTexture.resource.source; // real PIXI.Texture (tex() do canvas.js)
const pixelAt = (cv, x, y) => [...cv.getContext('2d').getImageData(x, y, 1, 1).data];
// srcTex "de mentira" (estrutural — ver DirectTexSource): baseTexture.valid=true → paint() roda SÍNCRONO.
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
    expect(pixelAt(cv, 0, 0)).toEqual([0, 0, 0, 0]); // continua transparente, não virou cinza-90
  });
});

describe('render/high-contrast — worldToTextureDirect (repintura por papel + contorno de 2º plano)', () => {
  beforeAll(() => {
    initHighContrast({
      W, H, outlineFg: () => 1, outlineBg: () => 1,
      getWorldCanvasNormal: () => flatCanvas(W * TILE, H * TILE, '#888888'),
      getWorldTexNormal: () => 'NORMAL_WORLD_TEX',
      coinCanvasNormal: flatCanvas(11, 11, '#ffd23f'),
      coinTexNormal: 'NORMAL_COIN_TEX', roleOf,
    });
  });

  it('[Interface] textura resultante tem as dimensões do canvas fonte (W*TILE × H*TILE)', () => {
    const cv = canvasOf(worldToTextureDirect(flatCanvas(W * TILE, H * TILE, '#888'), 'hc-direto'));
    expect(cv.width).toBe(W * TILE); expect(cv.height).toBe(H * TILE);
  });

  it('[Right] hazard(9) vira um vermelho/laranja com R dominante (HC_ROLE.hazard = [255,110,45])', () => {
    const cv = canvasOf(worldToTextureDirect(flatCanvas(W * TILE, H * TILE, '#888888'), 'hc-direto'));
    const [r, g, b] = pixelAt(cv, 1 * TILE + 8, 0 * TILE + 8); // centro do tile (col1,row0) = lava
    expect(r).toBeGreaterThan(b); expect(r).toBeGreaterThan(g);
    expect([r, g, b]).not.toEqual([r, r, r]); // não ficou cinza (dessaturado) — foi repintado
  });

  it('[Right] água(3) vira um azul com B dominante (HC_ROLE.water = [70,140,255])', () => {
    const cv = canvasOf(worldToTextureDirect(flatCanvas(W * TILE, H * TILE, '#888888'), 'hc-direto'));
    const [r, g, b] = pixelAt(cv, 3 * TILE + 8, 0 * TILE + 8); // (col3,row0) = água
    expect(b).toBeGreaterThan(r);
  });

  it('[Boundary] escada(4) é caso especial: quase-preto + trilho ciano na borda (não vira faixa sólida)', () => {
    const cv = canvasOf(worldToTextureDirect(flatCanvas(W * TILE, H * TILE, '#888888'), 'hc-direto'));
    const centro = pixelAt(cv, 2 * TILE + 8, 0 * TILE + 5); // vão entre degraus (ry=2 e ry=7 não cobrem a linha 5) = fundo #0a0e14
    expect(centro.slice(0, 3)).toEqual([0x0a, 0x0e, 0x14]);
    const trilho = pixelAt(cv, 2 * TILE + 1, 0 * TILE + 8); // trilho lateral (coluna cheia) = HC_ROLE.climb
    expect(trilho.slice(0, 3)).toEqual(HC_ROLE.climb);
  });

  it('[Inverse] estrutura (pedra=2) NÃO é repintada por papel — só dessaturada (R≈G; sem o vermelho/azul saturado dos papéis)', () => {
    const cv = canvasOf(worldToTextureDirect(flatCanvas(W * TILE, H * TILE, '#888888'), 'hc-direto'));
    const [r, g, b] = pixelAt(cv, 0 * TILE + 8, 0 * TILE + 8); // (col0,row0) = pedra
    expect(Math.abs(r - g)).toBeLessThanOrEqual(3); // dimDesat: R×mul vs G×mul×1.02 — quase iguais (não há matiz de papel)
    expect(b).toBeGreaterThan(r); // canal azul recebe o multiplicador extra (blue=1.22)
  });

  it('[Boundary] contorno de 2º plano só no PERÍMETRO externo (linha do meio faz fronteira com o ar de baixo)', () => {
    // rgba(200,222,255,0.97) compõe SOBRE o pixel já dessaturado (123,125,150 p/ hc-direto) — não é opaco puro;
    // 0.97*200+0.03*123≈198 / 0.97*222+0.03*125≈219 / 0.97*255+0.03*150≈252. Checa a composição, não um valor cravado.
    const cv = canvasOf(worldToTextureDirect(flatCanvas(W * TILE, H * TILE, '#888888'), 'hc-direto'));
    const bordaInferior = pixelAt(cv, 0 * TILE + 8, 1 * TILE + TILE - 1); // base do tile (col0,row1), vizinho de baixo é ar
    expect(bordaInferior[0]).toBeGreaterThan(190); // R salta de 123 (estrutura) p/ ~198 (contorno)
    expect(bordaInferior[2]).toBeGreaterThan(245); // B salta de 150 p/ ~252
    const meioDoBloco = pixelAt(cv, 0 * TILE + 8, 1 * TILE + 4); // interior do mesmo tile, longe de qualquer fronteira c/ ar
    expect(meioDoBloco[0]).toBeLessThan(190); // sem contorno: continua no tom dessaturado (R≈123)
  });

  it('[Zero] outlineBg=0 → sem contorno de 2º plano (a borda fica só com o tom dessaturado/repintado)', () => {
    initHighContrast({
      W, H, outlineFg: () => 1, outlineBg: () => 0,
      getWorldCanvasNormal: () => flatCanvas(W * TILE, H * TILE, '#888888'),
      getWorldTexNormal: () => 'NORMAL_WORLD_TEX',
      coinCanvasNormal: flatCanvas(11, 11, '#ffd23f'),
      coinTexNormal: 'NORMAL_COIN_TEX', roleOf,
    });
    const cv = canvasOf(worldToTextureDirect(flatCanvas(W * TILE, H * TILE, '#888888'), 'hc-direto'));
    const bordaInferior = pixelAt(cv, 0 * TILE + 8, 1 * TILE + TILE - 1);
    expect(bordaInferior.slice(0, 3)).not.toEqual([200, 222, 255]);
  });

  it('[Right] os 3 níveis de contraste (off crescente) produzem estruturas cada vez mais claras', () => {
    initHighContrast({
      W, H, outlineFg: () => 1, outlineBg: () => 1,
      getWorldCanvasNormal: () => flatCanvas(W * TILE, H * TILE, '#888888'),
      getWorldTexNormal: () => 'NORMAL_WORLD_TEX',
      coinCanvasNormal: flatCanvas(11, 11, '#ffd23f'),
      coinTexNormal: 'NORMAL_COIN_TEX', roleOf,
    });
    const lumaEstrutura = (mode) => {
      const cv = canvasOf(worldToTextureDirect(flatCanvas(W * TILE, H * TILE, '#888888'), mode));
      return pixelAt(cv, 0 * TILE + 8, 0 * TILE + 8)[0]; // R da pedra (col0,row0)
    };
    expect(lumaEstrutura('hc-direto-45')).toBeGreaterThan(lumaEstrutura('hc-direto'));
  });
});

describe('render/high-contrast — directBgTexture (fundo/decoração: só dessaturação, sem repintura por papel)', () => {
  it('[Right] pinta de forma síncrona quando baseTexture.valid=true (paint roda na hora)', () => {
    const src = flatCanvas(8, 8, 'rgb(200,200,200)');
    const dst = directBgTexture(fakeTex(src), 'hc-direto');
    const cv = canvasOf(dst);
    const [r] = pixelAt(cv, 0, 0);
    // directBgTexture chama dimDesat SEM `off` (só cfg.bgMul=0.30 p/ hc-direto) — o fundo não ganha o clareamento
    // do "off" que a estrutura do mundo recebe; só escurece/recua. g = 0 + 200*0.30 = 60.
    expect(r).toBe(200 * 0.30);
  });
  it('[Interface] não usa outlineFg/outlineBg (funciona mesmo sem initHighContrast novo — não lança)', () => {
    expect(() => directBgTexture(fakeTex(flatCanvas(4, 4, '#000')), 'hc-direto-7')).not.toThrow();
  });
});

describe('render/high-contrast — directSpriteCanvas/directSpriteTexture (1º plano: contorno escuro)', () => {
  it('[Zero] outlineFg=0 → devolve o MESMO canvas (sem contorno, sem cópia)', () => {
    initHighContrast({
      W, H, outlineFg: () => 0, outlineBg: () => 1,
      getWorldCanvasNormal: () => flatCanvas(W * TILE, H * TILE, '#888'),
      getWorldTexNormal: () => 'N', coinCanvasNormal: flatCanvas(11, 11, '#ffd23f'), coinTexNormal: 'N', roleOf,
    });
    const src = flatCanvas(11, 11, '#ffd23f');
    expect(directSpriteCanvas(src, 'hc-direto')).toBe(src);
  });
  it('[Right] outlineFg>0 → devolve um canvas NOVO (contornado), mesmas dimensões', () => {
    initHighContrast({
      W, H, outlineFg: () => 1, outlineBg: () => 1,
      getWorldCanvasNormal: () => flatCanvas(W * TILE, H * TILE, '#888'),
      getWorldTexNormal: () => 'N', coinCanvasNormal: flatCanvas(11, 11, '#ffd23f'), coinTexNormal: 'N', roleOf,
    });
    const src = flatCanvas(11, 11, '#ffd23f');
    const out = directSpriteCanvas(src, 'hc-direto');
    expect(out).not.toBe(src);
    expect(out.width).toBe(11); expect(out.height).toBe(11);
  });
  it('[Right] directSpriteTexture com outlineFg=0 devolve a MESMA srcTex (sem construir canvas novo)', () => {
    initHighContrast({
      W, H, outlineFg: () => 0, outlineBg: () => 1,
      getWorldCanvasNormal: () => flatCanvas(W * TILE, H * TILE, '#888'),
      getWorldTexNormal: () => 'N', coinCanvasNormal: flatCanvas(11, 11, '#ffd23f'), coinTexNormal: 'N', roleOf,
    });
    const srcTex = fakeTex(flatCanvas(11, 11, '#ffd23f'));
    expect(directSpriteTexture(srcTex, 'hc-direto')).toBe(srcTex);
  });
  it('[Right] directSpriteTexture com outlineFg>0 desenha o contorno numa textura nova', () => {
    initHighContrast({
      W, H, outlineFg: () => 2, outlineBg: () => 1,
      getWorldCanvasNormal: () => flatCanvas(W * TILE, H * TILE, '#888'),
      getWorldTexNormal: () => 'N', coinCanvasNormal: flatCanvas(11, 11, '#ffd23f'), coinTexNormal: 'N', roleOf,
    });
    const src = flatCanvas(11, 11, '#ffd23f');
    const dst = directSpriteTexture(fakeTex(src), 'hc-direto');
    expect(dst).not.toBe(src);
    const cv = canvasOf(dst);
    expect(cv.width).toBe(11); expect(cv.height).toBe(11);
  });
});

describe('render/high-contrast — worldTexFor/coinTexFor (cache preguiçoso por modo)', () => {
  beforeAll(() => {
    initHighContrast({
      W, H, outlineFg: () => 1, outlineBg: () => 1,
      getWorldCanvasNormal: () => flatCanvas(W * TILE, H * TILE, '#888'),
      getWorldTexNormal: () => 'NORMAL_WORLD_TEX',
      coinCanvasNormal: flatCanvas(11, 11, '#ffd23f'),
      coinTexNormal: 'NORMAL_COIN_TEX', roleOf,
    });
  });
  it('[Right] "normal" devolve a textura NORMAL injetada (identidade, sem tocar canvas)', () => {
    expect(worldTexFor('normal')).toBe('NORMAL_WORLD_TEX');
    expect(coinTexFor('normal')).toBe('NORMAL_COIN_TEX');
  });
  it('[Right] modo hc-* é CACHEADO: duas chamadas com o mesmo modo devolvem a MESMA textura', () => {
    const a = worldTexFor('hc-direto'), b = worldTexFor('hc-direto');
    expect(a).toBe(b);
    const ca = coinTexFor('hc-direto'), cb = coinTexFor('hc-direto');
    expect(ca).toBe(cb);
  });
  it('[Right] modos diferentes NÃO compartilham cache (7:1 ≠ 3:1)', () => {
    expect(worldTexFor('hc-direto')).not.toBe(worldTexFor('hc-direto-7'));
  });
  it('[Boundary] clearWorldTexCache/clearCoinTexCache força reconstrução (nova referência)', () => {
    const before = worldTexFor('hc-direto');
    clearWorldTexCache();
    const after = worldTexFor('hc-direto');
    expect(after).not.toBe(before);
    const coinBefore = coinTexFor('hc-direto');
    clearCoinTexCache();
    const coinAfter = coinTexFor('hc-direto');
    expect(coinAfter).not.toBe(coinBefore);
  });
});
