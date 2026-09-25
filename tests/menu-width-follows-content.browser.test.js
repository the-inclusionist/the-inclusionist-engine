// SPDX-License-Identifier: AGPL-3.0-or-later
// A MENU IS AS WIDE AS ITS WIDEST ITEM (ADR-0130 rule 6, issue #134) — measured, at the minimum screen.
//
// The six opening menus (`#tm-main` and its five submenus) were pinned at `26em`: a number chosen in Portuguese. A label
// that fits in Portuguese wraps onto two lines in a longer language — the button changes height with the language — and a
// short menu is a wide empty box. Rule 6 is arithmetic rather than taste: the width follows the content.
//
// 📌 The engine styles these ids and a GAME builds the markup (`ui/title` says so), so the fixture is a title screen in the
// shape a game writes it, under the real stylesheet, in a 640×360 region — the smallest stage the engine allows (ADR-0001).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import css from '../app/css/style.css?raw';

const MENUS = ['tm-main', 'tm-alf', 'tm-mat', 'tm-tab', 'tm-fr', 'tm-cen'];
/** Short Portuguese labels, a few per menu — the ordinary case. */
const CURTOS = {
  'tm-main': ['Lúdico', 'Alfabetização', 'Matemática'],
  'tm-alf': ['Letras', 'Sílabas', 'Palavras', 'Voltar'],
  'tm-mat': ['Somar', 'Subtrair', 'Voltar'],
  'tm-tab': ['Tabuada do 2', 'Tabuada do 3', 'Voltar'],
  'tm-fr': ['Metade', 'Um terço', 'Voltar'],
  'tm-cen': ['Cidade', 'Campo', 'Praia', 'Voltar'],
};
/** A label a longer language produces: wider than the old 26em box, narrower than the 640 px frame. */
const LONGO = 'Matemáticas: sumas y restas hasta cien';

let regiao;
const px = (v) => parseFloat(v) || 0;
const menu = (id) => document.getElementById(id);
/** Lines a button's TEXT takes, from the text's own boxes — the button's height grows with the target floor too. */
const linhas = (el) => {
  const r = document.createRange();
  r.selectNodeContents(el);
  return new Set([...r.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top))).size;
};
/** A button's width when nothing constrains it: its text on one line, plus its own padding and border. */
const larguraPropria = (b) => {
  const r = document.createRange();
  r.selectNodeContents(b);
  const s = getComputedStyle(b);
  const texto = Math.max(...[...r.getClientRects()].map((q) => q.width), 0);
  // measured on a nowrap clone, because a wrapped button reports the width of its longest LINE, not of its label
  const clone = b.cloneNode(true);
  clone.style.cssText = 'position:absolute;visibility:hidden;width:auto;white-space:nowrap';
  b.parentElement.appendChild(clone);
  const r2 = document.createRange();
  r2.selectNodeContents(clone);
  const inteiro = Math.max(...[...r2.getClientRects()].map((q) => q.width), texto);
  clone.remove();
  return inteiro + px(s.paddingLeft) + px(s.paddingRight) + px(s.borderLeftWidth) + px(s.borderRightWidth);
};
/** The menu's content box: what its items can use (the scrollbar, when there is one, is not theirs). */
const larguraUtil = (m) => {
  const s = getComputedStyle(m);
  return m.clientWidth - px(s.paddingLeft) - px(s.paddingRight);
};

function montar(rotulos) {
  regiao.innerHTML = '<div id="title-overlay" class="overlay"><div class="title-wrap">'
    + '<div class="title-block"><h2 class="game-title">The Inclusionist</h2></div>'
    + MENUS.map((id) => `<div class="title-menu" id="${id}" role="group" hidden>`
      + rotulos[id].map((t) => `<button class="title-btn" type="button">${t}</button>`).join('') + '</div>').join('')
    + '<div class="title-legend" id="title-legend"></div></div></div>';
}
function mostrar(id) {
  for (const m of MENUS) menu(m).hidden = m !== id;
  return menu(id);
}
/** Every rectangle stays inside the 640×360 region. */
function dentro(el) {
  const r = el.getBoundingClientRect(), q = regiao.getBoundingClientRect();
  return r.left >= q.left - 0.5 && r.right <= q.right + 0.5 && r.top >= q.top - 0.5 && r.bottom <= q.bottom + 0.5;
}

beforeAll(() => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = '<main><div class="stage-wrap" style="width:640px;height:360px;display:flex;flex:none">'
    + '<div id="stage" class="stage"><section id="game-region" class="game-region" tabindex="-1" '
    + 'style="width:640px;height:360px"></section></div></div></main>';
  regiao = document.getElementById('game-region');
});

