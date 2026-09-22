// SPDX-License-Identifier: AGPL-3.0-or-later
// A PRESS HELD ON A MENU ITEM PLACES THE CURSOR THERE AND SAYS IT, WITHOUT ACTIVATING IT (ADR-0159 rule 2, erratum of
// 2026-09-13; issue #153).
//
// «Deixar o dedo apertado ou o botão do mouse apertado sobre o item deve dar a função de posicionar o cursor sem
// "apertar".» (Dev) — the answer to «which input repeats the current item», once ADR-0166 took the on-screen pad out of
// every menu. 📏 Measured before building: a pointer on an item had one meaning, activation; a child who touches to FIND
// an item before choosing it had no way to hear it without choosing it.
//
// 📌 The REAL quiz page, events dispatched in the browser's order: `pointerdown`, time, `pointerup`, then the `click`
// the browser would fire on release. Threshold 500 ms (the iOS long-press default, recorded in the erratum).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';

let regiao;
const falas = [];
const esperar = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const tecla = (code) => (document.activeElement && document.activeElement !== document.body ? document.activeElement : regiao)
  .dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
/** A press on `el` held for `ms`, released, and the click the browser fires on release. */
async function premir(el, ms) {
  const opcoes = { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true };
  el.dispatchEvent(new PointerEvent('pointerdown', opcoes));
  await esperar(ms);
  el.dispatchEvent(new PointerEvent('pointerup', opcoes));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await esperar();
}
const cartao = () => document.querySelector('.screen-pause:not([hidden])');
const lista = () => cartao()?.querySelector('.pause-menu:not([hidden])');

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
  const status = document.getElementById('sr-status');
  new MutationObserver(() => { if (status.textContent) falas.push(status.textContent); })
    .observe(status, { childList: true, characterData: true, subtree: true });
  regiao.focus();
  tecla('KeyF');
  await esperar();
});

describe('a press held on a pause card item', () => {
  it('🔴 [Right] places the cursor on it and says it, «N de M» — and releasing does NOT activate it', async () => {
    expect(lista()?.dataset.sub, 'the card did not open at its root').toBe('raiz');
    const porta = lista().querySelector('.pm-btn[data-act="options"]');
    const itens = [...lista().querySelectorAll('.pm-btn:not([hidden])')];
    falas.length = 0;
    await premir(porta, 650);
    expect(porta.classList.contains('pm-sel'), 'the cursor did not move to the held item').toBe(true);
    expect(falas.join(' | '), 'the held item was not said with its place').toContain(`${itens.indexOf(porta) + 1} de ${itens.length}`);
    expect(lista().dataset.sub, 'releasing the hold activated the item').toBe('raiz');
  });

  it('🎯 [Boundary] a press shorter than the hold still activates — the ordinary tap is untouched', async () => {
    const porta = lista().querySelector('.pm-btn[data-act="options"]');
    await premir(porta, 150);
    expect(lista().dataset.sub, 'a short tap no longer activates').toBe('opcoes');
    tecla('Escape');
    await esperar();
    expect(lista().dataset.sub).toBe('raiz');
  });
});

