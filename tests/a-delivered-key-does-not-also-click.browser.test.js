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

describe('a key typed into an editable field keeps its default and is not played — typing is the field\'s', () => {
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
    it(`🔴 [Boundary] ${nome}: Space types a space, and the game hears none of what was typed`, async () => {
      // 📏 `a` is `left` and Space is `action2` in this scheme: both are positions the conductor would deliver in play.
      expect(motor.keyboard.actionOf('KeyA', 0), 'KeyA has no position: the case would measure less than it says').toBe('left');
      const el = campo(html);
      try {
        const alvo = el.firstElementChild ?? el;
        el.focus();
        if (alvo !== el) getSelection().collapse(alvo.firstChild, 1);
        await userEvent.keyboard('a[Space]b');
        expect(cancelada('Space'), `the engine cancelled Space in ${nome}`).toBe(false);
        expect(lido(el), `Space typed nothing into ${nome}`).toMatch(/a b/);
        expect(comandos, `typing into ${nome} was also played`).toEqual([]);
      } finally { el.parentElement.remove(); }
    });
  }

  it('🔴 [Boundary] select: Space keeps its default (it opens the list), and the game does not hear it', async () => {
    const el = campo('<select><option>one</option><option>two</option></select>');
    try {
      el.focus();
      await userEvent.keyboard('[Space]');
      expect(cancelada('Space'), 'the engine cancelled Space on a select').toBe(false);
      expect(comandos, 'Space on a select was also played').toEqual([]);
    } finally { el.parentElement.remove(); }
  });

  it('🔴 [Right] a key pressed in play after the field lost the focus is played again', async () => {
    const el = campo('<input type="text">');
    try {
      el.focus();
      await userEvent.keyboard('[Space]');
      el.blur();
      await userEvent.keyboard('[Space]');
      expect(presses('action2'), 'leaving the field did not give the key back to the game').toHaveLength(1);
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
  const menuIcon = () => document.querySelector('#title-icons .pi-btn[data-pi="menu"]');

  it('🔴 [Right] Space on an icon of the accessibility bar presses it — ☰ opens the menus — and the game does not hear it', async () => {
    // 📌 In play the bar in `#title-icons` stays in the tab order (measured in the quiz: ten `.pi-btn` after the options), and
    // `Enter` is `start`. Cancelling Space there would leave a keyboard or screen-reader user no key to press the icon with.
    // 📏 And delivering it too was one press doing two things: on the served quiz, Space on ☰ opened the menus AND answered.
    const icone = menuIcon();
    expect(icone, 'no ☰ on the accessibility bar in #title-icons: the case would measure nothing').not.toBeNull();
    const cartao = document.getElementById('vp-pause-0');
    expect(cartao.hidden, 'the card was already open: the case would measure nothing').toBe(true);
    try {
      icone.focus();
      await userEvent.keyboard('[Space]');
      expect(cancelada('Space'), 'the engine cancelled Space on its own bar: the icon has no key left').toBe(false);
      expect(cartao.hidden, 'Space on ☰ did not open the menus').toBe(false);
      expect(comandos, 'Space pressed ☰ AND reached the game: one press, two actions').toEqual([]);
    } finally { motor.pause.hide(0); }
  });

  it("🔴 [Boundary] any other key with the focus left on ☰ is still the game's — an arrow is delivered, and spent", async () => {
    // 📌 A focused button does nothing native with an arrow: held back, the child's move after a Tab onto the bar would be lost.
    menuIcon().focus();
    await userEvent.keyboard('[ArrowDown]');
    expect(presses('down'), 'an arrow with the focus on ☰ no longer reaches the game').toHaveLength(1);
    expect(cancelada('ArrowDown'), 'the game heard the arrow and the page could scroll with it as well').toBe(true);
    expect(document.getElementById('vp-pause-0').hidden, 'the arrow pressed ☰').toBe(true);
  });

  it('🔴 [Right] Enter on ☰ is not played either: the game hears no `start`', async () => {
    // What Enter DOES there is the quick pause (`start`), as with the focus anywhere in play — the case pins only that the game
    // does not ALSO hear it. See the report: whether Enter on ☰ should press ☰ instead is an open question.
    menuIcon().focus();
    try {
      await userEvent.keyboard('[Enter]');
      expect(comandos, 'Enter on ☰ reached the game').toEqual([]);
    } finally {
      await userEvent.keyboard('[Escape]');
      motor.pause.hide(0);
    }
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

describe("a key the engine's menus consumed is not also played — even when it CLOSED the menu", () => {
  // 📏 On the served quiz, Space on «Voltar» (resume) closed the card and answered a question: `ui/menu-nav` consumes the key in
  // the window's capture and closes the card; the conductor, after it on the same node, then saw no menu open and delivered.
  const cartao = () => document.getElementById('vp-pause-0');
  const pausado = () => document.querySelector('#game-region .pausa-rapida');

  // ⚠️ THE FOCUS IS PUT IN THE GAME FIRST. Left on ☰ by an earlier case, Space and Enter there are ☰'s activation keys and are
  // held back for THAT reason — and the case would pass without measuring the menus at all (found by mutation: it did).
  for (const code of ['Space', 'Enter', 'KeyJ']) {
    it(`🔴 [Right] ${code} on «resume» resumes, and the game hears nothing`, async () => {
      expect(motor.keyboard.actionOf(code, 0), `${code} has no position: the case would measure nothing`).toBeTruthy();
      botao().focus();
      motor.pause.show(0);
      try {
        expect(cartao().querySelector('.pm-sel')?.dataset.act, 'the card does not open on «resume»: the case would measure another item')
          .toBe('resume');
        await userEvent.keyboard(`[${code}]`);
        expect(cartao().hidden, `${code} on «resume» did not close the card`).toBe(true);
        expect(comandos, `${code} resumed AND reached the game: one press, two actions`).toEqual([]);
      } finally { motor.pause.hide(0); }
    });
  }

  it('🔴 [Right] «no» (action3) at the card\'s root goes back to the game, and the game does not hear it', async () => {
    const code = motor.keyboard.kbFor(0).action3?.[0];
    expect(code, 'no key for action3: the case would measure nothing').toBeTruthy();
    botao().focus();
    motor.pause.show(0);
    try {
      await userEvent.keyboard(`[${code}]`);
      expect(cartao().hidden, '«no» at the root did not close the card').toBe(true);
      expect(comandos, '«no» closed the card AND reached the game').toEqual([]);
    } finally { motor.pause.hide(0); }
  });

  it('🔴 [Right] «no» (action3) on the quick pause\'s bar leaves it, and the game does not hear it', async () => {
    const code = motor.keyboard.kbFor(0).action3?.[0];
    botao().focus();
    await userEvent.keyboard('[Enter]');
    try {
      expect(pausado()?.hidden, 'Enter did not open the quick pause: the case would measure nothing').toBe(false);
      comandos.length = 0;
      await userEvent.keyboard(`[${code}]`);
      expect(pausado().hidden, '«no» did not leave the quick pause').toBe(true);
      expect(comandos, '«no» left the quick pause AND reached the game').toEqual([]);
    } finally {
      if (pausado() && !pausado().hidden) await userEvent.keyboard('[Escape]');
    }
  });

  it('🔴 [Boundary] after the menu closed, the NEXT press is the game\'s again', async () => {
    botao().focus();
    motor.pause.show(0);
    try {
      await userEvent.keyboard('[Space]');
      expect(cartao().hidden).toBe(true);
      await userEvent.keyboard('[Space]');
      expect(presses('action2'), 'the press after the menu closed did not reach the game').toHaveLength(1);
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

describe('the system positions are the engine\'s: the game never hears START or SELECT (ADR-0144 §4, ADR-0155 §4)', () => {
  // 📏 On the served quiz (2026-09-26), Enter in play opened the quick pause AND the quiz's `onCommand` heard `start` (press and
  // release); F opened the card AND it heard `select`. A cartridge may not declare either, so no game has a word for them.
  const pausado = () => document.querySelector('#game-region .pausa-rapida');
  const cartao = () => document.getElementById('vp-pause-0');

  for (const code of ['Enter', 'KeyH']) {
    it(`🔴 [Right] ${code} (start) in play opens the quick pause, and the game hears neither its press nor its release`, async () => {
      expect(motor.keyboard.actionOf(code, 0), `${code} is not \`start\`: the case would measure nothing`).toBe('start');
      botao().focus();
      await userEvent.keyboard(`[${code}]`);
      try {
        expect(pausado()?.hidden, `${code} did not open the quick pause`).toBe(false);
        expect(comandos, `${code} paused AND the game heard \`start\`: one press, two actions`).toEqual([]);
      } finally { await userEvent.keyboard('[Escape]'); }
      expect(pausado().hidden, 'Escape did not leave the quick pause').toBe(true);
      expect(comandos, 'leaving the quick pause reached the game').toEqual([]);
    });
  }

  it('🔴 [Right] F (select) in play opens the menus, and the game does not hear `select`', async () => {
    expect(motor.keyboard.actionOf('KeyF', 0), 'KeyF is not `select`: the case would measure nothing').toBe('select');
    botao().focus();
    await userEvent.keyboard('[KeyF]');
    try {
      expect(cartao().hidden, 'F did not open the card').toBe(false);
      expect(comandos, 'F opened the card AND the game heard `select`').toEqual([]);
    } finally { motor.pause.hide(0); }
  });

  it('🔴 [Boundary] the verb pressed right after the quick pause closed is the game\'s again', async () => {
    botao().focus();
    await userEvent.keyboard('[Enter]');
    await userEvent.keyboard('[Escape]');
    botao().focus();
    await userEvent.keyboard('[ArrowDown]');
    expect(presses('down'), 'play did not come back after START and Escape').toHaveLength(1);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// `mutate.mjs` (scratchpad), each alone, CRLF normalised, exactly one occurrence required, restored from a copy and verified
// by hash. Run with this file, `key-default.node`, `virtual-controller.node` and `quiz-answers-by-real-key`.
// First pass (2026-09-26, when a delivered key started losing its default): the conductor never cancelling, cancelling every
// key, or ignoring the delivery; key-default forgetting a field kind or the engine's controls; `start` and Escape — each red.
// Second pass (2026-09-26, a key that went to something else is not also played; the rule moved BEFORE the delivery):
//   K1 key-default forgets editable fields                      🔴 the five fields, the field-then-play case (and the node case)
//   K2 key-default forgets contenteditable                      🔴 both contenteditable cases
//   K3 key-default forgets select                               🔴 the select case
//   K4 key-default forgets the engine's own control             🔴 Space on ☰, Enter on ☰
//   K5 every key on the engine's control is held back           🔴 the arrow with the focus on ☰
//   K6 a target with no `closest` is held back                  🔴 the node case only: a browser key always has an element target
//   K7 Space is not an activation key                           🔴 Space on ☰
//   K8 Enter is not an activation key                           🔴 Enter on ☰
//   V1 the controller ignores `toPlay`                          🔴 the fields, ☰ (Space and Enter), and the node case
//   V2 the controller asks `toPlay` before the menu             🔴 the node case only (the sonar in a menu, `menuAnswers`)
//   E1 the conductor does not pass `toPlay`                     🔴 the fields, ☰ (Space and Enter)
//   E2 the conductor never cancels                              🔴 both Space cases, the arrow on ☰, and the quiz's three cases
//   E3 the conductor cancels every key it sees                  🔴 the fields, the refused key, Space on ☰
// Third pass (2026-09-26, a key the engine's menus consumed is not also played), with `menu-nav.browser`:
//   N1 `consume` does not mark the key                          🔴 the three resume keys, «no» on the card and on the bar, the
//                                                                  next press, and the three `consumed` cases in menu-nav
//   N2 Escape on the mapping panel consumed without the mark    🔴 menu-nav's bar-and-padwiz case only (Escape is mapped to no
//                                                                  position, so no key test here can see it)
//   N3 `consumed` always false                                  🔴 as N1
//   N4 `consumed` always true                                   🔴 every case where the game must hear the key, and the [Zero] case
//   C1 the conductor ignores the mark                           🔴 the three resume keys, «no» on the card and on the bar, the
//                                                                  next press
//   📌 C1 first SURVIVED for Space and Enter: an earlier case left the focus on ☰, where those two are held back as ☰'s own
//   activation keys. The resume cases now put the focus in the game first.
// Fourth pass (2026-09-26, the system positions are the engine's), `scratchpad/keys-start/mutate.mjs`, restored by SHA-256:
//   S1 the controller ignores the system positions              🔴 Enter, KeyH and F here, and the ten node cases
//   S2 only `start` in the rule                                  🔴 F here, and the five `select` node cases
//   S3 only `select` in the rule                                 🔴 Enter and KeyH here, and the five `start` node cases
//   S4 `action4` joins the rule / S5 the rule before the menu    🔴 node only (the verb beside them; START as the menu's key)
