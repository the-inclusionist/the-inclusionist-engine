// SPDX-License-Identifier: AGPL-3.0-or-later
// THE DEMO QUIZ AS A TEST BENCH, on the real page (the Dev: «O quiz está ineficiente para teste»).
//
// What a child meets, pressed through her keyboard scheme (the default solo one: arrows move, J confirms, K goes back):
//   · a START SCREEN of BNCC codes, the one under the cursor explained in the engine's footer (ADR-0244) and said with «N de M»;
//   · a skill's three questions of five options with the attempts of ADR-0049 §5–§6 — an option tried is off, the third wrong
//     attempt paints red and shows the explanation, three more mark the answer to copy and the bar goes orange at once;
//   · the questions coming round again with the options rotated, so the ten-question window turns the bar purple in a sitting;
//   · the skill's bar in the HUD's learning band, per skill, in memory only (ADR-0103);
//   · content in its language, with `lang` (WCAG 3.1.2), and narration built of parts (ADR-0243).
//
// 📌 The skills are the test's own (`fixtures/quiz-skills.js`), never `QUIZ_SKILLS`.
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import css from '../app/css/style.css?raw';
import { QUIZ_BODY } from './fixtures/quiz-page.js';
import { THREE_SKILLS, MATH, ENGLISH, INFANT } from './fixtures/quiz-skills.js';

const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const alerts = [];
const spoken = [];
const spokenParts = [];
let engine, region;
const key = (code) => {
  const t = document.activeElement && document.activeElement !== document.body ? document.activeElement : region;
  t.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
  t.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true, cancelable: true }));
};
const footer = () => {
  const b = document.querySelector('#game-region .barra-explicacao');
  return b && !b.hidden && b.getClientRects().length ? b.textContent : null;
};
const skills = () => [...document.querySelectorAll('#quiz-app .quiz-skill')];
const options = () => [...document.querySelectorAll('#quiz-app .quiz-alt')];
const optionTexts = () => options().map((b) => b.textContent);
const bar = () => document.querySelector('.hud-row .hud-barra');
const segments = () => [...bar().querySelectorAll('.hud-seg')].map((s) => s.dataset.seg).filter((s) => s !== 'vazio');
const pick = async (i) => { options()[i].click(); await wait(20); };
/** The fixture's right option on screen: its data index, rotated by `pass` places. */
const rightOn = (question, pass) => ((question.correct - pass) % 5 + 5) % 5;
/** Answers right and waits for the next question to be drawn (the quiz lets the answer be read for 900 ms). */
async function answerRight(question, pass) {
  const before = document.querySelector('#quiz-app .quiz-pergunta').textContent;
  await pick(rightOn(question, pass));
  for (let i = 0; i < 40 && document.querySelector('#quiz-app .quiz-pergunta')?.textContent === before; i++) await wait(50);
}
const wrongOnes = (question, pass) => [0, 1, 2, 3, 4].filter((i) => i !== rightOn(question, pass));

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = QUIZ_BODY;
  for (const [id, into] of [['sr-alert', alerts]]) {
    const el = document.getElementById(id);
    new MutationObserver(() => { if (el.textContent) into.push(el.textContent); }).observe(el, { childList: true, characterData: true, subtree: true });
  }
  engine = (await import('../app/js/consumer-quiz/main-quiz.ts')).bootQuiz({ doc: document, win: window, skills: THREE_SKILLS });
  // what the voice is handed: the quiz narrates through its engine's `tts.narrate`, read at each call
  // the quiz hands PARTS (ADR-0243); `spoken` keeps them joined, as a sentence, and `spokenParts` as handed
  engine.tts.narrate = (text) => {
    spokenParts.push(text);
    spoken.push(typeof text === 'string' ? text : text.map((p) => p.text).join(''));
  };
  for (let i = 0; i < 40 && !skills().length; i++) await wait(25);
  region = document.getElementById('game-region');
  region.focus();
});
beforeEach(() => { alerts.length = 0; spoken.length = 0; spokenParts.length = 0; });

