// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de render/viz-setters no DOM/canvas REAIS (project browser: Chromium/Playwright). O .node.test.js
// cobre a lógica pura e as cascas com PIXI/DOM falsos; aqui ficam as duas coisas que o falso não pode provar:
//  (a) o desvio 'hcnew' (Renderização Direta) — worldTexFor precisa de getImageData/putImageData de verdade;
//  (b) a fiação DOM de renderVizGroup/updateVizIndicator/body.classList contra o DOM de verdade (o innerHTML
//      + querySelectorAll do original, incluindo o querySelectorAll das abas que NÃO acha nada — ver relatório).
// ZOMBIES + Right-BICEP. Ver ADR-0011-visual-accessibility.yaml.
import { describe, it, expect, beforeEach } from 'vitest';
import { roleOf } from '../app/js/game/tile-roles.js'; // a tabela tile→papel e do JOGO; a engine a RECEBE

// lqT é lido no IMPORT de render/lq-filter → zerar antes do import dinâmico, senão um resíduo de 'incl_lq'
// entraria compondo o filtro CSS e as asserções de string exata ficariam dependentes de outro teste.
localStorage.clear();

const { TILE } = await import('../app/js/core/constants.js');
const { initCollision } = await import('../app/js/core/collision.js');
const { VIZ_BY_KEY } = await import('../app/js/render/viz-modes.js');
const HC = await import('../app/js/render/high-contrast.js');
const { initVizSetters } = await import('../app/js/render/viz-setters.js');

// Mundo 4×3 com um papel semântico por coluna (mesma fixture do high-contrast.browser.test).
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
const worldCanvasNormal = flatCanvas(W * TILE, H * TILE, 'rgb(120,120,140)');
const coinCanvasNormal = flatCanvas(8, 8, 'rgb(240,200,60)');
const TEX_WORLD_NORMAL = { NORMAL: 'world' };
const TEX_COIN_NORMAL = { NORMAL: 'coin' };
HC.initHighContrast({ roleOf,
  W, H, outlineFg: () => 1, outlineBg: () => 1,
  getWorldCanvasNormal: () => worldCanvasNormal, getWorldTexNormal: () => TEX_WORLD_NORMAL,
  sprites: () => ({ coin: { canvas: coinCanvasNormal, tex: TEX_COIN_NORMAL } }),
});

/* ===================== palco real: os elementos que o módulo procura por seletor ===================== */

let host;
function stage() {
  if (host) host.remove();
  host = document.createElement('div');
  host.innerHTML = '<div id="viz-overlay" hidden></div><div id="viz-indicator" hidden></div>'
    + '<div id="viz-list"></div><div id="viz-tabs"><button data-vp="1">J2</button></div>';
  document.body.appendChild(host);
}

function setup(over = {}) {
  stage();
  const players = over.players || [{ viz: 'normal', sprite: null, _tx: null }];
  const env = {
    players, numPlayers: over.numPlayers === undefined ? players.length : over.numPlayers,
    sharedViz: null, sel: over.sel === undefined ? 0 : over.sel,
    app: { view: { style: { filter: '' } } },
    camera: { filters: 'INTOCADO' },
    worldSprite: { texture: null },
    parallaxLayers: [{ texture: null }],
    decoSprites: [{ texture: null }],
    vpSpr: over.vpSpr || [], vpDots: [],
    log: { frontDim: [], say: [], hideTouch: [] },
  };
  const ctx = {
    $: (sel) => document.querySelector(sel),
    body: document.body,
    srSay: (s) => env.log.say.push(s),
    app: env.app, camera: env.camera, worldSprite: env.worldSprite,
    parallaxLayers: env.parallaxLayers, decoSprites: env.decoSprites,
    getVpSpr: () => env.vpSpr, getVpDots: () => env.vpDots,
    getItemSprites: () => [], itemTexId: 'alvo', getPowerups: () => [],
    getPlayers: () => env.players, getNumPlayers: () => env.numPlayers,
    getSelVizPlayer: () => env.sel, setSelVizPlayer: (i) => { env.sel = i; },
    getSharedViz: () => env.sharedViz, setSharedViz: (m) => { env.sharedViz = m; },
    invalidateSharedViz: () => { env.sharedViz = null; },
    parallaxTexFor: (i, mode) => 'PX:' + i + ':' + mode,
    treeTexFor: (mode) => 'TREE:' + mode,
    playerVizTex: (base, mode) => 'PLAYER:' + base + ':' + mode,
    pixiFilterFor: (mode) => ['FILTER:' + mode],
    clearPlayerDirectCache: () => {},
    setFrontDim: (on) => env.log.frontDim.push(on),
    rebuildExtras: () => {}, rebuildCoins: () => {},
    setModoCego: () => {}, hideTouchControls: (r) => env.log.hideTouch.push(r),
    reflectVizButtons: () => {}, renderVisualPanel: () => {}, renderEmpathyPanel: () => {},
  };
  return { env, api: initVizSetters(ctx) };
}

beforeEach(() => { document.body.className = ''; HC.clearWorldTexCache(); HC.clearSpriteTexCache(); });

/* ===================================================================================================== */

