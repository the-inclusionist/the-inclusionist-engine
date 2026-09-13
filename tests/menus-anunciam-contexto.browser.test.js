// SPDX-License-Identifier: AGPL-3.0-or-later
// EVERY CHANGE OF CONTEXT IS ANNOUNCED (ADR-0159 rule 3).
//
// «Opening a menu or panel speaks its title; closing it speaks where the child is back to; entering play is announced.»
// 📏 Measured in dist/quiz.html on 2026-09-12: SELECT opened the card in silence; entering the settings submenu said only
// «Back, 1 of 7»; opening a panel, closing it, going back to the root and closing the card said nothing. Only the quick
// pause announced its entry and exit.
//
// 📌 The REAL quiz page, keys dispatched the way a child gives them, and every string written to `#sr-status` recorded —
// the live region is what a child playing by ear hears, and it is written on the next frame, so each step waits.
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
/** What the live region says after a step: the last string written. */
async function depoisDe(passo) {
  falas.length = 0;
  passo();
  await esperar();
  return falas.at(-1) ?? '';
}

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
});

describe('a change of context says where the child is', () => {
  it('🔴 [Right] SELECT opens the card and says its TITLE, then the item under the cursor', async () => {
    const fala = await depoisDe(() => tecla('KeyF'));
    const cartao = document.querySelector('.screen-pause:not([hidden])');
    expect(cartao, 'SELECT did not open the card — the case would measure nothing').not.toBeNull();
    const titulo = cartao.querySelector('h2').textContent.trim();
    expect(fala, 'the card opened in silence, or without its title first').toMatch(new RegExp(`^${titulo}\\. .+, 1 de \\d+$`));
  });

  it('🔴 [Right] entering the settings submenu says the SUBMENU\'s name before its first item', async () => {
    const cartao = document.querySelector('.screen-pause:not([hidden])');
    const porta = cartao.querySelector('.pm-btn[data-act="options"]');
    const nome = porta.getAttribute('aria-label') || porta.textContent.trim();
    const fala = await depoisDe(() => porta.click());
    expect(fala.startsWith(`${nome}. `), `«${fala}» does not open with «${nome}»`).toBe(true);
  });

  it('🔴 [Right] opening a panel says the PANEL\'s title; closing it says where the child is back to', async () => {
    const cartao = document.querySelector('.screen-pause:not([hidden])');
    const porta = cartao.querySelector('.pm-btn[data-act="som"]');
    const aberta = await depoisDe(() => porta.click());
    const painel = [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);
    const titulo = painel.querySelector('h2').textContent.trim();
    expect(aberta.startsWith(`${titulo}. `), `«${aberta}» does not open with the panel title «${titulo}»`).toBe(true);
    const fechada = await depoisDe(() => tecla('Escape'));
    expect(painel.hidden, 'Escape did not close the panel').toBe(true);
    const submenu = cartao.querySelector('.pm-btn[data-act="options"]');
    const nomeDoSubmenu = submenu.getAttribute('aria-label') || submenu.textContent.trim();
    expect(fechada.startsWith(`${nomeDoSubmenu}. `), `back from the panel said «${fechada}», not where the child is`).toBe(true);
  });

  it('🔴 [Right] back to the root says the card\'s title; closing the card says the game is back', async () => {
    const cartao = document.querySelector('.screen-pause:not([hidden])');
    const titulo = cartao.querySelector('h2').textContent.trim();
    const raiz = await depoisDe(() => tecla('Escape'));
    expect(raiz.startsWith(`${titulo}. `), `back to the root said «${raiz}»`).toBe(true);
    const jogo = await depoisDe(() => tecla('Escape'));
    expect(cartao.hidden, 'Escape at the root did not close the card').toBe(true);
    expect(jogo).toBe('De volta ao jogo.');
  });

  it('🎯 [Zero] an arrow inside a menu still says only the item — no title repeated on every step', async () => {
    await depoisDe(() => tecla('KeyF'));
    const fala = await depoisDe(() => tecla('ArrowDown'));
    const titulo = document.querySelector('.screen-pause:not([hidden]) h2').textContent.trim();
    expect(fala.startsWith(`${titulo}.`), 'the title is repeated on every arrow').toBe(false);
    expect(fala).toMatch(/, 2 de \d+$/);
    // and a batch of attribute changes that leaves the child where they were says nothing again
    const cartao = document.querySelector('.screen-pause:not([hidden])');
    const repetida = await depoisDe(() => { cartao.hidden = true; cartao.hidden = false; });
    expect(repetida, 'the same screen was announced again').toBe('');
    await depoisDe(() => tecla('Escape'));
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   C1 the observer does not announce                    🔴 four cases
//   C2 a submenu change is not watched                   🔴 two cases
//   C3 no title before the card's item                   🔴 four cases
//   C4 a submenu named by the card title                 🔴 two cases
//   C5 the panel title missing                           🔴 two cases
//   C6 no word on going back to play                     🔴
//   C7 every observer batch speaks (no comparison)      🔴 the [Zero] case (after its second step was added)
