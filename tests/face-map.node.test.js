// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FACE AS A CONTROLLER (ADR-0210 and its erratum; issue #191). Ported from the face half of the lab's `mapa.check.mjs` (map v12), where
// each rule came from a run of the Dev's.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import {
  FACE_MAP, FACE_BLENDSHAPES, faceScoresFromCategories, headTurn, FULL_TURN, faceLevels, resolveFace, ownMarks, createCrossedLook,
  createLongSqueeze, createMouthHold, createFaceMapReader, faceRestFromSamples, createFaceRest, SQUEEZE_MARK, PUCKER_MARK,
} from '../app/js/input/face-map.js';

const NO_REST = { scores: {}, headX: 0 };
const still = { left: 0, right: 0 };
/** Presses from a list of levels frames, through the same hold the reader uses (mark 0.3, 300 ms). */
const holder = () => {
  const since = new Map(), held = new Set();
  return (ms, levels) => {
    const started = [];
    for (const [e, v] of Object.entries(levels)) {
      if (v >= 0.3) { if (!since.has(e)) since.set(e, ms); if (!held.has(e) && ms - since.get(e) >= 300) { held.add(e); started.push(e); } }
      else { since.delete(e); held.delete(e); }
    }
    return started;
  };
};

describe('the map', () => {
  it('is the Dev\'s: thirteen expressions, each on its own action, SELECT without one', () => {
    expect(FACE_MAP).toEqual({
      browsUp: 'up', frown: 'down', headLeft: 'left', headRight: 'right', squeeze: 'start',
      pressLips: 'action1', openMouth: 'action2', smile: 'action3', pucker: 'action4',
      lookRightThenLeft: 'leftShoulder', mouthLeft: 'leftTrigger', lookLeftThenRight: 'rightShoulder', mouthRight: 'rightTrigger',
    });
    expect(new Set(Object.values(FACE_MAP)).size).toBe(13);
    expect(Object.values(FACE_MAP)).not.toContain('select');
  });
  it('keeps the blendshapes it reads from a detection, and drops the rest', () => {
    const s = faceScoresFromCategories([{ categoryName: 'jawOpen', score: 0.7 }, { categoryName: 'cheekPuff', score: 0.9 }]);
    expect(s).toEqual({ jawOpen: 0.7 });
    expect(FACE_BLENDSHAPES).toContain('eyeSquintRight');
  });
});

describe('the levels', () => {
  it('a level rises from the rest: jawOpen 0.6 over a rest of 0.2 is 0.5', () => {
    const l = faceLevels({ jawOpen: 0.6, mouthClose: 0.5 }, { scores: { jawOpen: 0.2 }, headX: 0 }, still);
    expect(l.openMouth).toBeCloseTo(0.5, 9); expect(l.smile).toBe(0); expect(l.browsUp).toBe(0);
  });
  it('a look to the left needs both eyes: the left out AND the right in, the weaker of the two', () => {
    expect(faceLevels({ eyeLookOutLeft: 0.7, eyeLookInRight: 0.6 }, NO_REST, still).lookRightThenLeft).toBe(0.6);
    expect(faceLevels({ eyeLookOutLeft: 0.7 }, NO_REST, still).lookRightThenLeft).toBe(0);
    expect(faceLevels({ eyeLookOutLeft: 0.7, eyeLookInRight: 0.6 }, NO_REST, still).lookLeftThenRight).toBe(0);
    expect(faceLevels({ eyeLookOutRight: 0.5, eyeLookInLeft: 0.8 }, NO_REST, still).lookLeftThenRight).toBe(0.5);
  });
  it('squeezing: one eye is enough, by blink or squint, the more closed one', () => {
    expect(faceLevels({ eyeSquintLeft: 0.8, eyeBlinkRight: 0.6 }, NO_REST, still).squeeze).toBe(0.8);
    expect(faceLevels({ eyeBlinkRight: 0.7 }, NO_REST, still).squeeze).toBe(0.7);
  });
  it('the eyes rise from the rest too', () => {
    const rest = { scores: { eyeLookOutLeft: 0.2, eyeLookInRight: 0.2 }, headX: 0 };
    expect(faceLevels({ eyeLookOutLeft: 0.6, eyeLookInRight: 0.6 }, rest, still).lookRightThenLeft).toBeCloseTo(0.5, 9);
  });
});

