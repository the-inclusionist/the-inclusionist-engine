// SPDX-License-Identifier: AGPL-3.0-or-later
// A KEY TYPED INTO A TEXT FIELD IS THE FIELD'S — IT IS NOT START, NOT SELECT, NOT THE MENUS' SECOND DOOR (ADR-0111 errata of
// 2026-09-26, ADR-0155).
//
// 🔴 Seen while testing (2026-09-26): Enter pressed while typing in a text field opened the engine's quick pause. In the solo
// scheme `Enter` and `H` are `start` and `F` is `select` (`input/default-bindings`), and the engine's own START and SELECT
// listeners (`boot/create-game`) asked only whether the key pressed ITS focused control — never whether it was typed into a
// field. So a child typing «half» into a field paused the game on the `h` and opened the menus on the `f`. The keyboard
// conductor already held a typed key back from PLAY (`input/key-default.keyGoesToGame`); the system positions do not go
// through it, and the rule stopped at that door.
//
// 📌 REAL KEYS ONLY (`userEvent`): the field has to receive the key for the case to mean anything, and an untrusted dispatched
// event types nothing.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { keyed } from './fixtures/declared-words.js';

let motor;
const comandos = [];
/** Every keydown as the window's bubble saw it last: whether some listener cancelled its default. */
const vistas = [];

const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2'] }),
  holdsAtOnce: () => 1,
  holdsKeys: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'option', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'options', gender: 'f', plural: true }, have: 0, need: 2 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});

const botao = () => document.getElementById('opcao');
const pausado = () => document.querySelector('#game-region .pausa-rapida');
const pausaAberta = () => !!pausado() && pausado().hidden === false;
const cartao = () => document.getElementById('vp-pause-0');
const cancelada = (code) => vistas.findLast((v) => v.code === code)?.cancelada;

beforeAll(async () => {
  const { createGame } = await import('../app/js/boot/create-game.js');
  const raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1">'
    + '<button id="opcao" type="button">Option</button>'
    + '</div><div id="title-icons"></div>'
    + '<div id="pagina"></div>'; // the host page around the game: a field there is typed into all the same
  document.body.appendChild(raiz);
  motor = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window },
    downloadHeavy: false, ...keyed({ preset: { up: { label: 'Up' }, down: { label: 'Down' }, action2: { label: 'Answer' } } }),
    setPhase: () => {},
    onCommand: (c) => comandos.push(c),
  });
  window.addEventListener('keydown', (e) => vistas.push({ code: e.code, cancelada: e.defaultPrevented }), true);
  window.addEventListener('keydown', (e) => { const v = vistas.at(-1); if (v?.code === e.code) v.cancelada = e.defaultPrevented; });
});

beforeEach(async () => {
  comandos.length = 0; vistas.length = 0;
  motor.pause.hide(0);
  if (pausaAberta()) { botao().focus(); await userEvent.keyboard('[Escape]'); }
});

/** A field, where the case says: inside the game region, or on the host page around it. */
function campo(html, onde) {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.getElementById(onde === 'jogo' ? 'game-region' : 'pagina').appendChild(el);
  return el.firstElementChild;
}

const CAMPOS = [
  ['a text input in the game region', '<input type="text">', 'jogo', (el) => el.value],
  ['a text input on the page, outside the game', '<input type="text">', 'pagina', (el) => el.value],
  ['a search input in the game region', '<input type="search">', 'jogo', (el) => el.value],
  ['a textarea in the game region', '<textarea></textarea>', 'jogo', (el) => el.value],
  ['a textarea on the page', '<textarea></textarea>', 'pagina', (el) => el.value],
  ['a contenteditable in the game region', '<div contenteditable="true"></div>', 'jogo', (el) => el.innerText],
];

