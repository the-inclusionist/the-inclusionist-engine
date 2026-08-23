// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de render/viz-setters — aplicação dos modos de visão acessível por jogador e globalmente.
// project NODE: a lógica PURA (resolução de modo, filtro CSS, bolinha, HTML do grupo de rádios) + as cascas
// com PIXI/DOM FALSIFICADOS por interface estrutural (mesmo precedente de traffic.node/gamepad.node).
// O que exige canvas de verdade — os três níveis de Renderização Direta (kind 'hcnew') — está no
// .browser.test.js; aqui os modos usados são todos NÃO-diretos, que é o desvio que não toca canvas.
// ZOMBIES + Right-BICEP. Comportamento verbatim do game.js (setPlayerViz/applyVizGlobal/reapplyVizAll/
// applySharedTextures/applyVpFilters/updateVpDots/_rebakeDirect/updateVizIndicator/renderVizGroup).
import { describe, it, expect, beforeEach } from 'vitest';

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
  lvOverlayClassFor, vizGroupHtml, vizGroupSay,
} = await import('../app/js/render/viz-setters.js');

// worldTexFor/coinTexFor exigem o ctx do high-contrast. Nos modos NÃO-diretos elas devolvem a textura normal
// sem tocar em canvas — é exatamente o desvio exercitado aqui.
initHighContrast({
  W: 1, H: 1, outlineFg: () => 0, outlineBg: () => 0,
  getWorldCanvasNormal: () => null, getWorldTexNormal: () => 'TEX_WORLD_NORMAL',
  coinCanvasNormal: null, coinTexNormal: 'TEX_COIN_NORMAL',
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
  const players = over.players || [{ viz: 'normal', sprite: null, _tx: null }];
  const env = {
    players,
    numPlayers: over.numPlayers === undefined ? players.length : over.numPlayers,
    sharedViz: over.sharedViz === undefined ? null : over.sharedViz,
    hcMode: null, sel: over.sel === undefined ? 0 : over.sel,
    els: Object.assign({ '#viz-overlay': fakeEl(), '#viz-indicator': fakeEl() }, over.els || {}),
    app: over.app === undefined ? { view: { style: { filter: 'ANTES' } } } : over.app,
    camera: filtered(),
    worldSprite: texd(),
    parallaxLayers: [texd(), texd(), texd()],
    decoSprites: [texd()],
    coinSprites: over.coinSprites || [],
    powerups: over.powerups || [],
    vpSpr: over.vpSpr || [],
    vpDots: over.vpDots || [],
    log: {
      frontDim: [], modoCego: [], hideTouch: [], say: [], selWrites: [],
      rebuildExtras: 0, rebuildCoins: 0, reflect: 0, visual: 0, empathy: 0,
      clearPlayerDirect: 0, invalidate: 0, sharedWrites: [],
    },
  };
  const ctx = {
    $: (sel) => env.els[sel] || null,
    body: { classes: new Set(), classList: null },
    srSay: (s) => env.log.say.push(s),
    app: env.app,
    camera: env.camera,
    worldSprite: env.worldSprite,
    parallaxLayers: env.parallaxLayers,
    decoSprites: env.decoSprites,
    getVpSpr: () => env.vpSpr,
    getVpDots: () => env.vpDots,
    getCoinSprites: () => env.coinSprites,
    getPowerups: () => env.powerups,
    getPlayers: () => env.players,
    getNumPlayers: () => env.numPlayers,
    getSelVizPlayer: () => env.sel,
    setSelVizPlayer: (i) => { env.sel = i; env.log.selWrites.push(i); },
    getSharedViz: () => env.sharedViz,
    setSharedViz: (m) => { env.sharedViz = m; env.log.sharedWrites.push(m); },
    invalidateSharedViz: () => { env.sharedViz = null; env.log.invalidate++; },
    setHcMode: (on) => { env.hcMode = on; },
    parallaxTexFor: (i, mode) => 'PX:' + i + ':' + mode,
    treeTexFor: (mode) => 'TREE:' + mode,
    playerVizTex: (base, mode) => 'PLAYER:' + base + ':' + mode,
    pixiFilterFor: (mode) => 'FILTER:' + mode,
    clearPlayerDirectCache: () => { env.log.clearPlayerDirect++; },
    setFrontDim: (on) => env.log.frontDim.push(on),
    rebuildExtras: () => { env.log.rebuildExtras++; },
    rebuildCoins: () => { env.log.rebuildCoins++; },
    setModoCego: (on) => env.log.modoCego.push(on),
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
    expect(html).toContain(VIZ_BY_KEY.blind.nome);
    expect(html).toContain(VIZ_BY_KEY.blind.desc);
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
    env.players[0].viz = 'lv-haze';
    api.applyVpFilters();
    expect(env.vpSpr[0].filters).toBe('FILTER:lv-haze');
    expect(antigo.filters).toBe('FILTER:blind'); // o array velho não é mais tocado
  });
});

