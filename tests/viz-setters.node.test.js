// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/viz-setters — aplicação dos modos de visão acessível por jogador e globalmente.
// project NODE: a lógica PURA (resolução de modo, filtro CSS, bolinha, HTML do grupo de rádios) + as cascas
// com PIXI/DOM FALSIFICADOS por interface estrutural (mesmo precedente de traffic.node/gamepad.node).
// O que exige canvas de verdade — os três níveis de Renderização Direta (kind 'hcnew') — está no
// .browser.test.js; aqui os modos usados são todos NÃO-diretos, que é o desvio que não toca canvas.
// ZOMBIES + Right-BICEP. Comportamento verbatim do game.js (setPlayerViz/applyVizGlobal/reapplyVizAll/
// applySharedTextures/applyVpFilters/updateVpDots/_rebakeDirect/updateVizIndicator/renderVizGroup).
import { describe, it, expect, beforeEach } from 'vitest';
import { t } from '../app/js/core/i18n.js';
import { migrateVisual } from '../app/js/render/viz-axes.js'; // VIZ_MODES guarda CHAVE desde o item 14

// localStorage de mentira ANTES de qualquer coisa do jogo tocar em persistência: platform/storage engole a
// exceção (try/catch), então sem este shim `store.set` vira no-op e o teste de persistência não poderia falhar.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: (k) => { mem.delete(k); },
  clear: () => mem.clear(),
};

const { VIZ_MODES, VIZ_BY_KEY } = await import('../app/js/render/viz-modes.js');
const { initHighContrast } = await import('../app/js/render/high-contrast.js');
const {
  initVizSetters, resolveViz, isDirectMode, cssFilterFor, vizDotFor, vizIndicatorFor,
  lvOverlayClassFor, vizGroupHtml, vizGroupSay, reachOfMode,
} = await import('../app/js/render/viz-setters.js');

// worldTexFor/spriteTexFor exigem o ctx do high-contrast. Nos modos NÃO-diretos elas devolvem a textura normal
// sem tocar em canvas — é exatamente o desvio exercitado aqui.
initHighContrast({
  W: 1, H: 1, outlineFg: () => 0, outlineBg: () => 0,
  getWorldCanvasNormal: () => null, getWorldTexNormal: () => 'TEX_WORLD_NORMAL',
  // O registro de sprites do alto contraste é chaveado por ID, e o id aqui é o mesmo que o ctx declara
  // (`itemTexId: 'alvo'`) — é o par que faz a recoloração encontrar a textura. Nenhum dos dois diz "moeda".
  sprites: () => ({ alvo: { canvas: null, tex: 'TEX_ITEM_NORMAL' } }),
});

/* ===================== fakes: DOM e PIXI por interface estrutural ===================== */

function fakeBtn(key, val) {
  const listeners = {};
  return {
    dataset: { [key]: val },
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    click: () => (listeners.click || []).forEach((f) => f()),
  };
}

// Elemento DOM falso. querySelectorAll('button[data-x]') NÃO devolve uma lista pré-fabricada: varre o
// innerHTML corrente atrás de data-x="…", como o DOM real faria — é isso que deixa o teste enxergar que um
// `innerHTML=''` anterior apaga os botões que o seletor procuraria.
function fakeEl() {
  const classes = new Set(), attrs = {};
  const el = {
    hidden: false, className: '', innerHTML: '', classes, attrs, lastQuery: [],
    classList: {
      toggle: (t, f) => { const on = f === undefined ? !classes.has(t) : !!f; if (on) classes.add(t); else classes.delete(t); return on; },
    },
    setAttribute: (n, v) => { attrs[n] = v; },
    querySelectorAll: (sel) => {
      const m = /^button\[data-([a-z]+)\]$/.exec(sel), btns = [];
      if (m) { const re = new RegExp(`data-${m[1]}="([^"]+)"`, 'g'); let g; while ((g = re.exec(el.innerHTML))) btns.push(fakeBtn(m[1], g[1])); }
      el.lastQuery = btns;
      return { forEach: (cb) => btns.forEach(cb) };
    },
  };
  return el;
}

function fakeDot() {
  const rec = { clears: 0, lines: 0, fills: [], circles: 0, ends: 0 };
  return {
    visible: false, rec,
    clear() { rec.clears++; }, lineStyle() { rec.lines++; },
    beginFill(c) { rec.fills.push(c); }, drawCircle() { rec.circles++; }, endFill() { rec.ends++; },
  };
}

const texd = () => ({ texture: null });
const filtered = () => ({ filters: 'INTOCADO' });

/* ===================== fixture: ctx completo + espiões ===================== */

