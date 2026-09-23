// SPDX-License-Identifier: AGPL-3.0-or-later
// THE HANDS AS A CONTROLLER (ADR-0210, ADR-0206; issue #191). Ported from the hand half of the lab's `mapa.check.mjs` and from
// `maos-direcoes.check.mjs`, on the same synthetic hands.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { HAND_MAP, CANNED_GESTURES, customGestures, gesturesSeen, createHandMapReader } from '../app/js/input/hand-map.js';

/** A synthetic hand in the camera's unmirrored image: fingers [index, middle, ring, little] out or folded, turned by `turn` radians. */
function hand({ x = 0.5, y = 0.7, p = 0.1, fingers = [true, true, true, true], thumbFolded = true, turn = 0 } = {}) {
  const l = Array.from({ length: 21 }, () => ({ x, y }));
  const bases = [5, 9, 13, 17], cols = [-0.3, 0, 0.3, 0.55];
  fingers.forEach((out, i) => {
    const cx = x + cols[i] * p, b = bases[i];
    l[b] = { x: cx, y: y - p }; l[b + 1] = { x: cx, y: y - 1.4 * p };
    l[b + 2] = { x: cx, y: out ? y - 1.8 * p : y - 1.2 * p }; l[b + 3] = { x: cx, y: out ? y - 2.2 * p : y - 0.9 * p };
  });
  l[2] = { x: x - 0.5 * p, y: y - 0.3 * p }; l[3] = { x: x - 0.7 * p, y: y - 0.5 * p };
  l[4] = thumbFolded ? { x: x - 0.25 * p, y: y - 0.95 * p } : { x: x - 1.2 * p, y: y - 0.6 * p };
  l[9] = { x, y: y - p };
  if (turn) { const c = Math.cos(turn), s = Math.sin(turn); for (const q of l) { const dx = q.x - x, dy = q.y - y; q.x = x + dx * c - dy * s; q.y = y + dx * s + dy * c; } }
  return l;
}
const INDEX = [true, false, false, false], TWO = [true, true, false, false], FIST = [false, false, false, false];

describe('the map', () => {
  it('is the Dev\'s: fourteen gestures on fourteen actions', () => {
    expect(HAND_MAP).toEqual({
      indexUp: 'up', indexDown: 'down', indexLeft: 'left', indexRight: 'right', iLoveYou: 'start', dog: 'select',
      victory: 'action1', fist: 'action2', openPalm: 'action3', zero: 'action4',
      thumbUp: 'leftShoulder', thumbDown: 'leftTrigger', threeFingers: 'rightShoulder', fourFingers: 'rightTrigger',
    });
    expect(new Set(Object.values(HAND_MAP)).size).toBe(14);
  });
  it('six are the recognizer\'s own categories', () => {
    expect(Object.keys(CANNED_GESTURES).sort()).toEqual(['Closed_Fist', 'ILoveYou', 'Open_Palm', 'Thumb_Down', 'Thumb_Up', 'Victory']);
  });
});

