// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of render/viz-setters in the REAL DOM/canvas (browser project: Chromium/Playwright). The .node.test.js covers the
// pure logic and the shells with fake PIXI/DOM; here are the two things the fake cannot prove:
//  (a) the 'hcnew' detour (Direct Rendering) — worldTexFor needs real getImageData/putImageData;
//  (b) the DOM wiring of renderVizGroup/updateVizIndicator/body.classList against the real DOM (the innerHTML +
//      querySelectorAll, including the tabs' querySelectorAll that finds NOTHING — see the case near the end).
// ZOMBIES + Right-BICEP. See ADR-0011-visual-accessibility.yaml.
import { describe, it, expect, beforeEach } from 'vitest';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';
import { migrateVisual, DEFAULT_VISUAL } from '../app/js/render/viz-axes.js';
import { roleOfFalso as roleOf } from './fixtures/fake-cartridge.js'; // the tile→role table belongs to the GAME (ADR-0080); the engine RECEIVES it

// lqT is no longer read at the IMPORT of render/lq-filter: it is 0 until `initLqFilter` reads the store it is given
// (ADR-0232), and this file never calls it — so no leftover 'incl_lq' can enter the exact-string assertions, and nothing
// here clears the page's storage out from under the files that share the origin.

const { TILE } = await import('../app/js/core/constants.js');
const { VIZ_BY_KEY } = await import('../app/js/render/viz-modes.js');
const HC = await import('../app/js/render/high-contrast.js');
const { initVizSetters } = await import('../app/js/render/viz-setters.js');

// A 4×3 world with one semantic role per column (the same fixture as high-contrast.browser.test).
const W = 4, H = 3;
const WORLD = [
  [2, 9, 4, 3],
  [2, 2, 2, 2],
  [0, 1, 0, 1],
];
// The grid belongs to the case, for the same reason as in `high-contrast.browser`: the module that answered `tileAt`
// changed repository (note CB) and high contrast receives the query through a port (note CA). Outside the grid is STONE
// (2), the natural wall the module also returned.
const tileAt = (tx, ty) => (tx < 0 || tx >= W || ty < 0 || ty >= H ? 2 : WORLD[ty][tx]);

function flatCanvas(w, h, css) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); c.fillStyle = css; c.fillRect(0, 0, w, h);
  return cv;
}
const worldCanvasNormal = flatCanvas(W * TILE, H * TILE, 'rgb(120,120,140)');
// The fixture's ITEM is called 'alvo' and not 'moeda' (item 19): a `viz-setters` test saying "coin" on every line would
// reassert out of habit what the cut took out of the module — the id comes from the game, through `ctx.itemTexId`.
const itemCanvasNormal = flatCanvas(8, 8, 'rgb(240,200,60)');
const TEX_WORLD_NORMAL = { NORMAL: 'world' };
const TEX_ITEM_NORMAL = { NORMAL: 'alvo' };
HC.initHighContrast({ store: createStorage(memoryBackend()), roleOf,
  W, H, tileAt, outlineFg: () => 1, outlineBg: () => 1,
  getWorldCanvasNormal: () => worldCanvasNormal, getWorldTexNormal: () => TEX_WORLD_NORMAL,
  sprites: () => ({ alvo: { canvas: itemCanvasNormal, tex: TEX_ITEM_NORMAL } }),
});

/* ===================== a real stage: the elements the module looks for by selector ===================== */

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
  // The fixture DERIVES the visual-state field from the old key — the same mirror rule production's `setPlayerVisual`
  // keeps (#104).
  const players = (over.players || [{ viz: 'normal', sprite: null, _tx: null }])
    .map((p) => (p && p.visual === undefined && p.viz !== undefined ? { ...p, visual: migrateVisual(p.viz) } : p));
  const env = {
    hcNoDom: [],
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
    store: createStorage(memoryBackend()),
    $: (sel) => document.querySelector(sel),
    body: document.body,
    srSay: (s) => env.log.say.push(s),
    applyCssFilter: (css) => { if (env.app && env.app.view) env.app.view.style.filter = css; }, // the root is the one that knows the canvas
    // High contrast in the DOM (issue #83): it is not a filter, it is a CLASS. This fake imitates the root, which does
    // `#dom-layer.classList.toggle('hc', ligado)`.
    applyHighContrastToDom: (ligado) => { env.hcNoDom.push(ligado); },
    camera: env.camera, worldSprite: env.worldSprite,
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
    setBlindMode: () => {}, setVizMode: () => {}, hideTouchControls: (r) => env.log.hideTouch.push(r),
    reflectVizButtons: () => {}, renderVisualPanel: () => {}, renderEmpathyPanel: () => {},
  };
  return { env, api: initVizSetters(ctx) };
}

