// SPDX-License-Identifier: AGPL-3.0-or-later
// NO MENU LEAVES THE CANVAS (ADR-0130 rule 5, issue #134) — as a RULE, not as five panels that happen to have it.
//
// «A vertical scrollbar keeps the menu inside the canvas.» A menu outside the canvas cannot be reached, which makes this a
// constraint rather than a taste. The record's own warning is the reason for the shape of this file: the five opening
// submenus got `max-height: 72%; overflow-y: auto` one at a time, and «a sixth panel would not inherit it».
//
// 📌 SO THE CASES LOOP OVER WHAT EXISTS, never over a list of ids: every panel the quiz page mounts (whatever their number)
// and the pause card, at 640×360 — the smallest stage the engine allows (ADR-0001) — under the real stylesheet. Each menu
// box stays inside the region, and one whose content is taller than its box SCROLLS. A seventh panel is read by the same
// loop; a panel that drops the scroll fails by its own id.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';

let regiao, cartao;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const SCROLLS = new Set(['auto', 'scroll']);

/** A menu box against the region: inside it, and scrolling when its content does not fit. */
function judge(name, box) {
  const g = regiao.getBoundingClientRect();
  const r = box.getBoundingClientRect();
  const out = [];
  // one pixel of rounding either way
  if (r.top < g.top - 1 || r.bottom > g.bottom + 1 || r.left < g.left - 1 || r.right > g.right + 1) {
    out.push(`${name} leaves the canvas: ${Math.round(r.top)}–${Math.round(r.bottom)} × ${Math.round(r.left)}–${Math.round(r.right)} in ${Math.round(g.top)}–${Math.round(g.bottom)} × ${Math.round(g.left)}–${Math.round(g.right)}`);
  }
  if (box.scrollHeight > box.clientHeight + 1 && !SCROLLS.has(getComputedStyle(box).overflowY)) {
    out.push(`${name} holds ${box.scrollHeight}px in ${box.clientHeight}px and does not scroll (overflow-y: ${getComputedStyle(box).overflowY})`);
  }
  return out;
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
  await esperar(50);
  cartao = [...document.querySelectorAll('.screen-pause')].find((e) => !e.hidden);
});

