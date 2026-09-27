// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GAME SAYS WHETHER A ONE-COMMAND TRANSPORT LATCHES, AND THE CHILD MAY CHANGE IT (ADR-0249) — through the real root.
//
// On eyes, face, gestures and speech a command is one tap. Whether the tap keeps going is the game's `holdsKeys()`: in a platform
// game «direita» keeps the character walking (the latch the cartridge's physics reads, `p.toggleMove`), in a quiz «abaixo» presses
// once and the next «abaixo» presses again. The child's stored choice for that device wins over either default, and the bar's ☝️
// offers it there as on the keyboard. The root resolves it when the transport presses (`boot/create-game`, `pressedBy`).
//
// The root is the one the child uses, with the recogniser replaced as `a-name-said-activates-its-item.browser.test.js` does: no
// model is downloaded, the runtime answers «loaded», and the microphone is a double that hands this file the recogniser's
// callbacks. The GAME is a double whose `holdsKeys()` reads a stage this file changes — the quiz stage answers `false`, as
// `consumer-quiz` declares, and the platform stage `true`.
// ⚠️ ONE ROOT for the file: `createGame` hangs listeners on the window, so a second root would answer the same presses.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
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

/** Which stage the game is in — what its `holdsKeys()` answers, read by the root when a word arrives (ADR-0084). */
let stage = 'quiz';
const declaration = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => stage === 'platform', tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const PRESET = { down: { label: 'Baixo' }, right: { label: 'Direita' }, action2: { label: 'Confirmar' } };
const KEYS = ['incl_togglemove_p0_fala', 'incl_togglemove_p0_gamepad', 'incl_togglemove_p0', 'incl_switch_scan'];

async function until(cond) { for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => { setTimeout(r, 10); }); }
/** The recogniser heard `text` as a partial, and the utterance ended — the calls the microphone makes. */
const say = (text) => { heard.onPartial(text); heard.onFinal(text); };
/** What the GAME heard, as `action:pressed`. */
const heardByGame = [];
const seats = [{ toggleMove: false, walkDir: 0, viz: 'normal' }];
/** Waits until every press the game heard was also released — a spoken command is a tap. */
const released = () => until(() => heardByGame.filter((c) => c.pressed).length === heardByGame.filter((c) => !c.pressed).length);