describe('the gestures read from the landmarks', () => {
  it('the index points the child\'s way: up, down, and the child\'s right is the image\'s −x', () => {
    expect(customGestures(hand({ fingers: INDEX }))).toEqual(['indexUp']);
    expect(customGestures(hand({ fingers: INDEX, turn: Math.PI }))).toEqual(['indexDown']);
    expect(customGestures(hand({ fingers: INDEX, turn: -Math.PI / 2 }))).toEqual(['indexRight']);
    expect(customGestures(hand({ fingers: INDEX, turn: Math.PI / 2 }))).toEqual(['indexLeft']);
  });
  it('two fingers up are the V; two fingers sideways are nothing', () => {
    expect(customGestures(hand({ fingers: TWO }))).toEqual(['victory']);
    expect(customGestures(hand({ fingers: TWO, turn: -Math.PI / 2 }))).toEqual([]);
  });
  it('three and four fingers with the thumb folded; an open hand with the thumb out is not four fingers', () => {
    expect(customGestures(hand({ fingers: [true, true, true, false] }))).toEqual(['threeFingers']);
    expect(customGestures(hand())).toEqual(['fourFingers']);
    expect(customGestures(hand({ thumbFolded: false }))).toEqual([]);
  });
  it('the dog: middle and ring on the thumb, index and little out', () => {
    const m = hand({ fingers: [true, false, false, true] });
    m[12] = { ...m[4] }; m[16] = { ...m[4] };
    expect(customGestures(m)).toContain('dog');
  });
  it('the zero: every fingertip near the thumb, the index closest', () => {
    const m = hand({ fingers: FIST });
    for (const i of [8, 12, 16, 20]) m[i] = { x: m[4].x + 0.01, y: m[4].y + 0.01 };
    expect(customGestures(m)).toContain('zero');
    expect(customGestures(hand({ fingers: FIST }))).not.toContain('zero');
    const loose = hand({ fingers: FIST });
    for (const i of [8, 12, 16, 20]) loose[i] = { x: loose[4].x + 0.03, y: loose[4].y + 0.03 }; // 0.42 palms: near, but the index does not touch
    expect(customGestures(loose), 'a loose curl with the index off the thumb is no zero').not.toContain('zero');
  });
  it('⚠️ a frame that is not a readable hand presses NOTHING — too few landmarks, or a hand with no size', () => {
    /*
     * 🔴 The second half is a defect this file did not hold, found by disabling each decision of `customGestures` on
     * 2026-09-23 and MEASURED before it was believed: with every landmark on one point the module answered `zero`,
     * which is action4. A detector that failed was pressing a button.
     */
    expect(customGestures(hand({ fingers: INDEX }).slice(0, 20)), 'a half-detected hand read gestures out of landmarks that are not there').toEqual([]);
    const collapsed = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.7 }));
    expect(customGestures(collapsed), 'every fingertip sits zero palms from the thumb, so the frame read as a ZERO').toEqual([]);
  });
  it('no landmarks read nothing; the recognizer\'s names join the landmark rules', () => {
    expect(customGestures(undefined)).toEqual([]);
    expect([...gesturesSeen(hand({ fingers: INDEX }), ['Thumb_Up', 'Pointing_Up'])].sort()).toEqual(['indexUp', 'thumbUp']);
  });
});

describe('the reader', () => {
  const frames = (read, list) => list.flatMap(([ms, seen]) => read(ms, new Set(seen)).started);
  it('a gesture presses once seen for 300 ms, once, and is held while seen', () => {
    const read = createHandMapReader();
    expect(frames(read, [[0, ['victory']], [200, ['victory']]])).toEqual([]);
    expect(frames(read, [[300, ['victory']], [500, ['victory']]])).toEqual(['action1']);
    expect(read(600, new Set(['victory'])).held).toEqual(['action1']);
    expect(read(700, new Set()).held).toEqual([]);
  });
  it('a gesture lost resets its clock: a 150 ms flicker never presses', () => {
    const read = createHandMapReader();
    expect(frames(read, [[0, ['fist']], [150, []], [200, ['fist']], [400, ['fist']]])).toEqual([]);
  });
  it('index down is not thumb down; an open hand is not four fingers; a fist is not a zero; a zero alone stays', () => {
    const read = createHandMapReader();
    expect(frames(read, [[0, ['indexDown', 'thumbDown']], [300, ['indexDown', 'thumbDown']]])).toEqual(['down']);
    expect(frames(createHandMapReader(), [[0, ['openPalm', 'fourFingers']], [300, ['openPalm', 'fourFingers']]])).toEqual(['action3']);
    expect(frames(createHandMapReader(), [[0, ['fist', 'zero']], [300, ['fist', 'zero']]])).toEqual(['action2']);
    expect(frames(createHandMapReader(), [[0, ['zero']], [300, ['zero']]])).toEqual(['action4']);
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-hand-map.py`:
//   · the direction not mirrored                        → «the child's right is the image's −x»
//   · V in any direction                                 → «two fingers sideways are nothing»
//   · four fingers regardless of the thumb               → «not four fingers»
//   · the zero without the index closest                 → «the zero»
//   · the hold at 0 ms (mark 0)                          → «presses once seen for 300 ms»
//   · a lost gesture keeping its clock                   → «flicker never presses»
//   · no exclusion of thumb down by index down           → «index down is not thumb down»
//   · no exclusion of the zero by the fist               → «a fist is not a zero»
