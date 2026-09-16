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

const WRIST = 0;
const FINGERS = { index: [5, 6, 8], middle: [9, 10, 12], ring: [13, 14, 16], little: [17, 18, 20] } as const;
type Finger = keyof typeof FINGERS;
const dist = (a: HandPoint, b: HandPoint): number => Math.hypot(a.x - b.x, a.y - b.y);

/** The gestures this module reads from the landmarks (usually none or one). */
export function customGestures(m: readonly HandPoint[] | null | undefined): HandGesture[] {
  if (!m || m.length < 21) return [];
  const palm = dist(m[WRIST]!, m[9]!) || 1e-6;
  const out = {} as Record<Finger, boolean>;
  for (const [name, [base, joint, tip]] of Object.entries(FINGERS) as [Finger, readonly [number, number, number]][]) {
    out[name] = dist(m[tip]!, m[WRIST]!) > dist(m[joint]!, m[WRIST]!) * 1.1 && dist(m[tip]!, m[base]!) > palm * 0.55;
  }
  const thumbOut = dist(m[4]!, m[5]!) > palm * 0.75 && dist(m[4]!, m[WRIST]!) > dist(m[3]!, m[WRIST]!);
  const toThumb = (i: number): number => dist(m[i]!, m[4]!) / palm;
  // the index's direction as the child sees it (mirrored): its base to its tip
  const dx = -(m[8]!.x - m[5]!.x), dy = m[8]!.y - m[5]!.y;
  const way = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'Right' : 'Left') : (dy > 0 ? 'Down' : 'Up');
  const folded = (...fs: Finger[]): boolean => fs.every((f) => !out[f]);
  const near = 0.35, g: HandGesture[] = [];
  if (out.index && folded('middle', 'ring', 'little') && dist(m[4]!, m[7]!) / palm >= 0.3) g.push(`index${way}` as HandGesture);
  if (out.index && out.middle && folded('ring', 'little') && way === 'Up') g.push('victory');
  if (out.index && out.middle && out.ring && !out.little && !thumbOut) g.push('threeFingers');
  if (out.index && out.middle && out.ring && out.little && !thumbOut) g.push('fourFingers');
  if (toThumb(12) < near && toThumb(16) < near && out.index && out.little) g.push('dog');
  if ([8, 12, 16, 20].every((i) => toThumb(i) < 0.6) && toThumb(8) < near) g.push('zero');
  return g;
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