describe('a press held on a panel item', () => {
  it('🔴 [Right] focuses the control and says it — and releasing does NOT toggle it', async () => {
    lista().querySelector('.pm-btn[data-act="options"]').click();
    await esperar();
    lista().querySelector('.pm-btn[data-act="som"]').click();
    await esperar();
    const painel = [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);
    const interruptor = painel.querySelector('#audio-list button[aria-pressed]');
    expect(interruptor, 'no switch in the panel — the case would measure nothing').toBeTruthy();
    const antes = interruptor.getAttribute('aria-pressed');
    const nome = interruptor.getAttribute('aria-label');
    falas.length = 0;
    await premir(interruptor, 650);
    // the render may rebuild the row; the control is found again by its name
    const agora = [...painel.querySelectorAll('#audio-list button[aria-pressed]')].find((b) => b.getAttribute('aria-label') === nome);
    expect(document.activeElement, 'focus did not land on the held control').toBe(agora);
    expect(falas.join(' | '), 'the held control was not said').toContain(nome);
    expect(agora.getAttribute('aria-pressed'), 'releasing the hold toggled the switch').toBe(antes);
  });

  it('🎯 [Zero] after a hold, the NEXT short tap is not swallowed', async () => {
    const painel = [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);
    const interruptor = painel.querySelector('#audio-list button[aria-pressed]');
    const nome = interruptor.getAttribute('aria-label');
    const antes = interruptor.getAttribute('aria-pressed');
    await premir(interruptor, 100);
    const agora = [...painel.querySelectorAll('#audio-list button[aria-pressed]')].find((b) => b.getAttribute('aria-label') === nome);
    expect(agora.getAttribute('aria-pressed'), 'the tap after a hold did nothing').not.toBe(antes);
    // a short tap leaves no hold behind: past the threshold, the keyboard path's click on the same item still works
    await esperar(600);
    const alcancado = [...painel.querySelectorAll('#audio-list button[aria-pressed]')].find((b) => b.getAttribute('aria-label') === nome);
    alcancado.click(); // put it back, the way `navDialog` confirms
    await esperar();
    const depois = [...painel.querySelectorAll('#audio-list button[aria-pressed]')].find((b) => b.getAttribute('aria-label') === nome);
    expect(depois.getAttribute('aria-pressed'), 'the short tap left a hold running, and it swallowed the next click').toBe(antes);
  });

  it('🎯 [Zero] a hold released OFF the item fires no click — and the next tap on it still toggles', async () => {
    const painel = [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);
    const achar = (nome) => [...painel.querySelectorAll('#audio-list button[aria-pressed]')].find((b) => b.getAttribute('aria-label') === nome);
    const nome = painel.querySelector('#audio-list button[aria-pressed]').getAttribute('aria-label');
    const opcoes = { bubbles: true, cancelable: true, pointerId: 8, pointerType: 'mouse', isPrimary: true };
    achar(nome).dispatchEvent(new PointerEvent('pointerdown', opcoes));
    await esperar(650);
    painel.dispatchEvent(new PointerEvent('pointerup', opcoes)); // released elsewhere: the browser fires no click
    const antes = achar(nome).getAttribute('aria-pressed');
    await premir(achar(nome), 100);
    expect(achar(nome).getAttribute('aria-pressed'), 'the tap after an unfinished hold was swallowed').not.toBe(antes);
    await premir(achar(nome), 100); // put it back
  });

  it('🎯 [Zero] a hold released off the item does not swallow a click that comes from the KEYBOARD path', async () => {
    const painel = [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);
    const botoes = [...painel.querySelectorAll('#audio-list button[aria-pressed]')];
    const [a, b] = botoes.map((x) => x.getAttribute('aria-label'));
    const achar = (nome) => [...painel.querySelectorAll('#audio-list button[aria-pressed]')].find((x) => x.getAttribute('aria-label') === nome);
    const opcoes = { bubbles: true, cancelable: true, pointerId: 9, pointerType: 'mouse', isPrimary: true };
    achar(a).dispatchEvent(new PointerEvent('pointerdown', opcoes));
    await esperar(650);
    painel.dispatchEvent(new PointerEvent('pointerup', opcoes));
    const antes = achar(b).getAttribute('aria-pressed');
    achar(b).click(); // what `navDialog` does on «confirm»: a click with no pointer before it
    await esperar();
    expect(achar(b).getAttribute('aria-pressed'), 'the keyboard\'s click on another item was swallowed').not.toBe(antes);
    achar(b).click();
    await esperar();
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   H1 the click after a hold is never swallowed      🔴 all six
//   H2 no hold timer                                   🔴 all six
//   H3 threshold 100 ms                                🔴 the short taps
//   H4 releasing does not cancel the hold              🔴 [Zero] next tap — FIRST SURVIVED: the case ended before the
//      stray timer fired; it now waits past the threshold and confirms from the keyboard path
//   H5 a new press does not clear the pending swallow  🔴 [Zero] released off the item
//   H6 any click is swallowed, not the held item's     🔴 [Zero] keyboard path
//   H7 the hold does not move/say on the pause card    🔴 pause card
//   H8 the hold does not focus in a panel              🔴 panel
//   H9 panels ignored (pause card only)                🔴 panel
//   (a re-lookup of the item at timeout SURVIVED: a detached target fell back to the pressed item anyway — it left)
