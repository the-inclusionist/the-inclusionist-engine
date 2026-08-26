// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/screen-pipeline — a TOPOLOGIA do render: quantas telas, onde, e o que cada uma ganha.
// ZOMBIES + Right-BICEP. project NODE: PIXI é FALSIFICADO por interface estrutural (mesmo precedente de
// viewports.node/traffic.node), porque aqui não há um pixel para conferir — há uma GRADE e um CICLO DE VIDA.
//
// O que este arquivo existe para pegar:
//  · a grade tem de vir de core/screens.ts. A conta que vivia dentro do configureRender era a QUINTA cópia
//    e era a divergente. Se alguém a reescrever à mão aqui, os números abaixo mudam.
//  · o descarte. `configureRender` roda toda vez que o nº de jogadores muda; se ele não destruir as
//    render-textures anteriores, o vazamento é de VRAM e não aparece em teste nenhum de render.
//  · a terceira tela CENTRALIZADA. É a única irregularidade da grade e a mais fácil de perder num refator.
import { describe, it, expect } from 'vitest';
import { planScreens, initScreenPipeline, FRAME_COLOR, FRAME_ALPHA, FRAME_WIDTH, DOT_INSET_X, DOT_INSET_Y } from '../app/js/render/screen-pipeline.js';
import { screenGrid } from '../app/js/core/screens.js';

const W = 320, H = 180; // o pixel canônico (ADR-0010)

/* ===================== 1. planScreens — a parte PURA ===================== */

describe('planScreens — tela única', () => {
  it('[Right] 1 jogador: single, canvas 320x180, NENHUM viewport', () => {
    const p = planScreens(1);
    expect(p.single).toBe(true);
    expect(p.canvas).toEqual({ w: W, h: H });
    expect(p.viewports).toEqual([]);
    expect(p).toMatchObject({ cols: 1, rows: 1 });
  });
  it('[Zero] 0 e negativo caem na grade de UMA tela (a guarda de core/screens), nunca em 0 colunas', () => {
    for (const n of [0, -3]) {
      const p = planScreens(n);
      expect(p.single).toBe(true);
      expect(p.cols).toBe(1);
      expect(p.canvas).toEqual({ w: W, h: H }); // e não NaN, que é o que 0 colunas daria
    }
  });
});

describe('planScreens — multi-tela', () => {
  it('[Right] 2 jogadores: 2x1, canvas 640x180, lado a lado', () => {
    const p = planScreens(2);
    expect(p).toMatchObject({ single: false, cols: 2, rows: 1 });
    expect(p.canvas).toEqual({ w: 640, h: 180 });
    expect(p.viewports.map(v => [v.x, v.y])).toEqual([[0, 0], [320, 0]]);
  });

  it('[Right] 4 jogadores: 2x2, canvas 640x360, na ordem de leitura', () => {
    const p = planScreens(4);
    expect(p).toMatchObject({ single: false, cols: 2, rows: 2 });
    expect(p.canvas).toEqual({ w: 640, h: 360 });
    expect(p.viewports.map(v => [v.x, v.y])).toEqual([[0, 0], [320, 0], [0, 180], [320, 180]]);
  });

  it('[Boundary] 3 jogadores: a TERCEIRA é centralizada na linha de baixo (a única irregularidade da grade)', () => {
    const p = planScreens(3);
    expect(p.canvas).toEqual({ w: 640, h: 360 }); // o canvas continua 2x2, com meia linha vazia
    expect(p.viewports.map(v => [v.x, v.y])).toEqual([[0, 0], [320, 0], [160, 180]]);
    // e a 3ª fica EXATAMENTE no meio: sobra igual dos dois lados
    const t = p.viewports[2];
    expect(t.x).toBe((640 - 320) / 2);
    expect(640 - (t.x + 320)).toBe(t.x);
  });

  it('[CrossCheck] cols/rows são os de core/screens.ts, não uma cópia local', () => {
    for (const n of [1, 2, 3, 4, 7]) {
      const p = planScreens(n), g = screenGrid(n);
      expect({ cols: p.cols, rows: p.rows }).toEqual(g);
    }
  });

  it('[Right] o canvas é sempre cols x rows telas — nem uma tela a mais', () => {
    for (const n of [2, 3, 4]) {
      const p = planScreens(n);
      expect(p.canvas.w).toBe(W * p.cols);
      expect(p.canvas.h).toBe(H * p.rows);
    }
  });
});