describe('applyVizGlobal — desvio hcnew (Renderização Direta, canvas real)', () => {
  it('[Right] alto contraste escurece a frente e põe o filtro GPU na câmera', () => {
    const { env, api } = setup();
    api.applyVizGlobal('hc-direto');
    expect(env.log.frontDim).toEqual([true]);
    expect(env.camera.filters).toEqual(['FILTER:hc-direto']);
  });
  it('[Right] a textura do mundo vira a REPINTADA (não a normal) e é cacheada por modo', () => {
    const { env, api } = setup();
    api.applyVizGlobal('hc-direto');
    const t1 = env.worldSprite.texture;
    expect(t1).not.toBe(TEX_WORLD_NORMAL);
    expect(t1.baseTexture.resource.source.width).toBe(W * TILE); // canvas real repintado
    api.applyVizGlobal('hc-direto');
    expect(env.worldSprite.texture).toBe(t1); // mesma instância → cache do high-contrast valendo
  });
  it('[Many] os TRÊS níveis produzem texturas distintas entre si', () => {
    const { env, api } = setup();
    const texs = ['hc-direto', 'hc-direto-45', 'hc-direto-7'].map((m) => { api.applyVizGlobal(m); return env.worldSprite.texture; });
    expect(new Set(texs).size).toBe(3);
  });
  it('[Inverse] voltar a normal devolve a textura normal e tira o filtro da câmera', () => {
    const { env, api } = setup();
    api.applyVizGlobal('hc-direto-7');
    api.applyVizGlobal('normal');
    expect(env.worldSprite.texture).toBe(TEX_WORLD_NORMAL);
    expect(env.camera.filters).toBeNull();
    expect(env.log.frontDim).toEqual([true, false]);
  });
  it('[Zero] alto contraste NÃO acende a bolinha indicadora (ela é só de empatia: cegueira/baixa visão)', () => {
    const { api } = setup();
    api.applyVizGlobal('hc-direto');
    expect(document.querySelector('#viz-indicator').hidden).toBe(true);
  });
});

describe('applyVizGlobal — DOM real (body, overlay, bolinha)', () => {
  it('[Right] baixa visão marca o body e mostra o overlay com a classe da variante', () => {
    const { api } = setup();
    api.applyVizGlobal('lv-macular');
    expect(document.body.classList.contains('lowvision-mode')).toBe(true);
    const ov = document.querySelector('#viz-overlay');
    expect(ov.hidden).toBe(false);
    expect(ov.className).toBe('lv-macular');
  });
  it('[Right] cegueira: body marcado, filtro CSS na canvas e controles de toque ocultos', () => {
    const { env, api } = setup();
    api.applyVizGlobal('blind');
    expect(document.body.classList.contains('blind-mode')).toBe(true);
    expect(env.app.view.style.filter).toBe('brightness(0)');
    expect(env.log.hideTouch).toEqual(['cegueira']);
  });
  it('[Inverse] as duas classes de empatia nunca coexistem no body', () => {
    const { api } = setup();
    api.applyVizGlobal('lv-haze');
    api.applyVizGlobal('blind');
    expect(document.body.classList.contains('lowvision-mode')).toBe(false);
    expect(document.body.classList.contains('blind-mode')).toBe(true);
  });
});

describe('updateVizIndicator — elemento real', () => {
  it('[Right] escreve hidden, as classes e o aria-label que o leitor de tela lê', () => {
    const { api } = setup();
    api.updateVizIndicator('lowvision');
    const el = document.querySelector('#viz-indicator');
    expect(el.hidden).toBe(false);
    expect(el.classList.contains('low')).toBe(true);
    expect(el.classList.contains('blind')).toBe(false);
    expect(el.getAttribute('aria-label')).toBe('Modo baixa visão. Toque duas vezes para voltar às cores normais.');
  });
});

describe('renderVizGroup — fiação no DOM real', () => {
  it('[Right] gera um botão-rádio por modo, com o atual marcado', () => {
    const { api } = setup({ players: [{ viz: 'lv-blur' }], numPlayers: 1 });
    api.renderVizGroup('#viz-list', '#viz-tabs', [VIZ_BY_KEY.normal, VIZ_BY_KEY['lv-blur'], VIZ_BY_KEY.blind]);
    const btns = [...document.querySelectorAll('#viz-list button[data-viz]')];
    expect(btns.map((b) => b.dataset.viz)).toEqual(['normal', 'lv-blur', 'blind']);
    expect(btns.filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => b.dataset.viz)).toEqual(['lv-blur']);
    expect(btns.every((b) => b.getAttribute('role') === 'radio')).toBe(true);
  });
  it('[Right] clicar num botão real troca o modo do jogador selecionado e anuncia', () => {
    const { env, api } = setup({ players: [{ viz: 'normal' }, { viz: 'normal' }], numPlayers: 2, sel: 1, vpSpr: [{ filters: null }, { filters: null }] });
    api.renderVizGroup('#viz-list', '#viz-tabs', [VIZ_BY_KEY.normal, VIZ_BY_KEY.blind]);
    document.querySelector('#viz-list button[data-viz="blind"]').click();
    expect(env.players.map((p) => p.viz)).toEqual(['normal', 'blind']);
    expect(env.log.say).toEqual(['Jogador 2: Simular cegueira total.']);
    expect(env.vpSpr[1].filters).toEqual(['FILTER:blind']); // multi-tela: filtro por viewport, não global
    expect(document.body.classList.contains('blind-mode')).toBe(false);
  });
  it('[Right] as abas de jogador são escondidas e ESVAZIADAS antes do querySelectorAll (bug preservado: o listener nunca é ligado)', () => {
    const { env, api } = setup({ players: [{ viz: 'normal' }, { viz: 'normal' }], numPlayers: 2, sel: 0 });
    const tabs = document.querySelector('#viz-tabs');
    expect(tabs.querySelectorAll('button[data-vp]')).toHaveLength(1); // havia uma aba no HTML
    api.renderVizGroup('#viz-list', '#viz-tabs', [VIZ_BY_KEY.normal]);
    expect(tabs.hidden).toBe(true);
    expect(tabs.querySelectorAll('button[data-vp]')).toHaveLength(0); // innerHTML='' apagou → nada para ligar
    expect(env.sel).toBe(0);
  });
});
