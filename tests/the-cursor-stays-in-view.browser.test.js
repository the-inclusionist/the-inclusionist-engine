// SPDX-License-Identifier: AGPL-3.0-or-later
// A MENU LONGER THAN THE SCREEN SCROLLS INSIDE ITS CARD, AND THE ITEM UNDER THE CURSOR IS ALWAYS WHOLLY IN VIEW (issue #134).
//
// The Dev: «os menus não rolam quando têm mais de 6 ítens. Configure pra isso por favor.» 📏 Measured at 640×360 on the
// quiz page before the change: the pause card DID scroll (765 px of items in 356), but its cursor is a class, not the
// browser's focus, so nothing scrolled it — ArrowDown walked the mark to 792 px on a card that ends at 390, with the list
// still at the top. And the card ran under the button legend: «Sair do jogo» at 288–332 px, the legend at 313–342. The
// panels were already right — the browser scrolls a focused control into view, within the card's scroll padding.
//
// 📌 The quiz page and the real stylesheet at the minimum stage, and a list longer than it (a game passes its own lists,
// ADR-0146). «In view» means inside the card's box AND above the band at the foot of the screen, which the card runs
// under. The PAGE never scrolls: a standing rule of the Dev's, asserted after every move.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';

let regiao, cartao;
const esperar = (ms = 30) => new Promise((r) => setTimeout(r, ms));
function key(code) {
  const target = document.activeElement && document.activeElement !== document.body ? document.activeElement : regiao;
  target.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
}
/**
 * The top of what covers the foot of the screen, or the region's bottom when nothing does: with a panel open, its
 * explanation band (the panel is drawn over everything else); with the card, the screen's legend column and the HUD row.
 */
function bandTop() {
  const panel = [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);
  const covers = panel ? [...panel.querySelectorAll('.opt-explain')] : [...regiao.querySelectorAll('.rodape-da-tela > *, .hud-row')];
  const shown = covers.filter((e) => !e.hidden && e.getClientRects().length && (e.textContent ?? '').trim());
  return Math.min(regiao.getBoundingClientRect().bottom, ...shown.map((e) => e.getBoundingClientRect().top));
}
/** Why `item` is not wholly visible in `box`, or '' when it is — and the page has not scrolled. */
function outOfView(item, box, what) {
  const r = item.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  const floor = Math.min(b.bottom, bandTop());
  const page = document.scrollingElement.scrollTop + window.scrollY;
  if (page !== 0) return `${what}: the PAGE scrolled (${page} px)`;
  if (r.top < b.top - 1 || r.bottom > floor + 1) return `${what}: «${(item.textContent ?? '').trim().slice(0, 20)}» at ${Math.round(r.top)}–${Math.round(r.bottom)}, visible ${Math.round(b.top)}–${Math.round(floor)}`;
  return '';
}

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  document.querySelector('.stage-wrap').style.cssText = 'width:700px;height:420px;display:flex;flex:none';
  (await import('../app/js/consumer-quiz/main-quiz.ts')).bootQuiz({ doc: document, win: window });
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  regiao = document.getElementById('game-region');
  regiao.focus();
  for (const type of ['keydown', 'keyup']) regiao.dispatchEvent(new KeyboardEvent(type, { code: 'KeyF', key: 'f', bubbles: true }));
  await esperar(60);
  cartao = [...document.querySelectorAll('.screen-pause')].find((e) => !e.hidden);
});

