// SPDX-License-Identifier: AGPL-3.0-or-later
// THE QUIZ DEMO, answered with REAL key presses: one press is one answer.
//
// 🔴 Measured on the served `dist` (2026-09-26, Playwright): one press of Space answered TWO questions. The engine carried
// `action2` to the quiz, which answered the option under the cursor — and on the key's release the browser clicked the
// focused option button, whose click listener answered the NEXT question too. The second question was never seen.
// `quiz-virtual-buttons` could not see it: a dispatched `KeyboardEvent` is untrusted and triggers no default action, so
// only a key pressed through the browser (`userEvent`) reaches the button's activation.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';

let engine;
const alertas = [];
const falas = [];
const esperar = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const enunciado = () => document.querySelector('#quiz-app .quiz-pergunta')?.textContent ?? '';

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  document.querySelector('.stage-wrap').style.cssText = 'width:700px;height:420px;display:flex;flex:none';
  // Listening BEFORE the boot: the welcome is the first thing the status region says.
  for (const [id, lista] of [['sr-alert', alertas], ['sr-status', falas]]) {
    const el = document.getElementById(id);
    new MutationObserver(() => { if (el.textContent) lista.push(el.textContent); })
      .observe(el, { childList: true, characterData: true, subtree: true });
  }
  engine = (await import('../app/js/consumer-quiz/main-quiz.ts')).bootQuiz({ doc: document, win: window });
  await engine.localeReady();
  await esperar(200);
});

beforeEach(() => { alertas.length = 0; });

/** Presses `code` through the browser — the only press that reaches a focused button's own activation. */
async function pressAndWait(code) {
  await userEvent.keyboard(`[${code}]`);
  await esperar(1300); // the quiz lets the answer be read (900 ms) before the screen changes
}

describe('the quiz demo, by real key', () => {
  it('🔴 [Right] one press of Space, on the focused option, answers ONE question — not that one and the next', async () => {
    expect(document.activeElement?.dataset.alt, 'no option has the focus: the button\'s own activation is not being measured').toBe('0');
    const segunda = engine.t('quiz.p2');
    await pressAndWait('Space');
    expect(alertas, 'one press gave more than one answer (or none)').toHaveLength(1);
    expect(enunciado(), 'the quiz did not stop at the SECOND question').toBe(segunda);
  });

  it('🔴 [Boundary] a key the quiz does not use keeps its native behaviour: Tab still leaves the option', async () => {
    const opcao = document.querySelector('#quiz-app button[data-alt="0"]');
    opcao.focus();
    await userEvent.keyboard('[Tab]');
    expect(document.activeElement, 'Tab was swallowed on the option: the keyboard cannot leave the quiz').not.toBe(opcao);
    expect(alertas, 'Tab answered').toHaveLength(0);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// `mutate.mjs` (scratchpad), each alone, restored from a copy and verified by hash, 2026-09-26:
//   · M1 the quiz's keydown stops calling `preventDefault` → case 1 RED: one Space gave 2 answers.
//   · M2 the guard becomes «every key» → case 2 RED: Tab stayed on the option.
