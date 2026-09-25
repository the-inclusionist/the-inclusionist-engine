// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/settings-panel — the common SHELL of the settings dialogs (node project, no real `document`:
// ctx.$/$$/doc work on a FAKE DOM defined here). Contract: DI by closure ($/$$/doc/computedZ), no access to globals
// outside the ctx. Real focus (who gets focus on opening, where it returns on closing) only the browser proves →
// tests/settings-panel.browser.test.js. ZOMBIES + Right-BICEP.
// Covers in particular: the Escape chain walks the REGISTRATION ORDER (not the z-index), the `dlgVis` guard (a flag
// stuck on an invisible dialog does not hijack the key), the rising z stacking and the READING ORDER fillExplain
// produces (label on the row, description in an aria-live footer).
import { describe, it, expect, beforeEach } from 'vitest';
import { t } from '../app/js/core/i18n.js';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
import {
  initSettingsPanel, rowExplainText, topByZ, EXPLAIN_IDLE, OVERLAY_BASE_Z, OVERLAY_SCOPE_SELECTOR,
} from '../app/js/ui/settings-panel.js';

// ---------------------------------------------------------------------------------------------
// Fake DOM — only what settings-panel.ts touches. Supported selectors: '.class', 'tag' and
// ':scope > span'. `textContent` concatenates the child nodes (that is how the module finds the description
// after the label in <strong>).
// ---------------------------------------------------------------------------------------------
class FakeEl {
  constructor(tag, cls = '', nodes = []) {
    this.tag = tag; this.className = cls; this.nodes = nodes;
    this.dataset = {}; this.attrs = {}; this.style = {}; this.hidden = false;
    this.listeners = {};
    this._innerHTML = undefined;
  }
  get textContent() { return this.nodes.map((n) => (typeof n === 'string' ? n : n.textContent)).join(''); }
  set textContent(v) { this.nodes = [String(v)]; this._innerHTML = undefined; }
  get innerHTML() {
    if (this._innerHTML !== undefined) return this._innerHTML;
    return this.nodes.map((n) => (typeof n === 'string' ? n : n.outerHTML)).join('');
  }
  // Re-parses the single shape the module writes (`<strong>label</strong>`) so a 2nd pass of fillExplain sees the same
  // as it would in the browser — without this the fake DOM would mask bugs.
  set innerHTML(v) {
    this._innerHTML = v;
    const m = /^<(\w+)(?: class="([^"]*)")?>([\s\S]*)<\/\1>$/.exec(v);
    this.nodes = m ? [new FakeEl(m[1], m[2] ?? '', [m[3]])] : (v ? [v] : []);
  }
  get outerHTML() { return `<${this.tag}${this.className ? ` class="${this.className}"` : ''}>${this.innerHTML}</${this.tag}>`; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return Object.hasOwn(this.attrs, k) ? this.attrs[k] : null; }
  appendChild(c) { this.nodes.push(c); return c; }
  addEventListener(ev, fn) { (this.listeners[ev] ??= []).push(fn); }
  fire(ev) { (this.listeners[ev] ?? []).forEach((fn) => fn()); }
  _matches(sel) {
    if (sel.startsWith('.')) return this.className.split(/\s+/).includes(sel.slice(1));
    return this.tag === sel;
  }
  _kids() { return this.nodes.filter((n) => typeof n !== 'string'); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  querySelectorAll(sel) {
    if (sel === ':scope > span') return this._kids().filter((k) => k.tag === 'span');
    const out = [];
    const walk = (el) => { for (const k of el._kids()) { if (k._matches(sel)) out.push(k); walk(k); } };
    walk(this);
    return out;
  }
}

const fakeDoc = { createElement: (tag) => new FakeEl(tag) };

/** An option row as the panels write it: <div class="ctrl-row"><span><strong>Label</strong> — description</span></div> */
function ctrlRow(label, sep = ' — ', desc = 'Explicação longa da opção.', hint = null) {
  const strong = new FakeEl('strong', '', [label]);
  const kids = [strong];
  if (desc) kids.push(sep + desc);
  if (hint !== null) kids.push(new FakeEl('span', 'opt-hint', [hint]));
  return new FakeEl('div', 'ctrl-row', [new FakeEl('span', '', kids)]);
}

function overlay(id, { rows = [], hidden = true, withCard = true } = {}) {
  const card = new FakeEl('div', 'overlay__card', rows);
  const ov = new FakeEl('div', 'overlay', withCard ? [card] : []);
  ov.id = id; ov.hidden = hidden;
  return ov;
}

