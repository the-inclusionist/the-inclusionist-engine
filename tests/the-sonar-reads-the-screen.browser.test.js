// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SONAR READS WHAT IS ON THE SCREEN NOW (ADR-0234), through the real quiz page and the real `createGame`.
//
// 🔴 The Dev, testing `dist/quiz.html`: «O sonar não está lendo o que aparece na tela: a tela só é lida ao carregar.» Measured
// cause: the decision of ADR-0234 — «sonar do que está na tela» — was never built. R1 rang the NAVIGATION sonar («Sonar:
// pergunta 1, aqui, bem perto»), and the question was spoken once, by the narration, when it opened; in deaf mode the
// interpreter was handed that navigation sentence, not the screen.
//
// Pressed here the way a child presses it — R1 on the keyboard, the default solo scheme's `8` — and heard where it lands: the
// engine's voice (`tts.narrate`), and in deaf mode the caption and a double of the `Interpreter` port.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';
import { openSkill } from './fixtures/quiz-page.js';
import { THREE_SKILLS, INFANT } from './fixtures/quiz-skills.js';

/**
 * The screen as the sonar must read it: each line a sentence. Built from the DICTIONARY through the engine's translator and from the
 * fixture's skill, never from the page it checks. (`motor.t` and not an import of `i18n/pt`: a test that imports an engine layer and
 * names the quiz is a fixture the engine-boundary gate refuses.)
 */
const pt = new Proxy({}, { get: (_, key) => motor.t(String(key)) });
const sentence = (s) => (/[.!?…:;]$/u.test(s) ? s : `${s}.`);
const statementOf = (n) => INFANT.questions[n - 1].statement.pt;
const question = (n) => [statementOf(n), ...INFANT.questions[n - 1].options.map((o) => o.pt)].map(sentence).join(' ');
/** The skill's bar, which the game declared in its HUD and so is on screen for it (`ui/screen-text`): blue, green and red counts. */
const barLine = (blue, green, red) => sentence(motor.t('hud.barra', {
  nome: motor.t('quiz.hud.skill'), azuis: String(blue), verdes: String(green), vermelhos: String(red),
}));

let motor, regiao, narrate;
const signed = [];
const interpreter = {
  sign: (text) => { signed.push(text); return Promise.resolve({ signed: true }); },
  hide: () => {},
  dispose: () => {},
};
const esperar = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const alvo = () => (document.activeElement && document.activeElement !== document.body ? document.activeElement : regiao);
const key = (type, code) => alvo().dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
const press = (code) => { key('keydown', code); key('keyup', code); };
/** R1: the quiz's sonar in play, and the engine's with a menu open. */
const sonar = () => press('Digit8');
/** Everything the voice was handed since the last clear, as one list. */
const heard = () => narrate.mock.calls.map((c) => c[0]);
const card = () => [...document.querySelectorAll('.screen-pause')].find((e) => !e.hidden) ?? null;
const openPanel = () => [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden) ?? null;
const soundCaption = () => document.querySelector('.legenda-de-som');

async function closeMenus() {
  for (let i = 0; i < 6 && (openPanel() || card()); i++) { press('Escape'); await esperar(40); }
}

beforeAll(async () => {
  localStorage.removeItem('incl_libras'); // deaf mode starts off, whatever another file left
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  document.querySelector('.stage-wrap').style.cssText = 'width:700px;height:420px;display:flex;flex:none';
  motor = (await import('../app/js/consumer-quiz/main-quiz.ts')).bootQuiz({ doc: document, win: window, interpreter, skills: THREE_SKILLS });
  await motor.localeReady();
  // the quiz opens on its start screen since it became a test bench: into the first skill, as a pointer does
  await openSkill(document, 0);
  await esperar(120);
  regiao = document.getElementById('game-region');
  regiao.focus();
  narrate = vi.spyOn(motor.tts, 'narrate').mockImplementation(() => {});
});
afterAll(() => {
  narrate.mockRestore();
  if (motor.deafMode.isOn()) motor.deafMode.toggle();
});
beforeEach(() => { narrate.mockClear(); signed.length = 0; });