describe('the start screen — the skills by BNCC code, explained in the footer (ADR-0244)', () => {
  it('🔴 [Right] the quiz OPENS on it: Educação Infantil first, then Ensino Fundamental, one button per skill', () => {
    expect(options(), 'the quiz opened on a question').toHaveLength(0);
    expect(skills().map((b) => b.textContent)).toEqual(['EI03EF01', 'EF05MA08', 'EF06LI17']);
    const names = [...document.querySelectorAll('#quiz-app .quiz-stage-name')].map((h) => h.textContent);
    expect(names).toEqual(['Educação Infantil', 'Ensino Fundamental']);
  });

  it('🔴 [Right] the skill under the cursor is explained in the footer — component · grade — skill — and follows the cursor', async () => {
    expect(footer()).toBe(`Escuta, fala, pensamento e imaginação · 4 a 5 anos — ${INFANT.skillText.pt}`);
    key('ArrowRight');
    await wait();
    expect(footer(), 'the footer did not follow the cursor').toBe(`Matemática · 5º ano — ${MATH.skillText.pt}`);
    expect(spoken.at(-1), 'the voice did not say the code, the component and the place').toBe('EF05MA08, Matemática, 2 de 3');
  });

  it('🔴 [Right] up and down reach every skill too, and the explanation follows the focus a screen reader moves', async () => {
    key('ArrowDown');
    await wait();
    expect(footer()).toMatch(/^Língua Inglesa/);
    skills()[0].focus();
    await wait();
    expect(footer(), 'the focus moved and the footer stayed').toMatch(/^Escuta, fala/);
  });

  it('🔴 [Right] a language change re-explains the skill in the new language', async () => {
    await engine.setLocale('en');
    await wait(120);
    try {
      expect(footer()).toBe(`Listening, speaking, thought and imagination · 4 to 5 years — ${INFANT.skillText.en}`);
      expect(document.querySelector('#quiz-app .quiz-stage-name').textContent).toBe('Early childhood education');
    } finally {
      await engine.setLocale('pt');
      await wait(120);
    }
  });

  it('🔴 [Right] confirming opens the skill, and leaving the start screen clears the footer (explain(null))', async () => {
    key('ArrowRight'); // EF05MA08
    await wait();
    key('KeyJ');
    await wait(120);
    expect(options(), 'confirm did not open the skill').toHaveLength(5);
    expect(document.querySelector('#quiz-app .quiz-pergunta').textContent).toBe(MATH.questions[0].statement.pt);
    expect(footer(), 'the start screen\'s explanation stayed over the question').toBeNull();
    expect(bar(), 'no learning bar in the HUD').not.toBeNull();
    expect(spoken.at(-1), 'the question was not read whole').toContain(MATH.questions[0].statement.pt);
  });
});

