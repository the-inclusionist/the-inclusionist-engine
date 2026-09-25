// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/changed-mark — the changed-from-default mark (ADR-0029, BROWSER project: uses document).
//
// The case that keeps this module honest is NOT marking: it is UNMARKING. A mark that could only add would end up on
// every control, and a mark on everything is no mark — it is noise that looks like information, in the menu where the
// child has least room to be confused.
//
// The second case that matters is the accessible NAME, which has two paths because `aria-label` beats the button's
// content. Marking only one of them would leave half the controls mute for whoever cannot see, silently — the worst way
// for an accessibility mark to fail, because nothing on screen gives the gap away.
//
// The third is the VISIBLE label, and it came in because someone else's test fell. A first version hung a
// `<span class="sr-only">` inside the button, and a settings-mobility case that checked `textContent` accused it: the
// panels rewrite the whole content at every reflect, so the suffix depended on the order of the calls to survive. The
// suffix now lives only in the `aria-label`, and the visible text is untouched.
import { describe, it, expect, beforeEach } from 'vitest';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
import { markChanged, markMenuChanged, CHANGED_CLASS } from '../app/js/ui/changed-mark.js';

const $ = (sel) => document.querySelector(sel);
const nome = (el) => (el.hasAttribute('aria-label') ? el.getAttribute('aria-label') : el.textContent);

beforeEach(() => {
  document.body.innerHTML = `
    <div class="ctrl-row" id="row-label"><span>Modo Fácil</span>
      <button id="btn-label" type="button" aria-label="Modo Fácil, desligado">▶ Desligado</button></div>
    <div class="ctrl-row" id="row-text"><span>Alternância</span>
      <button id="btn-text" type="button">▶ Desligado</button></div>
    <button class="pm-btn" id="opener" type="button">Acessibilidade motora</button>`;
});

describe('ui/changed-mark — a marca visual', () => {
  it('[Right] põe a classe na linha alterada e tira quando ela volta ao padrão', () => {
    const row = $('#row-label');
    markChanged(translate, row, true);
    expect(row.classList.contains(CHANGED_CLASS)).toBe(true);
    markChanged(translate, row, false);
    expect(row.classList.contains(CHANGED_CLASS)).toBe(false);
  });

  it('[Right] é idempotente — chamar dez vezes com o mesmo valor dá o mesmo resultado', () => {
    // The panels call this from inside `reflect*`, which runs at every change of any control.
    const row = $('#row-text');
    for (let i = 0; i < 10; i++) markChanged(translate, row, true);
    expect(row.classList.contains(CHANGED_CLASS)).toBe(true);
    expect(nome($('#btn-text')).match(/alterado/g)).toHaveLength(1); // ONCE, not ten times
  });

  it('[Interface] NÃO mexe no texto visível — quem reescreve o rótulo a cada reflect são os painéis', () => {
    markChanged(translate, $('#row-text'), true);
    expect($('#btn-text').textContent).toBe('▶ Desligado');
    markChanged(translate, $('#row-label'), true);
    expect($('#btn-label').textContent).toBe('▶ Desligado');
  });

  it('[Zero] elemento nulo não lança — um painel sem a linha no DOM não pode derrubar o resto', () => {
    expect(() => markChanged(translate, null, true)).not.toThrow();
  });
});