/** A complete ctx over a map of `#id` → FakeEl. `zOf` simulates the browser's getComputedStyle. */
function makeCtx(elements = {}, { scope = [], zOf = (el) => Number(el.style.zIndex) || 0 } = {}) {
  return {
    t: translate,
    $: (sel) => elements[sel] ?? null,
    $$: (sel) => (sel === OVERLAY_SCOPE_SELECTOR ? scope : []),
    doc: fakeDoc,
    computedZ: zOf,
  };
}

// ---------------------------------------------------------------------------------------------
// Lógica pura
// ---------------------------------------------------------------------------------------------
describe('rowExplainText — de onde sai a descrição da linha', () => {
  it('[Right] com .opt-hint, usa o texto do hint (e ignora o resto do span)', () => {
    expect(rowExplainText('🎮 Rótulo — texto do span', '🎮 Rótulo', '  texto do hint  ')).toBe('texto do hint');
  });
  it('[Right] sem hint, corta o rótulo e o travessão (em dash)', () => {
    expect(rowExplainText('♿ Modo Fácil — gravidade menor.', '♿ Modo Fácil', null)).toBe('gravidade menor.');
  });
  it('[Boundary] aceita en dash e hífen como separador', () => {
    expect(rowExplainText('A – desc', 'A', null)).toBe('desc');
    expect(rowExplainText('A - desc', 'A', null)).toBe('desc');
  });
  it('[Boundary] sem separador, devolve o resto do span aparado', () => {
    expect(rowExplainText('A  descrição solta', 'A', null)).toBe('descrição solta');
  });
  it('[Zero] rótulo sem descrição devolve string vazia', () => {
    expect(rowExplainText('Só o rótulo', 'Só o rótulo', null)).toBe('');
  });
  it('[Edge-case] hint VAZIO vence o fallback (verbatim: o original testa o elemento, não o texto)', () => {
    expect(rowExplainText('A — descrição que seria usada', 'A', '')).toBe('');
  });
});

describe('topByZ — quem está por cima', () => {
  it('[Zero] lista vazia devolve null', () => {
    expect(topByZ([], () => 0)).toBe(null);
  });
  it('[Right] devolve o de maior z, mesmo fora de ordem', () => {
    const list = [{ z: 62 }, { z: 99 }, { z: 61 }];
    expect(topByZ(list, (e) => e.z)).toBe(list[1]);
  });
  it('[Boundary] empate de z: vence o ÚLTIMO da lista (ordem do DOM)', () => {
    const list = [{ n: 'a', z: 61 }, { n: 'b', z: 61 }];
    expect(topByZ(list, (e) => e.z).n).toBe('b');
  });
  it('[Boundary] z 0/negativo não quebra a comparação', () => {
    const list = [{ z: 0 }, { z: -5 }];
    expect(topByZ(list, (e) => e.z)).toBe(list[0]);
  });
  it('[Interface] não muta a lista recebida', () => {
    const list = [{ z: 99 }, { z: 1 }];
    topByZ(list, (e) => e.z);
    expect(list[0].z).toBe(99);
  });
});

// ---------------------------------------------------------------------------------------------
// frontOverlay — a pilha
// ---------------------------------------------------------------------------------------------
describe('frontOverlay — empilhamento', () => {
  it('[Right] o primeiro overlay trazido à frente fica em OVERLAY_BASE_Z+1', () => {
    const api = initSettingsPanel(makeCtx());
    const ov = overlay('visual');
    api.frontOverlay(ov);
    expect(ov.style.zIndex).toBe(String(OVERLAY_BASE_Z + 1));
  });
  it('[Right] dois overlays abertos empilham na ordem de abertura (o último por cima)', () => {
    const api = initSettingsPanel(makeCtx());
    const a = overlay('animation'); const b = overlay('empathy');
    api.frontOverlay(a);
    api.frontOverlay(b);
    expect(Number(b.style.zIndex)).toBeGreaterThan(Number(a.style.zIndex));
  });
  it('[Boundary] reabrir o de baixo o traz de volta para cima', () => {
    const api = initSettingsPanel(makeCtx());
    const a = overlay('animation'); const b = overlay('empathy');
    api.frontOverlay(a); api.frontOverlay(b); api.frontOverlay(a);
    expect(Number(a.style.zIndex)).toBeGreaterThan(Number(b.style.zIndex));
  });
  it('[Zero/Error] elemento nulo é no-op e NÃO consome um nível da pilha', () => {
    const api = initSettingsPanel(makeCtx());
    api.frontOverlay(null);
    const ov = overlay('visual');
    api.frontOverlay(ov);
    expect(ov.style.zIndex).toBe(String(OVERLAY_BASE_Z + 1));
  });
  it('[Interface] preenche o rodapé de explicação do .overlay__card', () => {
    const api = initSettingsPanel(makeCtx());
    const ov = overlay('visual', { rows: [ctrlRow('♿ Modo Fácil')] });
    api.frontOverlay(ov);
    const card = ov.querySelector('.overlay__card');
    expect(card.querySelector('.opt-explain')).not.toBe(null);
  });
  it('[Edge-case] overlay sem .overlay__card só empilha, sem criar rodapé', () => {
    const api = initSettingsPanel(makeCtx());
    const ov = overlay('padwiz', { withCard: false });
    api.frontOverlay(ov);
    expect(ov.style.zIndex).toBe(String(OVERLAY_BASE_Z + 1));
    expect(ov.querySelector('.opt-explain')).toBe(null);
  });
  it('[Interface] a pilha é do INIT, não do módulo: um init novo recomeça do zero', () => {
    const first = initSettingsPanel(makeCtx());
    first.frontOverlay(overlay('a')); first.frontOverlay(overlay('b'));
    const second = initSettingsPanel(makeCtx());
    const ov = overlay('c');
    second.frontOverlay(ov);
    expect(ov.style.zIndex).toBe(String(OVERLAY_BASE_Z + 1));
  });
});

