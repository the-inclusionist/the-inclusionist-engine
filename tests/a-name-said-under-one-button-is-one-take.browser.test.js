// SPDX-License-Identifier: AGPL-3.0-or-later
// WITH ONE BUTTON ONLY ON, A MENU ITEM'S NAME SAID IS ONE PRESS OF THE SWITCH — NOT A CURSOR MOVE AND A TAKE (ADR-0218 §4,
// ADR-0194 §2, ADR-0111 errata: one input, one action).
//
// ADR-0194 §2 makes a heard name «a cursor and a confirm»: the menu navigation puts the cursor on the named item, then the confirm
// position is pressed on the virtual controller. ADR-0218 §4 makes every press a speech transport sends, while one button only is
// on, collapse into «take the one shown» — and the controller asks the scan first. 📏 Measured before the fix, on this root: the
// two stacked. With the chip on «cancelar», saying a pause item's name moved the cursor to it (a press on «cancelar» meant
// something); with the chip on «próximo», the cursor went to the named item AND one step on from there. One utterance, two actions.
//
// The root is the one the child uses, with the recogniser replaced as `a-name-said-activates-its-item.browser.test.js` does: no
// model is downloaded, the runtime answers «loaded», and the microphone is a double that hands this file the recogniser's callbacks.
// ⚠️ ONE ROOT for the file: `createGame` hangs listeners on the window, so a second root would answer the same presses.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { accessibleLabel } from '../app/js/core/accessible-label.js';
import { SWITCH_SCAN_DEFAULTS } from '../app/js/input/switch-scan.js';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import pt from '../app/js/i18n/pt.js';

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

const LIMIT = 20_000;
const STEP = SWITCH_SCAN_DEFAULTS.stepMs;

const declaration = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});

const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
async function until(cond) { for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => { setTimeout(r, 10); }); }
const chip = () => document.querySelector('#game-region .scan-now');
/** Waits until the chip OFFERS `text`, frame by frame, and fails naming the last word seen. */
const whenOffered = async (text) => {
  const end = performance.now() + STEP * 10;
  while (chip()?.textContent !== text) {
    if (performance.now() > end) throw new Error(`the chip never offered «${text}» (last: «${chip()?.textContent}»)`);
    await frame();
  }
};
/** The recogniser heard `text` as a partial, and the utterance ended — the calls the microphone makes. */
const say = (text) => { heard.onPartial(text); heard.onFinal(text); };
const visible = (el) => !!el && el.offsetParent !== null;
const items = () => [...document.querySelectorAll('#vp-pause-0 .pm-btn')].filter(visible);
const cursor = () => document.querySelector('#vp-pause-0 .pm-sel');
const at = () => items().indexOf(cursor());
const item = (act) => document.querySelector(`#vp-pause-0 .pm-btn[data-act="${act}"]`);
/** A visible, unlocked item of the card at least two stops away from `from` either way, so a step from either end is told apart. */
const farFrom = (from) => items().find((el, i) => Math.abs(i - from) >= 2 && el.getAttribute('aria-disabled') !== 'true');

let motor;
let state;
beforeAll(async () => {
  localStorage.removeItem('incl_switch_scan');
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaration(), host: { doc: document, win: window },
    downloadHeavy: false, players: [{ ctrl: 0 }] });
  state = motor.settings;
  state.setVoiceControlValue(true);
  await until(() => heard.onPartial);
});
afterAll(() => {
  state?.setSwitchScanValue(false);
  localStorage.removeItem('incl_switch_scan');
  state?.setVoiceControlValue(false);
  motor?.dispose();
  motor = null;
});
beforeEach(async () => {
  state.setSwitchScanValue(false);
  motor.pause.hide(0);
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  await frame();
});

/* ===================== ONE BUTTON ONLY OFF: ADR-0194 AS DECIDED — the name is a place, then a confirm ===================== */
describe('with one-button scanning OFF, a name said is a cursor and a confirm (ADR-0194 §2)', () => {
  it('🔴 [Right] saying a pause item\'s name, far from the cursor, activates THAT item', async () => {
    motor.pause.show(0);
    await frame();
    const options = item('options');
    expect(Math.abs(items().indexOf(options) - at()), 'the cursor is next to «options»: the case would measure nothing')
      .toBeGreaterThanOrEqual(2);
    expect(visible(item('audio')), 'the options list was already open — the case would measure nothing').toBe(false);
    say(accessibleLabel(options));
    expect(visible(item('audio')), 'the name was heard and its item was not activated').toBe(true);
  });
});

