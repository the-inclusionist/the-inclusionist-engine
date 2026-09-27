// SPDX-License-Identifier: AGPL-3.0-or-later
// THE DEMO QUIZ SAYS EVERY WORD THROUGH ITS ENGINE'S TRANSLATOR (ADR-0232 D3).
//
// The quiz no longer imports `core/i18n`: its words come from the handle's `t`, bound late (`translate` in
// `consumer-quiz/main-quiz`), because some of them are asked for while the engine is still being built. What this file
// measures is every place a child meets one of those words — the welcome, the answer, the end, what the quiz says while it
// listens, the help's slides and the keyboard map — and that none of them is a raw key.
//
// 📌 THE REAL QUIZ PAGE, in its own file: a clean module registry, so the quiz boots here and nowhere else. The engine's
// `reading.choose` (ADR-0256) is replaced by one that "hears" what a case says and names the option whose words it contains,
// over the options the quiz passed — the only way the quiz's listening lines can be reached without a microphone, and still a
// measure of what the quiz hands the engine. The engine's own rule has its cases in `choosing-by-voice.node.test.js`; importing
// it here would make this an engine test that needs the quiz (`engine-boundary`).
//
// ⚠️ No `core/i18n` import, and no dictionary import: either would make this the test of an ENGINE module, and the
// boundary gate would count the quiz's own names as a debt (measured). So a raw key is what is looked for, never a phrase.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import pagina from '../app/quiz.html?raw';
import { openSkill } from './fixtures/quiz-page.js';
import { THREE_SKILLS, INFANT } from './fixtures/quiz-skills.js';

// No leading `\b`: a key glued to the key cap before it («Jquiz.pos.confirm») has no word boundary.
const RAW_KEY = /(quiz|sr)\.[a-zA-Z]/;
const esperar = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const status = [];
const alerts = [];
let regiao;
/** What the fake choice hears at its next ask: `{ text }`, `{ error }`, or nothing at all. */
let hearing = {};
/** The options the quiz last handed the engine, and the settings of every ask. */
let offered = [];
const asked = [];

/**
 * `reading.choose` as the engine answers it, on what the case says instead of a microphone. It tells the quiz its ear is open
 * as the engine does: AT ONCE when the 👄's ear is lent (`lent`), after the model's load (`loadMs`) otherwise, never when it fails.
 */
const fakeChoose = async (options, settings = {}) => {
  offered = options;
  asked.push(settings);
  const h = hearing;
  if (h.lent) settings.onListening?.();
  await esperar(20);
  if (h.error) throw new Error(h.error);
  if (!h.lent) { await esperar(h.loadMs ?? 0); settings.onListening?.(); await esperar(20); }
  const words = ` ${(h.text ?? '').toLowerCase()} `;
  const named = options.map((o, i) => [o.replace(/[^\p{L}\p{N} ]/gu, '').trim().toLowerCase(), i]).filter(([o]) => o && words.includes(` ${o} `)).map(([, i]) => i);
  return named.length === 1 ? { chosen: named[0], heard: h.text, ended: 'chosen' } : { chosen: null, heard: h.text ?? '', ended: 'timeout' };
};

const tecla = (code) => regiao.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
const statement = () => document.querySelector('#quiz-app .quiz-pergunta')?.textContent ?? '';
/** Lines the quiz says for one ask: «loading» (unless lent) · «listening» (unless it failed) · the outcome. */
const linesFor = (h) => (h.lent || h.error ? 2 : 3);
async function listenHearing(h) {
  hearing = h;
  alerts.length = 0;
  regiao.focus();
  tecla('KeyU'); // action1, «falar», in the default one-player scheme
  for (let i = 0; i < 60 && alerts.length < linesFor(h); i++) await esperar(50);
}
/** The «listening» line, learned from an ask with a lent ear — the one case where it is the FIRST thing said. */
let listeningLine = null;

beforeAll(async () => {
  document.body.innerHTML = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  for (const [id, into] of [['sr-status', status], ['sr-alert', alerts]]) {
    const el = document.getElementById(id);
    new MutationObserver(() => { if (el.textContent) into.push(el.textContent); })
      .observe(el, { childList: true, characterData: true, subtree: true });
  }
  const engine = (await import('../app/js/consumer-quiz/main-quiz.ts')).bootQuiz({ doc: document, win: window, skills: THREE_SKILLS });
  engine.reading.choose = fakeChoose;
  // the quiz opens on its start screen since it became a test bench: into the first skill, as a pointer does
  await openSkill(document, 0);
  for (let i = 0; i < 40 && !document.querySelector('.quiz-alts'); i++) await esperar(50);
  await esperar(150);
  regiao = document.getElementById('game-region');
  expect(document.querySelector('.quiz-alts'), 'the quiz never drew — the case would measure nothing').not.toBeNull();
});

