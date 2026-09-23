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
const BASES = [5, 9, 13, 17];

/** A closed hand with every fingertip swung sideways: FAR from its own base, but never past its joint. */
const curledSideways = () => {
  const m = hand({ fingers: FIST });
  for (const b of BASES) m[b + 3] = { x: m[b + 3].x + 0.08, y: m[b + 3].y };
  return m;
};
/** Every finger pointing AT the camera: the joint projects back onto the wrist and the tip barely leaves its base. */
const towardsTheCamera = () => {
  const m = hand({ fingers: FIST });
  for (const b of BASES) { m[b + 1] = { x: 0.5, y: 0.65 }; m[b + 3] = { x: m[b].x, y: m[b].y - 0.025 }; }
  return m;
};

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
  it('⚠️ a finger is out only when BOTH halves of the rule agree: past its joint AND reaching past half a palm', () => {
    /*
     * 🎯 The two halves catch two different hands, and each was unheld: a finger CURLED SIDEWAYS satisfies the reach
     * and not the extension, and a finger pointing AT THE CAMERA satisfies the extension and not the reach. A hand
     * with either of them read as an open hand, which in the Dev's map is action3 — a button the child never asked
     * for, from a hand the child is only resting.
     */
    expect(customGestures(curledSideways()), 'fingertips swung sideways read as four fingers out').not.toContain('fourFingers');
    expect(customGestures(towardsTheCamera()), 'fingers pointing at the camera read as four fingers out').not.toContain('fourFingers');
  });
  it('⚠️ a thumb tucked ACROSS the palm is not an out thumb, however far it sits from the index', () => {
    /*
     * 📌 The far-from-the-index half alone says «out» for a thumb folded across the palm, which is how a hand rests.
     * The second half — the tip leads its own joint away from the wrist — is what tells the two apart, and it is what
     * keeps `threeFingers` and `fourFingers` reachable for a child who tucks the thumb.
     */
    const m = hand();
    m[4] = { x: 0.56, y: 0.68 }; // far from the index base, and closer to the wrist than its own joint
    expect(customGestures(m), 'a thumb tucked across the palm counted as OUT, and four fingers stopped reading').toContain('fourFingers');
  });
  it('⚠️ a closed hand points nowhere, and a thumb pinched on the index joint is a pinch and not a direction', () => {
    expect(customGestures(hand({ fingers: FIST, thumbFolded: false })), 'a closed hand with the thumb out pointed the child somewhere').toEqual([]);
    const pinch = hand({ fingers: INDEX });
    pinch[4] = { x: 0.47, y: 0.53 }; // the thumb on the index's joint
    expect(customGestures(pinch), 'a pinch commanded a direction — the lab dropped the pinch from the map (ADR-0206)').toEqual([]);
  });
  it('⚠️ three fingers needs the thumb folded, and the dog needs the index and little OUT', () => {
    expect(customGestures(hand({ fingers: [true, true, true, false], thumbFolded: false })),
      'three fingers with the thumb OUT is a different hand, and it pressed rightShoulder').toEqual([]);
    const closedDog = hand({ fingers: FIST });
    closedDog[12] = { ...closedDog[4] }; closedDog[16] = { ...closedDog[4] };
    expect(customGestures(closedDog), 'middle and ring on the thumb with the hand CLOSED is not the dog — the dog shows index and little').toEqual([]);
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
  it('⚠️ the exclusion only acts once the specific gesture is AT the mark — a flicker does not cancel a held one', () => {
    /*
     * 🎯 This is the lab's own finding, in the rounds of 2026-09-15: «a exclusão só age quando R1 já está na marca».
     * An exclusion that acted from the first frame a gesture is SEEN would let a 100 ms wobble of the hand release a
     * button the child is deliberately holding — and the child would have no way to tell why it let go.
     */
    const read = createHandMapReader();
    expect(frames(read, [[0, ['thumbDown']], [300, ['thumbDown']]])).toEqual(['leftTrigger']);
    read(400, new Set(['thumbDown', 'indexDown']));
    const out = read(500, new Set(['thumbDown', 'indexDown'])); // index down at 0.17 of the mark
    expect(out.held, 'a flicker of index down released a held thumb down').toEqual(['leftTrigger']);
    expect(out.started, 'and it pressed nothing of its own').toEqual([]);
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
//
// 🔴 AND THE WHOLE MODULE WAS PROBED AGAIN ON 2026-09-23, decision by decision, before cutting `customGestures` (33
// paths against McCabe's 10). **Eleven of thirty-one were blind**, and they clustered in the LANDMARK GEOMETRY — the
// part the lab rounds never exercised, because the lab drove the page and the page only ever fed it real hands. The
// cases above close ten of them; the eleventh is declared:
//   · 🟡 the level capped at one (`Math.min(1, …)`) is EQUIVALENT today, and the reason is that the level never
//     leaves the reader: the only thing done with it is `>= mark`, so a level of 3 and a level of 1 decide alike.
//     It stays because it is what makes the NAME true — a level is a fraction of the way to the mark — and it would
//     stop being equivalent the day anything asks the reader how far along a gesture is.
// 📏 After the cases: 30 of 31 red, control green.
