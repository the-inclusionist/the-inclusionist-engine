// SPDX-License-Identifier: AGPL-3.0-or-later
// A LANGUAGE CHANGED MID-GAME REDRAWS WHAT IS ON SCREEN, AND DOES NOT MOVE THE CHILD (study item C6; ADR-0031).
//
// 📏 Measured on 2026-09-13 in the real quiz page: pause card open, settings submenu, the «Conforto auditivo» panel open,
// a control focused — then `setLocale('en')`. EVERYTHING the engine had drawn stayed in Portuguese: the panel's title,
// rows, «Voltar», «Restaurar», the idle footer, the «2: confirmar» legend, and the accessible names of the icon bar
// and of the card. `core/i18n` dispatched `i18n:change`, and nothing under `createGame` listened.
//
// 📌 ADR-0031's confirmation is followed literally, trap included: staleness is tested AS staleness — the panel after
// the change must read exactly as the same panel reopened in the new language —, and focus is tested by PLACE and not
// by «somewhere inside»: a redraw that puts the cursor back on «Voltar» (item 1) passes a careless version.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';
import { itensNavegaveis } from '../app/js/ui/menu-items.ts';
import { setLocale, t } from '../app/js/core/i18n.ts';

let regiao;
const esperar = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const painelAberto = () => [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);
const textoDo = (el) => [...el.querySelectorAll('h2, strong, button, .opt-explain')].map((n) => n.textContent.trim()).join(' | ');

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  document.querySelector('.stage-wrap').style.cssText = 'width:700px;height:420px;display:flex;flex:none';
  await import('../app/js/consumer-quiz/main-quiz.ts');
  await esperar();
  regiao = document.getElementById('game-region');
  regiao.focus();
  regiao.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true, cancelable: true }));
  await esperar();
  document.querySelector('.screen-pause:not([hidden]) .pm-btn[data-act="options"]').click();
  await esperar();
  document.querySelector('.screen-pause:not([hidden]) .pm-btn[data-act="som"]').click();
  await esperar();
});
afterAll(async () => { await setLocale('pt'); });

describe('a language changed with a panel open', () => {
  const antes = {};

  it('🔴 [Right] the panel redraws WITHOUT reopening, and reads exactly as the same panel reopened', async () => {
    const painel = painelAberto();
    expect(painel, 'no panel open — the case would measure nothing').toBeTruthy();
    const card = painel.querySelector('.overlay__card');
    const itens = itensNavegaveis(card);
    // a row the panel's own render rebuilds (the category list), so identity cannot survive by accident
    antes.alvo = itens.find((el) => el.closest('#audio-list'));
    expect(antes.alvo, 'no rebuilt row to focus').toBeTruthy();
    antes.alvo.focus();
    antes.indice = itensNavegaveis(card).indexOf(antes.alvo);
    antes.tituloPt = painel.querySelector('h2').textContent.trim();
    antes.barraPt = [...document.querySelectorAll('.pi-btn')].map((b) => b.getAttribute('aria-label'));

    await setLocale('en');
    await esperar(200);
    const depois = textoDo(card);
    expect(painel.hidden, 'the change closed the panel').toBe(false);
    expect(painel.querySelector('h2').textContent.trim(), 'the title is still the old language').not.toBe(antes.tituloPt);
    antes.focoIndice = itensNavegaveis(card).indexOf(document.activeElement);
    antes.focoConectado = document.activeElement.isConnected;
    antes.focoNaLista = !!document.activeElement.closest('#audio-list');

    // the reference: the same panel closed and reopened in English
    painel.querySelector('.overlay__back').click();
    await esperar();
    document.querySelector('.screen-pause:not([hidden]) .pm-btn[data-act="som"]').click();
    await esperar();
    expect(textoDo(painelAberto().querySelector('.overlay__card')), 'the redrawn panel differs from a fresh open').toBe(depois);
  });

  it('🔴 [Right] focus stays at the SAME place — not on «Voltar», not on the body', () => {
    expect(antes.focoIndice, 'focus left the panel\'s items').toBe(antes.indice);
    expect(antes.indice, 'the case focused item 1, where a careless redraw lands anyway').toBeGreaterThan(0);
    expect(antes.focoConectado, 'focus sits on a node the redraw removed').toBe(true);
    expect(antes.focoNaLista, 'focus moved off the rebuilt row').toBe(true);
  });

  it('🔴 [Right] the icon bar and the pause card speak the new language', () => {
    const barra = [...document.querySelectorAll('.pi-btn')].map((b) => b.getAttribute('aria-label'));
    barra.forEach((nome, i) => { expect(nome, `bar icon ${i + 1} kept its old name`).not.toBe(antes.barraPt[i]); });
    const cartao = document.querySelector('.screen-pause:not([hidden]) .pause-card');
    expect(cartao.getAttribute('aria-label')).toBe(t('pause.cardAria', { n: 1 }));
  });

  it('🔴 [Right] the button legend speaks the new language', () => {
    const fichas = [...document.querySelectorAll('.pausa-legenda:not([hidden]) .lg-nome')].map((s) => s.textContent.trim());
    expect(fichas).toEqual(t('pause.card.legenda').split('·').map((s) => s.trim()));
  });
});

describe('a language changed on the quick pause', () => {
  it('🔴 [Right] the PAUSED word speaks the new language without leaving the pause', async () => {
    const tecla = (code) => (document.activeElement && document.activeElement !== document.body ? document.activeElement : regiao)
      .dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
    for (let i = 0; i < 4 && (painelAberto() || document.querySelector('.screen-pause:not([hidden])')); i++) { tecla('Escape'); await esperar(); }
    expect(document.querySelector('.screen-pause:not([hidden])'), 'the card did not close — the case would measure the card').toBeNull();
    regiao.focus();
    tecla('KeyH');
    await esperar();
    const pausado = document.querySelector('#game-region .pausa-rapida');
    expect(pausado?.hidden, 'START did not open the quick pause').toBe(false);
    await setLocale('es');
    await esperar(200);
    expect(pausado.hidden, 'the change left the quick pause').toBe(false);
    expect(pausado.textContent).toBe(t('pause.quick'));
    expect(t('pause.quick'), 'es and en share the word — the case would not tell them apart').not.toBe('PAUSED');
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (with `pad-no-idioma-do-arranque` and `barra-no-idioma-do-arranque`, which now exercise the same listener at boot)
//   M1  no language listener on the panel            🔴 redraw + focus
//   M2  no focus restoration                         🔴 focus
//   M3  focus back to the removed node only          🔴 focus — the row really is rebuilt, identity cannot survive
//   M4  focus back to item 1                         🔴 focus
//   M5  hidden panels redraw too                     🔴 focus
//   M6  renumber after the redraw                    SURVIVED — the panel's observer already renumbers; the call left
//   M7  words not reapplied                          🔴 redraw
//   M8  render not called                            🔴 redraw
//   M9  bar and card not repainted                   🔴 bar/card + the boot bar
//   M10 legend not rewritten                         🔴 legend
//   M11 PAUSED not rewritten                         🔴 quick pause
//   M12 pad not redrawn                              🔴 the boot pad
//   M13 pad redrawn but not rewired                  🔴 the boot pad's pair
