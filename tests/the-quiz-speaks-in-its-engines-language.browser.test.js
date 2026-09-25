// SPDX-License-Identifier: AGPL-3.0-or-later
// THE DEMO QUIZ SAYS EVERY WORD THROUGH ITS ENGINE'S TRANSLATOR (ADR-0232 D3).
//
// The quiz no longer imports `core/i18n`: its words come from the handle's `t`, bound late (`translate` in
// `consumer-quiz/main-quiz`), because some of them are asked for while the engine is still being built. What this file
// measures is every place a child meets one of those words — the welcome, the answer, the end, what the quiz says while it
// listens, the help's slides and the keyboard map — and that none of them is a raw key.
//
// 📌 THE REAL QUIZ PAGE, in its own file: a clean module registry, so the quiz boots here and nowhere else. The browser's
// recogniser is replaced by one that recognises "on the device" and hears what a case says, which is the only way the
// quiz's listening lines can be reached without a microphone.
//
// ⚠️ No `core/i18n` import, and no dictionary import: either would make this the test of an ENGINE module, and the
// boundary gate would count the quiz's own names as a debt (measured). So a raw key is what is looked for, never a phrase.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import pagina from '../app/quiz.html?raw';

// No leading `\b`: a key glued to the key cap before it («Jquiz.pos.confirm») has no word boundary.
const RAW_KEY = /(quiz|sr)\.[a-zA-Z]/;
const esperar = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const status = [];
const alerts = [];
let regiao;
/** What the fake recogniser hears at its next start: `{ text }`, `{ error }`, or nothing at all. */
let hearing = {};

/** A recogniser that recognises on the device (`processLocally` on its prototype) and hears `hearing`. */
class FakeRecognition {
  constructor() { this.onresult = null; this.onerror = null; this.onend = null; }
  start() {
    const h = hearing;
    setTimeout(() => {
      if (h.error) { this.onerror?.({ error: h.error }); return; }
      if (h.text) this.onresult?.({ results: [Object.assign([{ transcript: h.text }], { isFinal: true })] });
      this.onend?.();
    }, 20);
  }
  stop() { /* the session already ended */ }
  static available() { return Promise.resolve('available'); }
}
FakeRecognition.prototype.processLocally = false;

const tecla = (code) => regiao.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
const statement = () => document.querySelector('#quiz-app .quiz-pergunta')?.textContent ?? '';
async function listenHearing(h) {
  hearing = h;
  alerts.length = 0;
  regiao.focus();
  tecla('KeyU'); // action1, «falar», in the default one-player scheme
  for (let i = 0; i < 60 && alerts.length < 2; i++) await esperar(50);
}

beforeAll(async () => {
  window.SpeechRecognition = FakeRecognition;
  document.body.innerHTML = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  for (const [id, into] of [['sr-status', status], ['sr-alert', alerts]]) {
    const el = document.getElementById(id);
    new MutationObserver(() => { if (el.textContent) into.push(el.textContent); })
      .observe(el, { childList: true, characterData: true, subtree: true });
  }
  await import('../app/js/consumer-quiz/main-quiz.ts');
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

  it('🔴 [Right] the answer and the end are said in words', async () => {
    for (let q = 0; q < 3; q++) {
      alerts.length = 0;
      document.querySelector('#quiz-app button[data-alt="0"]').click();
      await esperar(100); // the alert is written on the next frame
      expect(alerts.join(' | '), 'the answer was said with a raw key').not.toMatch(RAW_KEY);
      expect(alerts.length, 'answering said nothing').toBeGreaterThan(0);
      await esperar(1000);
    }
    expect(statement(), 'the end is a raw key, or never came').not.toMatch(RAW_KEY);
    expect(document.querySelectorAll('#quiz-app button[data-alt]').length, 'the quiz did not reach its end').toBe(0);
  }, 15000);
});

// ============================== MUTATIONS CHECKED ==============================
// Each of the quiz's hand-overs to `translate` replaced, one at a time, by a `t` that answers the key:
//   the welcome · «ouvindo» · «não entendi» · «ouvi nada» · the failure · the statement given back · each answer and the end ·
//   the two «how to play» texts · the six positions' names                                            🔴 each, its case above
