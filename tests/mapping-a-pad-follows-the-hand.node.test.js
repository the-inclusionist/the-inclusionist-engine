// SPDX-License-Identifier: AGPL-3.0-or-later
// MAPPING A PAD FOLLOWS THE HAND (ADR-0151 §2; issue #182) — the state machine of `input/pad-wizard.tique`, frame by
// frame, with fake pads and no engine around it.
//
// 🔴 WHY THIS FILE EXISTS. `map-the-gamepad.browser.test.js` drives the wizard through a whole `createGame`, which is
// the right place to prove that the row opens it and that the map is stored — and the wrong place to ask what the
// wizard does on the ninth frame of a stick that is still being pushed. 📏 Probed on 2026-09-23 before cutting
// `tique` (27 paths against McCabe's 10): nine of thirty-one decisions had nothing holding them, and every one of
// them is a FRAME the browser file cannot stage.
//
// 📌 The wizard exists for the pads the browser does not know — generic, adapted, one-handed. A child mapping one has
// no second controller to fall back on, so a phase that ends early maps the wrong button and there is no way back.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t;
import { createPadWizard, createPadMaps, PADWIZ_ORDER } from '../app/js/input/pad-wizard.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';

/** A pad at rest: every button up, every axis centred. */
const mkPad = (id, index, buttons = 12, axes = 2) => ({
  id, index,
  buttons: Array.from({ length: buttons }, () => ({ pressed: false })),
  axes: Array.from({ length: axes }, () => 0),
});

/** Three positions named by the game, so a case can wire one step without the wizard reaching the end and closing. */
const THREE = ['up', 'down', 'left'];

function mkCtx(pads, named = THREE) {
  const said = [], steps = [], progress = [], closed = [];
  let ticks = 0;
  const ctx = {
    maps: createPadMaps(createStorage(memoryBackend())), // each case its own root's maps (ADR-0232 D4)
    t: translate, // the root's translator, played by the test (ADR-0232 D3)
    getGamepads: () => pads,
    actionLabel: (a) => (named.includes(a) ? a.toUpperCase() : null),
    say: (p) => said.push(p),
    progress: (p) => progress.push(p),
    srAlert: () => {},
    onStep: (a) => steps.push(a),
    onTick: () => { ticks++; },
    onClose: (gi, saved) => closed.push([gi, saved]),
  };
  return { ctx, said, steps, progress, closed, questions: () => steps.filter(Boolean).length, tickCount: () => ticks };
}

/** The fake clock: the wizard reaches for the global `setInterval`, so a case that asks about the clock stubs it. */
let clocks;
const realSet = globalThis.setInterval, realClear = globalThis.clearInterval;
beforeEach(() => {
  clocks = [];
  globalThis.setInterval = (fn, ms) => { const id = { fn, ms }; clocks.push({ id, cleared: false }); return id; };
  globalThis.clearInterval = (id) => { const c = clocks.find((x) => x.id === id); if (c) c.cleared = true; };
});
afterEach(() => { globalThis.setInterval = realSet; globalThis.clearInterval = realClear; });

/** Adopt the pad and take the baseline: press a button, let go, and the first question is asked. */
function upToTheFirstQuestion(wiz, pad) {
  wiz.open();
  pad.buttons[2].pressed = true;
  wiz.tick();                       // 1 · this pad is the one, now let go of everything
  pad.buttons[2].pressed = false;
  wiz.tick();                       // 2 · baseline taken, step 0, first question asked
}

describe('a wizard that is not open', () => {
  it('⚠️ `tique()` is published, so a host can call it with nothing open — and it answers by doing nothing', () => {
    // 📌 `initGamepad` drives this on its own frame loop. A wizard closed between two frames of that loop is the
    // ordinary case, not the odd one, and reading a pad into a null state is a throw inside somebody's rAF.
    const { ctx, tickCount } = mkCtx([mkPad('p', 0)]);
    const wiz = createPadWizard(ctx);
    expect(() => wiz.tick()).not.toThrow();
    expect(tickCount(), 'a closed wizard told the host it had ticked').toBe(0);
  });
});

describe('which pad the wizard adopts', () => {
  it('⚠️ the FIRST pad with a button down is the one, not the last', () => {
    // 📌 Two pads plugged in and one of them reporting a stuck button is ordinary in a school's box of donated
    // hardware. Whichever the loop settles on is the one the child will spend the next fourteen steps mapping.
    const held = mkPad('the pad in the hand', 0), other = mkPad('the pad on the table', 1);
    const { ctx } = mkCtx([held, other]);
    const wiz = createPadWizard(ctx);
    wiz.open();
    held.buttons[2].pressed = true; other.buttons[5].pressed = true;
    wiz.tick();
    expect(wiz.state().id, 'the wizard adopted the pad the child is not holding').toBe('the pad in the hand');
  });

  it('⚠️ the host is told about every tick — its demonstration animates on this call and no other', () => {
    const { ctx, tickCount } = mkCtx([mkPad('p', 0)]);
    const wiz = createPadWizard(ctx);
    wiz.open();
    wiz.tick(); wiz.tick();
    expect(tickCount(), 'the host was never told the wizard ticked').toBe(2);
  });
});

