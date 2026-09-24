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
import { createPadWizard, PADWIZ_ORDER } from '../app/js/input/pad-wizard.js';

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

// MUTATIONS CHECKED (2026-09-23), each red before this file counted — `scratchpad/probe-pad-wizard.mjs`:
//   · the last pad with a button down winning        → «the FIRST pad with a button down»
//   · the tick hook dropped                          → «the host is told about every tick»
//   · «let go» without the axis half                 → «a stick still pushed is NOT letting go»
//   · the axis threshold at zero                     → «an axis has to MOVE past the threshold»
//   · the extreme not kept                           → «what gets wired is the EXTREME»
//   · the interval never cleared                     → «closing stops the clock»
//   · a closed wizard reading a pad into a null state → «`tique()` is published»
//
// 🟡 AND THREE SURVIVORS ARE DECLARED, because two of them are the same fact: **the baseline's button array is all
// false by construction.** It is captured in the one frame where `!gp.buttons.some(pressed)` holds, so
//   · replacing it with `map(() => false)` changes nothing, and
//   · the `&& !base.b[i]` that guards a new press is comparing against a row of falses.
// They are not decoration — they are what makes the rule survive a baseline taken some other way — but no frame can
// tell them apart today. The third: `padWiz.step = 0` before the first `ask()` is redundant with `advance()`, which
// walks up from −1 to the first named position anyway.
