// SPDX-License-Identifier: AGPL-3.0-or-later
// A GAME EXPLAINS THE ITEM UNDER ITS OWN CURSOR IN THE ENGINE'S FOOTER (ADR-0244).
//
// 📌 The Dev, on the demo quiz: «Tela inicial para escolher a habilidade via sigla da BNCC (explicação no rodapé).» The footer
// is the engine's; `Engine.explain(text)` makes the game's text its RESTING text, and the engine's own items take the footer
// while pointed and give it BACK to that text — not to empty.
//
// 📌 A BROWSER FILE with the real stylesheet: «the footer is shown» and «two lines at most» are what the child sees.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import css from '../app/css/style.css?raw';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let raiz, motor;
const TEXTO = 'EF05MA08 — Resolver problemas de multiplicação e divisão.';
const banda = () => raiz.querySelector('#game-region .barra-explicacao');
/** What the child sees in the band: its words while it is drawn, nothing while it is not. */
const naBanda = () => {
  const b = banda();
  return b && !b.hidden && b.getClientRects().length > 0 ? b.textContent : null;
};
const icone = (k) => raiz.querySelector(`#title-icons .pi-btn[data-pi="${k}"]`);
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
});
const seta = () => raiz.querySelector('#game-region').dispatchEvent(
  new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown', bubbles: true, cancelable: true }));

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  const { createGame } = await import('../app/js/boot/create-game.js');
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1" style="position:relative;width:640px;height:360px"><div id="title-icons"></div></div>';
  document.body.appendChild(raiz);
  motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false });
});

