// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/activities-menu — lógica PURA (categoria, mapeamento do "Voltar", saneamento do armazenamento,
// travessia por setas, rótulos abreviados, builders de HTML) + a casca via initActivitiesMenu(ctx) no project
// NODE, com DOM FALSIFICADO por objetos simples (mesmo truque de tests/gamepad.node.test.js: ctx.$ devolve
// elementos fake). Contrato: nada de `document` fora do ctx; toda persistência por store.KEYS.
// ZOMBIES + Right-BICEP. Cobre em especial o pedido da tarefa: id de atividade inválido cai no padrão,
// `tabSel` corrompido não derruba o boot (e o que ele DE FATO aceita — que é mais do que deveria, ver o
// relatório da extração), e o "Voltar" de cada categoria leva ao menu certo.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import pt from '../app/js/i18n/pt.js';
import {
  QL_NAME, PM_BTNS, ALF_LEVEL, FNOT_LBL, FNOT_KEYS, TITLE_MENU_ORDER,
  activityCategory, modeForCategory, normalizeActivityId, cenBackMenuFor,
  sanitizeTabSel, sanitizeFracNot, fracNotOnCount, canToggleFracNot,
  clampPendingPlayers, nextTitleIndex, titleDescFor,
  activityBtnHtml, backBtnHtml, tabRowHtml, fracNotsHtml, tabMenuHtml, cenMenuHtml, alfMenuHtml, frMenuHtml,
  abbrParts, abbrText, attachAbbr,
  initActivitiesMenu,
} from '../app/js/ui/activities-menu.js';
import { DEFAULT_ACTIVITY_ID, listActivityIds, modeForActivity } from '../app/js/educational/activities-registry.js';
import { createRunState } from '../app/js/core/run-state.js';
// A RODADA é local a este arquivo desde 2026-08-26 (ADR-0038, Fase B): `players`/`numPlayers` deixaram de
// ser `let` de `core/state` e passaram a viver na instância que a raiz de composição possui. Aqui o teste
// cria a sua, e os apelidos abaixo mantêm o corpo dos casos escrito como sempre esteve.
const rodada = createRunState();
const players = rodada.players;
const setNumPlayersValue = (n) => rodada.setNumPlayers(n);

import { activity as ACTIVITY, setActivityValue } from '../app/js/game/state.js'; // GAME desde a Fase B (ADR-0038)
import * as store from '../app/js/platform/storage.js';

// ---------------------------------------------------------------------------------------------
// localStorage FALSO — platform/storage.ts é a única porta de persistência e engole exceções, então
// sem isto todo getJSON devolveria o fallback e os testes de armazenamento corrompido não provariam nada.
// ---------------------------------------------------------------------------------------------
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: (k) => { mem.delete(k); },
  clear: () => mem.clear(),
};

// ---------------------------------------------------------------------------------------------
// DOM falso mínimo — só o que activities-menu.ts realmente usa.
// ---------------------------------------------------------------------------------------------
let ACTIVE = null; // "document.activeElement" do fake