describe('no menu leaves the canvas', () => {
  it('🎯 [Right] the stage is the smallest the engine allows, and the page mounts its panels', () => {
    expect([Math.round(regiao.getBoundingClientRect().width), Math.round(regiao.getBoundingClientRect().height)]).toEqual([640, 360]);
    expect(cartao, 'the pause card did not open — the case would measure nothing').toBeTruthy();
    expect(regiao.querySelectorAll('.overlay .overlay__card').length, 'no panel mounted').toBeGreaterThan(5);
  });

  it('🔴 [Right] the pause card, in each of its lists, stays inside and scrolls when it must', async () => {
    // A game passes its own lists (ADR-0146), so each list gets twelve more items here: more than the stage holds, or the
    // scroll half would measure nothing — the engine's own lists fit at 640×360.
    const extra = [...cartao.querySelectorAll('.pause-menu')].flatMap((m) => Array.from({ length: 12 }, (_, i) => {
      const b = document.createElement('button');
      b.className = 'pm-btn';
      b.type = 'button';
      b.textContent = `Item extra ${i + 1}`;
      m.appendChild(b);
      return b;
    }));
    const found = [];
    for (const sub of [...cartao.querySelectorAll('.pause-menu')].map((m) => m.dataset.sub)) {
      for (const m of cartao.querySelectorAll('.pause-menu')) m.hidden = m.dataset.sub !== sub;
      await esperar(10);
      found.push(...judge(`the pause card (${sub})`, cartao.querySelector('.pause-card')));
    }
    for (const m of cartao.querySelectorAll('.pause-menu')) m.hidden = m.dataset.sub !== 'raiz';
    for (const b of extra) b.remove();
    expect(found.join('\n')).toBe('');
  });

  it('🔴 [Right] EVERY panel the page mounts stays inside and scrolls when it must — by the loop, not by a list', async () => {
    const found = [];
    const panels = [...regiao.querySelectorAll('.overlay')].filter((o) => o.querySelector('.overlay__card'));
    let tall = 0;
    for (const o of panels) {
      o.hidden = false;
      await esperar(10);
      const card = o.querySelector('.overlay__card');
      if (card.scrollHeight > card.clientHeight + 1) tall++;
      found.push(...judge(`#${o.id}`, card));
      o.hidden = true;
    }
    expect(found.join('\n')).toBe('');
    // ⚠️ the scroll half measures something only if a panel is taller than the stage: at 640×360 several are
    expect(tall, 'no panel is taller than the stage — the scroll half would measure nothing').toBeGreaterThan(0);
  });

  it('🔴 [Right] the opening menus too — the main one and its submenus, each with more items than the stage holds', async () => {
    // The engine styles these ids and a GAME builds the markup (`ui/title`), so the fixture is a title screen in the shape a
    // game writes it, twenty items per menu: more than 360 px can show at the 44 px target.
    const MENUS = ['tm-main', 'tm-alf', 'tm-mat', 'tm-tab', 'tm-fr', 'tm-cen'];
    expect(MENUS.filter((id) => document.getElementById(id)), 'the page already has a title screen — the fixture would collide').toEqual([]);
    const tela = document.createElement('div');
    tela.id = 'title-overlay';
    tela.innerHTML = '<div class="title-wrap"><div class="title-block"><h2 class="game-title">The Inclusionist</h2></div>'
      + MENUS.map((id) => `<div class="title-menu" id="${id}" role="group" hidden>`
        + Array.from({ length: 20 }, (_, i) => `<button class="title-btn" type="button">Item ${i + 1}</button>`).join('') + '</div>').join('')
      + '<div class="title-legend" id="title-legend"></div></div>';
    regiao.appendChild(tela);
    const found = [];
    try {
      for (const id of MENUS) {
        for (const m of MENUS) document.getElementById(m).hidden = m !== id;
        await esperar(10);
        found.push(...judge(`#${id}`, document.getElementById(id)));
      }
    } finally {
      tela.remove();
    }
    expect(found.join('\n')).toBe('');
  });

  it('🔴 [Right] a panel the engine has never seen — a seventh card with no id rule — inherits the scroll', async () => {
    // the rule belongs to the PANEL SHAPE, not to five ids: a new card with forty rows stays in and scrolls
    const o = document.createElement('div');
    o.className = 'overlay';
    o.id = 'painel-novo';
    o.innerHTML = '<div class="overlay__card" role="dialog" aria-modal="true"><h2>Novo</h2><div class="ctrl-list">'
      + Array.from({ length: 40 }, (_, i) => `<div class="ctrl-row"><span><strong>Linha ${i + 1}</strong></span><button type="button">x</button></div>`).join('')
      + '</div></div>';
    regiao.appendChild(o);
    await esperar(10);
    try {
      expect(judge('a new panel', o.querySelector('.overlay__card')).join('\n')).toBe('');
    } finally {
      o.remove();
    }
  });
});

/*
 * MUTATIONS CHECKED (applied by script, restored from a copy):
 *   · `.title-menu` without its scroll → the opening-menus case red (`#tm-main` leaves the stage by 208 px at the top), and
 *     `opening-menu-layout.node` red.
 *   · the panel card without `height:100%;max-height:100%` → the every-panel and new-panel cases red.
 *   · the panel card without `overflow-y:auto` → the same two red.
 *   · the pause card with `overflow:visible` → the pause case red.
 *   · `.screen-pause .pause-card{max-height:100%}` → `none` SURVIVES: the card's `height:100%` below it already holds it,
 *     so that declaration is inert (left as it is — not this issue's to remove).
 */