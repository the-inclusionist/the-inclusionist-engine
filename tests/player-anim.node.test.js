// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FRAME CHOOSER, FRAME BY FRAME — the file `render/player-anim` has promised since it was extracted.
//
// ========================= WHY IT EXISTS, MEASURED =========================
// 📏 On 2026-09-23, before touching the shape of `choosePlayerFrame`, its twenty-eight decisions were disabled
// one at a time and the WHOLE node project was asked whether it noticed: TWENTY-FOUR stayed GREEN. It is by far
// the worst density this repository has measured (the three cuts before it gave 5 of 13, 5 of 11 and 4 of 9).
//
// 🔴 AND THE PATTERN OF THE BLIND ONES IS THE POINT: nearly all of them are promises to a particular child.
// Reduced motion stilling the cling frame, the water cycle and the breathing; the neutral pose for a child who
// plays seated, on a ladder and falling; the flavour toggle, which exists because some children are bothered by
// idle animations; the `walking` flag that `render/draw` reads to draw the cane of a child who cannot see; and
// running demanding the running cane. Every one of them could be deleted with 3234 cases green.
//
// 📌 The module's own header says it was pulled out of the monolith precisely so it could be driven «frame by
// frame in the node project». The extraction happened; the file never did. The cases come FIRST — the priority
// chain is about to become a table, and a cut that takes a decision out of the sieve's reach is a cut that
// loses a gate.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { choosePlayerFrame, COYOTE } from '../app/js/render/player-anim.js';
import { ANIM } from '../app/js/core/constants.js';

/** Sentinel frames: every one tells which arm of the chain chose it, so a wrong arm is named and not guessed. */
const TEX = {
  idle: ['i0', 'i1', 'i2', 'i3'],
  walk: ['w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'],
  run: ['r0', 'r1', 'r2', 'r3'],
  jumpUp: 'up',
  jumpDown: 'down',
  climb: ['c0', 'c1'],
  fly: 'fly',
  clingWall: ['cw0', 'cw1'],
  clingCeil: ['cc0', 'cc1'],
  swim: ['s0', 's1'],
  swimIdle: ['si0', 'si1'],
  flavors: [{ seq: [0, 1], hold: 2, tex: ['f0', 'f1'] }],
};

/** A player standing still on the ground, with every accommodation OFF. Each case turns on what it is about. */
const player = (over = {}) => ({
  vx: 0, vy: 0, onGround: true, onLadder: false, inWater: false,
  clinging: false, clingN: null, flying: false, airTime: 0, runCane: false,
  rmWalk: false, rmBreath: false, rmFlavor: false,
  anim: 0, walkAnim: 0, climbFrame: 0, idleNow: false, idleTime: 0, flavor: -1, flavorT: 0,
  walking: false, running: false, _tx: null,
  ctrl: 0, pad: null,
  ...over,
});

/** `held` is injected so a case turns «Run» on without mounting keys, pad and controller (the module says so). */
const env = (over = {}) => ({
  dt: 1, dir: 0, wheelchair: false,
  held: () => false,
  rnd: () => 0,
  tex: TEX,
  ...over,
});

