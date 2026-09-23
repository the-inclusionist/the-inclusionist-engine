// SPDX-License-Identifier: AGPL-3.0-or-later
// input/hand-map — THE HANDS AS A CONTROLLER: FOURTEEN GESTURES AND THE ACTIONS THEY PRESS (ADR-0210, ADR-0206; issue #191).
//
// The Dev's map, measured in the lab's bar rounds (14 of 14 read, the exclusions below taken from those runs). Six gestures are MediaPipe's
// Gesture Recognizer's own; eight are read here from the 21 hand landmarks, in an orientation-free form — a finger is out when its tip is
// farther from the wrist than its middle joint, distances in palm sizes (cvzone's `fingersUp` idea without its x test, which flips with the
// hand). A gesture presses once it has been seen for 300 ms (its level, seen time over 600 ms, reaches 0.5), and stays pressed while seen.
// · Exclusions: an index pointing down brings MediaPipe's Thumb_Down, an open hand reads as four fingers (the thumb seen folded), a fist as a
//   zero — the specific one clears the other.
// · Directions are the CHILD'S: the video a child sees is mirrored, so the child's right is the image's −x.
// ⚠️ Levels are keyed by gesture, never by action (ADR-0112); HAND_MAP turns the held gestures into actions.

import type { Action } from '../core/actions.js';

export type HandGesture =
  | 'indexUp' | 'indexDown' | 'indexLeft' | 'indexRight' | 'iLoveYou' | 'dog' | 'victory' | 'fist' | 'openPalm' | 'zero'
  | 'thumbUp' | 'thumbDown' | 'threeFingers' | 'fourFingers';

/** The Dev's map (ADR-0210). */
export const HAND_MAP: { readonly [G in HandGesture]: Action } = {
  indexUp: 'up', indexDown: 'down', indexLeft: 'left', indexRight: 'right', iLoveYou: 'start', dog: 'select',
  victory: 'action1', fist: 'action2', openPalm: 'action3', zero: 'action4',
  thumbUp: 'leftShoulder', thumbDown: 'leftTrigger', threeFingers: 'rightShoulder', fourFingers: 'rightTrigger',
};
const GESTURES = Object.keys(HAND_MAP) as HandGesture[];

/** MediaPipe Gesture Recognizer category names the map uses, and what they are here. */
export const CANNED_GESTURES: { readonly [name: string]: HandGesture } = {
  ILoveYou: 'iLoveYou', Victory: 'victory', Closed_Fist: 'fist', Open_Palm: 'openPalm', Thumb_Up: 'thumbUp', Thumb_Down: 'thumbDown',
};

export interface HandPoint { readonly x: number; readonly y: number; readonly z?: number }

// The landmark numbers MediaPipe hands out, named where the rules use them: a rule that reads `apart(MIDDLE_TIP,
// THUMB_TIP)` says what it is looking at, and `dist(m[12], m[4])` makes the reader count on their fingers.
const WRIST = 0, THUMB_JOINT = 3, THUMB_TIP = 4, INDEX_BASE = 5, INDEX_JOINT = 7, INDEX_TIP = 8;
const MIDDLE_BASE = 9, MIDDLE_TIP = 12, RING_TIP = 16, LITTLE_TIP = 20;
const FINGERS = { index: [5, 6, 8], middle: [9, 10, 12], ring: [13, 14, 16], little: [17, 18, 20] } as const;
type Finger = keyof typeof FINGERS;
const dist = (a: HandPoint, b: HandPoint): number => Math.hypot(a.x - b.x, a.y - b.y);

type Way = 'Up' | 'Down' | 'Left' | 'Right';

/** Where the index points, as the CHILD sees it: the video a child watches is mirrored, so the child's right is −x. */
const wayOfTheIndex = (m: readonly HandPoint[]): Way => {
  const dx = -(m[INDEX_TIP]!.x - m[INDEX_BASE]!.x), dy = m[INDEX_TIP]!.y - m[INDEX_BASE]!.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'Right' : 'Left') : (dy > 0 ? 'Down' : 'Up');
};

/** What one frame says about the hand, in the terms every rule below is written in. */
interface HandShape {
  readonly out: Readonly<Record<Finger, boolean>>;
  readonly thumbOut: boolean;
  readonly way: Way;
  /** How far two landmarks are from each other, IN PALM SIZES — which is the unit every threshold here speaks. */
  readonly apart: (a: number, b: number) => number;
  readonly folded: (...fs: Finger[]) => boolean;
}

const readHand = (m: readonly HandPoint[], palm: number): HandShape => {
  const out = {} as Record<Finger, boolean>;
  for (const [name, [base, joint, tip]] of Object.entries(FINGERS) as [Finger, readonly [number, number, number]][]) {
    // BOTH halves, and each catches a hand the other lets through: a finger curled SIDEWAYS reaches away from its
    // base without passing its joint, and one pointing AT THE CAMERA passes its joint without reaching anywhere.
    out[name] = dist(m[tip]!, m[WRIST]!) > dist(m[joint]!, m[WRIST]!) * 1.1 && dist(m[tip]!, m[base]!) > palm * 0.55;
  }
  return {
    out,
    // far from the index AND leading its own joint: the second half is what tells an out thumb from one tucked
    // across the palm, which is how a hand rests
    thumbOut: dist(m[THUMB_TIP]!, m[INDEX_BASE]!) > palm * 0.75
      && dist(m[THUMB_TIP]!, m[WRIST]!) > dist(m[THUMB_JOINT]!, m[WRIST]!),
    way: wayOfTheIndex(m),
    apart: (a, b) => dist(m[a]!, m[b]!) / palm,
    folded: (...fs) => fs.every((f) => !out[f]),
  };
};