describe('planScreens — moldura e bolinha', () => {
  it('[Right] a moldura é meio pixel para dentro e 1px menor nos dois lados (linha de 1px que não borra)', () => {
    const p = planScreens(2);
    expect(p.viewports[0].frame).toEqual({ x: 0.5, y: 0.5, w: 319, h: 179 });
    expect(p.viewports[1].frame).toEqual({ x: 320.5, y: 0.5, w: 319, h: 179 });
  });
  it('[Right] a bolinha ancora no canto superior DIREITO de cada tela, para dentro', () => {
    const p = planScreens(4);
    expect(p.viewports[0].dot).toEqual({ x: W - DOT_INSET_X, y: DOT_INSET_Y });
    expect(p.viewports[3].dot).toEqual({ x: 320 + W - DOT_INSET_X, y: 180 + DOT_INSET_Y });
  });
  it('[Boundary] moldura e bolinha acompanham a tela CENTRALIZADA da 3ª, não a coluna da grade', () => {
    const t = planScreens(3).viewports[2];
    expect(t.frame.x).toBe(160.5);
    expect(t.dot.x).toBe(160 + W - DOT_INSET_X);
  });
  it('[Interface] w/h parametrizáveis: a conta é a mesma com números pequenos', () => {
    const p = planScreens(2, 10, 6);
    expect(p.canvas).toEqual({ w: 20, h: 6 });
    expect(p.viewports.map(v => v.x)).toEqual([0, 10]);
    expect(p.viewports[1].frame).toEqual({ x: 10.5, y: 0.5, w: 9, h: 5 });
  });
});

/* ===================== 2. configureRender — o ciclo de vida ===================== */

// PIXI de mentira: só os campos que o módulo toca, e um LOG de tudo que foi destruído/anexado.
function mkHarness(numPlayers) {
  const log = { destroyed: [], added: [], removedFromParent: 0, resizes: [], minimap: [], hud: 0, filters: 0, dots: 0 };
  let id = 0;
  const RenderTexture = { create: ({ width, height }) => ({ kind: 'rt', id: id++, width, height, baseTexture: { scaleMode: null }, destroy(base) { log.destroyed.push(['rt', this.id, base]); } }) };
  class SpriteCtor { constructor(texture) { this.kind = 'spr'; this.id = id++; this.texture = texture; this.x = 0; this.y = 0; this.visible = true; } destroy() { log.destroyed.push(['spr', this.id]); } }
  class GraphicsCtor {
    constructor() { this.kind = 'gfx'; this.id = id++; this.x = 0; this.y = 0; this.visible = true; this.strokes = []; this.rects = []; }
    lineStyle(w, c, a) { this.strokes.push([w, c, a]); }
    drawRect(x, y, w, h) { this.rects.push([x, y, w, h]); }
    destroy() { log.destroyed.push(['gfx', this.id]); }
  }
  const stage = {
    kind: 'stage',
    addChild(c) { log.added.push(['end', c]); return c; },
    addChildAt(c, i) { log.added.push(['at' + i, c]); return c; },
    removeChild(c) { return c; },
  };
  const camera = { kind: 'camera', parent: stage };
  let vpTex = [], vpSpr = [], vpFrames = null, vpDots = [];
  const api = initScreenPipeline({
    // Construtores viraram FÁBRICAS (Fase D): a porta pede o verbo, não a classe. Ver `render/port`.
    RenderTexture, NEAREST: 0,
    criarSprite: (t) => new SpriteCtor(t), criarDesenho: () => new GraphicsCtor(),
    stage, renderer: { resize: (w, h) => log.resizes.push([w, h]) }, camera,
    getNumPlayers: () => numPlayers,
    getVpTex: () => vpTex, setVpTex: (a) => { vpTex = a; },
    getVpSpr: () => vpSpr, setVpSpr: (a) => { vpSpr = a; },
    getVpFrames: () => vpFrames, setVpFrames: (g) => { vpFrames = g; },
    getVpDots: () => vpDots, setVpDots: (a) => { vpDots = a; },
    setMinimapVisible: (on) => log.minimap.push(on),
    buildGameHud: () => { log.hud++; },
    applyVpFilters: () => { log.filters++; },
    updateVpDots: () => { log.dots++; },
  });
  return {
    log, api, stage, camera,
    setN: (n) => { numPlayers = n; },
    get vpTex() { return vpTex; }, get vpSpr() { return vpSpr; },
    get vpFrames() { return vpFrames; }, get vpDots() { return vpDots; },
  };
}

describe('configureRender — tela única', () => {
  it('[Right] a câmera volta para o FUNDO do stage, o minimapa reaparece e o canvas volta a 320x180', () => {
    const h = mkHarness(1);
    h.camera.parent = null; // veio do caminho multi-tela, onde a câmera fica órfã
    h.api.configureRender();
    expect(h.log.added).toEqual([['at0', h.camera]]); // addChildAt(camera, 0) — atrás de tudo
    expect(h.log.minimap).toEqual([true]);
    expect(h.log.resizes).toEqual([[320, 180]]);
    expect(h.log.hud).toBe(1);
  });

  it('[Right] câmera JÁ filha do stage não é re-anexada (re-anexar a jogaria para o topo do z-order)', () => {
    const h = mkHarness(1);
    h.api.configureRender();
    expect(h.log.added).toEqual([]);
  });

  it('[CrossCheck] tela única NÃO cria viewport nem chama os re-aplicadores de multi-tela', () => {
    const h = mkHarness(1);
    h.api.configureRender();
    expect([h.vpTex.length, h.vpSpr.length, h.vpDots.length, h.vpFrames]).toEqual([0, 0, 0, null]);
    expect(h.log.filters).toBe(0);
    expect(h.log.dots).toBe(0);
  });
});