describe('the scheme gives these keys the positions the cases assume', () => {
  it('🔴 [Conformance] Enter and H are `start`, F is `select`, I is `action4` — or the cases below measure nothing', () => {
    expect(motor.keyboard.actionOf('Enter', 0)).toBe('start');
    expect(motor.keyboard.actionOf('KeyH', 0)).toBe('start');
    expect(motor.keyboard.actionOf('KeyF', 0)).toBe('select');
    expect(motor.keyboard.actionOf('KeyI', 0)).toBe('action4');
  });
});

describe('Enter typed into a text field is the field\'s: the quick pause does not open', () => {
  for (const [nome, html, onde, lido] of CAMPOS) {
    it(`🔴 [Right] ${nome}: Enter reaches the field, the quick pause stays shut, the game hears nothing`, async () => {
      const el = campo(html, onde);
      try {
        el.focus();
        expect(document.activeElement, 'the field has no focus: the case would measure nothing').toBe(el);
        await userEvent.keyboard('ab[Enter]');
        expect(pausaAberta(), `Enter typed into ${nome} opened the quick pause`).toBe(false);
        expect(cartao().hidden, `Enter typed into ${nome} opened the menus`).toBe(true);
        expect(cancelada('Enter'), `the engine cancelled Enter typed into ${nome}: the field lost its key`).toBe(false);
        expect(document.activeElement, `the focus left ${nome}`).toBe(el);
        expect(lido(el), `${nome} did not receive what was typed`).toMatch(/ab/);
        if (el.tagName === 'TEXTAREA') expect(el.value, 'Enter did not break the line in the textarea').toBe('ab\n');
        expect(comandos, `typing into ${nome} was played`).toEqual([]);
      } finally { el.parentElement.remove(); }
    });
  }
});

describe('the other system keys and every character of the scheme, typed into a field, are the field\'s', () => {
  for (const [nome, html, onde, lido] of CAMPOS) {
    it(`🔴 [Right] ${nome}: «half» — H is \`start\`, F is \`select\` — types the word and opens nothing`, async () => {
      const el = campo(html, onde);
      try {
        el.focus();
        await userEvent.keyboard('half');
        expect(pausaAberta(), `H typed into ${nome} opened the quick pause`).toBe(false);
        expect(cartao().hidden, `F typed into ${nome} opened the menus`).toBe(true);
        expect(lido(el), `${nome} did not receive «half»`).toMatch(/half/);
        expect(cancelada('KeyH'), 'the engine cancelled H in the field').toBe(false);
        expect(cancelada('KeyF'), 'the engine cancelled F in the field').toBe(false);
        expect(comandos, `typing into ${nome} was played`).toEqual([]);
      } finally { el.parentElement.remove(); }
    });
  }

  it('🔴 [Right] every character key of the solo scheme types itself, and no position reaches anybody', async () => {
    // WASD, UJKI, Y O, 7 8, H F and Space: every character key the solo scheme binds (`input/default-bindings`).
    const el = campo('<input type="text">', 'jogo');
    try {
      el.focus();
      await userEvent.keyboard('wasdujkiyo78hf[Space]');
      expect(el.value, 'a key of the scheme did not reach the field').toBe('wasdujkiyo78hf ');
      expect(pausaAberta(), 'a key of the scheme typed into the field opened the quick pause').toBe(false);
      expect(cartao().hidden, 'a key of the scheme typed into the field opened the menus').toBe(true);
      expect(vistas.filter((v) => v.cancelada).map((v) => v.code), 'the engine cancelled keys typed into the field').toEqual([]);
      expect(comandos, 'a key of the scheme typed into the field was played').toEqual([]);
    } finally { el.parentElement.remove(); }
  });

  it('🔴 [Right] the arrows move the caret in the field, and the game hears none of them', async () => {
    const el = campo('<input type="text">', 'pagina');
    try {
      el.focus();
      await userEvent.keyboard('abc[ArrowLeft][ArrowLeft]X[ArrowRight][ArrowUp][ArrowDown]');
      expect(el.value, 'the arrows did not move the caret: the field lost them').toBe('aXbc');
      expect(vistas.filter((v) => v.cancelada).map((v) => v.code), 'the engine cancelled an arrow in the field').toEqual([]);
      expect(comandos, 'an arrow in the field was played').toEqual([]);
    } finally { el.parentElement.remove(); }
  });
});