describe('the head turn', () => {
  // a synthetic face in the camera's unmirrored image: cheek edges at x 0.4 and 0.6, the nose moved by a turn
  const face = (noseX) => { const m = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 })); m[234] = { x: 0.4, y: 0.5 }; m[454] = { x: 0.6, y: 0.5 }; m[1] = { x: noseX, y: 0.52 }; return m; };
  it('facing the camera is no turn; image +x is the player\'s left, −x the right', () => {
    expect(headTurn(face(0.5))).toMatchObject({ left: 0, right: 0 });
    const l = headTurn(face(0.53)), r = headTurn(face(0.47));
    expect(l.left).toBeGreaterThan(0); expect(l.right).toBe(0);
    expect(r.right).toBeGreaterThan(0); expect(r.left).toBe(0);
  });
  it('is measured from the rest, not from the image centre, and reaches the mark at 0.3 of a full turn', () => {
    expect(headTurn(face(0.52), 0.15)).toMatchObject({ left: 0 });
    expect(headTurn(face(0.52), 0.15).right).toBeGreaterThan(0);
    expect(headTurn(face(0.5 + 0.2 * 0.3 * FULL_TURN)).left).toBeCloseTo(0.3, 9);
  });
  it('no landmarks is no turn', () => { expect(headTurn(undefined)).toEqual({ x: null, left: 0, right: 0 }); });
});

describe('the exclusions and the own marks', () => {
  const r = (x) => resolveFace(x, 0.3);
  it('a specific expression alone stays', () => { expect(r({ mouthLeft: 0.67 }).mouthLeft).toBe(0.67); expect(r({ openMouth: 0.76 }).openMouth).toBe(0.76); });
  it('lips pressed are not a smile', () => { expect(r({ smile: 0.4, pressLips: 0.6 }).smile).toBe(0); });
  it('the mouth pushed to either side clears the pucker it projects; a pucker alone stays', () => {
    expect(r({ pucker: 0.84, mouthRight: 0.62 })).toMatchObject({ pucker: 0, mouthRight: 0.62 });
    expect(r({ pucker: 0.8, mouthLeft: 0.5 }).pucker).toBe(0);
    expect(r({ pucker: 0.97 }).pucker).toBe(0.97);
  });
  it('a squeeze at 0.5 clears the frown it pulls; a real frown squeezing below 0.5 keeps it', () => {
    expect(r({ squeeze: 0.6, frown: 0.46 })).toMatchObject({ frown: 0, squeeze: 0.6 });
    expect(r({ squeeze: 0.45, frown: 0.5 }).frown).toBe(0.5);
    expect(SQUEEZE_MARK).toBe(0.5);
  });
  it('the pucker has its own mark 0.6: a relaxed mouth and 0.55 raise nothing; others keep theirs', () => {
    expect([ownMarks({ pucker: 0.33 }).pucker, ownMarks({ pucker: 0.55 }).pucker, ownMarks({ pucker: 0.99 }).pucker]).toEqual([0, 0, 0.99]);
    expect(ownMarks({ openMouth: 0.35 }).openMouth).toBe(0.35);
    expect(PUCKER_MARK).toBe(0.6);
  });
});