describe('the attempts, by ADR-0049 §5–§6 (EF05MA08, question 1, pass 0)', () => {
  const q = MATH.questions[0];

  it('🔴 [Right] a wrong attempt turns the option OFF — aria-disabled, and said — and picking it again is refused', async () => {
    const [w1] = wrongOnes(q, 0);
    await pick(w1);
    expect(options()[w1].getAttribute('aria-disabled')).toBe('true');
    // off is not told by colour alone (WCAG 1.4.1): the words are struck through
    expect(getComputedStyle(options()[w1]).textDecorationLine, 'an option tried is marked by colour alone').toContain('line-through');
    expect(alerts.at(-1)).toBe(`Ainda não: ${optionTexts()[w1]} sai da lista. Tente outra.`);
    expect(segments(), 'a wrong attempt painted a segment — two wrong attempts are the tolerance').toEqual([]);
    await pick(w1);
    expect(alerts.at(-1), 'the option tried was taken again').toBe(`${optionTexts()[w1]} já foi tentada. Escolha outra.`);
    expect(document.querySelectorAll('#quiz-app .quiz-alt[aria-disabled="true"]')).toHaveLength(1);
  });

  it('🔴 [Right] the THIRD wrong attempt paints RED, shows the explanation and reads it', async () => {
    const [, w2, w3] = wrongOnes(q, 0);
    await pick(w2);
    expect(segments()).toEqual([]);
    await pick(w3);
    expect(segments(), 'the failed question is not red').toEqual(['vermelho']);
    expect(document.querySelector('#quiz-app .quiz-note')?.textContent).toBe(q.explanation.pt);
    expect(alerts.at(-1)).toContain(q.explanation.pt);
    expect(spoken.join(' | '), 'the explanation was not read').toContain(q.explanation.pt);
    // every option back on for the three attempts after the explanation
    expect(document.querySelectorAll('#quiz-app .quiz-alt[aria-disabled="true"]')).toHaveLength(0);
  });

  it('🔴 [Right] three more wrong mark the answer to COPY; confirming it turns the bar ORANGE at once', async () => {
    const [w1, w2, w3] = wrongOnes(q, 0);
    for (const w of [w1, w2, w3]) await pick(w);
    const right = rightOn(q, 0);
    expect(options()[right].classList.contains('is-answer'), 'the answer is not marked').toBe(true);
    expect(getComputedStyle(options()[right], '::before').content, 'the answer to copy carries no mark but colour').toContain('➜');
    expect(document.querySelectorAll('#quiz-app .quiz-alt[aria-disabled="true"]')).toHaveLength(4);
    expect(document.activeElement, 'the cursor is not on the answer to copy').toBe(options()[right]);
    expect(bar().dataset.cor, 'the bar turned before the copy').toBe('nenhuma');
    key('KeyJ');
    await wait(60);
    expect(bar().dataset.cor, 'copying did not turn the bar orange at once').toBe('laranja');
    expect(segments(), 'the copy painted a second segment').toEqual(['vermelho']);
    for (let i = 0; i < 40 && options()[0]?.textContent === 'Alfa 1'; i++) await wait(50);
    expect(document.querySelector('#quiz-app .quiz-pergunta').textContent, 'the quiz did not go on').toBe(MATH.questions[1].statement.pt);
  });

  it('🔴 [Right] right first time is BLUE; right after one wrong attempt is GREEN — and the count restarted after the orange', async () => {
    await answerRight(MATH.questions[1], 0);
    expect(segments(), 'the bar did not start again after it signalled').toEqual(['azul']);
    await pick(wrongOnes(MATH.questions[2], 0)[0]);
    await answerRight(MATH.questions[2], 0);
    expect(segments()).toEqual(['azul', 'verde']);
  });
});

describe('the round comes round again — rotated, deterministic — and the window of ten is reached', () => {
  it('🔴 [Right] after the third question the first comes back with every option one place up', () => {
    expect(document.querySelector('#quiz-app .quiz-pergunta').textContent).toBe(MATH.questions[0].statement.pt);
    const data = MATH.questions[0].options.map((o) => o.pt);
    expect(optionTexts()).toEqual([...data.slice(1), data[0]]);
  });

  it('🔴 [Right] eight right first time in the window of ten turn the bar PURPLE', async () => {
    // two already on the bar (blue, green); eight blues more make ten, eight of them first time
    for (let n = 0; n < 8; n++) await answerRight(MATH.questions[n % 3], 1 + Math.floor(n / 3));
    expect(segments()).toHaveLength(10);
    expect(bar().dataset.cor, 'eight blues in ten did not raise the bar').toBe('roxa');
  }, 20000);
});