describe('letting go before the next question', () => {
  it('⚠️ a stick still pushed is NOT letting go, even with every button up', () => {
    /*
     * 🔴 This is the frame that costs the child a step. After a position is wired the wizard waits for the hand to
     * let go — and «let go» has two halves. With only the button half, a child who wired a button while resting a
     * thumb on the stick gets the next question asked AND answered by that same stick, in one frame.
     */
    const pad = mkPad('p', 0);
    const { ctx, questions } = mkCtx([pad]);
    const wiz = createPadWizard(ctx);
    upToTheFirstQuestion(wiz, pad);
    expect(questions()).toBe(1);

    pad.buttons[5].pressed = true;
    wiz.tick();                     // wires the button, and now demands the hand lets go
    pad.buttons[5].pressed = false;
    pad.axes[0] = 0.9;               // the thumb never left the stick
    wiz.tick();
    expect(questions(), 'the next position was asked with the stick still pushed').toBe(1);

    pad.axes[0] = 0;
    wiz.tick();
    expect(questions(), 'and with the hand off, the next position is asked').toBe(2);
  });
});

describe('reading an axis', () => {
  it('⚠️ an axis has to MOVE past the threshold before it is watched at all', () => {
    const pad = mkPad('p', 0);
    const { ctx } = mkCtx([pad]);
    const wiz = createPadWizard(ctx);
    upToTheFirstQuestion(wiz, pad);
    pad.axes[0] = 0.3;               // a resting stick drifts this much
    wiz.tick();
    expect(wiz.state().axTrack, 'a drifting stick started being mapped').toBeNull();
    expect(wiz.state().map, 'and nothing was wired').toEqual({});
  });

  it('⚠️ what gets wired is the EXTREME the axis reached, not the first frame past the threshold', () => {
    /*
     * 📌 An axis is watched for eight ticks and classified by BEHAVIOUR: varying continuously is an analogue stick
     * (wired by its sign), jumping and holding is a d-pad on an axis (wired by its exact value). A stick pushed one
     * way and then the other inside those eight ticks is one gesture, and the direction it ENDED at is the one the
     * child means — keeping the first sample wires the opposite direction, silently.
     */
    const pad = mkPad('p', 0);
    const { ctx } = mkCtx([pad]);
    const wiz = createPadWizard(ctx);
    upToTheFirstQuestion(wiz, pad);
    const first = PADWIZ_ORDER.find((a) => THREE.includes(a));

    pad.axes[0] = 0.5;
    wiz.tick();                     // past 0.45: the axis is now watched
    for (const v of [0.6, 0.7, -0.9, -0.9, -0.9, -0.9, -0.9, -0.9]) { pad.axes[0] = v; wiz.tick(); }
    expect(wiz.state().map[first], 'the axis was wired by where it started instead of where it went')
      .toEqual({ ax: 0, s: -1 });
  });
});

describe('closing', () => {
  it('⚠️ closing stops the clock — a wizard that is gone does not keep polling the pads', () => {
    const { ctx } = mkCtx([mkPad('p', 0)]);
    const wiz = createPadWizard(ctx);
    wiz.open();
    expect(clocks.length, 'the wizard did not start a clock').toBe(1);
    wiz.close(false);
    expect(clocks[0].cleared, 'the interval outlived the wizard: it polls the gamepads for the rest of the session').toBe(true);
  });
});

/*
 * START AND SELECT ARE ALWAYS ASKED, LAST, IN THE ENGINE'S WORDS (ADR-0122, ADR-0144 §1 and §4, ADR-0155 §4).
 * 🔴 MEASURED on 2026-09-26: the wizard asked only what the host's labeller named, and a game's preset may not name `start` or
 * `select` (refused at boot) — so a pad mapped in the motor panel, or a DirectInput pad whose wizard opened by itself, came out
 * with no START and no SELECT: no quick pause, no menus, for a pause no game may decline. They are the system's positions, and
 * `core/actions` says the engine may name them (the legend printed on the pad): the wizard asks them from its own dictionary.
 */