beforeEach(() => { document.body.className = ''; HC.clearWorldTexCache(); HC.clearSpriteTexCache(); });

/* ===================================================================================================== */

describe('applyVizGlobal — desvio hcnew (Renderização Direta, canvas real)', () => {
  it('[Right] alto contraste escurece a frente e põe o filtro GPU na câmera', () => {
    const { env, api } = setup();
    api.applyVizGlobal(migrateVisual('hc-direto'));
    expect(env.log.frontDim).toEqual([true]);
    expect(env.camera.filters).toEqual(['FILTER:hc-direto']);
  });
  it('[Right] a textura do mundo vira a REPINTADA (não a normal) e é cacheada por modo', () => {
    const { env, api } = setup();
    api.applyVizGlobal(migrateVisual('hc-direto'));
    const t1 = env.worldSprite.texture;
    expect(t1).not.toBe(TEX_WORLD_NORMAL);
    expect(t1.baseTexture.resource.source.width).toBe(W * TILE); // canvas real repintado
    api.applyVizGlobal(migrateVisual('hc-direto'));
    expect(env.worldSprite.texture).toBe(t1); // same instance → high-contrast's cache holds
  });
  it('[Many] os TRÊS níveis produzem texturas distintas entre si', () => {
    const { env, api } = setup();
    const texs = ['hc-direto', 'hc-direto-45', 'hc-direto-7'].map((m) => { api.applyVizGlobal(migrateVisual(m)); return env.worldSprite.texture; });
    expect(new Set(texs).size).toBe(3);
  });
  it('⚠️ [Right] #104: `hc7` E `fix-deuter` AO MESMO TEMPO, com os DOIS aplicados', () => {
    // ⚠️ IT IS BOX Nº 1 OF THE DEFINITION OF DONE, and the reason the issue exists. With a single `p.viz` value, choosing
    // `fix-deuter` turned 7:1 contrast off, and choosing contrast turned the correction off. A child with colour blindness
    // who ALSO needs high contrast could not have both — and the two needs often coexist in the same person.
    //
    // The composition was always mechanically possible: the THEME goes through direct rendering (texture) and the
    // CORRECTION through a CSS filter, two paths that do not collide. What prevented it was the single field.
    const { env, api } = setup();
    api.applyVizGlobal({ tema: 'hc7', correcao: 'deuter', simulacao: null });

    // The THEME arrived: texture repainted, foreground dimmed, high-contrast class on the DOM.
    expect(env.worldSprite.texture, 'o tema não foi aplicado').not.toBe(TEX_WORLD_NORMAL);
    expect(env.log.frontDim.at(-1)).toBe(true);
    expect(env.hcNoDom.at(-1)).toBe(true);
    // AND THE CORRECTION TOO, at the same instant, through the other path.
    expect(env.app.view.style.filter, 'a correção de cor foi apagada pelo tema').toContain('cvd-fix-deuter');
  });

  it('⚠️ [Right] #104: mexer num eixo não apaga o outro — uma asserção em cada sentido', () => {
    const { env, api } = setup();
    // Start with both on and take ONE off at a time.
    api.applyVizGlobal({ tema: 'hc7', correcao: 'deuter', simulacao: null });
    api.applyVizGlobal({ tema: 'padrao', correcao: 'deuter', simulacao: null });
    expect(env.worldSprite.texture, 'tirar o tema devia devolver a textura normal').toBe(TEX_WORLD_NORMAL);
    expect(env.app.view.style.filter, 'tirar o TEMA apagou a CORREÇÃO').toContain('cvd-fix-deuter');

    api.applyVizGlobal({ tema: 'hc7', correcao: 'tricro', simulacao: null });
    expect(env.worldSprite.texture, 'tirar a CORREÇÃO apagou o TEMA').not.toBe(TEX_WORLD_NORMAL);
    expect(env.app.view.style.filter).not.toContain('cvd-fix');
  });

  it('[Inverse] voltar a normal devolve a textura normal e tira o filtro da câmera', () => {
    const { env, api } = setup();
    api.applyVizGlobal(migrateVisual('hc-direto-7'));
    api.applyVizGlobal(migrateVisual('normal'));
    expect(env.worldSprite.texture).toBe(TEX_WORLD_NORMAL);
    expect(env.camera.filters).toBeNull();
    expect(env.log.frontDim).toEqual([true, false]);
  });
  it('[Zero] alto contraste NÃO acende a bolinha indicadora (ela é só de empatia: cegueira/baixa visão)', () => {
    const { api } = setup();
    api.applyVizGlobal(migrateVisual('hc-direto'));
    expect(document.querySelector('#viz-indicator').hidden).toBe(true);
  });
});

