// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/viz-setters no DOM/canvas REAIS (project browser: Chromium/Playwright). O .node.test.js
// cobre a lógica pura e as cascas com PIXI/DOM falsos; aqui ficam as duas coisas que o falso não pode provar:
//  (a) o desvio 'hcnew' (Renderização Direta) — worldTexFor precisa de getImageData/putImageData de verdade;
//  (b) a fiação DOM de renderVizGroup/updateVizIndicator/body.classList contra o DOM de verdade (o innerHTML
//      + querySelectorAll do original, incluindo o querySelectorAll das abas que NÃO acha nada — ver relatório).
// ZOMBIES + Right-BICEP. Ver ADR-0011-visual-accessibility.yaml.
import { describe, it, expect, beforeEach } from 'vitest';
import { migrateVisual, PADRAO } from '../app/js/render/viz-axes.js';
import { roleOfFalso as roleOf } from './fixtures/fake-cartridge.js'; // a tabela tile→papel e do JOGO (ADR-0080); a engine a RECEBE

// lqT é lido no IMPORT de render/lq-filter → zerar antes do import dinâmico, senão um resíduo de 'incl_lq'
// entraria compondo o filtro CSS e as asserções de string exata ficariam dependentes de outro teste.
localStorage.clear();

const { TILE } = await import('../app/js/core/constants.js');
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
// A grade é do caso desde 23/09, pela mesma razão do `high-contrast.browser`: o módulo que respondia `tileAt`
// mudou de repositório (nota CB) e o alto contraste recebe a consulta por porta (nota CA). Fora da grade é
// PEDRA (2), a parede natural que o módulo também devolvia.
const tileAt = (tx, ty) => (tx < 0 || tx >= W || ty < 0 || ty >= H ? 2 : WORLD[ty][tx]);