function setup(over = {}) {
  // ⚠️ O FIXTURE DERIVA `visual` DE `viz`, que é a MESMA regra do espelho que o `setPlayerViz` mantém em
  // produção (#104). Assim os casos continuam a declarar o modo pelo nome — que é como eles falam — e
  // nenhum corpo de caso precisou de mudar quando os leitores migraram. Quando o `viz` sair de vez, sai
  // desta linha e os casos passam a declarar `visual` directamente.
  const players = (over.players || [{ viz: 'normal', sprite: null, _tx: null }])
    .map((p) => (p && p.visual === undefined && p.viz !== undefined ? { ...p, visual: migrateVisual(p.viz) } : p));
  const env = {
    players,
    numPlayers: over.numPlayers === undefined ? players.length : over.numPlayers,
    sharedViz: over.sharedViz === undefined ? null : over.sharedViz,
    sel: over.sel === undefined ? 0 : over.sel,
    els: Object.assign({ '#viz-overlay': fakeEl(), '#viz-indicator': fakeEl() }, over.els || {}),
    app: over.app === undefined ? { view: { style: { filter: 'ANTES' } } } : over.app,
    camera: filtered(),
    worldSprite: texd(),
    parallaxLayers: [texd(), texd(), texd()],
    decoSprites: [texd()],
    itemSprites: over.itemSprites || [],
    powerups: over.powerups || [],
    vpSpr: over.vpSpr || [],
    vpDots: over.vpDots || [],
    log: {
      frontDim: [], blindMode: [], hideTouch: [], say: [], selWrites: [],
      rebuildExtras: 0, rebuildCoins: 0, reflect: 0, visual: 0, empathy: 0, filtrosCss: [], hcNoDom: [],
      clearPlayerDirect: 0, invalidate: 0, sharedWrites: [],
    },
  };
  const ctx = {
    $: (sel) => env.els[sel] || null,
    body: { classes: new Set(), classList: null },
    srSay: (s) => env.log.say.push(s),
    // O módulo pede o VERBO, não o `app`: o `view.style` do PixiJS é `ICanvasStyle`, que nem tem
    // `filter`. Quem sabe que em produção o `view` é uma canvas do DOM é a raiz de composição — e é
    // lá que mora a guarda de "e se não houver canvas montada". Este falso imita a raiz.
    // Alto contraste no DOM (issue #83): não é filtro, é classe — o falso só registra o liga/desliga.
    aplicarAltoContrasteNoDom: (ligado) => { env.log.hcNoDom.push(ligado); },
    aplicarFiltroCss: (css) => { env.log.filtrosCss.push(css); if (env.app && env.app.view) env.app.view.style.filter = css; },
    camera: env.camera,
    worldSprite: env.worldSprite,
    parallaxLayers: env.parallaxLayers,
    decoSprites: env.decoSprites,
    getVpSpr: () => env.vpSpr,
    getVpDots: () => env.vpDots,
    // OS ITENS, e o NOME deles, entram pelo ctx (item 19). Era `getCoinSprites` + a string 'coin' cravada
    // dentro do módulo. O fixture usa 'alvo' de propósito: se ele dissesse 'coin', o teste reafirmaria por
    // hábito o que o corte acabou de tirar — e o gate de fixtures acusaria, com razão.
    getItemSprites: () => env.itemSprites,
    itemTexId: 'alvo',
    getPowerups: () => env.powerups,
    getPlayers: () => env.players,
    getNumPlayers: () => env.numPlayers,
    getSelVizPlayer: () => env.sel,
    setSelVizPlayer: (i) => { env.sel = i; env.log.selWrites.push(i); },
    getSharedViz: () => env.sharedViz,
    setSharedViz: (m) => { env.sharedViz = m; env.log.sharedWrites.push(m); },
    invalidateSharedViz: () => { env.sharedViz = null; env.log.invalidate++; },
    parallaxTexFor: (i, mode) => 'PX:' + i + ':' + mode,
    treeTexFor: (mode) => 'TREE:' + mode,
    playerVizTex: (base, mode) => 'PLAYER:' + base + ':' + mode,
    pixiFilterFor: (mode) => 'FILTER:' + mode,
    clearPlayerDirectCache: () => { env.log.clearPlayerDirect++; },
    setFrontDim: (on) => env.log.frontDim.push(on),
    rebuildExtras: () => { env.log.rebuildExtras++; },
    rebuildCoins: () => { env.log.rebuildCoins++; },
    setModoCego: (on) => env.log.blindMode.push(on),
    hideTouchControls: (r) => env.log.hideTouch.push(r),
    reflectVizButtons: () => { env.log.reflect++; },
    renderVisualPanel: () => { env.log.visual++; },
    renderEmpathyPanel: () => { env.log.empathy++; },
  };
  const bodyClasses = ctx.body.classes;
  ctx.body.classList = {
    toggle: (t, f) => { const on = f === undefined ? !bodyClasses.has(t) : !!f; if (on) bodyClasses.add(t); else bodyClasses.delete(t); return on; },
    remove: (...ts) => ts.forEach((t) => bodyClasses.delete(t)),
  };
  env.bodyClasses = bodyClasses;
  return { env, api: initVizSetters(ctx) };
}

beforeEach(() => { mem.clear(); });

/* =====================================================================================================
   PURO
   ===================================================================================================== */

describe('resolveViz — chave → modo (o fallback que segura a UI)', () => {
  it('[Right] chave conhecida devolve o próprio modo', () => {
    expect(resolveViz('blind')).toBe(VIZ_BY_KEY.blind);
    expect(resolveViz('lv-tunnel')).toBe(VIZ_BY_KEY['lv-tunnel']);
  });
  it('[Error] modo DESCONHECIDO cai em normal', () => {
    expect(resolveViz('modo-que-nao-existe')).toBe(VIZ_BY_KEY.normal);
  });
  it('[Zero/Null] string vazia, null e undefined também caem em normal', () => {
    for (const k of ['', null, undefined]) expect(resolveViz(k).key).toBe('normal');
  });
  it('[Cross-check] TODA chave de VIZ_MODES resolve para si mesma (nenhum modo do catálogo é inalcançável)', () => {
    for (const m of VIZ_MODES) expect(resolveViz(m.key).key).toBe(m.key);
  });
});

describe('isDirectMode — quais modos usam Renderização Direta', () => {
  it('[Right] os três níveis de alto contraste são diretos; nenhum outro é', () => {
    const diretos = VIZ_MODES.filter((m) => isDirectMode(m.key)).map((m) => m.key);
    expect(diretos).toEqual(['hc-direto', 'hc-direto-45', 'hc-direto-7']);
  });
});

describe('cssFilterFor — filtro CSS da canvas no solo (visão + realce L→Q compostos)', () => {
  it('[Right] modo com filtro + realce ligado = os dois, na ordem visão→realce', () => {
    expect(cssFilterFor('sim-deuter', 'url(#lq-enh)')).toBe('url(#cvd-deuter) url(#lq-enh)');
  });
  it('[Zero] modo normal com realce desligado = string vazia (sem `filter` pendurado na canvas)', () => {
    expect(cssFilterFor('normal', '')).toBe('');
  });
  it('[Simple] só o realce, sem modo de visão', () => {
    expect(cssFilterFor('normal', 'url(#lq-enh)')).toBe('url(#lq-enh)');
  });
  it('[Simple] só o modo de visão, sem realce', () => {
    expect(cssFilterFor('blind', '')).toBe('brightness(0)');
  });
  it('[Boundary] lv-macular tem entrada VAZIA no catálogo → não vira um espaço solto', () => {
    expect(cssFilterFor('lv-macular', '')).toBe('');
    expect(cssFilterFor('lv-macular', 'url(#lq-enh)')).toBe('url(#lq-enh)');
  });
});

describe('vizDotFor — bolinha indicadora de um viewport', () => {
  it('[Right] cegueira acende BRANCA; baixa visão acende VERDE', () => {
    expect(vizDotFor(VIZ_BY_KEY.blind)).toEqual({ visible: true, fill: 0xffffff });
    expect(vizDotFor(VIZ_BY_KEY['lv-haze'])).toEqual({ visible: true, fill: 0x36d36a });
  });
  it('[Zero] normal, correção de daltonismo e alto contraste NÃO acendem', () => {
    for (const k of ['normal', 'fix-protan', 'sim-tritan', 'hc-direto']) {
      expect(vizDotFor(VIZ_BY_KEY[k])).toEqual({ visible: false, fill: null });
    }
  });
  it('[Null] modo ausente (viewport sem jogador) não acende nem lança', () => {
    expect(vizDotFor(undefined)).toEqual({ visible: false, fill: null });
  });
  it('[Many] as CINCO variantes de baixa visão usam a mesma bolinha verde', () => {
    const lv = VIZ_MODES.filter((m) => m.kind === 'lowvision');
    expect(lv).toHaveLength(5);
    for (const m of lv) expect(vizDotFor(m).fill).toBe(0x36d36a);
  });
});

