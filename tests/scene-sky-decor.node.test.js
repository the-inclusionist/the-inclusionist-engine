// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/scene-sky.createSceneSky (project NODE: camadas Graphics/Sprite falsas injetadas). Contratos: seed de
// 7 nuvens no boot; stepSky move nuvens e faz wrap em WORLD_PX_W+50; rm.decor limpa pássaros; stepV3Decor SEMPRE limpa as
// 5 camadas e sai cedo em tema não-v3 / alto-contraste. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (#43).
import { describe, it, expect } from 'vitest';
import { createSceneSky } from '../app/js/render/scene-sky.js';

function fakeGfx() { const rec = { clears: 0, fills: 0, rects: [] };
  const g = { clear: () => { rec.clears++; rec.rects.length = 0; }, beginFill: () => { rec.fills++; return g; },
    drawRect: (x, y, w, h) => { rec.rects.push([x, y, w, h]); return g; }, endFill: () => g };
  g._rec = rec; return g; }
function fakeLayer() { const rec = { added: 0, removed: 0 }; return { _rec: rec, addChild: () => { rec.added++; }, removeChild: () => { rec.removed++; } }; }

function setup(over = {}) {
  const skyLayer = fakeLayer();
  const layers = { starsG: fakeGfx(), skyDecoG: fakeGfx(), nuvemG: fakeGfx(), fogG: fakeGfx(), grassG: fakeGfx(), themeFxG: fakeGfx(), themeFxBackG: fakeGfx() };
  class Sprite { constructor(tex) { this.texture = tex; this.x = 0; this.y = 0; this.alpha = 1; this.scale = { x: 1 }; this._v = 0; this._destroyed = false; } destroy() { this._destroyed = true; } }
  const ctx = {
    skyLayer, ...layers, CLOUD_TEX: [{}, {}], BIRD_TEX: [{}, {}], SpriteCtor: Sprite,
    hexN: (s) => parseInt(String(s).slice(1), 16), rnd: () => 0.9, randInt: () => 0,
    WORLD_PX_W: 100, WORLD_PX_H: 100, WORLD_W: 10, WORLD_H: 10, TILE: 16, LOGICAL_W: 320, LOGICAL_H: 180, BOX: { h: 24 },
    CENARIOS: over.CENARIOS || { campo: { v3: true, decor: ['sparkles', 'nuvens'], cloud: ['#ffffff', '#dddddd'] }, cidade: { v3: false, decor: [] } },
    THEME_FLORA: {}, DIRECT_CFG: over.DIRECT_CFG || {},
    solidAt: () => false, tileAt: () => 0,
    getCenario: () => over.cenario || 'campo', getVizMode: () => over.vizMode || 'normal',
    getPlayers: () => over.players || [], getFxClock: () => over.t || 0, getRm: () => over.rm || {},
    getAglomeracao: () => over.junta || 0,
  };
  return { sky: createSceneSky(ctx), skyLayer, layers };
}

describe('render/scene-sky · createSceneSky', () => {
  it('[Boot] semeia 7 nuvens no skyLayer', () => {
    const { sky, skyLayer } = setup();
    expect(skyLayer._rec.added).toBe(7);
    expect(sky.getClouds().length).toBe(7);
  });

  it('[Interface] stepSky move as nuvens por _v·dt', () => {
    const { sky } = setup();
    const c = sky.getClouds()[0]; c.x = 10; c._v = 0.02;
    sky.stepSky(100); // +2
    expect(c.x).toBeCloseTo(12);
  });

  it('[Boundary] stepSky faz wrap da nuvem em WORLD_PX_W+50 → -50', () => {
    const { sky } = setup();
    const c = sky.getClouds()[0]; c.x = 145; c._v = 0.1; // WORLD_PX_W=100 → limiar 150
    sky.stepSky(100); // +10 → 155 > 150 → wrap
    expect(c.x).toBe(-50);
  });

  it('[Zero] stepSky com rm.decor limpa os pássaros e sai', () => {
    const { sky } = setup({ rm: { decor: true } });
    sky.stepSky(1); // rm.decor → sem pássaros criados
    expect(sky.getBirds().length).toBe(0);
  });

  it('[Interface] stepV3Decor SEMPRE limpa as 6 camadas (inclui themeFxBackG)', () => {
    const { sky, layers } = setup({ cenario: 'cidade' }); // tema não-v3
    sky.stepV3Decor();
    for (const g of Object.values(layers)) expect(g._rec.clears).toBe(1);
  });

  it('[Gate] tema não-v3 sai após limpar (sem desenhar estrelas)', () => {
    const { sky, layers } = setup({ cenario: 'cidade' });
    sky.stepV3Decor();
    expect(layers.starsG._rec.fills).toBe(0);
  });

  it('[Gate] alto contraste (DIRECT_CFG[viz]) sai após limpar', () => {
    const { sky, layers } = setup({ vizMode: 'hc-direto', DIRECT_CFG: { 'hc-direto': {} } });
    sky.stepV3Decor();
    expect(layers.starsG._rec.fills).toBe(0);
  });

  it('[Happy] tema v3 com sparkles desenha estrelas no starsG', () => {
    const { sky, layers } = setup({ cenario: 'campo', t: 0 });
    sky.stepV3Decor();
    expect(layers.starsG._rec.fills).toBeGreaterThan(0);
  });
});