/* ===================== ONE BUTTON ONLY ON: the name is the switch, and the switch is ONE action ===================== */
describe('with one-button scanning ON, a name said is one press: it takes the step shown and moves no cursor of its own', () => {
  beforeEach(async () => {
    motor.pause.show(0);
    await frame();
    state.setSwitchScanValue(true);
    await frame();
  });

  it('🔴 [Zero] on «cancelar» a name said means NOTHING — the cursor stays where it was', async () => {
    await whenOffered(pt['scan.nothing']);
    const from = at();
    const named = farFrom(from);
    expect(named, 'the card has no item two stops from the cursor: the case would measure nothing').toBeTruthy();
    say(accessibleLabel(named));
    expect(at(), `the press on «cancelar» moved the cursor from stop ${from} to «${accessibleLabel(cursor())}»: `
      + 'the name was a second action').toBe(from);
    expect(visible(item('audio')), 'a press on «cancelar» activated something').toBe(false);
  }, LIMIT);

  it('🔴 [Right] on «próximo» a name said is ONE step from where the cursor was — not a jump to the name, then a step', async () => {
    await whenOffered(pt['scan.menu.next']);
    const from = at();
    const named = farFrom(from);
    expect(named, 'the card has no item two stops from the cursor: the case would measure nothing').toBeTruthy();
    const namedAt = items().indexOf(named);
    say(accessibleLabel(named));
    expect(at(), `the cursor went to stop ${at()}; the named item is stop ${namedAt} and one step from there is stop `
      + `${namedAt + 1}: one utterance, two actions`).toBe(from + 1);
  }, LIMIT);

  it('🔴 [Right] and a direction word is the same one press — «acima» on «próximo» steps next, not up', async () => {
    await whenOffered(pt['scan.menu.next']);
    const from = at();
    say('acima');
    expect(at(), 'a direction word under one button was itself, or two things').toBe(from + 1);
  }, LIMIT);

  it('🔴 [Right] on «confirmar» a name said confirms the item the CURSOR is on — the item named is not activated', async () => {
    // «options» is named because its activation shows: it opens the list that holds «audio»
    const options = item('options');
    expect(Math.abs(items().indexOf(options) - at()), 'the cursor is next to «options»: the case would measure nothing')
      .toBeGreaterThanOrEqual(2);
    expect(visible(item('audio')), 'the options list was already open — the case would measure nothing').toBe(false);
    await whenOffered(pt['scan.menu.confirm']);
    say(accessibleLabel(options));
    expect(visible(item('audio')), 'the named item was activated: the name moved the cursor, then the take confirmed it')
      .toBe(false);
  }, LIMIT);
});

// ============================== MUTATIONS CHECKED ==============================
// (2026-09-26) — `scratchpad/voice-scan/mutate.mjs`: CRLF normalised, exactly one occurrence required, each file restored from a
// copy on disk and checked by SHA-256. All red, counted in this file (and `voice-control.node`):
//   V1 `obey` never asks the switch                                  🔴 3 — «cancelar», «próximo», «confirmar» (node: 2)
//   V2 the root wires `oneButtonOnly` to false                       🔴 3 — the same three
//   V3 OPTION B: under one button a name is left alone, only a
//      command word counts                                           🔴 «próximo» — the name moved nothing: a press lost (node: 2)
//   V4 under one button the name is still pointed at before its press 🔴 3
//   V5 the switch read once, when the control is made                 🔴 3 (node: «asked per word»)
//   V6 under one button a name presses another position              not run here (the scan takes any position); 🔴 node: 2
//   V7 the root wires `oneButtonOnly` to true (one button OFF broken) 🔴 «far from the cursor, activates THAT item» (and 3 in
//      `a-name-said-activates-its-item`)
//   V8 with one button off a name is never pointed at                🔴 «far from the cursor, activates THAT item» (node: 4)
// Before the fix, this file's three one-button cases were red on the tree as it stood: that is the reproduction.