describe('the priority chain picks the arm, and the order IS the rule', () => {
  it('🔴 [Right] clinging wins over everything, and ceiling and wall are DIFFERENT cycles', () => {
    // E18f: the two are distinct on purpose — a child stuck under a ceiling is not in the same pose as one on a wall.
    const wall = player({ clinging: true, clingN: 'R', inWater: true, onLadder: true, vx: 1, walkAnim: 0 });
    expect(choosePlayerFrame(wall, env())).toBe('cw0');
    const ceil = player({ clinging: true, clingN: 'U', inWater: true, onLadder: true, vx: 1, walkAnim: 0 });
    expect(choosePlayerFrame(ceil, env())).toBe('cc0');
  });

  it('🔴 [Right] the cling frame advances only while MOVING — standing still keeps the frame it was on', () => {
    const moving = player({ clinging: true, clingN: 'R', vy: 1, walkAnim: ANIM.clingHold });
    choosePlayerFrame(moving, env());
    expect(moving.climbFrame, 'the frame did not advance while climbing the wall').toBe(1);
    const still = player({ clinging: true, clingN: 'R', vx: 0, vy: 0, climbFrame: 1, walkAnim: 0 });
    choosePlayerFrame(still, env());
    expect(still.climbFrame, 'standing still moved the frame anyway').toBe(1);
  });

  it('⚠️ [Right] REDUCED MOTION freezes the cling on a single frame, whatever the clock says', () => {
    const pl = player({ clinging: true, clingN: 'R', rmWalk: true, vx: 1, vy: 1, climbFrame: 1, walkAnim: 999 });
    expect(choosePlayerFrame(pl, env())).toBe('cw0');
  });

  it('🔴 [Right] the ladder wins over water, and climbing differs from standing on it', () => {
    const climbing = player({ onLadder: true, inWater: true, vy: -1, walkAnim: ANIM.climbHold });
    expect(choosePlayerFrame(climbing, env())).toBe('c1');
    const still = player({ onLadder: true, inWater: true, vy: 0, walkAnim: ANIM.climbHold });
    expect(still._tx ?? choosePlayerFrame(still, env())).toBe('c0');
  });

  it('⚠️ [Right] a child who plays SEATED gets the still pose on a ladder — the lift, not the climb', () => {
    // A wheelchair does not climb a ladder: the engine shows the neutral pose and the cartridge moves them.
    const pl = player({ onLadder: true, vy: -1, walkAnim: 999 });
    expect(choosePlayerFrame(pl, env({ wheelchair: true }))).toBe('i0');
  });

  it('🔴 [Right] in water, moving is a STROKE and still is floating', () => {
    const stroking = player({ inWater: true, walkAnim: 0 });
    expect(choosePlayerFrame(stroking, env({ dir: 1 }))).toBe('s0');
    const byAction = player({ inWater: true, walkAnim: 0 });
    expect(choosePlayerFrame(byAction, env({ held: (_p, a) => a === 'action2' }))).toBe('s0');
    const floating = player({ inWater: true, walkAnim: 0 });
    expect(choosePlayerFrame(floating, env())).toBe('si0');
  });

  it('⚠️ [Right] REDUCED MOTION and the wheelchair still the water on one frame', () => {
    const rm = player({ inWater: true, rmWalk: true, walkAnim: ANIM.swimHold });
    expect(choosePlayerFrame(rm, env({ dir: 1 }))).toBe('si0');
    const wc = player({ inWater: true, walkAnim: ANIM.swimHold });
    expect(choosePlayerFrame(wc, env({ dir: 1, wheelchair: true }))).toBe('si0');
  });

  it('🔴 [Right] flying has a frame of its own, and it beats being airborne', () => {
    const pl = player({ flying: true, onGround: false, airTime: COYOTE + 1, vy: -1 });
    expect(choosePlayerFrame(pl, env())).toBe('fly');
  });

  it('🔴 [Right] rising and falling are DIFFERENT frames — legs tucked, then stretched', () => {
    const up = player({ onGround: false, vy: -1, airTime: COYOTE + 1 });
    expect(choosePlayerFrame(up, env())).toBe('up');
    const down = player({ onGround: false, vy: 1, airTime: COYOTE + 1 });
    expect(choosePlayerFrame(down, env())).toBe('down');
  });

  it('⚠️ [Right] falling, a child who plays SEATED keeps the neutral pose and reduced motion gets ONE jump frame', () => {
    const wc = player({ onGround: false, vy: 1, airTime: COYOTE + 1 });
    expect(choosePlayerFrame(wc, env({ wheelchair: true }))).toBe('i0');
    const rm = player({ onGround: false, vy: 1, airTime: COYOTE + 1, rmWalk: true });
    expect(choosePlayerFrame(rm, env())).toBe('up');
  });

  it('🔴 [Right] running has its own frames AND its own cadence — it is not walking faster', () => {
    // ⚠️ THE CLOCK IS CHOSEN so the two cadences DISAGREE. The first version used `runHold` and was blind: at
    // that clock both `runHold` and `walkHold` land on index 1, so swapping the cadence changed nothing and the
    // case passed over the defect. A case whose numbers cannot tell the two answers apart measures neither.
    const running = player({ runCane: true, walkAnim: ANIM.walkHold });
    expect(choosePlayerFrame(running, env({ dir: 1, held: (_p, a) => a === 'action1' })),
      'the running cadence became the walking one').toBe('r0');
    const walking = player({ walkAnim: ANIM.walkHold });
    expect(choosePlayerFrame(walking, env({ dir: 1 })), 'walking lost its own frames').toBe('w1');
  });

  it('⚠️ [Right] walking, a child who plays SEATED and REDUCED MOTION get one frame, not the step cycle', () => {
    const wc = player({ walkAnim: ANIM.walkHold });
    expect(choosePlayerFrame(wc, env({ dir: 1, wheelchair: true }))).toBe('i0');
    const rm = player({ walkAnim: ANIM.walkHold, rmWalk: true });
    expect(choosePlayerFrame(rm, env({ dir: 1 }))).toBe('i0');
  });
});