// ---------------------------------------------------------------------------------------------
// fillExplain — ORDEM DE LEITURA (acessibilidade)
// ---------------------------------------------------------------------------------------------
describe('fillExplain — rótulo na linha, descrição no rodapé', () => {
  let api;
  beforeEach(() => { api = initSettingsPanel(makeCtx()); });

  it('[Right] cria o rodapé aria-live="polite" com o texto de repouso', () => {
    const card = new FakeEl('div', 'overlay__card', [ctrlRow('♿ Modo Fácil')]);
    api.fillExplain(card);
    const f = card.querySelector('.opt-explain');
    expect(f.getAttribute('aria-live')).toBe('polite');
    expect(f.textContent).toBe(t(EXPLAIN_IDLE));
    expect(f.dataset.idle).toBe(t(EXPLAIN_IDLE));
  });
  it('[Right] tira a descrição da linha: sobra só o <strong>, e o texto vai para data-explain', () => {
    const row = ctrlRow('♿ Modo Fácil', ' — ', 'gravidade menor.');
    const card = new FakeEl('div', 'overlay__card', [row]);
    api.fillExplain(card);
    expect(row.dataset.explain).toBe('gravidade menor.');
    expect(row.querySelector(':scope > span').innerHTML).toBe('<strong>♿ Modo Fácil</strong>');
  });
  it('[Interface] foco/hover na linha escreve a descrição no rodapé; sair restaura o repouso', () => {
    const row = ctrlRow('Contorno', ' — ', 'em volta do personagem.');
    const card = new FakeEl('div', 'overlay__card', [row]);
    api.fillExplain(card);
    const f = card.querySelector('.opt-explain');
    row.fire('focusin');
    expect(f.textContent).toBe('em volta do personagem.');
    row.fire('mouseleave');
    expect(f.textContent).toBe(t(EXPLAIN_IDLE));
    row.fire('mouseenter');
    expect(f.textContent).toBe('em volta do personagem.');
  });
  // The row carries loose text AND an .opt-hint: only the hint may become the explanation (if the module fell back, the
  // description would come out with the loose text stuck to it — which is what this case tells apart).
  it('[Right] com .opt-hint dentro do span, é o hint que vira a explicação', () => {
    const row = ctrlRow('🎮 Desenho', ' — ', 'texto solto que NÃO deve virar explicação', 'escolha como rotular os botões.');
    const card = new FakeEl('div', 'overlay__card', [row]);
    api.fillExplain(card);
    expect(row.dataset.explain).toBe('escolha como rotular os botões.');
  });
  // NOTE: "does not duplicate listeners" on the 2nd call is not tested — the `explainDone` mark is a DEAD defence: after
  // the 1st pass the span has already been rewritten to just the <strong>, so the 2nd finds an empty desc and leaves by
  // itself. Removing the guard changes no behaviour (verified by mutation). What IS observable is the single footer:
  it('[Boundary] duas chamadas no mesmo card não duplicam o rodapé de explicação', () => {
    const row = ctrlRow('A', ' — ', 'desc');
    const card = new FakeEl('div', 'overlay__card', [row]);
    api.fillExplain(card);
    api.fillExplain(card);
    expect(card.querySelectorAll('.opt-explain')).toHaveLength(1);
  });
  it('[Boundary] linha sem <strong> é marcada como feita e fica intacta', () => {
    const row = new FakeEl('div', 'ctrl-row', [new FakeEl('span', '', ['texto solto'])]);
    const card = new FakeEl('div', 'overlay__card', [row]);
    api.fillExplain(card);
    expect(row.dataset.explainDone).toBe('1');
    expect(row.dataset.explain).toBe(undefined);
    expect(row.querySelector(':scope > span').textContent).toBe('texto solto');
  });
  it('[Zero] linha com rótulo e sem descrição não ganha data-explain nem listeners', () => {
    const row = ctrlRow('Só rótulo', '', '');
    const card = new FakeEl('div', 'overlay__card', [row]);
    api.fillExplain(card);
    expect(row.dataset.explainDone).toBe('1');
    expect(row.dataset.explain).toBe(undefined);
    expect(row.listeners.focusin).toBe(undefined);
  });
  it('[Zero/Error] card nulo é no-op silencioso', () => {
    expect(() => api.fillExplain(null)).not.toThrow();
  });
  it('[Edge-case] linha nova acrescentada depois é processada, as antigas não', () => {
    const oldRow = ctrlRow('Velha', ' — ', 'desc velha');
    const card = new FakeEl('div', 'overlay__card', [oldRow]);
    api.fillExplain(card);
    const newRow = ctrlRow('Nova', ' — ', 'desc nova');
    card.appendChild(newRow);
    api.fillExplain(card);
    expect(newRow.dataset.explain).toBe('desc nova');
    expect(card.querySelectorAll('.opt-explain')).toHaveLength(1); // and the footer is still one
  });
});

