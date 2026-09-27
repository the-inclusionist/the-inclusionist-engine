// SPDX-License-Identifier: AGPL-3.0-or-later
// THE LATCH FOLLOWS THE CHILD'S HANDS, ON EVERY TRANSPORT (ADR-0109 rule 3, ADR-0113) — through the real root.
//
// «Pressing a key brings the keyboard back; the same for the gamepad.» The device in use is the one the child last pressed, and
// the latch read is THAT device's: its stored choice, else its default — the game's `holdsKeys()` on eyes, face, gestures and
// speech (ADR-0249), the factory's on the keyboard, the pad and touch. The root hears every press at one door, the virtual
// controller's `pressedBy`, and resolves the latch there (`boot/create-game`).
//
// Every transport is driven the way the child drives it: the KEYBOARD by a key the browser presses (`userEvent`, trusted and
// unsigned — the event `sourceOfEvent` reads as `teclado`), TOUCH by a finger's pointer events on the on-screen pad, the PAD by
// a fake standard pad behind `navigator.getGamepads` that the root polls on its own frames, and the VOICE with the recogniser
// replaced as `a-quiz-word-presses-once.browser.test.js` does. The game is a double whose `holdsKeys()` reads a stage.
// ⚠️ ONE ROOT for the file: `createGame` hangs listeners on the window, so a second root would answer the same presses.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { keyed } from './fixtures/declared-words.js';

/** The recogniser's two callbacks, handed over by the fake microphone. `vi.mock` is hoisted, so it reads this. */
const heard = { onPartial: null, onFinal: null };
vi.mock('../app/js/platform/vosk-runtime.js', async (original) => ({
  ...(await original()),
  loadVoskRuntime: async () => ({ ok: true, model: { KaldiRecognizer: function () { /* never built: the listener is a double */ } } }),
}));
vi.mock('../app/js/platform/voice-listener.js', async (original) => ({
  ...(await original()),
  startVoiceListening: async (d) => {
    heard.onPartial = d.onPartial;
    heard.onFinal = d.onFinal;
    return { setGrammar: () => {}, stop: async () => {} };
  },
}));

/** What the game's `holdsKeys()` answers now: `platform` holds, `quiz` does not. */
let stage = 'platform';
const declaration = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => stage === 'platform', tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const PRESET = { down: { label: 'Baixo' }, right: { label: 'Direita' }, action2: { label: 'Confirmar' } };
const TRANSPORTS = ['teclado', 'gamepad', 'toque', 'olhos', 'rosto', 'gestos', 'fala'];
/** The walking latch's stored keys: one per transport, and the legacy one without a transport. */
const stored = (transport) => `incl_togglemove_p0_${transport}`;
const KEYS = [...TRANSPORTS.map(stored), 'incl_togglemove_p0', 'incl_switch_scan'];

/** A standard pad behind `navigator.getGamepads`, seated as player 0's. */
const pad = { id: 'Test pad (STANDARD GAMEPAD)', index: 0, mapping: 'standard', connected: true, timestamp: 0,
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
let getGamepadsOriginal;

async function until(cond) { for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => { setTimeout(r, 10); }); }
const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
/** What the GAME heard, as `action:pressed:source`. */
const heardByGame = [];
const seats = [{ ctrl: 0, pad: 0, toggleMove: false, walkDir: 0, viz: 'normal' }];
/** Waits until every press the game heard was also released. */
const released = () => until(() => heardByGame.filter((c) => c.pressed).length === heardByGame.filter((c) => !c.pressed).length);

