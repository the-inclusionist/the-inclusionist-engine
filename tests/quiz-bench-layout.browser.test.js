// SPDX-License-Identifier: AGPL-3.0-or-later
// THE TEST BENCH FITS THE SMALLEST SCREEN: 640×360 CSS, the floor the engine forces (ADR-0163), with the real stylesheet.
//
// What is measured, and what it decided:
//   · the START SCREEN with fifteen skills — five of Educação Infantil and ten of the fundamental, the widest labels among them
//     (a component's name where the BNCC has no code): every button a 44 px target, nothing under the quick bar, nothing under
//     the footer's two lines of explanation, no page scroll — at the base face and at the larger one (1.25). 📏 With a visible
//     title the last row went under the footer at 1.25, so the title is a heading for a screen reader and the voice's first
//     words, not a line on screen; five codes side by side (`SKILL_COLUMNS`).
//   · the QUESTION SCREEN: a three-line statement and five 44 px options, above the HUD row — and with the explanation shown
//     after the third wrong attempt too. 📏 In one column the fifth option ended under the row; in two columns a two-line
//     statement with its explanation did; so five options sit «1 2 3» over «4 5», and while the explanation shows the
//     statement comes down to the text size.
//   · and every question of the quiz's own data fits with its explanation, in pt, en and es, at both faces — the check a new
//     skill file meets on the day it lands.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import css from '../app/css/style.css?raw';
import { QUIZ_BODY, openSkill } from './fixtures/quiz-page.js';
import { FIFTEEN_SKILLS } from './fixtures/quiz-skills.js';
import { QUIZ_SKILLS } from '../app/js/consumer-quiz/quiz-skills.js';
import { questionHtml, questionView } from '../app/js/consumer-quiz/main-quiz.js';

const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
let engine, region;
const box = (el) => el.getBoundingClientRect();
const regionBox = () => box(region);
/** The measurements of the screen now, as the problems they are; empty when everything fits. */
function startProblems() {
  const out = [];
  const r = regionBox();
  const bar = box(document.getElementById('title-icons'));
  const buttons = [...document.querySelectorAll('#quiz-app .quiz-skill')];
  const band = document.querySelector('#game-region .barra-explicacao');
  if (buttons.length !== 15) out.push(`${buttons.length} skills on screen, not 15`);
  if (!band || band.hidden) out.push('no explanation in the footer — the case would not see it');
  const lines = band ? Math.round((box(band).height - 8) / parseFloat(getComputedStyle(band).lineHeight)) : 0;
  if (lines !== 2) out.push(`the footer holds ${lines} lines — the case wants the tallest, two`);
  const first = box(document.querySelector('#quiz-app .quiz-stage-name'));
  if (first.top < bar.bottom - 0.5) out.push(`the first group at ${Math.round(first.top - r.top)} is under the quick bar (ends ${Math.round(bar.bottom - r.top)})`);
  for (const b of buttons) {
    const x = box(b);
    if (Math.round(x.height) < 44 || Math.round(x.width) < 44) out.push(`«${b.textContent}» is ${Math.round(x.width)}×${Math.round(x.height)}, under 44 px`);
    if (band && x.bottom > box(band).top + 0.5) out.push(`«${b.textContent}» ends at ${Math.round(x.bottom - r.top)}, under the footer (from ${Math.round(box(band).top - r.top)})`);
    if (x.right > r.right + 0.5 || x.left < r.left - 0.5) out.push(`«${b.textContent}» leaves the region sideways`);
  }
  const page = document.scrollingElement;
  if (page.scrollHeight > page.clientHeight || page.scrollWidth > page.clientWidth) out.push('the page scrolls');
  if (region.scrollHeight > region.clientHeight + 0.5) out.push(`the region scrolls: ${region.scrollHeight} in ${region.clientHeight}`);
  return out;
}
function questionProblems() {
  const out = [];
  const r = regionBox();
  const bar = box(document.getElementById('title-icons'));
  const row = document.querySelector('#game-region .hud-row');
  const statement = box(document.querySelector('#quiz-app .quiz-pergunta'));
  const alts = [...document.querySelectorAll('#quiz-app .quiz-alt')];
  if (!row || box(row).height === 0) out.push('no HUD row — the case would not see it');
  if (alts.length !== 5) out.push(`${alts.length} options, not 5`);
  if (statement.top < bar.bottom - 0.5) out.push('the statement is under the quick bar');
  for (const [i, b] of alts.entries()) {
    const x = box(b);
    if (Math.round(x.height) < 44 || Math.round(x.width) < 44) out.push(`option ${i + 1} is ${Math.round(x.width)}×${Math.round(x.height)}, under 44 px`);
    if (row && x.bottom > box(row).top + 0.5) out.push(`option ${i + 1} ends at ${Math.round(x.bottom - r.top)}, under the HUD row (from ${Math.round(box(row).top - r.top)})`);
  }
  const page = document.scrollingElement;
  if (page.scrollHeight > page.clientHeight || page.scrollWidth > page.clientWidth) out.push('the page scrolls');
  return out;
}
/** The communication cycle's first position, where the page boots: the base face. */
let baseFace = null;
/**
 * The larger face (1.25) by the quick bar's communication cycle, or back to the cycle's FIRST position — not merely scale 1:
 * the cycle also moves the capitals and the spacing, and a position with scale 1 and capitals on is not the base face.
 */
