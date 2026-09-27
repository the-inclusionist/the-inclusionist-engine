// SPDX-License-Identifier: AGPL-3.0-or-later
// «SAIR DO JOGO» TAKES THE DEMO QUIZ TO ITS START SCREEN (interface log 2026-09-26). The Dev: «Ao clicar em menu e "Quit/Sair
// do Jogo" eu deveria ir para a tela de seleção de habilidades, a primeira do jogo».
//
// The engine's half is gated in `boot-create-game` (the card's `quit` asks `setPhase('title')`); this file gates the quiz's
// half on the real page: the phase it is asked for, what the child then sees, and the microphone given back first.
//
// 📌 The reading is a double on the engine's handle: a real `listen()` opens a worker and a model this browser project does not
// serve (see `quiz-virtual-buttons`). What is held is the quiz's side — it asks, and on quit it gives the microphone back.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import css from '../app/css/style.css?raw';
import { QUIZ_BODY, openSkill } from './fixtures/quiz-page.js';
import { THREE_SKILLS, INFANT } from './fixtures/quiz-skills.js';

const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const alerts = [];
let engine, region;
const footer = () => {
  const b = document.querySelector('#game-region .barra-explicacao');
  return b && !b.hidden && b.getClientRects().length ? b.textContent : null;
};
const skills = () => [...document.querySelectorAll('#quiz-app .quiz-skill')];
const options = () => [...document.querySelectorAll('#quiz-app .quiz-alt')];
const card = () => document.getElementById('vp-pause-0');
/** The pause card's «Sair do jogo», as the child reaches it: the card opened, the item clicked. */
async function quitFromTheCard() {
  engine.pause.show(0);
  await wait();
  const quit = document.querySelector('#vp-pause-0 .pm-btn[data-act="quit"]');
  expect(quit, 'the card has no «Sair do jogo» — the case would measure nothing').not.toBeNull();
  expect(quit.hidden, 'the card hides «Sair do jogo»').toBe(false);
  quit.click();
  await wait(120);
}
const press = (code) => {
  const t = document.activeElement && document.activeElement !== document.body ? document.activeElement : region;
  t.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
  t.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true, cancelable: true }));
};

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = QUIZ_BODY;
  const el = document.getElementById('sr-alert');
  new MutationObserver(() => { if (el.textContent) alerts.push(el.textContent); }).observe(el, { childList: true, characterData: true, subtree: true });
  engine = (await import('../app/js/consumer-quiz/main-quiz.ts')).bootQuiz({ doc: document, win: window, skills: THREE_SKILLS });
  for (let i = 0; i < 40 && !skills().length; i++) await wait(25);
  region = document.getElementById('game-region');
});
beforeEach(() => { alerts.length = 0; });

describe('«Sair do jogo» on the pause card', () => {
  it('🔴 [Right] from a question, it opens the START SCREEN, and the footer explains the skill under the cursor', async () => {
    await openSkill(document, 0); // the start screen's first skill: Educação Infantil comes first
    expect(options(), 'no question opened — the case would measure nothing').toHaveLength(5);
    expect(footer(), 'the question screen shows a skill\'s explanation — the case could not tell the screens apart').toBeNull();
    await quitFromTheCard();
    expect(card().hidden, 'the card stayed open over the start screen').toBe(true);
    expect(options(), '«Sair do jogo» left the question on screen').toHaveLength(0);
    expect(skills().map((b) => b.textContent)).toEqual(['EI03EF01', 'EF05MA08', 'EF06LI17']);
    expect(footer(), 'the start screen came back without its explanation').toBe(`Escuta, fala, pensamento e imaginação · 4 a 5 anos — ${INFANT.skillText.pt}`);
    // and it is the start screen for good: the arrows move its cursor, and the footer follows
    press('ArrowRight');
    await wait();
    expect(footer(), 'the arrows do not move the start screen\'s cursor').toMatch(/^Matemática · 5º ano/);
  });

  it('🔴 [Zero] «Continuar» changes nothing in the quiz: the question stays where it was', async () => {
    await openSkill(document, 1);
    const statement = document.querySelector('#quiz-app .quiz-pergunta').textContent;
    engine.pause.show(0);
    await wait();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="resume"]').click();
    await wait(120);
    expect(card().hidden).toBe(true);
    expect(document.querySelector('#quiz-app .quiz-pergunta')?.textContent, '«Continuar» left the question').toBe(statement);
  });

  /**
   * Opens a question, asks to listen through a choice double (ADR-0256), and quits from the card. `ends` says how the double's `choose()`
   * ends when the microphone is given back: resolving with nothing heard, or refusing — a recogniser may do either.
   */
  async function quitWhileListening(ends) {
    if (!skills().length) { press(engine.keyboard.kbFor(0).action3[0]); await wait(120); } // back to the start screen first
    await openSkill(document, 1);
    let stops = 0;
    let finish = null;
    const reading = engine.reading;
    const kept = { choose: reading.choose, stop: reading.stop };
    reading.choose = () => new Promise((resolve, reject) => {
      finish = ends === 'refused' ? () => reject(new Error('stopped')) : () => resolve({ chosen: null, heard: '', ended: 'asked' });
    });
    reading.stop = () => { stops += 1; finish?.(); };
    try {
      press(engine.keyboard.kbFor(0).action1[0]);
      await wait();
      expect(finish, 'the quiz did not ask to listen — the case would measure nothing').not.toBeNull();
      alerts.length = 0;
      await quitFromTheCard();
      return stops;
    } finally {
      Object.assign(reading, kept);
    }
  }

  it('🔴 [Right] with the microphone open, it is given back FIRST — and what it then hears is not said over the start screen', async () => {
    const stops = await quitWhileListening('heard');
    expect(stops, 'the microphone stayed open on the start screen').toBe(1);
    expect(skills(), '«Sair do jogo» did not open the start screen').toHaveLength(3);
    expect(alerts, 'the reading ended and spoke over the start screen').not.toContain(engine.t('quiz.ouviNada'));
  });

  it('🔴 [Right] and a reading that REFUSES when the microphone is given back says nothing over the start screen either', async () => {
    const stops = await quitWhileListening('refused');
    expect(stops).toBe(1);
    expect(skills(), '«Sair do jogo» did not open the start screen').toHaveLength(3);
    expect(alerts, 'the refused reading spoke over the start screen').not.toContain(engine.t('quiz.semLeitura'));
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (2026-09-26; `scratchpad/quiz-edge/mutate.mjs`, counting each target first) — all red:
//   QQ1 the quiz declares no `setPhase` (the engine's quit asks nobody)       🔴 the first and third cases
//   QQ2 `onPhase` goes to the start screen on every phase                      🔴 «Continuar» left the question
//   QQ3 the microphone not given back on quit                                 🔴 «stayed open»
//   QQ4 what was heard after leaving is said anyway (the screen guard gone)    🔴 «spoke over the start screen»
//   QQ5 a refused reading after leaving is said anyway (its guard gone)        🔴 «the refused reading spoke»
