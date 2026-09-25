// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of render/viz-setters — applying the accessible vision modes per player and globally.
// NODE project: the PURE logic (mode resolution, CSS filter, dot, radio-group HTML) + the shells with PIXI/DOM FAKED
// through a structural interface (the same precedent as gamepad.node). What needs a real canvas — the three Direct
// Rendering levels (kind 'hcnew') — is in .browser.test.js; the modes used here are all NON-direct, which is the detour
// that does not touch a canvas.
// ZOMBIES + Right-BICEP. (setPlayerViz/applyVizGlobal/reapplyVizAll/applySharedTextures/applyVpFilters/updateVpDots/
// _rebakeDirect/updateVizIndicator/renderVizGroup.)
import { describe, it, expect, beforeEach } from 'vitest';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t;
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';
import { KEYS } from '../app/js/platform/storage-keys.js';
import { createSettingsStore } from '../app/js/core/state.js';
import { t } from '../app/js/core/i18n.js';
import { migrateVisual } from '../app/js/render/viz-axes.js'; // VIZ_MODES holds KEYS (item 14)

// ONE backend for this file, over a Map the cases read (ADR-0232): the viz setters write through the store their ctx
// receives, and this file's settings store (the global mode) through the port it is built with — both are this Map. Without a backend
// every write would be refused in silence, and the persistence cases could not fail.
const mem = new Map();
const shared = createStorage({
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: (k) => { mem.delete(k); },
});
const memGet = (k) => (mem.has(k) ? mem.get(k) : null);
const { setVizModeValue } = createSettingsStore({ ...shared, KEYS });

const { VIZ_MODES, VIZ_BY_KEY } = await import('../app/js/render/viz-modes.js');
const { createHighContrast } = await import('../app/js/render/high-contrast.js');

const {
  initVizSetters, resolveViz, isDirectMode, cssFilterFor, vizDotFor, vizIndicatorFor,
  lvOverlayClassFor, vizGroupHtml, vizGroupSay, reachOfMode,
} = await import('../app/js/render/viz-setters.js');

// The world's high contrast (ADR-0232 D4: an instance the ctx receives as `hc`). In NON-direct modes worldTexFor/spriteTexFor
// return the normal texture without touching a canvas — which is exactly the detour exercised here.
const hc = createHighContrast({ doc: { createElement: () => { throw new Error('no canvas in the node project'); } },
  store: createStorage(memoryBackend()),
  W: 1, H: 1, outlineFg: () => 0, outlineBg: () => 0,
  getWorldCanvasNormal: () => null, getWorldTexNormal: () => 'TEX_WORLD_NORMAL',
  // The high-contrast sprite registry is keyed by ID, and the id here is the same the ctx declares (`itemTexId: 'alvo'`)
  // — it is the pair that makes the recolouring find the texture. Neither says "moeda".
  sprites: () => ({ alvo: { canvas: null, tex: 'TEX_ITEM_NORMAL' } }),
});

/* ===================== fakes: DOM and PIXI through a structural interface ===================== */

function fakeBtn(key, val) {
  const listeners = {};
  return {
    dataset: { [key]: val },
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    click: () => (listeners.click || []).forEach((f) => f()),
  };
}

