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
    /*
     * 📌 THE CURSOR WALKS TO THE DOOR WITH ARROWS, and it is not ceremony: opening the panel with a click leaves the mark
     * on the FIRST item, and on the way back «o item marcado» and «o primeiro» coincide — the case could not tell them
     * apart. A child who navigates gets there with arrows, and that is when telling them the first item sends them
     * looking where they are not. 📏 Measured: without these arrows the mark came back at 0 and the assertion below
     * measured nothing.
     */
    for (let i = 0; i < 12 && cartao.querySelector('.pause-menu:not([hidden]) .pm-sel') !== porta; i++) {
      await depoisDe(() => tecla('ArrowDown'));
    }
    expect(cartao.querySelector('.pause-menu:not([hidden]) .pm-sel'), 'the cursor never reached the panel\'s door').toBe(porta);
    const aberta = await depoisDe(() => porta.click());
    const painel = [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);
    const titulo = painel.querySelector('h2').textContent.trim();
    expect(aberta.startsWith(`${titulo}. `), `«${aberta}» does not open with the panel title «${titulo}»`).toBe(true);
    const fechada = await depoisDe(() => tecla('Escape'));
    expect(painel.hidden, 'Escape did not close the panel').toBe(true);
    const submenu = cartao.querySelector('.pm-btn[data-act="options"]');
    const nomeDoSubmenu = submenu.getAttribute('aria-label') || submenu.textContent.trim();
    expect(fechada.startsWith(`${nomeDoSubmenu}. `), `back from the panel said «${fechada}», not where the child is`).toBe(true);
    /*
     * 🔴 AND IT SAYS THE ITEM WHERE THE CHILD IS, not the first on the list — the missing half, found by a probe on
     * 2026-09-22: swapping «o item marcado» for «o primeiro» left the suite green. Coming BACK from a panel the cursor is
     * on the item that opened it, which is almost never the first; saying the first sends the child looking where they
     * are not.
     */
    const marcado = cartao.querySelector('.pause-menu:not([hidden]) .pm-sel');
    expect(marcado, 'nothing is marked on the card — the case would measure nothing').not.toBeNull();
    const itens = [...cartao.querySelectorAll('.pause-menu:not([hidden]) .pm-btn:not([hidden])')];
    expect(itens.indexOf(marcado), 'the cursor came back to the FIRST item, so the case cannot tell the two apart')
      .toBeGreaterThan(0);
    const nomeDoItem = marcado.getAttribute('aria-label') || marcado.textContent.trim();
    expect(fechada, `back from the panel announced «${fechada}» instead of the item the cursor is on, «${nomeDoItem}»`)
      .toContain(nomeDoItem);
    expect(fechada, 'the announced position is not the marked item\'s')
      .toMatch(new RegExp(`, ${itens.indexOf(marcado) + 1} de ${itens.length}$`));
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

  it('🔴 [CrossCheck] going from ONE panel to ANOTHER is a change of place, and is announced', async () => {
    /*
     * 🔴 THE PROBE FOUND THIS BLIND on 2026-09-22: a panel's key could stop saying WHICH panel, and two panels read as the
     * same place — with the suite green. Every other case in this file crosses the card between one panel and another,
     * and there the key changes because of the card; only a direct panel→panel step tells them apart.
     * 📌 And the path really exists: the motor panel's «mapear teclado» row opens `#ctrl` ON TOP of it.
     */
    await depoisDe(() => tecla('KeyF'));
    document.querySelector('.screen-pause:not([hidden]) .pm-btn[data-act="options"]').click();
    await esperar();
    const motora = document.querySelector('.screen-pause:not([hidden]) .pm-btn[data-act="motora"]');
    expect(motora, 'no motor panel on the card — the case would measure nothing').not.toBeNull();
    const aberta = await depoisDe(() => motora.click());
    const painelMotora = [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);
    const tituloMotora = painelMotora.querySelector('h2').textContent.trim();
    expect(aberta.startsWith(`${tituloMotora}. `), `the motor panel opened saying «${aberta}»`).toBe(true);

    const porta = document.getElementById('opt-teclado-1');
    expect(porta, 'no «map the keyboard» row — the case would measure nothing').not.toBeNull();
    const segunda = await depoisDe(() => porta.click());
    const painelCtrl = document.getElementById('ctrl');
    expect(painelCtrl.hidden, 'the controls panel did not open').toBe(false);
    const tituloCtrl = painelCtrl.querySelector('h2').textContent.trim();
    expect(tituloCtrl, 'the two panels have the same title — the case cannot tell them apart').not.toBe(tituloMotora);
    expect(segunda.startsWith(`${tituloCtrl}. `),
      `moving from one panel to another said «${segunda}» instead of naming «${tituloCtrl}»`).toBe(true);
    /*
     * 📏 AND THIS LINE IS WHAT MAKES A SURVIVING MUTATION HONEST instead of unexplained: reading a panel's FOCUSED item or
     * always reading the first gives the same result, because the instant a panel becomes the child's place its focus
     * is on its first item. The 22/09 probe measured it and this case measures it again — the day a panel opens with
     * focus elsewhere, this assertion fails and the mutation stops being equivalent.
     */
    const itensDoCtrl = [...painelCtrl.querySelectorAll('.overlay__card button:not([hidden]), .overlay__card [tabindex]:not([hidden])')]
      .filter((el) => el.offsetParent !== null);
    expect(itensDoCtrl.indexOf(document.activeElement),
      'a panel opened with focus somewhere other than its first item: reading the focused item is no longer the same as reading the first')
      .toBeLessThanOrEqual(0);
    await depoisDe(() => tecla('Escape'));
    await depoisDe(() => tecla('Escape'));
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
//
// ---- PROBED AGAIN ON 2026-09-22, before `ondeEsta` is cut out of the composition root (ADR-0221 step 7c) ----
// Nine decisions of `ondeEsta` disabled one at a time. FOUR were blind, and all four cost the child who plays by ear:
//   P3 the FOCUSED item of a panel ignored            ⚠️ EQUIVALENT TODAY — see the measurement in the last case:
//                                                        a panel becomes the child's place with focus on its first item
//   P4 `comIndice` replaced by `true`                 ⚠️ NOT held anywhere: 📏 both tests that pass `comIndice` pass
//                                                        `() => true`, so ADR-0167's «the cartridge can silence the
//                                                        index» has no case at all. Wider than this file; named, not faked
//   P8 the card's SELECTED item ignored               🔴 now red — the cursor is walked to the door with arrows first,
//                                                        because opening by click leaves the mark on the first item and
//                                                        the two readings coincide
//   P9 a panel's key not saying WHICH panel           🔴 now red — panel→panel, which every other case here crosses the
//                                                        card to reach, and the card is what was hiding it