let motor;
let state;
const kept = {};
beforeAll(async () => {
  for (const k of KEYS) { kept[k] = localStorage.getItem(k); localStorage.removeItem(k); }
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaration(), host: { doc: document, win: window }, downloadHeavy: false,
    players: seats, ...keyed({ preset: PRESET }), onCommand: (c) => heardByGame.push(c),
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
  for (const k of KEYS) { if (kept[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, kept[k]); }
});
beforeEach(async () => {
  await released();
  heardByGame.length = 0;
  stage = 'quiz';
  for (const k of KEYS) localStorage.removeItem(k);
  state.setSwitchScanValue(false);
  seats[0].toggleMove = false;
  seats[0].walkDir = 0;
});

describe('a spoken command in a game that holds NOTHING — the quiz (ADR-0249)', () => {
  it('🔴 [Right] «abaixo» presses ONCE — one press, one release — and two «abaixo» press twice, with no latch', async () => {
    say('abaixo');
    await released();
    say('abaixo');
    await released();
    const downs = heardByGame.filter((c) => c.action === 'down');
    expect(downs.map((c) => `${c.pressed ? 'press' : 'release'}:${c.source}`), 'a spoken word was not one tap')
      .toEqual(['press:fala', 'release:fala', 'press:fala', 'release:fala']);
    expect(seats[0].toggleMove, 'the quiz stage latched a spoken word: the next «abaixo» would only let go').toBe(false);
    expect(localStorage.getItem('incl_togglemove_p0_fala'), 'resolving the latch stored a choice nobody made').toBeNull();
  }, 10_000);
});

describe('a spoken command in a game that HOLDS keys — the platform game (ADR-0249)', () => {
  it('🔴 [Right] «direita» latches: the seat the physics reads keeps walking', async () => {
    stage = 'platform';
    say('direita');
    await released();
    expect(seats[0].toggleMove, 'a platform game\'s «direita» stopped after one step').toBe(true);
    expect(heardByGame.filter((c) => c.action === 'right' && c.pressed), 'the word did not reach the game').toHaveLength(1);
  }, 10_000);

  it('🎯 [Sequence] the game changes stage and the NEXT word follows the new stage — `holdsKeys()` is read when it matters', async () => {
    stage = 'platform';
    say('direita');
    await released();
    expect(seats[0].toggleMove).toBe(true);
    seats[0].walkDir = 1; // walking by latch
    stage = 'quiz';
    say('abaixo');
    await released();
    expect(seats[0].toggleMove, 'the quiz stage kept the platform stage\'s latch').toBe(false);
    expect(seats[0].walkDir, 'the latch fell and the character went on walking by itself').toBe(0);
  }, 10_000);
});

describe('the child\'s stored choice for her voice wins over the game (ADR-0249)', () => {
  it('🔴 [Right] stored OFF beats a platform game; stored ON beats a quiz', async () => {
    stage = 'platform';
    localStorage.setItem('incl_togglemove_p0_fala', '0');
    say('direita');
    await released();
    expect(seats[0].toggleMove, 'the game overrode the «off» she stored for her voice').toBe(false);

    stage = 'quiz';
    localStorage.setItem('incl_togglemove_p0_fala', '1');
    say('abaixo');
    await released();
    expect(seats[0].toggleMove, 'the game overrode the «on» she stored for her voice').toBe(true);
  }, 10_000);

  it('🔴 [Right] and the bar\'s ☝️ OFFERS it with the voice in use: it reaches «padrão», and that choice is the voice\'s', async () => {
    stage = 'platform';
    say('direita'); // the voice is now the device in use, and the platform stage latched it
    await released();
    expect(seats[0].toggleMove).toBe(true);
    const icon = document.querySelector('#title-icons [data-pi="altmove"]');
    expect(icon, 'the root mounted no ☝️').not.toBeNull();
    icon.dispatchEvent(new MouseEvent('click', { bubbles: true })); // «não precisa segurar» → «um botão só»
    expect(state.switchScan).toBe(true);
    icon.dispatchEvent(new MouseEvent('click', { bubbles: true })); // → «padrão», which the superseded rule skipped on the voice
    expect(state.switchScan).toBe(false);
    expect(seats[0].toggleMove, 'the ☝️ skipped «padrão» with the voice in use').toBe(false);
    expect(localStorage.getItem('incl_togglemove_p0_fala'), 'the choice was not stored under the voice').toBe('0');

    say('direita');
    await released();
    expect(seats[0].toggleMove, 'the next word ignored what she chose and latched again').toBe(false);
  }, 10_000);
});

describe('the keyboard, the pad and touch keep the factory default (ADR-0249)', () => {
  it('📌 [Boundary] a press from the PAD resolves the PAD\'s latch — the game\'s `holdsKeys()` does not reach it, either way', () => {
    stage = 'platform'; // the game holds: a one-command transport would latch here
    motor.controller.press('right', 'gamepad', 0);
    motor.controller.release('right', 'gamepad', 0);
    expect(seats[0].toggleMove, 'a pad press was resolved as a one-command transport').toBe(false);

    stage = 'quiz';
    localStorage.setItem('incl_togglemove_p0_gamepad', '1'); // set by the bar for the pad; the quiz stage's `false` must not reach it
    motor.controller.press('right', 'gamepad', 0);
    motor.controller.release('right', 'gamepad', 0);
    expect(seats[0].toggleMove, 'the choice she stored for the pad was not read on the pad').toBe(true);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (2026-09-27) — `scratchpad/latch-by-game/mutate.mjs`: one occurrence required per anchor, each file restored from a copy on
// disk and checked by SHA-256. All red, counted in this file:
//   R1 `latchOf` on the four always on again (the superseded rule)       🔴 4 — «abaixo» once, the stage, the stored choice, the ☝️
//   R2 the game's answer read before the stored choice                    🔴 2 — the stored choice, the ☝️
//   R3 `latchOf` ignoring the game's answer                               🔴 3 — «direita», the stage, the ☝️
//   R4 the root's `pressedBy` wired to nothing                            🔴 4 — «direita», the stage, the stored choice, the ☝️
//   R5 the root answering `holdsKeys` true for every game                 🔴 2 — «abaixo» once, the stage
//   R6 the root resolving every transport (pad and touch too)             🔴 «a press from the PAD» — the case asserted then that a
//      pad press left the latch alone; since the root resolves every transport (ADR-0109 rule 3, erratum of 2026-09-27) it
//      asserts the pad's own latch, and its mutations are in `every-transport-feeds-the-device-in-use.browser.test.js`
//   R7 the controller never telling who pressed                           🔴 4 (and 2 in `virtual-controller.node`)
//   R8 `writeLatch` refusing the four again                               🔴 the ☝️
//   R9 the ☝️ refusing the write on the four again                        🔴 the ☝️ (and 2 in `pause-icons.node`)
//   R10 a spoken word never released (the pulse removed)                  🔴 «abaixo» once
