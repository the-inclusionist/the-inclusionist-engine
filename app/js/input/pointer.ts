// SPDX-License-Identifier: AGPL-3.0-or-later
// input/pointer.ts — WHAT THE GAME RECEIVES WHEN IT ASKS FOR A POINTER (ADR-0112), the PURE half.
//
// ========================= WHAT THIS MODULE IS =========================
// A pointer SAMPLE and the questions asked about it. No DOM, no time, no events. The touch pad's pointer wiring captures
// (issue #105 measured it as already whole); `input/pointer-space` converts a screen point. What was missing is what
// sits BETWEEN them: the shape that crosses the boundary to the cartridge.
//
// ⚠️ AND THE SAMPLE CARRIES ITS ORIGIN, because ADR-0111 says every command does. A stroke made with the eyes and one made
// with the mouse must be distinguishable by the engine — ADR-0109's assisted-transport rules depend on knowing which
// device is in use, and a drawing is no exception.
//
// 📌 THE ORIGIN IS REQUIRED HERE, unlike the keys' `sourceOf`, which returns `undefined`. The difference is not rigour, it
// is structure: a key enters a SHARED set where any code can dispatch a synthetic event, so "I do not know" is an honest
// answer. A pointer sample is built BY the transport that produced it — it always knows what it is, because it is itself.

import type { TransportName } from './transport-in-use.js';
import type { AsFraction } from './pointer-space.js';

/**
 * Where the pointer is and what it is doing.
 *
 * `fx`/`fy` are a fraction of the game's element, in `pointer-space`'s convention: `0,0` is the top-left corner and `1,1`
 * the bottom-right. ⚠️ They can leave `0..1` — see `isInside`.
 */
export interface PointerSample {
  readonly fx: number;
  readonly fy: number;
  /** Who produced this sample (ADR-0111). */
  readonly source: TransportName;
  /** Is the "pen" down? Mouse: button pressed. Touch: finger in contact. Gaze: dwell. */
  readonly pressed: boolean;
}

/** The resting sample: the region's centre, not pressed, the keyboard — the same default `transport-in-use` assumes. */
export const DEFAULT_POINTER: PointerSample = Object.freeze({ fx: 0.5, fy: 0.5, source: 'teclado', pressed: false });

/**
 * Is the sample INSIDE the game's region?
 *
 * ⚠️ THIS QUESTION EXISTS APART FROM THE POSITION, and that is the whole decision of this file. `asFraction` does not
 * saturate, on purpose, and two things downstream need opposite halves of it:
 *
 *   · DRAWING needs the position CLAMPED to `0..1`, or the stroke jumps off screen when the hand passes the edge during a
 *     captured drag;
 *   · ADR-0104's EYES MODE 3 uses "looking off the screen" as a navigation command — for a child with severe ALS, looking
 *     up OFF the screen is the gesture that opens the list of actions.
 *
 * ⚠️ SATURATING WITHOUT KEEPING THIS ANSWER WOULD KILL THE SECOND. The family of defect this repository has paid for
 * several times: information thrown away at the door, and the consumer that depended on it finding out late that the
 * question no longer has an answer.
 */
export function isInside(f: AsFraction): boolean {
  return f.fx >= 0 && f.fx <= 1 && f.fy >= 0 && f.fy <= 1;
}

/**
 * The position CLAMPED to `0..1`, for whoever draws.
 *
 * 📌 It returns the SAME object when it is already inside, not a copy. The pointer is sampled every frame, and an
 * allocation per frame on a school device is exactly the kind of cost pillar 1 refuses.
 */
export function clampInside(f: AsFraction): AsFraction {
  if (isInside(f)) return f;
  return { fx: Math.min(1, Math.max(0, f.fx)), fy: Math.min(1, Math.max(0, f.fy)) };
}

/** The press edge between two samples: the pen went down, went up, or nothing changed. */
export type PressEdge = 'desceu' | 'subiu' | null;

/**
 * Comparing two samples gives the EDGE, which is what a game reads.
 *
 * ⚠️ THE EDGE AND NOT THE STATE, for the reason the pad's previous-action memory already gives: a game that asked "is it
 * pressed?" every frame would draw the same point sixty times, and one that wanted to react to the click would have to
 * keep the previous frame on its own — in every game.
 */
export function pressEdge(previous: PointerSample, current: PointerSample): PressEdge {
  if (previous.pressed === current.pressed) return null;
  return current.pressed ? 'desceu' : 'subiu';
}

/**
 * Did the TRANSPORT change between these two samples?
 *
 * ⚠️ It exists because ADR-0109 makes a change of device an event with consequences — the toggle follows the device in
 * use — and a pointer is one of the places where the change happens with no key pressed: the child lets go of the mouse
 * and looks at the screen. Without this question, the change would be invisible until the next key.
 */
export function switchedTransport(previous: PointerSample, current: PointerSample): boolean {
  return previous.source !== current.source;
}