/** The VOICE: the recogniser heard `text`, and the utterance ended. A spoken command is a tap. */
const say = async (text) => { heard.onPartial(text); heard.onFinal(text); await released(); };
/** The KEYBOARD: a key the browser presses and lets go — trusted, with no stamp on it. */
const key = async (code) => { await userEvent.keyboard(`[${code}]`); await released(); };
/** The PAD: button `i` down for two frames, then up for two — the root polls it on its own frames. */
const padButton = async (i) => {
  pad.buttons[i].pressed = true; pad.buttons[i].value = 1;
  await frame(); await frame();
  pad.buttons[i].pressed = false; pad.buttons[i].value = 0;
  await frame(); await frame();
  await released();
};
/** TOUCH: a finger on the on-screen pad's face button — the pointer events a touch screen sends. */
const touch = async () => {
  const tc = document.getElementById('touch-controls');
  tc.hidden = false;
  const face = tc.querySelector('.touch-pad .touch-btn');
  const at = { bubbles: true, cancelable: true, composed: true, pointerType: 'touch', pointerId: 7, isPrimary: true };
  face.dispatchEvent(new PointerEvent('pointerdown', at));
  face.dispatchEvent(new PointerEvent('pointerup', at));
  await released();
};
/** The device the root says seat 0 is using. */
const inUse = () => motor.input.inputOf(0).inUse;
/** The latch the cartridge's physics reads. */
const latch = () => seats[0].toggleMove;
/** The ☝️ on the bar: one click moves the input mode one step, and a latch it changes is written under the device in use. */
const tapTheFinger = () => {
  const icon = document.querySelector('#title-icons [data-pi="altmove"]');
  expect(icon, 'the root mounted no ☝️').not.toBeNull();
  icon.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};