describe('ui/changed-mark — o nome acessível, pelos dois caminhos', () => {
  it('[Right] com aria-label: o sufixo entra NO label, porque ele vence o conteúdo', () => {
    markChanged(translate, $('#row-label'), true);
    expect($('#btn-label').getAttribute('aria-label')).toBe('Modo Fácil, desligado, alterado');
  });

  it('[Right] sem aria-label: um é CRIADO a partir do conteúdo, para o sufixo ter onde entrar', () => {
    markChanged(translate, $('#row-text'), true);
    expect($('#btn-text').getAttribute('aria-label')).toBe('▶ Desligado, alterado');
  });

  it('[Right] desmarcar DEVOLVE o nome original, sem sobra dos dois caminhos', () => {
    // The base is kept in dataset precisely so it need not be rebuilt by removing text with a regex — that would break
    // silently the day the suffix's translation changed.
    markChanged(translate, $('#row-label'), true);
    markChanged(translate, $('#row-label'), false);
    expect($('#btn-label').getAttribute('aria-label')).toBe('Modo Fácil, desligado');

    markChanged(translate, $('#row-text'), true);
    markChanged(translate, $('#row-text'), false);
    expect($('#btn-text').hasAttribute('aria-label')).toBe(false); // created by us → gone entirely
  });

  it('[Boundary] alternar marcado→limpo→marcado não acumula sufixo', () => {
    const btn = $('#btn-label');
    markChanged(translate, $('#row-label'), true);
    markChanged(translate, $('#row-label'), false);
    markChanged(translate, $('#row-label'), true);
    expect(btn.getAttribute('aria-label')).toBe('Modo Fácil, desligado, alterado');
  });

  it('[Interface] linha com DOIS controles: o sufixo vai no PRIMEIRO, e só nele', () => {
    // A mixer row has volume + on/off. Whoever tabs reaches the volume first, so that is where changed needs to come out
    // — before the child decides whether to stop on this row. And only there: repeating it on both would have the reader
    // say the same thing twice while crossing a single row.
    //
    // This case exists because the choice was an ACCIDENT of DOM order until it was checked in the game. Now reordering
    // the markup breaks here, instead of moving the suffix silently.
    document.body.innerHTML =
      '<div class="ctrl-row" id="mix"><span>Música</span>' +
      '<input type="range" aria-label="Volume de Música">' +
      '<button type="button" aria-label="Música"></button></div>';
    markChanged(translate, $('#mix'), true);
    expect($('#mix input').getAttribute('aria-label')).toBe('Volume de Música, alterado');
    expect($('#mix button').getAttribute('aria-label')).toBe('Música');
  });

  it('[Interface] a linha SEM controle dentro recebe o sufixo nela mesma', () => {
    document.body.innerHTML = '<div class="ctrl-row" id="solo">Contraste</div>';
    markChanged(translate, $('#solo'), true);
    expect($('#solo').getAttribute('aria-label')).toBe('Contraste, alterado');
  });
});

describe('ui/changed-mark — a marca sobe para o menu', () => {
  it('[Right] o botão que abre o menu fica marcado se QUALQUER opção dentro está', () => {
    markMenuChanged(translate, $('#opener'), [false, false, true]);
    expect($('#opener').classList.contains(CHANGED_CLASS)).toBe(true);
    // and the suffix its name gains is said in the language of the `t` it is handed (ADR-0232 D3), not as a key
    expect($('#opener').getAttribute('aria-label')).toContain(translate('a11y.changed'));
    expect($('#opener').getAttribute('aria-label'), 'the menu opener carries a raw key').not.toContain('a11y.changed');
  });

  it('[Boundary] desmarca só quando a ÚLTIMA opção volta ao padrão, não a primeira', () => {
    // The interesting failure lives here: with `every` in place of `some`, the menu would clear the mark as soon as ONE
    // option went back to default, and the other changed ones would be hidden behind a menu that says it is untouched.
    // The child would look everywhere except where it is.
    const opener = $('#opener');
    markMenuChanged(translate, opener, [true, true]);
    markMenuChanged(translate, opener, [false, true]);
    expect(opener.classList.contains(CHANGED_CLASS)).toBe(true);
    markMenuChanged(translate, opener, [false, false]);
    expect(opener.classList.contains(CHANGED_CLASS)).toBe(false);
  });

  it('[Zero] lista vazia = menu no padrão', () => {
    markMenuChanged(translate, $('#opener'), []);
    expect($('#opener').classList.contains(CHANGED_CLASS)).toBe(false);
  });
});