async function face(scale) {
  const button = [...document.querySelectorAll('#title-icons .pi-btn')].find((b) => /comunica/i.test(b.getAttribute('aria-label') ?? ''));
  expect(button, 'no communication button on the bar').toBeTruthy();
  baseFace ??= button.getAttribute('aria-label');
  const there = () => (scale === '1' ? button.getAttribute('aria-label') === baseFace
    : document.documentElement.style.getPropertyValue('--fonte-escala') === scale);
  for (let i = 0; i < 8 && !there(); i++) {
    button.click();
    await wait();
  }
  expect(there(), `the cycle never reached ${scale === '1' ? 'its first position' : `scale ${scale}`}`).toBe(true);
}
const pressKey = (code) => {
  const t = document.activeElement && document.activeElement !== document.body ? document.activeElement : region;
  t.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
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

describe('the test bench at 640×360', () => {
  it('🎯 [Right] the region is at its 640×360 floor here — the measures below are of the smallest screen', () => {
    expect([Math.round(regionBox().width), Math.round(regionBox().height)]).toEqual([640, 360]);
  });

  it('🔴 [Right] the START SCREEN: fifteen 44 px targets between the quick bar and the footer\'s two lines, no scroll', async () => {
    expect(startProblems()).toEqual([]);
    await face('1.25');
    try {
      expect(startProblems().map((p) => `(1.25) ${p}`)).toEqual([]);
    } finally {
      await face('1');
    }
  });

  it('🔴 [Right] the QUESTION SCREEN: a three-line statement and five 44 px options above the HUD row, no scroll', async () => {
    const idx = [...document.querySelectorAll('#quiz-app .quiz-skill')].findIndex((b) => b.textContent === 'EF05MA08');
    await openSkill(document, idx);
    const s = document.querySelector('#quiz-app .quiz-pergunta');
    const lines = Math.round(box(s).height / parseFloat(getComputedStyle(s).lineHeight));
    expect(lines, 'the fixture\'s statement is not the three lines the case measures').toBe(3);
    expect(questionProblems()).toEqual([]);
  });

  it('🔴 [Right] and with the EXPLANATION shown after the third wrong attempt, at both faces', async () => {
    // the fixture's first question is right on its second option: three others fail it
    for (const i of [0, 2, 3]) document.querySelector(`#quiz-app .quiz-alt[data-alt="${i}"]`).click();
    await wait();
    const note = document.querySelector('#quiz-app .quiz-note');
    expect(note, 'no explanation — the case would measure nothing').not.toBeNull();
    expect(Math.round(box(note).height / parseFloat(getComputedStyle(note).lineHeight)), 'the explanation is not the two lines measured').toBe(2);
    expect(questionProblems()).toEqual([]);
    await face('1.25');
    try {
      expect(questionProblems().map((p) => `(1.25) ${p}`)).toEqual([]);
    } finally {
      await face('1');
    }
    pressKey(engine.keyboard.kbFor(0).action3[0]);
    await wait(120);
  });
});

describe('the quiz\'s own data fits the smallest screen, explanation shown, in every language and at both faces', () => {
  it('🔴 [Right] every question of QUIZ_SKILLS ends above the HUD row with its explanation under the statement', async () => {
    await openSkill(document, 0);
    const app = document.getElementById('quiz-app');
    const found = [];
    for (const scale of ['1', '1.25']) {
      await face(scale);
      for (const lang of ['pt', 'en', 'es']) {
        for (const skill of QUIZ_SKILLS) {
          for (const [n, q] of skill.questions.entries()) {
            // the explained screen, drawn by the quiz's own pure functions into the page with the real stylesheet
            app.innerHTML = questionHtml(engine.t, questionView(engine.t, skill, q, 0, { phase: 'explained', wrong: 0, off: [] }, lang), 0);
            found.push(...questionProblems().map((p) => `(${scale} ${lang} ${skill.code ?? skill.component.pt} q${n + 1}) ${p}`));
          }
        }
      }
    }
    await face('1');
    expect(found).toEqual([]);
  }, 30000);
});

// ============================== MUTATIONS CHECKED ==============================
// (2026-09-26; same script and runs as quiz-round.node) — all red:
//   M24 the start screen's title drawn as a line (fifteen skills under the footer at 1.25)
//   C1 the statement keeps its heading size while the explanation shows   C2 skill buttons under 44 px
//   R17 three codes to a row   R18 the options in one column