// A fake DOM element. querySelectorAll('button[data-x]') does NOT return a prefabricated list: it scans the current
// innerHTML for data-x="…", as the real DOM would — that is what lets the test see that an earlier `innerHTML=''` erases
// the buttons the selector would look for.
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
  // ⚠️ THE FIXTURE DERIVES `visual` FROM `viz`, the SAME mirror rule `setPlayerViz` keeps in production (#104). So the
  // cases keep declaring the mode by its name — which is how they speak. When `viz` leaves for good, it leaves from this
  // line and the cases declare `visual` directly.
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
    lq: over.lq === undefined ? '' : over.lq,
    log: {
      frontDim: [], blindMode: [], hideTouch: [], say: [], selWrites: [],
      rebuildExtras: 0, rebuildCoins: 0, reflect: 0, visual: 0, empathy: 0, filtrosCss: [], hcNoDom: [],
      clearPlayerDirect: 0, invalidate: 0, sharedWrites: [],
    },
  };
  const ctx = {
    store: shared,
      t: translate, // the root's translator, played by the test (ADR-0232 D3)
    $: (sel) => env.els[sel] || null,
    body: { classes: new Set(), classList: null },
    srSay: (s) => env.log.say.push(s),
    // The module asks for the VERB, not the `app`: PixiJS's `view.style` is `ICanvasStyle`, which does not even have
    // `filter`. What knows that in production the `view` is a DOM canvas is the composition root — and that is where the
    // "and if there is no canvas mounted" guard lives. This fake imitates the root.
    // High contrast in the DOM (issue #83): it is not a filter, it is a class — the fake only records the on/off.
    applyHighContrastToDom: (ligado) => { env.log.hcNoDom.push(ligado); },
    applyCssFilter: (css) => { env.log.filtrosCss.push(css); if (env.app && env.app.view) env.app.view.style.filter = css; },
    camera: env.camera,
    worldSprite: env.worldSprite,
    parallaxLayers: env.parallaxLayers,
    decoSprites: env.decoSprites,
    getVpSpr: () => env.vpSpr,
    getVpDots: () => env.vpDots,
    // THE ITEMS, and their NAME, come in through the ctx (item 19). The fixture uses 'alvo' on purpose: if it said 'coin',
    // the test would reassert out of habit what the cut took out of the module — and the fixtures gate would accuse it,
    // rightly.
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
    // 🔴 THE TWO PORTS ADR-0228 OPENED: a power-up's texture came from `render/textures`, which left for the cartridge. The
    // RULE is still the engine's — changing visual mode repaints what is on screen — and it does not need to know what a
    // power-up is, which is exactly what a port buys.
    pupTexFor: (kind, mode) => ({ kind, mode }),
    resetPupTexCache: () => { env.log.resetPupTex = (env.log.resetPupTex ?? 0) + 1; },
    setFrontDim: (on) => env.log.frontDim.push(on),
    rebuildExtras: () => { env.log.rebuildExtras++; },
    rebuildCoins: () => { env.log.rebuildCoins++; },
    setBlindMode: (on) => env.log.blindMode.push(on),
    // the test plays the root: the legacy mirror goes to the real settings store, loaded over this file's Map
    setVizMode: setVizModeValue,
    hideTouchControls: (r) => env.log.hideTouch.push(r),
    reflectVizButtons: () => { env.log.reflect++; },
    renderVisualPanel: () => { env.log.visual++; },
    renderEmpathyPanel: () => { env.log.empathy++; },
    // the world's high contrast and the root's L→Q enhancement, both handed in (ADR-0232 D4)
    hc: over.hc || hc,
    lqFilter: () => env.lq,
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
    const html = vizGroupHtml(translate, VIZ_MODES, 'lv-haze');
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).toContain('data-viz="lv-haze" type="button">✓ Selecionado');
  });
  it('[Right] os não selecionados ficam com aria-checked=false e sem a classe is-on', () => {
    const html = vizGroupHtml(translate, [VIZ_BY_KEY.normal, VIZ_BY_KEY.blind], 'blind');
    expect(html).toContain('<button class="mode-btn" role="radio" aria-checked="false" data-viz="normal"');
    expect(html).toContain('<button class="mode-btn is-on" role="radio" aria-checked="true" data-viz="blind"');
  });
  it('[Many] uma linha por modo — nem a mais nem a menos', () => {
    expect(vizGroupHtml(translate, VIZ_MODES, 'normal').match(/class="ctrl-row"/g)).toHaveLength(VIZ_MODES.length);
  });
  it('[Zero] lista vazia gera string vazia', () => {
    expect(vizGroupHtml(translate, [], 'normal')).toBe('');
  });
  it('[Error] modo atual FORA da lista exibida → nenhum marcado (o painel não inventa seleção)', () => {
    const html = vizGroupHtml(translate, [VIZ_BY_KEY.normal, VIZ_BY_KEY.blind], 'lv-blur');
    expect(html).not.toContain('aria-checked="true"');
  });
  it('[Right] nome e descrição de cada modo entram na linha (é o que o leitor de tela lê)', () => {
    const html = vizGroupHtml(translate, [VIZ_BY_KEY.blind], 'normal');
    // `nome`/`desc` hold KEYS (item 14); the row has to carry the TEXT. Comparing with the raw key would pass accepting
    // `viz.blind` on screen — which is key-based i18n's silent way of failing.
    expect(html).toContain(t(VIZ_BY_KEY.blind.name));
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
    expect(env.vpDots[1].rec.fills).toEqual([]); // switched off does NOT redraw
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
    env.vpSpr = [filtered()]; // <- it is what configureRender does when the number of screens changes
    // ⚠️ WRITES BOTH, as `setPlayerViz` does (#104). Writing only `env.players[0].viz` is something nobody does in
    // production — whoever changes the mode goes through the setter, and the setter keeps the mirror. A test that goes
    // around the API ends up measuring a state the program never produces.
    env.players[0].viz = 'lv-haze';
    env.players[0].visual = migrateVisual('lv-haze');
    api.applyVpFilters();
    expect(env.vpSpr[0].filters).toBe('FILTER:lv-haze');
    expect(antigo.filters).toBe('FILTER:blind'); // the old array is no longer touched
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
    expect(env.parallaxLayers[0].texture).toBe('MARCA'); // static NOT redone
    expect(env.players[0].sprite.texture).toBe('PLAYER:TX0:blind'); // jogador FOI
    expect(env.log.frontDim).toEqual([false]); // only the first time
  });
  it('[Inverse] invalidar o registro força a reaplicação do mesmo modo', () => {
    const { env, api } = cena();
    api.applySharedTextures('blind');
    env.parallaxLayers[0].texture = 'MARCA';
    env.sharedViz = null; // <- what rebuildCoins/rebuildExtras/setPlayerViz do
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
    expect(memGet('incl_viz')).toBe('normal');
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
    expect(env.log.hideTouch).toEqual([]); // normal does not hide touch
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
  // The module always calls the verb; guarding against a missing canvas is the root's job. What is left to prove here is
  // exactly that: with no canvas mounted, the filter is still ASKED for (the root discards it) and the rest of the mode
  // applies.
  //
  // MUTATION CHECKED: putting `if (env.app && env.app.view)` back around the call inside the module, `filtrosCss` stays
  // empty and the case fails with "expected [] to have a length of 1".
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
    expect(env.vpSpr[0].filters).toBe('INTOCADO');              // the per-viewport path did not run
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
    expect(env.bodyClasses.size).toBe(0);                       // no global class at all
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
    expect(memGet('incl_viz_p1')).toBe('blind');
    expect(memGet('incl_viz_p0')).toBeNull();
    expect(memGet('incl_viz_p2')).toBeNull();
    expect(env.vpSpr.map((s) => s.filters)).toEqual(['FILTER:sim-protan', 'FILTER:blind', 'FILTER:lv-blur']);
  });
  it('[Error] modo desconhecido grava `normal` no jogador e na persistência', () => {
    const { env, api } = setup({ players: [{ viz: 'blind' }], numPlayers: 1 });
    api.setPlayerViz(0, 'chute');
    expect(env.players[0].viz).toBe('normal');
    expect(memGet('incl_viz_p0')).toBe('normal');
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
    expect(memGet('incl_viz')).toBe('lv-tunnel');
  });
  it('[Right] MULTI-TELA: DESLIGA filtro/overlay/bolinha globais e liga os por viewport', () => {
    const { env, api } = setup({ players: [{ viz: 'blind' }, { viz: 'lv-haze' }], numPlayers: 2, vpSpr: [filtered(), filtered()] });
    env.bodyClasses.add('blind-mode'); env.bodyClasses.add('lowvision-mode');
    env.els['#viz-overlay'].hidden = false;
    env.els['#viz-indicator'].hidden = false;
    api.reapplyVizAll();
    expect(env.app.view.style.filter).toBe('');            // only the L→Q enhancement, which is at 0
    expect(env.camera.filters).toBeNull();
    expect(env.bodyClasses.size).toBe(0);
    expect(env.els['#viz-overlay'].hidden).toBe(true);
    expect(env.els['#viz-indicator'].hidden).toBe(true);   // updateVizIndicator('normal')
    expect(env.vpSpr.map((s) => s.filters)).toEqual(['FILTER:blind', 'FILTER:lv-haze']);
    expect(memGet('incl_viz')).toBeNull();   // MP does not write the global mode
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
  it('🔴 [Right] the caches it clears are the INJECTED world\'s high contrast (ADR-0232 D4), world and sprites both', () => {
    const cleared = [];
    const spyHc = { ...hc,
      clearWorldTexCache: () => { cleared.push('world'); },
      clearSpriteTexCache: (id) => { cleared.push(id === undefined ? 'sprites' : 'sprite:' + id); } };
    const { api } = setup({ players: [{ viz: 'normal' }], numPlayers: 1, hc: spyHc });
    api.rebakeDirect();
    expect(cleared).toEqual(['world', 'sprites']);
  });
});