describe('START and SELECT: always asked, last, in the engine\'s words', () => {
  /** Answers the question on screen with button `b`: pressed on one frame, let go on the next. */
  function answer(wiz, pad, b) {
    pad.buttons[b].pressed = true;
    wiz.tick();
    pad.buttons[b].pressed = false;
    wiz.tick();
  }
  const START_SENTENCE = translate('pad.wiz.stepStart', { n: PADWIZ_ORDER.indexOf('start') + 1, total: PADWIZ_ORDER.length });
  const SELECT_SENTENCE = translate('pad.wiz.stepSelect', { n: PADWIZ_ORDER.indexOf('select') + 1, total: PADWIZ_ORDER.length });

  it('🔴 [Right] after the game\'s last named position it asks START, then SELECT, and only then closes and stores them', () => {
    const pad = mkPad('p', 0);
    const { ctx, steps, closed } = mkCtx([pad]);
    const wiz = createPadWizard(ctx);
    upToTheFirstQuestion(wiz, pad);
    answer(wiz, pad, 4); answer(wiz, pad, 5); answer(wiz, pad, 6); // up, down, left: the three the game names
    expect(wiz.state(), 'the wizard closed after the game\'s last position, without asking START').not.toBeNull();
    answer(wiz, pad, 7);
    expect(wiz.state(), 'the wizard closed after START, without asking SELECT').not.toBeNull();
    answer(wiz, pad, 8);
    expect(steps.filter(Boolean), 'the order of the questions').toEqual(['up', 'down', 'left', 'start', 'select']);
    expect(closed, 'the wizard did not close and save after SELECT').toEqual([[0, true]]);
    expect(ctx.maps.padMap('p'), 'the stored map').toEqual({
      up: { b: 4 }, down: { b: 5 }, left: { b: 6 }, start: { b: 7 }, select: { b: 8 },
    });
  });

  it('🔴 [CrossCheck] the words are the ENGINE\'s: a host that names `start` and `select` does not choose what the child hears', () => {
    // 📌 A preset cannot name them (ADR-0144 §4, ADR-0155 §4), so a word here could only be a game speaking where the system does.
    const pad = mkPad('p', 0);
    const { ctx, said } = mkCtx([pad]);
    ctx.actionLabel = (a) => ({ up: 'UP', start: 'THE GAME\'S WORD', select: 'ANOTHER GAME WORD' })[a] ?? null;
    const wiz = createPadWizard(ctx);
    upToTheFirstQuestion(wiz, pad);
    answer(wiz, pad, 4); // up
    expect(said.at(-1), 'START was not asked in the engine\'s words').toBe(START_SENTENCE);
    answer(wiz, pad, 5); // start
    expect(said.at(-1), 'SELECT was not asked in the engine\'s words').toBe(SELECT_SENTENCE);
    expect(said.some((s) => s.includes('GAME')), 'the game\'s word reached the system\'s question').toBe(false);
    expect(START_SENTENCE, 'the engine\'s dictionary has no START question').toMatch(/START/);
    expect(SELECT_SENTENCE, 'the engine\'s dictionary has no SELECT question').toMatch(/SELECT/);
  });

  it('🎯 [Zero] a host that names no position still maps START and SELECT — the pause is not the game\'s to decline', () => {
    const pad = mkPad('p', 0);
    const { ctx, steps } = mkCtx([pad], []);
    const wiz = createPadWizard(ctx);
    upToTheFirstQuestion(wiz, pad);
    answer(wiz, pad, 4); answer(wiz, pad, 5);
    expect(steps.filter(Boolean)).toEqual(['start', 'select']);
    expect(ctx.maps.padMap('p')).toEqual({ start: { b: 4 }, select: { b: 5 } });
  });
});

/*
 * THE PROGRESS LINE NAMES EACH POSITION BY THE WORD IT WAS ASKED WITH (ADR-0074: no abstract name reaches a person).
 * 🔴 MEASURED on 2026-09-26: «Mapeados: up · action2 · start» — the line listed the map's KEYS, the engine's position ids, under
 * a question the child had just heard in the game's words. Each position is shown as it was asked: the game's word for the
 * game's positions (the host's labeller), the engine's word for START and SELECT.
 */