describe('configureRender — multi-tela', () => {
  it('[Right] 2 telas: a câmera SAI da cena, o minimapa some e o canvas dobra', () => {
    const h = mkHarness(2);
    h.api.configureRender();
    expect(h.log.minimap).toEqual([false]);
    expect(h.log.resizes).toEqual([[640, 180]]);
    expect(h.log.added.some(([, c]) => c === h.camera)).toBe(false); // a câmera NÃO entra no stage
  });

  it('[Right] uma render-texture 320x180 NEAREST por jogador, e um sprite posicionado por render-texture', () => {
    const h = mkHarness(3);
    h.api.configureRender();
    expect(h.vpTex).toHaveLength(3);
    for (const rt of h.vpTex) {
      expect([rt.width, rt.height]).toEqual([320, 180]);
      expect(rt.baseTexture.scaleMode).toBe(0); // NEAREST: pixel art não interpola
    }
    expect(h.vpSpr.map(s => [s.x, s.y])).toEqual([[0, 0], [320, 0], [160, 180]]);
    expect(h.vpSpr.map(s => s.texture)).toEqual(h.vpTex); // cada sprite mostra a SUA render-texture
  });

  it('[Right] a moldura é UM Graphics com uma linha e um retângulo por tela', () => {
    const h = mkHarness(4);
    h.api.configureRender();
    expect(h.vpFrames.strokes).toEqual(Array(4).fill([FRAME_WIDTH, FRAME_COLOR, FRAME_ALPHA]));
    expect(h.vpFrames.rects).toEqual([
      [0.5, 0.5, 319, 179], [320.5, 0.5, 319, 179], [0.5, 180.5, 319, 179], [320.5, 180.5, 319, 179],
    ]);
  });

  it('[Right] as bolinhas nascem INVISÍVEIS, no canto de cada tela, e por último no stage (acima de tudo)', () => {
    const h = mkHarness(2);
    h.api.configureRender();
    expect(h.vpDots.map(g => [g.x, g.y, g.visible])).toEqual([[311, 9, false], [631, 9, false]]);
    const ordem = h.log.added.map(([, c]) => c);
    expect(ordem.slice(-2)).toEqual(h.vpDots);          // depois das molduras
    expect(ordem.indexOf(h.vpFrames)).toBeGreaterThan(ordem.indexOf(h.vpSpr[1])); // e depois dos sprites
  });

  it('[Right] multi-tela reaplica HUD, filtros de a11y e bolinhas — nessa ordem, uma vez cada', () => {
    const h = mkHarness(2);
    h.api.configureRender();
    expect([h.log.hud, h.log.filters, h.log.dots]).toEqual([1, 1, 1]);
  });
});

describe('configureRender — descarte (o vazamento que nenhum teste de render pegaria)', () => {
  it('[Right] remontar destrói TUDO da configuração anterior, e a render-texture leva a base junto', () => {
    const h = mkHarness(2);
    h.api.configureRender();
    const antigos = { tex: [...h.vpTex], spr: [...h.vpSpr], frames: h.vpFrames, dots: [...h.vpDots] };
    h.log.destroyed.length = 0;

    h.setN(4); h.api.configureRender();
    for (const t of antigos.tex) expect(h.log.destroyed).toContainEqual(['rt', t.id, true]); // true = base junto
    for (const s of antigos.spr) expect(h.log.destroyed).toContainEqual(['spr', s.id]);
    expect(h.log.destroyed).toContainEqual(['gfx', antigos.frames.id]);
    for (const g of antigos.dots) expect(h.log.destroyed).toContainEqual(['gfx', g.id]);
    expect(h.vpTex).toHaveLength(4); // e o conjunto novo já está de pé
  });

  it('[Right] voltar de 4 telas para 1 também destrói tudo (o caminho que mais esquece)', () => {
    const h = mkHarness(4);
    h.api.configureRender();
    const ids = [...h.vpTex, ...h.vpSpr, ...h.vpDots, h.vpFrames].map(o => o.id);
    h.log.destroyed.length = 0;

    h.setN(1); h.api.configureRender();
    expect(h.log.destroyed.map(([, i]) => i).sort((a, b) => a - b)).toEqual(ids.sort((a, b) => a - b));
    expect([h.vpTex, h.vpSpr, h.vpDots, h.vpFrames]).toEqual([[], [], [], null]);
  });

  it('[Zero] o primeiro configureRender, com tudo vazio, não estoura', () => {
    const h = mkHarness(1);
    expect(() => h.api.configureRender()).not.toThrow();
    expect(h.log.destroyed).toEqual([]);
  });

  it('[Idempotent] chamar duas vezes no MESMO nº de telas devolve um conjunto novo e descarta o velho', () => {
    const h = mkHarness(2);
    h.api.configureRender();
    const primeiro = [...h.vpTex];
    h.api.configureRender();
    expect(h.vpTex).toHaveLength(2);
    expect(h.vpTex[0]).not.toBe(primeiro[0]);
    for (const t of primeiro) expect(h.log.destroyed).toContainEqual(['rt', t.id, true]);
  });
});
