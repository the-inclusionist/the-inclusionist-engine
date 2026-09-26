// SPDX-License-Identifier: AGPL-3.0-or-later
// A MARGIN BETWEEN THE GAME'S EDGE AND EVERY TEXT AND BUTTON BUT THE QUICK BAR (interface log 2026-09-26). The Dev, after
// playing the test bench: «Os textos estão tocando na borda do jogo, é necessário haver uma margem mínima entre o texto, botões
// (exceto botões da barra de acessibilidade rápida) e a borda do jogo.»
//
// The margin is 4 logical pixels: `ui/layout.applyScale` writes it as `--margem-borda` (4·k CSS px), 8 px at the 640×360 floor.
// 📏 Measured before the fix at 640×360, against the region: the quiz's statement, explanation, options and skill buttons at
// 0 px from the sides; the footer band's words 4.8 px from the bottom; the HUD row's learning bar 4 px from the left and the
// bottom, its clock 7.1 px from the bottom; the pause card's and a panel's title 6 px from the top; a panel's footer 4.8 px.
//
// What is walked, on the real quiz page with the real stylesheet: every visible TEXT (its line boxes, as a Range gives them,
// cut by any ancestor that clips its overflow), every visible BUTTON, and the HUD's chips — all but the quick bar
// (`#title-icons`, which ADR-0180 put at the edge, and its icon name line); the measure is `fixtures/edge-measure`. Screens: the
// start screen with its footer, a question with the explanation shown, the pause card, and a panel — at 640×360 and again at
// 1280×720, where the margin is 16. What the quiz page does not show — the HUD bands on the region with no row, the caption
// and the legend alone at the foot, the pad's pills, a simulation's dot — is `edge-margin-without-the-row.browser.test.js`.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import css from '../app/css/style.css?raw';
import { QUIZ_BODY, openSkill } from './fixtures/quiz-page.js';
import { FIFTEEN_SKILLS } from './fixtures/quiz-skills.js';
import { shown, tooClose as tooCloseIn, atSize as atSizeIn } from './fixtures/edge-measure.js';

const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
let engine, region;

/** What stands nearer this page's region's edges than its margin (`fixtures/edge-measure`, shared with the second pass). */
const tooClose = (screen) => tooCloseIn(region, screen);
const atSize = (w, h) => atSizeIn(document, w, h);
/**
 * Where a card's CONTENT starts, from the region's top — below its border and top padding, whatever its list is scrolled to.
 * The pause card's is kept for the panel case to compare.
 */
let pauseContentTop = NaN;
const contentTop = (card) => card.getBoundingClientRect().top + card.clientTop + parseFloat(getComputedStyle(card).paddingTop)
  - region.getBoundingClientRect().top;
const pressBack = async () => {
  const t = document.activeElement && document.activeElement !== document.body ? document.activeElement : region;
  const code = engine.keyboard.kbFor(0).action3[0];
  t.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
  t.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true, cancelable: true }));
  await wait(120);
};

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = QUIZ_BODY;
  engine = (await import('../app/js/consumer-quiz/main-quiz.ts')).bootQuiz({ doc: document, win: window, skills: FIFTEEN_SKILLS });
  for (let i = 0; i < 40 && !document.querySelector('#quiz-app .quiz-skill'); i++) await wait(25);
  region = document.getElementById('game-region');
});