describe('the world texture comes from the INJECTED high contrast (ADR-0232 D4)', () => {
  it('🔴 [Right] SOLO: the world sprite gets the texture the ctx\'s `hc` answers for the theme', () => {
    const own = { ...hc, worldTexFor: (m) => 'WORLD:' + m };
    const { env, api } = setup({ players: [{ viz: 'normal' }], numPlayers: 1, hc: own });
    api.reapplyVizAll();
    expect(env.worldSprite.texture, 'the world texture did not come from the injected instance').toBe('WORLD:normal');
  });
});

describe('the L→Q enhancement comes from the ctx (ADR-0232 D4)', () => {
  // The fragment used to be read from `render/lq-filter`'s module amount, one per page; now it is the root's instance,
  // handed in as `lqFilter`. These cases give it a value and see it composed on both paths.
  it('🔴 [Right] SOLO: composed after the colour filter', () => {
    const { env, api } = setup({ players: [{ viz: 'sim-deuter' }], numPlayers: 1, lq: 'url(#lq-enh)' });
    api.reapplyVizAll();
    expect(env.app.view.style.filter).toBe('url(#cvd-deuter) url(#lq-enh)');
  });
  it('🔴 [Right] MULTI-SCREEN: the enhancement alone reaches the canvas and the menus', () => {
    const { env, api } = setup({ players: [{ viz: 'blind' }, { viz: 'normal' }], numPlayers: 2, vpSpr: [filtered(), filtered()], lq: 'url(#lq-enh)' });
    api.reapplyVizAll();
    expect(env.app.view.style.filter).toBe('url(#lq-enh)');
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
    expect(env.els['#abas'].lastQuery).toHaveLength(0); // the innerHTML='' erased what the selector would look for
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
// HOW FAR THE FILTER REACHES — the Dev's decision, 2026-08-26, issue #82.
//
// The frame is half canvas and half DOM, and a PIXI filter does not reach the DOM. A filter falling ONLY on the canvas
// gives the colour-blind child the GAME corrected and the MENUS raw — and the menu is where the words are, including those
// of the accessibility settings themselves.
//
// The rule that fixes it is NOT "filter everything", and the difference is one of accessibility:
//
//   · IMPROVEMENT (normal, hc-direto*, fix-*) exists for the child to SEE BETTER → it reaches the menus.
//   · EMPATHY (sim-*, lv-*, blind) exists for an adult to FEEL what it is like → it stays in the world. The menu is the
//     instrument to LEAVE the simulation; a blindness that blanked the pause menu would lock the child inside it.
//
// And the catalogue already knew this before the rule was written: `sim: true` marks exactly the nine empathy modes.
// Deriving from there, and not from a second list, is what stops the two from drifting apart.
//
// MUTATION CHECKED: inverting the `?` of `reachOfMode`, the [Right] fails on "normal" —
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
    // The case that stops the rule from ageing: a new mode enters VIZ_MODES and falls into one of the two, or this case
    // fails. Without it, the new mode would inherit a reach by accident.
    expect([...MELHORIAS, ...EMPATIA].sort()).toEqual(VIZ_MODES.map((m) => m.key).sort());
  });

  it('[Boundary] modo desconhecido cai em MELHORIA — e isso está declarado, não por acaso', () => {
    // `simulatesDisability` returns `false` for a non-existent key, so the unknown reaches the menu. It is the safe side: a
    // mode nobody declared must not be able to LEAVE the menu without correction. Pinned here so the choice is deliberate
    // if someone inverts it.
    expect(reachOfMode('inventado')).toBe('mundo-e-menus');
  });
});

