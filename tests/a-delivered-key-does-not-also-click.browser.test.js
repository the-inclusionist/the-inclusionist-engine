// SPDX-License-Identifier: AGPL-3.0-or-later
// A KEY THE ENGINE DELIVERED TO THE GAME DOES NOT ALSO DO THE BROWSER'S DEFAULT (ADR-0111 erratum of 2026-09-26).
//
// 🔴 Measured first on the served quiz (2026-09-26): one press of Space answered TWO questions. The engine carried `action2`
// to the game's `onCommand`, and on the key's release the browser clicked the focused `<button>` too. The quiz patched it
// locally (`aeea9423`); the defect was the engine's, and any game with a focusable button got the same double action.
//
// 📌 REAL KEYS ONLY (`userEvent`): a dispatched `KeyboardEvent` is untrusted and triggers no default action, so it could
// never show a button's native activation.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { keyed } from './fixtures/declared-words.js';

let motor;
const comandos = [];
/** Every keydown as the window saw it LAST: registered after the root's own listeners, in the bubble phase. */
const vistas = [];
const cliques = [];

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
const presses = (action) => comandos.filter((c) => c.action === action && c.pressed);

beforeAll(async () => {
  const { createGame } = await import('../app/js/boot/create-game.js');
  const raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1">'
    + '<button id="opcao" type="button">Option</button>'
    + '</div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  botao().addEventListener('click', () => cliques.push('opcao'));
  motor = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window },
    downloadHeavy: false, ...keyed({ preset: { up: { label: 'Up' }, down: { label: 'Down' }, action2: { label: 'Answer' } } }),
    setPhase: () => {},
    onCommand: (c) => comandos.push(c),
  });
  // In the capture, after the root's own capture listeners (same node, registration order: `stopPropagation` does not skip
  // this one); and again in the bubble, when the key gets there, for the root's bubbling listeners.
  window.addEventListener('keydown', (e) => vistas.push({ code: e.code, cancelada: e.defaultPrevented }), true);
  window.addEventListener('keydown', (e) => { const v = vistas.at(-1); if (v?.code === e.code) v.cancelada = e.defaultPrevented; });
});

beforeEach(() => { comandos.length = 0; cliques.length = 0; vistas.length = 0; });

describe('a key the engine delivered to the game', () => {
  it('🔴 [Right] one press of Space on a focused button is ONE action: the game hears it, the button is not clicked', async () => {
    expect(motor.keyboard.actionOf('Space', 0), 'Space is not `action2` in this scheme: the case would measure nothing').toBe('action2');
    botao().focus();
    expect(document.activeElement, 'the button has no focus: its native activation is not being measured').toBe(botao());
    await userEvent.keyboard('[Space]');
    expect(presses('action2'), 'the game did not hear Space as `action2`').toHaveLength(1);
    expect(cliques, 'one press of Space was two actions: the game heard it AND the browser clicked the focused button')
      .toEqual([]);
  });

  it('🔴 [Right] with nothing focused, the delivered key is cancelled too — Space does not also scroll the page', async () => {
    document.activeElement?.blur?.();
    await userEvent.keyboard('[Space]');
    expect(presses('action2')).toHaveLength(1);
    expect(cancelada('Space'), 'the game heard Space and the page scrolled as well').toBe(true);
  });
});

/* ----- what keeps its default ----- */
const cancelada = (code) => vistas.findLast((v) => v.code === code)?.cancelada;

describe('a key typed into an editable field keeps its default — typing is never taken', () => {
  const campo = (html) => {
    const el = document.createElement('div');
    el.innerHTML = html;
    document.getElementById('game-region').appendChild(el);
    return el.firstElementChild;
  };

  for (const [nome, html, lido] of [
    ['input', '<input type="text">', (el) => el.value],
    ['textarea', '<textarea></textarea>', (el) => el.value],
    ['contenteditable', '<div contenteditable="true"></div>', (el) => el.textContent],
    ['a child of contenteditable', '<div contenteditable="true"><span>x</span></div>', (el) => el.textContent],
  ]) {
    it(`🔴 [Boundary] ${nome}: Space types a space`, async () => {
      const el = campo(html);
      try {
        const alvo = el.firstElementChild ?? el;
        el.focus();
        if (alvo !== el) getSelection().collapse(alvo.firstChild, 1);
        await userEvent.keyboard('a[Space]b');
        expect(cancelada('Space'), `the engine cancelled Space in ${nome}`).toBe(false);
        expect(lido(el), `Space typed nothing into ${nome}`).toMatch(/a b/);
      } finally { el.parentElement.remove(); }
    });
  }

  it('🔴 [Boundary] select: Space keeps its default (it opens the list)', async () => {
    const el = campo('<select><option>one</option><option>two</option></select>');
    try {
      el.focus();
      await userEvent.keyboard('[Space]');
      expect(cancelada('Space'), 'the engine cancelled Space on a select').toBe(false);
    } finally { el.parentElement.remove(); }
  });
});