describe('the long squeeze and the mouth hold', () => {
  it('a relaxed narrowing never presses START; a squeeze under 1 s does not; one held 1 s presses once', () => {
    const sq = createLongSqueeze(), hold = holder();
    const step = (ms, v) => hold(ms, { squeeze: sq(ms, { squeeze: v }).squeeze });
    expect([0, 500, 1000, 2000].flatMap((ms) => step(ms, 0.34))).toEqual([]);
    expect([3000, 3500, 3900].flatMap((ms) => step(ms, 0.6)).concat(step(3950, 0))).toEqual([]);
    expect([5000, 5500, 5700, 5900].flatMap((ms) => step(ms, 0.6))).toEqual([]);
    expect(step(6000, 0.6)).toEqual(['squeeze']); expect(step(6200, 0.6)).toEqual([]);
  });
  it('a spoken syllable presses no pucker; a pucker held presses at 600 ms, once; the brows keep 300 ms', () => {
    const mh = createMouthHold({ mark: 0.3 }), hold = holder();
    const step = (ms, x) => hold(ms, mh(ms, x));
    expect([0, 100, 200, 300, 400].flatMap((ms) => step(ms, { pucker: 0.95 })).concat(step(450, { pucker: 0 }))).toEqual([]);
    expect([1000, 1300, 1500].flatMap((ms) => step(ms, { pucker: 0.95 }))).toEqual([]);
    expect(step(1600, { pucker: 0.95 })).toEqual(['pucker']); expect(step(1800, { pucker: 0.95 })).toEqual([]);
    expect([3000, 3300].flatMap((ms) => step(ms, { browsUp: 0.6 }))).toEqual(['browsUp']);
  });
});