function flatCanvas(w, h, css) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); c.fillStyle = css; c.fillRect(0, 0, w, h);
  return cv;
}
const worldCanvasNormal = flatCanvas(W * TILE, H * TILE, 'rgb(120,120,140)');
// O ITEM do fixture chama-se 'alvo' e não 'moeda' (item 19): um teste de `viz-setters` dizendo "coin" a
// cada linha reafirmaria por hábito o que o corte tirou do módulo — o id vem do jogo, por `ctx.itemTexId`.
const itemCanvasNormal = flatCanvas(8, 8, 'rgb(240,200,60)');
const TEX_WORLD_NORMAL = { NORMAL: 'world' };
const TEX_ITEM_NORMAL = { NORMAL: 'alvo' };
HC.initHighContrast({ roleOf,
  W, H, tileAt, outlineFg: () => 1, outlineBg: () => 1,
  getWorldCanvasNormal: () => worldCanvasNormal, getWorldTexNormal: () => TEX_WORLD_NORMAL,
  sprites: () => ({ alvo: { canvas: itemCanvasNormal, tex: TEX_ITEM_NORMAL } }),
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
  // O fixture DERIVA o campo do estado visual a partir da chave antiga — a mesma regra do espelho que o
  // `setVisualDoJogador` mantem em producao (#104).
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
    $: (sel) => document.querySelector(sel),
    body: document.body,
    srSay: (s) => env.log.say.push(s),
    aplicarFiltroCss: (css) => { if (env.app && env.app.view) env.app.view.style.filter = css; }, // a raiz é quem sabe da canvas
    // Alto contraste no DOM (issue #83): não é filtro, é CLASSE. Este falso imita a raiz, que faz
    // `#dom-layer.classList.toggle('hc', ligado)`.
    aplicarAltoContrasteNoDom: (ligado) => { env.hcNoDom.push(ligado); },
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
    expect(env.worldSprite.texture).toBe(t1); // mesma instância → cache do high-contrast valendo
  });
  it('[Many] os TRÊS níveis produzem texturas distintas entre si', () => {
    const { env, api } = setup();
    const texs = ['hc-direto', 'hc-direto-45', 'hc-direto-7'].map((m) => { api.applyVizGlobal(migrateVisual(m)); return env.worldSprite.texture; });
    expect(new Set(texs).size).toBe(3);
  });
  it('⚠️ [Right] #104: `hc7` E `fix-deuter` AO MESMO TEMPO, com os DOIS aplicados', () => {
    // ⚠️ É A CAIXA Nº 1 DA DEFINITION OF DONE, e a razão de a issue existir. Antes, `p.viz` guardava UM
    // valor: escolher `fix-deuter` desligava o contraste 7:1, e escolher o contraste desligava a correção.
    // Uma criança com daltonismo que TAMBÉM precise de alto contraste não podia ter os dois — e as duas
    // necessidades coexistem numa mesma pessoa com frequência.
    //
    // A composição sempre foi mecanicamente possível: o TEMA vai pela renderização directa (textura) e a
    // CORREÇÃO por filtro CSS, dois caminhos que não colidem. O que impedia era o campo único.
    const { env, api } = setup();
    api.applyVizGlobal({ tema: 'hc7', correcao: 'deuter', simulacao: null });

    // O TEMA chegou: textura repintada, frente escurecida, classe de alto contraste no DOM.
    expect(env.worldSprite.texture, 'o tema não foi aplicado').not.toBe(TEX_WORLD_NORMAL);
    expect(env.log.frontDim.at(-1)).toBe(true);
    expect(env.hcNoDom.at(-1)).toBe(true);
    // E A CORREÇÃO TAMBÉM, no mesmo instante, pelo outro caminho.
    expect(env.app.view.style.filter, 'a correção de cor foi apagada pelo tema').toContain('cvd-fix-deuter');
  });

  it('⚠️ [Right] #104: mexer num eixo não apaga o outro — uma asserção em cada sentido', () => {
    const { env, api } = setup();
    // Parte-se dos dois ligados e tira-se UM de cada vez.
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
    // ⚠️ AS DUAS METADES DO ADR-0076, e são defeitos diferentes. «Never silently removed»: a linha continua
    // na tela — sumir ensinaria que a coisa não existe, e um adulto concluiria que ela foi tirada em vez de
    // perceber que foi ele que ligou o alto contraste. «Never accepted then ignored»: o botão não ganha
    // ouvinte nenhum, porque uma demonstração por cima de um ajuste mostra o AJUSTE e ensina uma coisa falsa.
    const { env, api } = setup({
      players: [{ visual: { tema: 'hc7', correcao: 'tricro', simulacao: null } }], numPlayers: 1,
    });
    api.renderVizGroup('#viz-list', '#viz-tabs', [VIZ_BY_KEY.blind, VIZ_BY_KEY['lv-blur']]);
    const btns = [...document.querySelectorAll('#viz-list button[data-viz]')];
    expect(btns.every((b) => b.getAttribute('aria-disabled') === 'true'), 'linha aceitável durante um ajuste').toBe(true);
    // A prosa vai no `.opt-hint`, que é o que a casca MOVE para o rodapé — regra das três zonas.
    const dica = document.querySelector('#viz-list .ctrl-row .opt-hint').textContent;
    expect(dica, 'o motivo não chegou à linha').toContain('tema precisa estar no padrão');
    // E o clique não faz nada: aceitar e ignorar é a metade pior.
    document.querySelector('#viz-list button[data-viz="blind"]').click();
    expect(env.players[0].visual.simulacao, 'a simulação correu por cima de um ajuste').toBeNull();
  });

  it('⚠️ [Boundary] a recusa alcança SÓ o que simula — uma correção na mesma lista não é recusada', () => {
    // ⚠️ ESTE CASO NASCEU DE UMA MUTAÇÃO SOBREVIVENTE, e o buraco era real: tirar a guarda
    // `simulatesDisability` não reprovava nada, porque o fixture só passava simulações. Uma lista com uma
    // CORREÇÃO lá dentro é o que distingue — recusá-la seria tirar de uma criança daltónica a correção dela
    // por causa de um alto contraste que ela também precisa, que é o oposto exacto do que a #104 faz.
    const { api } = setup({
      players: [{ visual: { tema: 'hc7', correcao: 'tricro', simulacao: null } }], numPlayers: 1,
    });
    api.renderVizGroup('#viz-list', '#viz-tabs', [VIZ_BY_KEY.blind, VIZ_BY_KEY['fix-deuter']]);
    const desabilitados = [...document.querySelectorAll('#viz-list button[aria-disabled="true"]')]
      .map((b) => b.dataset.viz);
    expect(desabilitados, 'a recusa passou por cima de uma correção de cor').toEqual(['blind']);
  });

  it('⚠️ [Zero] com os dois eixos no padrão, nada é recusado e o clique volta a valer', () => {
    // Um aviso que aparece sempre deixa de ser lido, e uma recusa que nunca levanta é uma parede.
    const { env, api } = setup({ players: [{ visual: PADRAO }], numPlayers: 1 });
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

// ---------------------------------------------------------------------------------------------------------
// ALTO CONTRASTE NO DOM (issue #83). Ele NÃO é filtro: é Renderização Direta, e repinta as TEXTURAS da canvas.
// O DOM não tem textura, então o conserto da #82 — propagar o filtro — não o alcançava. O que atravessa é uma
// CLASSE, e o desenho (véu opaco, cursor invertido) mora no `style.css`, com as razões medidas em
// `tests/menu-contrast-measured.node.test.js`.
//
// Estes casos vivem AQUI e não no teste de node porque o caminho `hcnew` chama `worldTexFor`, que precisa de
// uma canvas de verdade para repintar — a mesma razão pela qual o desvio de Renderização Direta já era testado
// neste arquivo.
//
// MUTAÇÃO CONFERIDA: trocando `m.kind === 'hcnew'` por `false` em `applyVizGlobal`, o [Right] falha em
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
    // O caso que guarda a distinção que a issue #83 existe para nomear. Se um dia alguém tentar unificar as
    // duas metades num mecanismo só, é aqui que aparece.
    const { env, api } = setup();
    api.applyVizGlobal(migrateVisual('fix-deuter'));
    expect(env.hcNoDom.at(-1)).toBe(false);
    expect(env.app.view.style.filter).toContain('cvd-fix-deuter');
  });
});
