// SPDX-License-Identifier: AGPL-3.0-or-later
// THE QUIZ READS ITS OPTIONS, NUMBERED, AFTER THE STATEMENT — and draws the same numbers (ADR-0158 rules 1 and 3).
//
// 🔴 The Dev, with narration on: the quiz said the statement and then nothing — «não fala as opções, que nem numeradas
// estão». The pure functions are gated in `consumer-quiz.node`; this file gates the WIRING, on the real page: what
// reaches the voice when the page boots, and what the next arrow press says.
//
// 📌 The voice is observed at `speechSynthesis.speak`, the fallback every narration reaches when no neural voice is
// declared — the quiz declares none. The spy goes in BEFORE the module boots, or the first question is missed.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';

const falas = [];
let ttsAnterior = null;

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  ttsAnterior = localStorage.getItem('incl_audiocat_tts');
  // narration is born OFF (`platform/audio-mixer`: a robotic voice overloads children with ASD) — this child turned it on
  localStorage.setItem('incl_audiocat_tts', JSON.stringify({ on: true, vol: 0.8 }));
  window.speechSynthesis.speak = (u) => { falas.push(u.text); };
  const corpo = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  document.body.innerHTML = corpo;
  await import('../app/js/consumer-quiz/main-quiz.ts');
  await new Promise((r) => requestAnimationFrame(() => r(null)));
});

afterAll(() => {
  if (ttsAnterior === null) localStorage.removeItem('incl_audiocat_tts');
  else localStorage.setItem('incl_audiocat_tts', ttsAnterior);
});

describe('the quiz, heard', () => {
  it('🔴 [Right] opening the first question says its statement AND «1 Gato, 2 Galinha, 3 Cavalo, 4 Peixe»', () => {
    expect(falas, 'nothing reached the voice — is narration off by default?').not.toHaveLength(0);
    expect(falas).toContain('Qual animal põe ovos e tem bico? 1 Gato, 2 Galinha, 3 Cavalo, 4 Peixe');
  });

  it('🔴 [Right] an arrow press says the option REACHED, with its number — not the statement again', () => {
    const antes = falas.length;
    document.getElementById('game-region').dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown', bubbles: true }));
    expect(falas.slice(antes)).toEqual(['2 Galinha']);
  });

  it('🔴 [Right] the quiz NAMES its positions, so its virtual pad can move through questions and menus (ADR-0162)', () => {
    // Since a pad button appears only when the game names it, a quiz with no `preset` would have SELECT and START only.
    expect([...document.querySelectorAll('#touch-controls .touch-btn[data-btn]')].map((b) => b.textContent).sort())
      .toEqual(['Confirmar', 'Voltar']);
    expect(document.querySelector('#touch-controls #touch-stick, #touch-controls #touch-cross'), 'no directional on the quiz').not.toBeNull();
  });

  it('🎯 [Right] the options DRAW their numbers — the counter the pause card uses', () => {
    const lista = document.querySelector('.quiz-alts');
    const opcao = document.querySelector('.quiz-alt');
    expect(getComputedStyle(lista).counterReset).toMatch(/^item-menu\b/);
    expect(getComputedStyle(opcao).counterIncrement).toMatch(/^item-menu\b/);
    expect(getComputedStyle(opcao, '::before').content, 'no number, or the number enters the name').toBe('counter(item-menu) / ""');
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   Q1 `render` narrates the statement alone again           🔴 (this file, twice)
//   Q2 an option said without its number                     🔴 (this file and the node file)
//   Q3 every draw re-reads the whole question                🔴 the arrow press says the statement again
//   Q4 the narrated question is not remembered               🔴 the arrow press re-reads everything
//   Q5 `.quiz-alts` loses the counter reset                  🔴
//   Q6 `.quiz-alt` draws no number                           🔴