describe('the demo quiz, in its engine\'s language', () => {
  it('🔴 [Right] the welcome is said in words, never as a key', () => {
    expect(status.length, 'the quiz said nothing at boot — this case would measure nothing').toBeGreaterThan(0);
    expect(status.join(' | '), 'the welcome was a raw key').not.toMatch(RAW_KEY);
  });

  it('🔴 [Right] listening, not understanding, and giving the statement back are said in words', async () => {
    const before = statement();
    expect(before, 'the statement is a raw key').not.toMatch(RAW_KEY);
    await listenHearing({ text: 'banana' });
    expect(alerts.length, 'the quiz said nothing while listening — this case would measure nothing').toBeGreaterThan(1);
    expect(alerts.join(' | '), 'the quiz spoke a raw key while listening').not.toMatch(RAW_KEY);
    expect(alerts.at(-1), 'what the child said is not in the answer').toContain('banana');
    for (let i = 0; i < 200 && statement() !== before; i++) await esperar(50);
    expect(statement(), 'the statement did not come back, or came back as a key').toBe(before);
  }, 15000);

  it('🔴 [Right] hearing nothing is said in words', async () => {
    await listenHearing({});
    expect(alerts.length).toBeGreaterThan(1);
    expect(alerts.join(' | '), 'hearing nothing was said with a raw key').not.toMatch(RAW_KEY);
  });

  it('🔴 [Right] a recogniser that fails is said in words', async () => {
    await listenHearing({ error: 'not-allowed' });
    expect(alerts.length).toBeGreaterThan(1);
    expect(alerts.join(' | '), 'the failure was said with a raw key').not.toMatch(RAW_KEY);
  });

  /*
   * 🔴 «LOADING» UNTIL THE EAR IS OPEN, «LISTENING» ONLY THEN (the Dev, 2026-09-27: the first U in a language waited for its model
   * and the game looked frozen). The quiz waits for the engine's `onListening` before it tells the child to speak.
   */
  it('🔴 [Right] with the 👄\'s ear lent, «listening» is the first thing said — no «loading» for a wait that does not exist', async () => {
    await listenHearing({ text: 'nothing that matches', lent: true });
    expect(alerts.length, 'the quiz said nothing — this case would measure nothing').toBeGreaterThan(1);
    listeningLine = alerts[0];
    expect(listeningLine, 'the listening line is a raw key').not.toMatch(RAW_KEY);
  });

  it('🔴 [Right] while the model loads the statement says «loading», and «listening» only once the ear is open', async () => {
    expect(listeningLine, 'the lent case did not run first — this case would measure nothing').toBeTruthy();
    hearing = { text: 'nothing that matches', loadMs: 400 };
    alerts.length = 0;
    regiao.focus();
    tecla('KeyU');
    for (let i = 0; i < 20 && alerts.length < 1; i++) await esperar(25);
    const loading = alerts[0];
    expect(loading, 'the quiz said nothing at the key — a child would think the game froze').toBeTruthy();
    expect(loading, '«loading» was said as a raw key').not.toMatch(RAW_KEY);
    expect(loading, 'the child was told to speak while the model was still loading').not.toBe(listeningLine);
    expect(statement(), 'the statement box does not say «loading»').toBe(loading);
    for (let i = 0; i < 60 && alerts.length < 2; i++) await esperar(25);
    expect(alerts[1], '«listening» did not follow once the ear opened').toBe(listeningLine);
    for (let i = 0; i < 60 && alerts.length < 3; i++) await esperar(50);
  });

  it('🔴 [Right] saying an option\'s WORD answers with that option (ADR-0216)', async () => {
    // The options are dictionary keys since 2026-09-23; what the child says is a word of her language. Comparing the heard
    // text with the KEYS (`quiz.p1.b`) meant no spoken answer could ever match.
    const word = document.querySelector('#quiz-app button[data-alt="1"]').textContent.trim();
    expect(word, 'the option has no word — this case would measure nothing').not.toMatch(RAW_KEY);
    const shown = [...document.querySelectorAll('#quiz-app button[data-alt]')].map((b) => b.textContent.trim());
    await listenHearing({ text: `é ${word.toLowerCase()}` });
    // the engine is handed the options AS SHOWN — keys or other text would make no spoken answer match (ADR-0256)
    expect(offered.map((o) => o.trim()), 'the quiz handed the engine other words than it shows').toEqual(shown);
    // Answered, the quiz draws the NEXT question; not understood, it only writes a line where the statement is.
    const optionNow = () => document.querySelector('#quiz-app button[data-alt="1"]')?.textContent.trim();
    for (let i = 0; i < 60 && optionNow() === word; i++) await esperar(50);
    expect(optionNow(), `saying «${word}» did not answer the question`).not.toBe(word);
  });

  it('🔴 [Right] the help\'s slides — how to play, then each position — are written in words', () => {
    regiao.focus();
    tecla('KeyF'); // the pause card
    document.querySelector('.screen-pause:not([hidden]) .pm-btn[data-act="ajuda"]').click();
    const slides = document.querySelector('#help-list').firstElementChild;
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
      seen.add(slides.textContent);
      slides.dispatchEvent(new CustomEvent('passo', { detail: 1 }));
    }
    expect(seen.size, 'the help showed fewer slides than the quiz declares').toBeGreaterThan(3);
    for (const text of seen) expect(text, 'a help slide shows a raw key').not.toMatch(RAW_KEY);
    for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  });

  it('🔴 [Right] the keyboard map names each of the quiz\'s positions in words', () => {
    tecla('KeyF');
    const card = document.querySelector('.screen-pause:not([hidden])');
    card?.querySelector('.pm-btn[data-act="options"]')?.click();
    document.querySelector('.screen-pause:not([hidden]) .pm-btn[data-act="motora"]').click();
    document.querySelector('#opt-teclado-1').click();
    const map = document.querySelector('#ctrl');
    expect(map.querySelectorAll('[id^="ctrl-act-"]').length, 'the map drew no position').toBeGreaterThan(5);
    expect(map.textContent, 'a position is named by a raw key').not.toMatch(RAW_KEY);
    for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  });

  it('🔴 [Right] every answer is said in words — wrong, tried again, failed with its explanation, copied, right', async () => {
    // since the test bench there is no end: the questions come round again. What a child hears answering is these six lines.
    const said = async (i) => {
      alerts.length = 0;
      document.querySelector(`#quiz-app button[data-alt="${i}"]`).click();
      await esperar(100); // the alert is written on the next frame
      expect(alerts.length, 'answering said nothing').toBeGreaterThan(0);
      expect(alerts.join(' | '), 'an answer was said with a raw key').not.toMatch(RAW_KEY);
      return alerts.join(' | ');
    };
    const q = INFANT.questions.find((x) => x.statement.pt === statement());
    expect(q, 'the statement on screen is none of the fixture\'s — the case would measure nothing').toBeTruthy();
    const wrong = [0, 1, 2, 3, 4].filter((i) => i !== q.correct);
    await said(wrong[0]);
    await said(wrong[0]); // tried again
    await said(wrong[1]);
    expect(await said(wrong[2]), 'the explanation was not said').toContain(q.explanation.pt);
    for (const w of wrong.slice(0, 3)) await said(w); // the answer to copy
    await said(q.correct); // copied
    await esperar(1000);
    const next = INFANT.questions.find((x) => x.statement.pt === statement());
    await said(next.correct); // right
    await esperar(1000);
  }, 15000);

  /**
   * 🔴 AN OPTION THAT IS CONTENT IS HEARD IN ITS OWN LANGUAGE (item 22, ADR-0225, ADR-0256): an English skill's options are
   * asked for in `en`, whatever the interface speaks, and a skill whose options translate asks for no language at all.
   */
  it('🔴 [Right] the options of an English skill are heard in English; options that translate in the page\'s language', async () => {
    const translating = asked.at(-1);
    expect(translating, 'no choice was asked before — this case would measure nothing').toBeDefined();
    expect(translating.language, 'a skill whose options translate asked for a language of its own').toBeUndefined();
    regiao.focus();
    for (let i = 0; i < 5 && !document.querySelector('#quiz-app .quiz-skill'); i++) { tecla('KeyK'); await esperar(150); }
    const english = [...document.querySelectorAll('#quiz-app .quiz-skill')].find((b) => /EF06LI17/.test(b.textContent));
    expect(english, 'the start screen has no English skill — the case would measure nothing').toBeTruthy();
    english.click();
    for (let i = 0; i < 40 && !document.querySelector('#quiz-app .quiz-alts'); i++) await esperar(25);
    await listenHearing({ text: 'nothing that matches' });
    expect(asked.at(-1).language, 'the English options were asked for in the page\'s language').toBe('en');
  });
});
// ============================== MUTATIONS CHECKED ==============================
// Each of the quiz's hand-overs to `translate` replaced, one at a time, by a `t` that answers the key:
//   the welcome · «ouvindo» · «não entendi» · «ouvi nada» · the failure · the statement given back · each answer ·
//   the two «how to play» texts · the six positions' names                                            🔴 each, its case above
// And (2026-09-27, item 22): the content language forgotten · the page's language always asked for   🔴 both, the last case
// · the options handed over as indices instead of as shown                                              🔴 «saying an option's WORD»
// And (2026-09-27, «carregando»): «listening» said at the key again · «loading» never said · «loading» said with a lent ear