describe('vizIndicatorFor — bolinha GLOBAL (#viz-indicator)', () => {
  it('[Right] cegueira: visível, classe blind, rótulo próprio', () => {
    expect(vizIndicatorFor('blind')).toEqual({
      on: true, blind: true, low: false,
      label: 'Modo cegueira total. Toque duas vezes para voltar às cores normais.',
    });
  });
  it('[Right] baixa visão: visível, classe low, rótulo próprio', () => {
    expect(vizIndicatorFor('lowvision')).toMatchObject({ on: true, blind: false, low: true });
    expect(vizIndicatorFor('lowvision').label).toMatch(/^Modo baixa visão\./);
  });
  it('[Zero] kind sem empatia visual apaga a bolinha (as duas classes saem)', () => {
    for (const k of ['normal', 'filter', 'hcnew']) {
      expect(vizIndicatorFor(k)).toMatchObject({ on: false, blind: false, low: false });
    }
  });
  it('[Right] o rótulo SEMPRE ensina a saída (é a única saída visível em cegueira)', () => {
    for (const k of ['blind', 'lowvision', 'normal']) {
      expect(vizIndicatorFor(k).label).toContain('Toque duas vezes para voltar às cores normais.');
    }
  });
});

describe('lvOverlayClassFor — classe do overlay DOM de baixa visão', () => {
  it('[Right] cada variante vira lv-<lv>', () => {
    expect(lvOverlayClassFor(VIZ_BY_KEY['lv-tunnel'])).toBe('lv-tunnel');
    expect(lvOverlayClassFor(VIZ_BY_KEY['lv-diabetic'])).toBe('lv-diabetic');
  });
  it('[Zero] qualquer kind que não seja baixa visão zera a classe', () => {
    for (const k of ['normal', 'blind', 'hc-direto', 'sim-protan']) expect(lvOverlayClassFor(VIZ_BY_KEY[k])).toBe('');
  });
});

describe('vizGroupHtml — grupo de rádios dos modos', () => {
  it('[Right] marca EXATAMENTE um botão (o modo atual) como selecionado', () => {
    const html = vizGroupHtml(VIZ_MODES, 'lv-haze');
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).toContain('data-viz="lv-haze" type="button">✓ Selecionado');
  });
  it('[Right] os não selecionados ficam com aria-checked=false e sem a classe is-on', () => {
    const html = vizGroupHtml([VIZ_BY_KEY.normal, VIZ_BY_KEY.blind], 'blind');
    expect(html).toContain('<button class="mode-btn" role="radio" aria-checked="false" data-viz="normal"');
    expect(html).toContain('<button class="mode-btn is-on" role="radio" aria-checked="true" data-viz="blind"');
  });
  it('[Many] uma linha por modo — nem a mais nem a menos', () => {
    expect(vizGroupHtml(VIZ_MODES, 'normal').match(/class="ctrl-row"/g)).toHaveLength(VIZ_MODES.length);
  });
  it('[Zero] lista vazia gera string vazia', () => {
    expect(vizGroupHtml([], 'normal')).toBe('');
  });
  it('[Error] modo atual FORA da lista exibida → nenhum marcado (o painel não inventa seleção)', () => {
    const html = vizGroupHtml([VIZ_BY_KEY.normal, VIZ_BY_KEY.blind], 'lv-blur');
    expect(html).not.toContain('aria-checked="true"');
  });
  it('[Right] nome e descrição de cada modo entram na linha (é o que o leitor de tela lê)', () => {
    const html = vizGroupHtml([VIZ_BY_KEY.blind], 'normal');
    // `nome`/`desc` guardam CHAVE desde o item 14; a linha tem de trazer o TEXTO. Comparar com a chave crua
    // passaria aceitando `viz.blind` na tela — que é o modo silencioso de falhar da i18n por chave.
    expect(html).toContain(t(VIZ_BY_KEY.blind.nome));
    expect(html).toContain(t(VIZ_BY_KEY.blind.desc));
    expect(html).not.toContain('viz.blind');
  });
});

describe('vizGroupSay — fala ao escolher um modo', () => {
  it('[Zero] solo: sem prefixo de jogador', () => {
    expect(vizGroupSay(1, 0, 'Cores normais')).toBe('Cores normais.');
  });
  it('[Right] multi-tela: prefixo com o número 1-based do jogador selecionado', () => {
    expect(vizGroupSay(3, 2, 'Simular cegueira total')).toBe('Jogador 3: Simular cegueira total.');
  });
  it('[Boundary] 2 jogadores já prefixa (o corte é >1, não >=3)', () => {
    expect(vizGroupSay(2, 0, 'X')).toBe('Jogador 1: X.');
  });
});

/* =====================================================================================================
   CASCAS — DOM/PIXI falsos
   ===================================================================================================== */

describe('updateVizIndicator — bolinha global no DOM', () => {
  it('[Right] cegueira: mostra, marca .blind e escreve o aria-label', () => {
    const { env, api } = setup();
    api.updateVizIndicator('blind');
    const el = env.els['#viz-indicator'];
    expect(el.hidden).toBe(false);
    expect([...el.classes]).toEqual(['blind']);
    expect(el.attrs['aria-label']).toContain('Modo cegueira total');
  });
  it('[Inverse] voltar a normal esconde e limpa AS DUAS classes', () => {
    const { env, api } = setup();
    api.updateVizIndicator('lowvision');
    expect([...env.els['#viz-indicator'].classes]).toEqual(['low']);
    api.updateVizIndicator('normal');
    expect(env.els['#viz-indicator'].hidden).toBe(true);
    expect([...env.els['#viz-indicator'].classes]).toEqual([]);
  });
  it('[Null] sem o elemento na página, não lança', () => {
    const { api } = setup({ els: { '#viz-indicator': null } });
    expect(() => api.updateVizIndicator('blind')).not.toThrow();
  });
});

describe('updateVpDots — bolinhas por viewport', () => {
  it('[Right] cada viewport recebe a bolinha do SEU jogador (uma acende, a outra não)', () => {
    const { env, api } = setup({
      players: [{ viz: 'blind' }, { viz: 'normal' }],
      vpDots: [fakeDot(), fakeDot()],
    });
    api.updateVpDots();
    expect(env.vpDots[0].visible).toBe(true);
    expect(env.vpDots[0].rec.fills).toEqual([0xffffff]);
    expect(env.vpDots[1].visible).toBe(false);
    expect(env.vpDots[1].rec.fills).toEqual([]); // apagada NÃO redesenha
  });
  it('[Boundary] mais viewports que jogadores: o excedente apaga sem lançar', () => {
    const { env, api } = setup({ players: [{ viz: 'lv-blur' }], numPlayers: 1, vpDots: [fakeDot(), fakeDot()] });
    api.updateVpDots();
    expect(env.vpDots[0].visible).toBe(true);
    expect(env.vpDots[1].visible).toBe(false);
  });
  it('[Null] buraco no array de bolinhas é pulado (o `if(!g)continue` do original)', () => {
    const { env, api } = setup({ players: [{ viz: 'blind' }, { viz: 'blind' }], vpDots: [null, fakeDot()] });
    expect(() => api.updateVpDots()).not.toThrow();
    expect(env.vpDots[1].visible).toBe(true);
  });
});