/** A fingertip this close to the thumb, in palms, is ON it. */
const NEAR = 0.35;

/*
 * ONE ROW PER GESTURE, in the order they are answered — a table because that is what this already was: a gesture is
 * a predicate over the hand plus the name it gives itself. The six `if`s these rows replace all reached for the same
 * six locals, which is what made this the worst function of the tree outside the composition root (33 paths against
 * McCabe's 10). A gesture the Dev adds is now a LINE.
 */
const RULES: readonly { readonly name: (h: HandShape) => HandGesture; readonly reads: (h: HandShape) => boolean }[] = [
  {
    name: (h) => `index${h.way}` as HandGesture,
    // the thumb AWAY from the index joint is what keeps a pinch from commanding a direction — the lab dropped the
    // pinch from the map (ADR-0206), and without this half a pinch would come back in as a direction
    reads: (h) => h.out.index && h.folded('middle', 'ring', 'little') && h.apart(THUMB_TIP, INDEX_JOINT) >= 0.3,
  },
  { name: () => 'victory', reads: (h) => h.out.index && h.out.middle && h.folded('ring', 'little') && h.way === 'Up' },
  { name: () => 'threeFingers', reads: (h) => h.out.index && h.out.middle && h.out.ring && !h.out.little && !h.thumbOut },
  { name: () => 'fourFingers', reads: (h) => h.out.index && h.out.middle && h.out.ring && h.out.little && !h.thumbOut },
  {
    name: () => 'dog',
    reads: (h) => h.apart(MIDDLE_TIP, THUMB_TIP) < NEAR && h.apart(RING_TIP, THUMB_TIP) < NEAR && h.out.index && h.out.little,
  },
  {
    name: () => 'zero',
    reads: (h) => [INDEX_TIP, MIDDLE_TIP, RING_TIP, LITTLE_TIP].every((i) => h.apart(i, THUMB_TIP) < 0.6)
      && h.apart(INDEX_TIP, THUMB_TIP) < NEAR,
  },
];

/** The gestures this module reads from the landmarks (usually none or one). */
export function customGestures(m: readonly HandPoint[] | null | undefined): HandGesture[] {
  if (!m || m.length < 21) return [];
  /*
   * 🔴 A HAND WITH NO SIZE IS NOT A HAND, and the floor this line used to carry (`|| 1e-6`) got that backwards. It was
   * there to keep the divisions safe, and it did — but it also gave every ratio an answer: 📏 measured on 2026-09-23,
   * a frame whose 21 landmarks all collapsed onto one point read as a `zero`, because every fingertip then sits ZERO
   * palms from the thumb. A detection that failed pressed action4. Refusing the frame is what «not readable» means.
   *
   * ⚠️ And the honest note about the line below: with the floor gone it is EQUIVALENT today — a palm of zero makes
   * every ratio NaN, and `NaN < 0.6` is false, so every rule declines on its own. That is correctness by accident:
   * it holds only while every rule compares with `<`. The line says the refusal where a reader looks for it, and
   * the mutation that proves it is not decoration is putting the floor back, which goes red.
   */
  const palm = dist(m[WRIST]!, m[MIDDLE_BASE]!);
  if (!(palm > 0)) return [];
  const hand = readHand(m, palm);
  return RULES.filter((r) => r.reads(hand)).map((r) => r.name(hand));
}

/** Every gesture seen in a frame: the recognizer's categories plus the landmark rules. */
export function gesturesSeen(landmarks: readonly HandPoint[] | null | undefined, cannedNames: Iterable<string>): Set<HandGesture> {
  const seen = new Set<HandGesture>(customGestures(landmarks));
  for (const n of cannedNames) { const g = CANNED_GESTURES[n]; if (g) seen.add(g); }
  return seen;
}

const DOMINATES: { readonly [G in HandGesture]?: HandGesture } = { indexDown: 'thumbDown', openPalm: 'fourFingers', fist: 'zero' };

/** The whole reader: a frame's gestures in, the actions held and the ones that just started out. */
export function createHandMapReader({ fullMs = 600, mark = 0.5 }: { fullMs?: number; mark?: number } = {}) {
  const since = new Map<HandGesture, number>(), held = new Set<HandGesture>();
  return (ms: number, seen: ReadonlySet<HandGesture>): { held: Action[]; started: Action[] } => {
    const level = (g: HandGesture): number => {
      if (!seen.has(g)) { since.delete(g); return 0; }
      if (!since.has(g)) since.set(g, ms);
      return Math.min(1, (ms - since.get(g)!) / fullMs);
    };
    const levels = new Map(GESTURES.map((g) => [g, level(g)] as const));
    for (const [strong, weak] of Object.entries(DOMINATES) as [HandGesture, HandGesture][]) if (levels.get(strong)! >= mark) levels.set(weak, 0);
    const started: Action[] = [];
    for (const g of GESTURES) {
      if (levels.get(g)! >= mark) { if (!held.has(g)) { held.add(g); started.push(HAND_MAP[g]); } }
      else held.delete(g);
    }
    return { held: [...held].map((g) => HAND_MAP[g]), started };
  };
}
