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
     * 📌 O CURSOR VAI ATÉ À PORTA COM SETAS, e não é cerimónia: abrir o painel com um clique deixa a marca no PRIMEIRO
     * item, e ao voltar «o item marcado» e «o primeiro» são o mesmo — o caso não conseguiria distingui-los. Uma criança
     * que navega chega ali com setas, e é essa a situação em que dizer-lhe o primeiro item a manda procurar onde ela
     * não está. 📏 Medido: sem estas setas a marca voltava em 0 e a asserção de baixo não media nada.
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
     * 🔴 E DIZ O ITEM ONDE A CRIANÇA ESTÁ, e não o primeiro da lista — a metade que faltava, achada por sonda em
     * 2026-09-22: trocar «o item marcado» por «o primeiro» deixava a suíte verde. Ao VOLTAR de um painel o cursor está
     * no item que o abriu, que é quase nunca o primeiro; dizer-lhe o primeiro manda-a procurar onde ela não está.
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
     * 🔴 A SONDA ACHOU ISTO CEGO em 2026-09-22: a chave de um painel podia deixar de dizer QUAL painel, e dois painéis
     * passavam a ler-se como o mesmo sítio — com a suíte verde. Todos os outros casos deste ficheiro atravessam o
     * cartão entre um painel e outro, e aí a chave muda por causa do cartão; só painel→painel directo os separa.
     * 📌 E o caminho existe de verdade: a linha «mapear teclado» do painel motora abre o `#ctrl` POR CIMA dele.
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
     * 📏 E ESTA LINHA É O QUE TORNA HONESTA UMA MUTAÇÃO QUE SOBREVIVE, em vez de a deixar sem explicação: ler o item
     * FOCADO de um painel ou ler sempre o primeiro dá o mesmo resultado, porque no instante em que um painel passa a
     * ser o sítio da criança o foco está no primeiro item dele. A sonda de 22/09 mediu-o e este caso mede-o de novo —
     * o dia em que um painel abrir com o foco noutro sítio, esta asserção cai e a mutação deixa de ser equivalente.
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