describe('applyVpFilters — filtro PIXI por viewport', () => {
  it('[Right] cada tela recebe o filtro do modo do SEU jogador', () => {
    const { env, api } = setup({ players: [{ viz: 'sim-protan' }, { viz: 'lv-blur' }], vpSpr: [filtered(), filtered()] });
    api.applyVpFilters();
    expect(env.vpSpr[0].filters).toBe('FILTER:sim-protan');
    expect(env.vpSpr[1].filters).toBe('FILTER:lv-blur');
  });
  it('[Boundary] o laço é por numPlayers, não pelo tamanho do array de sprites (sobra fica intocada)', () => {
    const { env, api } = setup({ players: [{ viz: 'blind' }, { viz: 'normal' }], numPlayers: 1, vpSpr: [filtered(), filtered()] });
    api.applyVpFilters();
    expect(env.vpSpr[0].filters).toBe('FILTER:blind');
    expect(env.vpSpr[1].filters).toBe('INTOCADO');
  });
  it('[Right] o array de sprites é lido por GETTER: configureRender pode recriá-lo entre chamadas', () => {
    const { env, api } = setup({ players: [{ viz: 'blind' }], vpSpr: [filtered()] });
    api.applyVpFilters();
    const antigo = env.vpSpr[0];
    env.vpSpr = [filtered()]; // <- é o que configureRender faz ao trocar o nº de telas
    // ⚠️ ESCREVE OS DOIS, como o `setPlayerViz` faz (#104). O caso escrevia só `env.players[0].viz`, o que
    // em produção NINGUÉM faz — quem muda o modo passa pelo setter, e o setter mantém o espelho. Um teste
    // que contorna a API acaba a medir um estado que o programa nunca produz.
    env.players[0].viz = 'lv-haze';
    env.players[0].visual = migrateVisual('lv-haze');
    api.applyVpFilters();
    expect(env.vpSpr[0].filters).toBe('FILTER:lv-haze');
    expect(antigo.filters).toBe('FILTER:blind'); // o array velho não é mais tocado
  });
});

describe('applySharedTextures — texturas estáticas do multiplayer (memo por modo)', () => {
  const cena = () => setup({
    players: [{ viz: 'normal', sprite: texd(), _tx: 'TX0' }, { viz: 'normal', sprite: texd(), _tx: 'TX1' }],
    itemSprites: [texd(), null, texd()],
  });

  it('[Right] primeira aplicação troca mundo, parallax, decoração e itens', () => {
    const { env, api } = cena();
    api.applySharedTextures('sim-deuter');
    expect(env.worldSprite.texture).toBe('TEX_WORLD_NORMAL');
    expect(env.parallaxLayers.map((l) => l.texture)).toEqual(['PX:0:sim-deuter', 'PX:1:sim-deuter', 'PX:2:sim-deuter']);
    expect(env.decoSprites[0].texture).toBe('TREE:sim-deuter');
    expect(env.itemSprites[0].texture).toBe('TEX_ITEM_NORMAL');
    expect(env.log.frontDim).toEqual([false]);
    expect(env.sharedViz).toBe('sim-deuter');
  });
  it('[Right] o sprite de CADA jogador é reaplicado sempre (o quadro muda toda frame)', () => {
    const { env, api } = cena();
    api.applySharedTextures('blind');
    expect(env.players[0].sprite.texture).toBe('PLAYER:TX0:blind');
    expect(env.players[1].sprite.texture).toBe('PLAYER:TX1:blind');
  });
  it('[Right] repetir o MESMO modo não reaplica os estáticos, mas reaplica os jogadores', () => {
    const { env, api } = cena();
    api.applySharedTextures('blind');
    env.parallaxLayers[0].texture = 'MARCA';
    env.players[0].sprite.texture = 'MARCA';
    api.applySharedTextures('blind');
    expect(env.parallaxLayers[0].texture).toBe('MARCA'); // estático NÃO foi refeito
    expect(env.players[0].sprite.texture).toBe('PLAYER:TX0:blind'); // jogador FOI
    expect(env.log.frontDim).toEqual([false]); // só a primeira vez
  });
  it('[Inverse] invalidar o registro força a reaplicação do mesmo modo', () => {
    const { env, api } = cena();
    api.applySharedTextures('blind');
    env.parallaxLayers[0].texture = 'MARCA';
    env.sharedViz = null; // <- o que rebuildCoins/rebuildExtras/setPlayerViz fazem
    api.applySharedTextures('blind');
    expect(env.parallaxLayers[0].texture).toBe('PX:0:blind');
  });
  it('[Right] trocar de modo reaplica (é a troca de modo, não a chamada, que dispara)', () => {
    const { env, api } = cena();
    api.applySharedTextures('blind');
    api.applySharedTextures('lv-haze');
    expect(env.parallaxLayers[0].texture).toBe('PX:0:lv-haze');
    expect(env.log.sharedWrites).toEqual(['blind', 'lv-haze']);
  });
  it('[Null] buraco no array de itens é pulado', () => {
    const { api } = setup({ itemSprites: [null, null] });
    expect(() => api.applySharedTextures('normal')).not.toThrow();
  });
  it('[Zero] jogador sem sprite ou sem quadro (_tx) não é tocado', () => {
    const { env, api } = setup({ players: [{ viz: 'normal', sprite: texd(), _tx: null }] });
    api.applySharedTextures('blind');
    expect(env.players[0].sprite.texture).toBeNull();
  });
});

