// SPDX-License-Identifier: AGPL-3.0-or-later
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
  // As formas ENTRAM agora. Eram importadas de `game/activity-content` DENTRO do módulo — uma aresta da
  // engine para o jogo por causa de uma linha. O fixture usa as dez de verdade porque os casos abaixo contam
  // texturas; um conjunto inventado aqui os faria medir o fixture em vez do módulo.
  shapes: ['circulo', 'triangulo', 'quadrado', 'retangulo', 'losango',
    'paralelogramo', 'trapezio', 'pentagono', 'hexagono', 'oval'],
  // OS PODERES entram como (kind, canvas). Eram uma lista cravada no módulo mais um import de arte; no item
  // 19 a lista virou do jogo e a arte mudou de camada. O fixture desenha um canvas MÍNIMO por poder: o que
  // este módulo faz com ele é embrulhar em textura, e um retângulo de 12×12 exercita isso tão bem quanto o
  // ícone de verdade — e melhor, porque não amarra o teste ao desenho.
  powerups: ['superjump', 'ultrajump', 'turbo', 'fly', 'wallcling', 'key', 'runcane'].map((kind) => {
    const cv = document.createElement('canvas'); cv.width = 12; cv.height = 12;
    const c = cv.getContext('2d'); c.fillStyle = '#123456'; c.fillRect(0, 0, 12, 12);
    return { kind, canvas: cv };
  }),
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
  it('[Right] enche SHAPE_TEX com EXATAMENTE as formas injetadas, e PUP_TEX com os 7 power-ups', () => {
    // Este caso dizia `length > 0` e `SHAPE_TEX.circulo definido`. Verifiquei com uma mutação — trocar o
    // laço por `['circulo']`, ignorando o ctx inteiro — e os ONZE casos deste arquivo passaram. Um teste que
    // sobrevive à função construindo um décimo do que devia não estava medindo o que o título dizia.
    // Com as formas agora INJETADAS, isto é o que precisa ser verdade: a lista de fora é a lista de dentro.
    expect(Object.keys(SHAPE_TEX).sort()).toEqual([...ctx.shapes].sort());
    expect(Object.keys(PUP_TEX)).toEqual(ctx.powerups.map((p) => p.kind));
  });

  it('[Interface] injetar OUTROS poderes dá outro PUP_TEX — e o anterior NÃO fica de herança', () => {
    // O par do caso das formas, e pelo mesmo motivo: com a lista injetada, "encher" não pode significar
    // "acrescentar". Um segundo consumidor que inicializasse com os poderes dele herdaria os nossos por cima,
    // e o sintoma seria um ícone de bengala de corrida num jogo que não tem corrida.
    const cv = document.createElement('canvas'); cv.width = 12; cv.height = 12;
    initTextures({ ...ctx, powerups: [{ kind: 'planar', canvas: cv }] });
    expect(Object.keys(PUP_TEX)).toEqual(['planar']);
    initTextures(ctx); // devolve o estado que o beforeEach promete aos casos seguintes
  });

  it('[Interface] injetar OUTRA lista dá outro SHAPE_TEX — a fonte é o ctx, não uma tabela interna', () => {
    // O par do caso acima, e o que fecha a porta de vez: se alguém reintroduzir uma lista fixa no módulo, o
    // caso de cima continuaria passando (a fixa provavelmente seria a mesma dez), mas este reprova.
    initTextures({ ...ctx, shapes: ['triangulo', 'oval'] });
    expect(Object.keys(SHAPE_TEX).sort()).toEqual(['oval', 'triangulo']);
    initTextures(ctx); // devolve o estado que o beforeEach promete aos casos seguintes
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