// ---------------------------------------------------------------------------------------------
// Overlay registry: OVERLAY_CLOSE + the Escape chain
// ---------------------------------------------------------------------------------------------
describe('registro de overlays — fechar por id', () => {
  it('[Right] closeById chama o close registrado e devolve true', () => {
    const api = initSettingsPanel(makeCtx());
    let closed = 0;
    api.register('audio', { close: () => { closed++; } });
    expect(api.closeById('audio')).toBe(true);
    expect(closed).toBe(1);
  });
  it('[Zero/Error] id não registrado devolve false e não lança (o `if(c)c()` do dialogBack)', () => {
    const api = initSettingsPanel(makeCtx());
    expect(api.closeById('inexistente')).toBe(false);
  });
  it('[Interface] registrar de novo o mesmo id substitui o close e mantém a POSIÇÃO na cadeia', () => {
    const api = initSettingsPanel(makeCtx());
    api.register('options', { close: () => {} });
    api.register('audio', { close: () => {} });
    let novo = 0;
    api.register('options', { close: () => { novo++; } });
    expect(api.registeredIds()).toEqual(['options', 'audio']);
    api.closeById('options');
    expect(novo).toBe(1);
  });
});

describe('escapeTarget — quem consome a tecla Escape', () => {
  // (D1) An entry carries no `isOpen`: open is ONE thing only — the element's own `hidden` — and `inEscapeChain` only
  // says whether the dialog takes part in the chain. With two sources (a per-dialog open flag AND the visibility guard)
  // the visibility decided wherever they disagreed; a case for "visible but with the flag off" would describe a
  // configuration that cannot be built. The test of the invariant CAN fail: touching only `hidden` flips the answer both
  // ways.
  function scene({ optionsHidden = true, audioHidden = true } = {}) {
    const options = overlay('options', { hidden: optionsHidden });
    const audio = overlay('audio', { hidden: audioHidden });
    const api = initSettingsPanel(makeCtx({ '#options': options, '#audio': audio }));
    const closed = [];
    // registration order (options before audio)
    api.register('options', { close: () => closed.push('options'), inEscapeChain: true });
    api.register('audio', { close: () => closed.push('audio'), inEscapeChain: true });
    return { api, options, audio, closed };
  }

  it('[Zero] nada aberto: devolve null (a tecla segue para o jogo)', () => {
    expect(scene().api.escapeTarget()).toBe(null);
  });
  it('[Right] um so aberto e visivel: e ele', () => {
    expect(scene({ audioHidden: false }).api.escapeTarget()).toBe('audio');
  });
  it('[Right] dois abertos: vence a ORDEM DE REGISTRO, nao o z-index (divergencia verbatim do game.js)', () => {
    const s = scene({ optionsHidden: false, audioHidden: false });
    s.options.style.zIndex = '61'; // #options esta ATRAS...
    s.audio.style.zIndex = '62';   // ...and #audio on top
    expect(s.api.escapeTarget()).toBe('options'); // still it is the first in the chain
  });
  it('[Boundary] fecha so UM: depois de fechar o primeiro, o alvo passa a ser o outro', () => {
    const s = scene({ optionsHidden: false, audioHidden: false });
    const first = s.api.escapeTarget();
    s.options.hidden = true; // it is what the real close() does
    expect(s.audio.hidden).toBe(false); // the one below is still open
    expect(first).toBe('options');
    expect(s.api.escapeTarget()).toBe('audio');
  });
  it('[Boundary] o primeiro da cadeia, se INVISIVEL, e pulado (a antiga guarda dlgVis)', () => {
    const s = scene({ optionsHidden: true, audioHidden: false });
    expect(s.api.escapeTarget()).toBe('audio');
  });
  it('[Right] `hidden` e a UNICA fonte: mexer nele vira a resposta nos dois sentidos', () => {
    const s = scene(); // ambos escondidos
    expect(s.api.escapeTarget()).toBe(null);
    s.audio.hidden = false;
    expect(s.api.escapeTarget()).toBe('audio');
    s.options.hidden = false;                       // the first in the chain appears and takes over
    expect(s.api.escapeTarget()).toBe('options');
    s.options.hidden = true;                        // it vanishes again and gives back the turn
    expect(s.api.escapeTarget()).toBe('audio');
    s.audio.hidden = true;
    expect(s.api.escapeTarget()).toBe(null);
  });
  it('[Edge-case] inEscapeChain:false fica de fora MESMO visivel (#touchcfg/#help no original)', () => {
    const touchcfg = overlay('touchcfg', { hidden: false });
    const api = initSettingsPanel(makeCtx({ '#touchcfg': touchcfg }));
    api.register('touchcfg', { close: () => {}, inEscapeChain: false });
    expect(touchcfg.hidden).toBe(false);            // visivel de verdade...
    expect(api.escapeTarget()).toBe(null);          // ...and still out of the chain
    expect(api.closeById('touchcfg')).toBe(true);   // but still closable through dialogBack
  });
  it('[Zero/Error] na cadeia mas com o elemento AUSENTE do DOM e pulado, sem lancar', () => {
    const api = initSettingsPanel(makeCtx({}));
    api.register('options', { close: () => {}, inEscapeChain: true });
    expect(api.escapeTarget()).toBe(null);
  });
});