describe('applyVizGlobal — caminho SOLO (canvas inteira)', () => {
  it('[Right] compõe o filtro CSS da canvas com o modo ativo', () => {
    const { env, api } = setup();
    api.applyVizGlobal(migrateVisual('sim-tritan'));
    expect(env.app.view.style.filter).toBe('url(#cvd-tritan)');
  });
  it('[Error] modo desconhecido cai em normal — e é o `normal` que persiste/aplica', () => {
    const { env, api } = setup();
    api.applyVizGlobal(migrateVisual('inexistente'));
    expect(env.app.view.style.filter).toBe('');
    expect(localStorage.getItem('incl_viz')).toBe('normal');
  });
  it('[Right] baixa visão: classe no body + overlay visível com a classe da variante', () => {
    const { env, api } = setup();
    api.applyVizGlobal(migrateVisual('lv-tunnel'));
    expect(env.bodyClasses.has('lowvision-mode')).toBe(true);
    expect(env.bodyClasses.has('blind-mode')).toBe(false);
    expect(env.els['#viz-overlay'].hidden).toBe(false);
    expect(env.els['#viz-overlay'].className).toBe('lv-tunnel');
    expect(env.els['#viz-indicator'].hidden).toBe(false);
  });
  it('[Right] cegueira: classe no body, overlay escondido e controles de toque ocultos com o motivo', () => {
    const { env, api } = setup();
    api.applyVizGlobal(migrateVisual('blind'));
    expect(env.bodyClasses.has('blind-mode')).toBe(true);
    expect(env.els['#viz-overlay'].hidden).toBe(true);
    expect(env.log.hideTouch).toEqual(['cegueira']);
  });
  it('[Inverse] voltar a normal desfaz classes, overlay e bolinha', () => {
    const { env, api } = setup();
    api.applyVizGlobal(migrateVisual('lv-haze'));
    api.applyVizGlobal(migrateVisual('normal'));
    expect(env.bodyClasses.size).toBe(0);
    expect(env.els['#viz-overlay'].hidden).toBe(true);
    expect(env.els['#viz-overlay'].className).toBe('');
    expect(env.els['#viz-indicator'].hidden).toBe(true);
    expect(env.log.hideTouch).toEqual([]); // normal não esconde o toque
  });
  it('[Zero] modo não-direto NÃO põe filtro na câmera nem escurece a frente', () => {
    const { env, api } = setup();
    api.applyVizGlobal(migrateVisual('fix-deuter'));
    expect(env.camera.filters).toBeNull();
    expect(env.log.frontDim).toEqual([false]);
  });
  it('[Right] refaz extras e itens e repinta os painéis a cada aplicação', () => {
    const { env, api } = setup();
    api.applyVizGlobal(migrateVisual('normal'));
    expect(env.log.rebuildExtras).toBe(1);
    expect(env.log.rebuildCoins).toBe(1);
    expect(env.log.reflect).toBe(1);
    expect(env.log.visual).toBe(1);
    expect(env.log.empathy).toBe(1);
  });
  // 2026-08-26: este caso mudou de assunto junto com a injeção. Antes o módulo perguntava
  // `if (ctx.app && ctx.app.view)` — ele DECIDIA se havia canvas, e a pergunta não era dele. Agora ele
  // chama o verbo sempre, e quem guarda é a raiz. O que sobra para provar aqui é justamente isso: sem
  // canvas montada, o filtro continua a ser PEDIDO (a raiz é que o descarta) e o resto do modo aplica.
  //
  // MUTAÇÃO CONFERIDA: pondo `if (env.app && env.app.view)` de volta em volta da chamada dentro do
  // módulo, `filtrosCss` fica vazio e o caso falha em "expected [] to have a length of 1".
  it('[Null] sem canvas montada, o módulo AINDA pede o filtro — a guarda é da raiz', () => {
    const { env, api } = setup({ app: { view: null } });
    expect(() => api.applyVizGlobal(migrateVisual('blind'))).not.toThrow();
    expect(env.bodyClasses.has('blind-mode')).toBe(true);
    expect(env.log.filtrosCss).toHaveLength(1);
    expect(env.log.filtrosCss[0]).toBe('brightness(0)');
  });
});

describe('setPlayerViz — solo e multi-tela seguem caminhos DIFERENTES', () => {
  it('[Right] SOLO (jogador 0): aplica o caminho global e NÃO mexe em viewports', () => {
    const { env, api } = setup({ players: [{ viz: 'normal' }], numPlayers: 1, vpSpr: [filtered()], vpDots: [fakeDot()] });
    api.setPlayerViz(0, 'lv-haze');
    expect(env.bodyClasses.has('lowvision-mode')).toBe(true);   // marca do caminho global
    expect(env.app.view.style.filter).toBe('contrast(.58) brightness(1.14) blur(.6px)');
    expect(env.vpSpr[0].filters).toBe('INTOCADO');              // caminho por viewport não rodou
    expect(env.vpDots[0].visible).toBe(false);
  });
  it('[Right] MULTI-TELA: aplica filtros/bolinhas por viewport e NÃO toca no global', () => {
    const { env, api } = setup({
      players: [{ viz: 'normal' }, { viz: 'normal' }], numPlayers: 2,
      vpSpr: [filtered(), filtered()], vpDots: [fakeDot(), fakeDot()],
    });
    api.setPlayerViz(1, 'blind');
    expect(env.vpSpr[1].filters).toBe('FILTER:blind');
    expect(env.vpDots[1].visible).toBe(true);
    expect(env.bodyClasses.size).toBe(0);                       // nada de classe global
    expect(env.app.view.style.filter).toBe('ANTES');            // canvas inteira intocada
    expect(env.log.rebuildCoins).toBe(0);
  });
  it('[Boundary] MULTI-TELA no jogador 0 também vai pelo caminho por viewport (a condição exige numPlayers<=1 E i===0)', () => {
    const { env, api } = setup({ players: [{ viz: 'normal' }, { viz: 'normal' }], numPlayers: 2, vpSpr: [filtered(), filtered()], vpDots: [fakeDot(), fakeDot()] });
    api.setPlayerViz(0, 'blind');
    expect(env.vpSpr[0].filters).toBe('FILTER:blind');
    expect(env.bodyClasses.size).toBe(0);
  });
  it('[Right] trocar o modo de UM jogador NÃO altera o dos outros (nem em memória nem no disco)', () => {
    const { env, api } = setup({
      players: [{ viz: 'sim-protan' }, { viz: 'normal' }, { viz: 'lv-blur' }], numPlayers: 3,
      vpSpr: [filtered(), filtered(), filtered()], vpDots: [fakeDot(), fakeDot(), fakeDot()],
    });
    api.setPlayerViz(1, 'blind');
    expect(env.players.map((p) => p.viz)).toEqual(['sim-protan', 'blind', 'lv-blur']);
    expect(localStorage.getItem('incl_viz_p1')).toBe('blind');
    expect(localStorage.getItem('incl_viz_p0')).toBeNull();
    expect(localStorage.getItem('incl_viz_p2')).toBeNull();
    expect(env.vpSpr.map((s) => s.filters)).toEqual(['FILTER:sim-protan', 'FILTER:blind', 'FILTER:lv-blur']);
  });
  it('[Error] modo desconhecido grava `normal` no jogador e na persistência', () => {
    const { env, api } = setup({ players: [{ viz: 'blind' }], numPlayers: 1 });
    api.setPlayerViz(0, 'chute');
    expect(env.players[0].viz).toBe('normal');
    expect(localStorage.getItem('incl_viz_p0')).toBe('normal');
  });
  it('[Right] cegueira liga o modo cego (bengala + pistas de áudio) por padrão', () => {
    const { env, api } = setup({ players: [{ viz: 'normal' }], numPlayers: 1 });
    api.setPlayerViz(0, 'blind');
    expect(env.log.blindMode).toEqual([true]);
  });
  it('[Inverse] sair da cegueira NÃO desliga o modo cego sozinho (só a entrada é automática)', () => {
    const { env, api } = setup({ players: [{ viz: 'blind' }], numPlayers: 1 });
    api.setPlayerViz(0, 'normal');
    expect(env.log.blindMode).toEqual([]);
  });
  it('[Right] invalida o registro do render estático (o modo mudou, os estáticos precisam refazer)', () => {
    const { env, api } = setup({ players: [{ viz: 'normal' }, { viz: 'normal' }], numPlayers: 2, sharedViz: 'normal', vpSpr: [filtered(), filtered()] });
    api.setPlayerViz(1, 'blind');
    expect(env.log.invalidate).toBe(1);
    expect(env.sharedViz).toBeNull();
  });
});