describe.each([[640, 360, 8], [1280, 720, 16]])('the edge margin at %i×%i', (w, h, margin) => {
  it(`🔴 [Right] the region declares ${margin} px — 4 logical px at this scale`, async () => {
    await atSize(w, h);
    const r = region.getBoundingClientRect();
    expect([Math.round(r.width), Math.round(r.height)], 'the region is not at the size the case measures').toEqual([w, h]);
    expect(region.style.getPropertyValue('--margem-borda')).toBe(`${margin}px`);
  });

  it('🔴 [Right] the START SCREEN and its footer: every skill and every word stand the margin off the edges', () => {
    const { found, items } = tooClose('start');
    expect(items.filter(([what]) => what.includes('quiz-skill')).length, 'the case measured no skill buttons').toBeGreaterThanOrEqual(15);
    expect(items.some(([what]) => what.includes('barra-explicacao')), 'no footer text on the start screen — the case would not see it').toBe(true);
    expect(found).toEqual([]);
  });

  it('🔴 [Right] a QUESTION with its EXPLANATION, and the HUD row under it', async () => {
    const idx = [...document.querySelectorAll('#quiz-app .quiz-skill')].findIndex((b) => b.textContent === 'EF05MA08');
    await openSkill(document, idx);
    for (const i of [0, 2, 3]) document.querySelector(`#quiz-app .quiz-alt[data-alt="${i}"]`).click(); // right on the second
    await wait();
    const { found, items } = tooClose('question');
    for (const part of ['quiz-pergunta', 'quiz-note', 'quiz-alt', 'hud-barra', 'session-clock']) {
      expect(items.some(([what]) => what.includes(part)), `nothing of .${part} measured — the case would not see it`).toBe(true);
    }
    expect(found).toEqual([]);
  });

  it('🔴 [Right] the PAUSE CARD — its title, its items and the legend at its foot', async () => {
    engine.pause.show(0);
    await wait();
    try {
      const { found, items } = tooClose('pause');
      expect(items.some(([what]) => what.includes('pm-btn')), 'no pause item measured — the case would not see the card').toBe(true);
      expect(found).toEqual([]);
      pauseContentTop = contentTop(document.querySelector('#vp-pause-0 .pause-card'));
    } finally {
      engine.pause.hide(0);
    }
  });

  it('🔴 [Right] a PANEL the card opens — its title, its rows and its explanation band', async () => {
    engine.pause.show(0);
    await wait();
    try {
      document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
      await wait();
      const door = [...document.querySelectorAll('#vp-pause-0 .pm-btn')].find((b) => shown(b) && b.dataset.act === 'visual');
      expect(door, 'no «visual» panel door in the options list — the case would open nothing').toBeTruthy();
      door.click();
      await wait(200);
      const panel = [...region.querySelectorAll('.overlay')].find((o) => shown(o));
      expect(panel, 'no panel opened').toBeTruthy();
      const { found, items } = tooClose('panel');
      expect(items.some(([what]) => what.includes('opt-explain')), 'the panel\'s explanation band was not measured').toBe(true);
      expect(found).toEqual([]);
      // a panel wears the pause card (interface log 2026-09-13): the margin starts its content where the card's starts
      expect(contentTop(panel.querySelector('.overlay__card')), 'the panel\'s content does not start where the pause card\'s does')
        .toBeCloseTo(pauseContentTop, 0);
    } finally {
      // out the way a keyboard leaves: Escape closes the panel, then the list, then the card
      for (let i = 0; i < 4 && ([...region.querySelectorAll('.overlay')].some(shown) || !document.getElementById('vp-pause-0').hidden); i++) {
        const t = document.activeElement ?? region;
        t.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true }));
        t.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', key: 'Escape', bubbles: true, cancelable: true }));
        await wait();
      }
    }
  });

  it('📌 back to the start screen for the next size', async () => {
    expect([...region.querySelectorAll('.overlay')].some(shown), 'a panel stayed open').toBe(false);
    engine.pause.hide(0);
    await wait();
    if (!document.querySelector('#quiz-app .quiz-skill')) await pressBack();
    expect(document.querySelector('#quiz-app .quiz-skill'), 'the start screen did not come back').not.toBeNull();
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (2026-09-26; `scratchpad/quiz-edge/mutate.mjs`, counting each target first) — all red:
//   E1 the quiz's side margin removed                    E2 the footer band's bottom border removed (padding 4px back)
//   E2b the band's margin as padding, not border (a third line shows through the clamp)
//   E3 the HUD row's padding back to 4 px                E4 the pause screen's top padding removed
//   E4b the margin as the pause card's own top padding (a scrolled item shows nearer the edge)
//   E5 the panel veil's top padding removed              E6 a panel's footer bottom border removed
//   E7 `applyScale` writes no `--margem-borda` (the 8 px fallback: red at 1280×720, and «declares»)
//   E7b the quiz's margin as a literal 8 px              E10 a panel card keeping its .25rem top padding (content 4 px low)
// Held elsewhere: E8 the pause card keeping its .25rem → `pause-target-44px` (the submenu overflows 1 px); E9 the old
// `--footer-band-h` → `the-panel-footer-is-the-screens` and `the-cursor-stays-in-view` (the last row rests under the band).
