// SPDX-License-Identifier: AGPL-3.0-or-later
// THE QUIZ DEMO'S VIRTUAL BUTTONS, pressed through the real page: what each button the engine carries to `onCommand` does.
//
// 🔴 A probe (2026-09-24) found only «up» and «down» held. Answering with the confirm button, listening with action1, the
// sonar on R1, and a RELEASE being ignored could all break with every case green — the demo cartridge that proves the engine
// had no case answering a question by command. Driven here by the keyboard, through the child's scheme (the default solo
// scheme: J confirms, U listens, 8 is R1), which is the same road every transport takes to `onCommand`.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';
import { openSkill } from './fixtures/quiz-page.js';
import { THREE_SKILLS } from './fixtures/quiz-skills.js';

let regiao;
const alertas = [];
const falas = [];
const esperar = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const alvo = () => (document.activeElement && document.activeElement !== document.body ? document.activeElement : regiao);
const desce = (code) => alvo().dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
const sobe = (code) => alvo().dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true, cancelable: true }));
const enunciado = () => document.querySelector('#quiz-app .quiz-pergunta')?.textContent ?? '';

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  document.querySelector('.stage-wrap').style.cssText = 'width:700px;height:420px;display:flex;flex:none';
  (await import('../app/js/consumer-quiz/main-quiz.ts')).bootQuiz({ doc: document, win: window, skills: THREE_SKILLS });
  // the quiz opens on its start screen since it became a test bench: into the first skill, as a pointer does
  await openSkill(document, 0);
  await esperar();
  regiao = document.getElementById('game-region');
  for (const [id, lista] of [['sr-alert', alertas], ['sr-status', falas]]) {
    const el = document.getElementById(id);
    new MutationObserver(() => { if (el.textContent) lista.push(el.textContent); })
      .observe(el, { childList: true, characterData: true, subtree: true });
  }
  regiao.focus();
});

beforeEach(() => { alertas.length = 0; falas.length = 0; });

describe('the quiz demo, by virtual button', () => {
  it('🔴 [Right] the confirm button answers the question under the cursor — ONE answer for one press, the release is not a second', async () => {
    const antes = enunciado();
    // the cursor on the right option (the fixture's first question is right on its second): a right answer moves the quiz on
    document.querySelector('#quiz-app button[data-alt="1"]').focus();
    desce('KeyJ');
    sobe('KeyJ');
    await esperar(1100); // the quiz lets the answer be read (900 ms) before the screen changes
    expect(alertas.length, 'no answer was given, or the release answered again').toBe(1);
    expect(enunciado(), 'the quiz did not move to the next question').not.toBe(antes);
  });

  it('🔴 [Right] R1 is the sonar: it says something about where the question is', async () => {
    desce('Digit8');
    sobe('Digit8');
    await esperar(200);
    expect(falas.length, 'R1 said nothing').toBeGreaterThan(0);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// `scratchpad/sonda-quiz-botoes.py`: seven answers of `handleCommand` were green before this file. Declared and NOT held here:
//   · action1 LISTENS: pressing it opens the reading (a worker and a model), which this browser project does not serve — the
//     page closes mid-run. The quiz's rule on what was heard has its own node cases (`heardAlternative`); the wire to
//     `listen()` needs a device, and the reading round with a real microphone is the Dev's (plan item 15).
//   · action3 stops a reading only while one is running, for the same reason: no reading can run here.
//   · the sonar pointing from the QUESTION (`atual`) and not from the option under the cursor is equivalent in WORDS: with four
//     options the cursor is at most 3 away, and every distance under 4 is said «very close». Only the tone's pitch differs,
//     which these cases do not hear.