describe('the sonar reads what is on the screen now (ADR-0234)', () => {
  it('🔴 [Right] in play: the statement and every option, in reading order — and none of the engine\'s chrome', () => {
    sonar();
    expect(heard(), 'R1 did not read the screen').toEqual([`${question(1)} ${barLine(0, 0, 0)}`]);
    const read = heard()[0];
    // the quick bar's icons and the session clock are the engine's, not what the child asked about
    expect(read, 'the quick bar was read').not.toMatch(/🦯|🗨️|🦻|☰/u);
    expect(read, 'the session clock was read').not.toMatch(/\d:\d\d:\d\d/);
    expect(read, 'the navigation sentence was read instead of the screen').not.toMatch(/Sonar:/);
  });

  it('🔴 [Right] hidden text is not read: `hidden`, `aria-hidden`, `display: none`, `visibility: hidden`, screen-reader-only', () => {
    const app = document.getElementById('quiz-app');
    const hidden = document.createElement('div');
    hidden.innerHTML = '<p hidden>OCULTO-A</p><p aria-hidden="true">OCULTO-B</p><p style="display:none">OCULTO-C</p>'
      + '<p style="visibility:hidden">OCULTO-D</p><p class="sr-only">OCULTO-E</p><p style="opacity:0">OCULTO-F</p>'
      + '<p>VISIVEL</p>';
    app.appendChild(hidden);
    try {
      sonar();
      const read = heard()[0] ?? '';
      expect(read, 'the case measures nothing: the visible line was not read either').toContain('VISIVEL.');
      expect(read.match(/OCULTO-[A-F]/gu) ?? [], 'text nobody sees was read aloud').toEqual([]);
    } finally {
      hidden.remove();
    }
  });

  it('🔴 [Right] after answering, the NEW question and its options — never the one read at load', async () => {
    document.querySelector('#quiz-app button[data-alt="1"]').focus(); // the right option: a wrong one does not move on
    press('KeyJ'); // confirm: answers the first question
    await esperar(1100); // the quiz lets the answer be read (900 ms) before the screen changes
    expect(document.querySelector('.quiz-pergunta')?.textContent, 'the quiz did not move on').toBe(statementOf(2));
    narrate.mockClear();
    sonar();
    expect(heard(), 'R1 read something other than the screen as it is now').toEqual([`${question(2)} ${barLine(1, 0, 0)}`]);
    expect(heard()[0]).not.toContain(statementOf(1));
  });

  it('🔴 [Right] with a panel open: the PANEL in front — not the question behind it, not the card under it', async () => {
    document.querySelector('#title-icons [data-pi="menu"]').click(); // the touch door to the menus
    await esperar();
    expect(card(), 'the menu did not open the card').not.toBeNull();
    card().querySelector('.pm-btn[data-act="options"]').click();
    await esperar();
    card().querySelector('.pm-btn[data-act="visual"]').click();
    await esperar();
    try {
      expect(openPanel()?.id, 'the visual panel did not open').toBe('visual');
      narrate.mockClear();
      sonar();
      const read = heard();
      expect(read.length, 'R1 with a panel open read nothing — the menu swallowed the press').toBe(1);
      expect(read[0].startsWith(sentence(pt['pause.visual'])), `the panel's title does not open the reading: «${read[0]}»`).toBe(true);
      expect(read[0], 'the question behind the panel was read').not.toContain(statementOf(2));
      expect(read[0], 'the card under the panel was read').not.toContain(pt['pause.quit']);
      expect(openPanel()?.id, 'R1 moved the menu instead of reading it').toBe('visual');
    } finally {
      await closeMenus();
    }
    expect(card(), 'the menus did not close — the next case would measure the card').toBeNull();
  });

  it('🔴 [Right] with the card open: the card', async () => {
    document.querySelector('#title-icons [data-pi="menu"]').click();
    await esperar();
    try {
      narrate.mockClear();
      sonar();
      expect(heard()[0]?.startsWith(sentence(pt['pause.title'])), `the card was not read: «${heard()[0]}»`).toBe(true);
      expect(heard()[0]).toContain(sentence(pt['pause.quit']));
    } finally {
      await closeMenus();
    }
  });

  it('🔴 [Right] deaf mode: the same text is captioned and handed to the interpreter — and nothing is spoken', async () => {
    motor.deafMode.toggle();
    try {
      sonar();
      await esperar(0);
      expect(signed, 'the interpreter was not handed the screen').toEqual([`${question(2)} ${barLine(1, 0, 0)}`]);
      expect(soundCaption()?.textContent, 'the screen was not captioned').toBe(`${question(2)} ${barLine(1, 0, 0)}`);
      expect(narrate, 'deaf mode spoke the screen').not.toHaveBeenCalled();

      // and with a menu open, the menu — by the same two doors
      signed.length = 0;
      document.querySelector('#title-icons [data-pi="menu"]').click();
      await esperar();
      sonar();
      await esperar(0);
      expect(signed.length, 'with a menu open the interpreter was not asked').toBe(1);
      expect(signed[0].startsWith(sentence(pt['pause.title'])), `the interpreter was not handed the card: «${signed[0]}»`).toBe(true);
      expect(soundCaption()?.textContent).toBe(signed[0]);
      expect(narrate, 'deaf mode spoke the menu').not.toHaveBeenCalled();
    } finally {
      await closeMenus();
      if (motor.deafMode.isOn()) motor.deafMode.toggle();
    }
  });

  it('🎯 [Zero] a DOM world has no canvas to confess: `problems` does not say the screen is unreadable', () => {
    expect(motor.problems.join('\n')).not.toMatch(/the sonar cannot read this game's screen/);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// Each run alone against this file (and the node block of `audio-sonar.node.test.js`), then reverted:
//   · the words stay the navigation sentence («reads the navigation name instead») → in play, hidden, after answering, deaf mode
//     (and the node block's words, every-press and no-target cases);
//   · the root reads the screen once and keeps it («reads the text captured at load») → hidden, after answering, deaf mode;
//   · `aria-hidden` not checked · the computed display/visibility/opacity not checked · opacity 0 counted as shown ·
//     screen-reader-only text read → the hidden case;
//   · the engine's chrome read → in play, hidden, after answering, deaf mode; the session clock read → in play, after answering,
//     deaf mode;
//   · the dialog in front ignored → panel, card, deaf mode; the virtual controller ignoring `menuAnswers` → panel, card, deaf mode;
//   · the menu sonar, or the play sonar, speaking past deaf mode → deaf mode;
//   · no line breaks between blocks → every case that compares the reading.
// ⚠️ One SURVIVED and was REMOVED rather than covered: checking the `hidden` attribute beside the computed `display`. `hidden`
// hides BY `display: none`, so the check was the same question twice; the rendering decides (`ui/screen-text.isShown`).
// ⚠️ And two survive HERE and are held in `boot-create-game.browser.test.js`: taking the first open dialog, and counting an
// `inert` layer — the engine inerts the layers under the front card, so in the quiz each rule covers the other.