describe('each skill has its own bar, in memory only (ADR-0049 §5, ADR-0103)', () => {
  it('🔴 [Right] back goes to the start screen, and another skill starts with an empty bar; the first keeps its own', async () => {
    key('KeyK');
    await wait(120);
    expect(options(), 'back did not leave the question').toHaveLength(0);
    expect(footer(), 'the start screen came back without its explanation').toMatch(/^Matemática/);
    key('ArrowRight');
    await wait();
    key('KeyJ');
    await wait(120);
    expect(segments(), 'the other skill shows this one\'s history').toEqual([]);
    key('KeyK');
    await wait(120);
    key('ArrowLeft');
    await wait();
    key('KeyJ');
    await wait(120);
    expect(segments().length, 'going back lost the skill\'s bar').toBe(10);
    // and the round goes on where she left it: the third question of the fourth pass
    expect(document.querySelector('#quiz-app .quiz-pergunta').textContent, 'going back lost the skill\'s place').toBe(MATH.questions[2].statement.pt);
    expect(optionTexts()[0], 'the options came back unrotated').toBe(MATH.questions[2].options[3].pt);
  });

  it('🔴 [Right] answering stores NOTHING — no storage entry is written or changed by a question', async () => {
    // every write to a Storage, whoever makes it and whatever the key, while she answers: a right one, a wrong one, a red one
    // (the window's `localStorage` is this file's own backend, a plain object — `vitest.setup.browser.js`; `sessionStorage` a Storage)
    const writes = [];
    const spied = [localStorage, Storage.prototype].map((target) => {
      const [set, remove] = [target.setItem, target.removeItem];
      target.setItem = function (k, v) { writes.push(`set ${k}`); return set.call(this, k, v); };
      target.removeItem = function (k) { writes.push(`remove ${k}`); return remove.call(this, k); };
      return () => { target.setItem = set; target.removeItem = remove; };
    });
    try {
      await answerRight(MATH.questions[2], 3);
      for (const w of wrongOnes(MATH.questions[0], 4).slice(0, 3)) await pick(w);
      expect(segments().length, 'no result reached the bar — the case would measure nothing').toBeGreaterThan(0);
    } finally {
      for (const restore of spied) restore();
    }
    expect(writes, 'answering wrote to storage').toEqual([]);
  });
});

describe('content in its language (ADR-0243, WCAG 3.1.2)', () => {
  it('🔴 [Right] a language discipline\'s content carries `lang`, in the statement and on every option; the frame is the page\'s', async () => {
    key('KeyK');
    await wait(120);
    const idx = skills().findIndex((b) => b.textContent === 'EF06LI17');
    skills()[idx].click();
    await wait(120);
    const statement = document.querySelector('#quiz-app .quiz-pergunta');
    expect(statement.textContent).toBe('Complete a frase 1: «My ___ is Ana.»');
    expect(statement.querySelector('[lang="en"]')?.textContent).toBe('My ___ is Ana.');
    expect(options().map((b) => b.getAttribute('lang'))).toEqual(['en', 'en', 'en', 'en', 'en']);
    expect(document.documentElement.lang, 'the page itself moved to English').toBe('pt-BR');
    // and the voice gets PARTS (ADR-0243): the frame without a language, the content and every string option in English
    expect(spoken.at(-1)).toContain('Complete a frase 1: «My ___ is Ana.» sister, 1 de 5.');
    const handed = spokenParts.at(-1);
    expect(Array.isArray(handed), 'the voice was handed one joined text').toBe(true);
    expect(handed).toContainEqual({ text: 'My ___ is Ana.', language: 'en' });
    expect(handed).toContainEqual({ text: 'sister', language: 'en' });
    expect(handed.find((p) => p.text.includes('Complete a frase')), 'the frame carried a language').not.toHaveProperty('language');
    expect(ENGLISH.contentLanguage).toBe('en');
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (2026-09-26; same script and runs as quiz-round.node) — all red:
//   M1 the start screen explains nothing   M2 leaving it keeps its explanation   M3 no redraw on a language change
//   M4 the grade left out of the footer   M5 no «N de M» for a skill   M6 no `lang` on content in the statement
//   M7 no `lang` on a string option   M8 content spoken as frame   M9 no `aria-disabled` on a tried option
//   M10 no explanation shown   M11 the explanation not read   M12 the cursor not on the answer to copy
//   M13 copying does not turn the bar orange   M14 the third wrong paints nothing   M15 the bar of another skill in the HUD
//   M16 back does not leave the question   M17 re-entering a skill starts it over   M18 a result written to localStorage
//   (🔴 survived first: the case compared `Object.keys(localStorage)`, which on this file's backend are its METHODS — the
//   storage is now spied at its writes)   M19 parts joined with spaces   M20 the explanation narrated past `speak`
//   M21 the focus moved without the footer   M22 a wrong attempt said nothing   M23 a refused pick said nothing
//   M25 the skill under the cursor not said   M26 `{content}` filled into the frame as frame   C3 a tried option by colour alone
//   C4 the answer to copy marked by colour alone   W1 a stage name missing in en