let motor;
let state;
const kept = {};
beforeAll(async () => {
  for (const k of KEYS) { kept[k] = localStorage.getItem(k); localStorage.removeItem(k); }
  getGamepadsOriginal = Object.getOwnPropertyDescriptor(Navigator.prototype, 'getGamepads');
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1" style="position:relative;width:640px;height:360px"><div id="title-icons"></div></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaration(), host: { doc: document, win: window }, downloadHeavy: false,
    players: seats, onScreenPad: true, ...keyed({ preset: PRESET }), onCommand: (c) => heardByGame.push(c),
  });
  state = motor.settings;
  state.setVoiceControlValue(true);
  await until(() => heard.onPartial);
});
afterAll(() => {
  state?.setSwitchScanValue(false);
  state?.setVoiceControlValue(false);
  motor?.dispose();
  motor = null;
  delete navigator.getGamepads;
  if (getGamepadsOriginal) Object.defineProperty(Navigator.prototype, 'getGamepads', getGamepadsOriginal);
  for (const k of KEYS) { if (kept[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, kept[k]); }
});
beforeEach(async () => {
  await released();
  heardByGame.length = 0;
  stage = 'platform';
  for (const k of KEYS) localStorage.removeItem(k);
  state.setSwitchScanValue(false);
  seats[0].toggleMove = false;
  seats[0].walkDir = 0;
});

describe('voice, then the keyboard — the keyboard comes back (ADR-0109 rule 3)', () => {
  it('🔴 [Right] a real key after «direita» makes the keyboard the device in use, and the latch read is the keyboard\'s: off', async () => {
    await say('direita');
    expect(inUse(), 'the voice did not become the device in use: the case would measure nothing').toBe('fala');
    expect(latch(), 'the platform stage did not latch the voice: the case would measure nothing').toBe(true);
    seats[0].walkDir = 1; // walking by the voice's latch
    await key('ArrowRight');
    expect(heardByGame.some((c) => c.action === 'right' && c.pressed && c.source === 'teclado'), 'the key did not reach the game').toBe(true);
    expect(inUse(), 'a key press left the voice as the device in use').toBe('teclado');
    expect(latch(), 'the voice\'s latch carried into keyboard play').toBe(false);
    expect(seats[0].walkDir, 'the latch fell and the character went on walking by itself').toBe(0);
  }, 10_000);

  it('🔴 [Right] the keyboard\'s STORED choice is what is read when it comes back — not the voice\'s, not the game\'s', async () => {
    stage = 'quiz'; // the game's answer is off: only the keyboard's own «on» can turn the latch on
    localStorage.setItem(stored('teclado'), '1');
    await say('abaixo');
    expect(latch(), 'the quiz stage latched the voice: the case would measure nothing').toBe(false);
    await key('ArrowRight');
    expect(inUse()).toBe('teclado');
    expect(latch(), 'the «on» she stored for the keyboard was not read when she came back to it').toBe(true);
  }, 10_000);

  it('🔴 [Right] the ☝️ then writes the choice under the KEYBOARD, not under the voice she left', async () => {
    await say('direita');
    expect(latch()).toBe(true);
    await key('ArrowRight');
    tapTheFinger(); // «padrão» → «não precisa segurar», on the keyboard
    expect(localStorage.getItem(stored('teclado')), 'the ☝️ did not store the choice under the keyboard').toBe('1');
    expect(localStorage.getItem(stored('fala')), 'the ☝️ wrote the keyboard\'s choice under the voice').toBeNull();
    expect(latch()).toBe(true);
  }, 10_000);
});

describe('every transport switches the device in use, and the latch with it', () => {
  it('🔴 [Right] touch, then the keyboard: the finger\'s stored «on» is read on the pad, and the key brings back the keyboard\'s «off»', async () => {
    localStorage.setItem(stored('toque'), '1');
    await touch();
    expect(heardByGame.some((c) => c.pressed && c.source === 'toque'), 'the finger did not reach the game').toBe(true);
    expect(inUse(), 'a touch did not make touch the device in use').toBe('toque');
    expect(latch(), 'the «on» she stored for touch was not read').toBe(true);
    await key('ArrowRight');
    expect(inUse(), 'a key after the touch left touch as the device in use').toBe('teclado');
    expect(latch(), 'touch\'s latch carried into keyboard play').toBe(false);
  }, 10_000);

  it('🔴 [Right] the pad, then the voice: the pad reads its own choice — the quiz stage does not reach it — and the voice the game\'s', async () => {
    stage = 'quiz';
    localStorage.setItem(stored('gamepad'), '1');
    await padButton(0); // A — «Confirmar»
    expect(heardByGame.some((c) => c.pressed && c.source === 'gamepad'), 'the pad did not reach the game').toBe(true);
    expect(inUse(), 'a pad press did not make the pad the device in use').toBe('gamepad');
    expect(latch(), 'the «on» she stored for the pad was not read, or the quiz stage reached the pad').toBe(true);
    seats[0].walkDir = 1;
    await say('abaixo');
    expect(inUse(), 'a word after the pad left the pad as the device in use').toBe('fala');
    expect(latch(), 'the pad\'s latch carried into the quiz\'s spoken words').toBe(false);
    expect(seats[0].walkDir).toBe(0);
  }, 10_000);

  it('📌 [Boundary] the pad does not take the game\'s default: in a platform stage, with nothing stored, its latch is the factory\'s', async () => {
    await say('direita');
    expect(latch()).toBe(true);
    await padButton(0);
    expect(inUse()).toBe('gamepad');
    expect(latch(), 'the platform stage\'s `holdsKeys()` reached the pad, which keeps the factory default (ADR-0249)').toBe(false);
  }, 10_000);
});

describe('a transport the child has not touched does not change the latch', () => {
  it('🔴 [Right] with «on» stored for the voice, the pad and touch, keyboard presses read the keyboard only — and store nothing', async () => {
    await key('ArrowRight');
    expect(inUse()).toBe('teclado');
    for (const t of ['fala', 'gamepad', 'toque', 'olhos']) localStorage.setItem(stored(t), '1');
    await key('ArrowRight');
    await key('ArrowRight');
    expect(inUse(), 'a transport nobody pressed became the device in use').toBe('teclado');
    expect(latch(), 'the latch of a device she did not touch was read').toBe(false);
    expect(localStorage.getItem(stored('teclado')), 'resolving the latch stored a choice nobody made').toBeNull();
  }, 10_000);
});

// ============================== MUTATIONS CHECKED ==============================
// (2026-09-27) — a script requiring one occurrence per anchor, each file restored from a copy on disk and checked by SHA-256;
// counted over this file's 7 cases and `a-quiz-word-presses-once`'s 6. Before the fix, all 7 of this file were red.
//   M1 the root resolving only the four one-command transports again (the old wiring)   🔴 7 here + the quiz file's pad case
//   M2 the root recording the edge without resolving the latch                          🔴 6 here + 5 in the quiz file
//   M3 the root's `pressedBy` wired to nothing                                           🔴 7 here + 5 in the quiz file
//   M4 `input/latch-edge` resolving BEFORE recording the edge (the device she left)     🔴 6 here + the quiz file's pad case
//   M5 `input/latch-edge` reading a transport nobody pressed (touch's, fixed)            🔴 7 here + 5 in the quiz file
//   M6 `input/transport-in-use.afterEdge` never moving the device in use                🔴 6 here + 5 in the quiz file
//   M7 `latchDefaultFromGame` true on every transport (the game's default on the keys)   🔴 5 here + the quiz file's pad case
//   M8 the controller not telling a `teclado` press                                      🔴 5 here — the keyboard's cases