describe('with the quick pause open, a letter typed into a field is still the field\'s', () => {
  // The quick pause's bar is a menu: `ui/menu-nav` takes its own keys (arrows, Enter, Space, Escape) first, wherever the focus
  // is. H (`start` again: leave) and I (`action4`: on to the card) are not the bar's, and reach the engine's listeners below it.
  it('🔴 [Right] «hi» typed into a field leaves neither the quick pause nor goes on to the card', async () => {
    botao().focus();
    await userEvent.keyboard('[Enter]');
    expect(pausaAberta(), 'Enter on the game\'s button did not open the quick pause: the case would measure nothing').toBe(true);
    const el = campo('<input type="text">', 'pagina');
    try {
      el.focus();
      await userEvent.keyboard('hi');
      expect(el.value, 'the field did not receive «hi»').toBe('hi');
      expect(pausaAberta(), 'H typed into a field left the quick pause').toBe(true);
      expect(cartao().hidden, 'I typed into a field opened the card').toBe(true);
    } finally { el.parentElement.remove(); }
  });
});

describe('a key not typed into a field keeps START and SELECT working', () => {
  for (const code of ['Enter', 'KeyH']) {
    it(`🔴 [Right] ${code} on the game's own button opens the quick pause`, async () => {
      botao().focus();
      await userEvent.keyboard(`[${code}]`);
      expect(pausaAberta(), `${code} no longer opens the quick pause`).toBe(true);
      expect(cancelada(code), `${code} opened the quick pause and kept its default`).toBe(true);
    });
  }

  it('🔴 [Right] Enter with nothing focused opens the quick pause', async () => {
    document.activeElement?.blur?.();
    await userEvent.keyboard('[Enter]');
    expect(pausaAberta(), 'Enter with no focus no longer opens the quick pause').toBe(true);
  });

  it('🔴 [Right] F on the game\'s own button opens the menus', async () => {
    botao().focus();
    await userEvent.keyboard('[KeyF]');
    expect(cartao().hidden, 'F no longer opens the menus').toBe(false);
  });

  it('🔴 [Boundary] after the field loses the focus, Enter is START again', async () => {
    const el = campo('<input type="text">', 'jogo');
    try {
      el.focus();
      await userEvent.keyboard('[Enter]');
      expect(pausaAberta(), 'Enter typed into the field opened the quick pause').toBe(false);
      botao().focus();
      await userEvent.keyboard('[Enter]');
      expect(pausaAberta(), 'leaving the field did not give Enter back to START').toBe(true);
    } finally { el.parentElement.remove(); }
  });
});

// ============================== MUTATIONS CHECKED ==============================
// `scratchpad/enter-in-field/mutate.mjs` (2026-09-26), each alone, exactly one occurrence required (LF files), restored from a
// copy and verified by SHA-256. Run with this file, `a-delivered-key-does-not-also-click`, `start-and-select-from-every-transport`
// and `key-default.node`.
//   M1 START's listener does not ask about the field           🔴 every Enter and «half» case, the scheme's keys, «hi», the blur case
//   M2 SELECT's listener does not ask about the field          🔴 every «half» case and the scheme's keys
//   M3 `action4` in the quick pause does not ask               🔴 «hi»
//   M4 START asks about the field only on the way in           🔴 «hi»
//   M5 `keyTypedIntoField` forgets contenteditable              🔴 both contenteditable cases here, the two in the delivery file, two node cases
//   M6 it forgets input, textarea and select                    🔴 twenty cases across the three browser files and the node file
//   M7 no target is ever a field                                🔴 twenty-four cases
//   M8 every target is a field                                  🔴 thirty-four cases: START, SELECT and play stop working on buttons