// ---------------------------------------------------------------------------------------------
// topVisibleOverlay — o sharedDialogOpen
// ---------------------------------------------------------------------------------------------
describe('topVisibleOverlay — o diálogo de cima', () => {
  it('[Zero] nenhum overlay no escopo: null', () => {
    expect(initSettingsPanel(makeCtx({}, { scope: [] })).topVisibleOverlay()).toBe(null);
  });
  it('[Zero] todos escondidos: null', () => {
    const a = overlay('audio', { hidden: true }); const b = overlay('visual', { hidden: true });
    expect(initSettingsPanel(makeCtx({}, { scope: [a, b] })).topVisibleOverlay()).toBe(null);
  });
  it('[Right] devolve o visível de maior z', () => {
    const a = overlay('audio', { hidden: false }); a.style.zIndex = '61';
    const b = overlay('visual', { hidden: false }); b.style.zIndex = '62';
    expect(initSettingsPanel(makeCtx({}, { scope: [a, b] })).topVisibleOverlay()).toBe(b);
  });
  it('[Boundary] ignora o escondido mesmo que tenha o maior z', () => {
    const a = overlay('audio', { hidden: false }); a.style.zIndex = '61';
    const b = overlay('visual', { hidden: true }); b.style.zIndex = '99';
    expect(initSettingsPanel(makeCtx({}, { scope: [a, b] })).topVisibleOverlay()).toBe(a);
  });
  it('[Edge-case] z "auto" (NaN) conta como 0 — verbatim do +getComputedStyle(...).zIndex||0', () => {
    const auto = overlay('help', { hidden: false });
    const stacked = overlay('audio', { hidden: false }); stacked.style.zIndex = '61';
    const zOf = (el) => Number(el.style.zIndex ?? 'auto') || 0;
    expect(initSettingsPanel(makeCtx({}, { scope: [auto, stacked], zOf })).topVisibleOverlay()).toBe(stacked);
  });
  it('[Interface] frontOverlay alimenta topVisibleOverlay: o último aberto é o de cima', () => {
    const a = overlay('audio', { hidden: false }); const b = overlay('visual', { hidden: false });
    const api = initSettingsPanel(makeCtx({}, { scope: [a, b] }));
    api.frontOverlay(a);
    api.frontOverlay(b);
    expect(api.topVisibleOverlay()).toBe(b);
    api.frontOverlay(a);
    expect(api.topVisibleOverlay()).toBe(a);
  });
});