describe('reapplyVizAll — reaplicação após mudança estrutural (cenário / nº de telas)', () => {
  it('[Right] SOLO: reaplica o modo do jogador 1 pelo caminho global', () => {
    const { env, api } = setup({ players: [{ viz: 'lv-tunnel' }], numPlayers: 1 });
    api.reapplyVizAll();
    expect(env.bodyClasses.has('lowvision-mode')).toBe(true);
    expect(env.els['#viz-overlay'].className).toBe('lv-tunnel');
    expect(localStorage.getItem('incl_viz')).toBe('lv-tunnel');
  });
  it('[Right] MULTI-TELA: DESLIGA filtro/overlay/bolinha globais e liga os por viewport', () => {
    const { env, api } = setup({ players: [{ viz: 'blind' }, { viz: 'lv-haze' }], numPlayers: 2, vpSpr: [filtered(), filtered()] });
    env.bodyClasses.add('blind-mode'); env.bodyClasses.add('lowvision-mode');
    env.els['#viz-overlay'].hidden = false;
    env.els['#viz-indicator'].hidden = false;
    api.reapplyVizAll();
    expect(env.app.view.style.filter).toBe('');            // só o realce L→Q, que está em 0
    expect(env.camera.filters).toBeNull();
    expect(env.bodyClasses.size).toBe(0);
    expect(env.els['#viz-overlay'].hidden).toBe(true);
    expect(env.els['#viz-indicator'].hidden).toBe(true);   // updateVizIndicator('normal')
    expect(env.vpSpr.map((s) => s.filters)).toEqual(['FILTER:blind', 'FILTER:lv-haze']);
    expect(localStorage.getItem('incl_viz')).toBeNull();   // MP não escreve o modo global
  });
  it('[Right] invalida o registro do render estático nos DOIS caminhos', () => {
    for (const n of [1, 2]) {
      const { env, api } = setup({ players: [{ viz: 'normal' }, { viz: 'normal' }], numPlayers: n, sharedViz: 'normal', vpSpr: [filtered(), filtered()] });
      api.reapplyVizAll();
      expect(env.sharedViz).toBeNull();
    }
  });
});

describe('rebakeDirect — invalida os caches de textura direta e re-renderiza', () => {
  it('[Right] limpa o cache de textura do jogador e o registro do render estático', () => {
    const { env, api } = setup({ players: [{ viz: 'normal' }], numPlayers: 1, sharedViz: 'normal' });
    api.rebakeDirect();
    expect(env.log.clearPlayerDirect).toBe(1);
    expect(env.sharedViz).toBeNull();
  });
  it('[Right] SOLO re-renderiza pelo global; MULTI só recompõe os filtros por viewport', () => {
    const solo = setup({ players: [{ viz: 'lv-haze' }], numPlayers: 1 });
    solo.api.rebakeDirect();
    expect(solo.env.log.rebuildCoins).toBe(1);
    expect(solo.env.bodyClasses.has('lowvision-mode')).toBe(true);

    const mp = setup({ players: [{ viz: 'lv-haze' }, { viz: 'blind' }], numPlayers: 2, vpSpr: [filtered(), filtered()] });
    mp.api.rebakeDirect();
    expect(mp.env.log.rebuildCoins).toBe(0);
    expect(mp.env.bodyClasses.size).toBe(0);
    expect(mp.env.vpSpr[1].filters).toBe('FILTER:blind');
  });
});

describe('renderVizGroup — grupo de rádios nos painéis', () => {
  it('[Null] sem a lista no DOM, é no-op (nem lê o jogador selecionado)', () => {
    const { env, api } = setup({ els: { '#lista': null, '#abas': fakeEl() }, sel: 9 });
    api.renderVizGroup('#lista', '#abas', VIZ_MODES);
    expect(env.log.selWrites).toEqual([]);
    expect(env.els['#abas'].innerHTML).toBe('');
  });
  it('[Boundary] jogador selecionado fora do nº de telas volta para o 0', () => {
    const { env, api } = setup({ players: [{ viz: 'blind' }], numPlayers: 1, sel: 3, els: { '#lista': fakeEl(), '#abas': fakeEl() } });
    api.renderVizGroup('#lista', '#abas', VIZ_MODES);
    expect(env.sel).toBe(0);
    expect(env.els['#lista'].innerHTML).toContain('aria-checked="true" data-viz="blind"');
  });
  it('[Right] marca o modo do jogador SELECIONADO, não o do jogador 1', () => {
    const { env, api } = setup({
      players: [{ viz: 'normal' }, { viz: 'sim-protan' }], numPlayers: 2, sel: 1,
      els: { '#lista': fakeEl(), '#abas': fakeEl() },
    });
    api.renderVizGroup('#lista', '#abas', VIZ_MODES);
    expect(env.els['#lista'].innerHTML).toContain('aria-checked="true" data-viz="sim-protan"');
  });
  it('[Zero] viewport sem jogador correspondente cai em normal', () => {
    const { env, api } = setup({ players: [], numPlayers: 4, sel: 2, els: { '#lista': fakeEl(), '#abas': fakeEl() } });
    api.renderVizGroup('#lista', '#abas', [VIZ_BY_KEY.normal, VIZ_BY_KEY.blind]);
    expect(env.els['#lista'].innerHTML).toContain('aria-checked="true" data-viz="normal"');
  });
  it('[Right] as abas de jogador são escondidas e esvaziadas (E3: cada jogador edita só o seu)', () => {
    const { env, api } = setup({ els: { '#lista': fakeEl(), '#abas': fakeEl() } });
    env.els['#abas'].innerHTML = '<button data-vp="1"></button>';
    api.renderVizGroup('#lista', '#abas', VIZ_MODES);
    expect(env.els['#abas'].hidden).toBe(true);
    expect(env.els['#abas'].innerHTML).toBe('');
    expect(env.els['#abas'].lastQuery).toHaveLength(0); // o innerHTML='' apagou o que o seletor buscaria (ver relatório)
  });
  it('[Right] clicar num botão troca o modo do jogador selecionado e anuncia', () => {
    const { env, api } = setup({
      players: [{ viz: 'normal' }, { viz: 'normal' }], numPlayers: 2, sel: 1,
      els: { '#lista': fakeEl(), '#abas': fakeEl() }, vpSpr: [filtered(), filtered()], vpDots: [fakeDot(), fakeDot()],
    });
    api.renderVizGroup('#lista', '#abas', [VIZ_BY_KEY.normal, VIZ_BY_KEY.blind]);
    const btn = env.els['#lista'].lastQuery.find((b) => b.dataset.viz === 'blind');
    btn.click();
    expect(env.players.map((p) => p.viz)).toEqual(['normal', 'blind']);
    expect(env.log.say).toEqual(['Jogador 2: Simular cegueira total.']);
  });
});

