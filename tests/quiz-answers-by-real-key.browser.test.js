// SPDX-License-Identifier: AGPL-3.0-or-later
// THE QUIZ DEMO, answered with REAL key presses: the key its welcome names answers, and one press is one answer.
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

/**
 * The key a child presses for the name she HEARD: the bar for «Espaço», the arrow for its glyph, a letter's own key. Read
 * from the child's side on purpose — the case asks whether pressing what the line says answers, not whether the line
 * agrees with the scheme it was built from. (No engine module is imported: that would make this an engine test.)
 */
const NOME_PARA_TECLA = { Espaço: 'Space', Enter: 'Enter', '↑': 'ArrowUp', '↓': 'ArrowDown', '←': 'ArrowLeft', '→': 'ArrowRight' };
const teclaDoNome = (nome) => NOME_PARA_TECLA[nome] ?? (/^[A-Z]$/.test(nome) ? `Key${nome}` : /^\d$/.test(nome) ? `Digit${nome}` : null);

/** The question after the one on screen — one press, one answer, one step. */
const seguinte = () => {
  const perguntas = ['quiz.p1', 'quiz.p2', 'quiz.p3'].map((k) => engine.t(k));
  return perguntas[perguntas.indexOf(enunciado()) + 1];
};

describe('the quiz demo, by real key', () => {
  it('🔴 [Right] the welcome in the status region names a key that REALLY answers — pressed, it answers once', async () => {
    const boasVindas = falas.find((f) => f.startsWith('Quiz.'));
    expect(boasVindas, 'the status region never said the welcome').toBeTruthy();
    // pt, the boot language: «… e <key> para responder.»
    const nomeada = /e (\S+) para responder\./.exec(boasVindas)?.[1];
    expect(nomeada, `the welcome names no key to answer: «${boasVindas}»`).toBeTruthy();
    const code = teclaDoNome(nomeada);
    expect(code, `the welcome names «${nomeada}», which is no key a child can find: «${boasVindas}»`).toBeTruthy();
    const depois = seguinte();
    await pressAndWait(code);
    expect(alertas, `pressing «${nomeada}» did not give exactly one answer`).toHaveLength(1);
    expect(enunciado()).toBe(depois);
  });

  it('🔴 [Right] one press of Space, on the focused option, answers ONE question — not that one and the next', async () => {
    expect(document.activeElement?.dataset.alt, 'no option has the focus: the button\'s own activation is not being measured').toBe('0');
    const depois = seguinte();
    await pressAndWait('Space');
    expect(alertas, 'one press gave more than one answer (or none)').toHaveLength(1);
    expect(enunciado(), 'the quiz did not stop at the NEXT question').toBe(depois);
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
//   · M1 the quiz's keydown stops calling `preventDefault` → the Space case RED (2 answers), and the welcome case with it.
//   · M2 the guard becomes «every key» → the Tab case RED: Tab stayed on the option.
//   📌 That keydown LEFT the quiz the same day: the ENGINE cancels the default of a key it delivered (ADR-0111 erratum of
//   2026-09-26, `input/key-default`). Re-run against the engine: its conductor stops cancelling → the Space case and the
//   welcome case RED again; it cancels every key it sees → the Tab case RED. See `a-delivered-key-does-not-also-click`.
//   · B1 the welcome goes back to a fixed sentence naming Enter → the welcome case RED: Enter is not a key of `action2`.
//   · B2 the welcome reads `start` as the answering position (names H) → the welcome case RED.