describe('the progress line: each position in the word it was asked with', () => {
  function answer(wiz, pad, b) {
    pad.buttons[b].pressed = true; wiz.tick();
    pad.buttons[b].pressed = false; wiz.tick();
  }
  const WORDS = { up: 'Subir', down: 'Descer', left: 'Esquerda' };
  const t = translate; // named `t`: its `{param}` keys are the dictionary's, not members (`scripts/apply-member-rename.mjs`)

  it('🔴 [Right] after up, down, left and START, the line is the game\'s three words and the engine\'s START', () => {
    const pad = mkPad('p', 0);
    const { ctx, progress } = mkCtx([pad]);
    ctx.actionLabel = (a) => WORDS[a] ?? null;
    const wiz = createPadWizard(ctx);
    upToTheFirstQuestion(wiz, pad);
    answer(wiz, pad, 4); answer(wiz, pad, 5); answer(wiz, pad, 6); answer(wiz, pad, 7); // up, down, left, START
    expect(progress.at(-1), 'the progress line does not name what was mapped in the words it was asked with')
      .toBe(t('pad.wiz.mapped', { lista: ['Subir', 'Descer', 'Esquerda', t('touch.start')].join(' · ') }));
    expect(progress.at(-1), 'a position id reached the child').not.toMatch(/\b(up|down|left|start)\b/);
  });

  it('🔴 [CrossCheck] the word for START and SELECT is the one their questions say', () => {
    const start = translate('pad.wiz.stepStart', { n: 1, total: 1 }), select = translate('pad.wiz.stepSelect', { n: 1, total: 1 });
    expect(start, 'START\'s question does not say the word the progress line shows').toContain(translate('touch.start'));
    expect(select, 'SELECT\'s question does not say the word the progress line shows').toContain(translate('touch.select'));
  });
});

/*
 * THE STORED MAPS ARE ONE ROOT'S (ADR-0232 D4). As a module cache they were one for the page: two roots on two stores read
 * each other's map, and a pad a child in one root never recorded answered with the map another child saved.
 */
describe('the stored maps, one cache per root', () => {
  const PULAR = { action2: { b: 9 } };

  it('🔴 [Cross-check] a map one root saves is not read by another root on its own store', () => {
    const a = createPadMaps(createStorage(memoryBackend()));
    const b = createPadMaps(createStorage(memoryBackend()));
    a.store('Generic Pad', PULAR);
    expect(a.padMap('Generic Pad'), 'the root that saved it lost it').toEqual(PULAR);
    expect(b.padMap('Generic Pad'), 'the second root read the first root\'s map').toBeNull();
  });

  it('[Right] what is stored survives into a new root on the same store — it is the child\'s, not the session\'s', () => {
    const store = createStorage(memoryBackend());
    createPadMaps(store).store('Generic Pad', PULAR);
    expect(createPadMaps(store).padMap('Generic Pad'), 'the map was kept only in memory').toEqual(PULAR);
  });

  it('⚠️ [Boundary] a cancelled wizard does not overwrite a map already stored, and is not stored itself', () => {
    const store = createStorage(memoryBackend());
    const maps = createPadMaps(store);
    maps.store('Generic Pad', PULAR);
    maps.skip('Generic Pad');
    expect(maps.padMap('Generic Pad'), 'cancelling a second mapping erased the first').toEqual(PULAR);
    maps.skip('Unknown Pad');
    expect(maps.padMap('Unknown Pad'), 'a cancelled wizard must answer the default map for the session').toEqual({ _skip: true });
    expect(createPadMaps(store).padMap('Unknown Pad'), 'the session sentinel reached the store').toBeNull();
  });
});

// MUTATIONS CHECKED (2026-09-23), each red before this file counted — `scratchpad/probe-pad-wizard.mjs`:
//   · the last pad with a button down winning        → «the FIRST pad with a button down»
//   · the tick hook dropped                          → «the host is told about every tick»
//   · «let go» without the axis half                 → «a stick still pushed is NOT letting go»
//   · the axis threshold at zero                     → «an axis has to MOVE past the threshold»
//   · the extreme not kept                           → «what gets wired is the EXTREME»
//   · the interval never cleared                     → «closing stops the clock»
//   · a closed wizard reading a pad into a null state → «`tique()` is published»
// and (2026-09-26, `scratchpad/wizard-start-select/mutate.mjs`, restored by SHA-256):
//   · the START step dropped                         → «after the game's last named position» and «[Zero]»
//   · the SELECT step dropped                        → the same two
//   · START and SELECT asked from the host's labeller → all three (the preset cannot name them: the steps vanish)
// and (2026-09-26, `scratchpad/wizard-words-single/mutate.mjs`, restored by SHA-256):
//   · the progress line listing the map's keys       → «after up, down, left and START»
//   · START named by its id · the game's positions named by their ids → the same case, each
//
// 🟡 AND THREE SURVIVORS ARE DECLARED, because two of them are the same fact: **the baseline's button array is all
// false by construction.** It is captured in the one frame where `!gp.buttons.some(pressed)` holds, so
//   · replacing it with `map(() => false)` changes nothing, and
//   · the `&& !base.b[i]` that guards a new press is comparing against a row of falses.
// They are not decoration — they are what makes the rule survive a baseline taken some other way — but no frame can
// tell them apart today. The third: `padWiz.step = 0` before the first `ask()` is redundant with `advance()`, which
// walks up from −1 to the first named position anyway.
