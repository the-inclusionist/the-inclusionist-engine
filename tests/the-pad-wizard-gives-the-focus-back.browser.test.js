// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PAD WIZARD SAYS IT CLOSED, AND THE FOCUS COMES BACK TO WHERE IT WAS (ADR-0248; WCAG 2.4.3).
//
// A DirectInput pad with no stored map opens the gamepad transport's own wizard (`input/gamepad`, `wizardTookOver`), and it may
// open over the pause card. The card goes inert under it and the focus leaves the card's item. When that wizard ENDS — saved
// at its last step, or cancelled — the focus must return to the item it left, or a screen-reader child is left on `<body>`.
//
// 🔴 The transport knows the wizard ended; the root owns the focus. `GamepadCtx.wizardClosed` is the wire between them, and
// the root answers it with `overlays.restoreFocus('padwiz')`.
//
// 📌 Driven through the REAL root with fake pads behind `navigator.getGamepads`, as `the-wizard-that-opened-by-itself-closes`
// does. ⚠️ ONE ROOT for the file: every root polls the same `navigator`. Each case uses its own pad id: a saved wizard stores a
// map for its pad, and a cancelled one sets its pad aside for the session (`maps.skip`) — either way that pad never opens a
// wizard again.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { keyed } from './fixtures/declared-words.js';
import { createTranslator } from '../app/js/core/i18n.js';
import { PADWIZ_ORDER } from '../app/js/input/pad-wizard.js';

const t = createTranslator().t;
const declaration = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => true, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const CARD_SAVED = 'Generic USB pad (Vendor: 0079 Product: 0031)';
const CARD_CANCELLED = 'Generic USB pad (Vendor: 0079 Product: 0032)';
const PLAY_SAVED = 'Generic USB pad (Vendor: 0079 Product: 0033)';
const IDS = [CARD_SAVED, CARD_CANCELLED, PLAY_SAVED];
let padId = CARD_SAVED;
let buttons = [];
const fakePad = () => ({
  index: 0, mapping: '', id: padId, axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i) })),
});

let host; let engine; let realGetGamepads;
/** Two frames: the root's poll schedules the next one at the end of its own. */
const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
/** The wizard ticks on its own clock (30 ms): long enough for two of its frames. */
const wait = (ms = 90) => new Promise((r) => setTimeout(r, ms));
const press = async (button) => { buttons = [button]; await frame(); await wait(); buttons = []; await frame(); await wait(); };
const stored = (id) => JSON.parse(localStorage.getItem('incl_padmap_' + id) ?? 'null');
const wizardShown = () => document.querySelector('#padwiz')?.hidden === false;
const quickPause = () => document.querySelector('#game-region .pausa-rapida');
const pausedInView = () => !!quickPause() && quickPause().hidden === false;
const back = () => document.getElementById('padwiz-close').click();

beforeAll(async () => {
  for (const id of IDS) localStorage.removeItem('incl_padmap_' + id);
  const { createGame } = await import('../app/js/boot/create-game.js');
  host = document.createElement('div');
  host.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1" style="position:relative;width:640px;height:360px"></div><div id="title-icons"></div>';
  document.body.appendChild(host);
  realGetGamepads = navigator.getGamepads;
  navigator.getGamepads = () => [fakePad()];
  engine = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaration(), host: { doc: document, win: window }, downloadHeavy: false,
    players: [{ ctrl: 0 }], ...keyed({ preset: { left: { label: 'Esquerda' }, action2: { label: 'Pular' } } }),
    setPhase: () => {}, onCommand: () => {},
  });
  window.dispatchEvent(new Event('gamepadconnected'));
  await frame();
});
afterAll(() => {
  navigator.getGamepads = realGetGamepads;
  engine?.dispose(); host?.remove();
  for (const id of IDS) localStorage.removeItem('incl_padmap_' + id);
});
// Each case leaves the scene as it found it even when it fails: a card left open would make the next case's game look paused
// (`worldRunning` is false under the card), and its premise would fail for a reason that is not its own.
afterEach(async () => {
  if (wizardShown()) back(); // «Voltar» cancels whichever wizard is mapping
  engine.pause.hide(0);
  buttons = [];
  await frame();
});