describe('applySharedTextures — texturas estáticas do multiplayer (memo por modo)', () => {
  const cena = () => setup({
    players: [{ viz: 'normal', sprite: texd(), _tx: 'TX0' }, { viz: 'normal', sprite: texd(), _tx: 'TX1' }],
    coinSprites: [texd(), null, texd()],
  });

  it('[Right] primeira aplicação troca mundo, parallax, decoração e moedas', () => {
    const { env, api } = cena();
    api.applySharedTextures('sim-deuter');
    expect(env.worldSprite.texture).toBe('TEX_WORLD_NORMAL');
    expect(env.parallaxLayers.map((l) => l.texture)).toEqual(['PX:0:sim-deuter', 'PX:1:sim-deuter', 'PX:2:sim-deuter']);
    expect(env.decoSprites[0].texture).toBe('TREE:sim-deuter');
    expect(env.coinSprites[0].texture).toBe('TEX_COIN_NORMAL');
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
  it('[Null] buraco no array de moedas é pulado', () => {
    const { api } = setup({ coinSprites: [null, null] });
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
    api.applyVizGlobal('sim-tritan');
    expect(env.app.view.style.filter).toBe('url(#cvd-tritan)');
  });
  it('[Error] modo desconhecido cai em normal — e é o `normal` que persiste/aplica', () => {
    const { env, api } = setup();
    api.applyVizGlobal('inexistente');
    expect(env.app.view.style.filter).toBe('');
    expect(localStorage.getItem('incl_viz')).toBe('normal');
    expect(env.hcMode).toBe(false);
  });
  it('[Right] baixa visão: classe no body + overlay visível com a classe da variante', () => {
    const { env, api } = setup();
    api.applyVizGlobal('lv-tunnel');
    expect(env.bodyClasses.has('lowvision-mode')).toBe(true);
    expect(env.bodyClasses.has('blind-mode')).toBe(false);
    expect(env.els['#viz-overlay'].hidden).toBe(false);
    expect(env.els['#viz-overlay'].className).toBe('lv-tunnel');
    expect(env.els['#viz-indicator'].hidden).toBe(false);
  });
  it('[Right] cegueira: classe no body, overlay escondido e controles de toque ocultos com o motivo', () => {
    const { env, api } = setup();
    api.applyVizGlobal('blind');
    expect(env.bodyClasses.has('blind-mode')).toBe(true);
    expect(env.els['#viz-overlay'].hidden).toBe(true);
    expect(env.log.hideTouch).toEqual(['cegueira']);
  });
  it('[Inverse] voltar a normal desfaz classes, overlay e bolinha', () => {
    const { env, api } = setup();
    api.applyVizGlobal('lv-haze');
    api.applyVizGlobal('normal');
    expect(env.bodyClasses.size).toBe(0);
    expect(env.els['#viz-overlay'].hidden).toBe(true);
    expect(env.els['#viz-overlay'].className).toBe('');
    expect(env.els['#viz-indicator'].hidden).toBe(true);
    expect(env.log.hideTouch).toEqual([]); // normal não esconde o toque
  });
  it('[Zero] modo não-direto NÃO põe filtro na câmera nem escurece a frente', () => {
    const { env, api } = setup();
    api.applyVizGlobal('fix-deuter');
    expect(env.camera.filters).toBeNull();
    expect(env.log.frontDim).toEqual([false]);
  });
  it('[Right] refaz extras e moedas e repinta os painéis a cada aplicação', () => {
    const { env, api } = setup();
    api.applyVizGlobal('normal');
    expect(env.log.rebuildExtras).toBe(1);
    expect(env.log.rebuildCoins).toBe(1);
    expect(env.log.reflect).toBe(1);
    expect(env.log.visual).toBe(1);
    expect(env.log.empathy).toBe(1);
  });
  it('[Null] sem canvas montada (app.view nulo) não lança — o resto do modo ainda aplica', () => {
    const { env, api } = setup({ app: { view: null } });
    expect(() => api.applyVizGlobal('blind')).not.toThrow();
    expect(env.bodyClasses.has('blind-mode')).toBe(true);
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
    expect(env.log.modoCego).toEqual([true]);
  });
  it('[Inverse] sair da cegueira NÃO desliga o modo cego sozinho (só a entrada é automática)', () => {
    const { env, api } = setup({ players: [{ viz: 'blind' }], numPlayers: 1 });
    api.setPlayerViz(0, 'normal');
    expect(env.log.modoCego).toEqual([]);
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