describe('Engine.explain — the game\'s text is the footer\'s resting text (ADR-0244)', () => {
  it('🔴 [Right] §1 — `explain(text)` shows the text in the engine\'s footer band', () => {
    expect(naBanda(), 'the band shows something before the game explained anything').toBeNull();
    motor.explain(TEXTO);
    expect(naBanda(), 'the game\'s text is not in the footer').toBe(TEXTO);
    // ONE band: the game's text is not a second footer beside the engine's (the three zones, CLAUDE.md §4)
    expect(raiz.querySelectorAll('#game-region .rodape-da-tela').length).toBe(1);
    expect(raiz.querySelectorAll('#game-region .barra-explicacao').length).toBe(1);
  });

  it('🔴 [Right] §2 — a quick-bar icon takes the footer while pointed, and gives it BACK to the game\'s text when it leaves', () => {
    motor.explain(TEXTO);
    icone('blind').dispatchEvent(new MouseEvent('mouseenter'));
    // the icon's explanation is a literal: read through `t()` it would move with the dictionary and prove nothing
    expect(naBanda(), 'the pointed icon did not take the footer').toBe('Joga-se pelo som: a navegação sonora diz o que a tela mostra.');
    icone('blind').dispatchEvent(new MouseEvent('mouseleave'));
    expect(naBanda(), 'the icon left the footer empty instead of giving it back').toBe(TEXTO);
  });

  it('🔴 [Right] §2 — the game explaining again while an icon is pointed waits under it, and shows when the icon leaves', () => {
    motor.explain(TEXTO);
    icone('blind').dispatchEvent(new MouseEvent('mouseenter'));
    motor.explain('EF06LI17 — Construir repertório lexical.');
    expect(naBanda(), 'the game\'s text covered the pointed icon\'s explanation').toBe('Joga-se pelo som: a navegação sonora diz o que a tela mostra.');
    icone('blind').dispatchEvent(new MouseEvent('mouseleave'));
    expect(naBanda(), 'the icon gave the footer back to the OLD text').toBe('EF06LI17 — Construir repertório lexical.');
  });

  it('🔴 [Right] §2 — a pause-card item\'s reason takes the footer, and closing the card gives it back', async () => {
    motor.explain(TEXTO);
    motor.pause.show(0);
    try {
      const travado = raiz.ownerDocument.querySelector('#vp-pause-0 .pm-btn[data-act="addplayer"]');
      expect(travado?.getAttribute('aria-disabled'), 'no locked item — the case would measure nothing').toBe('true');
      for (let i = 0; i < 6 && raiz.ownerDocument.querySelector('#vp-pause-0 .pm-sel') !== travado; i++) seta();
      expect(naBanda(), 'the locked item\'s reason did not take the footer').toBe('Quem decide quantos jogadores podem jogar é o jogo.');
      seta(); // the next item is not locked: its reason goes, and the game's text comes back under the card
      expect(naBanda(), 'leaving the locked item emptied the footer').toBe(TEXTO);
      for (let i = 0; i < 6 && raiz.ownerDocument.querySelector('#vp-pause-0 .pm-sel') !== travado; i++) seta();
      expect(naBanda()).toBe('Quem decide quantos jogadores podem jogar é o jogo.');
      // the card closed by its own door, Escape at its root («continuar»): the reason does not stay over the game
      raiz.querySelector('#game-region').dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 20));
      expect(raiz.ownerDocument.getElementById('vp-pause-0').hidden, 'Escape did not close the card').toBe(true);
      expect(naBanda(), 'closing the card left the item\'s reason, or nothing, instead of the game\'s text').toBe(TEXTO);
    } finally {
      if (!raiz.ownerDocument.getElementById('vp-pause-0').hidden) motor.pause.hide(0);
    }
  });

  it('🔴 [Zero] `explain(null)` clears it — no dark band left over the game', () => {
    motor.explain(TEXTO);
    motor.explain(null);
    expect(naBanda(), 'the text stayed after explain(null)').toBeNull();
    expect(getComputedStyle(raiz.querySelector('#game-region .rodape-da-tela')).display, 'an empty band stays over the game').toBe('none');
    // and with nothing to give back to, a pointed icon that leaves leaves nothing
    icone('blind').dispatchEvent(new MouseEvent('mouseenter'));
    icone('blind').dispatchEvent(new MouseEvent('mouseleave'));
    expect(naBanda()).toBeNull();
  });

  it('🔴 [Boundary] §3 — the game\'s text follows the footer\'s rule: two lines at most, however long (ADR-0164)', () => {
    motor.explain(`${TEXTO} `.repeat(12));
    const b = banda();
    const linha = parseFloat(getComputedStyle(b).lineHeight);
    const s = getComputedStyle(b);
    // the box less its padding and borders — the edge margin under the words is a transparent border (interface log 2026-09-26)
    const altura = b.getBoundingClientRect().height - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom)
      - parseFloat(s.borderTopWidth) - parseFloat(s.borderBottomWidth);
    expect(b.scrollHeight, 'the text is not long enough to measure the cut').toBeGreaterThan(2 * linha + 0.5);
    expect(altura, 'the game\'s text runs past two lines').toBeLessThanOrEqual(2 * linha + 0.5);
    const regiao = raiz.querySelector('#game-region').getBoundingClientRect();
    expect(Math.abs(b.getBoundingClientRect().bottom - regiao.bottom), 'the game\'s text is not at the lowest edge').toBeLessThan(1);
    motor.explain(null);
  });

  it('🔴 [Right] releasing the cartridge clears its explanation — `unmount()`, and `mount()` of another', () => {
    motor.explain(TEXTO);
    motor.unmount();
    expect(naBanda(), 'the released cartridge\'s text stayed in the footer').toBeNull();
    motor.mount(declaracao(), { accommodations: SEM_ASSUNTO });
    motor.explain(TEXTO);
    motor.mount(declaracao(), { accommodations: SEM_ASSUNTO });
    expect(naBanda(), 'the replaced cartridge\'s text stayed in the footer').toBeNull();
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (2026-09-26; applied by script, each occurrence counted first, restored from a copy and checked by sha256) — 8 of 8 red:
//   E1 `Engine.explain` does nothing                                   🔴 §1, §2 (four cases)
//   E2 an item leaving also forgets the game's text                     🔴 the icon, the text waiting, the pause card
//   E3 the game's text shown OVER the pointed item                      🔴 the icon, the text waiting, the pause card, null
//   E4 `explain(null)` keeps the old text                              🔴 null, releasing the cartridge
//   E5 `unmount()` keeps the released cartridge's text                 🔴 releasing the cartridge
//   E6 `mount()` of another keeps the replaced cartridge's text        🔴 releasing the cartridge
//   E7 leaving the pause does not take the item's reason away          🔴 the pause card, null, releasing
//   E8 the game's text in a band of its own                            🔴 the icon, the text waiting, the pause card, null
