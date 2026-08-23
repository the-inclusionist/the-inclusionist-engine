// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de render/textures — geradores de textura procedural (project BROWSER: usa canvas/PIXI reais).
// Padrões: ZOMBIES + Right-BICEP. A geometria pura (isPix/shapePoints/dados PIP_*) já é coberta em
// textures.node.test.js; aqui verificamos o que só existe com document/PIXI: as texturas em si, os caches
// (SHAPE_TEX/PUP_TEX) enchendo via initTextures, a injeção de disp/alto-contraste, e o bloco DEFERRED
// (indexedToCanvas/silhouetteCanvasIdx) + o achado TEX/PLAYER_* (buildLegacyPlayerTex) não quebrarem se chamados.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, render/textures).
import { describe, it, expect, beforeEach } from 'vitest';
import {
  initTextures, shapeTexture, letterTexture, pupTexFor, resetPupTexCache,
  SHAPE_TEX, PUP_TEX, indexedToCanvas, silhouetteCanvasIdx, buildLegacyPlayerTex,
  PIP_IDLE, PIP_WALK,
} from '../app/js/render/textures.js';

// Réplica mínima do ctx que game.js injeta: disp honra um letterCase mutável; directCfg/directSpriteCanvas
// simulam o alto-contraste-direto sem depender do resto do jogo.
let letterCase = 'lower';
const ctx = {
  disp: (s) => (letterCase === 'upper' ? String(s).toUpperCase() : String(s).toLowerCase()),
  directCfg: { 'hc-direto': { off: 55, mul: 0.5, bgMul: 0.30 } },
  // clona o canvas (em vez de devolver `src` intacto): PIXI.Texture.from cacheia por RESOURCE, então devolver o
  // mesmo canvas faria a textura "alto contraste" colidir com a normal no cache do Pixi — mascarando o teste.
  directSpriteCanvas: (src) => {
    const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
    cv.getContext('2d').drawImage(src, 0, 0);
    return cv;
  },
};
beforeEach(() => { letterCase = 'lower'; resetPupTexCache(); initTextures(ctx); });

describe('initTextures', () => {
  it('[Right] enche SHAPE_TEX (uma textura por forma de SOMASUB_SHAPES) e PUP_TEX (7 power-ups)', () => {
    expect(Object.keys(SHAPE_TEX).length).toBeGreaterThan(0);
    expect(SHAPE_TEX.circulo).toBeDefined();
    expect(Object.keys(PUP_TEX)).toEqual(['superjump', 'ultrajump', 'turbo', 'fly', 'wallcling', 'key', 'runcane']);
  });
});

describe('shapeTexture', () => {
  it('[Right] retorna uma PIXI.Texture 16×16 p/ cada forma conhecida (polígono e arco/elipse/retângulo)', () => {
    for (const id of ['circulo', 'oval', 'quadrado', 'retangulo', 'triangulo', 'losango', 'hexagono']) {
      const t = shapeTexture(id);
      expect(t.width).toBe(16);
      expect(t.height).toBe(16);
    }
  });
  it('[Error] id desconhecido cai no default (arco) em vez de lançar', () => {
    expect(() => shapeTexture('id-que-nao-existe')).not.toThrow();
  });
});

describe('letterTexture', () => {
  it('[Right] usa o `disp` injetado — minúscula por padrão', () => {
    letterCase = 'lower';
    const t = letterTexture('A');
    expect(t.width).toBe(16); expect(t.height).toBe(16);
  });
  it('[Interface] muda com letterCase (a mesma letra gera texturas distintas em maiúscula/minúscula)', () => {
    letterCase = 'lower'; const lo = letterTexture('a').baseTexture.resource.source.toDataURL();
    letterCase = 'upper'; const up = letterTexture('a').baseTexture.resource.source.toDataURL();
    expect(up).not.toBe(lo); // "a" x "A" pintam pixels diferentes no glifo
  });
});

describe('pupTexFor', () => {
  it('[Right] modo normal devolve a textura de PUP_TEX (sem alto contraste)', () => {
    expect(pupTexFor('key', 'normal')).toBe(PUP_TEX.key);
  });
  it('[Right] modo alto-contraste-direto usa a rota directCfg/directSpriteCanvas e cacheia por mode×kind', () => {
    const t1 = pupTexFor('key', 'hc-direto');
    const t2 = pupTexFor('key', 'hc-direto');
    expect(t1).toBe(t2); // cache hit — mesma instância
    expect(t1).not.toBe(PUP_TEX.key); // rota alto-contraste é uma textura DIFERENTE da normal
  });
  it('[Inverse] resetPupTexCache derruba o cache alto-contraste (próxima chamada reconstrói)', () => {
    const before = pupTexFor('key', 'hc-direto');
    resetPupTexCache();
    const after = pupTexFor('key', 'hc-direto');
    expect(after).not.toBe(before);
  });
});

describe('DEFERRED: indexedToCanvas / silhouetteCanvasIdx (PIP_* — trabalho estacionado, não morto)', () => {
  it('[Right] indexedToCanvas pinta um canvas 24×32 a partir de PIP_IDLE sem lançar', () => {
    const cv = indexedToCanvas(PIP_IDLE);
    expect(cv.width).toBe(24); expect(cv.height).toBe(32);
  });
  it('[Right] silhouetteCanvasIdx idem, para cada quadro de PIP_WALK', () => {
    for (const frame of PIP_WALK) {
      const cv = silhouetteCanvasIdx(frame);
      expect(cv.width).toBe(24); expect(cv.height).toBe(32);
    }
  });
});

describe('achado: buildLegacyPlayerTex (TEX/PLAYER_* — zero chamadores, preservado sob demanda)', () => {
  it('[Robustez] reproduz o TEX antigo (idle/walk/climb/hurt) sem lançar, se algum dia for chamada', () => {
    const t = buildLegacyPlayerTex();
    expect(Object.keys(t)).toEqual(['idle', 'walk', 'climb', 'hurt']);
    for (const k of Object.keys(t)) { expect(t[k].width).toBe(16); expect(t[k].height).toBe(32); }
  });
});