// ---------------------------------------------------------------------------------------------------------
// ATÉ ONDE O FILTRO ALCANÇA — decisão do Dev, 2026-08-26, issue #82.
//
// O quadro é metade canvas e metade DOM, e filtro de PIXI não alcança DOM. Até esta data o filtro caía SÓ na
// canvas: a criança daltônica recebia o JOGO corrigido e os MENUS crus — e o menu é onde estão as palavras,
// inclusive as dos próprios ajustes de acessibilidade.
//
// A regra que conserta isso NÃO é "filtrar tudo", e a diferença é de acessibilidade:
//
//   · MELHORIA (normal, hc-direto*, fix-*) existe para a criança ENXERGAR MELHOR → alcança os menus.
//   · EMPATIA (sim-*, lv-*, blind) existe para um adulto SENTIR como é → fica no mundo. O menu é o
//     instrumento de SAIR da simulação; uma cegueira que apagasse o menu de pausa trancaria a criança
//     dentro dela.
//
// E o catálogo já sabia disto antes de a regra ser escrita: `sim: true` marca exatamente os nove modos de
// empatia. Derivar dali, e não de uma segunda lista, é o que impede as duas de divergirem.
//
// MUTAÇÃO CONFERIDA: invertendo o `?` de `reachOfMode`, o [Right] falha em "normal" —
// "expected 'mundo' to be 'mundo-e-menus'".
describe('até onde o filtro alcança (issue #82)', () => {
  const MELHORIAS = ['normal', 'hc-direto', 'hc-direto-45', 'hc-direto-7', 'fix-protan', 'fix-deuter', 'fix-tritan'];
  const EMPATIA = ['sim-deuter', 'sim-protan', 'sim-tritan', 'lv-blur', 'lv-haze', 'lv-tunnel', 'lv-macular', 'lv-diabetic', 'blind'];

  it('[Right] MELHORIA alcança os menus', () => {
    for (const m of MELHORIAS) expect(reachOfMode(m), m).toBe('mundo-e-menus');
  });

  it('[Inverse] EMPATIA fica no mundo — o menu segue legível para sair dela', () => {
    for (const m of EMPATIA) expect(reachOfMode(m), m).toBe('mundo');
  });

  it('[Interface] as duas listas juntas são o catálogo INTEIRO — nenhum modo fica sem regra', () => {
    // O caso que impede a regra de envelhecer: um modo novo entra em VIZ_MODES e cai numa das duas, ou este
    // caso reprova. Sem ele, o modo novo herdaria um alcance por acidente.
    expect([...MELHORIAS, ...EMPATIA].sort()).toEqual(VIZ_MODES.map((m) => m.key).sort());
  });

  it('[Boundary] modo desconhecido cai em MELHORIA — e isso está declarado, não por acaso', () => {
    // `simulatesDisability` devolve `false` para chave inexistente, então o desconhecido alcança o menu. É o
    // lado seguro: um modo que ninguém declarou não deve poder DEIXAR o menu sem correção. Travado aqui para
    // a escolha ser deliberada se alguém a inverter.
    expect(reachOfMode('inventado')).toBe('mundo-e-menus');
  });
});

// ---------------------------------------------------------------------------------------------------------
// ALTO CONTRASTE NO DOM (issue #83). Ele NÃO é filtro: é Renderização Direta, e repinta as texturas da canvas.
// O DOM não tem textura, então o conserto da #82 — propagar o filtro — não o alcançava. O que atravessa é uma
// CLASSE, e o desenho (véu opaco, cursor invertido) mora no `style.css`, com as razões medidas em
// `tests/contraste-menu.node.test.js`.
//
// MUTAÇÃO CONFERIDA: trocando `m.kind === 'hcnew'` por `false` em `applyVizGlobal`, o [Right] falha em
// "expected [] to deeply equal [ true ]".
// ⚠️ Os casos que LIGAM o alto contraste vivem em `viz-setters.browser.test.js`, e não aqui: o caminho
// `hcnew` chama `worldTexFor`, que precisa de uma canvas de verdade para repintar. É a mesma razão pela qual
// o desvio de Renderização Direta já era testado lá. Aqui fica o lado que não toca canvas.
describe('alto contraste alcança o DOM por CLASSE, não por filtro (issue #83)', () => {
  it('[Inverse] modo que não é alto contraste DESLIGA a classe — inclusive os de empatia', () => {
    for (const m of ['normal', 'fix-deuter', 'sim-deuter', 'lv-blur', 'blind']) {
      const { env, api } = setup({ players: [{ viz: 'normal' }], numPlayers: 1 });
      api.applyVizGlobal(migrateVisual(m));
      expect(env.log.hcNoDom.at(-1), m).toBe(false);
    }
  });

});

// ===========================================================================================================
// #104 · O INVARIANTE QUE SEGURA A MIGRAÇÃO ENQUANTO OS DOIS CAMPOS EXISTEM
// ===========================================================================================================
//
// ⚠️ ISTO É ANDAIME, E TEM DATA PARA SAIR. A #104 troca `p.viz` (uma string) por `p.visual` (dois eixos mais a
// simulação), e fazê-lo de uma vez deixaria a árvore vermelha por dezenas de erros sem nenhum ponto verde
// onde parar. Então os dois campos coexistem: `setPlayerViz` escreve os DOIS, os leitores migram um a um, e
// este caso é o que garante que eles não podem divergir pelo caminho.
//
// ⚠️ E O ESPELHO TEM UM LIMITE CONHECIDO, que é a razão de ele não poder ficar: `viz` guarda UM valor, então
// não há chave que descreva «hc7 + fix-deuter». Enquanto os controles escrevem um valor de cada vez, o
// espelho acompanha; assim que eles passarem a escrever por EIXO (etapas 4 e 5), ele deixa de conseguir, e é
// aí que ele sai — junto com este bloco.
describe('#104 · `viz` e `visual` não podem discordar enquanto os dois existirem', () => {
  it('⚠️ [Right] toda escrita por `setPlayerViz` deixa os dois campos a dizer a MESMA coisa', async () => {
    const { migrateVisual, howItApplies } = await import('../app/js/render/viz-axes.js');
    const { VIZ_FILTER, needsCanvas } = await import('../app/js/render/viz-modes.js');
    // Os modos DIRETOS ficam de fora aqui porque repintam textura e exigem canvas — o
    // `viz-setters.browser.test.js` é quem os cobre. O que se afirma é o espelho, e ele não depende disso.
    for (const k of ['normal', 'fix-protan', 'fix-deuter', 'fix-tritan', 'sim-deuter', 'sim-protan',
      'sim-tritan', 'lv-blur', 'lv-haze', 'lv-tunnel', 'lv-macular', 'lv-diabetic', 'blind']) {
      const { env, api } = setup({ players: [{ viz: 'normal' }], numPlayers: 1 });
      api.setPlayerViz(0, k);
      const p = env.players[0];
      expect(p.viz, k).toBe(k);
      expect(p.visual, `o espelho de «${k}» ficou para trás`).toEqual(migrateVisual(k));
      // E o par que o render vai aplicar continua a ser o de hoje — a mesma afirmação da rede da etapa 0,
      // agora sobre o valor que REALMENTE foi escrito no jogador e não sobre uma chave de fixture.
      expect(howItApplies(p.visual), k).toEqual({
        direto: needsCanvas(k) ? k : null,
        filtro: k in VIZ_FILTER ? k : null,
      });
    }
  });

  it('⚠️ [Zero] uma chave desconhecida cai em `normal` nos DOIS campos, e não num só', async () => {
    // `resolveViz` já mandava chave desconhecida para `normal`. Se o espelho não seguisse essa mesma queda,
    // o jogador ficaria com `viz: 'normal'` e um `visual` de outra coisa — a divergência mais difícil de ver,
    // porque os dois estão preenchidos e só um está certo.
    const { PADRAO } = await import('../app/js/render/viz-axes.js');
    const { env, api } = setup({ players: [{ viz: 'normal' }], numPlayers: 1 });
    api.setPlayerViz(0, 'modo-que-nao-existe');
    expect(env.players[0].viz).toBe('normal');
    expect(env.players[0].visual).toEqual(PADRAO);
  });
});