describe('the pause card: the cursor stays in view', () => {
  it('🔴 [Right] the engine\'s own root list leaves its LAST item above the legend at the foot of the screen', async () => {
    const card = cartao.querySelector('.pause-card');
    const items = [...cartao.querySelectorAll('.pause-menu:not([hidden]) .pm-btn:not([hidden])')];
    for (let i = 0; i < items.length + 1 && cartao.querySelector('.pm-sel') !== items.at(-1); i++) key('ArrowDown');
    await esperar();
    expect(cartao.querySelector('.pm-sel'), 'the arrows never reached the last item').toBe(items.at(-1));
    expect(outOfView(items.at(-1), card, 'the last root item')).toBe('');
    key('ArrowDown'); // the ring: back to the first
    await esperar();
    expect(outOfView(items[0], card, 'the first root item after the wrap')).toBe('');
  });

  it('🔴 [Right] a list longer than the stage SCROLLS, and every item the cursor reaches is wholly visible — down, round and up', async () => {
    const card = cartao.querySelector('.pause-card');
    const raiz = cartao.querySelector('.pause-menu[data-sub="raiz"]');
    const extra = Array.from({ length: 12 }, (_, i) => {
      const b = document.createElement('button');
      b.className = 'pm-btn';
      b.type = 'button';
      b.textContent = `Item extra ${i + 1}`;
      raiz.appendChild(b);
      return b;
    });
    try {
      expect(card.scrollHeight, 'the list fits — the case would measure nothing').toBeGreaterThan(card.clientHeight);
      const items = [...raiz.querySelectorAll('.pm-btn:not([hidden])')];
      const found = [];
      for (let i = 0; i < items.length; i++) {
        key('ArrowDown');
        await esperar(5);
        const sel = cartao.querySelector('.pm-sel');
        const why = outOfView(sel, card, `down ${i + 1}`);
        if (why) found.push(why);
      }
      expect(card.scrollTop, 'the list never scrolled').toBeGreaterThan(0);
      for (let i = 0; i < 3; i++) {
        key('ArrowUp');
        await esperar(5);
        const why = outOfView(cartao.querySelector('.pm-sel'), card, `up ${i + 1}`);
        if (why) found.push(why);
      }
      expect(found.join('\n')).toBe('');
    } finally {
      for (const b of extra) b.remove();
    }
  });

  it('🔴 [Right] a finger that presses an item low in a scrolled list, and «back», keep the cursor in view too', async () => {
    const card = cartao.querySelector('.pause-card');
    cartao.querySelector('.pm-btn[data-act="options"]').click(); // the door — the cursor goes to the list's «Voltar»
    const opcoes = cartao.querySelector('.pause-menu[data-sub="opcoes"]');
    const extra = Array.from({ length: 12 }, (_, i) => {
      const b = document.createElement('button');
      b.className = 'pm-btn';
      b.type = 'button';
      b.textContent = `Opção extra ${i + 1}`;
      opcoes.appendChild(b);
      return b;
    });
    try {
      extra.at(-1).click(); // a press, straight on the last item
      await esperar();
      expect(outOfView(extra.at(-1), card, 'the pressed item')).toBe('');
      opcoes.querySelector('.pm-btn[data-act="pmback"]').click(); // back to the root, on «Opções»
      await esperar();
      expect(outOfView(cartao.querySelector('.pm-sel'), card, 'the door «back» returned to')).toBe('');
    } finally {
      for (const b of extra) b.remove();
    }
  });
});

describe('a panel: the focused item stays in view', () => {
  it('🔴 [Right] the longest panel, walked to its last item and round to the first, by the arrows and by Tab', async () => {
    cartao.querySelector('.pm-btn[data-act="options"]').click();
    const acts = [...cartao.querySelectorAll('.pause-menu[data-sub="opcoes"] .pm-btn')].map((b) => b.dataset.act).filter((a) => a !== 'pmback');
    let longest = null;
    for (const act of acts) {
      cartao.querySelector(`.pm-btn[data-act="${act}"]`).click();
      await esperar();
      const p = [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);
      const c = p.querySelector('.overlay__card');
      if (!longest || c.scrollHeight > longest.card.scrollHeight) longest = { act, card: c };
      p.querySelector('.overlay__back').click();
      await esperar();
    }
    cartao.querySelector(`.pm-btn[data-act="${longest.act}"]`).click();
    await esperar(150);
    const card = longest.card;
    expect(card.scrollHeight, 'no panel is longer than the stage — the case would measure nothing').toBeGreaterThan(card.clientHeight);
    const found = [];
    for (let i = 0; i < 40; i++) {
      key('ArrowDown');
      await esperar(5);
      const why = outOfView(document.activeElement, card, `arrow ${i + 1}`);
      if (why) found.push(why);
    }
    for (let i = 0; i < 40; i++) {
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
      await esperar(5);
      const why = outOfView(document.activeElement, card, `tab ${i + 1}`);
      if (why) found.push(why);
    }
    expect(found.join('\n')).toBe('');
    card.closest('.overlay').querySelector('.overlay__back').click();
  });
});

/*
 * MUTATIONS CHECKED (applied by script, restored from a copy):
 *   · `keepInView` doing nothing → the three pause-card cases red.
 *   · `markPauseItem` not keeping the item in view → the same three red (every move of the card's cursor goes through it).
 *   · the pause card without its scroll padding → the same three red; without the room at its end → the same three red.
 *   · a panel card without its scroll padding → the panel case red.
 *   · a `focusin` listener in `ui/menu-nav` that kept a focused panel item in view SURVIVED its removal — the browser
 *     already scrolls a focused control into view within the card's scroll padding — so it is not in the code.
 */