afterEach(() => { regiao.innerHTML = ''; });

describe('ADR-0130 rule 6 · a menu is as wide as its widest item', () => {
  it('[Zero] the region is 640×360 and the menus\' text is at its 16 px floor — otherwise the case measures another screen', () => {
    montar(CURTOS);
    const r = regiao.getBoundingClientRect();
    expect([Math.round(r.width), Math.round(r.height)]).toEqual([640, 360]);
    expect(px(getComputedStyle(mostrar('tm-main')).fontSize)).toBe(16);
  });

  it('🔴 [Right] each of the six is exactly as wide as its widest label — no wider, no narrower', () => {
    montar(CURTOS);
    const fora = [];
    for (const id of MENUS) {
      const m = mostrar(id);
      const maior = Math.max(...[...m.querySelectorAll('.title-btn')].map(larguraPropria));
      const util = larguraUtil(m);
      if (Math.abs(util - maior) > 1.5) fora.push(`#${id}: ${util.toFixed(1)} px for a widest label of ${maior.toFixed(1)} px`);
    }
    expect(fora, 'a menu whose width is not its content\'s').toEqual([]);
  });

  it('🔴 [Right] a long label in another language is neither cut nor wrapped — in the main menu and in a submenu that scrolls', () => {
    const rotulos = { ...CURTOS, 'tm-main': [...CURTOS['tm-main'], LONGO] };
    // eleven items and the long one: enough for `#tm-fr` to scroll, so its scrollbar takes room from the labels
    rotulos['tm-fr'] = [...Array.from({ length: 11 }, (_, i) => `Fração ${i + 1}`), LONGO];
    montar(rotulos);
    for (const id of ['tm-main', 'tm-fr']) {
      const m = mostrar(id);
      const b = [...m.querySelectorAll('.title-btn')].find((x) => x.textContent === LONGO);
      const propria = larguraPropria(b);
      // the case's precondition, so it cannot pass for having a label that fits anywhere: wider than the old 26em box
      expect(propria, `#${id}: the long label fits the old 26em box — the case measures nothing`).toBeGreaterThan(26 * 16 - 2 * 0.7 * 16);
      expect(propria, `#${id}: the long label is wider than the frame — pick a shorter one`).toBeLessThan(640 - 40);
      expect(linhas(b), `#${id}: the long label wrapped`).toBe(1);
      expect(b.scrollWidth, `#${id}: the long label is cut inside its button`).toBeLessThanOrEqual(b.clientWidth);
      expect(m.scrollWidth, `#${id}: the menu hides part of its items sideways`).toBeLessThanOrEqual(m.clientWidth);
      expect(dentro(m), `#${id}: the menu leaves the 640×360 frame`).toBe(true);
    }
    expect(menu('tm-fr').scrollHeight, '#tm-fr does not scroll — the scrollbar half measures nothing').toBeGreaterThan(menu('tm-fr').clientHeight);
  });

  it('⚠️ [Boundary] a label wider than the whole frame WRAPS inside it — the menu never leaves the 640×360 canvas', () => {
    const enorme = `${LONGO} — ${LONGO}`;
    montar({ ...CURTOS, 'tm-main': [...CURTOS['tm-main'], enorme], 'tm-cen': [...CURTOS['tm-cen'], enorme] });
    for (const id of ['tm-main', 'tm-cen']) {
      const m = mostrar(id);
      expect(dentro(m), `#${id}: the menu left the frame`).toBe(true);
      for (const b of m.querySelectorAll('.title-btn')) {
        expect(b.getBoundingClientRect().right, `#${id}: «${b.textContent.slice(0, 20)}…» runs past its menu`).toBeLessThanOrEqual(m.getBoundingClientRect().right + 0.5);
      }
      const b = [...m.querySelectorAll('.title-btn')].find((x) => x.textContent === enorme);
      expect(linhas(b), `#${id}: a label wider than the frame should wrap, not overflow`).toBeGreaterThan(1);
    }
  });
});

// MUTATIONS CHECKED (2026-09-25), each applied to `app/css/style.css` by script and restored from a copy:
//   · `#tm-main` back to `width:26em`             → «exactly as wide» and «neither cut nor wrapped»
//   · the five submenus back to `width:26em`      → «exactly as wide» and «neither cut nor wrapped»
//   · `#tm-main` at `max-content` (no cap)        → «wraps inside the frame»
//   · the five submenus at `max-content`          → «wraps inside the frame»
//   📌 A `max-width:100%` beside `fit-content` was tried and SURVIVED its removal: `fit-content` already caps at the room
//      there is, so the declaration was inert and left the stylesheet.