describe('a key the engine did not deliver keeps its default', () => {
  it('🔴 [Boundary] Tab is mapped to no position: it is not cancelled, and it still moves the focus', async () => {
    botao().focus();
    await userEvent.keyboard('[Tab]');
    expect(cancelada('Tab'), 'Tab was cancelled').toBe(false);
    expect(document.activeElement, 'Tab was swallowed: the keyboard cannot leave the button').not.toBe(botao());
    expect(comandos, 'Tab reached the game').toEqual([]);
  });

  it('🔴 [Boundary] a letter mapped to nothing is not cancelled', async () => {
    expect(motor.keyboard.actionOf('KeyZ', 0), 'KeyZ has a position: the case would measure nothing').toBeNull();
    botao().focus();
    await userEvent.keyboard('[KeyZ]');
    expect(cancelada('KeyZ')).toBe(false);
  });

  it('🔴 [Boundary] with a menu open, a key the controller refuses and no menu takes keeps its default', async () => {
    const code = motor.keyboard.kbFor(0).action1?.[0];
    expect(code, 'no key for action1: the case would measure nothing').toBeTruthy();
    motor.pause.show(0);
    try {
      await userEvent.keyboard(`[${code}]`);
      expect(comandos, 'a menu is open and the game heard the key').toEqual([]);
      expect(cancelada(code), 'the engine cancelled a key it refused to deliver').toBe(false);
    } finally { motor.pause.hide(0); }
  });
});

describe("the engine's own menus and controls keep their behaviour", () => {
  it('🔴 [Right] Space on an icon of the accessibility bar still presses it: ☰ opens the menus', async () => {
    // 📌 In play the bar in `#title-icons` stays in the tab order (measured in the quiz: ten `.pi-btn` after the options), and
    // `Enter` is `start`. Cancelling Space there would leave a keyboard or screen-reader user no key to press the icon with.
    const icone = document.querySelector('#title-icons .pi-btn[data-pi="menu"]');
    expect(icone, 'no ☰ on the accessibility bar in #title-icons: the case would measure nothing').not.toBeNull();
    const cartao = document.getElementById('vp-pause-0');
    expect(cartao.hidden, 'the card was already open: the case would measure nothing').toBe(true);
    try {
      icone.focus();
      await userEvent.keyboard('[Space]');
      expect(cancelada('Space'), 'the engine cancelled Space on its own bar: the icon has no key left').toBe(false);
      expect(cartao.hidden, 'Space on ☰ did not open the menus').toBe(false);
    } finally { motor.pause.hide(0); }
  });

  it('🔴 [Right] in the pause card the arrow still moves the selection — the menu consumes its key, the game hears nothing', async () => {
    motor.pause.show(0);
    try {
      const card = document.getElementById('vp-pause-0');
      const antes = card.querySelector('.pm-sel')?.dataset.act;
      expect(antes, 'no item selected in the card: the case would measure nothing').toBeTruthy();
      await userEvent.keyboard('[ArrowDown]');
      const escolhido = card.querySelector('.pm-sel')?.dataset.act;
      expect(escolhido, 'the arrow did not move the card').not.toBe(antes);
      expect(cancelada('ArrowDown'), 'the menu stopped consuming its own key').toBe(true);
      expect(comandos, 'a menu is open and the game heard the arrow').toEqual([]);
    } finally { motor.pause.hide(0); }
  });
});

describe('Escape and the pause are unchanged', () => {
  const pausado = () => document.querySelector('#game-region .pausa-rapida');

  it('🔴 [Right] Enter (start) in play opens the quick pause, and does not click the focused button', async () => {
    botao().focus();
    await userEvent.keyboard('[Enter]');
    try {
      expect(pausado()?.hidden, 'Enter did not open the quick pause').toBe(false);
      expect(cliques, 'Enter paused AND clicked the focused button').toEqual([]);
    } finally {
      // On the bar `Enter` confirms the icon under the cursor; the keyboard's way out is Escape (`ui/menu-nav`).
      await userEvent.keyboard('[Escape]');
    }
    expect(pausado().hidden, 'Escape did not leave the quick pause').toBe(true);
    expect(document.getElementById('vp-pause-0').hidden, 'leaving the quick pause opened the card').toBe(true);
  });

  it('🔴 [Boundary] Escape is mapped to no position: in play it reaches no game and is not cancelled', async () => {
    expect(document.getElementById('vp-pause-0').hidden, 'the card is open: this would measure the menu, not play').toBe(true);
    botao().focus();
    await userEvent.keyboard('[Escape]');
    expect(comandos).toEqual([]);
    expect(cancelada('Escape'), 'Escape in play was cancelled').toBe(false);
  });

  it('🔴 [Right] Escape still closes the pause card', async () => {
    motor.pause.show(0);
    await userEvent.keyboard('[Escape]');
    expect(document.getElementById('vp-pause-0').hidden, 'Escape no longer closes the card').toBe(true);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// `mutate.mjs` (scratchpad), each alone, CRLF normalised, exactly one occurrence required, restored from a copy and verified
// by hash, 2026-09-26. Run with this file, `key-default.node` and `quiz-answers-by-real-key`:
//   E1 the conductor never cancels                          🔴 the two Space cases here, and the quiz's Space and welcome
//   E2 the conductor ignores whether the key was delivered  🔴 the refused key with a menu open
//   E3 the conductor cancels every key it sees              🔴 the five fields, Tab, the letter, the refused key, ☰, Escape
//   K1 key-default forgets the delivery                     🔴 the refused key (and the node case)
//   K2 key-default forgets editable fields                  🔴 the five fields
//   K3 key-default forgets contenteditable                  🔴 both contenteditable cases
//   K4 key-default forgets select                           🔴 the select case
//   K5 key-default forgets the engine's own controls        🔴 ☰ on the bar
//   K6 a target with no `closest` keeps its default         🔴 the node case only: a browser key always has an element target
//   P1 `start` no longer opens the quick pause (existing)   🔴 the Enter case
//   P2 Escape at the card root no longer resumes (existing) 🔴 the Escape-closes-the-card case