// ---------------------------------------------------------------------------------------------------------
// HIGH CONTRAST IN THE DOM (issue #83). It is NOT a filter: it is Direct Rendering, and it repaints the canvas's textures.
// The DOM has no texture, so the fix of #82 — propagating the filter — did not reach it. What crosses is a CLASS, and the
// drawing (opaque veil, inverted cursor) lives in `style.css`, with the reasons measured in
// `tests/menu-contrast-measured.node.test.js`.
//
// MUTATION CHECKED: replacing `m.kind === 'hcnew'` with `false` in `applyVizGlobal`, the [Right] fails with
// "expected [] to deeply equal [ true ]".
// ⚠️ The cases that TURN high contrast on live in `viz-setters.browser.test.js`, not here: the `hcnew` path calls
// `worldTexFor`, which needs a real canvas to repaint. The same reason the Direct Rendering detour was already tested
// there. Here is the side that does not touch a canvas.
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
// #104 · THE INVARIANT THAT HOLDS THE TWO FIELDS TOGETHER
// ===========================================================================================================
//
// `p.visual` (two axes plus the simulation) is the state; `p.viz` is a LEGACY mirror of it, derived by `legacyKey` and
// written for readers of the published version. Every write goes through `writePlayerVisual`, and these cases pin that
// writing through `setPlayerViz` leaves the two fields saying the same thing.
//
// ⚠️ AND THE MIRROR HAS A KNOWN LIMIT: `viz` keeps ONE value, so no key describes «hc7 + fix-deuter»; for that state
// `legacyKey` keeps the theme (see `viz-migration-keeps-each-mode.node.test.js`). Readers that need both axes read `visual`.
describe('#104 · `viz` e `visual` não podem discordar enquanto os dois existirem', () => {
  it('⚠️ [Right] toda escrita por `setPlayerViz` deixa os dois campos a dizer a MESMA coisa', async () => {
    const { migrateVisual, howItApplies } = await import('../app/js/render/viz-axes.js');
    const { VIZ_FILTER, needsCanvas } = await import('../app/js/render/viz-modes.js');
    // The DIRECT modes are left out here because they repaint textures and need a canvas — `viz-setters.browser.test.js`
    // covers them. What is asserted is the mirror, and it does not depend on that.
    for (const k of ['normal', 'fix-protan', 'fix-deuter', 'fix-tritan', 'sim-deuter', 'sim-protan',
      'sim-tritan', 'lv-blur', 'lv-haze', 'lv-tunnel', 'lv-macular', 'lv-diabetic', 'blind']) {
      const { env, api } = setup({ players: [{ viz: 'normal' }], numPlayers: 1 });
      api.setPlayerViz(0, k);
      const p = env.players[0];
      expect(p.viz, k).toBe(k);
      expect(p.visual, `o espelho de «${k}» ficou para trás`).toEqual(migrateVisual(k));
      // And the pair the render will apply is still the same — the same claim as the step-0 net, now about the value
      // REALLY written to the player and not about a fixture key.
      expect(howItApplies(p.visual), k).toEqual({
        direct: needsCanvas(k) ? k : null,
        filter: k in VIZ_FILTER ? k : null,
      });
    }
  });

  it('⚠️ [Zero] uma chave desconhecida cai em `normal` nos DOIS campos, e não num só', async () => {
    // `resolveViz` sends an unknown key to `normal`. If the mirror did not follow that same fall, the player would end up
    // with `viz: 'normal'` and a `visual` of something else — the hardest divergence to see, because both are filled in
    // and only one is right.
    const { DEFAULT_VISUAL } = await import('../app/js/render/viz-axes.js');
    const { env, api } = setup({ players: [{ viz: 'normal' }], numPlayers: 1 });
    api.setPlayerViz(0, 'modo-que-nao-existe');
    expect(env.players[0].viz).toBe('normal');
    expect(env.players[0].visual).toEqual(DEFAULT_VISUAL);
  });
});