function matchesOne(el, sel) {
  const s = sel.trim();
  const m = /^([a-z]*)(?:#([\w-]+))?((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/.exec(s);
  if (!m) return false;
  const [, tag, id, classes, attrs] = m;
  if (tag && el.tag !== tag) return false;
  if (id && el.id !== id) return false;
  for (const c of classes.split('.').filter(Boolean)) if (!el.classList.contains(c)) return false;
  for (const a of attrs.split(']').filter(Boolean)) {
    const name = a.replace('[', '');
    const camel = name.replace(/^data-/, '').replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    if (el.dataset[camel] == null) return false;
  }
  return true;
}
const matches = (el, sel) => sel.split(',').some((s) => matchesOne(el, s));

class FakeEl {
  constructor(tag, opt = {}) {
    this.tag = tag; this.id = opt.id || ''; this.dataset = { ...(opt.dataset || {}) };
    this._cls = new Set(opt.classes || []); this.children = []; this.parent = null;
    this.textContent = opt.text || ''; this.hidden = !!opt.hidden; this.innerHTML = '';
    this._ls = {}; this.attrs = {}; this.offsetWidth = 0; this.focusCount = 0; this.clickCount = 0;
    this.classList = {
      add: (c) => this._cls.add(c), remove: (c) => this._cls.delete(c), contains: (c) => this._cls.has(c),
      toggle: (c, on) => { const want = on === undefined ? !this._cls.has(c) : !!on; if (want) this._cls.add(c); else this._cls.delete(c); return want; },
    };
  }
  append(...els) { for (const e of els) { e.parent = this; this.children.push(e); } return this; }
  addEventListener(ev, fn) { (this._ls[ev] ||= []).push(fn); }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k] ?? null; }
  focus() { this.focusCount++; ACTIVE = this; }
  click() { this.clickCount++; dispatch(this, 'click', { target: this, clientX: 90 }); }
  getBoundingClientRect() { return { left: 0, width: 100 }; }
  _all() { return this.children.flatMap((c) => [c, ...c._all()]); }
  querySelectorAll(sel) { return this._all().filter((e) => matches(e, sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  closest(sel) { let n = this; while (n) { if (matches(n, sel)) return n; n = n.parent; } return null; }
}
// Borbulha o evento até a raiz: o despachante do menu escuta no #title-overlay e usa e.target.closest().
function dispatch(el, ev, evt) {
  let n = el;
  while (n) { for (const fn of n._ls[ev] || []) fn(evt); n = n.parent; }
}

function buildStage() {
  const ov = new FakeEl('div', { id: 'title-overlay' });
  const menus = {};
  for (const id of TITLE_MENU_ORDER) {
    menus[id] = new FakeEl('div', { id, classes: ['title-menu'], hidden: id !== 'tm-main' });
    ov.append(menus[id]);
  }
  const npN = new FakeEl('span', { id: 'np-n', text: '1' });
  const npBtn = new FakeEl('button', { id: 'np-btn', classes: ['title-btn'] });
  menus['tm-main'].append(npBtn, npN);
  const byId = new Map([['#title-overlay', ov], ['#np-n', npN], ['#np-btn', npBtn]]);
  for (const id of TITLE_MENU_ORDER) byId.set('#' + id, menus[id]);
  const $ = (sel) => {
    if (byId.has(sel)) return byId.get(sel);
    const parts = sel.split(' ');
    if (parts.length === 2 && byId.has(parts[0])) return byId.get(parts[0]).querySelector(parts[1]);
    return ov.querySelector(sel);
  };
  return { ov, menus, npBtn, npN, $ };
}

function makeCtx(over = {}) {
  const stage = over.stage || buildStage();
  const calls = {
    said: [], alerted: [], shown: [], mode: [], quizLevel: [], cenario: [],
    numPlayers: [], restart: 0, phase: [], hideTips: 0, fullscreen: 0,
  };
  const ctx = {
    $: stage.$,
    getPlayers: () => rodada.players, getNumPlayers: () => rodada.numPlayers,
    getActiveElement: () => ACTIVE,
    srSay: (t) => calls.said.push(t),
    srAlert: (t) => calls.alerted.push(t),
    titleShow: (w) => calls.shown.push(w),
    cenarios: [{ id: 'cidade', nome: 'Cidade' }, { id: 'campo', nome: 'Dia no Campo' }],
    setCenario: (c) => calls.cenario.push(c),
    // `activity` chega por INJEÇÃO desde 2026-08-26: ele é estado do JOGO (`game/state`), e este módulo é
    // engine — o gate de fronteira proíbe engine importar de `game/`. O fake usa o `core/state` ainda
    // porque é lá que o binding mora HOJE; quando ele mudar de casa, muda só esta linha.
    getActivityId: () => ACTIVITY, setActivityId: setActivityValue,
    setQuizLevel: (n, a) => calls.quizLevel.push([n, a]),
    isMobile: () => false,
    fitsN: () => true,
    setNumPlayers: (n) => calls.numPlayers.push(n),
    restartGame: () => { calls.restart++; },
    setPhase: (p) => calls.phase.push(p),
    hideTips: () => { calls.hideTips++; },
    enterFullscreen: () => { calls.fullscreen++; },
    ...over.ctx,
  };
  return { ctx, calls, stage };
}

beforeEach(() => {
  mem.clear();
  ACTIVE = null;
  players.length = 0;
  players.push({ alfWins: 7 });
  setNumPlayersValue(1);
});

// =============================================================================================
// 1. Categoria / MODE / validação de id  (Z-ero, O-ne, B-oundary do catálogo)
// =============================================================================================
describe('categoria da atividade e o MODE que ela liga', () => {
  it('atividade desconhecida não tem categoria: cai em lúdico', () => {
    expect(activityCategory('nao-existe')).toBe('ludico');
  });

  it('sem atividade nenhuma (null/undefined/vazio) também cai em lúdico', () => {
    expect(activityCategory(null)).toBe('ludico');
    expect(activityCategory(undefined)).toBe('ludico');
    expect(activityCategory('')).toBe('ludico');
  });

  it('cada família do catálogo devolve a categoria que o registro declara', () => {
    expect(activityCategory('ludico')).toBe('ludico');
    expect(activityCategory('alf3')).toBe('alf');
    expect(activityCategory('mat5')).toBe('mat');
    expect(activityCategory('fr2a6')).toBe('mat'); // fração é matemática, não uma 4ª categoria
  });

  it('as 3 categorias mapeiam nos 3 modos do motor', () => {
    expect(modeForCategory('alf')).toBe('silabas');
    expect(modeForCategory('mat')).toBe('somasub');
    expect(modeForCategory('ludico')).toBe('ludico');
  });

  it('id inválido vira o padrão; id válido passa intacto', () => {
    expect(normalizeActivityId('mat9000')).toBe(DEFAULT_ACTIVITY_ID);
    expect(normalizeActivityId('')).toBe(DEFAULT_ACTIVITY_ID);
    expect(normalizeActivityId('alf5')).toBe('alf5');
  });

  it('TODO id do catálogo sobrevive à normalização (varredura, não amostra)', () => {
    for (const id of listActivityIds()) expect(normalizeActivityId(id)).toBe(id);
  });
});

// =============================================================================================
// 2. O "Voltar" do seletor de cenário — mapeamento puro (pedido explícito da tarefa)
// =============================================================================================
describe('para onde o "Voltar" do cenário leva', () => {
  it('lúdico veio do menu principal', () => { expect(cenBackMenuFor('ludico')).toBe('tm-main'); });

  it('alfabetização volta ao submenu de alfabetização', () => {
    for (const id of ['alf1', 'alf2', 'alf3', 'alf4', 'alf5']) expect(cenBackMenuFor(id)).toBe('tm-alf');
  });

  it('matemática comum volta ao submenu de matemática', () => {
    for (const id of ['mat1', 'mat2', 'mat3', 'mat4']) expect(cenBackMenuFor(id)).toBe('tm-mat');
  });

  it('quem escolhe números (tabuada/divisão) volta ao seletor de números, não à matemática', () => {
    expect(cenBackMenuFor('mat5')).toBe('tm-tab');
    expect(cenBackMenuFor('mat6')).toBe('tm-tab');
  });

  it('fração volta ao painel de frações', () => {
    for (const id of ['fr2', 'fr3', 'fr42', 'fr5', 'fr632', 'fr2a6']) expect(cenBackMenuFor(id)).toBe('tm-fr');
  });

  it('o "Voltar" nunca aponta para o próprio seletor de cenário (não haveria saída)', () => {
    for (const id of listActivityIds()) expect(cenBackMenuFor(id)).not.toBe('tm-cen');
  });

  it('id desconhecido estoura — o game.js desreferencia sem guarda e o porte manteve isso', () => {
    expect(() => cenBackMenuFor('nao-existe')).toThrow();
  });
});

// =============================================================================================
// 3. Saneamento do armazenamento (pedido explícito: tabSel corrompido)
// =============================================================================================
describe('tabuada: o que vem do armazenamento', () => {
  it('sem nada salvo, o padrão é 2,3,4,5', () => {
    expect(sanitizeTabSel(null)).toEqual([2, 3, 4, 5]);
    expect(sanitizeTabSel(undefined)).toEqual([2, 3, 4, 5]);
  });

  it('array vazio conta como "nada salvo" e volta ao padrão', () => {
    expect(sanitizeTabSel([])).toEqual([2, 3, 4, 5]);
  });

  it('valor que não é array (string, número, objeto) volta ao padrão sem lançar', () => {
    expect(sanitizeTabSel('2,3')).toEqual([2, 3, 4, 5]);
    expect(sanitizeTabSel(7)).toEqual([2, 3, 4, 5]);
    expect(sanitizeTabSel({ 0: 2 })).toEqual([2, 3, 4, 5]);
  });

  it('números fora de 0..10 são descartados; a borda 0 e a borda 10 ficam', () => {
    expect(sanitizeTabSel([0, 10, 11, -1, 5])).toEqual([0, 10, 5]);
  });

  it('array só com lixo não-numérico fica VAZIO — e vazio é estado legítimo (o "Jogar" recusa depois)', () => {
    expect(sanitizeTabSel(['x', {}, [1, 2, 3], NaN])).toEqual([]);
  });

  it('BUG PORTADO: a comparação coage, então "3", true e null passam pelo filtro', () => {
    // O game.js filtra com n>=0 && n<=10, que o JS avalia após coerção. Comportamento preservado
    // VERBATIM (a tarefa manda relatar, não consertar) — ver o relatório da extração.
    expect(sanitizeTabSel(['3', true, null])).toEqual(['3', true, null]);
  });
});

describe('notações de fração: o que vem do armazenamento', () => {
  it('sem nada salvo, só a vertical fica ligada', () => {
    expect(sanitizeFracNot(null)).toEqual({ v: 1, d: 0, dec: 0, pct: 0, mix: 0 });
  });

  it('valor que não é objeto volta ao padrão sem lançar', () => {
    expect(sanitizeFracNot('tudo ligado')).toEqual({ v: 1, d: 0, dec: 0, pct: 0, mix: 0 });
    expect(sanitizeFracNot(42)).toEqual({ v: 1, d: 0, dec: 0, pct: 0, mix: 0 });
  });

  it('tudo desligado é impossível: a vertical volta sozinha (invariante do menu)', () => {
    expect(sanitizeFracNot({ v: 0, d: 0, dec: 0, pct: 0, mix: 0 }).v).toBe(1);
  });

  it('chave desconhecida no armazenamento é ignorada, não vira notação nova', () => {
    const f = sanitizeFracNot({ v: 1, romana: 1 });
    expect(Object.keys(f)).toEqual([...FNOT_KEYS]);
  });

  it('qualquer valor verdadeiro/falso vira 0 ou 1 — nunca uma string vaza para o estado', () => {
    expect(sanitizeFracNot({ v: 0, pct: 'sim', mix: '' })).toEqual({ v: 0, d: 0, dec: 0, pct: 1, mix: 0 });
  });

  it('a última notação ligada não pode ser desligada; qualquer outra pode', () => {
    const so = { v: 1, d: 0, dec: 0, pct: 0, mix: 0 };
    expect(fracNotOnCount(so)).toBe(1);
    expect(canToggleFracNot(so, 'v')).toBe(false);
    expect(canToggleFracNot(so, 'd')).toBe(true); // LIGAR sempre pode
    const duas = { v: 1, d: 1, dec: 0, pct: 0, mix: 0 };
    expect(canToggleFracNot(duas, 'v')).toBe(true);
  });
});

// =============================================================================================
// 4. Nº de jogadores + travessia por setas
// =============================================================================================
describe('nº de jogadores e navegação por setas', () => {
  it('o nº de telas nunca sai de 1..4', () => {
    expect(clampPendingPlayers(0)).toBe(1);
    expect(clampPendingPlayers(-3)).toBe(1);
    expect(clampPendingPlayers(5)).toBe(4);
    expect(clampPendingPlayers(2)).toBe(2);
  });

  it('as setas circulam a lista nos dois sentidos', () => {
    expect(nextTitleIndex(0, 3, { down: true })).toBe(1);
    expect(nextTitleIndex(2, 3, { down: true })).toBe(0);
    expect(nextTitleIndex(0, 3, { up: true })).toBe(2);
    expect(nextTitleIndex(1, 3, { left: true })).toBe(0);
    expect(nextTitleIndex(1, 3, { right: true })).toBe(2);
  });

  it('QUIRK PORTADO: sem foco em nada, para cima também vai para o PRIMEIRO botão', () => {
    expect(nextTitleIndex(-1, 3, { up: true })).toBe(0);
    expect(nextTitleIndex(-1, 3, { down: true })).toBe(0);
  });
});

// =============================================================================================
// 5. Rodapé de descrição
// =============================================================================================
describe('rodapé de descrição do menu', () => {
  it('a notação ganha do minigame quando os dois vêm juntos', () => {
    expect(titleDescFor('mat1', 'pct')).toBe('Liga números percentuais.');
  });
  it('minigame sem descrição no catálogo devolve string vazia, não "undefined"', () => {
    expect(titleDescFor('ludico', undefined)).toBe(''); // 'ludico' não tem `d`
    expect(titleDescFor(undefined, undefined)).toBe('');
    expect(titleDescFor('nao-existe', undefined)).toBe('');
  });
});

// =============================================================================================
// 6. Builders de HTML (puros)
// =============================================================================================
describe('markup dos submenus', () => {
  it('o botão de atividade carrega o id no data-act-id e só mostra o subtítulo quando existe', () => {
    expect(activityBtnHtml('alf1')).toContain('data-act-id="alf1"');
    expect(activityBtnHtml('alf1')).toContain('act-sub');
    expect(activityBtnHtml('ludico')).not.toContain('act-sub'); // sem `sub` no catálogo
  });

  it('o "Voltar" declara o destino no data-tm-back', () => {
    expect(backBtnHtml('tm-mat')).toContain('data-tm-back="tm-mat"');
  });

  it('número escolhido nasce realçado E com aria-pressed — estado visível e audível juntos', () => {
    const html = tabRowHtml([2, 7], [2]);
    expect(html).toContain('tab-on');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
  });

  it('cada notação vira um toggle com aria-label falado e aria-pressed coerente', () => {
    const html = fracNotsHtml({ v: 1, d: 0, dec: 0, pct: 0, mix: 0 });
    // A asserção antiga era `aria-label="${FNOT_LBL[k]}"` — comparava o HTML contra a MESMA tabela que o
    // gera, então continuou verde quando a tabela passou a guardar chaves e o markup passou a vazar
    // 'fnot.v' para o leitor de tela. Quem pegou foi o navegador. Agora atravessa o dicionário, que é uma
    // fonte independente do módulo sob teste.
    for (const k of FNOT_KEYS) expect(html).toContain(`aria-label="${pt[FNOT_LBL[k]]}"`);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it('o seletor de tabuada traz as 11 casas (0..10) e o botão Jogar', () => {
    const html = tabMenuHtml([]);
    for (let n = 0; n <= 10; n++) expect(html).toContain(`data-tab-n="${n}"`);
    expect(html).toContain('id="tab-play"');
  });

  it('o menu de cenário lista o que foi injetado e sempre tem saída', () => {
    const html = cenMenuHtml([{ id: 'campo', nome: 'Dia no Campo' }]);
    expect(html).toContain('data-cen="campo"');
    expect(html).toContain('Dia no Campo');
    expect(html).toContain('data-cen-back="1"');
  });

  it('os submenus de alfabetização e fração voltam para o pai certo', () => {
    expect(alfMenuHtml()).toContain('data-tm-back="tm-main"');
    expect(frMenuHtml({ v: 1, d: 0, dec: 0, pct: 0, mix: 0 })).toContain('data-tm-back="tm-mat"');
  });
});

// =============================================================================================
// 7. Rótulos abreviados (A12e / S11e)
// =============================================================================================
describe('rótulo abreviado que descompacta no foco', () => {
  it('rótulo sem token conhecido não vira nada — e HOJE nenhum botão do jogo tem token', () => {
    expect(abbrParts('🦻 Acessibilidade auditiva')).toBeNull();
    expect(abbrParts('')).toBeNull();
  });

  it('com token, a fatia guarda a primeira e a última letra da palavra', () => {
    const p = abbrParts('🦻 A12e auditiva');
    expect(p).not.toBeNull();
    expect(p.pre).toBe('🦻 A');
    expect(p.suf).toBe('e auditiva');
    expect(p.hid).toBe('cessibilidad');
  });

  it('comprimido mostra o número; expandido mostra a palavra inteira', () => {
    const p = abbrParts('🦻 A12e auditiva');
    expect(abbrText(p, 0)).toBe('🦻 A12e auditiva');
    expect(abbrText(p, p.hid.length)).toBe('🦻 Acessibilidade auditiva');
    expect(abbrText(p, 1)).toBe('🦻 Ac11e auditiva');
  });

  it('botão sem token não ganha ouvintes nem marca; com token ganha as duas coisas uma vez só', () => {
    const semTok = new FakeEl('button', { text: 'Tipografia' });
    attachAbbr(semTok);
    expect(semTok.dataset.abbrDone).toBeUndefined();
    expect(semTok._ls.mouseenter).toBeUndefined();

    const comTok = new FakeEl('button', { text: 'A12e motora' });
    attachAbbr(comTok);
    expect(comTok.dataset.abbrDone).toBe('1');
    expect(comTok._ls.mouseenter).toHaveLength(1);
    attachAbbr(comTok); // idempotente: chamar de novo não duplica ouvinte
    expect(comTok._ls.mouseenter).toHaveLength(1);
  });

  it('nulo/indefinido não derruba a varredura (o forEach passa o que achar)', () => {
    expect(() => { attachAbbr(null); attachAbbr(undefined); }).not.toThrow();
  });
});

// =============================================================================================
// 8. Tabelas de dados que outros módulos consomem
// =============================================================================================
describe('tabelas de menu', () => {
  it('os 5 níveis da psicogênese têm nome, e o nível 5 é o escritor cego', () => {
    for (let n = 1; n <= 5; n++) expect(typeof QL_NAME[n]).toBe('string');
    expect(QL_NAME[5]).toBe('escritor cego');
  });

  it('cada atividade de alfabetização treina exatamente um nível, e todos os 5 são cobertos', () => {
    expect(Object.keys(ALF_LEVEL)).toHaveLength(5);
    expect([...new Set(Object.values(ALF_LEVEL))].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('o menu de pausa começa em Continuar e termina em Sair, sem ação repetida', () => {
    expect(PM_BTNS[0].act).toBe('resume');
    expect(PM_BTNS[PM_BTNS.length - 1].act).toBe('quit');
    const acts = PM_BTNS.map((b) => b.act);
    expect(new Set(acts).size).toBe(acts.length);
  });
});

// =============================================================================================
// 9. A CASCA: initActivitiesMenu(ctx) com DOM falso
// =============================================================================================
describe('initActivitiesMenu — boot', () => {
  it('não faz I/O antes de ser chamado: só o init toca no armazenamento', () => {
    // O módulo já foi importado no topo do arquivo; se houvesse leitura no import, incl_tabsel
    // teria sido lido antes deste ponto — a prova é que gravar AGORA muda o que o init enxerga.
    store.setJSON(store.KEYS.tabsel, [8]);
    const { ctx } = makeCtx();
    const api = initActivitiesMenu(ctx);
    expect(api.tabSel).toEqual([8]);
  });

  it('tabuada corrompida no armazenamento não derruba o boot e não vira lixo utilizável', () => {
    localStorage.setItem(store.KEYS.tabsel, '{isto não é JSON');
    const { ctx } = makeCtx();
    let api;
    expect(() => { api = initActivitiesMenu(ctx); }).not.toThrow();
    expect(api.tabSel).toEqual([2, 3, 4, 5]);
  });

  it('atividade de uma versão anterior, que o catálogo não conhece mais, é trocada pelo padrão no boot', () => {
    // A validação é do lado de FORA do core/state.ts (ele guarda o que mandarem); é o init que a aplica,
    // sobre o BINDING VIVO — não sobre o que estiver no armazenamento neste instante.
    setActivityValue('atividade-aposentada');
    const { ctx } = makeCtx();
    initActivitiesMenu(ctx);
    expect(ACTIVITY).toBe(DEFAULT_ACTIVITY_ID);
    expect(store.get(store.KEYS.activity)).toBe(DEFAULT_ACTIVITY_ID);
  });

  it('atividade válida sobrevive ao boot (a guarda não é um reset disfarçado)', () => {
    setActivityValue('alf5');
    const { ctx } = makeCtx();
    initActivitiesMenu(ctx);
    expect(ACTIVITY).toBe('alf5');
  });

  it('sem #title-overlay no documento, o init não constrói menu nenhum e devolve a API mesmo assim', () => {
    const { ctx } = makeCtx({ ctx: { $: () => null } });
    const api = initActivitiesMenu(ctx);
    expect(api.actCat()).toBe(activityCategory(ACTIVITY));
    expect(api.getPendingPlayers()).toBe(1);
  });

  it('com #title-overlay, os 5 submenus dinâmicos nascem preenchidos (o tm-main é estático no HTML)', () => {
    const { ctx, stage } = makeCtx();
    initActivitiesMenu(ctx);
    expect(stage.menus['tm-alf'].innerHTML).toContain('data-act-id="alf1"');
    expect(stage.menus['tm-mat'].innerHTML).toContain('data-tm-fr="1"');
    expect(stage.menus['tm-fr'].innerHTML).toContain('data-fnot="v"');
    expect(stage.menus['tm-tab'].innerHTML).toContain('id="tab-play"');
    expect(stage.menus['tm-cen'].innerHTML).toContain('data-cen="cidade"');
    expect(stage.menus['tm-main'].innerHTML).toBe('');
  });
});

describe('initActivitiesMenu — escolher a atividade', () => {
  it('id inválido cai no padrão e liga o modo lúdico', () => {
    const { ctx, calls } = makeCtx();
    const api = initActivitiesMenu(ctx);
    api.setActivity('mat9000');
    expect(store.get(store.KEYS.activity)).toBe(DEFAULT_ACTIVITY_ID);
    // O modo NÃO é mais escrito por este menu (ADR-0040): ele DERIVA da atividade que a linha acima gravou.
    // Afirmar a derivação é mais forte que afirmar a chamada — a chamada podia mentir, e mentia (issue #54).
    expect(modeForActivity(store.get(store.KEYS.activity))).toBe('ludico');
    expect(calls.quizLevel).toEqual([]); // lúdico não mexe no nível de alfabetização
  });

  it('alfabetização ajusta o nível do quiz SEM anunciar e liga o modo sílabas', () => {
    const { ctx, calls } = makeCtx();
    const api = initActivitiesMenu(ctx);
    api.setActivity('alf3');
    expect(calls.quizLevel).toEqual([[3, false]]);
    expect(modeForActivity(store.get(store.KEYS.activity))).toBe('silabas');
    expect(api.actCat()).toBe('alf');
  });

  it('matemática liga soma-sub e não toca no nível de alfabetização', () => {
    const { ctx, calls } = makeCtx();
    const api = initActivitiesMenu(ctx);
    api.setActivity('mat5');
    expect(modeForActivity(store.get(store.KEYS.activity))).toBe('somasub');
    expect(calls.quizLevel).toEqual([]);
  });

  it('startActivity abre o seletor de cenário, fala uma vez e arma o "Voltar" da categoria', () => {
    const { ctx, calls } = makeCtx();
    const api = initActivitiesMenu(ctx);
    api.startActivity('fr42');
    expect(calls.shown).toEqual(['tm-cen']);
    expect(calls.said).toEqual(['Escolha o cenário.']);
    expect(api.getCenBack()).toBe('tm-fr');
    api.startActivity('alf2');
    expect(api.getCenBack()).toBe('tm-alf');
  });

  it('startActivity NÃO comita a atividade — só reallyStart comita (o cenário ainda pode ser cancelado)', () => {
    store.set(store.KEYS.activity, 'ludico');
    const { ctx, calls } = makeCtx();
    const api = initActivitiesMenu(ctx);
    api.startActivity('alf4');
    expect(store.get(store.KEYS.activity)).toBe('ludico');
    expect(calls.phase).toEqual([]);
  });
});

describe('initActivitiesMenu — começar de verdade', () => {
  it('mesmo nº de telas: reinicia no lugar, zera as vitórias e entra em jogo', () => {
    const { ctx, calls } = makeCtx();
    const api = initActivitiesMenu(ctx);
    api.startActivity('mat2');
    api.reallyStart();
    expect(calls.restart).toBe(1);
    expect(calls.numPlayers).toEqual([]);
    expect(players[0].alfWins).toBe(0);
    expect(calls.phase).toEqual(['playing']);
    expect(calls.hideTips).toBe(1);
    expect(calls.said[calls.said.length - 1]).toBe('Soma fácil. Jogo iniciado.');
  });

  it('nº de telas diferente: reconstrói as telas em vez de reiniciar no lugar (nunca os dois)', () => {
    setNumPlayersValue(2);
    const { ctx, calls } = makeCtx();
    const api = initActivitiesMenu(ctx); // pendingPlayers começa em 1, numPlayers está em 2
    api.startActivity('ludico');
    api.reallyStart();
    expect(calls.numPlayers).toEqual([1]);
    expect(calls.restart).toBe(0);
  });

  it('no celular, força uma tela só e pede tela cheia', () => {
    const { ctx, calls, stage } = makeCtx({ ctx: { isMobile: () => true } });
    const api = initActivitiesMenu(ctx);
    // sobe o nº de jogadores pelo botão do splash antes de começar
    stage.npBtn.click(); // metade direita (clientX 90 de 100) → +1
    expect(api.getPendingPlayers()).toBe(2);
    api.startActivity('ludico');
    api.reallyStart();
    expect(calls.fullscreen).toBe(1);
    expect(api.getPendingPlayers()).toBe(1);
  });
});

describe('initActivitiesMenu — botão de nº de jogadores', () => {
  it('a metade clicada decide o sinal, e o rótulo acessível acompanha o número', () => {
    const { ctx, stage } = makeCtx();
    const api = initActivitiesMenu(ctx);
    dispatch(stage.npBtn, 'click', { target: stage.npBtn, clientX: 90 }); // direita → +1
    expect(api.getPendingPlayers()).toBe(2);
    // O `<span id="np-n">` SUMIU: era ele que impedia o rótulo de ser traduzível (o `applyDom` escreve
    // `textContent` e o destruiria). O botão inteiro passa a vir de `t('menu.playerCount', {n})`, então o
    // número aparece no texto do BOTÃO — e a `aria-label` continua acompanhando, que é o que importa aqui.
    expect(stage.npBtn.textContent).toContain('2');
    expect(stage.npBtn.getAttribute('aria-label')).toContain('2');
    dispatch(stage.npBtn, 'click', { target: stage.npBtn, clientX: 10 }); // esquerda → −1
    expect(api.getPendingPlayers()).toBe(1);
  });

  it('não desce abaixo de 1 nem sobe acima de 4', () => {
    const { ctx, stage } = makeCtx();
    const api = initActivitiesMenu(ctx);
    for (let i = 0; i < 6; i++) dispatch(stage.npBtn, 'click', { target: stage.npBtn, clientX: 90 });
    expect(api.getPendingPlayers()).toBe(4);
    for (let i = 0; i < 9; i++) dispatch(stage.npBtn, 'click', { target: stage.npBtn, clientX: 10 });
    expect(api.getPendingPlayers()).toBe(1);
  });

  it('janela apertada recusa a 2ª tela com alerta e mantém o número anterior', () => {
    const { ctx, calls, stage } = makeCtx({ ctx: { fitsN: () => false } });
    const api = initActivitiesMenu(ctx);
    dispatch(stage.npBtn, 'click', { target: stage.npBtn, clientX: 90 });
    expect(api.getPendingPlayers()).toBe(1);
    expect(calls.alerted[0]).toContain('Não cabem 2 telas');
  });

  it('←/→ no teclado agem como os dois lados do botão', () => {
    const { ctx, stage } = makeCtx();
    const api = initActivitiesMenu(ctx);
    const prevented = [];
    dispatch(stage.npBtn, 'keydown', { target: stage.npBtn, key: 'ArrowRight', preventDefault: () => prevented.push(1) });
    expect(api.getPendingPlayers()).toBe(2);
    expect(prevented).toHaveLength(1);
    dispatch(stage.npBtn, 'keydown', { target: stage.npBtn, key: 'ArrowLeft', preventDefault: () => prevented.push(1) });
    expect(api.getPendingPlayers()).toBe(1);
  });

  it('tecla que não é seta é ignorada', () => {
    const { ctx, stage } = makeCtx();
    const api = initActivitiesMenu(ctx);
    dispatch(stage.npBtn, 'keydown', { target: stage.npBtn, key: 'a', preventDefault: () => {} });
    expect(api.getPendingPlayers()).toBe(1);
  });
});

describe('initActivitiesMenu — despacho de cliques do menu', () => {
  beforeEach(() => { vi.useFakeTimers(); });

  function submenuBtn(stage, menuId, dataset, opt = {}) {
    const b = new FakeEl('button', { classes: ['title-btn'], dataset, ...opt });
    stage.menus[menuId].append(b);
    return b;
  }

  it('a troca de tela espera a animação de ativação (230ms), não acontece no clique', () => {
    const { ctx, calls, stage } = makeCtx();
    initActivitiesMenu(ctx);
    const b = submenuBtn(stage, 'tm-main', { tm: 'alf' });
    b.click();
    vi.advanceTimersByTime(229);
    expect(calls.shown).toEqual([]);      // um milissegundo antes: nada mudou de tela
    vi.advanceTimersByTime(1);
    expect(calls.shown).toEqual(['tm-alf']);
  });

  it('clique repetido durante a animação não empilha duas trocas de tela', () => {
    const { ctx, calls, stage } = makeCtx();
    initActivitiesMenu(ctx);
    const b = submenuBtn(stage, 'tm-main', { tm: 'mat' });
    b.click(); b.click(); b.click();
    vi.advanceTimersByTime(230);
    expect(calls.shown).toEqual(['tm-mat']);
  });

  it('o "Voltar" do cenário usa o destino armado por startActivity, não um fixo', () => {
    const { ctx, calls, stage } = makeCtx();
    const api = initActivitiesMenu(ctx);
    api.startActivity('mat6'); // divisão → veio do seletor de números
    const back = submenuBtn(stage, 'tm-cen', { cenBack: '1' });
    back.click();
    vi.advanceTimersByTime(230);
    expect(calls.shown).toEqual(['tm-cen', 'tm-tab']);
  });

  it('escolher o cenário aplica o tema e começa a partida, nessa ordem', () => {
    const { ctx, calls, stage } = makeCtx();
    const api = initActivitiesMenu(ctx);
    api.startActivity('ludico');
    const cen = submenuBtn(stage, 'tm-cen', { cen: 'campo' });
    cen.click();
    vi.advanceTimersByTime(230);
    expect(calls.cenario).toEqual(['campo']);
    expect(calls.phase).toEqual(['playing']);
  });

  it('número da tabuada é toggle imediato (sem esperar animação) e persiste na hora', () => {
    const { ctx, stage } = makeCtx();
    const api = initActivitiesMenu(ctx);
    const b7 = submenuBtn(stage, 'tm-tab', { tabN: '7' });
    b7.click();
    expect(api.tabSel).toContain(7);
    expect(store.getJSON(store.KEYS.tabsel)).toContain(7);
    b7.click();
    expect(api.tabSel).not.toContain(7);
    expect(store.getJSON(store.KEYS.tabsel)).not.toContain(7);
  });

  it('o botão do número reflete o estado na classe E no aria-pressed', () => {
    const { ctx, stage } = makeCtx();
    initActivitiesMenu(ctx);
    const b9 = submenuBtn(stage, 'tm-tab', { tabN: '9' });
    b9.click();
    expect(b9.classList.contains('tab-on')).toBe(true);
    expect(b9.getAttribute('aria-pressed')).toBe('true');
    b9.click();
    expect(b9.classList.contains('tab-on')).toBe(false);
    expect(b9.getAttribute('aria-pressed')).toBe('false');
  });

  it('"Jogar" sem nenhum número escolhido recusa com alerta e não abre o cenário', () => {
    store.setJSON(store.KEYS.tabsel, ['x']); // sobra vazia depois do filtro
    const { ctx, calls, stage } = makeCtx();
    const api = initActivitiesMenu(ctx);
    expect(api.tabSel).toEqual([]);
    const play = new FakeEl('button', { id: 'tab-play', classes: ['title-btn'] });
    stage.menus['tm-tab'].append(play);
    play.click();
    vi.advanceTimersByTime(230);
    expect(calls.alerted[0]).toContain('ao menos um número');
    expect(calls.shown).toEqual([]);
  });

  it('a última notação de fração ligada não pode ser desligada', () => {
    store.setJSON(store.KEYS.fracnot, { v: 1, d: 0, dec: 0, pct: 0, mix: 0 });
    const { ctx, calls, stage } = makeCtx();
    const api = initActivitiesMenu(ctx);
    const bv = submenuBtn(stage, 'tm-fr', { fnot: 'v' });
    bv.click();
    expect(calls.alerted[0]).toBe('Deixe ao menos uma notação ligada.');
    expect(api.fracNot.v).toBe(1);
  });

  it('ligar uma segunda notação libera desligar a primeira, e tudo persiste', () => {
    const { ctx, stage } = makeCtx();
    const api = initActivitiesMenu(ctx);
    const bpct = submenuBtn(stage, 'tm-fr', { fnot: 'pct' });
    const bv = submenuBtn(stage, 'tm-fr', { fnot: 'v' });
    bpct.click();
    expect(api.fracNot.pct).toBe(1);
    bv.click();
    expect(api.fracNot.v).toBe(0);
    expect(store.getJSON(store.KEYS.fracnot)).toEqual({ v: 0, d: 0, dec: 0, pct: 1, mix: 0 });
  });

  it('atividade que escolhe números abre o seletor com o título dela; as outras vão direto ao cenário', () => {
    const { ctx, calls, stage } = makeCtx();
    const api = initActivitiesMenu(ctx);
    const tit = new FakeEl('h3', { classes: ['tm-title'] });
    stage.menus['tm-tab'].append(tit);
    submenuBtn(stage, 'tm-mat', { actId: 'mat6' }).click();
    vi.advanceTimersByTime(230);
    expect(calls.shown).toEqual(['tm-tab']);
    expect(tit.textContent).toBe('Divisão');

    submenuBtn(stage, 'tm-mat', { actId: 'mat1' }).click();
    vi.advanceTimersByTime(230);
    expect(calls.shown).toEqual(['tm-tab', 'tm-cen']);
    expect(api.getCenBack()).toBe('tm-mat');
  });

  it('depois de escolher a divisão, o "Jogar" do seletor começa a DIVISÃO, não a tabuada', () => {
    const { ctx, calls, stage } = makeCtx();
    const api = initActivitiesMenu(ctx);
    stage.menus['tm-tab'].append(new FakeEl('h3', { classes: ['tm-title'] }));
    submenuBtn(stage, 'tm-mat', { actId: 'mat6' }).click();
    vi.advanceTimersByTime(230);
    const play = new FakeEl('button', { id: 'tab-play', classes: ['title-btn'] });
    stage.menus['tm-tab'].append(play);
    play.click();
    vi.advanceTimersByTime(230);
    api.reallyStart();
    expect(calls.said[calls.said.length - 1]).toBe('Divisão. Jogo iniciado.');
  });

  it('clique fora de qualquer botão não faz nada', () => {
    const { ctx, calls, stage } = makeCtx();
    initActivitiesMenu(ctx);
    dispatch(stage.ov, 'click', { target: stage.menus['tm-main'] });
    vi.advanceTimersByTime(230);
    expect(calls.shown).toEqual([]);
    expect(calls.said).toEqual([]);
  });
});

describe('initActivitiesMenu — travessia por setas', () => {
  it('só os botões do submenu VISÍVEL entram na navegação', () => {
    const { ctx, stage } = makeCtx();
    const api = initActivitiesMenu(ctx);
    const vis = new FakeEl('button', { text: 'Lúdico' });
    const oculto = new FakeEl('button', { text: 'Escondido' });
    stage.menus['tm-main'].append(vis);
    stage.menus['tm-alf'].append(oculto);
    const bs = api.titleButtons();
    expect(bs).toContain(vis);
    expect(bs).not.toContain(oculto);
  });

  it('a seta move o foco e ANUNCIA o rótulo do botão focado', () => {
    const { ctx, calls, stage } = makeCtx();
    const api = initActivitiesMenu(ctx);
    const a = new FakeEl('button', { text: 'Um' }); const b = new FakeEl('button', { text: 'Dois' });
    stage.menus['tm-main'].append(a, b);
    api.navTitle({ down: true });
    expect(ACTIVE.textContent).toBe(stage.npBtn.textContent); // 1º botão do submenu (o #np-btn)
    api.navTitle({ down: true });
    expect(calls.said[calls.said.length - 1]).toBe('Um');
  });

  it('confirmar sem foco em nada aciona o PRIMEIRO botão', () => {
    const { ctx, stage } = makeCtx();
    const api = initActivitiesMenu(ctx);
    api.navTitle({ yes: true });
    expect(stage.npBtn.clickCount).toBe(1);
  });

  it('voltar aciona o botão de "Voltar" quando ele existe, e é inócuo quando não existe', () => {
    const { ctx, stage } = makeCtx();
    const api = initActivitiesMenu(ctx);
    expect(() => api.navTitle({ no: true })).not.toThrow(); // tm-main não tem Voltar
    const back = new FakeEl('button', { text: 'Voltar', dataset: { tmBack: 'tm-main' } });
    stage.menus['tm-main'].append(back);
    api.navTitle({ no: true });
    expect(back.clickCount).toBe(1);
  });

  it('submenu sem botão nenhum: navegar não lança nem fala', () => {
    const { ctx, calls, stage } = makeCtx();
    const api = initActivitiesMenu(ctx);
    stage.menus['tm-main'].children.length = 0;
    for (const id of TITLE_MENU_ORDER) stage.menus[id].hidden = true;
    expect(() => api.navTitle({ down: true })).not.toThrow();
    expect(calls.said).toEqual([]);
  });
});