describe('#104 · o ajuste salvo ANTES da divisão restaura o mesmo estado visível', () => {
  // A caixa da definition of done que a issue chama de «the dangerous half». O que está em jogo é concreto:
  // toda criança que já jogou tem uma string na chave velha, e a primeira sessão depois da actualização ou
  // a lê, ou apaga o modo visual que ela escolheu.
  it('⚠️ [Right] só a chave VELHA presente: o ajuste dela sobrevive à actualização', async () => {
    const { readStoredVisual } = await import('../app/js/render/viz-setters.js');
    const { migrateVisual } = await import('../app/js/render/viz-axes.js');
    const { VIZ_CYCLE } = await import('../app/js/render/viz-modes.js');
    for (const k of VIZ_CYCLE) {
      mem.clear();
      mem.set('incl_viz_p0', k); // exactamente o que está no navegador dela hoje
      expect(readStoredVisual(0), `«${k}» perdeu-se na actualização`).toEqual(migrateVisual(k));
    }
  });

  it('⚠️ [Right] a chave NOVA vence a velha — é a única que sabe dizer DOIS eixos', () => {
    // E é o caso que prova que o recuo é recuo e não a fonte: um estado de dois eixos não tem string que o
    // descreva, então se a velha vencesse, `hc7 + fix-deuter` seria impossível de restaurar.
    mem.clear();
    mem.set('incl_viz_p0', 'normal');
    mem.set('incl_visual_p0', JSON.stringify({ tema: 'hc7', correcao: 'deuter', simulacao: null }));
    return import('../app/js/render/viz-setters.js').then(({ readStoredVisual }) => {
      expect(readStoredVisual(0)).toEqual({ tema: 'hc7', correcao: 'deuter', simulacao: null });
    });
  });

  it('[Zero] nenhuma das duas: o padrão, e sem estourar', async () => {
    const { readStoredVisual } = await import('../app/js/render/viz-setters.js');
    const { PADRAO } = await import('../app/js/render/viz-axes.js');
    mem.clear();
    expect(readStoredVisual(0)).toEqual(PADRAO);
  });

  it('⚠️ [Zero] JSON corrompido na chave nova cai na VELHA em vez de no padrão', async () => {
    // O dado vem do navegador de uma criança e pode estar truncado. Cair no padrão aqui seria descartar o
    // ajuste que a chave velha ainda tem, guardado e íntegro, ao lado.
    const { readStoredVisual } = await import('../app/js/render/viz-setters.js');
    const { migrateVisual } = await import('../app/js/render/viz-axes.js');
    mem.clear();
    mem.set('incl_viz_p0', 'fix-deuter');
    mem.set('incl_visual_p0', '{"tema":"hc7"');  // truncado
    expect(readStoredVisual(0)).toEqual(migrateVisual('fix-deuter'));
  });

  it('⚠️ [Interface] `setPlayerViz` escreve as DUAS chaves, e o que ele escreve volta igual', async () => {
    const { readStoredVisual } = await import('../app/js/render/viz-setters.js');
    for (const k of ['fix-deuter', 'lv-tunnel', 'blind', 'normal']) {
      mem.clear();
      const { api } = setup({ players: [{ viz: 'normal' }], numPlayers: 1 });
      api.setPlayerViz(0, k);
      expect(mem.get('incl_viz_p0'), `a chave legada de «${k}» não foi escrita`).toBe(k);
      expect(mem.get('incl_visual_p0'), `a chave nova de «${k}» não foi escrita`).toBeTruthy();
      expect(readStoredVisual(0), `«${k}» não sobreviveu à ida e volta pelo armazenamento`)
        .toEqual(JSON.parse(mem.get('incl_visual_p0')));
    }
  });
});

// ========================= MUTACOES CONFERIDAS (o espelho da #104) =========================
//   · apagando a escrita `p.visual = migrateVisual(m.key)` -> reprovam os DOIS casos. E o defeito que o bloco
//     existe para impedir: os leitores migrariam um a um para um campo que ninguem mantem, e o primeiro a
//     migrar passaria a ler o padrao para toda a gente — sem erro, sem aviso, com a arvore verde.
//   · ⚠️ trocando `migrateVisual(m.key)` por `migrateVisual(mode)` -> NAO reprova, e a mutacao e' EQUIVALENTE,
//     nao um buraco. `resolveViz` manda chave desconhecida para `normal` e `migrateVisual` manda-a para
//     `PADRAO`, que sao o mesmo estado; para chave conhecida `m.key === mode`. Nao ha entrada que as separe.
//     Fica `m.key` na mesma, porque a linha acima ja resolveu e ler duas vezes da mesma resolucao e' o que
//     impede a terceira de divergir. Registado aqui em vez de apagado: uma mutacao sobrevivente que se
//     confirma equivalente e' informacao, e a proxima pessoa nao precisa de a redescobrir.
//
// ========================= MUTACOES CONFERIDAS (a migracao do valor salvo, 1b) =========================
//   · ⚠️ TIRANDO O RECUO para a chave velha (`return PADRAO`) -> reprovam TRES. E o estrago que a issue chama
//     de «the dangerous half»: a primeira sessao depois da actualizacao apagaria o modo visual de TODA
//     crianca que ja jogou, porque o ajuste dela vive na chave velha e mais lado nenhum.
//   · fazendo a chave VELHA vencer a nova -> reprova o caso dos dois eixos. Nao ha string que descreva
//     «hc7 + fix-deuter», entao com a ordem invertida esse estado seria impossivel de restaurar — a nova
//     tem de vencer justamente porque e' a unica que sabe dizer duas coisas.
//   · deixando de escrever a chave LEGADA -> reprovam TRES, e DOIS deles sao casos ANTIGOS. E a medida de que
//     ela ainda carrega comportamento: um leitor da versao publicada faz `if (v && VIZ_BY_KEY[v])` e
//     recusaria JSON, entao parar de a escrever apagaria o ajuste da crianca em silencio.
//   · deixando de escrever a chave NOVA -> reprova a ida e volta. Os dois eixos nao teriam onde ficar.