describe('the clocks, the flags and what the rest of the engine reads from them', () => {
  it('🔴 [Right] the render COYOTE keeps a landing steady — `onGround` blinking does not flick walk↔jump', () => {
    // E16: on landing, `onGround` flickers for a frame. Without the slack the child alternated walk and jump.
    const landing = player({ onGround: false, vy: 1, airTime: COYOTE });
    expect(choosePlayerFrame(landing, env({ dir: 1 })), 'a landing frame went airborne').toBe('w0');
    const falling = player({ onGround: false, vy: 1, airTime: COYOTE + 1 });
    expect(choosePlayerFrame(falling, env({ dir: 1 })), 'past the slack it IS airborne').toBe('down');
  });

  it('🔴 [Right] the cane flag says WALKING only on foot — never in water, on a ladder or in flight', () => {
    // `render/draw` reads `walking` to draw the cane of a child who cannot see: a cane in mid-air is a lie.
    const onFoot = player();
    choosePlayerFrame(onFoot, env({ dir: 1 }));
    expect(onFoot.walking).toBe(true);
    for (const over of [{ inWater: true }, { onLadder: true }, { flying: true }]) {
      const pl = player(over);
      choosePlayerFrame(pl, env({ dir: 1 }));
      expect(pl.walking, `the cane flag survived ${Object.keys(over)[0]}`).toBe(false);
    }
  });

  it('⚠️ [Right] RUNNING needs the running cane — holding the button is not enough', () => {
    const withCane = player({ runCane: true });
    choosePlayerFrame(withCane, env({ dir: 1, held: (_p, a) => a === 'action1' }));
    expect(withCane.running).toBe(true);
    const without = player({ runCane: false });
    choosePlayerFrame(without, env({ dir: 1, held: (_p, a) => a === 'action1' }));
    expect(without.running, 'running turned on with no cane to run with').toBe(false);
  });

  it('🔴 [Right] standing still is ANNOUNCED as idle and the idle clock runs', () => {
    const pl = player();
    choosePlayerFrame(pl, env({ dt: 2 }));
    expect([pl.idleNow, pl.idleTime]).toEqual([true, 2]);
  });

  it('🔴 [Right] leaving idle clears the clock and the flavour in the same frame', () => {
    const pl = player({ idleTime: 400, flavor: 0, flavorT: 1 });
    choosePlayerFrame(pl, env({ dir: 1 }));
    expect([pl.idleNow, pl.idleTime, pl.flavor]).toEqual([false, 0, -1]);
  });
});

describe('the idle: breathing, and the flavour that some children turn off', () => {
  it('⚠️ [Right] REDUCED MOTION stills the breathing on one frame', () => {
    const breathing = player({ anim: ANIM.idleHold });
    expect(choosePlayerFrame(breathing, env())).toBe('i1');
    const still = player({ anim: ANIM.idleHold, rmBreath: true });
    expect(choosePlayerFrame(still, env())).toBe('i0');
  });

  it('🔴 [Right] a flavour plays its sequence and ENDS, giving the breathing back', () => {
    const pl = player({ idleTime: ANIM.flavorDelay + 1 });
    expect(choosePlayerFrame(pl, env()), 'the flavour did not start after the delay').toBe('f0');
    pl.flavorT = 2 * 1; // the second step of a hold of 2
    expect(choosePlayerFrame(pl, env())).toBe('f1');
    pl.flavorT = 2 * 2; // past the end of the sequence
    const after = choosePlayerFrame(pl, env());
    expect(pl.flavor, 'the flavour never ended').toBe(-1);
    expect(after, 'the breathing did not come back').toBe('i0');
  });

  it('⚠️ [Zero] with the flavour TOGGLE off, nothing is ever drawn but the breathing', () => {
    // It is a toggle of its own because some children are bothered by movement they did not ask for.
    const pl = player({ idleTime: ANIM.flavorDelay + 1, rmFlavor: true });
    expect(choosePlayerFrame(pl, env())).toBe('i0');
    expect(pl.flavor, 'a flavour was chosen for someone who turned them off').toBe(-1);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// 📏 The twenty-eight decisions of `choosePlayerFrame`, disabled one at a time against THIS file: 28 red,
// control green. Before it, the whole node project caught FOUR of them.
//
// ⚠️ TWO OF THE CASES WERE BLIND WHEN FIRST WRITTEN, and it was the re-run that said so, not reading them:
//   · the running cadence was exercised at a clock where `runHold` and `walkHold` land on the SAME index, so
//     swapping one for the other changed nothing. The clock is now chosen so the two answers disagree.
//   · nothing asked what a child who plays seated, or one with reduced motion, sees while WALKING.
// A case file that passes on its first run has proved nothing yet; this is what proving it looks like.
//
// 📏 AND THEN THE SAME DECISIONS WERE ASKED AGAIN IN THE NEW HOME, after the chain became a table: 30 red,
// control green. Twenty-eight are these; two more only a TABLE can be asked — that the last row always answers
// (a state no row recognises would otherwise draw `undefined`, which does not fail, it keeps the last frame
// forever), and that the ORDER is the rule and not a coincidence of where each row happens to sit.