/** An unmapped DirectInput pad presses a button: its wizard opens by itself, adopts it and asks the game's first position. */
async function thePadOpensTheWizard(id) {
  padId = id;
  await press(3);
  expect(wizardShown(), 'the premise: the transport\'s own wizard opened').toBe(true);
  expect(document.querySelector('#padwiz-prompt').textContent, 'the premise: the wizard is mapping this pad')
    .toBe(t('pad.wiz.step', { n: PADWIZ_ORDER.indexOf('left') + 1, total: PADWIZ_ORDER.length, acao: 'Esquerda' }));
}
/** The wizard's four answers (Esquerda, Pular, START, SELECT): the last one closes it and SAVES — its normal end. */
async function everyAnswer() { for (const b of [7, 1, 5, 6]) await press(b); }

/** Opens the pause card and puts the focus on its first item — where the child is when the pad's wizard opens over it. */
function focusOnTheCard() {
  engine.pause.show(0);
  const item = document.querySelector('#vp-pause-0 .pm-btn');
  item.focus();
  expect(document.activeElement, 'the premise: the focus is on the card').toBe(item);
  return item;
}

describe('the transport\'s wizard over the open pause card gives the focus back to the card\'s item', () => {
  it('🔴 [Right] finished normally (saved at its last step): the focus is on the item it left, the card reachable', async () => {
    const item = focusOnTheCard();
    await thePadOpensTheWizard(CARD_SAVED);
    expect(document.activeElement, 'the premise: the card went inert under the wizard, and the focus with it').not.toBe(item);
    await everyAnswer();
    expect(stored(CARD_SAVED)?.select, 'the premise: the wizard ended SAVING').toBeTruthy();
    expect(wizardShown(), 'the premise: the saved wizard hid its overlay').toBe(false);
    expect(document.getElementById('vp-pause-0').hidden, 'the card closed').toBe(false);
    expect(document.getElementById('vp-pause-0').inert, 'the card stayed inert under a hidden wizard').toBe(false);
    expect(document.activeElement, 'the focus did not come back to the card\'s item').toBe(item);
  });

  it('🔴 [Right] cancelled by «Voltar»: the focus is on the item it left, nothing stored', async () => {
    const item = focusOnTheCard();
    await thePadOpensTheWizard(CARD_CANCELLED);
    expect(document.activeElement, 'the premise: the focus left the card').not.toBe(item);
    back();
    await frame(); await wait();
    expect(wizardShown(), '«Voltar» did not hide the wizard').toBe(false);
    expect(document.getElementById('vp-pause-0').inert, 'the card stayed inert under a hidden wizard').toBe(false);
    expect(document.activeElement, 'the focus did not come back to the card\'s item').toBe(item);
    expect(stored(CARD_CANCELLED), 'a cancelled wizard stored a map').toBeNull();
  });
});

describe('and opened by itself in play, it gives the focus back to the game once the game resumed', () => {
  it('🎯 [Time] finished normally: the game back in play and the focus on it', async () => {
    const region = document.getElementById('game-region');
    region.focus();
    expect(pausedInView(), 'the premise: the game is in play').toBe(false);
    await thePadOpensTheWizard(PLAY_SAVED);
    expect(pausedInView(), 'the premise: the wizard paused the game').toBe(true);
    await everyAnswer();
    expect(stored(PLAY_SAVED)?.select, 'the premise: the wizard ended SAVING').toBeTruthy();
    expect(pausedInView(), 'the game stayed paused after the wizard').toBe(false);
    expect(document.activeElement, 'the focus did not come back to the game').toBe(region);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// A counting script (exactly one occurrence required), restored from a copy and checked by SHA-256, 2026-09-26:
//   a  `input/gamepad` never calls `wizardClosed`             🔴 both card cases: the focus on <body> — and the Escape card case of
//      `the-wizard-that-opened-by-itself-closes` too, since the root's closer now leaves the return to the port
//   b  the root answers `wizardClosed` with nothing           🔴 the same three
//   c  `wizardClosed` called BEFORE `#padwiz` is hidden        🔴 the same three: the card is still inert under a visible overlay,
//      and an inert item refuses the focus
//   d  `wizardClosed` called before the auto-resume            green here (the ordering is held in `gamepad.node.test.js`)
// 📏 The in-play case stays GREEN under all four: in play the focus never leaves the game, as the in-play Escape cases of
// `the-wizard-that-opened-by-itself-closes` already found. It stays as the check that the saved end in play does not take the
// focus away from the game; it is not the gate of the port.