describe('applyVizGlobal — DOM real (body, overlay, bolinha)', () => {
  it('[Right] baixa visão marca o body e mostra o overlay com a classe da variante', () => {
    const { api } = setup();
    api.applyVizGlobal(migrateVisual('lv-macular'));
    expect(document.body.classList.contains('lowvision-mode')).toBe(true);
    const ov = document.querySelector('#viz-overlay');
    expect(ov.hidden).toBe(false);
    expect(ov.className).toBe('lv-macular');
  });
  it('[Right] cegueira: body marcado, filtro CSS na canvas e controles de toque ocultos', () => {
    const { env, api } = setup();
    api.applyVizGlobal(migrateVisual('blind'));
    expect(document.body.classList.contains('blind-mode')).toBe(true);
    expect(env.app.view.style.filter).toBe('brightness(0)');
    expect(env.log.hideTouch).toEqual(['cegueira']);
  });
  it('[Inverse] as duas classes de empatia nunca coexistem no body', () => {
    const { api } = setup();
    api.applyVizGlobal(migrateVisual('lv-haze'));
    api.applyVizGlobal(migrateVisual('blind'));
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
  it('⚠️ [Right] #104: com um eixo FORA do padrão, a simulação fica desabilitada E DIZ POR QUÊ', () => {
    // ⚠️ THE TWO HALVES OF ADR-0076, and they are different defects. «Never silently removed»: the row stays on screen —
    // vanishing would teach that the thing does not exist, and an adult would conclude it was taken away instead of
    // realising they turned high contrast on. «Never accepted then ignored»: the button gets no listener at all, because a
    // demonstration on top of a setting shows the SETTING and teaches something false.
    const { env, api } = setup({
      players: [{ visual: { tema: 'hc7', correcao: 'tricro', simulacao: null } }], numPlayers: 1,
    });
    api.renderVizGroup('#viz-list', '#viz-tabs', [VIZ_BY_KEY.blind, VIZ_BY_KEY['lv-blur']]);
    const btns = [...document.querySelectorAll('#viz-list button[data-viz]')];
    expect(btns.every((b) => b.getAttribute('aria-disabled') === 'true'), 'linha aceitável durante um ajuste').toBe(true);
    // The prose goes in the `.opt-hint`, which the shell MOVES to the footer — the three-zones rule.
    const dica = document.querySelector('#viz-list .ctrl-row .opt-hint').textContent;
    expect(dica, 'o motivo não chegou à linha').toContain('tema precisa estar no padrão');
    // And the click does nothing: accepting and ignoring is the worse half.
    document.querySelector('#viz-list button[data-viz="blind"]').click();
    expect(env.players[0].visual.simulacao, 'a simulação correu por cima de um ajuste').toBeNull();
  });

  it('⚠️ [Boundary] a recusa alcança SÓ o que simula — uma correção na mesma lista não é recusada', () => {
    // ⚠️ THIS CASE WAS BORN FROM A SURVIVING MUTATION, and the hole was real: removing the `simulatesDisability` guard failed
    // nothing, because the fixture only passed simulations. A list with a CORRECTION in it is what tells them apart —
    // refusing it would take from a colour-blind child her correction because of a high contrast she also needs, which is
    // the exact opposite of what #104 does.
    const { api } = setup({
      players: [{ visual: { tema: 'hc7', correcao: 'tricro', simulacao: null } }], numPlayers: 1,
    });
    api.renderVizGroup('#viz-list', '#viz-tabs', [VIZ_BY_KEY.blind, VIZ_BY_KEY['fix-deuter']]);
    const desabilitados = [...document.querySelectorAll('#viz-list button[aria-disabled="true"]')]
      .map((b) => b.dataset.viz);
    expect(desabilitados, 'a recusa passou por cima de uma correção de cor').toEqual(['blind']);
  });

  it('⚠️ [Zero] com os dois eixos no padrão, nada é recusado e o clique volta a valer', () => {
    // A warning that always appears stops being read, and a refusal that never lifts is a wall.
    const { env, api } = setup({ players: [{ visual: DEFAULT_VISUAL }], numPlayers: 1 });
    api.renderVizGroup('#viz-list', '#viz-tabs', [VIZ_BY_KEY.blind]);
    const btn = document.querySelector('#viz-list button[data-viz="blind"]');
    expect(btn.getAttribute('aria-disabled')).toBeNull();
    btn.click();
    expect(env.players[0].visual.simulacao).toBe('blind');
  });

  it('[Right] clicar num botão real troca o modo do jogador selecionado e anuncia', () => {
    const { env, api } = setup({ players: [{ viz: 'normal' }, { viz: 'normal' }], numPlayers: 2, sel: 1, vpSpr: [{ filters: null }, { filters: null }] });
    api.renderVizGroup('#viz-list', '#viz-tabs', [VIZ_BY_KEY.normal, VIZ_BY_KEY.blind]);
    document.querySelector('#viz-list button[data-viz="blind"]').click();
    expect(env.players.map((p) => p.viz)).toEqual(['normal', 'blind']);
    expect(env.log.say).toEqual(['Jogador 2: Simular cegueira total.']);
    expect(env.vpSpr[1].filters).toEqual(['FILTER:blind']); // multi-screen: a filter per viewport, not global
    expect(document.body.classList.contains('blind-mode')).toBe(false);
  });
  it('[Right] as abas de jogador são escondidas e ESVAZIADAS antes do querySelectorAll (bug preservado: o listener nunca é ligado)', () => {
    const { env, api } = setup({ players: [{ viz: 'normal' }, { viz: 'normal' }], numPlayers: 2, sel: 0 });
    const tabs = document.querySelector('#viz-tabs');
    expect(tabs.querySelectorAll('button[data-vp]')).toHaveLength(1); // havia uma aba no HTML
    api.renderVizGroup('#viz-list', '#viz-tabs', [VIZ_BY_KEY.normal]);
    expect(tabs.hidden).toBe(true);
    expect(tabs.querySelectorAll('button[data-vp]')).toHaveLength(0); // innerHTML='' erased them → nothing to wire
    expect(env.sel).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------
// HIGH CONTRAST IN THE DOM (issue #83). It is NOT a filter: it is Direct Rendering, and it repaints the canvas's
// TEXTURES. The DOM has no texture, so the fix of #82 — propagating the filter — did not reach it. What crosses is a
// CLASS, and the drawing (opaque veil, inverted cursor) lives in `style.css`, with the reasons measured in
// `tests/menu-contrast-measured.node.test.js`.
//
// These cases live HERE and not in the node test because the `hcnew` path calls `worldTexFor`, which needs a real canvas
// to repaint — the same reason the Direct Rendering detour was already tested in this file.
//
// MUTATION CHECKED: replacing `m.kind === 'hcnew'` with `false` in `applyVizGlobal`, the [Right] fails with
// "expected false to be true".
describe('alto contraste alcança o DOM por CLASSE, não por filtro (issue #83)', () => {
  it('[Right] os três níveis ligam a classe, e NÃO produzem filtro', () => {
    for (const m of ['hc-direto', 'hc-direto-45', 'hc-direto-7']) {
      const { env, api } = setup();
      api.applyVizGlobal(migrateVisual(m));
      expect(env.hcNoDom.at(-1), m + ': a classe').toBe(true);
      expect(env.app.view.style.filter, m + ': não deve haver filtro').toBe('');
    }
  });

  it('[Interface] correção de daltonismo faz o CONTRÁRIO — filtro sim, classe não', () => {
    // The case that guards the distinction issue #83 exists to name. If one day someone tries to unify the two halves into
    // one mechanism, this is where it shows.
    const { env, api } = setup();
    api.applyVizGlobal(migrateVisual('fix-deuter'));
    expect(env.hcNoDom.at(-1)).toBe(false);
    expect(env.app.view.style.filter).toContain('cvd-fix-deuter');
  });
});