describe('#104 · o ajuste salvo ANTES da divisão restaura o mesmo estado visível', () => {
  // The box of the definition of done the issue calls «the dangerous half». What is at stake is concrete: every child who
  // has already played has a string in the old key, and the first session after the update either reads it or erases the
  // visual mode she chose.
  it('⚠️ [Right] só a chave VELHA presente: o ajuste dela sobrevive à actualização', async () => {
    const { readStoredVisual } = await import('../app/js/render/viz-setters.js');
    const { migrateVisual } = await import('../app/js/render/viz-axes.js');
    const { VIZ_CYCLE } = await import('../app/js/render/viz-modes.js');
    for (const k of VIZ_CYCLE) {
      mem.clear();
      mem.set('incl_viz_p0', k); // exactly what is in her browser from before the split
      expect(readStoredVisual(shared, 0), `«${k}» perdeu-se na actualização`).toEqual(migrateVisual(k));
    }
  });

  it('⚠️ [Right] a chave NOVA vence a velha — é a única que sabe dizer DOIS eixos', () => {
    // And it is the case proving the fallback is a fallback and not the source: a two-axis state has no string to describe
    // it, so if the old one won, `hc7 + fix-deuter` would be impossible to restore.
    mem.clear();
    mem.set('incl_viz_p0', 'normal');
    mem.set('incl_visual_p0', JSON.stringify({ tema: 'hc7', correcao: 'deuter', simulacao: null }));
    return import('../app/js/render/viz-setters.js').then(({ readStoredVisual }) => {
      expect(readStoredVisual(shared, 0)).toEqual({ tema: 'hc7', correcao: 'deuter', simulacao: null });
    });
  });

  it('[Zero] nenhuma das duas: o padrão, e sem estourar', async () => {
    const { readStoredVisual } = await import('../app/js/render/viz-setters.js');
    const { DEFAULT_VISUAL } = await import('../app/js/render/viz-axes.js');
    mem.clear();
    expect(readStoredVisual(shared, 0)).toEqual(DEFAULT_VISUAL);
  });

  it('⚠️ [Zero] JSON corrompido na chave nova cai na VELHA em vez de no padrão', async () => {
    // The data comes from a child's browser and may be truncated. Falling to the default here would throw away the setting
    // the old key still has, stored and intact, beside it.
    const { readStoredVisual } = await import('../app/js/render/viz-setters.js');
    const { migrateVisual } = await import('../app/js/render/viz-axes.js');
    mem.clear();
    mem.set('incl_viz_p0', 'fix-deuter');
    mem.set('incl_visual_p0', '{"tema":"hc7"');  // truncado
    expect(readStoredVisual(shared, 0)).toEqual(migrateVisual('fix-deuter'));
  });

  it('⚠️ [Interface] `setPlayerViz` escreve as DUAS chaves, e o que ele escreve volta igual', async () => {
    const { readStoredVisual } = await import('../app/js/render/viz-setters.js');
    for (const k of ['fix-deuter', 'lv-tunnel', 'blind', 'normal']) {
      mem.clear();
      const { api } = setup({ players: [{ viz: 'normal' }], numPlayers: 1 });
      api.setPlayerViz(0, k);
      expect(mem.get('incl_viz_p0'), `a chave legada de «${k}» não foi escrita`).toBe(k);
      expect(mem.get('incl_visual_p0'), `a chave nova de «${k}» não foi escrita`).toBeTruthy();
      expect(readStoredVisual(shared, 0), `«${k}» não sobreviveu à ida e volta pelo armazenamento`)
        .toEqual(JSON.parse(mem.get('incl_visual_p0')));
    }
  });
});

