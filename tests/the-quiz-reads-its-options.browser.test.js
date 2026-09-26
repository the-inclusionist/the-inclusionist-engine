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
import { openSkill } from './fixtures/quiz-page.js';
import { THREE_SKILLS } from './fixtures/quiz-skills.js';

const falas = [];
let ttsAnterior = null;

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  ttsAnterior = localStorage.getItem('incl_audiocat_tts');
  // narration is born OFF (`platform/audio-mixer`: a robotic voice overloads children with ASD) — this child turned it on
  localStorage.setItem('incl_audiocat_tts', JSON.stringify({ on: true, vol: 0.8 }));
  // A narration is handed as PARTS (ADR-0243), one utterance each, and it opens with a `cancel`: one entry here per narration,
  // its parts joined, so a sentence reads as the child hears it.
  const cancelOriginal = window.speechSynthesis.cancel.bind(window.speechSynthesis);
  let opened = false;
  window.speechSynthesis.cancel = () => { opened = false; cancelOriginal(); };
  window.speechSynthesis.speak = (u) => { if (opened) falas[falas.length - 1] += u.text; else { falas.push(u.text); opened = true; } };
  const corpo = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  document.body.innerHTML = corpo;
  (await import('../app/js/consumer-quiz/main-quiz.ts')).bootQuiz({ doc: document, win: window, skills: THREE_SKILLS });
  // the quiz opens on its start screen since it became a test bench: into the first skill, as a pointer does
  await openSkill(document, 0);
  await new Promise((r) => requestAnimationFrame(() => r(null)));
});

afterAll(() => {
  if (ttsAnterior === null) localStorage.removeItem('incl_audiocat_tts');
  else localStorage.setItem('incl_audiocat_tts', ttsAnterior);
});

describe('the quiz, heard', () => {
  it('🔴 [Right] opening the first question says its statement AND «Alfa 1, 1 de 5. Bravo 1, 2 de 5. …» (ADR-0167)', () => {
    expect(falas, 'nothing reached the voice — is narration off by default?').not.toHaveLength(0);
    // the fixture's first skill (tests/fixtures/quiz-skills.js), opened from the start screen
    expect(falas).toContain('EI03EF01: pergunta 1? Alfa 1, 1 de 5. Bravo 1, 2 de 5. Charlie 1, 3 de 5. Delta 1, 4 de 5. Eco 1, 5 de 5');
  });

  it('🔴 [Right] an arrow press says the option REACHED, its place after its name — not the statement again', () => {
    const antes = falas.length;
    // the options sit «1 2 3» over «4 5»: to the right of the first is the second
    document.getElementById('game-region').dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true }));
    expect(falas.slice(antes)).toEqual(['Bravo 1, 2 de 5']);
  });

  it('🔴 [Right] with the index turned off in the hearing panel, the option reached is said by name alone (ADR-0232)', () => {
    // The quiz no longer reads `core/state` by import: it asks `Engine.menuIndexOn()` at each draw. The child turns the
    // index off where she would — the engine's hearing panel, `#opt-menuindex` — and the next draw drops the «N de M».
    const regiao = document.getElementById('game-region');
    const indice = document.getElementById('opt-menuindex');
    expect(indice, 'the page mounts no hearing panel — this case would measure nothing').not.toBeNull();
    indice.click();
    try {
      const antes = falas.length;
      regiao.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft', bubbles: true }));
      expect(falas.slice(antes)).toEqual(['Alfa 1']);
    } finally {
      indice.click();
      regiao.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true }));
    }
  });

  it('🔴 [Right] the quiz hears the VIRTUAL CONTROLLER: S (the scheme\'s «down») moves the option, W brings it back (ADR-0111, #197)', () => {
    // 📏 The Dev, 2026-09-16: the quiz read raw arrow codes — its arrows worked, the scheme's W and S did not, and S rang the sonar.
    const regiao = document.getElementById('game-region');
    const marcada = () => document.querySelector('.quiz-alt.is-on').textContent;
    const tecla = (code, origem) => {
      const ev = new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true });
      if (origem) ev.__vpOrigem = origem;
      regiao.dispatchEvent(ev);
      regiao.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
    };
    const antes = marcada();
    tecla('KeyS');
    const depois = marcada();
    expect(depois).not.toBe(antes);
    tecla('KeyW');
    expect(marcada()).toBe(antes);
    // a key stamped as the eyes is not delivered again: the eyes press the controller themselves
    tecla('KeyS', 'olhos');
    expect(marcada()).toBe(antes);
  });

  it('🔴 [Zero] the quiz asks for NO on-screen pad — its options and its menu button are touched directly (ADR-0166 erratum)', () => {
    // The Dev, asked whether the quiz keeps the pad: «Sim» to taking it out, «e crie um botão para menu».
    expect(document.getElementById('touch-controls'), 'the quiz still draws an on-screen pad').toBeNull();
  });

  it('🔴 [Zero] the options draw NO number — the place is heard, not read (ADR-0167)', () => {
    for (const opcao of document.querySelectorAll('.quiz-alt')) {
      const antes = getComputedStyle(opcao, '::before').content;
      expect(antes === 'none' || antes === 'normal', `«${opcao.textContent}» draws «${antes}» before its name`).toBe(true);
      expect(opcao.textContent.trim(), 'an option\'s text starts with a digit').not.toMatch(/^\d/);
    }
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   Q1 `render` narrates the statement alone again           🔴 (this file, twice)
//   Q2 an option said without its number                     🔴 (this file and the node file)
//   Q3 every draw re-reads the whole question                🔴 the arrow press says the statement again
//   Q4 the narrated question is not remembered               🔴 the arrow press re-reads everything
//   Q7 the root not delivering keyboard commands (listener removed)  🔴 S moves the option, W brings it back
//   Q8 a key stamped `olhos` delivered again                         🔴 «not delivered again»
//   (Q5, Q6 held the drawn number; ADR-0167 took it out — see the checks in `itens-sem-numero`)
//   Q9 the page passing `true` for the index instead of `motor.menuIndexOn()` (ADR-0232)  🔴 «with the index turned off»