describe('the crossed look', () => {
  // frames [ms, look left, look right, extra]; the left look is read under lookRightThenLeft, the right under lookLeftThenRight
  const run = (cl, frames) => frames.map(([ms, l, r, extra = {}]) => cl(ms, { lookRightThenLeft: l, lookLeftThenRight: r, ...extra }));
  const make = () => createCrossedLook({ mark: 0.3 });
  it('left then right: the right button rises at 0.6, stays down while the eyes stay right, releases at the centre; the other never rises', () => {
    const out = run(make(), [[0, 0.8, 0], [200, 0.8, 0], [400, 0.8, 0], [500, 0, 0], [700, 0, 0.8], [900, 0, 0.8], [1000, 0, 0.8], [1500, 0, 0.8], [2000, 0, 0.5], [2100, 0, 0]]);
    expect(out.slice(0, 4).every((x) => x.lookLeftThenRight === 0)).toBe(true); expect(out[4].lookLeftThenRight).toBe(1);
    expect(out.slice(5, 9).every((x) => x.lookLeftThenRight === 1)).toBe(true); expect(out[9].lookLeftThenRight).toBe(0);
    expect(out.every((x) => x.lookRightThenLeft === 0)).toBe(true);
  });
  it('right then left presses the left button once, 300 ms after the left side reached 0.6', () => {
    const cl = make(), hold = holder();
    const started = [[0, 0, 0.8], [300, 0, 0.8], [400, 0, 0], [600, 0.8, 0], [800, 0.8, 0], [900, 0.8, 0], [1500, 0.8, 0]]
      .flatMap(([ms, l, r]) => hold(ms, { lookRightThenLeft: cl(ms, { lookRightThenLeft: l, lookLeftThenRight: r }).lookRightThenLeft }));
    expect(started).toEqual(['lookRightThenLeft']);
  });
  it('a crossing slower than 0.8 s presses nothing; a first side that peaked at 0.5 starts none', () => {
    expect(run(make(), [[0, 0.8, 0], [300, 0.8, 0], [400, 0, 0], [1300, 0, 0.8], [1700, 0, 0.8]]).every((x) => x.lookLeftThenRight === 0)).toBe(true);
    expect(run(make(), [[0, 0.5, 0], [300, 0.5, 0], [400, 0, 0], [600, 0, 0.8], [1000, 0, 0.8]]).every((x) => x.lookLeftThenRight === 0)).toBe(true);
  });
  it('the second side dropping under 0.6 before 300 ms cancels the press', () => {
    const out = run(make(), [[0, 0.8, 0], [300, 0.8, 0], [400, 0, 0], [600, 0, 0.8], [800, 0, 0.8], [850, 0, 0.4], [1000, 0, 0.8], [1400, 0, 0.8]]);
    expect([out[4], out[5], out[6], out[7]].map((x) => x.lookLeftThenRight)).toEqual([1, 0, 0, 0]);
  });
  it('the release overshoot (0.43) presses nothing, and a crossing started with the head turned presses nothing', () => {
    expect(run(make(), [[0, 0.8, 0], [300, 0.8, 0], [400, 0, 0], [600, 0, 0.8], [900, 0, 0.8], [2000, 0, 0.8], [2100, 0, 0], [2200, 0.43, 0], [2400, 0, 0], [2600, 0, 0]])
      .every((x) => x.lookRightThenLeft === 0)).toBe(true);
    expect(run(make(), [[0, 0.8, 0, { headLeft: 0.5 }], [300, 0.8, 0, { headLeft: 0.5 }], [400, 0, 0], [600, 0, 0.8], [1000, 0, 0.8]])
      .every((x) => x.lookLeftThenRight === 0)).toBe(true);
  });

  // 🔴 Probed 2026-09-23 before the cut: ten of twenty-five decisions of this reader could be undone with the suite
  // green. The cases below are the eight that are rules; the other two are one rule written twice (below).
  const rightButton = (frames) => run(make(), frames).map((x) => x.lookLeftThenRight);
  const crossing = [[0, 0.8, 0], [300, 0.8, 0], [400, 0, 0]]; // a first side to the left, peaked 0.8, left at 400 ms

  it('a head turned to the RIGHT cancels too, and a turn exactly at the mark counts as turned', () => {
    expect(rightButton([[0, 0.8, 0, { headRight: 0.5 }], [300, 0.8, 0, { headRight: 0.5 }], [400, 0, 0], [600, 0, 0.8], [1000, 0, 0.8]]))
      .toEqual([0, 0, 0, 0, 0]);
    expect(rightButton([[0, 0.8, 0, { headLeft: 0.3 }], [300, 0.8, 0, { headLeft: 0.3 }], [400, 0, 0], [600, 0, 0.8], [1000, 0, 0.8]]))
      .toEqual([0, 0, 0, 0, 0]);
  });

  it('the first side counts by its PEAK: a look that reached 0.8 and eased to 0.5 before leaving still starts a crossing', () => {
    expect(rightButton([[0, 0.8, 0], [200, 0.5, 0], [400, 0, 0], [600, 0, 0.8], [1000, 0, 0.8]]).at(-1)).toBe(1);
  });

  it('a second, weaker visit to the first side does not inherit the peak of the one before', () => {
    // left at 0.8 (leaves at 400), then left again only to 0.5 (leaves at 1900): only that fresh exit is inside the window
    expect(rightButton([...crossing, [1500, 0.5, 0], [1800, 0.5, 0], [1900, 0, 0], [2100, 0, 0.8], [2500, 0, 0.8]]))
      .toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('a head that turns BETWEEN the two sides erases the first one', () => {
    expect(rightButton([...crossing, [500, 0, 0, { headLeft: 0.5 }], [600, 0, 0.8], [1000, 0, 0.8]]).at(-1)).toBe(0);
  });

  it('a head that turns in the middle of the second side cancels the press, and it does not come back', () => {
    expect(rightButton([...crossing, [600, 0, 0.8], [700, 0, 0.8, { headRight: 0.5 }], [1000, 0, 0.8]]).slice(3))
      .toEqual([1, 0, 0]);
  });

  it('the window is inclusive: the second side exactly 800 ms after the first left still crosses', () => {
    expect(rightButton([...crossing, [1200, 0, 0.8], [1500, 0, 0.8]]).at(-1)).toBe(1);
  });

  it('the hold is inclusive: at exactly 300 ms it is held, so it stays down while the look eases to the mark', () => {
    expect(rightButton([...crossing, [600, 0, 0.8], [900, 0, 0.8], [1000, 0, 0.4]]).slice(3)).toEqual([1, 1, 1]);
  });

  it('after a release, looking back to the same side is no press — a new press needs a new crossing', () => {
    expect(rightButton([...crossing, [600, 0, 0.8], [1000, 0, 0.8], [1100, 0, 0], [1300, 0, 0.8], [1700, 0, 0.8]]).slice(5))
      .toEqual([0, 0, 0]);
  });
});

describe('the whole reader', () => {
  it('an open mouth held 600 ms presses action2 once and holds it; nothing else is held', () => {
    const read = createFaceMapReader({ rest: NO_REST });
    const frames = [0, 100, 300, 500, 600, 700].map((ms) => read(ms, { jawOpen: 0.8 }));
    expect(frames.flatMap((f) => f.started)).toEqual(['action2']);
    expect(frames.at(-1).held).toEqual(['action2']);
    expect(read(800, {}).held).toEqual([]);
  });
  it('the exclusions run inside it: lips pressed hard enough to lift the smile press action1 and not action3', () => {
    const read = createFaceMapReader({ rest: NO_REST });
    const started = [0, 300, 600, 700].flatMap((ms) => read(ms, { mouthPressLeft: 0.6, mouthSmileLeft: 0.4 }).started);
    expect(started).toEqual(['action1']);
  });
  it('the rest measures itself: three still seconds in a row, and any movement restarts the count', () => {
    const rest = createFaceRest();
    let out = null;
    for (let ms = 0; ms <= 2000; ms += 100) out = rest(ms, { jawOpen: 0.1 + (ms % 200 ? 0.01 : 0) }, 0.02);
    expect(out.rest).toBeNull(); expect(out.stillMs).toBe(2000);
    out = rest(2100, { jawOpen: 0.6 }, 0.02); // the child talks
    expect(out).toEqual({ rest: null, stillMs: 0 });
    for (let ms = 2200; ms <= 5000; ms += 100) out = rest(ms, { jawOpen: 0.6 }, 0.02);
    expect(out.rest).toBeNull();
    out = rest(5100, { jawOpen: 0.6 }, 0.02);
    expect(out.rest).toEqual({ scores: expect.objectContaining({ jawOpen: 0.6 }), headX: 0.02 });
  });
  it('a head that turns restarts the rest too', () => {
    const rest = createFaceRest();
    for (let ms = 0; ms <= 2500; ms += 100) rest(ms, {}, 0);
    expect(rest(2600, {}, 0.3)).toEqual({ rest: null, stillMs: 0 });
  });
  it('the rest from samples is each blendshape\'s median, and the nose\'s', () => {
    const rest = faceRestFromSamples([{ scores: { jawOpen: 0.1 }, headX: 0.02 }, { scores: { jawOpen: 0.3 }, headX: 0.04 }, { scores: { jawOpen: 0.2 }, headX: null }]);
    expect(rest).toEqual({ scores: { jawOpen: 0.2 }, headX: 0.04 });
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-face-map.py`:
//   · a look needing only one eye (max instead of min)        → «needs both eyes»
//   · the squeeze by the less closed eye                        → «one eye is enough»
//   · the head's sides swapped                                  → «image +x is the player's left»
//   · no exclusion of the pucker by the mouth to a side         → «clears the pucker»
//   · the squeeze not clearing the frown                        → «clears the frown it pulls»
//   · the pucker's own mark dropped                             → «own mark 0.6»
//   · the long squeeze not waiting                              → «held 1 s presses once»
//   · the mouth hold not waiting                                → «spoken syllable»
//   · the crossing window ignored                               → «slower than 0.8 s»
//   · the first side's peak not required                        → «peaked at 0.5»
//   · a turned head not cancelling                              → «head turned»
//   · the reader skipping the exclusions                        → «the exclusions run inside it» (survived until that case existed)
//   · the rest not restarted by a movement                   → «any movement restarts the count»
//   · the rest ready at half the still time                   → «three still seconds in a row»