// ========================= MUTATIONS CHECKED (#104's mirror) =========================
//   · deleting the `p.visual = migrateVisual(m.key)` write -> BOTH cases fail. It is the defect the block exists to
//     prevent: readers would migrate one by one to a field nobody maintains, and the first to migrate would start reading
//     the default for everyone — no error, no warning, with the tree green.
//   · ⚠️ replacing `migrateVisual(m.key)` with `migrateVisual(mode)` -> does NOT fail, and the mutation is EQUIVALENT, not a
//     hole. `resolveViz` sends an unknown key to `normal` and `migrateVisual` sends it to `DEFAULT_VISUAL`, which are the
//     same state; for a known key `m.key === mode`. No input separates them. `m.key` stays anyway, because the line above
//     has already resolved and reading twice from the same resolution is what stops a third from diverging. Recorded here
//     instead of deleted: a surviving mutation confirmed equivalent is information, and the next person need not
//     rediscover it.
//
// ========================= MUTATIONS CHECKED (the saved value's migration, 1b) =========================
//   · ⚠️ REMOVING THE FALLBACK to the old key (`return DEFAULT_VISUAL`) -> THREE fail. It is the damage the issue calls «the
//     dangerous half»: the first session after the update would erase the visual mode of EVERY child who has already
//     played, because her setting lives in the old key and nowhere else.
//   · making the OLD key beat the new one -> fails the two-axes case. No string describes «hc7 + fix-deuter», so with the
//     order inverted that state would be impossible to restore — the new one has to win precisely because it is the only
//     one that can say two things.
//   · no longer writing the LEGACY key -> THREE fail, and TWO of them are OLD cases. It is the measure that it still
//     carries behaviour: a reader of the published version does `if (v && VIZ_BY_KEY[v])` and would refuse JSON, so
//     stopping writing it would erase the child's setting in silence.
//   · no longer writing the NEW key -> fails the round trip. The two axes would have nowhere to live.