/* ===================== os dois caminhos das nuvens de tela ===================== */
//
// A Floresta ganhou uma MANTA de cúmulos que fecha e abre com a chuva; os outros três temas seguem com as 3
// lajes da v3, VERBATIM. Os dois caminhos existem porque o pedido do Dev era sobre a Floresta, e mudar a
// aparência dos outros três de carona seria alargar o pedido por conta própria. Estes casos guardam a linha.

const TEMA_MANTA = { campo: { decor: ['nuvens'], cloud: ['#ffffff', '#e9a06a'], nuvens: 27 } };
const TEMA_LAJE = { campo: { decor: ['nuvens'], cloud: ['#ffffff', '#dddddd'] } };

describe('nuvens de tela: manta (tema com `nuvens`) vs. as 3 lajes da v3', () => {
  it('[Interface] tema SEM `nuvens` desenha exatamente 3 lajes, como sempre desenhou', () => {
    const { sky, layers } = setup({ CENARIOS: TEMA_LAJE });
    sky.stepV3Decor();
    expect(layers.skyDecoG._rec.fills).toBe(6); // 3 nuvens × (corpo + sombra)
  });

  it('[Interface] tema COM `nuvens: 27` desenha as 27, e consulta a aglomeração para saber como', () => {
    // Se `getAglomeracao` sumir do ctx do game.js, este caso reprova com TypeError em vez de o jogo abrir com
    // um céu quebrado — que foi como a ligação quase passou despercebida.
    const { sky, layers } = setup({ CENARIOS: TEMA_MANTA, junta: 1 });
    expect(() => sky.stepV3Decor()).not.toThrow();
    expect(layers.nuvemG._rec.fills).toBe(54); // 27 nuvens × (corpo + sombra)
  });

  it('[Interface] a manta vai para a camada PRÓPRIA, e não para a das nuvens dos outros temas', () => {
    // A ordem-z é o pedido: a manta fica na frente do céu (é assim que ela esconde o sol) e ATRÁS das bandas
    // de morro (é assim que as árvores do fundo passam na frente dela). `skyDecoG`, onde moram os pássaros,
    // está à FRENTE dos morros — desenhar a manta lá poria nuvem na frente de árvore.
    const { sky, layers } = setup({ CENARIOS: TEMA_MANTA, junta: 1 });
    sky.stepV3Decor();
    expect(layers.nuvemG._rec.rects.length).toBeGreaterThan(0);
    expect(layers.skyDecoG._rec.rects).toEqual([]);
  });

  it('[Boundary] a camada da manta é limpa a cada quadro, mesmo em tema que não a usa', () => {
    // Trocar da Floresta para o Campo sem limpar deixaria a última manta congelada no céu do Campo. A limpeza
    // vem ANTES de qualquer decisão de tema, e é por isso que este caso usa o tema que não desenha nada lá.
    const { sky, layers } = setup({ CENARIOS: TEMA_LAJE });
    sky.stepV3Decor();
    expect(layers.nuvemG._rec.clears).toBe(1);
    expect(layers.nuvemG._rec.rects).toEqual([]);
  });

  it('[Boundary] com movimento reduzido a manta NÃO fecha, mesmo no meio da chuva', () => {
    // Um céu que fecha e abre é movimento de fundo em larga escala — exatamente o gatilho vestibular que a
    // opção existe para eliminar. Fechada, a manta tem nuvens visivelmente maiores; aqui elas não podem estar.
    const larguraMaxima = (over) => { const { sky, layers } = setup(over); sky.stepV3Decor();
      return Math.max(...layers.nuvemG._rec.rects.map((r) => r[2])); };
    const fechada = larguraMaxima({ CENARIOS: TEMA_MANTA, junta: 1 });
    const reduzida = larguraMaxima({ CENARIOS: TEMA_MANTA, junta: 1, rm: { decor: true } });
    expect(reduzida).toBeLessThan(fechada);
  });
});
